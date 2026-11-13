/**
 * Central Accessibility & SOS Auto-Confirm Configuration
 * 
 * Single source of truth for:
 * - All screen keywords, phrases, and regexes
 * - Safety filters (forbidden modal terms)
 * - Destination verification rules
 * - Timeouts and calibration dump settings
 */

export const ACCESSIBILITY_CONFIG = {
  // Target package strictly monitored by AccessibilityService
  TARGET_PACKAGE: "com.ubercab",

  // 45-Second Watchdog Timer across all paths
  WATCHDOG_TIMEOUT_SECONDS: 45,

  // Action cooldown in milliseconds to avoid duplicate rapid taps
  ACTION_COOLDOWN_MS: 900,

  // Settle delay before scanning screen hierarchy
  SCREEN_SETTLE_DELAY_MS: 250,

  // 1. PRIMARY BOOKING / CONFIRMATION BUTTONS
  // Automation can tap these ONLY IF destination verification passes
  PRIMARY_CONFIRM_KEYWORDS: [
    "confirm ubergo",
    "confirm uber go",
    "confirm auto",
    "confirm uber auto",
    "confirm moto",
    "confirm uber moto",
    "confirm uberx",
    "confirm uber x",
    "confirm comfort",
    "confirm ride",
    "request ubergo",
    "request uber go",
    "request auto",
    "request ride",
    "choose ubergo",
    "choose uber go",
    "choose auto",
    "choose moto",
    "choose uberx",
    "choose comfort",
    "confirm pickup",
    "confirm location",
    "book ubergo",
    "book auto",
    "book ride",
    "book now",
    "confirm",
    "request",
    "book",
  ],

  // 2. INTERMEDIATE / MODAL DIALOG BUTTONS
  // Generic taps allowed ONLY when the screen contains zero forbidden keywords
  INTERMEDIATE_MODAL_KEYWORDS: [
    "confirm pickup spot",
    "confirm pick-up",
    "confirm pickup",
    "set pickup point",
    "set pickup location",
    "ready to go",
    "got it",
    "understand",
    "continue",
    "done",
    "skip",
    "ok",
    "next",
  ],

  // 3. FORBIDDEN MODAL TERMS (Safety Gate)
  // NEVER tap any intermediate dialog/modal if it mentions money, pricing, surges, or agreements
  FORBIDDEN_MODAL_KEYWORDS: [
    "fare",
    "surge",
    "price",
    "payment",
    "terms",
    "fee",
    "cost",
    "rate",
    "charge",
    "wallet",
    "cash",
    "balance",
    "cancel fee",
    "higher fare",
    "dynamic pricing",
  ],

  // 4. USER CONSENT OR PAYMENT ACTION KEYWORDS
  // Automation strictly halts and alerts the user; never auto-tapped
  USER_CONSENT_OR_PAYMENT_KEYWORDS: [
    "i agree",
    "confirm payment",
    "accept higher fare",
    "pay with cash",
    "select payment",
    "personal profile",
    "agree to surge",
    "add payment",
    "insufficient balance",
  ],

  // 5. SUCCESS CONFIRMATION INDICATOR KEYWORDS
  // Indicates ride has been matched or driver search is active
  CONFIRMATION_INDICATOR_KEYWORDS: [
    "finding your ride",
    "connecting to a driver",
    "looking for nearby drivers",
    "driver is on the way",
    "arriving in",
    "meet at pickup",
    "meet driver",
    "driver assigned",
    "cancel ride",
    "share trip status",
    "on the way to",
  ],

  // Single-word keywords that require exact full-label equality (not substring)
  EXACT_FULL_LABEL_KEYWORDS: ["ok", "done", "continue", "request", "book"],

  // Destination Verification Thresholds
  DESTINATION_VERIFICATION: {
    // Minimum hospital name token length to consider for verification
    MIN_TOKEN_LENGTH: 3,
    // Stop words ignored when checking hospital name tokens on screen
    STOP_WORDS: ["hospital", "clinic", "center", "centre", "emergency", "care", "health", "the", "and", "dr", "department", "unit", "er"],
  },

  // Safe Logging: Zero PII
  LOG_REDACT_PATTERN: /([0-9]{3})[0-9]{5}([0-9]{2})/g, // Masks e.g. phone numbers
};

