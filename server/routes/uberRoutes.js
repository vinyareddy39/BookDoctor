import express from "express";
import crypto from "crypto";
import axios from "axios";
import UberConnection from "../models/UberConnection.js";
import { encryptText, decryptText } from "../services/cryptoService.js";
import { auth } from "../middleware/index.js";
import { emergencyLimiter } from "../middleware/rateLimiter.js";
import { getRouteAndETA } from "../utils/routing.js";

const router = express.Router();

export function isUberSimulationAllowed() {
  return (
    process.env.ALLOW_UBER_SIMULATION === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

/**
 * Resolves Uber environment and base URL dynamically from UBER_ENV=sandbox|production.
 * Defaults to "sandbox".
 */
export function getUberConfig() {
  const rawEnv = (process.env.UBER_ENV || "").trim().toLowerCase();
  const uberEnv = rawEnv === "production" ? "production" : "sandbox";
  const isSandbox = uberEnv !== "production" && process.env.UBER_SANDBOX !== "false";
  const baseUrl =
    uberEnv === "production" && isSandbox === false
      ? "https://api.uber.com/v1.2"
      : "https://sandbox-api.uber.com/v1.2";

  return {
    uberEnv: isSandbox ? "sandbox" : "production",
    isSandbox,
    baseUrl,
    redirectUri: process.env.UBER_REDIRECT_URI || "",
    simulationAllowed: isUberSimulationAllowed(),
  };
}

function isUberAuthError(err) {
  const status = err?.response?.status;
  const title = err?.response?.data?.errors?.[0]?.title || "";
  const msg = err?.response?.data?.message || err?.message || "";
  const combined = `${title} ${msg}`.toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    combined.includes("not authorized") ||
    combined.includes("not authorised") ||
    combined.includes("unauthorized") ||
    combined.includes("forbidden") ||
    combined.includes("developer")
  );
}

/**
 * Token manager: Retrieves and auto-refreshes ONLY the requesting user's connected UberConnection token.
 * Never falls back to server client_credentials and never logs tokens or secrets.
 */
async function getUserUberToken(userId) {
  const clientId = process.env.UBER_CLIENT_ID;
  const clientSecret = process.env.UBER_CLIENT_SECRET;

  if (userId) {
    const conn = await UberConnection.findOne({ patientId: userId });
    if (conn && conn.encryptedAccessToken) {
      try {
        const decrypted = decryptText(conn.encryptedAccessToken);
        if (conn.expiresAt && new Date() < new Date(conn.expiresAt)) {
          return { token: decrypted, source: "user_oauth" };
        }

        // Token expired: attempt refresh
        if (conn.encryptedRefreshToken && clientId && clientSecret) {
          const refreshToken = decryptText(conn.encryptedRefreshToken);
          const params = new URLSearchParams();
          params.append("client_id", clientId);
          params.append("client_secret", clientSecret);
          params.append("grant_type", "refresh_token");
          params.append("refresh_token", refreshToken);

          const res = await axios.post("https://login.uber.com/oauth/v2/token", params, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 8000,
          });

          if (res.data?.access_token) {
            conn.encryptedAccessToken = encryptText(res.data.access_token);
            if (res.data.refresh_token) {
              conn.encryptedRefreshToken = encryptText(res.data.refresh_token);
            }
            conn.expiresAt = new Date(Date.now() + (res.data.expires_in || 3600) * 1000);
            await conn.save();
            return { token: res.data.access_token, source: "user_oauth" };
          }
        }
      } catch (err) {
        console.warn("[UberAPI] Token decrypt/refresh notice:", err.message);
      }
    }
  }

  return { token: null, source: "none" };
}

