import {
  getActiveSmsProvider,
  renderSmsTemplate,
  getMaxAllowedSmsLength,
} from "../services/smsProvider.js";
import { consumeSmsDailyCaps } from "../middleware/rateLimiter.js";

const MAX_RECIPIENTS_PER_REQUEST = 5;

/**
 * Dispatches emergency SMS alerts to provided contacts.
 * Rate-limited (10/hour per device) and authenticated endpoint.
 * Enforces max 5 recipients and template-bounded message length.
 * Privacy: Logs ONLY contact display names! Never phone numbers or SMS bodies!
 */
export const dispatchSosAlert = async (req, res, next) => {
  try {
    const { contacts, message, messageType, templateVariables } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid contacts array",
      });
    }

    if (contacts.length > MAX_RECIPIENTS_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_RECIPIENTS_PER_REQUEST} recipients allowed per SOS alert request.`,
      });
    }

    const resolvedMessage = renderSmsTemplate(
      messageType,
      templateVariables || {},
      typeof message === "string" ? message : ""
    );

    if (!resolvedMessage) {
      return res.status(400).json({
        success: false,
        error: "Message text or valid template is required",
      });
    }

    const maxAllowedLength = getMaxAllowedSmsLength(messageType);
    if (resolvedMessage.length > maxAllowedLength) {
      return res.status(400).json({
        success: false,
        error: `SMS message length (${resolvedMessage.length}) exceeds maximum allowed by configured template (${maxAllowedLength}).`,
      });
    }

    const validRecipients = contacts.filter((c) => Boolean(c?.phone));
    const deviceKey = req.user?._id ? String(req.user._id) : req.ip || "unknown";
    const dailyCapCheck = consumeSmsDailyCaps(deviceKey, validRecipients.length || 1);
    if (!dailyCapCheck.allowed) {
      return res.status(429).json({
        success: false,
        code: dailyCapCheck.code,
        fallbackRequired: true,
        error: dailyCapCheck.error,
      });
    }

    // Privacy protection: log contact display names only
    const contactNames = contacts.map((c) => c.name || "Unnamed").join(", ");
    console.log(
      `[SosAlertController] Dispatching emergency alert (type: ${messageType || "generic"}) to: [${contactNames}]`
    );

    const smsProvider = getActiveSmsProvider();
    const results = [];

    for (const contact of contacts) {
      if (!contact.phone) continue;
      const sendRes = await smsProvider.sendSms(contact.phone, resolvedMessage);
      results.push({
        contactName: contact.name || "Contact",
        success: sendRes.success,
        code: sendRes.code || null,
        isTrialUnverified: Boolean(sendRes.isTrialUnverified),
        error: sendRes.error || null,
      });
    }

    const dispatchedCount = results.filter((r) => r.success).length;
    const failedResults = results.filter((r) => !r.success);
    const anyTrialUnverified = failedResults.some((r) => r.isTrialUnverified);
    const fallbackRequired = dispatchedCount < results.length || results.length === 0;

    if (dispatchedCount === 0) {
      const primaryError = anyTrialUnverified
        ? "Twilio trial account can only SMS verified numbers. Opening device SMS composer fallback."
        : failedResults[0]?.error || "SMS provider could not deliver messages. Opening device SMS fallback.";

      return res.status(anyTrialUnverified ? 422 : 502).json({
        success: false,
        provider: smsProvider.name,
        dispatchedCount: 0,
        totalCount: contacts.length,
        fallbackRequired: true,
        trialUnverified: anyTrialUnverified,
        error: primaryError,
        results,
      });
    }

    return res.status(200).json({
      success: true,
      provider: smsProvider.name,
      dispatchedCount,
      totalCount: contacts.length,
      fallbackRequired,
      trialUnverified: anyTrialUnverified,
      results,
    });
  } catch (err) {
    console.error("[SosAlertController] Error dispatching alerts:", err.message);
    next(err);
  }
};
