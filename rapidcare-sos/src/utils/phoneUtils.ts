/**
 * Validates and normalizes phone numbers to standard E.164 format.
 * Default country calling code is +91 (India).
 *
 * Privacy rule: Never log phone numbers or SMS bodies!
 */

export function normalizeToE164(phone: string, defaultCountryCode = "+91"): string {
  if (!phone || typeof phone !== "string") {
    throw new Error("Phone number must be a non-empty string");
  }

  // Strip all non-digit and non-plus characters (spaces, dashes, parentheses, dots)
  let cleaned = phone.replace(/[^0-9+]/g, "").trim();

  if (!cleaned) {
    throw new Error("Phone number contains no digits");
  }

  // If already starts with '+', validate international length (8-15 digits after '+')
  if (cleaned.startsWith("+")) {
    const digitsOnly = cleaned.slice(1);
    if (!/^\d{8,15}$/.test(digitsOnly)) {
      throw new Error("Invalid international E.164 phone number format");
    }
    return cleaned;
  }

  // Handle '00' international prefix
  if (cleaned.startsWith("00")) {
    const digitsOnly = cleaned.slice(2);
    if (!/^\d{8,15}$/.test(digitsOnly)) {
      throw new Error("Invalid international phone number format");
    }
    return `+${digitsOnly}`;
  }

  // Handle leading 0 (trunk prefix e.g., 09876543210 -> 9876543210)
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  // Standard 10-digit national number
  if (/^\d{10}$/.test(cleaned)) {
    const normalizedPrefix = defaultCountryCode.startsWith("+")
      ? defaultCountryCode
      : `+${defaultCountryCode}`;
    return `${normalizedPrefix}${cleaned}`;
  }

  // Fallback for valid 8-14 digit numbers without '+'
  if (/^\d{8,14}$/.test(cleaned)) {
    const normalizedPrefix = defaultCountryCode.startsWith("+")
      ? defaultCountryCode
      : `+${defaultCountryCode}`;
    return `${normalizedPrefix}${cleaned}`;
  }

  throw new Error("Phone number format could not be normalized to E.164");
}

export function isValidPhone(phone: string, defaultCountryCode = "+91"): boolean {
  try {
    normalizeToE164(phone, defaultCountryCode);
    return true;
  } catch {
    return false;
  }
}