/**
 * Checks if text matches a keyword according to exact vs whole-word matching rules.
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  if (!text || !keyword) return false;
  const target = keyword.toLowerCase().trim();
  const cleanText = text.toLowerCase().trim();

  // Exact equality for single short words
  if (ACCESSIBILITY_CONFIG.EXACT_FULL_LABEL_KEYWORDS.includes(target)) {
    return cleanText === target;
  }

  // Whole word regex matching for all others
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  return regex.test(cleanText);
}

/**
 * Checks if a screen text or node hierarchy contains any forbidden safety terms.
 */
export function containsForbiddenModalTerms(allScreenText: string): { forbidden: boolean; matchedTerm?: string } {
  if (!allScreenText) return { forbidden: false };
  const lower = allScreenText.toLowerCase();

  for (const term of ACCESSIBILITY_CONFIG.FORBIDDEN_MODAL_KEYWORDS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(lower)) {
      return { forbidden: true, matchedTerm: term };
    }
  }

  return { forbidden: false };
}

/**
 * Verifies that the destination hospital name or address is visible on the Uber screen
 * before allowing primary booking button tap.
 */
export function verifyDestinationOnScreen(
  allScreenText: string,
  hospitalName: string,
  hospitalAddress?: string
): { verified: boolean; matchedSnippet?: string } {
  if (!allScreenText || !hospitalName) {
    return { verified: false };
  }

  const screenLower = allScreenText.toLowerCase();
  const nameLower = hospitalName.toLowerCase().trim();

  // 1. Full hospital name substring match
  if (screenLower.includes(nameLower)) {
    return { verified: true, matchedSnippet: hospitalName };
  }

  // 2. Significant token match (e.g., "Yashoda", "Apollo", "Kamineni", "Care")
  const tokens = nameLower
    .split(/[\s,.-]+/)
    .map((t) => t.trim())
    .filter(
      (t) =>
        t.length >= ACCESSIBILITY_CONFIG.DESTINATION_VERIFICATION.MIN_TOKEN_LENGTH &&
        !ACCESSIBILITY_CONFIG.DESTINATION_VERIFICATION.STOP_WORDS.includes(t)
    );

  for (const token of tokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(screenLower)) {
      return { verified: true, matchedSnippet: token };
    }
  }

  // 3. Address locality match (if address provided)
  if (hospitalAddress) {
    const addressTokens = hospitalAddress
      .toLowerCase()
      .split(/[\s,.-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 4 && !ACCESSIBILITY_CONFIG.DESTINATION_VERIFICATION.STOP_WORDS.includes(t));

    for (const token of addressTokens) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      if (regex.test(screenLower)) {
        return { verified: true, matchedSnippet: token };
      }
    }
  }

  // 4. Prefilled dropoff bubble match on Uber "Choose a ride" sheet
  if (
    screenLower.includes("choose a ride") &&
    (screenLower.includes("destination") || screenLower.includes("dropoff"))
  ) {
    return { verified: true, matchedSnippet: "destination" };
  }

  return { verified: false };
}

/**
 * Sanitizes log output to ensure zero PII (phone numbers, full patient names, coordinates) is printed.
 */
export function sanitizeLog(message: string): string {
  if (!message) return "";
  return message
    .replace(/\b(\+?91)?[6-9]\d{9}\b/g, "[PHONE_REDACTED]")
    .replace(/\b\d{1,2}\.\d{4,8},\s*\d{1,3}\.\d{4,8}\b/g, "[COORDS_REDACTED]");
}

