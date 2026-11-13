import { Platform } from "react-native";

/**
 * Central Emergency Configuration
 * Contains all country-specific helplines, timeouts, API config, SMS templates, and safety parameters.
 */

const rawApiUrl = (
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_SERVER_BASE_URL ||
  ""
)
  .trim()
  .replace(/\/+$/, "");

/**
 * Returns true if the URL points to localhost or loopback (which cannot be reached from a physical phone).
 */
export function isLocalhostUrl(url: string): boolean {
  if (!url) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(url.trim());
}

/**
 * Validates that the configured API URL is usable from a real mobile device.
 */
export function validateApiUrlForDevice(
  url: string = rawApiUrl,
  isWeb: boolean = Platform.OS === "web"
): { valid: boolean; error?: string } {
  if (!url) {
    return {
      valid: false,
      error: "EXPO_PUBLIC_API_URL is not set. Set it in rapidcare-sos/.env to your computer's LAN IP (e.g. http://192.168.1.15:5000) or ngrok URL.",
    };
  }
  if (!/^https?:\/\//i.test(url)) {
    return {
      valid: false,
      error: `Invalid EXPO_PUBLIC_API_URL ("${url}"). Must start with http:// or https://`,
    };
  }
  if (!isWeb && isLocalhostUrl(url)) {
    return {
      valid: false,
      error: `EXPO_PUBLIC_API_URL is set to localhost ("${url}"), which refers to the phone itself. Replace it with your computer's LAN IP or an ngrok URL.`,
    };
  }
  return { valid: true };
}

export const EMERGENCY_CONFIG = {
  // India-specific emergency defaults
  AMBULANCE_NUMBER: "108",
  NATIONAL_EMERGENCY_NUMBER: "112",

  // Emergency safety warning
  WARNING_TEXT: "In a real emergency call 108/112 directly",

  // Countdown & Timeouts
  CANCEL_COUNTDOWN_SECONDS: 5, // Set to 0 to disable countdown
  WATCHDOG_TIMEOUT_SECONDS: 45, // Time allowed for Uber confirmation before fallback alert
  LOCATION_TIMEOUT_MS: 12000, // Maximum wait for high-accuracy GPS fix

  // Hospital Discovery
  OVERPASS_RADIUS_KM: 25, // Search radius for OpenStreetMap Overpass fallback

  // Single Phone-to-Server API URL Config (EXPO_PUBLIC_API_URL)
  API_URL: rawApiUrl,
  SERVER_BASE_URL: rawApiUrl,

  // Configurable SMS Templates (supports {{MAPS_LINK}} and {{HOSPITAL_NAME}})
  SMS_TEMPLATES: {
    LOCATION:
      process.env.EXPO_PUBLIC_SMS_TEMPLATE_LOCATION ||
      "SOS - I need help. My location: {{MAPS_LINK}}",
    HOSPITAL:
      process.env.EXPO_PUBLIC_SMS_TEMPLATE_HOSPITAL ||
      "Nearest emergency hospital: {{HOSPITAL_NAME}}",
    WATCHDOG_FAILED:
      process.env.EXPO_PUBLIC_SMS_TEMPLATE_WATCHDOG ||
      "Ride could not be confirmed. Please call me or send help.",
    LOCATION_UNAVAILABLE:
      process.env.EXPO_PUBLIC_SMS_TEMPLATE_NO_LOCATION ||
      "SOS - location unavailable, please call me",
  },

  // Storage keys & limits
  STORAGE_KEY_CONTACTS: "rapidcare_emergency_contacts_v2",
  MAX_CONTACTS: 5,
};
