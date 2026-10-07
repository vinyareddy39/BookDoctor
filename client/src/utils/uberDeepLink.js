/**
 * Uber Universal Deep Link Utility
 * 
 * Implements the official Uber Ride Request Universal Deep Link specification:
 * https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=...&dropoff[longitude]=...&dropoff[nickname]=...
 * 
 * Works across all platforms:
 * 1. Windows / Desktop: Opens in the browser at m.uber.com with pickup auto-set to the
 *    browser's current location and dropoff pre-filled to the hospital ER.
 * 2. Mobile (Android & iOS): Opens the native Uber app directly if installed,
 *    or smoothly falls back to the mobile web page.
 * 
 * Auto-fills:
 * - Pickup: `pickup=my_location` (automatically locks to device GPS / browser geolocation)
 * - Dropoff: Hospital latitude, longitude, URL-encoded name and address
 */

export const UBER_CLIENT_ID = "DfjKZC3xXnBEObgCRl1ChUSdRJDnjwBP";

/**
 * Helper function buildUberLink(hospital)
 * 
 * Reuses the already-computed nearest hospital object (name, lat, lng, address)
 * and returns the official Uber Universal Deep Link URL:
 *   https://m.uber.com/ul/?action=setPickup
 *     &pickup=my_location
 *     &dropoff[latitude]=<lat>
 *     &dropoff[longitude]=<lng>
 *     &dropoff[nickname]=<hospital name>
 *     &dropoff[formatted_address]=<address>
 * 
 * Uses URLSearchParams so that all query parameter values are safely URL-encoded.
 * Pickup is set to 'my_location' to let Uber auto-lock to the user's live location.
 */
export function buildUberLink(hospital) {
  if (!hospital || !hospital.lat || !hospital.lng) {
    return null;
  }

  const params = new URLSearchParams();
  params.append("action", "setPickup");
  params.append("pickup", "my_location");
  params.append("dropoff[latitude]", String(hospital.lat));
  params.append("dropoff[longitude]", String(hospital.lng));
  params.append("dropoff[nickname]", hospital.name || "Hospital Emergency Department");
  params.append("dropoff[formatted_address]", hospital.address || hospital.name || "Hospital");

  return `https://m.uber.com/ul/?${params.toString()}`;
}

/**
 * Opens the pre-filled Uber ride link across Windows and Phone:
 * - Phone (Android / iOS): window.location.href triggers native OS Universal Links / App Links,
 *   launching the installed Uber app directly (or falling back to the mobile web page).
 * - Windows / Desktop: window.open(url, "_blank") opens m.uber.com in the default browser in a new tab.
 */
export function openUberRideToHospital(hospital) {
  const url = buildUberLink(hospital);
  if (!url) return false;

  const isMobile = isMobileDevice();
  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return true;
}

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
  const params = new URLSearchParams();

  if (UBER_CLIENT_ID) {
    params.append("client_id", UBER_CLIENT_ID);
  }
  params.append("action", "setPickup");

  // 1. Pickup: 'pickup=my_location' tells Uber to auto-fill with the rider's current location
  // If exact coordinates are explicitly requested and available, pass coordinates
  if (exactPickupCoords && userLat && userLng) {
    params.append("pickup[latitude]", String(Number(userLat)));
    params.append("pickup[longitude]", String(Number(userLng)));
    params.append("pickup[nickname]", userAddress || "My Location");
    if (userAddress) {
      params.append("pickup[formatted_address]", userAddress);
    }
  } else {
    params.append("pickup", "my_location");
  }

  // 2. Dropoff: Hospital coordinates and URL-encoded name/address
  if (hospLat && hospLng) {
    params.append("dropoff[latitude]", String(Number(hospLat)));
    params.append("dropoff[longitude]", String(Number(hospLng)));
    params.append("dropoff[nickname]", hospitalName || "Hospital ER");
    const formattedAddr = hospitalAddress
      ? `${hospitalName}, ${hospitalAddress}`
      : (hospitalName || "Emergency Hospital");
    params.append("dropoff[formatted_address]", formattedAddr);
  }

  if (productId) {
    params.append("product_id", productId);
  }

  return `https://m.uber.com/ul/?${params.toString()}`;
}

/**
 * Legacy mobile app scheme builder (uber://riderequest) maintained for compatibility
 */
export function buildUberAppSchemeUrl({
  userLat,
  userLng,
  userAddress = "Live GPS Location",
  hospLat,
  hospLng,
  hospitalName = "Hospital ER",
  hospitalAddress = "Emergency Department",
  productId = null
}) {
  const params = new URLSearchParams();
  if (UBER_CLIENT_ID) params.append("client_id", UBER_CLIENT_ID);
  params.append("action", "setPickup");
  params.append("pickup", "my_location");

  if (hospLat && hospLng) {
    params.append("dropoff[latitude]", String(Number(hospLat)));
    params.append("dropoff[longitude]", String(Number(hospLng)));
    params.append("dropoff[nickname]", hospitalName || "Hospital ER");
    params.append("dropoff[formatted_address]", `${hospitalName}, ${hospitalAddress || ""}`.trim());
  }

  if (productId) {
    params.append("product_id", productId);
  }

  return `uber://riderequest?${params.toString()}`;
}

/**
 * Detects if the current browser session is running on a mobile device.
 */
export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Launches the pre-filled Uber ride flow:
 * - Automatically auto-fills Pickup (current location) and Dropoff (hospital ER)
 * - Directly triggers navigation so the OS intercepts to open native app on phone,
 *   or opens m.uber.com in browser on Windows.
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
  if (!hospLat || !hospLng) {
    console.error("Missing hospital coordinates for Uber ride dispatch.");
    return;
  }

  const universalUrl = buildUberUniversalUrl({
    userLat,
    userLng,
    userAddress,
    hospLat,
    hospLng,
    hospitalName,
    hospitalAddress,
    productId
  });

  // Copy hospital destination address to clipboard as a helpful fallback
  try {
    const fullText = hospitalAddress ? `${hospitalName}, ${hospitalAddress}` : hospitalName;
    navigator.clipboard?.writeText?.(fullText);
  } catch (_) {}

  // Open the pre-filled ride link:
  // On mobile, window.location.href triggers the OS app link handler to open native Uber app.
  // On Windows desktop, opens m.uber.com with auto-filled locations.
  if (newTab) {
    window.open(universalUrl, "_blank", "noopener,noreferrer");
  } else {
    window.location.href = universalUrl;
  }
}
