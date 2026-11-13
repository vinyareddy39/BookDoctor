import * as Location from "expo-location";
import { EMERGENCY_CONFIG } from "../config/emergencyConfig";

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address?: string;
  isFallbackLastKnown?: boolean;
}

/**
 * Reverse geocodes coordinates to a clean, human-readable street address.
 */
export async function reverseGeocodeAddress(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results && results.length > 0) {
      const r = results[0];
      const streetComponents = [
        r.streetNumber,
        r.street,
        r.name,
        r.district || r.subregion,
        r.city,
      ].filter(Boolean);

      if (streetComponents.length > 0) {
        return streetComponents.join(", ");
      }
    }
  } catch (err) {
    console.warn("[LocationService] Reverse geocode lookup non-fatal fallback:", err);
  }
  return `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/**
 * Acquires the user's live GPS location with high accuracy.
 * Adheres to a 12-second timeout, falling back to the device's last known location.
 * Reverse-geocodes to a human-readable street address for pickup.
 */
export async function getCurrentOrLastKnownLocation(
  timeoutMs = EMERGENCY_CONFIG.LOCATION_TIMEOUT_MS
): Promise<LocationResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission denied. Cannot acquire GPS fix for emergency ride.");
  }

  // Promise with timeout for getCurrentPositionAsync
  const freshLocationPromise = Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Location request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  let rawLat = 0;
  let rawLng = 0;
  let rawAccuracy: number | null | undefined = null;
  let isFallback = false;

  try {
    const loc = await Promise.race([freshLocationPromise, timeoutPromise]);
    rawLat = loc.coords.latitude;
    rawLng = loc.coords.longitude;
    rawAccuracy = loc.coords.accuracy;
  } catch (err) {
    console.warn(
      "[LocationService] Fresh high-accuracy location timed out or failed. Attempting last known location...",
      err
    );
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown) {
      console.log("[LocationService] Using last known location as fallback.");
      rawLat = lastKnown.coords.latitude;
      rawLng = lastKnown.coords.longitude;
      rawAccuracy = lastKnown.coords.accuracy;
      isFallback = true;
    } else {
      throw new Error("Failed to acquire both fresh GPS coordinates and last known location.");
    }
  }

  // Reverse geocode to street address
  const streetAddress = await reverseGeocodeAddress(rawLat, rawLng);

  return {
    latitude: rawLat,
    longitude: rawLng,
    accuracy: rawAccuracy,
    address: streetAddress,
    isFallbackLastKnown: isFallback,
  };
}
