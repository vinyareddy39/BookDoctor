/**
 * Uber Deep Link Utility
 * 
 * Generates and launches Uber ride requests pre-filling live pickup and nearest hospital drop-off.
 * 
 * Rules:
 * 1. ONLY opened on explicit user button click — never automatically.
 * 2. On mobile devices, attempts the native app scheme (uber://) first,
 *    falling back to https://m.uber.com/ul/ if the app is not installed.
 * 3. On desktop or fallback, opens in a new tab/window with noopener,noreferrer.
 */

/**
 * Builds the official Universal Deep Link URL for m.uber.com
 */
export function buildUberUniversalUrl({ userLat, userLng, hospLat, hospLng, hospitalName }) {
  const params = new URLSearchParams();
  params.append("action", "setPickup");
  params.append("pickup[latitude]", String(userLat));
  params.append("pickup[longitude]", String(userLng));
  params.append("pickup[nickname]", "My Location");
  params.append("dropoff[latitude]", String(hospLat));
  params.append("dropoff[longitude]", String(hospLng));
  params.append("dropoff[nickname]", hospitalName || "Hospital ER");

  return `https://m.uber.com/ul/?${params.toString()}`;
}

/**
 * Builds the native mobile Uber app scheme URL (uber://)
 */
export function buildUberAppSchemeUrl({ userLat, userLng, hospLat, hospLng, hospitalName }) {
  const params = new URLSearchParams();
  params.append("action", "setPickup");
  params.append("pickup[latitude]", String(userLat));
  params.append("pickup[longitude]", String(userLng));
  params.append("pickup[nickname]", "My Location");
  params.append("dropoff[latitude]", String(hospLat));
  params.append("dropoff[longitude]", String(hospLng));
  params.append("dropoff[nickname]", hospitalName || "Hospital ER");

  return `uber://?${params.toString()}`;
}

/**
 * Detects if the current browser session is running on a mobile OS (iOS or Android).
 */
export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Launches the Uber ride flow on explicit user action.
 * 
 * @param {object} options
 * @param {number} options.userLat
 * @param {number} options.userLng
 * @param {number} options.hospLat
 * @param {number} options.hospLng
 * @param {string} options.hospitalName
 * @returns {void}
 */
export function openUberRide({ userLat, userLng, hospLat, hospLng, hospitalName }) {
  if (!userLat || !userLng || !hospLat || !hospLng) {
    console.error("Missing coordinates for Uber ride dispatch.");
    return;
  }

  const universalUrl = buildUberUniversalUrl({
    userLat,
    userLng,
    hospLat,
    hospLng,
    hospitalName
  });

  const appSchemeUrl = buildUberAppSchemeUrl({
    userLat,
    userLng,
    hospLat,
    hospLng,
    hospitalName
  });

  if (isMobileDevice()) {
    // Attempt native Uber mobile app first
    let hasHidden = false;

    const onVisibilityChange = () => {
      if (document.hidden) {
        hasHidden = true;
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    // Trigger native app protocol
    window.location.href = appSchemeUrl;

    // If native app doesn't take over within 1.2s, fallback to m.uber.com universal link
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (!hasHidden) {
        window.open(universalUrl, "_blank", "noopener,noreferrer");
      }
    }, 1200);
  } else {
    // Desktop: Open m.uber.com universal link directly in new window
    window.open(universalUrl, "_blank", "noopener,noreferrer");
  }
}
