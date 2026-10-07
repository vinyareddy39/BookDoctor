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
 * Detects if the current browser session is running on a mobile device (Android / iOS).
 * Uses a comprehensive user-agent check.
 */
export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || window.opera || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua);
}

/**
 * 1. Mobile Uber Universal Deep Link (Android / iOS)
 * Official mobile universal link format:
 *   https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=...&dropoff[longitude]=...&dropoff[nickname]=...&dropoff[formatted_address]=...
 * Launches native Uber app directly or mobile web page.
 */
export function buildUberMobileLink(hospital) {
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
 * 2. Desktop Uber Web Booking Link (Windows / macOS / Desktop Browser)
 * Official desktop web booking URL with JSON-encoded drop[0] parameter:
 *   https://m.uber.com/go/product-selection?pickup=my_location&drop[0]={"latitude":lat,"longitude":lng,"addressLine1":"...","addressLine2":"..."}
 * URL-encoded via URLSearchParams.
 */
export function buildUberDesktopLink(hospital) {
  if (!hospital || !hospital.lat || !hospital.lng) {
    return null;
  }

  const dropObj = {
    latitude: Number(hospital.lat),
    longitude: Number(hospital.lng),
    addressLine1: hospital.name || "Hospital Emergency Department",
    addressLine2: hospital.address || ""
  };

  const params = new URLSearchParams();
  params.append("pickup", "my_location");
  params.append("drop[0]", JSON.stringify(dropObj));

  return `https://m.uber.com/go/product-selection?${params.toString()}`;
}

/**
 * 3. Helper function buildUberLink(hospital)
 * Platform-aware Uber link builder:
 * - On Mobile (Android/iOS): returns mobile universal deep link (m.uber.com/ul/...)
 * - On Desktop (Windows): returns desktop web booking link (m.uber.com/go/product-selection...)
 */
export function buildUberLink(hospital, forceMobile = null) {
  const isMobile = forceMobile !== null ? forceMobile : isMobileDevice();
  return isMobile ? buildUberMobileLink(hospital) : buildUberDesktopLink(hospital);
}

/**
 * 4. Google Maps Directions Link (Reliable Desktop & Mobile Fallback)
 * Opens turn-by-turn driving directions from user's live location to the hospital.
 */
export function buildGoogleMapsLink(hospital) {
  if (!hospital) return "https://www.google.com/maps";
  const destination = hospital.lat && hospital.lng
    ? `${hospital.lat},${hospital.lng}`
    : encodeURIComponent(`${hospital.name || "Hospital"}, ${hospital.address || ""}`.trim());
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

/**
 * Opens the pre-filled Uber ride link across Windows and Phone:
 * - Phone (Android / iOS): window.location.href triggers native OS Universal Links / App Links,
 *   launching the installed Uber app directly (or falling back to the mobile web page).
 * - Windows / Desktop: window.open(url, "_blank") opens m.uber.com/go/product-selection in a new browser tab.
 * Also copies the hospital destination address to clipboard as an instant fallback.
 */
export function openUberRideToHospital(hospital) {
  if (!hospital) return false;
  const isMobile = isMobileDevice();
  const url = buildUberLink(hospital, isMobile);
  if (!url) return false;

  // Copy hospital destination address to clipboard as an instant fallback
  try {
    const copyText = hospital.address ? `${hospital.name}, ${hospital.address}` : hospital.name;
    navigator.clipboard?.writeText?.(copyText);
  } catch (_) {}

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
