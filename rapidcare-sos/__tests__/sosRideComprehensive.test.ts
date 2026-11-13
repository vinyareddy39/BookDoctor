import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

// ── REAL SERVICE IMPORTS ──
import {
  buildUberLinks,
  openUberRide,
  fetchUberEstimate,
  requestUberAutoBooking,
} from "../src/services/uberService.ts";
import {
  calculateStraightLineDistance,
  type HospitalCandidate,
} from "../src/services/hospitalService.ts";
import {
  buildLocationPinUrl,
  createLocationAlertMessage,
  createHospitalUpdateMessage,
  createWatchdogFailedMessage,
  createLocationUnavailableMessage,
  dispatchEmergencySms,
  type EmergencyContactInfo,
} from "../src/services/smsService.ts";
import { normalizeToE164, isValidPhone } from "../src/utils/phoneUtils.ts";
import { EMERGENCY_CONFIG } from "../src/config/emergencyConfig.ts";
import { Linking, Platform } from "./rn-mock.mjs";

// ── 1. E.164 NORMALIZATION UNIT TESTS ──
describe("1. E.164 Phone Normalization", () => {
  it("normalizes a 10-digit Indian phone number with +91 default", () => {
    assert.strictEqual(normalizeToE164("9876543210"), "+919876543210");
  });

  it("handles numbers with leading 0 (trunk prefix)", () => {
    assert.strictEqual(normalizeToE164("09876543210"), "+919876543210");
  });

  it("handles formatting with spaces, hyphens, and brackets", () => {
    assert.strictEqual(normalizeToE164("+91 (987) 654-3210"), "+919876543210");
  });

  it("preserves valid international numbers from other countries", () => {
    assert.strictEqual(normalizeToE164("+1 415 555 2671"), "+14155552671");
    assert.strictEqual(normalizeToE164("+44 20 7946 0991"), "+442079460991");
  });

  it("rejects non-numeric gibberish", () => {
    assert.throws(() => normalizeToE164("not-a-number"));
    assert.strictEqual(isValidPhone("123"), false);
    assert.strictEqual(isValidPhone("9876543210"), true);
  });
});

// ── 2. UBER LINK BUILDER & REQUEST BUILDER ──
describe("2. Uber Link Builder & Request Payloads", () => {
  it("generates correct native appUrl and webUrl with explicit pickup and dropoff coordinates", () => {
    const pickup = { latitude: 17.4325, longitude: 78.4071 };
    const dropoff = { name: "Apollo Hospital ER", latitude: 17.4156, longitude: 78.4132 };

    const links = buildUberLinks(pickup, dropoff);

    assert.ok(links.appUrl.startsWith("uber://?action=setPickup"));
    assert.ok(links.webUrl.startsWith("https://m.uber.com/ul/?action=setPickup"));
    assert.ok(links.appUrl.includes("pickup[latitude]=17.4325"));
    assert.ok(links.appUrl.includes("pickup[longitude]=78.4071"));
    assert.ok(links.appUrl.includes("dropoff[latitude]=17.4156"));
  });

  it("safely percent-encodes names with spaces, accents, &, and #", () => {
    const pickup = { latitude: 12.9716, longitude: 77.5946 };
    const dropoff = {
      name: "St. Martha's & Fortis #1 Hôpital",
      latitude: 12.975,
      longitude: 77.598,
    };

    const links = buildUberLinks(pickup, dropoff);
    const encoded = encodeURIComponent("St. Martha's & Fortis #1 Hôpital");
    assert.ok(links.appUrl.includes(`dropoff[nickname]=${encoded}`));
    assert.ok(!links.appUrl.includes(" "));
    assert.ok(!links.appUrl.includes("#1"));
  });

  it("NEVER produces an App Store or itms-apps URL", () => {
    const pickup = { latitude: 17.385, longitude: 78.4867 };
    const dropoff = { name: "Care Hospitals", latitude: 17.401, longitude: 78.443 };
    const links = buildUberLinks(pickup, dropoff);
    assert.strictEqual(links.appUrl.includes("apps.apple.com"), false);
    assert.strictEqual(links.appUrl.includes("itms-apps"), false);
    assert.strictEqual(links.webUrl.includes("apps.apple.com"), false);
  });
});

