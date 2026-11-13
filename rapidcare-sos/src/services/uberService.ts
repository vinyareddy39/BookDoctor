import { Linking } from "react-native";
import { EMERGENCY_CONFIG, validateApiUrlForDevice } from "../config/emergencyConfig";
import { ensureDeviceAuthToken, setCachedAuthToken } from "./apiClient";

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

export type UberApiSource = "uber-sandbox" | "uber-production" | "local-simulation";

export interface UberEstimateResponse {
  success: boolean;
  source?: UberApiSource;
  isSimulated?: boolean;
  code?: string;
  shouldFallbackDeepLink?: boolean;
  fare_id: string;
  fare: string;
  currency_code: string;
  estimated_duration_minutes: number;
  distance_km: number;
  product_id: string;
  isFallbackEstimate?: boolean;
  error?: string;
}

export interface UberRideBookingResponse {
  success: boolean;
  source?: UberApiSource;
  ride_id?: string;
  status?: string;
  driver?: {
    name: string;
    phone: string;
    rating?: number;
  } | null;
  vehicle?: {
    make: string;
    model: string;
    license_plate: string;
  } | null;
  eta?: number;
  error?: string;
  code?: string;
  shouldFallbackDeepLink?: boolean;
  isSimulated?: boolean;
}

export interface UberRideStatusResponse {
  success: boolean;
  source?: UberApiSource;
  isSimulated?: boolean;
  ride_id: string;
  status: "processing" | "accepted" | "arriving" | "in_progress" | "completed" | "canceled";
  driver?: {
    name: string;
    phone: string;
    rating?: number;
  } | null;
  vehicle?: {
    make: string;
    model: string;
    license_plate: string;
  } | null;
  eta?: number;
}

/**
 * Builds the official, strictly percent-encoded Uber deep links
 * without relying on App Store / itms-apps redirects.
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
 */
export async function openUberRide(
  pickup: Coordinates,
  dropoff: UberHospitalDestination
): Promise<{ opened: "app" | "web"; url: string }> {
  const { appUrl, webUrl } = buildUberLinks(pickup, dropoff);

  console.log(`[UberService] Attempting to open native Uber app URL: ${appUrl}`);

  try {
    await Linking.openURL(appUrl);
    console.log(`[UberService] Successfully opened native Uber app: ${appUrl}`);
    return { opened: "app", url: appUrl };
  } catch (error) {
    console.warn(`[UberService] Native Uber app failed to open. Falling back to web link: ${webUrl}`, error);
    await Linking.openURL(webUrl);
    return { opened: "web", url: webUrl };
  }
}

async function authenticatedFetch(
  baseUrl: string,
  path: string,
  init: RequestInit
): Promise<Response> {
  let token = await ensureDeviceAuthToken(baseUrl);
  const run = async (authToken: string | null) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      return await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init.headers || {}),
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let res = await run(token);
  if (res.status === 401) {
    setCachedAuthToken(null);
    token = await ensureDeviceAuthToken(baseUrl);
    if (token) {
      res = await run(token);
    }
  }
  return res;
}

/**
 * Requests fare and ETA estimate from server endpoint
 * (Required by Uber: fare must be displayed before request when Uber is connected)
 */
