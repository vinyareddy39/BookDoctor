import express from "express";
import { getAuthUrl, handleCallback, syncCalendar } from "../controllers/googleCalendarController.js";
import { auth, role } from "../middleware/index.js";

const router = express.Router();

// STEP 1 — Doctor requests the Google OAuth URL (returns the URL to redirect the browser to)
router.get("/auth-url", auth, role("doctor"), getAuthUrl);

// STEP 2 — Google redirects here after the doctor grants permission
// (No auth middleware — this is a public redirect from Google. userId is in req.query.state)
router.get("/callback", handleCallback);

// STEP 3 — Doctor clicks "Sync Again" from dashboard
router.post("/sync", auth, role("doctor"), syncCalendar);

export default router;
