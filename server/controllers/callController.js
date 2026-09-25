import twilio from "twilio";

/**
 * Normalizes phone numbers to standard E.164 format (+[country_code][number]).
 * Defaults to +91 (India) for 10-digit numbers if country code is omitted.
 */
export const normalizePhoneNumber = (rawNumber) => {
  if (!rawNumber) return "";
  const cleaned = rawNumber.toString().trim().replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.startsWith("0") && cleaned.length === 11) return `+91${cleaned.slice(1)}`;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
};

/**
 * Validates E.164 international phone number format.
 */
export const isValidE164 = (phone) => {
  return /^\+[1-9]\d{6,14}$/.test(phone);
};

/**
 * POST /api/call
 * Outbound Click-to-Call endpoint using Twilio Voice.
 *
 * Flow:
 * 1. Twilio calls the visitor's number (from request body).
 * 2. When visitor answers, Twilio executes the TwiML from /twiml/connect
 *    which dials the BUSINESS_PHONE_NUMBER to bridge the two parties.
 */
export const handleOutboundCall = async (req, res) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const businessPhoneNumber =
    process.env.BUSINESS_PHONE_NUMBER ||
    process.env.EMERGENCY_PHONE_NUMBER ||
    "+919849512453";

  try {
    const rawNumber = req.body?.phoneNumber || req.body?.to || req.body?.visitorNumber;

    if (!rawNumber) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required. Please provide a valid phone number."
      });
    }

    const visitorNumber = normalizePhoneNumber(rawNumber);

    if (!isValidE164(visitorNumber)) {
      return res.status(400).json({
        success: false,
        error: `Invalid phone number format: "${rawNumber}". Please provide a valid international number with country code (e.g. +919849512453).`
      });
    }

    // Verify Twilio configuration
    if (!accountSid || !authToken || !twilioPhoneNumber) {
      return res.status(500).json({
        success: false,
        error:
          "Twilio is not fully configured on the server. Please ensure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are set in the .env file.",
        directDialNumber: businessPhoneNumber
      });
    }

    // Check if phone number is the default placeholder (+12345678901)
    if (twilioPhoneNumber.includes("1234567890")) {
      return res.status(400).json({
        success: false,
        error:
          "The Twilio 'From' number is currently set to a placeholder (+12345678901). Please check the Twilio Console (Phone Numbers → Active Numbers) and set your real Twilio trial number in Render. You can also use direct dialing below.",
        directDialNumber: businessPhoneNumber,
        canDirectDial: true
      });
    }

    const client = twilio(accountSid, authToken);

    // Build Public TwiML Webhook URL or Inline TwiML
    const publicUrl = process.env.PUBLIC_SERVER_URL
      ? process.env.PUBLIC_SERVER_URL.replace(/\/$/, "")
      : null;

    const callPayload = {
      from: twilioPhoneNumber,
      to: visitorNumber
    };

    if (publicUrl) {
      callPayload.url = `${publicUrl}/twiml/connect`;
    } else {
      // Fallback: Inline TwiML executes directly without requiring public webhook URL
      callPayload.twiml = `<Response><Dial>${businessPhoneNumber}</Dial></Response>`;
    }

    console.log("==========================================");
    console.log("📞 [Click-to-Call] Initiating Twilio Outbound Call");
    console.log(`📤 From (Twilio): ${twilioPhoneNumber}`);
    console.log(`📥 To (Visitor): ${visitorNumber}`);
    console.log(`🏢 Forward To (Business): ${businessPhoneNumber}`);
    if (callPayload.url) console.log(`🌐 TwiML Webhook: ${callPayload.url}`);
    console.log("==========================================");

    const call = await client.calls.create(callPayload);

    console.log(`✅ [Click-to-Call] Call created! SID: ${call.sid}, Status: ${call.status}`);

    return res.status(200).json({
      success: true,
      message: "Call initiated successfully! Your phone should ring momentarily.",
      sid: call.sid,
      status: call.status,
      to: visitorNumber,
      businessNumber: businessPhoneNumber
    });
  } catch (err) {
    console.error("❌ [Click-to-Call] Error placing Twilio call:", err);

    let userFriendlyMessage = err.message || "Failed to initiate call via Twilio.";

    // Provide friendly guidance for common Twilio error codes
    if (err.code === 21608) {
      userFriendlyMessage =
        "Twilio Trial Account Limitation: The number you are calling is unverified. On trial accounts, verify the destination number in Twilio Console → Phone Numbers → Verified Caller IDs.";
    } else if (err.code === 21212 || err.code === 21606) {
      userFriendlyMessage =
        `Twilio configuration error: The 'From' number (${twilioPhoneNumber}) is not assigned to this account. Check Twilio Console → Phone Numbers → Active Numbers.`;
    } else if (err.code === 20003) {
      userFriendlyMessage =
        "Twilio Authentication Failed: Invalid TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN.";
    }

    return res.status(err.status || 500).json({
      success: false,
      error: userFriendlyMessage,
      code: err.code || null,
      details: err.message,
      directDialNumber: businessPhoneNumber,
      canDirectDial: true
    });
  }
};

/**
 * GET/POST /twiml/connect
 * Returns TwiML XML instructing Twilio to <Dial> the fixed BUSINESS_PHONE_NUMBER.
 */
export const getConnectTwiml = (req, res) => {
  const businessPhoneNumber =
    process.env.BUSINESS_PHONE_NUMBER ||
    process.env.EMERGENCY_PHONE_NUMBER ||
    "+919849512453";

  const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">Connecting you to emergency dispatch.</Say>
  <Dial>${businessPhoneNumber}</Dial>
</Response>`.trim();

  res.set("Content-Type", "text/xml");
  return res.status(200).send(xmlResponse);
};
