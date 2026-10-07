/**
 * Uber Deep Link Utility
 * 
 * Implements the official Uber Ride Request Universal Deep Link & Native App Link specification.
 * - STEP 2: buildUberLinks(pickup, hospital) returns:
 *     appUrl: uber://?action=setPickup&...
 *     webUrl: https://m.uber.com/ul/?action=setPickup&...
 *   with explicit pickup coordinates:
 *     pickup[latitude], pickup[longitude], pickup[nickname]=My Location,
 *     dropoff[latitude], dropoff[longitude], dropoff[nickname]=<hospital name>,
 *     dropoff[formatted_address]=<hospital address>
 */

export const UBER_CLIENT_ID = "DfjKZC3xXnBEObgCRl1ChUSdRJDnjwBP";

/**
 * Detects if the current user agent is an Android or iOS device.
 */
export function isAndroidOrIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || window.opera || "";
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

/**
 * Detects if the current browser session is running on any mobile device.
 */
export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || window.opera || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua);
}

/**
 * Helper to safely extract numeric latitude and longitude from varied coordinate objects.
 * Handles both { lat, lng } and { latitude, longitude } formats, and strings or numbers.
 */
export function extractCoords(coordObj) {
  if (!coordObj) return null;
  const lat = Number(coordObj.lat ?? coordObj.latitude);
  const lng = Number(coordObj.lng ?? coordObj.longitude);
  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * STEP 2: BUILD THE LINK
 * buildUberLinks(pickup, hospital)
 * 
 * Returns two URLs using URLSearchParams (URL-encoded):
 *   appUrl: uber://?action=setPickup&...
 *   webUrl: https://m.uber.com/ul/?action=setPickup&...
 * 
 * Both with these parameters:
 *   pickup[latitude], pickup[longitude], pickup[nickname]=My Location,
 *   dropoff[latitude], dropoff[longitude], dropoff[nickname]=<hospital name>,
 *   dropoff[formatted_address]=<hospital address>
 * 
 * Uses explicit pickup coordinates, NOT pickup=my_location.
 * 
 * @param {{ latitude: number, longitude: number } | { lat: number, lng: number }} pickup 
 * @param {{ name: string, address: string, lat: number, lng: number }} hospital 
 * @returns {{ appUrl: string, webUrl: string } | null}
 */
export function buildUberLinks(pickup, hospital) {
  if (!pickup || !hospital) return null;

  const pickupCoords = extractCoords(pickup);
  const dropoffCoords = extractCoords(hospital);

  if (!pickupCoords || !dropoffCoords) {
    console.error("Invalid coordinates passed to buildUberLinks:", { pickup, hospital });
    return null;
  }

  const hospitalName = (hospital.name || "Hospital Emergency Department").trim();
  const hospitalAddress = (hospital.address || hospital.name || "Emergency Hospital").trim();

  // Build query string using URLSearchParams for strict URL encoding
  const params = new URLSearchParams();
  params.append("action", "setPickup");
  params.append("pickup[latitude]", String(pickupCoords.lat));
  params.append("pickup[longitude]", String(pickupCoords.lng));
  params.append("pickup[nickname]", "My Location");
  params.append("dropoff[latitude]", String(dropoffCoords.lat));
  params.append("dropoff[longitude]", String(dropoffCoords.lng));
  params.append("dropoff[nickname]", hospitalName);
  params.append("dropoff[formatted_address]", hospitalAddress);

  const queryString = params.toString();
  const appUrl = `uber://?${queryString}`;
  const webUrl = `https://m.uber.com/ul/?${queryString}`;

  // Desktop Web Product-Selection Parameters with pre-filled drop[0] JSON
  const dropObj = {
    latitude: dropoffCoords.lat,
    longitude: dropoffCoords.lng,
    addressLine1: hospitalName,
    addressLine2: hospitalAddress
  };
  const desktopParams = new URLSearchParams();
  desktopParams.append("pickup", "my_location");
  desktopParams.append("pickup[latitude]", String(pickupCoords.lat));
  desktopParams.append("pickup[longitude]", String(pickupCoords.lng));
  desktopParams.append("drop[0]", JSON.stringify(dropObj));
  desktopParams.append("dropoff[latitude]", String(dropoffCoords.lat));
  desktopParams.append("dropoff[longitude]", String(dropoffCoords.lng));
  desktopParams.append("dropoff[nickname]", hospitalName);
  desktopParams.append("dropoff[formatted_address]", hospitalAddress);

  const desktopWebUrl = `https://m.uber.com/go/product-selection?${desktopParams.toString()}`;

  return {
    appUrl,
    webUrl,
    desktopWebUrl
  };
}

/**
 * Google Maps Directions Link (turn-by-turn driving)
 * Formats: https://www.google.com/maps/dir/?api=1&origin=LIVE_LAT,LIVE_LNG&destination=HOSPITAL_LAT,HOSPITAL_LNG&travelmode=driving
 */
export function buildGoogleMapsLink(pickup, hospital) {
  if (!hospital) return "https://www.google.com/maps";

  const pickupCoords = extractCoords(pickup);
  const dropoffCoords = extractCoords(hospital);

  if (pickupCoords && dropoffCoords) {
    return `https://www.google.com/maps/dir/?api=1&origin=${pickupCoords.lat},${pickupCoords.lng}&destination=${dropoffCoords.lat},${dropoffCoords.lng}&travelmode=driving`;
  }

  const destination = dropoffCoords
    ? `${dropoffCoords.lat},${dropoffCoords.lng}`
    : encodeURIComponent(`${hospital.name || "Hospital"}, ${hospital.address || ""}`.trim());

  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

/**
 * Backwards compatibility helper for previous mobile link callers
 */
export function buildUberMobileLink(hospital, pickup = null) {
  const links = buildUberLinks(pickup || { lat: 0, lng: 0 }, hospital);
  return links ? links.webUrl : null;
}

/**
 * Backwards compatibility helper for previous desktop link callers
 */
export function buildUberDesktopLink(hospital) {
  const dropCoords = extractCoords(hospital);
  if (!dropCoords) return null;

  const dropObj = {
    latitude: dropCoords.lat,
    longitude: dropCoords.lng,
    addressLine1: hospital.name || "Hospital Emergency Department",
    addressLine2: hospital.address || ""
  };

  const params = new URLSearchParams();
  params.append("pickup", "my_location");
  params.append("drop[0]", JSON.stringify(dropObj));

  return `https://m.uber.com/go/product-selection?${params.toString()}`;
}

/**
 * Backwards compatibility helper
 */
export function buildUberLink(hospital, forceMobile = null) {
  if (!hospital) return null;
  const isMob = forceMobile !== null ? forceMobile : isMobileDevice();
  if (isMob) {
    const coords = extractCoords(hospital);
    if (!coords) return null;
    const params = new URLSearchParams();
    params.append("action", "setPickup");
    params.append("pickup", "my_location");
    params.append("dropoff[latitude]", String(coords.lat));
    params.append("dropoff[longitude]", String(coords.lng));
    params.append("dropoff[nickname]", hospital.name || "Hospital");
    params.append("dropoff[formatted_address]", hospital.address || hospital.name || "Hospital");
    return `https://m.uber.com/ul/?${params.toString()}`;
  }
  return buildUberDesktopLink(hospital);
}

/**
 * Backwards compatibility helper
 */
export function openUberRideToHospital(hospital, pickup = null) {
  if (!hospital) return false;
  const links = pickup ? buildUberLinks(pickup, hospital) : null;
  const webUrl = links ? links.webUrl : buildUberLink(hospital);
  if (!webUrl) return false;

  try {
    const copyText = hospital.address ? `${hospital.name}, ${hospital.address}` : hospital.name;
    navigator.clipboard?.writeText?.(copyText);
  } catch (err) {
    if (import.meta.env?.DEV) {
      console.error("[UberDeepLink] Clipboard write failed:", err);
    }
  }

  if (isAndroidOrIOS()) {
    if (links?.appUrl) {
      window.location.href = links.appUrl;
      setTimeout(() => {
        if (!document.hidden) window.location.href = webUrl;
      }, 1500);
      return true;
    }
    window.location.href = webUrl;
  } else {
    window.open(webUrl, "_blank", "noopener,noreferrer");
  }
  return true;
}

/**
 * Backwards compatibility helper for EmergencyTracking.jsx and other legacy callers
 */
export function buildUberUniversalUrl({
  userLat = null,
  userLng = null,
  userAddress = "My Location",
  hospLat,
  hospLng,
  hospitalName = "Emergency Hospital",
  hospitalAddress = "",
  productId = null,
  exactPickupCoords = false
}) {
  const pickup = (userLat && userLng) ? { lat: userLat, lng: userLng } : null;
  const hospital = { lat: hospLat, lng: hospLng, name: hospitalName, address: hospitalAddress };
  const links = pickup ? buildUberLinks(pickup, hospital) : null;
  if (links) return links.webUrl;

  const params = new URLSearchParams();
  if (UBER_CLIENT_ID) params.append("client_id", UBER_CLIENT_ID);
  params.append("action", "setPickup");
  params.append("pickup", "my_location");
  if (hospLat && hospLng) {
    params.append("dropoff[latitude]", String(Number(hospLat)));
    params.append("dropoff[longitude]", String(Number(hospLng)));
    params.append("dropoff[nickname]", hospitalName || "Hospital ER");
    params.append("dropoff[formatted_address]", hospitalAddress || hospitalName || "Hospital");
  }
  return `https://m.uber.com/ul/?${params.toString()}`;
}

/**
 * Backwards compatibility helper for SOSFlow.jsx and EmergencyTracking.jsx
 */
export function openUberRide({
  userLat,
  userLng,
  userAddress,
  hospLat,
  hospLng,
  hospitalName,
  hospitalAddress,
  productId = null,
  newTab = false
}) {
  const pickup = (userLat && userLng) ? { lat: userLat, lng: userLng } : null;
  const hospital = { lat: hospLat, lng: hospLng, name: hospitalName, address: hospitalAddress };
  return openUberRideToHospital(hospital, pickup);
}

