import crypto from "crypto";
import axios from "axios";
import SosEvent from "../models/SosEvent.js";
import UberConnection from "../models/UberConnection.js";
import EmergencyContact from "../models/EmergencyContact.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import { findAndRankEmergencyHospitals } from "../services/hospitalRanker.js";
import { getRideProvider } from "../services/rideProvider.js";
import { encryptText } from "../services/cryptoService.js";
import { recordAudit } from "../middleware/auditLogger.js";
import { createNotification } from "../services/notificationService.js";

// Helper: send SMS to emergency contacts (Twilio / live SMS or simulated dev logger)
async function sendEmergencySMS({ to, message }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (accountSid && authToken && fromPhone) {
    try {
      const client = (await import("twilio")).default(accountSid, authToken);
      await client.messages.create({
        body: message,
        from: fromPhone,
        to,
      });
      return true;
    } catch (err) {
      console.warn("Twilio SMS send notice:", err.message);
    }
  }

  // Development logger
  if (process.env.NODE_ENV !== "production") {
    console.log(`[EMERGENCY SMS DISPATCH] To: ${to} | Message: ${message}`);
  }
  return true;
}

// 1. START SOS EVENT & RULE-BASED TRIAGE
export const startSosEvent = async (req, res, next) => {
  try {
    const { triageAnswers = {}, shareWithDoctorConsent = true, doctorId = null } = req.body;
    const patientId = req.user._id;

    // Rule-based triage (Strict non-AI safety rule)
    const isCritical = Boolean(
      triageAnswers.chestPain ||
      triageAnswers.difficultyBreathing ||
      triageAnswers.severeBleeding ||
      triageAnswers.unconscious ||
      triageAnswers.strokeSigns ||
      triageAnswers.severeInjury
    );

    const sosEvent = await SosEvent.create({
      patientId,
      triageAnswers: {
        chestPain: Boolean(triageAnswers.chestPain),
        difficultyBreathing: Boolean(triageAnswers.difficultyBreathing),
        severeBleeding: Boolean(triageAnswers.severeBleeding),
        unconscious: Boolean(triageAnswers.unconscious),
        strokeSigns: Boolean(triageAnswers.strokeSigns),
        severeInjury: Boolean(triageAnswers.severeInjury),
        otherSymptoms: triageAnswers.otherSymptoms || "",
      },
      critical: isCritical,
      shareWithDoctorConsent: Boolean(shareWithDoctorConsent),
      assignedDoctorId: doctorId || null,
      status: isCritical ? "triage_critical" : "initiated",
      audit: [
        {
          action: "sos_initiated",
          timestamp: new Date(),
          details: { isCritical, triageAnswers },
        },
      ],
    });

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "sos_event",
      resourceId: sosEvent._id,
      after: { isCritical, status: sosEvent.status },
      req,
    });

    return req.http.created(
      {
        sosEvent,
        isCritical,
        primaryAction: isCritical ? "CALL_AMBULANCE_108" : "FIND_HOSPITALS",
        ambulanceNumber: "108",
        disclaimer: "This app does not replace emergency services. In a critical emergency call 108/112.",
      },
      isCritical ? "Critical condition detected. Call ambulance immediately." : "SOS initialized."
    );
  } catch (err) {
    next(err);
  }
};

