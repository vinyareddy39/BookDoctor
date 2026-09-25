import twilio from "twilio";

/**
 * Twilio Emergency Call Service
 * Initiates an automatic outbound emergency call to the designated response number (+919849512453).
 * If Twilio credentials are not yet configured in environment variables,
 * gracefully runs in simulated emergency dispatch mode without throwing errors.
 */
export const makeEmergencyCall = async ({ to, hospitalName, userAddress } = {}) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const destination = to || process.env.EMERGENCY_PHONE_NUMBER || "+919849512453";

  // Graceful fallback if credentials are not configured
  if (!accountSid || !authToken || !fromNumber) {
    console.warn("==========================================");
    console.warn("⚠️ [Twilio Service] Twilio credentials not configured in environment.");
    console.warn(`📞 Running in simulated emergency dispatch mode for: ${destination}`);
    console.warn("ℹ️  To place real cellular calls, add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env.");
    console.warn("==========================================");

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

  const twiml = `
    <Response>
      <Say voice="Polly.Aditi" language="en-IN">
        This is an urgent emergency call from BookDoctor. A patient has activated the emergency dispatch system.
        ${userAddress ? `Patient location: ${userAddress}.` : ""}
        ${hospitalName ? `Nearest hospital destination is ${hospitalName}.` : ""}
        Please respond immediately.
      </Say>
      <Pause length="1"/>
      <Say voice="Polly.Aditi" language="en-IN">
        Repeating: This is an emergency alert from BookDoctor. Immediate assistance required.
      </Say>
    </Response>
  `.trim();

  const call = await client.calls.create({
    from: fromNumber,
    to: destination,
    twiml
  });

  console.log(`🆔 Twilio Call SID: ${call.sid}`);
  console.log(`📊 Status: ${call.status}`);
  console.log("==========================================");

  return call;
};
