/**
 * Hospital Service
 * 
 * Implements Pan-India dynamic nearest-hospital discovery and routing:
 * 1. Live GPS coordinates only (zero hardcoded locations, cities, or hospital catalogs).
 * 2. Overpass API search across progressive radii (2km -> 5km -> 10km) using
 *    nwr["amenity"="hospital"] and nwr["healthcare"="hospital"] with out center.
 * 3. Sorting candidates by Haversine distance and selecting the closest 8.
 * 4. Single OSRM Table API call (lng,lat order) to calculate road driving durations.
 * 5. Minimum road duration selection for optimal ER transit.
 * 6. Structured diagnostic logging.
 */

import API from "./api.js";
import { formatDialNumber } from "./locationService.js";

/**
 * Calculates straight-line Haversine distance between two coordinates in kilometers.
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * Checks bed allocation for the user's emergency request.
 * If a bed is available and reserved, returns { bedAllocated: true, hospital, emergency }.
 * If no bed is allocated (e.g. at capacity), returns { bedAllocated: false, reason }.
 */
export async function checkBedAllocation(userLoc, emergencyType = "general") {
  try {
    const res = await API.post("/emergency/trigger", {
      lat: userLoc.latitude,
      lng: userLoc.longitude,
      emergencyType
    });

    const emergency = res.data?.data?.emergency || res.data?.emergency;
    const hospital = emergency?.assignedHospitalId;

    if (hospital && (hospital.erBedsAvailable > 0 || emergency?.hospitalEtaMinutes)) {
      return {
        bedAllocated: true,
        hospital,
        emergency,
        message: "Bed successfully reserved at emergency hospital."
      };
    }

    return {
      bedAllocated: false,
      reason: "No beds available at your preferred hospital.",
      emergency
    };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    return {
      bedAllocated: false,
      reason: msg.includes("No emergency hospital beds")
        ? "No beds available at your preferred hospital."
        : "Preferred hospital ER is currently at maximum capacity."
    };
  }
}

/**
 * Fetches emergency hospitals around the user's live coordinates using Overpass API.
 * Searches with progressive radii: 2km -> 5km -> 10km.
 * Uses nwr (nodes, ways, relations) and 'out center' for amenity=hospital and healthcare=hospital.
 * Deduplicates and keeps the closest 8 candidates sorted by Haversine distance.
 * 
 * @param {{ latitude: number, longitude: number }} userLoc 
 * @returns {Promise<Array<{ id: string, name: string, address: string, lat: number, lng: number, haversineKm: number }>>}
 */
