import { describe, it } from "node:test";
import assert from "node:assert";
import {
  evaluateMockScreenTree,
  type MockAccessibilityNode,
} from "../src/services/accessibilityService";
import {
  ACCESSIBILITY_CONFIG,
  matchesKeyword,
  containsForbiddenModalTerms,
  verifyDestinationOnScreen,
  sanitizeLog,
} from "../src/config/accessibilityConfig";
import { useStore } from "../src/store/useStore";

describe("Accessibility Automation & Safety Tests", () => {
  // ── 1. DESTINATION VERIFICATION TESTS ──
  describe("1. Destination Verification", () => {
    it("allows confirm tap when target hospital name is on the screen", () => {
      const mockScreen: MockAccessibilityNode = {
        className: "android.widget.FrameLayout",
        children: [
          { text: "Drop-off at Yashoda Hospital Secunderabad", className: "android.widget.TextView" },
          { text: "Confirm UberGo", className: "android.widget.Button", clickable: true },
        ],
      };

      const result = evaluateMockScreenTree(mockScreen, "Yashoda Hospital Secunderabad");
      assert.strictEqual(result.action, "CONFIRMED");
      assert.strictEqual(result.destinationVerified, true);
      assert.ok(result.reason?.includes("Destination verified"));
    });

    it("allows confirm tap on significant hospital token match (e.g., 'Apollo')", () => {
      const mockScreen: MockAccessibilityNode = {
        children: [
          { text: "Heading to Apollo Emergency Care, Jubilee Hills" },
          { text: "Choose UberGo", clickable: true },
        ],
      };

      const result = evaluateMockScreenTree(mockScreen, "Apollo Hospital ER");
      assert.strictEqual(result.action, "CONFIRMED");
      assert.strictEqual(result.destinationVerified, true);
    });

    it("BLOCKS confirm tap and returns destination_mismatch when screen shows wrong destination", () => {
      const mockScreen: MockAccessibilityNode = {
        children: [
          { text: "Drop-off at Inorbit Mall, Hitech City" },
          { text: "Confirm UberGo", clickable: true },
        ],
      };

      const result = evaluateMockScreenTree(mockScreen, "Kamineni Hospital L.B. Nagar");
      assert.strictEqual(result.action, "BLOCKED");
      assert.strictEqual(result.reason, "destination_mismatch");
      assert.strictEqual(result.destinationVerified, false);
    });

    it("verifies destination matching helper directly", () => {
      const screenText = "Your trip to Care Hospital Banjara Hills is ready";
      assert.strictEqual(verifyDestinationOnScreen(screenText, "Care Hospital").verified, true);
      assert.strictEqual(verifyDestinationOnScreen(screenText, "MaxCure").verified, false);
      assert.strictEqual(verifyDestinationOnScreen("", "Care Hospital").verified, false);
    });
  });

  // ── 2. MODAL SAFETY FILTER (FORBIDDEN TERMS) ──
  describe("2. Modal Safety Filter", () => {
    it("BLOCKS tapping intermediate modal when screen mentions 'surge' pricing", () => {
      const mockScreen: MockAccessibilityNode = {
        children: [
          { text: "Fares are higher due to high surge pricing in your area." },
          { text: "Got it", clickable: true },
        ],
      };

      const result = evaluateMockScreenTree(mockScreen, "Apollo Hospital");
      assert.strictEqual(result.action, "BLOCKED");
      assert.ok(result.reason?.includes("forbidden_modal_term: surge"));
    });

    it("BLOCKS tapping intermediate modal when screen mentions 'payment' or 'fare'", () => {
      const mockScreen: MockAccessibilityNode = {
        children: [
          { text: "Review payment method before booking" },
          { text: "Continue", clickable: true },
        ],
      };

      const result = evaluateMockScreenTree(mockScreen, "Apollo Hospital");
      assert.strictEqual(result.action, "BLOCKED");
      assert.ok(result.reason?.includes("forbidden_modal_term: payment"));
    });

    it("BLOCKS tapping intermediate modal when screen mentions 'terms' or 'fee'", () => {
      const mockScreen: MockAccessibilityNode = {
        children: [
          { text: "Agree to cancellation fee terms" },
          { text: "OK", clickable: true },
        ],
      };

      const result = evaluateMockScreenTree(mockScreen, "Apollo Hospital");
      assert.strictEqual(result.action, "BLOCKED");
      assert.ok(result.reason?.includes("forbidden_modal_term: terms") || result.reason?.includes("fee"));
    });

    it("ALLOWS safe intermediate modal without forbidden terms (e.g. pickup spot confirmation)", () => {
      const mockScreen: MockAccessibilityNode = {
        children: [
          { text: "Your driver will meet you at the main gate" },
          { text: "Confirm pickup spot", clickable: true },
        ],
      };

      const result = evaluateMockScreenTree(mockScreen, "Apollo Hospital");
      assert.strictEqual(result.action, "INTERMEDIATE_CLICKED");
      assert.strictEqual(result.matchedKeyword, "Confirm pickup spot");
    });
  });

  // ── 3. USER ACTION REQUIRED / CONSENT KEYWORDS ──
  describe("3. User Action Required / Consent Guard", () => {
    it("halts automation and reports ACTION_REQUIRED when screen asks for consent ('I agree')", () => {
      const mockScreen: MockAccessibilityNode = {
        children: [
          { text: "Updated safety guidelines" },
          { text: "I agree", clickable: true },
        ],
      };

      const result = evaluateMockScreenTree(mockScreen, "Apollo Hospital");
      assert.strictEqual(result.action, "ACTION_REQUIRED");
      assert.strictEqual(result.matchedKeyword, "I agree");
    });

    it("halts automation when screen requires manual payment selection", () => {
      const mockScreen: MockAccessibilityNode = {
        children: [
          { text: "Select payment method" },
        ],
      };

      const result = evaluateMockScreenTree(mockScreen, "Apollo Hospital");
      assert.strictEqual(result.action, "ACTION_REQUIRED");
    });
  });

  // ── 4. SUCCESS CONFIRMATION DETECTION ──
  describe("4. Success Detection", () => {
    it("detects 'driver is on the way' and reports CONFIRMED", () => {
      const mockScreen: MockAccessibilityNode = {
        children: [
          { text: "Your driver is on the way" },
          { text: "Maruti Dzire • TS 08 UB 1234" },
        ],
      };

      const result = evaluateMockScreenTree(mockScreen, "Apollo Hospital");
      assert.strictEqual(result.action, "CONFIRMED");
      assert.strictEqual(result.matchedKeyword, "Your driver is on the way");
    });

    it("detects 'finding your ride' and reports CONFIRMED", () => {
      const mockScreen: MockAccessibilityNode = {
        children: [
          { text: "Finding your ride... Connecting to nearby drivers" },
        ],
      };

      const result = evaluateMockScreenTree(mockScreen, "Apollo Hospital");
      assert.strictEqual(result.action, "CONFIRMED");
    });
  });

  // ── 5. STORE SETTINGS & KILL SWITCH ──
  describe("5. Store Settings, Off-by-Default & Kill Switch", () => {
    it("autoConfirmEnabled is strictly FALSE by default", () => {
      const state = useStore.getState();
      assert.strictEqual(state.autoConfirmEnabled, false);
      assert.strictEqual(state.autoConfirmDisclosed, false);
    });

    it("kill switch immediately disables autoConfirmEnabled", () => {
      useStore.getState().setAutoConfirmEnabled(true);
      assert.strictEqual(useStore.getState().autoConfirmEnabled, true);

      useStore.getState().emergencyKillSwitch();
      assert.strictEqual(useStore.getState().autoConfirmEnabled, false);
    });
  });

  // ── 6. ZERO PII LOG SANITIZATION ──
  describe("6. Zero PII Log Sanitization", () => {
    it("redacts Indian phone numbers from logs", () => {
      const raw = "Sending alert to +919876543210 and 9398927430";
      const sanitized = sanitizeLog(raw);
      assert.strictEqual(sanitized.includes("9876543210"), false);
      assert.strictEqual(sanitized.includes("9398927430"), false);
      assert.ok(sanitized.includes("[PHONE_REDACTED]"));
    });

    it("redacts geographic coordinates from logs", () => {
      const raw = "Driver location at 17.432512, 78.407156 en route";
      const sanitized = sanitizeLog(raw);
      assert.strictEqual(sanitized.includes("17.432512"), false);
      assert.ok(sanitized.includes("[COORDS_REDACTED]"));
    });
  });

  // ── 7. KEYWORD MATCHING RULES ──
  describe("7. Keyword Matcher Exact vs Whole-Word", () => {
    it("requires exact full label equality for short single words (ok, done, book)", () => {
      assert.strictEqual(matchesKeyword("OK", "ok"), true);
      assert.strictEqual(matchesKeyword("OK button here", "ok"), false);
      assert.strictEqual(matchesKeyword("Booking confirmed", "book"), false);
      assert.strictEqual(matchesKeyword("book", "book"), true);
    });

    it("uses whole-word matching for phrases", () => {
      assert.strictEqual(matchesKeyword("Please confirm ubergo now", "confirm ubergo"), true);
      assert.strictEqual(matchesKeyword("confirm ubergo", "confirm ubergo"), true);
    });
  });
});

