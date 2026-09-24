import twilio from "twilio";

/**
 * Twilio Emergency Call Service
 * Initiates an automatic outbound emergency call to the designated response number (+919398927430).
 */
export const makeEmergencyCall = async ({ to, hospitalName, userAddress } = {}) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const destination = to || process.env.EMERGENCY_PHONE_NUMBER || "+919398927430";

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are missing on the server.");
  }
  if (!fromNumber) {
    throw new Error("Twilio source number (TWILIO_PHONE_NUMBER) is missing in environment variables.");
  }

  const client = twilio(accountSid, authToken);

  console.log("==========================================");
  console.log("🚨 [Twilio Service] Emergency call requested");
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
