import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../server.js";
import { getUberConfig } from "../routes/uberRoutes.js";
import { renderSmsTemplate, TwilioSmsProvider } from "../services/smsProvider.js";

let mongoServer;
let jwtToken;

describe("Real-Device Readiness & Failure Handling API Tests", () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_min_16_chars";
    process.env.ENCRYPTION_SECRET =
      process.env.ENCRYPTION_SECRET || "bookdoctor_aes256_emergency_secret_key_32_bytes!";
    process.env.UBER_ENV = "sandbox";
    process.env.UBER_SANDBOX = "true";
    process.env.UBER_REDIRECT_URI = "http://192.168.1.15:5000/api/uber/callback";
    process.env.ENABLE_OUTBOUND_EMERGENCY_CALL = "false";

    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    process.env = originalEnv;
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("GET /api/health returns connectivity status without leaking secrets", async () => {
    const res = await request(app).get("/api/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe("ok");
    expect(res.body.uberEnv).toBe("sandbox");
    expect(res.body.uberRedirectConfigured).toBe(true);
    expect(res.body.outboundVoiceCallEnabled).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain("JWT_SECRET");
  });

  it("POST /api/auth/device-session issues a restricted device JWT", async () => {
    const res = await request(app).post("/api/auth/device-session").send({
      deviceId: "test-device-123456",
      name: "Device Tester",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.user.role).toBe("device");
    jwtToken = res.body.accessToken;
  });

  it("GET /api/uber/connect requires auth and returns configurable UBER_REDIRECT_URI", async () => {
    const unauth = await request(app).get("/api/uber/connect");
    expect(unauth.statusCode).toBe(401);

    process.env.UBER_CLIENT_ID = "test_client_id";
    const res = await request(app)
      .get("/api/uber/connect")
      .set("Authorization", `Bearer ${jwtToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.redirectUri).toBe("http://192.168.1.15:5000/api/uber/callback");
    expect(res.body.url).toContain(encodeURIComponent("http://192.168.1.15:5000/api/uber/callback"));
  });

  it("UBER_ENV switches cleanly between sandbox and production base URLs", () => {
    process.env.UBER_ENV = "sandbox";
    delete process.env.UBER_SANDBOX;
    expect(getUberConfig().baseUrl).toBe("https://sandbox-api.uber.com/v1.2");
    expect(getUberConfig().isSandbox).toBe(true);

    process.env.UBER_ENV = "production";
    expect(getUberConfig().baseUrl).toBe("https://api.uber.com/v1.2");
    expect(getUberConfig().isSandbox).toBe(false);

    // Restore sandbox
    process.env.UBER_ENV = "sandbox";
  });

  it("End-to-end Uber Sandbox API lifecycle: estimate -> request -> ride status -> cancel", async () => {
    delete process.env.UBER_CLIENT_ID;
    delete process.env.UBER_CLIENT_SECRET;

    process.env.ALLOW_UBER_SIMULATION = "true";
    try {
      const est = await request(app)
        .post("/api/uber/estimate")
        .set("Authorization", `Bearer ${jwtToken}`)
        .send({
          pickup: { lat: 17.4325, lng: 78.4071, address: "Banjara Hills" },
          dropoff: { lat: 17.4156, lng: 78.4132, name: "Apollo ER" },
        });

      expect(est.statusCode).toBe(200);
      expect(est.body.success).toBe(true);
      expect(est.body.fare_id).toBeDefined();
      expect(est.body.fare).toContain("₹");

      const reqRide = await request(app)
        .post("/api/uber/request")
        .set("Authorization", `Bearer ${jwtToken}`)
        .send({
          pickup: { lat: 17.4325, lng: 78.4071, address: "Banjara Hills" },
          dropoff: { lat: 17.4156, lng: 78.4132, name: "Apollo ER" },
          fare_id: est.body.fare_id,
          product_id: est.body.product_id,
        });

      expect(reqRide.statusCode).toBe(201);
      expect(reqRide.body.success).toBe(true);
      expect(reqRide.body.ride_id).toBeDefined();
      expect(reqRide.body.source).toBe("local-simulation");
      expect(reqRide.body.isSimulated).toBe(true);

      const rideStatus = await request(app)
        .get(`/api/uber/ride/${reqRide.body.ride_id}`)
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(rideStatus.statusCode).toBe(200);
      expect(rideStatus.body.status).toBeDefined();
      expect(rideStatus.body.vehicle.license_plate).toBeDefined();
      expect(rideStatus.body.source).toBe("local-simulation");
      expect(rideStatus.body.isSimulated).toBe(true);

      const cancelRes = await request(app)
        .delete(`/api/uber/ride/${reqRide.body.ride_id}`)
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(cancelRes.statusCode).toBe(200);
      expect(cancelRes.body.status).toBe("canceled");
      expect(cancelRes.body.source).toBe("local-simulation");
      expect(cancelRes.body.isSimulated).toBe(true);
    } finally {
      delete process.env.ALLOW_UBER_SIMULATION;
    }
  });

  it("UBER_ENV=production without user OAuth returns 503 UBER_NOT_CONNECTED + fallback flag", async () => {
    process.env.UBER_ENV = "production";
    process.env.UBER_SANDBOX = "false";

    const res = await request(app)
      .post("/api/uber/request")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({
        pickup: { lat: 17.4325, lng: 78.4071 },
        dropoff: { lat: 17.4156, lng: 78.4132, name: "Apollo ER" },
      });

    expect(res.statusCode).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("UBER_NOT_CONNECTED");
    expect(res.body.shouldFallbackDeepLink).toBe(true);
    expect(res.body.isSimulated).toBe(false);

    process.env.UBER_ENV = "sandbox";
    process.env.UBER_SANDBOX = "true";
  });

  it("POST /api/sos/alert dispatches in DevConsole mode without leaking phone numbers or body in logs", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.SMS_PROVIDER;

    const secretPhone = "+919988776611";
    const secretBody = "SOS - Confidential GPS ping";
    const capturedLogs = [];
    const spy = jest.spyOn(console, "log").mockImplementation((...args) => {
      capturedLogs.push(args.join(" "));
    });

    try {
      const res = await request(app)
        .post("/api/sos/alert")
        .set("Authorization", `Bearer ${jwtToken}`)
        .send({
          contacts: [{ name: "Dad", phone: secretPhone }],
          message: secretBody,
          messageType: "location",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.dispatchedCount).toBe(1);

      for (const line of capturedLogs) {
        expect(line).not.toContain(secretPhone);
        expect(line).not.toContain(secretBody);
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("TwilioSmsProvider returns clear trialUnverified error and triggers template rendering cleanly", async () => {
    process.env.SMS_TEMPLATE_HOSPITAL = "Alert ER: {{HOSPITAL_NAME}}";
    expect(renderSmsTemplate("hospital", { HOSPITAL_NAME: "Care ER" })).toBe("Alert ER: Care ER");

    const mockTwilioTrialFactory = () => ({
      messages: {
        create: async () => {
          const err = new Error("The number +919900000000 is unverified. Trial accounts cannot send messages to unverified numbers.");
          err.code = 21608;
          throw err;
        },
      },
    });

    const provider = new TwilioSmsProvider("AC_test", "auth_test", "+15005550006", mockTwilioTrialFactory);
    const out = await provider.sendSms("+919900000000", "Test");
    expect(out.success).toBe(false);
    expect(out.isTrialUnverified).toBe(true);
    expect(out.code).toBe(21608);
    expect(out.error).toContain("Twilio trial account limitation");
  });

  it("POST /api/emergency-call is disabled by default when ENABLE_OUTBOUND_EMERGENCY_CALL != 'true'", async () => {
    process.env.ENABLE_OUTBOUND_EMERGENCY_CALL = "false";

    const res = await request(app).post("/api/emergency-call").send({
      to: "+919849512453",
      hospitalName: "Apollo ER",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.disabled).toBe(true);
  });

  // ── Security Hardening Tests ─────────────────────────────────────────────

  it("POST /api/auth/device-session validates deviceId format (empty, too short, too long, invalid chars)", async () => {
    const invalidInputs = [
      "",
      "short",
      "a".repeat(65),
      "bad device id!",
    ];

    for (const badId of invalidInputs) {
      const res = await request(app).post("/api/auth/device-session").send({
        deviceId: badId,
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    }
  });

  it("device-role JWT gets 403 on patient, appointment, EMR, and auth profile routes", async () => {
    const restrictedRoutes = [
      "/api/patients",
      "/api/patients/me/timeline",
      "/api/appointments",
      "/api/emr/notes",
      "/api/auth/profile",
    ];

    for (const route of restrictedRoutes) {
      const res = await request(app)
        .get(route)
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("DEVICE_TOKEN_RESTRICTED");
    }
  });

  it("POST /api/sos/alert rejects more than 5 recipients per request", async () => {
    const tooManyContacts = Array.from({ length: 6 }, (_, i) => ({
      name: `Contact ${i + 1}`,
      phone: `+91000000000${i}`,
    }));

    const res = await request(app)
      .post("/api/sos/alert")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({
        contacts: tooManyContacts,
        messageType: "location",
        latitude: 17.385,
        longitude: 78.4867,
        address: "Hyderabad",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/5/);
  });

  it("POST /api/sos/alert rejects message bodies longer than configured template allows", async () => {
    const oversizedMessage = "X".repeat(250);

    const res = await request(app)
      .post("/api/sos/alert")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({
        contacts: [{ name: "Emergency Contact", phone: "+910000000001" }],
        messageType: "location",
        message: oversizedMessage,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/exceeds maximum allowed/i);
  });

  it("POST /api/uber/request returns source: 'uber-sandbox' and isSimulated: false when Uber sandbox API succeeds", async () => {
    const UberConnection = (await import("../models/UberConnection.js")).default;
    const { encryptText } = await import("../services/cryptoService.js");
    const axios = (await import("axios")).default;
    const jwt = (await import("jsonwebtoken")).default;

    process.env.UBER_ENV = "sandbox";
    process.env.UBER_SANDBOX = "true";

    const decoded = jwt.decode(jwtToken);
    expect(decoded?.id).toBeTruthy();

    await UberConnection.create({
      patientId: decoded.id,
      encryptedAccessToken: encryptText("mock_valid_uber_oauth_token"),
      encryptedRefreshToken: encryptText("mock_refresh"),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      scope: "request",
    });

    const originalPost = axios.post;
    const originalGet = axios.get;
    const originalDelete = axios.delete;

    axios.post = async (url) => {
      if (String(url).includes("sandbox-api.uber.com")) {
        return {
          data: {
            request_id: "real_sandbox_req_001",
            status: "processing",
            eta: 3,
          },
        };
      }
      return originalPost.apply(axios, arguments);
    };

    axios.get = async (url) => {
      if (String(url).includes("sandbox-api.uber.com")) {
        return {
          data: {
            request_id: "real_sandbox_req_001",
            status: "accepted",
            eta: 2,
            driver: { name: "Sandbox Driver", rating: 4.9, phone_number: "+15550000000" },
            vehicle: { make: "Toyota", model: "Prius", license_plate: "SBX-1234" },
          },
        };
      }
      return originalGet.apply(axios, arguments);
    };

    axios.delete = async (url) => {
      if (String(url).includes("sandbox-api.uber.com")) {
        return { status: 204, data: {} };
      }
      return originalDelete.apply(axios, arguments);
    };

    try {
      const reqRes = await request(app)
        .post("/api/uber/request")
        .set("Authorization", `Bearer ${jwtToken}`)
        .send({
          pickup: { lat: 17.385, lng: 78.4867, address: "Hyderabad" },
          dropoff: { lat: 17.4156, lng: 78.4347, name: "Apollo ER" },
          fare_id: "fare_sbx_test",
          product_id: "uber-go",
        });

      expect(reqRes.statusCode).toBe(201);
      expect(reqRes.body.source).toBe("uber-sandbox");
      expect(reqRes.body.isSimulated).toBe(false);
      expect(reqRes.body.ride_id).toBe("real_sandbox_req_001");

      const statusRes = await request(app)
        .get("/api/uber/ride/real_sandbox_req_001")
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(statusRes.statusCode).toBe(200);
      expect(statusRes.body.source).toBe("uber-sandbox");
      expect(statusRes.body.isSimulated).toBe(false);

      const cancelRes = await request(app)
        .delete("/api/uber/ride/real_sandbox_req_001")
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(cancelRes.statusCode).toBe(200);
      expect(cancelRes.body.source).toBe("uber-sandbox");
      expect(cancelRes.body.isSimulated).toBe(false);
    } finally {
      axios.post = originalPost;
      axios.get = originalGet;
      axios.delete = originalDelete;
      await UberConnection.deleteMany({ patientId: decoded.id });
    }
  });

  it("POST /api/sos/alert rate-limits per device after 10 requests per hour", async () => {
    const User = (await import("../models/User.js")).default;
    const jwt = (await import("jsonwebtoken")).default;
    const rateUser = await User.create({
      name: "SMS Limiter Test",
      email: "sos-rate-limit-sms-device-1@rapidcare.local",
      password: "mock_hashed_password_value_12345",
      role: "device",
    });
    const rateToken = jwt.sign(
      { id: rateUser._id, role: "device", scope: "device_sos" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    for (let i = 0; i < 10; i++) {
      const okRes = await request(app)
        .post("/api/sos/alert")
        .set("Authorization", `Bearer ${rateToken}`)
        .send({
          contacts: [{ name: "Test", phone: "+910000000001" }],
          messageType: "watchdog_failed",
        });
      expect(okRes.statusCode).toBe(200);
    }

    const blockedRes = await request(app)
      .post("/api/sos/alert")
      .set("Authorization", `Bearer ${rateToken}`)
      .send({
        contacts: [{ name: "Test", phone: "+910000000001" }],
        messageType: "watchdog_failed",
      });
    expect(blockedRes.statusCode).toBe(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.error).toMatch(/10\/hour/i);
  });

  // ── Final Hardening Pass: Simulation Safety, Token Policy, SMS Daily Caps ─

  it("Uber simulation is OFF by default and returns 503 UBER_NOT_CONNECTED without a fake ride", async () => {
    delete process.env.ALLOW_UBER_SIMULATION;
    process.env.UBER_ENV = "sandbox";

    const est = await request(app)
      .post("/api/uber/estimate")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({
        pickup: { lat: 17.4325, lng: 78.4071 },
        dropoff: { lat: 17.4156, lng: 78.4132, name: "Apollo ER" },
      });

    expect(est.statusCode).toBe(503);
    expect(est.body.success).toBe(false);
    expect(est.body.code).toBe("UBER_NOT_CONNECTED");
    expect(est.body.shouldFallbackDeepLink).toBe(true);
    expect(est.body.isSimulated).toBe(false);

    const reqRes = await request(app)
      .post("/api/uber/request")
      .set("Authorization", `Bearer ${jwtToken}`)
      .send({
        pickup: { lat: 17.4325, lng: 78.4071 },
        dropoff: { lat: 17.4156, lng: 78.4132, name: "Apollo ER" },
      });

    expect(reqRes.statusCode).toBe(503);
    expect(reqRes.body.success).toBe(false);
    expect(reqRes.body.code).toBe("UBER_NOT_CONNECTED");
    expect(reqRes.body.shouldFallbackDeepLink).toBe(true);
    expect(reqRes.body.ride_id).toBeUndefined();
  });

  it("Production environment NEVER simulates even when ALLOW_UBER_SIMULATION=true", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.ALLOW_UBER_SIMULATION = "true";

    try {
      const reqRes = await request(app)
        .post("/api/uber/request")
        .set("Authorization", `Bearer ${jwtToken}`)
        .send({
          pickup: { lat: 17.4325, lng: 78.4071 },
          dropoff: { lat: 17.4156, lng: 78.4132, name: "Apollo ER" },
        });

      expect(reqRes.statusCode).toBe(503);
      expect(reqRes.body.success).toBe(false);
      expect(reqRes.body.code).toBe("UBER_NOT_CONNECTED");
      expect(reqRes.body.isSimulated).toBe(false);
      expect(reqRes.body.ride_id).toBeUndefined();
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      delete process.env.ALLOW_UBER_SIMULATION;
    }
  });

  it("Device with no UberConnection cannot book using server client_credentials", async () => {
    delete process.env.ALLOW_UBER_SIMULATION;
    process.env.UBER_CLIENT_ID = "server_client_id";
    process.env.UBER_CLIENT_SECRET = "server_client_secret";

    const axios = (await import("axios")).default;
    const originalPost = axios.post;
    let oauthTokenEndpointCalled = false;

    axios.post = async (url) => {
      if (String(url).includes("login.uber.com/oauth/v2/token")) {
        oauthTokenEndpointCalled = true;
        return { data: { access_token: "should_never_be_used" } };
      }
      return originalPost.apply(axios, arguments);
    };

    try {
      const res = await request(app)
        .post("/api/uber/request")
        .set("Authorization", `Bearer ${jwtToken}`)
        .send({
          pickup: { lat: 17.4325, lng: 78.4071 },
          dropoff: { lat: 17.4156, lng: 78.4132, name: "Apollo ER" },
        });

      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe("UBER_NOT_CONNECTED");
      expect(oauthTokenEndpointCalled).toBe(false);
    } finally {
      axios.post = originalPost;
    }
  });

  it("Global SMS_DAILY_CAP logs 80% warning and returns 429 with fallbackRequired: true when reached", async () => {
    const { resetSmsDailyCaps } = await import("../middleware/rateLimiter.js");
    const User = (await import("../models/User.js")).default;
    const jwt = (await import("jsonwebtoken")).default;

    resetSmsDailyCaps();
    process.env.SMS_DAILY_CAP = "5";
    process.env.SMS_DEVICE_DAILY_CAP = "30";

    const warnings = [];
    const warnSpy = jest.spyOn(console, "warn").mockImplementation((...args) => {
      warnings.push(args.join(" "));
    });

    try {
      for (let i = 0; i < 5; i++) {
        const u = await User.create({
          name: `Cap Global ${i}`,
          email: `sos-cap-global-${i}-${Date.now()}@rapidcare.local`,
          password: "mock_hashed_password_12345",
          role: "device",
        });
        const tok = jwt.sign({ id: u._id, role: "device", scope: "device_sos" }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });
        const okRes = await request(app)
          .post("/api/sos/alert")
          .set("Authorization", `Bearer ${tok}`)
          .send({
            contacts: [{ name: "Test", phone: "+910000000001" }],
            messageType: "watchdog_failed",
          });
        expect(okRes.statusCode).toBe(200);
      }

      // 80% of 5 = 4 -> warning should have been logged
      expect(warnings.some((w) => w.includes("80%") && w.includes("SMS_DAILY_CAP"))).toBe(true);

      const u6 = await User.create({
        name: "Cap Global Blocked",
        email: `sos-cap-global-blocked-${Date.now()}@rapidcare.local`,
        password: "mock_hashed_password_12345",
        role: "device",
      });
      const tok6 = jwt.sign({ id: u6._id, role: "device", scope: "device_sos" }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      const blockedRes = await request(app)
        .post("/api/sos/alert")
        .set("Authorization", `Bearer ${tok6}`)
        .send({
          contacts: [{ name: "Test", phone: "+910000000001" }],
          messageType: "watchdog_failed",
        });

      expect(blockedRes.statusCode).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.fallbackRequired).toBe(true);
      expect(blockedRes.body.code).toBe("SMS_DAILY_CAP_REACHED");
    } finally {
      warnSpy.mockRestore();
      delete process.env.SMS_DAILY_CAP;
      delete process.env.SMS_DEVICE_DAILY_CAP;
      resetSmsDailyCaps();
    }
  });

  it("Per-device daily SMS cap returns 429 with fallbackRequired: true when reached", async () => {
    const { resetSmsDailyCaps } = await import("../middleware/rateLimiter.js");
    const User = (await import("../models/User.js")).default;
    const jwt = (await import("jsonwebtoken")).default;

    resetSmsDailyCaps();
    process.env.SMS_DAILY_CAP = "200";
    process.env.SMS_DEVICE_DAILY_CAP = "3";

    try {
      const u = await User.create({
        name: "Cap Device",
        email: `sos-cap-device-${Date.now()}@rapidcare.local`,
        password: "mock_hashed_password_12345",
        role: "device",
      });
      const tok = jwt.sign({ id: u._id, role: "device", scope: "device_sos" }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });

      for (let i = 0; i < 3; i++) {
        const okRes = await request(app)
          .post("/api/sos/alert")
          .set("Authorization", `Bearer ${tok}`)
          .send({
            contacts: [{ name: "Test", phone: "+910000000001" }],
            messageType: "watchdog_failed",
          });
        expect(okRes.statusCode).toBe(200);
      }

      const blockedRes = await request(app)
        .post("/api/sos/alert")
        .set("Authorization", `Bearer ${tok}`)
        .send({
          contacts: [{ name: "Test", phone: "+910000000001" }],
          messageType: "watchdog_failed",
        });

      expect(blockedRes.statusCode).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.fallbackRequired).toBe(true);
      expect(blockedRes.body.code).toBe("SMS_DEVICE_DAILY_CAP_REACHED");
    } finally {
      delete process.env.SMS_DAILY_CAP;
      delete process.env.SMS_DEVICE_DAILY_CAP;
      resetSmsDailyCaps();
    }
  });

  it("POST /api/auth/device-session rate-limits after 5 requests per hour", async () => {
    // Earlier tests already made 2 valid requests from 127.0.0.1.
    // Send up to 5 more until we hit 429 from deviceSessionIpLimiter.
    let hit429 = false;
    for (let i = 0; i < 6; i++) {
      const res = await request(app).post("/api/auth/device-session").send({
        deviceId: `rate-limit-ip-device-${i}`,
      });
      if (res.statusCode === 429) {
        hit429 = true;
        expect(res.body.success).toBe(false);
        break;
      }
    }
    expect(hit429).toBe(true);
  });
});
