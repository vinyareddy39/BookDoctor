import { EMERGENCY_CONFIG } from "../config/emergencyConfig";

export interface HospitalCandidate {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  distanceMeters: number;
  hasEmergencyDepartment?: boolean;
  source: "GooglePlaces" | "OpenStreetMap";
}

/**
 * Calculates straight-line (great-circle) distance in meters between two coordinates.
 * NOTE: Straight-line distance does not account for road networks, traffic, or travel time.
 */
export function calculateStraightLineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Query Google Places API Nearby Search for emergency hospitals.
 */
export async function searchGooglePlacesHospitals(
  latitude: number,
  longitude: number,
  apiKey?: string
): Promise<HospitalCandidate[]> {
  const key = apiKey || process.env.EXPO_PUBLIC_PLACES_API_KEY || "";
  if (!key) {
    console.warn("[HospitalService] Google Places API Key is not configured. Falling back to OSM Overpass.");
    return [];
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&rankby=distance&type=hospital&keyword=emergency&key=${key}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[HospitalService] Places API HTTP error: ${response.status}`);
      return [];
    }
    const data = await response.json();
    if (data.status !== "OK" || !Array.isArray(data.results)) {
      console.warn(`[HospitalService] Places API status: ${data.status}`);
      return [];
    }

    const hospitals: HospitalCandidate[] = data.results
      .map((place: any) => {
        const pLat = place.geometry?.location?.lat;
        const pLng = place.geometry?.location?.lng;
        if (typeof pLat !== "number" || typeof pLng !== "number") return null;

        const distanceMeters = calculateStraightLineDistance(latitude, longitude, pLat, pLng);
        return {
          id: place.place_id || `places_${pLat}_${pLng}`,
          name: place.name || "Emergency Medical Hospital",
          latitude: pLat,
          longitude: pLng,
          address: place.vicinity || "",
          distanceMeters,
          hasEmergencyDepartment: true,
          source: "GooglePlaces" as const,
        };
      })
      .filter((h): h is HospitalCandidate => h !== null);

    // Sort strictly by straight-line distance ascending
    return hospitals.sort((a, b) => a.distanceMeters - b.distanceMeters);
  } catch (error) {
    console.warn("[HospitalService] Places API fetch exception:", error);
    return [];
  }
}

/**
 * Query OpenStreetMap Overpass API filtering for amenity=hospital and emergency=yes within 25 km.
 */
export async function searchOverpassHospitals(
  latitude: number,
  longitude: number,
  radiusKm = EMERGENCY_CONFIG.OVERPASS_RADIUS_KM
): Promise<HospitalCandidate[]> {
  const radiusMeters = radiusKm * 1000;

  // Overpass QL query: hospitals with emergency=yes around user coordinate
  const query = `
    [out:json][timeout:15];
    (
      node["amenity"="hospital"]["emergency"="yes"](around:${radiusMeters},${latitude},${longitude});
      way["amenity"="hospital"]["emergency"="yes"](around:${radiusMeters},${latitude},${longitude});
      relation["amenity"="hospital"]["emergency"="yes"](around:${radiusMeters},${latitude},${longitude});
    );
    out center tags;
  `.trim();

  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[HospitalService] Overpass HTTP error: ${response.status}`);
      return [];
    }
    const data = await response.json();
    if (!Array.isArray(data.elements) || data.elements.length === 0) {
      return [];
    }

    const hospitals: HospitalCandidate[] = data.elements
      .map((el: any) => {
        const hLat = el.lat ?? el.center?.lat;
        const hLng = el.lon ?? el.center?.lon;
        if (typeof hLat !== "number" || typeof hLng !== "number") return null;

        const distanceMeters = calculateStraightLineDistance(latitude, longitude, hLat, hLng);
        const tags = el.tags || {};
        const name = tags.name || tags["name:en"] || tags.official_name || "Emergency Hospital";
        const street = tags["addr:street"];
        const city = tags["addr:city"];
        const address = [street, city].filter(Boolean).join(", ");

        return {
          id: `osm_${el.id}`,
          name,
          latitude: hLat,
          longitude: hLng,
          address: address || undefined,
          distanceMeters,
          hasEmergencyDepartment: tags.emergency === "yes",
          source: "OpenStreetMap" as const,
        };
      })
      .filter((h): h is HospitalCandidate => h !== null);

    // Sort strictly by straight-line distance ascending
    return hospitals.sort((a, b) => a.distanceMeters - b.distanceMeters);
  } catch (error) {
    console.warn("[HospitalService] Overpass API query exception:", error);
    return [];
  }
}

/**
 * Resolves the closest hospital with an emergency department.
 * Dual-fallback: Google Places Nearby Search -> OpenStreetMap Overpass API.
 * 
 * Returns null if both fail. Does NOT use hard-coded coordinates!
 */
export async function findNearestEmergencyHospital(
  latitude: number,
  longitude: number,
  placesApiKey?: string
): Promise<HospitalCandidate | null> {
  // 1. Primary: Google Places
  const placesResults = await searchGooglePlacesHospitals(latitude, longitude, placesApiKey);
  if (placesResults.length > 0) {
    console.log(`[HospitalService] Found nearest hospital via Google Places: ${placesResults[0].name} (${Math.round(placesResults[0].distanceMeters)}m straight-line)`);
    return placesResults[0];
  }

  // 2. Fallback: OpenStreetMap Overpass (emergency=yes, 25km)
  console.log("[HospitalService] Falling back to OpenStreetMap Overpass API (emergency=yes)...");
  const overpassResults = await searchOverpassHospitals(latitude, longitude);
  if (overpassResults.length > 0) {
    console.log(`[HospitalService] Found nearest hospital via OSM Overpass: ${overpassResults[0].name} (${Math.round(overpassResults[0].distanceMeters)}m straight-line)`);
    return overpassResults[0];
  }

  console.warn("[HospitalService] Both Google Places and OpenStreetMap failed to locate an emergency hospital.");
  return null;
}

