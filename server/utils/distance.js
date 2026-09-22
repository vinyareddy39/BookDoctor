/**
 * Calculates the great-circle distance between two points on the Earth surface 
 * using the Haversine formula.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const toRadian = angle => (Math.PI / 180) * angle;
  const distance = (a, b) => (Math.PI / 180) * (a - b);
  const RADIUS_OF_EARTH_IN_KM = 6371;

  const dLat = distance(lat2, lat1);
  const dLon = distance(lon2, lon1);

  lat1 = toRadian(lat1);
  lat2 = toRadian(lat2);

  const a =
    Math.pow(Math.sin(dLat / 2), 2) +
    Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.asin(Math.sqrt(a));

  return RADIUS_OF_EARTH_IN_KM * c;
};

/**
 * Estimates ETA in minutes based on distance and average speed
 * @param {number} distanceKm 
 * @param {number} avgSpeedKmh Default 40 km/h for city traffic
 * @returns {number} ETA in minutes
 */
export const estimateETA = (distanceKm, avgSpeedKmh = 40) => {
  const hours = distanceKm / avgSpeedKmh;
  return Math.round(hours * 60);
};