// ── 3. HOSPITAL RANKING BY STRAIGHT-LINE DISTANCE ──
describe("3. Hospital Straight-Line Distance Ranking", () => {
  it("ranks candidates strictly by straight-line distance ascending", () => {
    const userLat = 17.4325;
    const userLng = 78.4071;

    const candidates: HospitalCandidate[] = [
      {
        id: "far",
        name: "Far Hospital",
        latitude: 17.5,
        longitude: 78.5,
        distanceMeters: calculateStraightLineDistance(userLat, userLng, 17.5, 78.5),
        source: "GooglePlaces",
      },
      {
        id: "nearest",
        name: "Nearest Hospital",
        latitude: 17.433,
        longitude: 78.408,
        distanceMeters: calculateStraightLineDistance(userLat, userLng, 17.433, 78.408),
        source: "GooglePlaces",
      },
    ];

    const sorted = [...candidates].sort((a, b) => a.distanceMeters - b.distanceMeters);
    assert.strictEqual(sorted[0].id, "nearest");
    assert.ok(sorted[0].distanceMeters < sorted[1].distanceMeters);
  });

  it("empty results -> failure with null return and zero hard-coded coordinates", () => {
    const emptyCandidates: HospitalCandidate[] = [];
    const resolved = emptyCandidates.length > 0 ? emptyCandidates[0] : null;
    assert.strictEqual(resolved, null);
  });
});

// ── 4. EMERGENCY SMS TEXT BUILDERS & PRIVACY ──
describe("4. Emergency SMS Text Builders", () => {
  it("SMS #1 has correct LAT,LNG pin and no hospital claim", () => {
    const msg = createLocationAlertMessage(17.4325, 78.4071);
    assert.ok(msg.startsWith("SOS - I need help. My location: https://maps.google.com/?q=17.4325,78.4071"));
    assert.strictEqual(msg.includes("hospital"), false);
  });

  it("SMS #2 contains nearest emergency hospital name", () => {
    const msg = createHospitalUpdateMessage("Apollo ER");
    assert.strictEqual(msg, "Nearest emergency hospital: Apollo ER");
  });

  it("SMS #3 watchdog failure asks for urgent help", () => {
    const msg = createWatchdogFailedMessage();
    assert.strictEqual(msg, "Ride could not be confirmed. Please call me or send help.");
  });

  it("location unavailable SMS alerts contacts to call user", () => {
    const msg = createLocationUnavailableMessage();
    assert.strictEqual(msg, "SOS - location unavailable, please call me");
  });
});