export async function fetchUberEstimate(
  pickup: Coordinates & { address?: string },
  dropoff: UberHospitalDestination,
  serverBaseUrl = EMERGENCY_CONFIG.API_URL
): Promise<UberEstimateResponse> {
  const cleanUrl = (serverBaseUrl || "").trim().replace(/\/+$/, "");
  const validation = validateApiUrlForDevice(cleanUrl);

  if (validation.valid) {
    try {
      const res = await authenticatedFetch(cleanUrl, "/api/uber/estimate", {
        method: "POST",
        body: JSON.stringify({
          pickup: { lat: pickup.latitude, lng: pickup.longitude, address: pickup.address },
          dropoff: { lat: dropoff.latitude, lng: dropoff.longitude, name: dropoff.name },
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        return data;
      }
      return {
        success: false,
        code: data?.code || `HTTP_${res.status}`,
        shouldFallbackDeepLink: Boolean(data?.shouldFallbackDeepLink ?? true),
        fare_id: "",
        fare: "Fare unavailable",
        currency_code: "INR",
        estimated_duration_minutes: 0,
        distance_km: 0,
        product_id: "uber-go",
        isFallbackEstimate: true,
        error: data?.error || "Could not reach fare estimate service",
      };
    } catch (err: any) {
      console.warn("[UberService] Estimate API exception:", err?.message || "Network error");
    }
  }

  return {
    success: false,
    fare_id: "",
    fare: "Fare unavailable",
    currency_code: "INR",
    estimated_duration_minutes: 0,
    distance_km: 0,
    product_id: "uber-go",
    isFallbackEstimate: true,
    error: validation.valid ? "Could not reach fare estimate service" : validation.error,
  };
}

/**
 * Dispatches automated ride request via server.
 * Handles "not authorised / account not registered as developer" errors cleanly.
 */
export async function requestUberAutoBooking(
  pickup: Coordinates & { address?: string },
  dropoff: UberHospitalDestination,
  fareId: string,
  productId = "uber-go",
  serverBaseUrl = EMERGENCY_CONFIG.API_URL
): Promise<UberRideBookingResponse> {
  const cleanUrl = (serverBaseUrl || "").trim().replace(/\/+$/, "");
  const validation = validateApiUrlForDevice(cleanUrl);

  if (!validation.valid) {
    return {
      success: false,
      shouldFallbackDeepLink: true,
      error: validation.error,
    };
  }

  try {
    const res = await authenticatedFetch(cleanUrl, "/api/uber/request", {
      method: "POST",
      body: JSON.stringify({
        pickup: { lat: pickup.latitude, lng: pickup.longitude, address: pickup.address },
        dropoff: { lat: dropoff.latitude, lng: dropoff.longitude, name: dropoff.name },
        fare_id: fareId,
        product_id: productId,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data?.success) {
      return {
        success: false,
        code: data?.code || `HTTP_${res.status}`,
        shouldFallbackDeepLink: true,
        error:
          data?.error ||
          "Uber auto-booking is unavailable right now. Opening Uber app deep link instead.",
      };
    }

    return data;
  } catch (err: any) {
    console.warn("[UberService] Auto-booking request API error:", err?.message || "Network error");
    return {
      success: false,
      shouldFallbackDeepLink: true,
      error: `Unable to reach server for Uber auto-booking (${err?.message || "network error"}). Using deep link fallback.`,
    };
  }
}

/**
 * Polls active ride status (driver, vehicle, ETA)
 */
export async function pollUberRideStatus(
  rideId: string,
  serverBaseUrl = EMERGENCY_CONFIG.API_URL
): Promise<UberRideStatusResponse | null> {
  const cleanUrl = (serverBaseUrl || "").trim().replace(/\/+$/, "");
  if (!validateApiUrlForDevice(cleanUrl).valid) return null;

  try {
    const res = await authenticatedFetch(cleanUrl, `/api/uber/ride/${rideId}`, {
      method: "GET",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err: any) {
    console.warn("[UberService] Poll ride status error:", err?.message);
  }
  return null;
}

/**
 * Cancels active ride via server
 */
export async function cancelUberRide(
  rideId: string,
  serverBaseUrl = EMERGENCY_CONFIG.API_URL
): Promise<boolean> {
  const cleanUrl = (serverBaseUrl || "").trim().replace(/\/+$/, "");
  if (!validateApiUrlForDevice(cleanUrl).valid) return false;

  try {
    const res = await authenticatedFetch(cleanUrl, `/api/uber/ride/${rideId}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (err: any) {
    console.warn("[UberService] Cancel ride error:", err?.message);
    return false;
  }
}