// 1. GET /api/uber/connect -> Generates OAuth URL
router.get("/connect", auth, (req, res) => {
  const { uberEnv, isSandbox, redirectUri } = getUberConfig();
  const clientId = process.env.UBER_CLIENT_ID;

  if (!redirectUri) {
    return res.status(500).json({
      success: false,
      error: "UBER_REDIRECT_URI is not configured on the server. Set it in server/.env and save the exact same URI in the Uber Developer Dashboard.",
    });
  }

  if (!clientId) {
    return res.status(500).json({
      success: false,
      error: "UBER_CLIENT_ID is not configured on the server.",
    });
  }

  const state = `${req.user._id.toString()}_${crypto.randomBytes(8).toString("hex")}`;

  const oauthUrl = `https://login.uber.com/oauth/v2/authorize?client_id=${encodeURIComponent(
    clientId
  )}&response_type=code&scope=request&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  return res.json({
    success: true,
    url: oauthUrl,
    uberEnv,
    isSandbox,
    redirectUri,
  });
});

// 2. GET /api/uber/callback -> Handles OAuth Redirect & Encrypts Tokens
router.get("/callback", async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) {
      return res.redirect(`rapidcare-sos://uber-connected?status=failed&reason=${encodeURIComponent(String(oauthError))}`);
    }
    if (!code) {
      return res.status(400).send("Missing OAuth authorization code.");
    }

    const { redirectUri } = getUberConfig();
    const userId = state ? String(state).split("_")[0] : null;
    const clientId = process.env.UBER_CLIENT_ID;
    const clientSecret = process.env.UBER_CLIENT_SECRET;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).send("Uber credentials or UBER_REDIRECT_URI unconfigured on server.");
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

    if (tokenRes.data?.access_token && userId) {
      await UberConnection.findOneAndUpdate(
        { patientId: userId },
        {
          patientId: userId,
          encryptedAccessToken: encryptText(tokenRes.data.access_token),
          encryptedRefreshToken: tokenRes.data.refresh_token ? encryptText(tokenRes.data.refresh_token) : null,
          expiresAt: new Date(Date.now() + (tokenRes.data.expires_in || 3600) * 1000),
          scope: tokenRes.data.scope || "request",
        },
        { upsert: true }
      );
    }

    return res.redirect("rapidcare-sos://uber-connected?status=success");
  } catch (err) {
    console.error("[UberOAuthCallback] Error:", err.message);
    return res.redirect("rapidcare-sos://uber-connected?status=failed");
  }
});

