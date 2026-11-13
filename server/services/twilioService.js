import twilio from "twilio";

/**
 * Normalizes phone numbers to standard E.164 format (+[country_code][number]).
 */
const normalizePhoneNumber = (rawNumber) => {
  if (!rawNumber) return "";
  const cleaned = rawNumber.toString().trim().replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
};

export const isOutboundEmergencyCallEnabled = () => {
  return process.env.ENABLE_OUTBOUND_EMERGENCY_CALL === "true";
};

/**
 * Twilio Emergency Call Service
 * Initiates an outbound emergency call to the designated dispatch/response number
 * (EMERGENCY_PHONE_NUMBER or caller-specified destination, bridged to BUSINESS_PHONE_NUMBER).
 *
 * SAFETY GUARD: Disabled by default unless ENABLE_OUTBOUND_EMERGENCY_CALL=true.
 */
export const makeEmergencyCall = async ({ to } = {}) => {
  if (!isOutboundEmergencyCallEnabled()) {
    console.log("[Twilio Service] Outbound emergency voice call is disabled (ENABLE_OUTBOUND_EMERGENCY_CALL != 'true').");
    return {
      sid: null,
      status: "disabled",
      disabled: true,
      simulated: false,
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const rawFromNumber = process.env.TWILIO_PHONE_NUMBER;
  const destination = normalizePhoneNumber(to || process.env.EMERGENCY_PHONE_NUMBER);
  const fromNumber = normalizePhoneNumber(rawFromNumber);

  if (!destination || !accountSid || !authToken || !fromNumber || fromNumber.includes("1234567890")) {
    console.warn("[Twilio Service] Outbound call credentials or destination incomplete. Returning simulated status.");
    return {
      sid: `sim_call_${Date.now()}`,
      status: "queued",
      simulated: true,
    };
  }

  const client = twilio(accountSid, authToken);

  console.log("[Twilio Service] Live outbound emergency voice call requested.");

  const publicUrl = (
    process.env.PUBLIC_SERVER_URL || "https://bookdoctor-9ns2.onrender.com"
  ).replace(/\/$/, "");

  try {
    const call = await client.calls.create({
      from: fromNumber,
      to: destination,
      url: `${publicUrl}/twiml/connect`,
    });

    console.log(`[Twilio Service] Call created. SID: ${call.sid}, Status: ${call.status}`);
    return call;
  } catch (err) {
    console.warn("[Twilio Service Notice]:", {
      code: err.code,
      status: err.status,
      message: err.message,
    });

    return {
      sid: `fallback_${Date.now()}`,
      status: "queued",
      simulated: true,
      notice: err.message,
    };
  }
};
