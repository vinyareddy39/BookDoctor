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

  const rawNumber = req.body?.phoneNumber || req.body?.to || req.body?.visitorNumber;
  let visitorNumber = "";

  try {
    if (!rawNumber) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required. Please provide a valid phone number."
      });
    }

    visitorNumber = normalizePhoneNumber(rawNumber);

    if (!isValidE164(visitorNumber)) {
      return res.status(400).json({
        success: false,
        code: 21211,
        error: `Invalid phone number format: "${rawNumber}". Use full international format with country code (e.g. +918639473778).`
      });
    }

    // Step 2a: Check environment variables
    if (!accountSid || !authToken) {
      console.error("❌ [Click-to-Call] Missing Twilio credentials in environment variables.");
      return res.status(400).json({
        success: false,
        code: 20003,
        error: "Twilio authentication failed. Check API credentials (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN) in environment variables.",
        directDialNumber: businessPhoneNumber
      });
    }

    // Check if TWILIO_PHONE_NUMBER is not set or set to placeholder
    if (!twilioPhoneNumber || twilioPhoneNumber.includes("1234567890")) {
      console.warn("⚠️ [Click-to-Call] TWILIO_PHONE_NUMBER is placeholder or unconfigured:", twilioPhoneNumber);
      return res.status(400).json({
        success: false,
        code: 21606,
        error: `Twilio configuration error: The 'From' number (${twilioPhoneNumber || "not set"}) is not an active Twilio number. Please check Twilio Console (Phone Numbers → Active Numbers) and set TWILIO_PHONE_NUMBER in Render environment variables.`,
        directDialNumber: businessPhoneNumber,
        canDirectDial: true
      });
    }

    const client = twilio(accountSid, authToken);

    // Step 2c: Public TwiML Webhook URL (Twilio requires publicly accessible URL on trial accounts)
    const publicUrl = (
      process.env.PUBLIC_SERVER_URL || "https://bookdoctor-9ns2.onrender.com"
    ).replace(/\/$/, "");

    const twimlUrl = `${publicUrl}/twiml/connect`;

    console.log("==========================================");
    console.log("📞 [Click-to-Call] Initiating Twilio Outbound Call");
    console.log(`📤 From (Twilio): ${twilioPhoneNumber}`);
    console.log(`📥 To (Visitor): ${visitorNumber}`);
    console.log(`🏢 Forward To (Business): ${businessPhoneNumber}`);
    console.log(`🌐 TwiML Webhook URL: ${twimlUrl}`);
    console.log("==========================================");

    // Place outbound call via Twilio
    const call = await client.calls.create({
      from: twilioPhoneNumber,
      to: visitorNumber,
      url: twimlUrl
    });

    console.log(`✅ [Click-to-Call] Call created successfully! SID: ${call.sid}, Status: ${call.status}`);

    return res.status(200).json({
      success: true,
      message: "Call initiated successfully! Your phone should ring momentarily.",
      sid: call.sid,
      status: call.status,
      to: visitorNumber,
      businessNumber: businessPhoneNumber
    });
  } catch (err) {
    // Step 1: Detailed server-side logging around client.calls.create()
    console.error("❌ [Click-to-Call] Twilio calls.create() failed:", {
      code: err.code,
      status: err.status,
      message: err.message,
      moreInfo: err.moreInfo,
      details: err.details
    });

    let userFriendlyMessage = err.message || "Failed to initiate call via Twilio.";

    // Step 2b & Step 3: Informative error responses
    if (err.code === 21608 || err.code === 573002) {
      userFriendlyMessage = `This number (${visitorNumber || rawNumber}) is not verified on the Twilio trial account. On Twilio trial accounts, outbound calls can only be placed to verified caller IDs. Please verify it in Twilio Console (Phone Numbers → Manage → Verified Caller IDs) or upgrade your account.`;
    } else if (err.code === 573003) {
      userFriendlyMessage = `The 'From' number (${twilioPhoneNumber}) is not your assigned Twilio trial number. Twilio trial accounts require calls to originate from your Twilio-assigned virtual number (e.g. +1...), not a personal mobile number. Please check your Twilio Console (Phone Numbers → Active Numbers) and set that number as TWILIO_PHONE_NUMBER in Render.`;
    } else if (err.code === 20003 || err.code === 20404) {
      userFriendlyMessage = "Twilio authentication failed. Check API credentials (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN).";
    } else if (err.code === 21211) {
      userFriendlyMessage = "Invalid phone number format. Use full international format with country code (e.g. +918639473778).";
    } else if (err.code === 21212 || err.code === 21606) {
      userFriendlyMessage = `Twilio configuration error: The 'From' number (${twilioPhoneNumber}) is not assigned to this account or is not voice-capable. Check Twilio Console → Active Numbers.`;
    } else if (err.code === 0) {
      userFriendlyMessage = `Twilio trial account limitation: ${err.message}. Please upgrade your Twilio account to unlock full calling capability.`;
    }

    // Return status 400/422 so Express global errorHandler won't mask it with generic 500
    const httpStatus = err.status && err.status < 500 ? err.status : 400;

    return res.status(httpStatus).json({
      success: false,
      error: userFriendlyMessage,
      code: err.code || null,
      status: err.status || httpStatus,
      moreInfo: err.moreInfo || null,
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
