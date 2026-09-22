
import axios from "axios";
import { calculateDistance, estimateETA } from "./distance.js";

// In-memory cache to prevent hitting OSRM rate limits
const routeCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getRouteAndETA = async (originLat, originLng, destLat, destLng) => {
  // Key based on rounded coords (approx 100m precision)
  const roundCoord = (c) => Number(c).toFixed(3);
  const cacheKey = `${roundCoord(originLat)},${roundCoord(originLng)}->${roundCoord(destLat)},${roundCoord(destLng)}`;

  if (routeCache.has(cacheKey)) {
    const cached = routeCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    routeCache.delete(cacheKey);
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const response = await axios.get(url, { timeout: 3000 });
    
    const route = response.data.routes[0];
    if (!route) throw new Error("No route found from OSRM");

    const result = {
      durationMinutes: Math.ceil(route.duration / 60),
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      routeGeoJSON: route.geometry, // { type: "LineString", coordinates: [[lng, lat], ...] }
      isFallback: false
    };

    routeCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;

  } catch (error) {
    console.warn("OSRM routing failed, falling back to Haversine:", error.message);
    const distKm = calculateDistance(originLat, originLng, destLat, destLng);
    const etaMins = estimateETA(distKm);
    
    // Fallback: simple straight-line GeoJSON
    const fallbackGeoJSON = {
      type: "LineString",
      coordinates: [
        [Number(originLng), Number(originLat)],
        [Number(destLng), Number(destLat)]
      ]
    };

    return {
      durationMinutes: etaMins,
      distanceKm: Number(distKm.toFixed(2)),
      routeGeoJSON: fallbackGeoJSON,
      isFallback: true
    };
  }
};

