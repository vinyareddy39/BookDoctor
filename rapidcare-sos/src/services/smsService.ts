import { Linking, Platform, Share } from "react-native";

export interface EmergencyContactInfo {
  id?: string;
  name: string;
  phone: string;
}

/**
 * Builds standard Google Maps pin URL
 */
export function buildLocationPinUrl(latitude: number, longitude: number): string {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

/**
 * SMS Message Content Generators
 */
export function createLocationAlertMessage(latitude: number, longitude: number): string {
  const pin = buildLocationPinUrl(latitude, longitude);
  return `SOS - I need help. My location: ${pin}`;
}

export function createHospitalUpdateMessage(hospitalName: string): string {
  return `Nearest emergency hospital: ${hospitalName}`;
}

export function createWatchdogFailedMessage(): string {
  return "Ride could not be confirmed. Please call me or send help.";
}

export function createLocationUnavailableMessage(): string {
  return "SOS - location unavailable, please call me";
}

/**
 * Platform-aware SMS dispatcher.
 * iOS: Opens pre-filled SMS composer; falls back to native Share sheet.
 * Android: Opens pre-filled SMS intent or composer.
 * Privacy: Logs ONLY contact names. NEVER logs phone numbers or message bodies!
 */
export async function dispatchEmergencySms(
  contacts: EmergencyContactInfo[],
  messageText: string
): Promise<{ success: boolean; method: "sms" | "share" | "skipped" }> {
  if (!contacts || contacts.length === 0) {
    console.log("[SmsService] No emergency contacts configured. SMS step cleanly skipped.");
    return { success: true, method: "skipped" };
  }

  // Privacy protection: log contact names only
  const contactNames = contacts.map((c) => c.name || "Unnamed").join(", ");
  console.log(`[SmsService] Dispatching emergency alert to: [${contactNames}]`);

  const primaryPhone = contacts[0]?.phone?.trim() || "";
  const encodedBody = encodeURIComponent(messageText);

  // iOS uses '&body=', Android uses '?body='
  const separator = Platform.OS === "ios" ? "&" : "?";
  const smsUrl = `sms:${primaryPhone}${separator}body=${encodedBody}`;

  try {
    const canOpen = await Linking.canOpenURL(smsUrl);
    if (canOpen) {
      await Linking.openURL(smsUrl);
      return { success: true, method: "sms" };
    }
    throw new Error("Cannot open SMS URL scheme on this device");
  } catch (err) {
    console.warn("[SmsService] Native SMS composer open failed, falling back to Share sheet.", err);
    try {
      await Share.share({
        message: messageText,
        title: "EMERGENCY SOS ALERT",
      });
      return { success: true, method: "share" };
    } catch (shareErr) {
      console.error("[SmsService] Share sheet fallback failed:", shareErr);
      return { success: false, method: "share" };
    }
  }
}

