/**
 * Central Emergency Configuration
 * Contains all country-specific helplines, timeouts, and safety parameters.
 */

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
  
  // Storage keys
  STORAGE_KEY_CONTACTS: "rapidcare_emergency_contacts_v1",
  MAX_CONTACTS: 3,
};