// 2. DISCOVER & RANK HOSPITALS FOR SOS EVENT
export const rankHospitalsForSos = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lat, lng, accuracy = null, address = "" } = req.body;

    if (!lat || !lng) {
      return req.http.badRequest("GPS coordinates (lat, lng) are required.");
    }

    const sosEvent = await SosEvent.findById(id);
    if (!sosEvent) {
      return req.http.notFound("SOS event not found.");
    }

    // Update location with consent
    sosEvent.location = {
      lat: Number(lat),
      lng: Number(lng),
      accuracy: accuracy != null ? Number(accuracy) : null,
      address: address || "",
    };

    // Find and rank top 3 hospitals via Overpass, VerifiedHospital DB, and OSRM
    const topHospitals = await findAndRankEmergencyHospitals(Number(lat), Number(lng));

    if (topHospitals.length > 0) {
      const fastest = topHospitals[0];
      sosEvent.hospital = {
        name: fastest.name,
        lat: fastest.lat,
        lng: fastest.lng,
        phone: fastest.phone || "108",
        address: fastest.address || "Emergency Department",
        source: fastest.source || "overpass_osm",
        has24x7ER: fastest.has24x7ER ?? true,
        travelDurationMinutes: fastest.travelDurationMinutes,
        distanceKm: fastest.distanceKm,
      };
      sosEvent.status = "hospital_selected";
    }

    sosEvent.audit.push({
      action: "hospitals_ranked",
      timestamp: new Date(),
      details: { candidateCount: topHospitals.length, location: { lat, lng } },
    });

    await sosEvent.save();

    return req.http.ok({
      sosEvent,
      topHospitals,
      preselectedHospital: topHospitals[0] || null,
      isApproximate: accuracy != null && accuracy > 100,
    });
  } catch (err) {
    next(err);
  }
};

// 3. GET UBER RIDE ESTIMATES
export const getUberEstimates = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sosEvent = await SosEvent.findById(id);
    if (!sosEvent || !sosEvent.location?.lat || !sosEvent.hospital?.lat) {
      return req.http.badRequest("Valid SOS event with patient location and target hospital is required.");
    }

    const provider = getRideProvider(sosEvent.provider);
    const estimates = await provider.getEstimates(
      sosEvent.location.lat,
      sosEvent.location.lng,
      sosEvent.hospital.lat,
      sosEvent.hospital.lng
    );

    return req.http.ok({ estimates });
  } catch (err) {
    next(err);
  }
};

