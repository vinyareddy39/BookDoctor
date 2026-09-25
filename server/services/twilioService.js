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

/**
 * Twilio Emergency Call Service
 * Initiates an outbound emergency call to the designated response number (+919849512453).
 * If Twilio credentials are not configured or trial limitations apply,
 * gracefully logs and returns simulated dispatch status to prevent blocking emergencies.
 */
export const makeEmergencyCall = async ({ to, hospitalName, userAddress } = {}) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const rawFromNumber = process.env.TWILIO_PHONE_NUMBER;
  const destination = normalizePhoneNumber(to || process.env.EMERGENCY_PHONE_NUMBER || "+919849512453");
  const fromNumber = normalizePhoneNumber(rawFromNumber);

  // Fallback if credentials or from number not configured
  if (!accountSid || !authToken || !fromNumber || fromNumber.includes("1234567890")) {
    console.warn("⚠️ [Twilio Service] Twilio credentials or phone number not fully configured. Using simulated dispatch mode.");
    return {
      sid: `sim_call_${Date.now()}`,
      status: "queued",
      simulated: true,
      to: destination
    };
  }

  const client = twilio(accountSid, authToken);

  console.log("==========================================");
  console.log("🚨 [Twilio Service] Live emergency call requested");
  console.log(`📞 Destination: ${destination}`);
  console.log(`📤 From (Twilio): ${fromNumber}`);

  const publicUrl = (
    process.env.PUBLIC_SERVER_URL || "https://bookdoctor-9ns2.onrender.com"
  ).replace(/\/$/, "");

  try {
    const call = await client.calls.create({
      from: fromNumber,
      to: destination,
      url: `${publicUrl}/twiml/connect`
    });

    console.log(`🆔 Twilio Call SID: ${call.sid}`);
    console.log(`📊 Status: ${call.status}`);
    console.log("==========================================");

    return call;
  } catch (err) {
    console.warn("⚠️ [Twilio Service Notice]:", {
      code: err.code,
      status: err.status,
      message: err.message,
      moreInfo: err.moreInfo
    });

    // Return safe fallback so emergency flow is never disrupted
    return {
      sid: `fallback_${Date.now()}`,
      status: "queued",
      simulated: true,
      to: destination,
      notice: err.message
    };
  }
};
