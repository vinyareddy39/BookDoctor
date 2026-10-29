import * as Location from "expo-location";
import { EMERGENCY_CONFIG } from "../config/emergencyConfig";

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  isFallbackLastKnown?: boolean;
}

/**
 * Acquires the user's live GPS location with high accuracy.
 * Adheres to a 12-second timeout, falling back to the device's last known location.
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

  try {
    const loc = await Promise.race([freshLocationPromise, timeoutPromise]);
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
      isFallbackLastKnown: false,
    };
  } catch (err) {
    console.warn("[LocationService] Fresh high-accuracy location timed out or failed. Attempting last known location...", err);
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown) {
      console.log("[LocationService] Using last known location as fallback.");
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
        accuracy: lastKnown.coords.accuracy,
        isFallbackLastKnown: true,
      };
    }
    throw new Error("Failed to acquire both fresh GPS coordinates and last known location.");
  }
}

