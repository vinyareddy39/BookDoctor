import express, { Request, Response } from "express";
import dotenv from "dotenv";
import twilio, { Twilio } from "twilio";
import cors from "cors";

// Load environment variables
dotenv.config();

const app = express();
const port: number = parseInt(process.env.PORT || "5000", 10);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Retrieve credentials
const accountSid: string | undefined = process.env.TWILIO_ACCOUNT_SID;
const authToken: string | undefined = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber: string | undefined = process.env.TWILIO_PHONE_NUMBER;
const businessPhoneNumber: string =
  process.env.BUSINESS_PHONE_NUMBER ||
  process.env.EMERGENCY_PHONE_NUMBER ||
  "+919849512453";
const publicServerUrl: string | undefined = process.env.PUBLIC_SERVER_URL;

// Helper: Normalize to E.164
function normalizePhoneNumber(rawNumber: string): string {
  const cleaned = rawNumber.trim().replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  return `+${cleaned}`;
}

interface CallRequestBody {
  phoneNumber?: string;
  visitorNumber?: string;
  to?: string;
}

/**
 * POST /api/call
 * Initiates an outbound Twilio call to the visitor.
 * Once answered, connects visitor to BUSINESS_PHONE_NUMBER using TwiML.
 */
app.post("/api/call", async (req: Request<{}, {}, CallRequestBody>, res: Response): Promise<void> => {
  try {
    const rawNumber = req.body.phoneNumber || req.body.visitorNumber || req.body.to;

    if (!rawNumber) {
      res.status(400).json({
        success: false,
        error: "Phone number is required. Please provide your phone number."
      });
      return;
    }

    const visitorNumber = normalizePhoneNumber(rawNumber);

    if (!/^\+[1-9]\d{6,14}$/.test(visitorNumber)) {
      res.status(400).json({
        success: false,
        error: `Invalid phone number format: "${rawNumber}". Please provide a valid E.164 format (e.g. +919849512453).`
      });
      return;
    }

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      res.status(500).json({
        success: false,
        error: "Twilio credentials are not configured. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env."
      });
      return;
    }

    const client: Twilio = twilio(accountSid, authToken);

    const callOptions: Parameters<Twilio["calls"]["create"]>[0] = {
      from: twilioPhoneNumber,
      to: visitorNumber
    };

    if (publicServerUrl) {
      // Passes public TwiML URL
      callOptions.url = `${publicServerUrl.replace(/\/$/, "")}/twiml/connect`;
    } else {
      // Inline TwiML fallback
      callOptions.twiml = `<Response><Dial>${businessPhoneNumber}</Dial></Response>`;
    }

    console.log(`[Twilio Call] Calling visitor ${visitorNumber} from ${twilioPhoneNumber}...`);

    const call = await client.calls.create(callOptions);

    console.log(`[Twilio Call] Outbound call created! SID: ${call.sid}, Status: ${call.status}`);

    res.status(200).json({
      success: true,
      message: "Call initiated! Your phone will ring momentarily.",
      sid: call.sid,
      status: call.status,
      to: visitorNumber,
      businessNumber: businessPhoneNumber
    });
  } catch (err: any) {
    console.error("[Twilio Call Error]:", err);

    let message = err.message || "Failed to initiate call via Twilio.";

    if (err.code === 21608) {
      message = "Twilio Trial Limitation: Number is unverified. Verify destination number in Twilio Console.";
    } else if (err.code === 21212 || err.code === 21606) {
      message = `Twilio configuration error: The 'From' number (${twilioPhoneNumber}) is invalid on this account.`;
    }

    res.status(err.status || 500).json({
      success: false,
      error: message,
      code: err.code || null
    });
  }
});

/**
 * GET /twiml/connect
 * TwiML endpoint for Twilio Voice webhook.
 * Returns XML instructing Twilio to dial the business phone number.
 */
app.get("/twiml/connect", (_req: Request, res: Response): void => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">Connecting you now.</Say>
  <Dial>${businessPhoneNumber}</Dial>
</Response>`.trim();

  res.type("text/xml");
  res.send(twiml);
});

// Also support POST for webhooks that POST
app.post("/twiml/connect", (_req: Request, res: Response): void => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">Connecting you now.</Say>
  <Dial>${businessPhoneNumber}</Dial>
</Response>`.trim();

  res.type("text/xml");
  res.send(twiml);
});

// Start server if run directly
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`🚀 Click-to-Call TypeScript Server running on port ${port}`);
  });
}

export default app;