// 3. POST /api/uber/estimate -> Gets products & ride estimate (returns fare_id and fare)
router.post("/estimate", auth, async (req, res) => {
  try {
    const { pickup, dropoff } = req.body;
    if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
      return res.status(400).json({ success: false, error: "Missing pickup or dropoff coordinates" });
    }

    const { baseUrl, uberEnv, isSandbox, simulationAllowed } = getUberConfig();
    const { token } = await getUserUberToken(req.user._id);

    if (token) {
      try {
        const estRes = await axios.post(
          `${baseUrl}/requests/estimate`,
          {
            start_latitude: Number(pickup.lat),
            start_longitude: Number(pickup.lng),
            end_latitude: Number(dropoff.lat),
            end_longitude: Number(dropoff.lng),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 7000,
          }
        );

        if (estRes.data) {
          const fareObj = estRes.data.fare || {};
          const tripObj = estRes.data.trip || {};
          return res.json({
            success: true,
            source: isSandbox ? "uber-sandbox" : "uber-production",
            isSimulated: false,
            uberEnv,
            isSandbox,
            fare_id: fareObj.fare_id || `fare_${Date.now()}`,
            fare: fareObj.display || `₹${Math.round(fareObj.value || 120)}`,
            currency_code: fareObj.currency_code || "INR",
            estimated_duration_minutes: Math.round((tripObj.duration_estimate || 480) / 60),
            distance_km: parseFloat(((tripObj.distance_estimate || 4000) / 1000).toFixed(1)),
            product_id: estRes.data.pickup_estimate?.product_id || "uber-go",
          });
        }
      } catch (uberApiErr) {
        console.warn("[UberAPI] Estimates API notice:", uberApiErr.message);
        if (isUberAuthError(uberApiErr)) {
          return res.status(403).json({
            success: false,
            code: "UBER_DEVELOPER_ACCESS_LIMITED",
            shouldFallbackDeepLink: true,
            isSimulated: false,
            uberEnv,
            error: "Uber account is not authorised or not registered as a developer account.",
          });
        }
        if (!simulationAllowed) {
          return res.status(503).json({
            success: false,
            code: "UBER_API_ERROR",
            shouldFallbackDeepLink: true,
            isSimulated: false,
            uberEnv,
            error: "Uber estimate service unavailable. Use deep link fallback or call 108/112.",
          });
        }
      }
    }

    if (!simulationAllowed) {
      return res.status(503).json({
        success: false,
        code: "UBER_NOT_CONNECTED",
        shouldFallbackDeepLink: true,
        isSimulated: false,
        uberEnv,
        error: "Uber account is not connected. Connect Uber or use the Uber app deep link / call 108 or 112.",
      });
    }

    // Local simulation rate card calculation (ONLY when ALLOW_UBER_SIMULATION=true && NODE_ENV !== "production")
    const route = await getRouteAndETA(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const distKm = parseFloat((route.distanceKm || 3.5).toFixed(1));
    const durMins = Math.max(3, Math.round(route.durationMinutes || 8));
    const estFare = Math.round(50 + distKm * 14.5);

    return res.json({
      success: true,
      source: "local-simulation",
      isSimulated: true,
      uberEnv,
      isSandbox,
      fare_id: `fare_est_${Date.now()}`,
      fare: `₹${estFare} - ₹${estFare + 30}`,
      currency_code: "INR",
      estimated_duration_minutes: durMins,
      distance_km: distKm,
      product_id: "uber-go",
      isFallbackEstimate: true,
    });
  } catch (err) {
    console.error("[UberEstimate] Error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST /api/uber/request -> Creates the ride
router.post("/request", emergencyLimiter, auth, async (req, res) => {
  try {
    const { pickup, dropoff, fare_id, product_id } = req.body;

    if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
      return res.status(400).json({ success: false, error: "Missing ride coordinates" });
    }

    const { baseUrl, uberEnv, isSandbox, simulationAllowed } = getUberConfig();
    const { token } = await getUserUberToken(req.user._id);

    if (token) {
      try {
        const createRes = await axios.post(
          `${baseUrl}/requests`,
          {
            start_latitude: Number(pickup.lat),
            start_longitude: Number(pickup.lng),
            start_address: pickup.address || "My Current Location",
            end_latitude: Number(dropoff.lat),
            end_longitude: Number(dropoff.lng),
            end_address: dropoff.name || "Emergency Hospital",
            fare_id: fare_id || undefined,
            product_id: product_id || "uber-go",
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          }
        );

        if (createRes.data) {
          return res.status(201).json({
            success: true,
            source: isSandbox ? "uber-sandbox" : "uber-production",
            isSimulated: false,
            uberEnv,
            isSandbox,
            ride_id: createRes.data.request_id || createRes.data.id,
            status: createRes.data.status || "processing",
            driver: createRes.data.driver || null,
            vehicle: createRes.data.vehicle || null,
            eta: createRes.data.eta || 5,
          });
        }
      } catch (err) {
        const errorDetail = err.response?.data?.errors?.[0]?.title || err.response?.data?.message || err.message;
        console.warn("[UberAPI] Ride request failed:", errorDetail);

        if (isUberAuthError(err)) {
          return res.status(403).json({
            success: false,
            code: "UBER_DEVELOPER_ACCESS_LIMITED",
            shouldFallbackDeepLink: true,
            isSimulated: false,
            uberEnv,
            error:
              "Uber account is not authorised or not registered as a developer account. Opening Uber app deep link instead.",
          });
        }

        if (!simulationAllowed) {
          return res.status(502).json({
            success: false,
            code: "UBER_API_ERROR",
            shouldFallbackDeepLink: true,
            isSimulated: false,
            uberEnv,
            error: "Uber service unavailable right now. Opening Uber app deep link instead.",
          });
        }
      }
    }

    // If explicitly in production mode without a user OAuth token, preserve UBER_DEVELOPER_ACCESS_LIMITED or UBER_NOT_CONNECTED
    if (!simulationAllowed) {
      return res.status(503).json({
        success: false,
        code: "UBER_NOT_CONNECTED",
        shouldFallbackDeepLink: true,
        isSimulated: false,
        uberEnv,
        error:
          "Uber account is not connected for auto-booking. Opening Uber app deep link instead — or call 108/112.",
      });
    }

    // Local simulated ride request (ONLY when ALLOW_UBER_SIMULATION=true && NODE_ENV !== "production")
    const simulatedRideId = `uber_req_${Date.now()}`;
    return res.status(201).json({
      success: true,
      source: "local-simulation",
      uberEnv,
      isSandbox: true,
      ride_id: simulatedRideId,
      status: "accepted",
      driver: {
        name: "Rajesh Kumar (Simulated Driver)",
        phone: "Protected",
        rating: 4.9,
      },
      vehicle: {
        make: "Maruti Suzuki",
        model: "WagonR",
        license_plate: "TS 09 ER 1080",
      },
      eta: 4,
      isSimulated: true,
    });
  } catch (err) {
    console.error("[UberRequest] Error:", err.message);
    return res.status(500).json({
      success: false,
      shouldFallbackDeepLink: true,
      error: "Unexpected Uber dispatch error. Use deep link fallback.",
    });
  }
});

// 5. GET /api/uber/ride/:id -> Status, driver, vehicle, plate, ETA
router.get("/ride/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { baseUrl, uberEnv, isSandbox, simulationAllowed } = getUberConfig();
    const { token } = await getUserUberToken(req.user._id);

    if (token && !id.startsWith("uber_req_")) {
      try {
        const statusRes = await axios.get(`${baseUrl}/requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 6000,
        });

        if (statusRes.data) {
          const d = statusRes.data;
          return res.json({
            success: true,
            source: isSandbox ? "uber-sandbox" : "uber-production",
            isSimulated: false,
            uberEnv,
            ride_id: d.request_id || id,
            status: d.status,
            driver: d.driver || null,
            vehicle: d.vehicle || null,
            eta: d.eta || 5,
            location: d.location || null,
          });
        }
      } catch (err) {
        console.warn("[UberAPI] Ride status fetch notice:", err.message);
        if (!simulationAllowed) {
          return res.status(502).json({
            success: false,
            code: "UBER_API_ERROR",
            shouldFallbackDeepLink: true,
            isSimulated: false,
            error: "Unable to fetch Uber ride status.",
          });
        }
      }
    }

    if (!simulationAllowed) {
      return res.status(503).json({
        success: false,
        code: "UBER_NOT_CONNECTED",
        shouldFallbackDeepLink: true,
        isSimulated: false,
        uberEnv,
        error: "Uber account is not connected and simulation is disabled.",
      });
    }

    // Simulated status progress (ONLY when ALLOW_UBER_SIMULATION=true && NODE_ENV !== "production")
    return res.json({
      success: true,
      source: "local-simulation",
      uberEnv,
      ride_id: id,
      status: "arriving",
      driver: {
        name: "Rajesh Kumar (Simulated Driver)",
        phone: "Protected",
        rating: 4.9,
      },
      vehicle: {
        make: "Maruti Suzuki",
        model: "WagonR",
        license_plate: "TS 09 ER 1080",
      },
      eta: 3,
      isSimulated: true,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. DELETE /api/uber/ride/:id -> Cancel ride
router.delete("/ride/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { baseUrl, uberEnv, isSandbox, simulationAllowed } = getUberConfig();
    const { token } = await getUserUberToken(req.user._id);
    let canceledViaUber = false;

    if (token && !id.startsWith("uber_req_")) {
      try {
        await axios.delete(`${baseUrl}/requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 6000,
        });
        canceledViaUber = true;
      } catch (err) {
        console.warn("[UberAPI] Ride cancel notice:", err.message);
        if (!simulationAllowed) {
          return res.status(502).json({
            success: false,
            code: "UBER_API_ERROR",
            isSimulated: false,
            error: "Failed to cancel Uber ride via API.",
          });
        }
      }
    }

    if (!canceledViaUber && !simulationAllowed) {
      return res.status(503).json({
        success: false,
        code: "UBER_NOT_CONNECTED",
        shouldFallbackDeepLink: true,
        isSimulated: false,
        uberEnv,
        error: "Uber account is not connected and simulation is disabled.",
      });
    }

    const source = canceledViaUber
      ? isSandbox
        ? "uber-sandbox"
        : "uber-production"
      : "local-simulation";

    return res.json({
      success: true,
      source,
      isSimulated: !canceledViaUber,
      uberEnv,
      ride_id: id,
      status: "canceled",
      message: "Ride cancelled successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