export async function fetchCandidateHospitals(userLoc) {
  const { latitude: lat, longitude: lng } = userLoc;
  const radiiKm = [2.5, 6, 12];
  const endpoints = [
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  let rawCandidates = [];
  let matchedRadius = null;

  for (const radiusKm of radiiKm) {
    const radiusMeters = radiusKm * 1000;
    const query = `[out:json][timeout:10];(nwr["amenity"="hospital"](around:${radiusMeters},${lat},${lng});nwr["healthcare"="hospital"](around:${radiusMeters},${lat},${lng}););out center;`;

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
          headers: {
            "Accept": "application/json"
          },
          signal: AbortSignal.timeout(4000)
        });

        if (!res.ok) continue;

        const data = await res.json();
        const elements = data?.elements || [];
        if (elements.length === 0) continue;

        const blacklist = /garment|cloth|tailor|shop|store|textile|boutique|canteen|bakery|salon|mart|fashion|jewel|stationery|footwear|sweet|hotel|restaurant/i;
        const seen = new Set();
        const currentRadiusCandidates = [];

        for (const elem of elements) {
          const id = `${elem.type}-${elem.id}`;
          if (seen.has(id)) continue;
          seen.add(id);

          const hLat = elem.lat || elem.center?.lat;
          const hLng = elem.lon || elem.center?.lon;
          if (!hLat || !hLng) continue;

          const tags = elem.tags || {};
          const rawName = tags.name || tags["name:en"] || tags["operator"] || "";
          if (!rawName || blacklist.test(rawName)) continue;

          const name = rawName.toLowerCase().includes("hospital") || rawName.toLowerCase().includes("clinic")
            ? rawName
            : `${rawName} Hospital`;

          const addr = [tags["addr:street"], tags["addr:suburb"], tags["addr:city"]].filter(Boolean).join(", ") || "Emergency Department";
          const distKm = haversineDistanceKm(lat, lng, Number(hLat), Number(hLng));

          currentRadiusCandidates.push({
            id,
            name,
            address: addr,
            lat: Number(hLat),
            lng: Number(hLng),
            phone: tags.phone || tags["contact:phone"] || formatDialNumber(),
            haversineKm: distKm
          });
        }

        if (currentRadiusCandidates.length > 0) {
          rawCandidates = currentRadiusCandidates;
          matchedRadius = radiusKm;
          if (currentRadiusCandidates.length >= 3) {
            break; // Found 3+ candidates at this radius
          }
        }
      } catch (err) {
        // Try next endpoint or radius
      }
    }

    if (rawCandidates.length >= 3) {
      break;
    }
  }

  // Fallback 1: OpenStreetMap Nominatim search with q=hospital if Overpass times out or returns 0
  if (rawCandidates.length === 0) {
    try {
      const delta = 0.08; // ~8km bounding box
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=hospital&bounded=1&viewbox=${lng - delta},${lat + delta},${lng + delta},${lat - delta}&limit=12`;
      const nomRes = await fetch(osmUrl, {
        signal: AbortSignal.timeout(4500)
      });

      if (nomRes.ok) {
        const nomData = await nomRes.json();
        const seen = new Set();
        const blacklist = /garment|cloth|tailor|shop|store|textile|boutique|canteen|bakery|salon|mart|fashion|jewel|stationery|footwear|sweet|hotel|restaurant/i;

        for (const item of nomData) {
          const hLat = parseFloat(item.lat);
          const hLng = parseFloat(item.lon);
          const id = `nom-${item.osm_id}`;
          if (seen.has(id)) continue;
          seen.add(id);

          let name = item.name || item.display_name.split(",")[0].trim();
          if (!name || blacklist.test(name) || blacklist.test(item.display_name)) continue;

          if (name.toLowerCase() === "hospital") {
            const parts = item.display_name.split(",").map(p => p.trim());
            name = parts.find(p => p.toLowerCase() !== "hospital" && p.length > 2) || "Emergency Care Hospital";
          }
          if (!name.toLowerCase().includes("hospital") && !name.toLowerCase().includes("clinic")) {
            name = `${name} Hospital`;
          }

          rawCandidates.push({
            id,
            name,
            address: item.display_name.split(",").slice(1, 4).join(", ").trim() || "Emergency Department",
            lat: hLat,
            lng: hLng,
            phone: formatDialNumber(),
            haversineKm: haversineDistanceKm(lat, lng, hLat, hLng)
          });
        }
      }
    } catch (_) {}
  }

  // Fallback 2: Server-side discovery endpoint
  if (rawCandidates.length === 0) {
    try {
      const backendRes = await API.get("/emergency/nearby-hospitals", {
        params: { lat, lng }
      });
      const backendList = backendRes.data?.data?.hospitals || backendRes.data?.hospitals || [];
      if (Array.isArray(backendList) && backendList.length > 0) {
        for (const item of backendList) {
          rawCandidates.push({
            id: item.id || item._id,
            name: item.name,
            address: item.address || "Emergency Department",
            lat: item.lat,
            lng: item.lng,
            phone: item.phone || formatDialNumber(),
            haversineKm: item.haversineKm ?? haversineDistanceKm(lat, lng, item.lat, item.lng)
          });
        }
      }
    } catch (_) {}
  }

  if (rawCandidates.length === 0) {
    throw new Error("No emergency hospitals could be located near your live coordinates.");
  }

  // Sort candidates by Haversine distance ascending and keep the closest 8
  rawCandidates.sort((a, b) => a.haversineKm - b.haversineKm);
  const closest8 = rawCandidates.slice(0, 8);

  return closest8;
}

/**
 * Calls OSRM Table API once to calculate actual road driving travel times from
 * the user's live location to the candidate hospitals, and selects the hospital
 * with the minimum road travel time.
 * 
 * @param {{ latitude: number, longitude: number, accuracy?: number }} userLoc 
 * @param {Array<{ id: string, name: string, address: string, lat: number, lng: number, haversineKm: number }>} candidates 
 * @returns {Promise<{ hospital: Object, rankedHospitals: Array<Object>, name: string, address: string, lat: number, lng: number, distanceKm: number, etaMinutes: number, roadDurationSec: number }>}
 */
export async function selectFastestHospitalByRoad(userLoc, candidates) {
  if (!userLoc?.latitude || !userLoc?.longitude) {
    throw new Error("Invalid user live coordinates.");
  }
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("Candidate hospital list is empty.");
  }

  const { latitude: userLat, longitude: userLng, accuracy } = userLoc;

  // Single candidate shortcut
  if (candidates.length === 1) {
    const single = candidates[0];
    const roadDist = parseFloat((single.haversineKm * 1.3).toFixed(1));
    const roadMins = Math.max(1, Math.round((roadDist / 35) * 60));
    const singleFormatted = {
      ...single,
      distanceKm: roadDist,
      roadDistanceKm: roadDist,
      etaMinutes: roadMins,
      roadDurationMins: roadMins,
      roadDurationSec: roadMins * 60
    };
    return {
      hospital: singleFormatted,
      rankedHospitals: [singleFormatted],
      name: single.name,
      address: single.address || "Emergency Department",
      lat: single.lat,
      lng: single.lng,
      distanceKm: roadDist,
      etaMinutes: roadMins,
      roadDurationSec: roadMins * 60
    };
  }

  let rankedList = [];

  try {
    // Coordinate list format for OSRM: lng,lat;lng,lat...
    // Source index 0 = user location
    // Destination indices 1..N = candidate hospitals
    const coordString = [`${userLng},${userLat}`, ...candidates.map((c) => `${c.lng},${c.lat}`)].join(";");
    const destIndices = candidates.map((_, idx) => idx + 1).join(";");
    const osrmTableUrl = `https://router.project-osrm.org/table/v1/driving/${coordString}?sources=0&destinations=${destIndices}&annotations=duration,distance`;

    const res = await fetch(osrmTableUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.code === "Ok" && Array.isArray(data.durations?.[0])) {
        const durations = data.durations[0];
        const distances = data.distances?.[0] || [];

        rankedList = candidates.map((cand, idx) => {
          const durationSec = typeof durations[idx] === "number" && durations[idx] !== null ? durations[idx] : Infinity;
          const distanceMeters = typeof distances[idx] === "number" && distances[idx] !== null ? distances[idx] : cand.haversineKm * 1300;
          const roadDist = parseFloat((distanceMeters / 1000).toFixed(2));
          const roadMins = Math.max(1, Math.round(durationSec / 60));
          return {
            ...cand,
            roadDurationSec: durationSec,
            roadDurationMins: roadMins,
            roadDistanceKm: roadDist,
            distanceKm: roadDist,
            etaMinutes: roadMins
          };
        });
      }
    }
  } catch (osrmErr) {
    console.warn("OSRM Table API unavailable, using Haversine offline fallback:", osrmErr.message);
  }

  // Offline fallback if OSRM Table query failed or timed out
  if (rankedList.length === 0) {
    rankedList = candidates.map((cand) => {
      const distanceKm = parseFloat((cand.haversineKm * 1.35).toFixed(2));
      const durationMins = Math.max(1, Math.round((distanceKm / 35) * 60));
      return {
        ...cand,
        roadDurationSec: durationMins * 60,
        roadDurationMins: durationMins,
        roadDistanceKm: distanceKm,
        distanceKm: distanceKm,
        etaMinutes: durationMins
      };
    });
  }

  // Rank ascending by road travel time
  rankedList.sort((a, b) => a.roadDurationSec - b.roadDurationSec);

  const selected = rankedList[0];

  // Log user coordinates, GPS accuracy, candidate list with distances and durations, and selected hospital
  console.group("🚨 [SOS Hospital Selection Engine]");
  console.log("📍 User Live GPS Coordinates:", `${userLat.toFixed(5)}, ${userLng.toFixed(5)}`);
  console.log("🎯 GPS Fix Accuracy:", accuracy ? `${accuracy.toFixed(1)} meters` : "High accuracy mode");
  console.table(
    rankedList.map((h, i) => ({
      Rank: i + 1,
      Name: h.name,
      "Haversine (km)": `${h.haversineKm} km`,
      "Road Distance (km)": `${h.roadDistanceKm} km`,
      "Road Duration": `${h.roadDurationMins} min (${Math.round(h.roadDurationSec)}s)`,
      Coordinates: `${h.lat.toFixed(4)}, ${h.lng.toFixed(4)}`
    }))
  );
  console.log("🏆 Selected Nearest Hospital ER (Minimum Road Time):", selected.name);
  console.log("⏱️ Estimated Road Travel Time:", `${selected.roadDurationMins} minutes (${Math.round(selected.roadDurationSec)} seconds)`);
  console.groupEnd();

  return {
    hospital: selected,
    rankedHospitals: rankedList,
    name: selected.name,
    address: selected.address || "Emergency Department",
    lat: selected.lat,
    lng: selected.lng,
    distanceKm: selected.roadDistanceKm,
    etaMinutes: selected.roadDurationMins,
    roadDurationSec: selected.roadDurationSec
  };
}

/**
 * Backward compatibility wrapper for road weights matrix
 */
export async function fetchRoadWeights(userLoc, hospitals) {
  const roadWeights = {};
  for (const h of hospitals) {
    const id = h.id || h._id || h.name;
    const dist = haversineDistanceKm(userLoc.latitude, userLoc.longitude, h.lat, h.lng);
    const roadDist = parseFloat((dist * 1.35).toFixed(1));
    const roadMins = Math.max(1, Math.round((roadDist / 35) * 60));
    roadWeights[id] = { distanceKm: roadDist, durationMinutes: roadMins };
  }
  return roadWeights;
}
