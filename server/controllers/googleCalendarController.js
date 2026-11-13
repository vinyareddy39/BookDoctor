import { google } from "googleapis";
import Doctor from "../models/Doctor.js";

// ─── Build an authorized OAuth2 client ───────────────────────────────────────
const buildOAuthClient = (customRedirectUri) => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    customRedirectUri || process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/google/callback"
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

// ─── Resolve backend redirect URI helper ─────────────────────────────────────
const getRedirectUri = (req) => {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const host = req?.get ? req.get("host") : "localhost:5000";
  const isHttps =
    req?.protocol === "https" ||
    req?.headers?.["x-forwarded-proto"] === "https" ||
    (host && host.includes("onrender.com"));
  const protocol = isHttps ? "https" : "http";
  return `${protocol}://${host || "localhost:5000"}/api/google/callback`;
};

// ─── STEP 1: Generate Google OAuth URL ───────────────────────────────────────
export const getAuthUrl = (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = getRedirectUri(req);

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message:
          "Google Calendar OAuth is not configured on the server. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env.",
      });
    }

    const oauth2Client = buildOAuthClient(redirectUri);
    const scopes = ["https://www.googleapis.com/auth/calendar.readonly"];

    // Preserve the caller frontend URL so callback returns doctor to the right frontend (local or Vercel)
    let clientOrigin = process.env.CLIENT_URL || "http://localhost:5173";
    if (req.headers.referer) {
      try {
        clientOrigin = new URL(req.headers.referer).origin;
      } catch {}
    } else if (req.headers.origin) {
      clientOrigin = req.headers.origin;
    }

    const statePayload = Buffer.from(
      JSON.stringify({
        userId: String(req.user._id),
        clientOrigin,
        redirectUri,
      })
    ).toString("base64url");

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: scopes,
      state: statePayload,
    });

    return req.http.ok({ url }, "Auth URL generated");
  } catch (err) {
    next(err);
  }
};

// ─── STEP 2: Handle Google OAuth callback ────────────────────────────────────
export const handleCallback = async (req, res, next) => {
  try {
    const { code, state, error: oauthError } = req.query;

    let userId = null;
    let clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    let redirectUri = getRedirectUri(req);

    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(String(state), "base64url").toString("utf8"));
        if (decoded.userId) userId = decoded.userId;
        if (decoded.clientOrigin) clientUrl = decoded.clientOrigin;
        if (decoded.redirectUri) redirectUri = decoded.redirectUri;
      } catch {
        // Fallback if state is raw userId string
        userId = String(state);
      }
    }

    if (oauthError) {
      console.warn("[GoogleCalendar] OAuth rejected by user:", oauthError);
      return res.redirect(`${clientUrl}/doctor/dashboard?cal=error&reason=${encodeURIComponent(String(oauthError))}`);
    }

    if (!code || !userId) {
      return res.redirect(`${clientUrl}/doctor/dashboard?cal=error&reason=missing_code_or_user`);
    }

    const oauth2Client = buildOAuthClient(redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch the next 14 days of busy times to determine availability
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

    let availableDays = deriveAvailableDays(freebusyData, timeMin, timeMax);
    if (!availableDays || availableDays.length === 0) {
      availableDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    }

    const { startTime, endTime } = deriveWorkingHours(freebusyData);
    const availableTime = `${startTime} - ${endTime}`;

    // Build update payload without overwriting existing refresh token with null
    const updatePayload = {
      availableDays,
      availableTime,
      googleAccessToken: tokens.access_token,
      googleCalendarSynced: true,
    };
    if (tokens.refresh_token) {
      updatePayload.googleRefreshToken = tokens.refresh_token;
    }

    await Doctor.findOneAndUpdate({ userId }, updatePayload, { new: true });

    // Redirect back to doctor dashboard settings tab with success flag
    return res.redirect(`${clientUrl}/doctor/dashboard?cal=synced`);
  } catch (err) {
    console.error("[GoogleCalendar] Callback error:", err.message);
    const fallbackClientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    return res.redirect(`${fallbackClientUrl}/doctor/dashboard?cal=error`);
  }
};

// ─── STEP 3: Manual re-sync (Doctor clicks "Sync Again") ────────────────────
export const syncCalendar = async (req, res, next) => {
  try {
    // Explicitly select googleRefreshToken since it has select: false in schema
    const doctor = await Doctor.findOne({ userId: req.user._id }).select(
      "+googleRefreshToken +googleAccessToken"
    );

    if (!doctor || !doctor.googleRefreshToken) {
      return req.http.badRequest(
        "Google Calendar is not connected. Please click 'Connect Google Calendar' first."
      );
    }

    const redirectUri = getRedirectUri(req);
    const oauth2Client = buildOAuthClient(redirectUri);
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
    let availableDays = deriveAvailableDays(freebusyData, timeMin, timeMax);
    if (!availableDays || availableDays.length === 0) {
      availableDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    }

    const { startTime, endTime } = deriveWorkingHours(freebusyData);
    const availableTime = `${startTime} - ${endTime}`;

    const updated = await Doctor.findOneAndUpdate(
      { userId: req.user._id },
      { availableDays, availableTime, googleCalendarSynced: true },
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
