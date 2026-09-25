/**
 * Uber Deep Link Utility
 * 
 * Implements the official Uber Developer Ride Request Deep Link specification:
 * https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction#ride-requests
 * 
 * Generates and launches Uber ride requests with 100% pre-filled live GPS pickup
 * and nearest emergency hospital drop-off.
 * 
 * Rules:
 * 1. ONLY opened on explicit user button click — never automatically.
 * 2. Pre-fills both the JSON Location objects (pickup, drop[0]) for web/browser
 *    and nested query parameters (pickup[latitude], dropoff[latitude], etc.) for mobile.
 * 3. On mobile devices, attempts the native app scheme (uber://riderequest) first,
 *    falling back to https://m.uber.com/looking if the app is not installed.
 * 4. On desktop, opens in a new tab/window with noopener,noreferrer.
 */

export const UBER_CLIENT_ID = "DfjKZC3xXnBEObgCRl1ChUSdRJDnjwBP";

/**
 * Builds the official Universal Deep Link URL for m.uber.com/looking
 */
export function buildUberUniversalUrl({
  userLat,
  userLng,
  userAddress = "Live GPS Location",
  hospLat,
  hospLng,
  hospitalName = "Hospital ER",
  hospitalAddress = "Emergency Department",
  productId = null
}) {
  const pLat = Number(userLat);
  const pLng = Number(userLng);
  const dLat = Number(hospLat);
  const dLng = Number(hospLng);

  // Official Uber Location Objects
  const pickupLocationObj = {
    latitude: pLat,
    longitude: pLng,
    addressLine1: "My Location",
    addressLine2: userAddress || "Live GPS Location"
  };

  const dropLocationObj = {
    latitude: dLat,
    longitude: dLng,
    addressLine1: hospitalName,
    addressLine2: hospitalAddress || "Emergency Department"
  };

  const params = new URLSearchParams();
  if (UBER_CLIENT_ID) params.append("client_id", UBER_CLIENT_ID);
  params.append("action", "setPickup");

  // Universal Deep Link JSON Objects (Used by Uber Web and Modern Apps)
  params.append("pickup", JSON.stringify(pickupLocationObj));
  params.append("drop[0]", JSON.stringify(dropLocationObj));

  // Nested Parameters (Used by Android/iOS Native Clients and Web Fallbacks)
  params.append("pickup[latitude]", String(pLat));
  params.append("pickup[longitude]", String(pLng));
  params.append("pickup[nickname]", "My Location");
  params.append("pickup[formatted_address]", userAddress || "Live GPS Location");

  params.append("dropoff[latitude]", String(dLat));
  params.append("dropoff[longitude]", String(dLng));
  params.append("dropoff[nickname]", hospitalName);
  params.append("dropoff[formatted_address]", `${hospitalName}, ${hospitalAddress}`);

  if (productId) {
    params.append("product_id", productId);
  }

  return `https://m.uber.com/ul/?${params.toString()}`;
}

/**
 * Builds the native mobile Uber app scheme URL (uber://riderequest)
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
  const pLat = Number(userLat);
  const pLng = Number(userLng);
  const dLat = Number(hospLat);
  const dLng = Number(hospLng);

  const params = new URLSearchParams();
  if (UBER_CLIENT_ID) params.append("client_id", UBER_CLIENT_ID);
  params.append("action", "setPickup");
  params.append("pickup[latitude]", String(pLat));
  params.append("pickup[longitude]", String(pLng));
  params.append("pickup[nickname]", "My Location");
  params.append("pickup[formatted_address]", userAddress || "Live GPS Location");

  params.append("dropoff[latitude]", String(dLat));
  params.append("dropoff[longitude]", String(dLng));
  params.append("dropoff[nickname]", hospitalName);
  params.append("dropoff[formatted_address]", `${hospitalName}, ${hospitalAddress}`);

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
 * Launches the pre-filled Uber ride flow on explicit user action.
 */
export function openUberRide({
  userLat,
  userLng,
  userAddress,
  hospLat,
  hospLng,
  hospitalName,
  hospitalAddress,
  productId = null
}) {
  if (!userLat || !userLng || !hospLat || !hospLng) {
    console.error("Missing coordinates for Uber ride dispatch.");
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

  const appSchemeUrl = buildUberAppSchemeUrl({
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

  if (isMobileDevice()) {
    // Attempt native Uber mobile app first
    let hasHidden = false;

    const onVisibilityChange = () => {
      if (document.hidden) {
        hasHidden = true;
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    // Trigger native app scheme
    window.location.href = appSchemeUrl;

    // If native app doesn't open within 1.2s, fallback to Universal Deep Link
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (!hasHidden) {
        window.open(universalUrl, "_blank", "noopener,noreferrer");
      }
    }, 1200);
  } else {
    // Desktop: Open Universal Deep Link directly in new window/tab
    window.open(universalUrl, "_blank", "noopener,noreferrer");
  }
}
