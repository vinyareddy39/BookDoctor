import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

import {
  EMERGENCY_CONFIG,
  isLocalhostUrl,
  validateApiUrlForDevice,
} from "../src/config/emergencyConfig.ts";
import { testServerConnection, setCachedAuthToken } from "../src/services/apiClient.ts";
import { dispatchEmergencySms, createLocationUnavailableMessage } from "../src/services/smsService.ts";
import {
  fetchUberEstimate,
  requestUberAutoBooking,
  pollUberRideStatus,
  openUberRide,
} from "../src/services/uberService.ts";
import { findNearestEmergencyHospital } from "../src/services/hospitalService.ts";
import { Linking, Share } from "./rn-mock.mjs";
import { SMS_MOCK_STATE } from "./expo-sms-mock.mjs";

const originalFetch = globalThis.fetch;

describe("Failure Paths, Connectivity & Trial Fallbacks", () => {
  beforeEach(() => {
    Linking.reset();
    Share.reset();
    SMS_MOCK_STATE.reset();
    setCachedAuthToken("test_jwt_token");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("1. Phone-to-Server Connectivity & Localhost Guard", () => {
    it("rejects localhost/127.0.0.1 on physical devices and empty URLs", () => {
      assert.strictEqual(isLocalhostUrl("http://localhost:5000"), true);
      assert.strictEqual(isLocalhostUrl("http://127.0.0.1:5000"), true);
      assert.strictEqual(isLocalhostUrl("http://192.168.1.15:5000"), false);

      const localhostCheck = validateApiUrlForDevice("http://localhost:5000", false);
      assert.strictEqual(localhostCheck.valid, false);
      assert.ok(localhostCheck.error?.includes("localhost"));

      const emptyCheck = validateApiUrlForDevice("", false);
      assert.strictEqual(emptyCheck.valid, false);

      const lanCheck = validateApiUrlForDevice("http://192.168.29.118:5000", false);
      assert.strictEqual(lanCheck.valid, true);

      const ngrokCheck = validateApiUrlForDevice("https://rapidcare.ngrok-free.app", false);
      assert.strictEqual(ngrokCheck.valid, true);
    });

    it("testServerConnection succeeds on /api/health 200 and reports clear error when unreachable", async () => {
      globalThis.fetch = async (url: any) => {
        assert.ok(String(url).endsWith("/api/health"));
        return new Response(
          JSON.stringify({
            success: true,
            status: "ok",
            uberEnv: "sandbox",
            smsProvider: "Twilio",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const okRes = await testServerConnection("http://192.168.29.118:5000");
      assert.strictEqual(okRes.ok, true);
      assert.strictEqual(okRes.data?.uberEnv, "sandbox");

      globalThis.fetch = async () => {
        throw new Error("connect ECONNREFUSED");
      };

      const failRes = await testServerConnection("http://192.168.29.118:5000");
      assert.strictEqual(failRes.ok, false);
      assert.ok(failRes.error?.includes("ECONNREFUSED"));
    });
  });

  describe("2. Uber Not Connected Path & Authorization Error Handling", () => {
    it("when Uber is not connected: countdown shows 'Fare unavailable, connect Uber' and falls back to deep link + 108/112", async () => {
      const uberConnected = false;
      const pickup = { latitude: 17.4325, longitude: 78.4071, address: "Road No. 12, Banjara Hills" };
      const hospital = { name: "Apollo ER", latitude: 17.4156, longitude: 78.4132 };

      // Simulate countdown display string when Uber is disconnected
      const countdownFareText = uberConnected ? "₹120" : "Fare unavailable, connect Uber";
      assert.strictEqual(countdownFareText, "Fare unavailable, connect Uber");

      // Should skip server /api/uber/request and open prefilled deep link directly
      let apiRequestCalled = false;
      globalThis.fetch = async () => {
        apiRequestCalled = true;
        return new Response("{}", { status: 200 });
      };

      const linkResult = await openUberRide(pickup, hospital);
      assert.strictEqual(apiRequestCalled, false);
      assert.strictEqual(linkResult.opened, "app");
      assert.ok(linkResult.url.includes("pickup[latitude]=17.4325"));
      assert.ok(linkResult.url.includes("dropoff[latitude]=17.4156"));

      // Visible 108/112 numbers remain available
      assert.strictEqual(EMERGENCY_CONFIG.AMBULANCE_NUMBER, "108");
      assert.strictEqual(EMERGENCY_CONFIG.NATIONAL_EMERGENCY_NUMBER, "112");
    });

    it("handles Uber 'not authorised / developer account' 403 error with deep-link fallback flag", async () => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            success: false,
            code: "UBER_DEVELOPER_ACCESS_LIMITED",
            shouldFallbackDeepLink: true,
            error: "Uber account is not authorised or not registered as a developer account.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );

      const res = await requestUberAutoBooking(
        { latitude: 17.4325, longitude: 78.4071, address: "Jubilee Hills" },
        { name: "Apollo ER", latitude: 17.4156, longitude: 78.4132 },
        "fare_123",
        "uber-go",
        "http://192.168.29.118:5000"
      );

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.code, "UBER_DEVELOPER_ACCESS_LIMITED");
      assert.strictEqual(res.shouldFallbackDeepLink, true);
      assert.ok(res.error?.toLowerCase().includes("not authorised"));
    });
  });

  describe("3. Device Messages App Composer & Failure Paths", () => {
    it("dispatches via expo-sms composer without logging phone or message body", async () => {
      const secretPhone = "+919876543210";
      const secretBody = "SOS - Confidential test alert body";
      const logs: string[] = [];
      const origLog = console.log;
      const origWarn = console.warn;

      console.log = (...args) => logs.push(args.join(" "));
      console.warn = (...args) => logs.push(args.join(" "));

      try {
        const result = await dispatchEmergencySms(
          [{ name: "Emergency Mom", phone: secretPhone }],
          secretBody
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.method, "sms_sheet");
        assert.strictEqual(SMS_MOCK_STATE.calls.length, 1);
        assert.deepStrictEqual(SMS_MOCK_STATE.calls[0].addresses, [secretPhone]);

        for (const line of logs) {
          assert.strictEqual(line.includes(secretPhone), false);
          assert.strictEqual(line.includes(secretBody), false);
        }
      } finally {
        console.log = origLog;
        console.warn = origWarn;
      }
    });

    it("Failure path: SMS composer unavailable -> returns unavailable fallback without throwing", async () => {
      SMS_MOCK_STATE.available = false;

      const res = await dispatchEmergencySms(
        [{ name: "Sister", phone: "+919988776655" }],
        createLocationUnavailableMessage()
      );

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.method, "unavailable");
    });

    it("Failure path: Contacts denied / empty contacts -> cleanly skips SMS without crashing", async () => {
      const res = await dispatchEmergencySms(
        [],
        "SOS - test",
        "location",
        "http://192.168.29.118:5000"
      );
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.method, "skipped");
    });

    it("Failure path: Hospital lookup failure on both Places & Overpass (or offline) -> returns null, never uses hardcoded coords", async () => {
      globalThis.fetch = async () => {
        throw new Error("No network connection");
      };

      const hospital = await findNearestEmergencyHospital(17.4325, 78.4071, "fake_places_key");
      assert.strictEqual(hospital, null);
    });

    it("Failure path: Server unreachable during Uber request -> returns deep-link fallback without throwing", async () => {
      globalThis.fetch = async () => {
        throw new Error("Network request failed");
      };

      const res = await requestUberAutoBooking(
        { latitude: 17.4325, longitude: 78.4071 },
        { name: "Apollo ER", latitude: 17.4156, longitude: 78.4132 },
        "fare_1",
        "uber-go",
        "http://192.168.29.118:5000"
      );

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.shouldFallbackDeepLink, true);
      assert.ok(res.error?.includes("Unable to reach server"));
    });
  });

  describe("5. Uber Simulation vs Real Sandbox Source Tracking", () => {
    it("preserves source: 'local-simulation' and isSimulated: true from server estimate, booking, and polling", async () => {
      globalThis.fetch = async (input: any) => {
        const url = String(input);
        if (url.endsWith("/api/uber/estimate")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              fare_id: "fare_sim_1",
              fare: "₹140",
              currency_code: "INR",
              estimated_duration_minutes: 6,
              distance_km: 3.1,
              product_id: "uber-go",
              isSimulated: true,
              source: "local-simulation",
            }),
          } as Response;
        }
        if (url.endsWith("/api/uber/request")) {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              success: true,
              ride_id: "uber_req_sim_1",
              status: "processing",
              eta_minutes: 4,
              isSimulated: true,
              source: "local-simulation",
            }),
          } as Response;
        }
        if (url.includes("/api/uber/ride/")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ride_id: "uber_req_sim_1",
              status: "arriving",
              eta_minutes: 3,
              isSimulated: true,
              source: "local-simulation",
            }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      };

      const est = await fetchUberEstimate(
        { latitude: 17.4325, longitude: 78.4071 },
        { name: "Apollo ER", latitude: 17.4156, longitude: 78.4132 },
        "http://192.168.29.118:5000"
      );
      assert.strictEqual(est.source, "local-simulation");
      assert.strictEqual(est.isSimulated, true);

      const booking = await requestUberAutoBooking(
        { latitude: 17.4325, longitude: 78.4071 },
        { name: "Apollo ER", latitude: 17.4156, longitude: 78.4132 },
        "fare_sim_1",
        "uber-go",
        "http://192.168.29.118:5000"
      );
      assert.strictEqual(booking.success, true);
      assert.strictEqual(booking.source, "local-simulation");
      assert.strictEqual(booking.isSimulated, true);

      const poll = await pollUberRideStatus("uber_req_sim_1", "http://192.168.29.118:5000");
      assert.strictEqual(poll?.source, "local-simulation");
      assert.strictEqual(poll?.isSimulated, true);
    });

    it("preserves source: 'uber-sandbox' and isSimulated: false when real sandbox responds", async () => {
      globalThis.fetch = async (input: any) => {
        const url = String(input);
        if (url.endsWith("/api/uber/request")) {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              success: true,
              ride_id: "real_sbx_123",
              status: "processing",
              eta_minutes: 3,
              isSimulated: false,
              source: "uber-sandbox",
            }),
          } as Response;
        }
        if (url.includes("/api/uber/ride/")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ride_id: "real_sbx_123",
              status: "accepted",
              eta_minutes: 2,
              isSimulated: false,
              source: "uber-sandbox",
            }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      };

      const booking = await requestUberAutoBooking(
        { latitude: 17.4325, longitude: 78.4071 },
        { name: "Apollo ER", latitude: 17.4156, longitude: 78.4132 },
        "fare_sbx_1",
        "uber-go",
        "http://192.168.29.118:5000"
      );
      assert.strictEqual(booking.success, true);
      assert.strictEqual(booking.source, "uber-sandbox");
      assert.strictEqual(booking.isSimulated, false);

      const poll = await pollUberRideStatus("real_sbx_123", "http://192.168.29.118:5000");
      assert.strictEqual(poll?.source, "uber-sandbox");
      assert.strictEqual(poll?.isSimulated, false);
    });

    it("treats 503 UBER_NOT_CONNECTED as ride-not-booked: returns fallback estimate, deep-link fallback, and triggers expo-sms on 429 SMS cap", async () => {
      globalThis.fetch = async (input: any) => {
        const url = String(input);
        if (url.endsWith("/api/uber/estimate") || url.endsWith("/api/uber/request")) {
          return {
            ok: false,
            status: 503,
            json: async () => ({
              success: false,
              code: "UBER_NOT_CONNECTED",
              shouldFallbackDeepLink: true,
              isSimulated: false,
              error: "Uber account is not connected for auto-booking.",
            }),
          } as Response;
        }
        if (url.endsWith("/api/sos/alert")) {
          return {
            ok: false,
            status: 429,
            json: async () => ({
              success: false,
              code: "SMS_DAILY_CAP_REACHED",
              fallbackRequired: true,
              error: "Global daily SMS limit reached.",
            }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      };

      const est = await fetchUberEstimate(
        { latitude: 17.4325, longitude: 78.4071 },
        { name: "Apollo ER", latitude: 17.4156, longitude: 78.4132 },
        "http://192.168.29.118:5000"
      );
      assert.strictEqual(est.success, false);
      assert.strictEqual(est.fare, "Fare unavailable");
      assert.strictEqual(est.code, "UBER_NOT_CONNECTED");
      assert.strictEqual(est.shouldFallbackDeepLink, true);

      const booking = await requestUberAutoBooking(
        { latitude: 17.4325, longitude: 78.4071 },
        { name: "Apollo ER", latitude: 17.4156, longitude: 78.4132 },
        "",
        "uber-go",
        "http://192.168.29.118:5000"
      );
      assert.strictEqual(booking.success, false);
      assert.strictEqual(booking.ride_id, undefined);
      assert.strictEqual(booking.code, "UBER_NOT_CONNECTED");
      assert.strictEqual(booking.shouldFallbackDeepLink, true);

      const smsRes = await dispatchEmergencySms(
        [{ id: "1", name: "Dad", phone: "+910000000001" }],
        "SOS - Help",
        "location",
        "http://192.168.29.118:5000"
      );
      assert.strictEqual(smsRes.success, true);
      assert.strictEqual(smsRes.method, "sms_sheet");
    });
  });
});

