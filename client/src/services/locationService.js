/**
 * Location Service
 * Handles live hardware GPS coordinate acquisition (no caching),
 * reverse-geocoding, and manual fallback parsing.
 */

export const EMERGENCY_NUMBERS = {
  AMBULANCE_INDIA: "108",
  NATIONAL_EMERGENCY: "112",
  POLICE: "100"
};

/**
 * Requests fresh live GPS location with strict high accuracy and zero caching.
 * @returns {Promise<{ latitude: number, longitude: number, accuracy: number }>}
 */
export async function getFreshLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject({
        code: "UNSUPPORTED",
        message: "Geolocation is not supported by your browser."
      });
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        let code = "UNKNOWN";
        let message = "Unable to retrieve your location.";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            code = "PERMISSION_DENIED";
            message = "Location permission was denied. Please allow location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            code = "POSITION_UNAVAILABLE";
            message = "Location information is unavailable. Please ensure your device GPS is turned on.";
            break;
          case error.TIMEOUT:
            code = "TIMEOUT";
            message = "Location request timed out. Please try again or enter your location manually.";
            break;
        }

        reject({ code, message, originalError: error });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Strict requirement: zero cached coordinates
      }
    );
  });
}

/**
 * Reverse-geocodes coordinates to a human-readable address.
 */
export async function reverseGeocode(latitude, longitude) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      { headers: { "User-Agent": "BookDoctor-Emergency/1.0" } }
    );
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    
    if (data && data.address) {
      const parts = [
        data.address.road || data.address.suburb || data.address.neighbourhood,
        data.address.city || data.address.town || data.address.county,
        data.address.state
      ].filter(Boolean);
      return parts.join(", ") || data.display_name.split(",").slice(0, 3).join(",");
    }
    return data.display_name ? data.display_name.split(",").slice(0, 2).join(",") : "My Location";
  } catch (err) {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

/**
 * Geocodes an entered manual address or coordinates string into lat/lng.
 */
export async function geocodeManualLocation(query) {
  if (!query || typeof query !== "string") {
    throw new Error("Please enter a valid address or coordinates.");
  }

  const trimmed = query.trim();

  // Check if user entered "lat, lng" e.g. "17.4485, 78.6841"
  const coordRegex = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
  if (coordRegex.test(trimmed)) {
    const [latStr, lngStr] = trimmed.split(",");
    const latitude = parseFloat(latStr.trim());
    const longitude = parseFloat(lngStr.trim());
    const address = await reverseGeocode(latitude, longitude);
    return { latitude, longitude, address };
  }

  // Otherwise search OpenStreetMap
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1`,
    { headers: { "User-Agent": "BookDoctor-Emergency/1.0" } }
  );
  if (!res.ok) throw new Error("Geocoding service unavailable.");
  const data = await res.json();

  if (!data || data.length === 0) {
    throw new Error(`Location not found for "${trimmed}". Please try a more specific area or landmark.`);
  }

  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
    address: data[0].display_name.split(",").slice(0, 3).join(",")
  };
}
