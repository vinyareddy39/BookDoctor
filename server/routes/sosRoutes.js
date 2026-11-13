import express from "express";
import {
  startSosEvent,
  rankHospitalsForSos,
  getUberEstimates,
  confirmAndBookUberRide,
  cancelRide,
  getSosStatus,
  getPublicTracking,
  handleUberWebhook,
  getUberOAuthUrl,
  handleUberOAuthCallback,
} from "../controllers/sosController.js";
import { dispatchSosAlert } from "../controllers/sosAlertController.js";
import { auth } from "../middleware/index.js";
import { emergencyLimiter, smsPerDeviceLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// ── Server-sent SMS Alerts Endpoint (max 10/hr per device, max 5 recipients, template-bounded) ──
router.post("/alert", auth, smsPerDeviceLimiter, dispatchSosAlert);

// ── Patient SOS Emergency Workflow ──
router.post("/start", emergencyLimiter, auth, startSosEvent);
router.post("/:id/hospitals", emergencyLimiter, auth, rankHospitalsForSos);
router.post("/:id/ride/estimate", auth, getUberEstimates);
router.post("/:id/ride/confirm", emergencyLimiter, auth, confirmAndBookUberRide);
router.delete("/:id/ride", auth, cancelRide);
router.get("/:id/status", auth, getSosStatus);

// ── Public Expiring Live Tracking (for Emergency Contacts) ──
router.get("/track/:token", getPublicTracking);

// ── Uber Webhooks & OAuth ──
router.post("/webhooks/uber", handleUberWebhook);
router.get("/uber/oauth/url", auth, getUberOAuthUrl);
router.get("/uber/oauth/callback", handleUberOAuthCallback);

export default router;