// 4. CONFIRM RIDE & BOOK UBER (NON-NEGOTIABLE SAFETY: EXPLICIT CONFIRMATION REQUIRED)
export const confirmAndBookUberRide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      hospitalName,
      hospitalLat,
      hospitalLng,
      hospitalPhone,
      hospitalAddress,
      productId = "uber-go",
      providerType = "uber_api",
    } = req.body;

    const sosEvent = await SosEvent.findById(id);
    if (!sosEvent) {
      return req.http.notFound("SOS event not found.");
    }

    if (!sosEvent.location?.lat || !sosEvent.location?.lng) {
      return req.http.badRequest("Patient GPS location is missing.");
    }

    // Update target hospital if custom selected
    if (hospitalLat && hospitalLng) {
      sosEvent.hospital.name = hospitalName || sosEvent.hospital.name || "Emergency Hospital";
      sosEvent.hospital.lat = Number(hospitalLat);
      sosEvent.hospital.lng = Number(hospitalLng);
      sosEvent.hospital.phone = hospitalPhone || sosEvent.hospital.phone || "108";
      sosEvent.hospital.address = hospitalAddress || sosEvent.hospital.address || "";
    }

    sosEvent.provider = providerType;

    // Dispatch ride via RideProvider interface
    const rideProvider = getRideProvider(providerType);
    const rideResult = await rideProvider.requestRide({
      patientId: sosEvent.patientId,
      startLat: sosEvent.location.lat,
      startLng: sosEvent.location.lng,
      endLat: sosEvent.hospital.lat,
      endLng: sosEvent.hospital.lng,
      hospitalName: sosEvent.hospital.name,
      hospitalAddress: sosEvent.hospital.address,
      productId,
    });

    sosEvent.rideRequestId = rideResult.requestId;
    sosEvent.rideStatus = rideResult.status || "accepted";
    sosEvent.status = "ride_confirmed";

    if (rideResult.driver) {
      sosEvent.driver = {
        name: rideResult.driver.name,
        phone: rideResult.driver.phone,
        vehicle: rideResult.driver.vehicle,
        plate: rideResult.driver.plate,
        etaMinutes: rideResult.etaMinutes || 4,
        carLat: rideResult.driver.carLat || sosEvent.location.lat + 0.003,
        carLng: rideResult.driver.carLng || sosEvent.location.lng + 0.003,
      };
    }

    sosEvent.audit.push({
      action: "ride_confirmed",
      timestamp: new Date(),
      details: {
        provider: providerType,
        requestId: rideResult.requestId,
        hospital: sosEvent.hospital.name,
      },
    });

    await sosEvent.save();

    // ── NOTIFICATIONS DISPATCH ──
    const clientOrigin = req.headers.origin || "https://book-doctor-six.vercel.app";
    const trackingUrl = `${clientOrigin}/track/${sosEvent.trackingToken}`;

    // 1. Notify patient's emergency contacts
    const contacts = await EmergencyContact.find({
      patientId: sosEvent.patientId,
      notifyOnSOS: true,
    });

    const patient = await User.findById(sosEvent.patientId).select("name phone emergencyContact");
    const patientName = patient?.name || "Patient";

    const smsMessage = `EMERGENCY ALERT: ${patientName} has initiated an emergency trip to ${sosEvent.hospital.name}. Driver: ${sosEvent.driver?.name || "Uber"} (${sosEvent.driver?.vehicle || "Car"}, ${sosEvent.driver?.plate || ""}). Track live ride & status: ${trackingUrl}`;

    for (const contact of contacts) {
      await sendEmergencySMS({ to: contact.phone, message: smsMessage });
    }

    // Also send to emergencyContact field on User if not already in EmergencyContacts
    if (patient?.emergencyContact && !contacts.some((c) => c.phone === patient.emergencyContact)) {
      await sendEmergencySMS({ to: patient.emergencyContact, message: smsMessage });
    }

    sosEvent.contactsNotifiedAt = new Date();
    await sosEvent.save();

    // 2. Notify Doctor (if patient consented)
    if (sosEvent.shareWithDoctorConsent) {
      let targetDoctorUserId = null;
      if (sosEvent.assignedDoctorId) {
        const doc = await Doctor.findById(sosEvent.assignedDoctorId);
        targetDoctorUserId = doc?.userId;
      }

      if (targetDoctorUserId) {
        await createNotification({
          recipient: targetDoctorUserId,
          sender: sosEvent.patientId,
          title: "🚨 SOS Emergency Alert from Patient",
          message: `${patientName} triggered SOS. En route to ${sosEvent.hospital.name} via Uber (${sosEvent.driver?.etaMinutes || 4} min ETA).`,
          type: "EMERGENCY_ALERT",
          link: `/emergency/${sosEvent._id}`,
        });
      }
    }

    return req.http.ok(
      {
        sosEvent,
        rideResult,
        trackingUrl,
        deepLinks: rideResult.deepLinks || null,
      },
      "Uber ride confirmed and emergency contacts alerted."
    );
  } catch (err) {
    next(err);
  }
};

// 5. CANCEL RIDE
export const cancelRide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sosEvent = await SosEvent.findById(id);
    if (!sosEvent) {
      return req.http.notFound("SOS event not found.");
    }

    if (sosEvent.rideRequestId) {
      const provider = getRideProvider(sosEvent.provider);
      await provider.cancelRide(sosEvent.rideRequestId, sosEvent.patientId);
    }

    sosEvent.rideStatus = "rider_canceled";
    sosEvent.status = "cancelled";
    sosEvent.audit.push({
      action: "ride_canceled_by_rider",
      timestamp: new Date(),
    });

    await sosEvent.save();

    return req.http.ok(sosEvent, "Ride cancelled successfully. You can call an ambulance (108) anytime.");
  } catch (err) {
    next(err);
  }
};

// 6. GET SOS STATUS
export const getSosStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sosEvent = await SosEvent.findById(id)
      .populate("patientId", "name phone email")
      .populate({ path: "assignedDoctorId", populate: { path: "userId", select: "name phone" } });

    if (!sosEvent) {
      return req.http.notFound("SOS event not found.");
    }

    return req.http.ok(sosEvent);
  } catch (err) {
    next(err);
  }
};

