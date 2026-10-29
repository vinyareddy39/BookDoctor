import { Linking, Platform } from "react-native";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface UberHospitalDestination {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface UberLinks {
  appUrl: string;
  webUrl: string;
}

/**
 * Builds the official, strictly percent-encoded Uber deep links
 * without relying on App Store / itms-apps redirects.
 * 
 * Format:
 * uber://?action=setPickup&pickup[latitude]=LAT&pickup[longitude]=LNG&pickup[nickname]=My%20Location&dropoff[latitude]=HLAT&dropoff[longitude]=HLNG&dropoff[nickname]=NAME
 * Fallback:
 * https://m.uber.com/ul/?action=setPickup&pickup[latitude]=LAT&pickup[longitude]=LNG&pickup[nickname]=My%20Location&dropoff[latitude]=HLAT&dropoff[longitude]=HLNG&dropoff[nickname]=NAME
 */
export function buildUberLinks(
  pickup: Coordinates,
  dropoff: UberHospitalDestination
): UberLinks {
  if (
    typeof pickup?.latitude !== "number" ||
    typeof pickup?.longitude !== "number" ||
    isNaN(pickup.latitude) ||
    isNaN(pickup.longitude) ||
    typeof dropoff?.latitude !== "number" ||
    typeof dropoff?.longitude !== "number" ||
    isNaN(dropoff.latitude) ||
    isNaN(dropoff.longitude)
  ) {
    throw new Error("Invalid pickup or dropoff coordinates for Uber link generation");
  }

  const pickupLat = String(pickup.latitude);
  const pickupLng = String(pickup.longitude);
  const dropLat = String(dropoff.latitude);
  const dropLng = String(dropoff.longitude);

  const pickupNick = "My Location";
  const dropNick = (dropoff.name || "Emergency Hospital").trim();

  // Explicit URL query parameter encoding handling spaces, &, #, accents, etc.
  const queryParts = [
    `action=setPickup`,
    `pickup[latitude]=${encodeURIComponent(pickupLat)}`,
    `pickup[longitude]=${encodeURIComponent(pickupLng)}`,
    `pickup[nickname]=${encodeURIComponent(pickupNick)}`,
    `dropoff[latitude]=${encodeURIComponent(dropLat)}`,
    `dropoff[longitude]=${encodeURIComponent(dropLng)}`,
    `dropoff[nickname]=${encodeURIComponent(dropNick)}`,
  ];

  const queryString = queryParts.join("&");

  return {
    appUrl: `uber://?${queryString}`,
    webUrl: `https://m.uber.com/ul/?${queryString}`,
  };
}

/**
 * Opens Uber natively, falling back to the mobile web link if the app fails to open.
 * Uses direct Linking.openURL with completion detection rather than canOpenURL alone.
 */
export async function openUberRide(
  pickup: Coordinates,
  dropoff: UberHospitalDestination
): Promise<{ opened: "app" | "web"; url: string }> {
  const { appUrl, webUrl } = buildUberLinks(pickup, dropoff);

  // LOG the exact final URL before opening it as required
  console.log(`[UberService] Attempting to open native Uber app URL: ${appUrl}`);

  try {
    // Attempt native app URL directly
    await Linking.openURL(appUrl);
    console.log(`[UberService] Successfully opened native Uber app: ${appUrl}`);
    return { opened: "app", url: appUrl };
  } catch (error) {
    console.warn(`[UberService] Native Uber app failed to open. Falling back to web link: ${webUrl}`, error);
    console.log(`[UberService] Opening fallback web URL: ${webUrl}`);
    await Linking.openURL(webUrl);
    return { opened: "web", url: webUrl };
  }
}

