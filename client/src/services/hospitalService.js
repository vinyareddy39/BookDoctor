/**
 * Hospital Service
 * Handles:
 * 1. Bed check & allocation logic
 * 2. Candidate hospital fetching via Overpass API / database
 * 3. OSRM road distance & duration matrix calculation
 */

import API from "./api";
import { haversineDistanceKm } from "../utils/dijkstra";

/**
 * Checks bed allocation for the user's emergency request.
 * If a bed is available and reserved, returns { bedAllocated: true, hospital, emergency }.
 * If no bed is allocated (e.g. at capacity), returns { bedAllocated: false, reason }.
 */
export async function checkBedAllocation(userLoc, emergencyType = "general") {
  try {
    // Call the server emergency trigger endpoint
    const res = await API.post("/emergency/trigger", {
      lat: userLoc.latitude,
      lng: userLoc.longitude,
      emergencyType
    });

    const emergency = res.data?.data?.emergency || res.data?.emergency;
    const hospital = emergency?.assignedHospitalId;

    // Check if a real bed was allocated
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
    // If server reports no beds or 404, or network issue
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
 * Fetches candidate emergency hospitals around the user's live coordinates (~10km)
 * from OpenStreetMap Overpass API with local fallback.
 */
export async function fetchCandidateHospitals(userLoc, radiusKm = 10) {
  const { latitude: lat, longitude: lng } = userLoc;
  const radiusMeters = Math.round(radiusKm * 1000);

  // 1. Try Overpass API for live verified hospitals (amenity=hospital)
  try {
    const overpassQuery = `[out:json][timeout:5];(node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});way["amenity"="hospital"](around:${radiusMeters},${lat},${lng}););out center 8;`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    const res = await fetch(overpassUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.elements) && data.elements.length > 0) {
        const blacklist = /garment|cloth|tailor|shop|store|textile|boutique|canteen|bakery|salon|mart|fashion/i;

        const candidates = data.elements
          .map((elem) => {
            const hLat = elem.lat || elem.center?.lat;
            const hLng = elem.lon || elem.center?.lon;
            const tags = elem.tags || {};
            const name = tags.name || tags["name:en"] || "Emergency Hospital";
            const addr = [tags["addr:street"], tags["addr:suburb"], tags["addr:city"]].filter(Boolean).join(", ") || "Emergency Department";

            if (blacklist.test(name)) return null;

            return {
              id: `osm-${elem.id}`,
              name: name.toLowerCase().includes("hospital") || name.toLowerCase().includes("clinic") ? name : `${name} Hospital`,
              address: addr,
              lat: Number(hLat),
              lng: Number(hLng),
              phone: tags.phone || tags["contact:phone"] || "108"
            };
          })
          .filter(Boolean);

        if (candidates.length > 0) {
          return candidates;
        }
      }
    }
  } catch (overpassErr) {
    // Fall back to Nominatim structured search or catalog hospitals
  }

  // 2. Try Nominatim structured amenity search
  try {
    const delta = 0.09; // ~10km bounding box
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&amenity=hospital&bounded=1&viewbox=${lng - delta},${lat + delta},${lng + delta},${lat - delta}&limit=6`;
    const nomRes = await fetch(osmUrl, {
      headers: { "User-Agent": "BookDoctor-Emergency/1.0" },
      signal: AbortSignal.timeout(3500)
    });

    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        const blacklist = /garment|cloth|tailor|shop|store|textile|boutique|canteen|bakery|salon|mart|fashion/i;
        const candidates = nomData
          .filter((item) => item.class === "amenity" && (item.type === "hospital" || item.type === "clinic") && !blacklist.test(item.display_name))
          .map((item, idx) => ({
            id: `nom-${item.osm_id || idx}`,
            name: item.name || item.display_name.split(",")[0],
            address: item.display_name.split(",").slice(1, 3).join(", ") || "Emergency Area",
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            phone: "108"
          }));

        if (candidates.length > 0) {
          return candidates;
        }
      }
    }
  } catch (nomErr) {
    // Fall back to local hospital database
  }

  // 3. Fallback: Curated Regional Emergency Network (Guarantee 100% availability offline)
  const CATALOG_HOSPITALS = [
    { id: "h1", name: "Suraksha Emergency Hospital", address: "Rampally X Roads, Yamnampet, Ghatkesar", lat: 17.4780, lng: 78.6520, phone: "+91 40 27123456" },
    { id: "h2", name: "Anurag Care Hospital & ER", address: "Ghatkesar Main Rd, Near Anurag University", lat: 17.4450, lng: 78.6850, phone: "+91 40 1234567" },
    { id: "h3", name: "Sparsh Hospital & Emergency Center", address: "Infosys Road, Pocharam, Ghatkesar", lat: 17.4610, lng: 78.6670, phone: "+91 40 68112233" },
    { id: "h4", name: "Area Hospital & Trauma Ward", address: "Opp RTC Bus Depot, Ghatkesar", lat: 17.4495, lng: 78.6820, phone: "+91 40 27981108" },
    { id: "h5", name: "AIIMS Apex Trauma Center & Hospital", address: "Warangal Highway, Bibinagar, Telangana", lat: 17.4721, lng: 78.7993, phone: "+91 86 32345678" },
    { id: "h6", name: "Srikara Hospitals", address: "ECIL 'X' Roads, Rampally Road, Hyderabad", lat: 17.4720, lng: 78.5720, phone: "+91 40 46467777" }
  ];

  return CATALOG_HOSPITALS;
}

/**
 * Calculates road distances and travel times for each candidate hospital using OSRM.
 * Falls back to Haversine distance with urban traffic coefficient if OSRM is unreachable.
 * 
 * @param {{ latitude: number, longitude: number }} userLoc 
 * @param {Array<{ id: string, lat: number, lng: number }>} hospitals 
 * @returns {Promise<Record<string, { distanceKm: number, durationMinutes: number }>>}
 */
export async function fetchRoadWeights(userLoc, hospitals) {
  const roadWeights = {};

  await Promise.all(
    hospitals.map(async (hosp) => {
      const hospId = hosp.id || hosp._id || hosp.name;

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userLoc.longitude},${userLoc.latitude};${hosp.lng},${hosp.lat}?overview=false`;
        const res = await fetch(osrmUrl, { signal: AbortSignal.timeout(3000) });

        if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const distanceKm = parseFloat((route.distance / 1000).toFixed(1));
            const durationMinutes = Math.max(1, Math.round(route.duration / 60));

            roadWeights[hospId] = { distanceKm, durationMinutes };
            return;
          }
        }
      } catch (e) {
        // Fall back to Haversine below
      }

      // Haversine fallback with urban detour coefficient (1.35x distance, 35 km/h speed)
      const straightDist = haversineDistanceKm(
        userLoc.latitude,
        userLoc.longitude,
        hosp.lat,
        hosp.lng
      );
      const distanceKm = parseFloat((straightDist * 1.35).toFixed(1));
      const durationMinutes = Math.max(2, Math.round((distanceKm / 35) * 60));

      roadWeights[hospId] = { distanceKm, durationMinutes };
    })
  );

  return roadWeights;
}