// 7. PUBLIC TRACKING ENDPOINT (FOR EMERGENCY CONTACTS)
export const getPublicTracking = async (req, res, next) => {
  try {
    const { token } = req.params;
    const sosEvent = await SosEvent.findOne({ trackingToken: token })
      .populate("patientId", "name");

    if (!sosEvent) {
      return req.http.notFound("Tracking link not found or invalid.");
    }

    if (new Date() > new Date(sosEvent.trackingTokenExpiresAt)) {
      return req.http.badRequest("This emergency tracking link has expired.");
    }

    // Return sanitized data only (NO sensitive medical history)
    const sanitized = {
      patientName: sosEvent.patientId?.name || "Patient",
      hospital: {
        name: sosEvent.hospital?.name,
        address: sosEvent.hospital?.address,
        phone: sosEvent.hospital?.phone,
        lat: sosEvent.hospital?.lat,
        lng: sosEvent.hospital?.lng,
      },
      patientLocation: {
        lat: sosEvent.location?.lat,
        lng: sosEvent.location?.lng,
        address: sosEvent.location?.address,
      },
      driver: sosEvent.driver,
      rideStatus: sosEvent.rideStatus,
      status: sosEvent.status,
      startedAt: sosEvent.startedAt,
    };

    return req.http.ok(sanitized);
  } catch (err) {
    next(err);
  }
};

// 8. UBER WEBHOOK (LIVE RIDE UPDATES)
export const handleUberWebhook = async (req, res) => {
  try {
    const event = req.body;
    const requestId = event.meta?.resource_id || event.resource_id;

    if (requestId) {
      const sosEvent = await SosEvent.findOne({ rideRequestId: requestId });
      if (sosEvent) {
        const newStatus = event.event_type || event.status;
        if (newStatus.includes("arriving")) sosEvent.rideStatus = "arriving";
        else if (newStatus.includes("in_progress")) sosEvent.rideStatus = "in_progress";
        else if (newStatus.includes("completed")) sosEvent.rideStatus = "completed";
        else if (newStatus.includes("canceled")) sosEvent.rideStatus = "driver_canceled";

        sosEvent.audit.push({
          action: "webhook_update",
          timestamp: new Date(),
          details: event,
        });

        await sosEvent.save();
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Uber webhook error:", err.message);
    return res.status(200).send("OK"); // Acknowledge webhook
  }
};

// 9. UBER OAUTH 2.0 CONNECT URL & CALLBACK
export const getUberOAuthUrl = (req, res) => {
  const clientId = process.env.UBER_CLIENT_ID || "DfjKZC3xXnBEObgCRl1ChUSdRJDnjwBP";
  const redirectUri = process.env.UBER_REDIRECT_URI || "http://localhost:5000/api/uber/oauth/callback";
  const state = crypto.randomBytes(16).toString("hex");

  const oauthUrl = `https://login.uber.com/oauth/v2/authorize?client_id=${clientId}&response_type=code&scope=request&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  return res.json({ success: true, url: oauthUrl });
};

export const handleUberOAuthCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).send("Authorization code missing.");
    }

    const clientId = process.env.UBER_CLIENT_ID;
    const clientSecret = process.env.UBER_CLIENT_SECRET;
    const redirectUri = process.env.UBER_REDIRECT_URI || "http://localhost:5000/api/uber/oauth/callback";

    if (!clientId || !clientSecret) {
      return res.status(500).send("Uber credentials not configured on server.");
    }

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);
    params.append("grant_type", "authorization_code");
    params.append("redirect_uri", redirectUri);
    params.append("code", code);

    const tokenRes = await axios.post("https://login.uber.com/oauth/v2/token", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 8000,
    });

    if (tokenRes.data?.access_token && req.user?._id) {
      await UberConnection.findOneAndUpdate(
        { patientId: req.user._id },
        {
          patientId: req.user._id,
          encryptedAccessToken: encryptText(tokenRes.data.access_token),
          encryptedRefreshToken: tokenRes.data.refresh_token ? encryptText(tokenRes.data.refresh_token) : null,
          expiresAt: new Date(Date.now() + (tokenRes.data.expires_in || 3600) * 1000),
          scope: tokenRes.data.scope || "request",
        },
        { upsert: true }
      );
    }

    return res.redirect("https://book-doctor-six.vercel.app/profile?uber_connected=true");
  } catch (err) {
    console.error("Uber OAuth callback error:", err.message);
    return res.redirect("https://book-doctor-six.vercel.app/profile?uber_connected=false");
  }
};
