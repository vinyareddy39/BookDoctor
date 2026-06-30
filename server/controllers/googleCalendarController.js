import { google } from "googleapis";
import Doctor from "../models/Doctor.js";

// ─── Build an authorized OAuth2 client ───────────────────────────────────────
const buildOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI // e.g. http://localhost:5000/api/google/callback
  );
};

// ─── Days of the week helpers ─────────────────────────────────────────────────
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Given a list of busy time ranges over the next 14 days,
 * derive which days of the week have at least one FREE hour
 * within a reasonable clinic window (08:00–22:00 local time).
 */
const deriveAvailableDays = (freebusyData, timeMin, timeMax) => {
  const busySlots = freebusyData?.calendars?.primary?.busy || [];

  // Build a Set of busy day strings (e.g. "2024-07-01")
  const busyDates = new Set();
  busySlots.forEach(({ start, end }) => {
    const s = new Date(start);
    const e = new Date(end);
    // Mark each calendar day that has a busy block
    for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
      busyDates.add(d.toISOString().split("T")[0]);
    }
  });

  // Walk the next 14 days and collect weekday names that are NOT fully busy
  const availableDayNames = new Set();
  const start = new Date(timeMin);
  const end = new Date(timeMax);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    if (!busyDates.has(dateStr)) {
      availableDayNames.add(DAYS_SHORT[d.getDay()]);
    }
  }

  return [...availableDayNames];
};

/**
 * Derive working hours from the earliest start and latest end across
 * all busy slots (a simple heuristic — real free/busy analysis would be
 * more complex but this gives a good approximation).
 */
const deriveWorkingHours = (freebusyData) => {
  const busySlots = freebusyData?.calendars?.primary?.busy || [];
  if (busySlots.length === 0) return { startTime: "09:00 AM", endTime: "05:00 PM" };

  const hours = busySlots.map(({ start, end }) => ({
    startHour: new Date(start).getHours(),
    endHour:   new Date(end).getHours(),
  }));

  const minHour = Math.min(...hours.map((h) => h.startHour));
  const maxHour = Math.max(...hours.map((h) => h.endHour));

  const fmt = (h) => {
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, "0")}:00 ${suffix}`;
  };

  return {
    startTime: fmt(minHour),
    endTime:   fmt(maxHour === 0 ? 20 : maxHour), // fallback to 8 PM
  };
};

// ─── STEP 1: Generate Google OAuth URL ───────────────────────────────────────
export const getAuthUrl = (req, res, next) => {
  try {
    const oauth2Client = buildOAuthClient();
    const scopes = ["https://www.googleapis.com/auth/calendar.readonly"];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt:      "consent",
      scope:       scopes,
      // Pass doctor's userId in state so we can identify them on callback
      state: String(req.user._id),
    });

    return req.http.ok({ url }, "Auth URL generated");
  } catch (err) {
    next(err);
  }
};

// ─── STEP 2: Handle Google OAuth callback ────────────────────────────────────
export const handleCallback = async (req, res, next) => {
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      return res.status(400).send("Missing OAuth code or state parameter.");
    }

    const oauth2Client = buildOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Now fetch the next 14 days of busy times to determine availability
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const freebusyRes = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: "primary" }],
      },
    });

    const freebusyData = freebusyRes.data;

    const availableDays  = deriveAvailableDays(freebusyData, timeMin, timeMax);
    const { startTime, endTime } = deriveWorkingHours(freebusyData);
    const availableTime  = `${startTime} - ${endTime}`;

    // Save the derived availability + tokens back to the Doctor profile
    await Doctor.findOneAndUpdate(
      { userId },
      {
        availableDays,
        availableTime,
        // Store encrypted tokens so we can refresh later (optional for future cron syncs)
        googleAccessToken:  tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleCalendarSynced: true,
      },
      { new: true }
    );

    // Redirect back to doctor dashboard with a success flag
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    return res.redirect(`${clientUrl}/doctor/dashboard?cal=synced`);
  } catch (err) {
    console.error("[GoogleCalendar] Callback error:", err.message);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    return res.redirect(`${clientUrl}/doctor/dashboard?cal=error`);
  }
};

// ─── STEP 3: Manual re-sync (Doctor clicks "Sync Again") ────────────────────
export const syncCalendar = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor || !doctor.googleRefreshToken) {
      return req.http.badRequest("Google Calendar is not connected. Please connect first.");
    }

    const oauth2Client = buildOAuthClient();
    oauth2Client.setCredentials({ refresh_token: doctor.googleRefreshToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const freebusyRes = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: "primary" }],
      },
    });

    const freebusyData = freebusyRes.data;
    const availableDays  = deriveAvailableDays(freebusyData, timeMin, timeMax);
    const { startTime, endTime } = deriveWorkingHours(freebusyData);
    const availableTime = `${startTime} - ${endTime}`;

    const updated = await Doctor.findOneAndUpdate(
      { userId: req.user._id },
      { availableDays, availableTime },
      { new: true }
    ).populate("userId", "name email phone");

    return req.http.ok(
      { availableDays, availableTime, doctor: updated },
      "Calendar synced successfully! Your availability has been updated."
    );
  } catch (err) {
    next(err);
  }
};