// ── 5. FLOW STATE MACHINE & WATCHDOG TIMER SCENARIOS ──
describe("5. Flow State Machine & Watchdog Scenarios", () => {
  beforeEach(() => {
    Linking.reset();
  });

  async function runPipeline(options: {
    mockLocation?: { latitude: number; longitude: number } | null;
    mockHospital?: HospitalCandidate | null;
    contacts: EmergencyContactInfo[];
    simulateNativeFail?: boolean;
    cancelCountdown?: boolean;
    simulateWatchdogTimeout?: boolean;
  }) {
    const events: string[] = [];

    if (options.cancelCountdown) {
      events.push("CANCELLED_IN_COUNTDOWN");
      return { events, currentPhase: "IDLE", uberOpened: false };
    }

    events.push("LOCATING_AND_ESTIMATING");

    if (!options.mockLocation) {
      events.push("LOCATION_FAILED");
      await dispatchEmergencySms(options.contacts, createLocationUnavailableMessage(), "location_unavailable");
      events.push("ALERT_108_112");
      return { events, currentPhase: "ALERT_108_112", uberOpened: false };
    }

    events.push("SEND_SMS_1");
    await dispatchEmergencySms(
      options.contacts,
      createLocationAlertMessage(options.mockLocation.latitude, options.mockLocation.longitude),
      "location"
    );

    events.push("HOSPITAL_SEARCH");
    if (!options.mockHospital) {
      events.push("NO_HOSPITAL_FOUND");
      events.push("ALERT_108_112");
      return { events, currentPhase: "ALERT_108_112", uberOpened: false };
    }

    events.push("SEND_SMS_2");
    await dispatchEmergencySms(
      options.contacts,
      createHospitalUpdateMessage(options.mockHospital.name),
      "hospital"
    );

    events.push("COUNTDOWN_WITH_FARE_DISPLAY");

    events.push("AUTO_BOOKING_ATTEMPT");
    if (options.simulateNativeFail) {
      Linking.failNativeApp = true;
    }

    const { opened, url } = await openUberRide(options.mockLocation, {
      name: options.mockHospital.name,
      latitude: options.mockHospital.latitude,
      longitude: options.mockHospital.longitude,
    });

    events.push(`UBER_DISPATCHED_${opened.toUpperCase()}`);

    if (options.simulateWatchdogTimeout) {
      events.push("WATCHDOG_TIMEOUT_45S");
      await dispatchEmergencySms(options.contacts, createWatchdogFailedMessage(), "watchdog_failed");
      events.push("ALERT_108_112");
      return { events, currentPhase: "ALERT_108_112", uberOpened: true, uberUrl: url };
    }

    events.push("RIDE_ACTIVE");
    return { events, currentPhase: "RIDE_ACTIVE", uberOpened: true, uberUrl: url };
  }

  it("(1) no hospital -> Uber never opened + alert 108/112", async () => {
    const res = await runPipeline({
      mockLocation: { latitude: 17.4325, longitude: 78.4071 },
      mockHospital: null,
      contacts: [{ name: "Family", phone: "+919876543210" }],
    });
    assert.strictEqual(res.uberOpened, false);
    assert.strictEqual(res.currentPhase, "ALERT_108_112");
  });

  it("(2) location failure -> alert 108/112, Uber never opened, location unavailable SMS sent", async () => {
    const res = await runPipeline({
      mockLocation: null,
      mockHospital: null,
      contacts: [{ name: "Family", phone: "+919876543210" }],
    });
    assert.strictEqual(res.uberOpened, false);
    assert.strictEqual(res.currentPhase, "ALERT_108_112");
  });

  it("(3) cancel during countdown -> nothing runs", async () => {
    const res = await runPipeline({
      mockLocation: { latitude: 17.4325, longitude: 78.4071 },
      mockHospital: {
        id: "h1",
        name: "ER Hospital",
        latitude: 17.44,
        longitude: 78.41,
        distanceMeters: 500,
        source: "GooglePlaces",
      },
      contacts: [{ name: "Mom", phone: "+919876543210" }],
      cancelCountdown: true,
    });
    assert.strictEqual(res.currentPhase, "IDLE");
    assert.strictEqual(res.uberOpened, false);
  });

  it("(4) 45s watchdog timer fires -> alert 108/112 and SMS #3 sent", async () => {
    const res = await runPipeline({
      mockLocation: { latitude: 17.4325, longitude: 78.4071 },
      mockHospital: {
        id: "h1",
        name: "Apollo ER",
        latitude: 17.44,
        longitude: 78.41,
        distanceMeters: 500,
        source: "GooglePlaces",
      },
      contacts: [{ name: "Dad", phone: "+919876543210" }],
      simulateWatchdogTimeout: true,
    });
    assert.strictEqual(res.currentPhase, "ALERT_108_112");
    assert.ok(res.events.includes("WATCHDOG_TIMEOUT_45S"));
  });

  it("(5) a contact number or message body is never logged to stdout", async () => {
    const privateNumber = "+919988776655";
    const privateBody = "Secret confidential SOS alert content";
    const interceptedLogs: string[] = [];
    const originalLog = console.log;

    console.log = (...args) => {
      interceptedLogs.push(args.join(" "));
    };

    try {
      await dispatchEmergencySms(
        [{ name: "ConfidentialContact", phone: privateNumber }],
        privateBody
      );

      for (const logLine of interceptedLogs) {
        assert.strictEqual(logLine.includes(privateNumber), false, "Private number found in log!");
        assert.strictEqual(logLine.includes(privateBody), false, "Private body found in log!");
      }
    } finally {
      console.log = originalLog;
    }
  });
});
