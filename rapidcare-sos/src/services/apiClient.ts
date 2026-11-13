import { EMERGENCY_CONFIG, validateApiUrlForDevice } from "../config/emergencyConfig";

export interface ServerHealthResponse {
  success: boolean;
  status: string;
  service?: string;
  env?: string;
  uberEnv?: "sandbox" | "production";
  uberRedirectConfigured?: boolean;
  smsProvider?: string;
  outboundVoiceCallEnabled?: boolean;
  timestamp?: string;
}

export interface ServerConnectionTestResult {
  ok: boolean;
  url: string;
  latencyMs?: number;
  data?: ServerHealthResponse;
  error?: string;
}

let cachedAuthToken: string | null = null;
let cachedDeviceId = `rc_runtime_${Date.now().toString(36)}`;

export function setCachedAuthToken(token: string | null): void {
  cachedAuthToken = token;
}

export function getCachedAuthToken(): string | null {
  return cachedAuthToken;
}

export function setCachedDeviceId(deviceId: string): void {
  if (deviceId) cachedDeviceId = deviceId;
}

/**
 * Tests reachability of GET /api/health using configured EXPO_PUBLIC_API_URL.
 * Checks for missing URL or localhost misconfiguration on physical phones.
 */
export async function testServerConnection(
  baseUrl: string = EMERGENCY_CONFIG.API_URL
): Promise<ServerConnectionTestResult> {
  const cleanUrl = (baseUrl || "").trim().replace(/\/+$/, "");
  const validation = validateApiUrlForDevice(cleanUrl);
  if (!validation.valid) {
    return {
      ok: false,
      url: cleanUrl || "(unset)",
      error: validation.error,
    };
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${cleanUrl}/api/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      return {
        ok: false,
        url: cleanUrl,
        latencyMs,
        error: `Server responded with HTTP ${res.status} (${res.statusText || "Error"}). Verify backend is running on ${cleanUrl}.`,
      };
    }

    const data = (await res.json()) as ServerHealthResponse;
    if (!data?.success) {
      return {
        ok: false,
        url: cleanUrl,
        latencyMs,
        error: "Health endpoint returned unexpected payload.",
      };
    }

    return {
      ok: true,
      url: cleanUrl,
      latencyMs,
      data,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isAbort = err?.name === "AbortError";
    return {
      ok: false,
      url: cleanUrl,
      error: isAbort
        ? `Connection timed out after 5s reaching ${cleanUrl}. Check Wi-Fi/LAN IP, firewall port 5000, or use ngrok.`
        : `Network error reaching ${cleanUrl}: ${err?.message || "Unknown error"}`,
    };
  }
}

/**
 * Acquires a lightweight patient JWT from POST /api/auth/device-session
 * so mobile SOS and Uber endpoints remain strictly authenticated.
 * Never logs tokens.
 */
export async function ensureDeviceAuthToken(
  baseUrl: string = EMERGENCY_CONFIG.API_URL,
  deviceId?: string,
  userName?: string
): Promise<string | null> {
  if (cachedAuthToken) return cachedAuthToken;

  const cleanUrl = (baseUrl || "").trim().replace(/\/+$/, "");
  const validation = validateApiUrlForDevice(cleanUrl);
  if (!validation.valid) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${cleanUrl}/api/auth/device-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: deviceId || cachedDeviceId,
        name: userName || "RapidCare SOS User",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (data?.accessToken) {
      cachedAuthToken = data.accessToken;
      return cachedAuthToken;
    }
  } catch {
    clearTimeout(timeoutId);
  }
  return null;
}

