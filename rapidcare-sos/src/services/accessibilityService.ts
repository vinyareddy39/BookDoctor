import { NativeModules, NativeEventEmitter, Platform } from "react-native";
import {
  ACCESSIBILITY_CONFIG,
  matchesKeyword,
  containsForbiddenModalTerms,
  verifyDestinationOnScreen,
  sanitizeLog,
} from "../config/accessibilityConfig";

const { SosAccessibilityModule } = NativeModules;
const eventEmitter = SosAccessibilityModule ? new NativeEventEmitter(SosAccessibilityModule) : null;

export interface AccessibilityAutomationResult {
  action: "CONFIRMED" | "ACTION_REQUIRED" | "BLOCKED" | "INTERMEDIATE_CLICKED" | "NOOP";
  reason?: string;
  matchedKeyword?: string;
  destinationVerified?: boolean;
}

export interface MockAccessibilityNode {
  text?: string;
  contentDescription?: string;
  className?: string;
  clickable?: boolean;
  children?: MockAccessibilityNode[];
}

/**
 * Checks if the native accessibility service is currently enabled in Android OS.
 */
export async function isAccessibilityServiceEnabled(): Promise<boolean> {
  if (Platform.OS !== "android" || !SosAccessibilityModule?.isAccessibilityServiceEnabled) {
    return false;
  }
  try {
    return await SosAccessibilityModule.isAccessibilityServiceEnabled();
  } catch {
    return false;
  }
}

/**
 * Arms the accessibility service for the active SOS event.
 */
export async function startSosAutoConfirm(
  hospitalName: string,
  hospitalAddress: string = ""
): Promise<boolean> {
  if (Platform.OS !== "android" || !SosAccessibilityModule?.startSosAutoConfirm) {
    return false;
  }
  try {
    return await SosAccessibilityModule.startSosAutoConfirm(hospitalName, hospitalAddress);
  } catch {
    return false;
  }
}

/**
 * Disarms the accessibility service (kill switch).
 */
export async function stopSosAutoConfirm(): Promise<boolean> {
  if (Platform.OS !== "android" || !SosAccessibilityModule?.stopSosAutoConfirm) {
    return false;
  }
  try {
    return await SosAccessibilityModule.stopSosAutoConfirm();
  } catch {
    return false;
  }
}

/**
 * Retrieves the sanitized calibration dump from the native accessibility service.
 */
export async function getCalibrationDump(): Promise<string> {
  if (Platform.OS !== "android" || !SosAccessibilityModule?.getCalibrationDump) {
    return "";
  }
  try {
    return await SosAccessibilityModule.getCalibrationDump();
  } catch {
    return "";
  }
}

/**
 * Opens Android system Accessibility Settings page.
 */
export async function openAccessibilitySettings(): Promise<boolean> {
  if (Platform.OS !== "android" || !SosAccessibilityModule?.openAccessibilitySettings) {
    return false;
  }
  try {
    return await SosAccessibilityModule.openAccessibilitySettings();
  } catch {
    return false;
  }
}

/**
 * Collects all text from a mock node tree.
 */
export function collectMockTreeText(root: MockAccessibilityNode): string {
  const parts: string[] = [];
  function traverse(node: MockAccessibilityNode | undefined) {
    if (!node) return;
    if (node.text && node.text.trim()) parts.push(node.text.trim());
    if (node.contentDescription && node.contentDescription.trim() && node.contentDescription !== node.text) {
      parts.push(node.contentDescription.trim());
    }
    if (node.children) {
      for (const child of node.children) traverse(child);
    }
  }
  traverse(root);
  return parts.join(" ");
}

/**
 * Offline Mock Screen Tree Evaluator
 * Runs the identical algorithmic logic as the native Kotlin service for testing and verification.
 */
export function evaluateMockScreenTree(
  root: MockAccessibilityNode,
  targetHospitalName: string,
  targetHospitalAddress: string = ""
): AccessibilityAutomationResult {
  const allScreenText = collectMockTreeText(root);

  // Helper to find node matching any keyword
  function findNode(keywords: readonly string[]): { node: MockAccessibilityNode; text: string } | null {
    function traverse(node: MockAccessibilityNode | undefined): { node: MockAccessibilityNode; text: string } | null {
      if (!node) return null;
      const text = (node.text || node.contentDescription || "").trim();
      if (text) {
        for (const kw of keywords) {
          if (matchesKeyword(text, kw)) return { node, text };
        }
      }
      if (node.children) {
        for (const child of node.children) {
          const m = traverse(child);
          if (m) return m;
        }
      }
      return null;
    }
    return traverse(root);
  }

  // STEP 1: CHECK FOR SUCCESS / CONFIRMED BOOKING
  const successMatch = findNode(ACCESSIBILITY_CONFIG.CONFIRMATION_INDICATOR_KEYWORDS);
  if (successMatch) {
    return {
      action: "CONFIRMED",
      matchedKeyword: successMatch.text,
      reason: "Confirmation keyword detected on screen",
    };
  }

  // STEP 2: CHECK FOR MANUAL USER CONSENT / PAYMENT (Never auto-tapped)
  const consentMatch = findNode(ACCESSIBILITY_CONFIG.USER_CONSENT_OR_PAYMENT_KEYWORDS);
  if (consentMatch) {
    return {
      action: "ACTION_REQUIRED",
      matchedKeyword: consentMatch.text,
      reason: `Screen requires user action: ${sanitizeLog(consentMatch.text)}`,
    };
  }

  // STEP 3: CHECK FOR INTERMEDIATE / MODAL DIALOGS WITH FORBIDDEN TERMS FILTER
  const intermediateMatch = findNode(ACCESSIBILITY_CONFIG.INTERMEDIATE_MODAL_KEYWORDS);
  if (intermediateMatch) {
    const forbiddenCheck = containsForbiddenModalTerms(allScreenText);
    if (forbiddenCheck.forbidden) {
      return {
        action: "BLOCKED",
        reason: `forbidden_modal_term: ${forbiddenCheck.matchedTerm}`,
      };
    }
    return {
      action: "INTERMEDIATE_CLICKED",
      matchedKeyword: intermediateMatch.text,
      reason: `Safe modal clicked: ${intermediateMatch.text}`,
    };
  }

  // STEP 4: PRIMARY CONFIRM BUTTON WITH MANDATORY DESTINATION VERIFICATION
  const confirmMatch = findNode(ACCESSIBILITY_CONFIG.PRIMARY_CONFIRM_KEYWORDS);
  if (confirmMatch) {
    const destCheck = verifyDestinationOnScreen(allScreenText, targetHospitalName, targetHospitalAddress);
    if (!destCheck.verified) {
      return {
        action: "BLOCKED",
        reason: "destination_mismatch",
        destinationVerified: false,
      };
    }

    return {
      action: "CONFIRMED",
      matchedKeyword: confirmMatch.text,
      destinationVerified: true,
      reason: `Destination verified ('${destCheck.matchedSnippet}'). Tap allowed.`,
    };
  }

  return { action: "NOOP" };
}

