import axios from "axios";

/**
 * Universal SMS Provider Interface
 * Allows seamless switching between Twilio, MSG91, or simulated dev console.
 * Note: For India (+91) production traffic, TRAI DLT registration (Entity ID,
 * Sender ID, and pre-approved Template IDs) is required before live delivery.
 */

export const DEFAULT_SMS_TEMPLATES = {
  location: "SOS - I need help. My location: {{MAPS_LINK}}",
  hospital: "Nearest emergency hospital: {{HOSPITAL_NAME}}",
  watchdog_failed: "Ride could not be confirmed. Please call me or send help.",
  location_unavailable: "SOS - location unavailable, please call me",
};

const ENV_TEMPLATE_MAP = {
  location: () => process.env.SMS_TEMPLATE_LOCATION,
  hospital: () => process.env.SMS_TEMPLATE_HOSPITAL,
  watchdog_failed: () => process.env.SMS_TEMPLATE_WATCHDOG,
  location_unavailable: () => process.env.SMS_TEMPLATE_NO_LOCATION,
};

function computeTemplateMaxLength(templateText) {
  const matches = templateText.match(/\{\{[A-Z0-9_]+\}\}/g) || [];
  const staticText = templateText.replace(/\{\{[A-Z0-9_]+\}\}/g, "");
  return staticText.length + matches.length * 80;
}

export function getMaxAllowedSmsLength(messageType) {
  if (messageType && ENV_TEMPLATE_MAP[messageType]) {
    const tpl = ENV_TEMPLATE_MAP[messageType]() || DEFAULT_SMS_TEMPLATES[messageType];
    return computeTemplateMaxLength(tpl);
  }
  const lengths = Object.keys(DEFAULT_SMS_TEMPLATES).map((k) => {
    const tpl = ENV_TEMPLATE_MAP[k]() || DEFAULT_SMS_TEMPLATES[k];
    return computeTemplateMaxLength(tpl);
  });
  return Math.max(...lengths);
}

export function renderSmsTemplate(messageType, variables = {}, fallbackMessage = "") {
  let template = messageType && ENV_TEMPLATE_MAP[messageType] ? ENV_TEMPLATE_MAP[messageType]() : undefined;
  if (!template) {
    return fallbackMessage || DEFAULT_SMS_TEMPLATES[messageType] || "";
  }

  for (const [key, val] of Object.entries(variables || {})) {
    template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(val ?? ""));
  }
  return template;
}

/**
 * 1. Twilio SMS Provider
 */
export class TwilioSmsProvider {
  constructor(accountSid, authToken, fromNumber, clientFactory = null) {
    this.name = "Twilio";
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
    this.clientFactory = clientFactory;
  }

  async sendSms(to, message) {
    try {
      let client;
      if (this.clientFactory) {
        client = this.clientFactory(this.accountSid, this.authToken);
      } else {
        const twilioModule = await import("twilio");
        client = twilioModule.default(this.accountSid, this.authToken);
      }
      const res = await client.messages.create({
        body: message,
        from: this.fromNumber,
        to,
      });
      return { success: true, messageId: res.sid };
    } catch (err) {
      const code = err?.code || null;
      const rawMsg = err?.message || "Twilio SMS failed";
      const isTrialUnverified =
        code === 21608 ||
        code === 573002 ||
        /unverified/i.test(rawMsg);

      let cleanError = "SMS delivery failed via Twilio.";
      if (isTrialUnverified) {
        cleanError =
          "Twilio trial account limitation: destination number is not verified. Verify it in Twilio Console or use device SMS fallback.";
      } else if (code === 21606 || code === 21212 || code === 573003) {
        cleanError =
          "Twilio 'From' number is not SMS-capable or not valid for this account. Check TWILIO_PHONE_NUMBER.";
      } else if (code === 20003) {
        cleanError = "Twilio authentication failed. Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.";
      } else if (code === 21211) {
        cleanError = "Invalid E.164 destination phone format.";
      }

      return {
        success: false,
        code,
        isTrialUnverified,
        error: cleanError,
      };
    }
  }
}

/**
 * 2. MSG91 Provider (Standard for India DLT-registered numbers e.g. +91)
 */
export class Msg91SmsProvider {
  constructor(authKey, senderId, templateId) {
    this.name = "MSG91";
    this.authKey = authKey;
    this.senderId = senderId;
    this.templateId = templateId;
  }

  async sendSms(to, message) {
    try {
      const cleanMobile = to.replace(/[^0-9]/g, "");
      const res = await axios.post(
        "https://control.msg91.com/api/v5/flow/",
        {
          template_id: this.templateId || "default_sos",
          sender: this.senderId,
          short_url: "0",
          mobiles: cleanMobile,
          VAR1: message,
        },
        {
          headers: {
            authkey: this.authKey,
            "content-type": "application/json",
          },
          timeout: 8000,
        }
      );
      return { success: true, messageId: res.data?.request_id || "msg91_sent" };
    } catch (err) {
      return {
        success: false,
        isTrialUnverified: false,
        error: err.response?.data?.message || "MSG91 SMS delivery failed",
      };
    }
  }
}

/**
 * 3. Simulated Development Provider (for testing when credentials are unset)
 */
export class DevConsoleSmsProvider {
  constructor() {
    this.name = "DevConsole";
  }

  async sendSms(_to, _message) {
    // Privacy: Never log phone numbers or message bodies
    console.log("[DevSmsProvider] Simulated SMS dispatched cleanly.");
    return { success: true, messageId: `mock_${Date.now()}` };
  }
}

/**
 * Factory to resolve active provider based on environment configuration
 */
export function getActiveSmsProvider() {
  const providerType = (process.env.SMS_PROVIDER || "").toUpperCase();

  if (providerType === "MSG91" && process.env.MSG91_AUTH_KEY) {
    return new Msg91SmsProvider(
      process.env.MSG91_AUTH_KEY,
      process.env.MSG91_SENDER_ID || "RAPIDC",
      process.env.MSG91_TEMPLATE_ID
    );
  }

  if (
    (providerType === "TWILIO" || (!providerType && process.env.TWILIO_ACCOUNT_SID)) &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  ) {
    return new TwilioSmsProvider(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
      process.env.TWILIO_PHONE_NUMBER
    );
  }

  return new DevConsoleSmsProvider();
}
