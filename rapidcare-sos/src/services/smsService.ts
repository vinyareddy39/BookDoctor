import { Share } from "react-native";
import * as SMS from "expo-sms";
import { EMERGENCY_CONFIG, validateApiUrlForDevice } from "../config/emergencyConfig";
import { ensureDeviceAuthToken, setCachedAuthToken } from "./apiClient";

export interface EmergencyContactInfo {
  id?: string;
  name: string;
  phone: string;
}

export interface SmsDispatchResult {
  success: boolean;
  method: "server" | "sms_sheet" | "share" | "skipped";
  trialUnverified?: boolean;
  warning?: string;
}

/**
 * Builds standard Google Maps pin URL
 */
export function buildLocationPinUrl(latitude: number, longitude: number): string {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

/**
 * SMS Message Content Generators (configurable via EXPO_PUBLIC_SMS_TEMPLATE_* env vars)
 */
export function createLocationAlertMessage(latitude: number, longitude: number): string {
  const pin = buildLocationPinUrl(latitude, longitude);
  return EMERGENCY_CONFIG.SMS_TEMPLATES.LOCATION.replace(/\{\{MAPS_LINK\}\}/g, pin);
}

export function createHospitalUpdateMessage(hospitalName: string): string {
  return EMERGENCY_CONFIG.SMS_TEMPLATES.HOSPITAL.replace(/\{\{HOSPITAL_NAME\}\}/g, hospitalName);
}

export function createWatchdogFailedMessage(): string {
  return EMERGENCY_CONFIG.SMS_TEMPLATES.WATCHDOG_FAILED;
}

export function createLocationUnavailableMessage(): string {
  return EMERGENCY_CONFIG.SMS_TEMPLATES.LOCATION_UNAVAILABLE;
}

/**
 * Server API dispatcher with fallback to Expo SMS compose sheet and Share sheet.
 * Handles Twilio trial unverified number errors cleanly by opening expo-sms fallback.
 * Privacy: Logs ONLY contact display names. NEVER logs phone numbers, tokens, or message bodies!
 */
export async function dispatchEmergencySms(
  contacts: EmergencyContactInfo[],
  messageText: string,
  messageType: "location" | "hospital" | "watchdog_failed" | "location_unavailable" = "location",
  serverBaseUrl = EMERGENCY_CONFIG.API_URL
): Promise<SmsDispatchResult> {
  if (!contacts || contacts.length === 0) {
    console.log("[SmsService] No emergency contacts configured. SMS step cleanly skipped.");
    return { success: true, method: "skipped" };
  }

  // Privacy protection: log contact names only
  const contactNames = contacts.map((c) => c.name || "Unnamed").join(", ");
  console.log(`[SmsService] Dispatching emergency alert (${messageType}) to: [${contactNames}]`);

  let fallbackWarning: string | undefined;
  let trialUnverified = false;

  const cleanBaseUrl = (serverBaseUrl || "").trim().replace(/\/+$/, "");
  const urlValidation = validateApiUrlForDevice(cleanBaseUrl);

  // 1. Primary Attempt: Server-Sent SMS (Twilio or MSG91 via POST /api/sos/alert)
  if (!urlValidation.valid) {
    fallbackWarning = urlValidation.error;
    console.warn("[SmsService] Skipping server SMS due to API URL config notice. Falling back to device SMS.");
  } else {
    try {
      let token = await ensureDeviceAuthToken(cleanBaseUrl);
      const sendAttempt = async (authToken: string | null) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        try {
          return await fetch(`${cleanBaseUrl}/api/sos/alert`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify({
              contacts,
              message: messageText,
              messageType,
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
      };

      let response = await sendAttempt(token);
      if (response.status === 401) {
        setCachedAuthToken(null);
        token = await ensureDeviceAuthToken(cleanBaseUrl);
        if (token) {
          response = await sendAttempt(token);
        }
      }

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.ok && data?.success && !data?.fallbackRequired) {
        console.log(`[SmsService] Server SMS provider (${data.provider}) dispatched successfully.`);
        return { success: true, method: "server" };
      }

      trialUnverified = Boolean(data?.trialUnverified);
      fallbackWarning =
        data?.error ||
        (trialUnverified
          ? "Twilio trial account cannot send SMS to unverified numbers. Opened device SMS composer."
          : `Server SMS unavailable (HTTP ${response.status}). Falling back to device SMS.`);

      console.warn(`[SmsService] Server SMS fallback triggered (status ${response.status}).`);
    } catch (err: any) {
      fallbackWarning = `Server SMS unreachable (${err?.message || "network error"}). Falling back to device SMS.`;
      console.warn("[SmsService] Server SMS endpoint unreachable. Falling back to device SMS composer.");
    }
  }

  // 2. Secondary Fallback: Device SMS compose sheet via expo-sms
  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      const phoneNumbers = contacts.map((c) => c.phone).filter(Boolean);
      await SMS.sendSMSAsync(phoneNumbers, messageText);
      return {
        success: true,
        method: "sms_sheet",
        trialUnverified,
        warning: fallbackWarning,
      };
    }
  } catch (smsErr: any) {
    console.warn("[SmsService] Expo SMS compose sheet unavailable or denied, falling back to Share sheet.");
    fallbackWarning = fallbackWarning || "SMS permission/composer unavailable. Using system Share sheet.";
  }

  // 3. Tertiary Fallback: Native Share Sheet
  try {
    await Share.share({
      message: messageText,
      title: "EMERGENCY SOS ALERT",
    });
    return {
      success: true,
      method: "share",
      trialUnverified,
      warning: fallbackWarning,
    };
  } catch {
    console.error("[SmsService] All SMS/Share dispatch methods failed.");
    return {
      success: false,
      method: "share",
      trialUnverified,
      warning: fallbackWarning || "Unable to send SMS or open Share sheet. Call 108/112 directly.",
    };
  }
}
