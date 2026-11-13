import * as SMS from "expo-sms";

export interface EmergencyContactInfo {
  id?: string;
  name: string;
  phone: string;
}

export interface SmsComposerResult {
  success: boolean;
  method: "composer" | "unavailable" | "skipped";
  result?: "sent" | "cancelled" | "unknown";
  error?: string;
  recipients?: string[];
  messageText?: string;
}

export const MAX_EMERGENCY_CONTACTS = 5;
const SOS_COOLDOWN_MS = 60000;
let lastSosCompletedTimestamp = 0;

/**
 * Builds standard Google Maps pin URL
 */
export function buildLocationPinUrl(latitude: number, longitude: number): string {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

/**
 * Message 1 Builder:
 * Sent after hospital lookup finishes (or 8s timeout).
 * "SOS - I need help. My location: <Google Maps link>. Nearest emergency hospital: <name>"
 * If hospital is null/unavailable:
 * "SOS - I need help. My location: <Google Maps link>"
 */
export function createSosCombinedAlertMessage(
  latitude: number,
  longitude: number,
  hospitalName?: string | null
): string {
  const pin = buildLocationPinUrl(latitude, longitude);
  if (hospitalName && hospitalName.trim().length > 0) {
    return `SOS - I need help. My location: ${pin}. Nearest emergency hospital: ${hospitalName.trim()}`;
  }
  return `SOS - I need help. My location: ${pin}`;
}

export function createLocationAlertMessage(latitude: number, longitude: number): string {
  return createSosCombinedAlertMessage(latitude, longitude);
}

export function createHospitalUpdateMessage(hospitalName: string): string {
  return `Nearest emergency hospital: ${hospitalName.trim()}`;
}

/**
 * Watchdog Failure Message Builder:
 * "Ride could not be confirmed. Please call me or send help."
 */
export function createWatchdogFailedMessage(): string {
  return "Ride could not be confirmed. Please call me or send help.";
}

/**
 * Ride Confirmed Message Builder:
 * Carries driver name, vehicle, plate, ETA, and Maps/tracking link.
 */
export function createRideConfirmedMessage(details: {
  driverName?: string | null;
  vehicleModel?: string | null;
  licensePlate?: string | null;
  etaMinutes?: number | null;
  hospitalName?: string | null;
  trackingUrl?: string | null;
}): string {
  const parts: string[] = ["Emergency Uber ride confirmed."];
  if (details.hospitalName) {
    parts.push(`Destination: ${details.hospitalName}.`);
  }
  if (details.driverName || details.vehicleModel || details.licensePlate) {
    const carInfo = [
      details.driverName ? `Driver: ${details.driverName}` : null,
      details.vehicleModel || null,
      details.licensePlate ? `(${details.licensePlate})` : null,
    ]
      .filter(Boolean)
      .join(" ");
    parts.push(carInfo);
  }
  if (typeof details.etaMinutes === "number" && details.etaMinutes > 0) {
    parts.push(`ETA: ~${details.etaMinutes} mins.`);
  }
  if (details.trackingUrl) {
    parts.push(`Live tracking: ${details.trackingUrl}`);
  }
  return parts.join(" ");
}

/**
 * Location Unavailable Message Builder:
 * Used if GPS fails.
 */
export function createLocationUnavailableMessage(): string {
  return "SOS - location unavailable, please call me";
}

/**
 * Checks if SOS is within the 60-second cooldown period.
 */
export function isSosInCooldown(): boolean {
  return Date.now() - lastSosCompletedTimestamp < SOS_COOLDOWN_MS;
}

/**
 * Marks an SOS alert completed, starting the 60-second cooldown.
 */
export function markSosAlertCompleted(): void {
  lastSosCompletedTimestamp = Date.now();
}

/**
 * Clears the cooldown (e.g. when the user cancels or deliberately re-triggers SOS).
 */
export function clearSosCooldown(): void {
  lastSosCompletedTimestamp = 0;
}

/**
 * Opens the native Messages app pre-filled with ALL contacts (capped at 5) and message body.
 * Privacy: NEVER logs phone numbers or message bodies. Logs only contact count and display names.
 */
export async function openEmergencySmsComposer(
  contacts: EmergencyContactInfo[],
  messageText: string
): Promise<SmsComposerResult> {
  if (!contacts || contacts.length === 0) {
    console.log("[SmsService] No emergency contacts configured. SMS step cleanly skipped.");
    return { success: true, method: "skipped" };
  }

  // Cap to maximum 5 contacts
  const cappedContacts = contacts.slice(0, MAX_EMERGENCY_CONTACTS);
  const phoneNumbers = cappedContacts
    .map((c) => c.phone?.trim())
    .filter((p): p is string => Boolean(p && p.length > 0));

  if (phoneNumbers.length === 0) {
    console.log("[SmsService] Contacts have no phone numbers. SMS step cleanly skipped.");
    return { success: true, method: "skipped" };
  }

  // Privacy protection: log contact count and names only, NEVER phone numbers or message bodies!
  const contactNames = cappedContacts.map((c) => c.name || "Contact").join(", ");
  console.log(`[SmsService] Opening native Messages composer for ${cappedContacts.length} contacts: [${contactNames}]`);

  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      console.warn("[SmsService] Native SMS composer is not available on this device.");
      return {
        success: false,
        method: "unavailable",
        recipients: phoneNumbers,
        messageText,
        error: "Messages app or SIM is unavailable on this device.",
      };
    }

    const { result } = await SMS.sendSMSAsync(phoneNumbers, messageText);
    return {
      success: true,
      method: "composer",
      result,
    };
  } catch (err: any) {
    console.warn("[SmsService] SMS compose error or dismissed:", err?.message || "unknown error");
    return {
      success: false,
      method: "unavailable",
      recipients: phoneNumbers,
      messageText,
      error: err?.message || "Failed to open Messages app.",
    };
  }
}

/**
 * Compatibility wrapper for emergency SMS dispatching (delegates to openEmergencySmsComposer).
 */
export async function dispatchEmergencySms(
  contacts: EmergencyContactInfo[],
  messageText: string,
  _messageType = "generic"
): Promise<{ success: boolean; method: string; warning?: string }> {
  const res = await openEmergencySmsComposer(contacts, messageText);
  return {
    success: res.success,
    method: res.method === "composer" ? "sms_sheet" : res.method,
    warning: res.error,
  };
}

