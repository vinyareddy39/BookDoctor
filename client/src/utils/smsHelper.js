/**
 * Mobile Device Detection & Direct Phone-Sent SMS Helpers
 * Formats SMS and messaging links for iOS Safari and Android Chrome
 * without requiring Twilio or any paid SMS API.
 */

export function getMobilePlatform() {
  if (typeof window === "undefined" || !navigator) return "desktop";
  const ua = navigator.userAgent || "";
  const isIos =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIos) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/**
 * Normalizes phone numbers:
 * - Strips non-digit characters
 * - If 10 digits, prepends +91 (default India code)
 * - Otherwise prepends +
 */
export function normalizePhoneNumber(rawNumber) {
  if (!rawNumber) return "";
  const digits = String(rawNumber).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return `+${digits}`;
}

/**
 * Validates emergency contact number:
 * - Requires 10 digits (domestic) or 10-15 digits (with country code)
 */
export function isValidEmergencyContact(rawNumber) {
  if (!rawNumber) return false;
  const digits = String(rawNumber).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Builds platform-compliant SMS link:
 * - iOS Safari: sms:+91XXXXXXXXXX&body=ENCODED_MESSAGE
 * - Android Chrome: sms:+91XXXXXXXXXX?body=ENCODED_MESSAGE
 */
export function buildSmsLink(number, message, platform) {
  const normalized = normalizePhoneNumber(number);
  const encoded = encodeURIComponent(message || "");
  const currentPlatform = platform || getMobilePlatform();
  const separator = currentPlatform === "ios" ? "&" : "?";
  return `sms:${normalized}${separator}body=${encoded}`;
}

/**
 * Builds WhatsApp share link:
 * https://wa.me/91XXXXXXXXXX?text=ENCODED_MESSAGE
 */
export function buildWhatsAppLink(number, message) {
  const normalized = normalizePhoneNumber(number);
  const cleanDigits = normalized.replace(/^\+/, "");
  const encoded = encodeURIComponent(message || "");
  return `https://wa.me/${cleanDigits}?text=${encoded}`;
}
