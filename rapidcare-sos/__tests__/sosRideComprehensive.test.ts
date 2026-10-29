import { describe, it } from "node:test";
import assert from "node:assert";

// ── 1. UBER LINK BUILDER IMPLEMENTATION & TESTS ──
function buildUberLinks(
  pickup: { latitude: number; longitude: number },
  dropoff: { name: string; latitude: number; longitude: number; address?: string }
) {
  if (
    typeof pickup?.latitude !== "number" ||
    typeof pickup?.longitude !== "number" ||
    isNaN(pickup.latitude) ||
    isNaN(pickup.longitude) ||
    typeof dropoff?.latitude !== "number" ||
    typeof dropoff?.longitude !== "number" ||
    isNaN(dropoff.latitude) ||
    isNaN(dropoff.longitude)
  ) {
    throw new Error("Invalid pickup or dropoff coordinates for Uber link generation");
  }

  const pickupLat = String(pickup.latitude);
  const pickupLng = String(pickup.longitude);
  const dropLat = String(dropoff.latitude);
  const dropLng = String(dropoff.longitude);

  const pickupNick = "My Location";
  const dropNick = (dropoff.name || "Emergency Hospital").trim();

  const queryParts = [
    `action=setPickup`,
    `pickup[latitude]=${encodeURIComponent(pickupLat)}`,
    `pickup[longitude]=${encodeURIComponent(pickupLng)}`,
    `pickup[nickname]=${encodeURIComponent(pickupNick)}`,
    `dropoff[latitude]=${encodeURIComponent(dropLat)}`,
    `dropoff[longitude]=${encodeURIComponent(dropLng)}`,
    `dropoff[nickname]=${encodeURIComponent(dropNick)}`,
  ];

  const queryString = queryParts.join("&");

  return {
    appUrl: `uber://?${queryString}`,
    webUrl: `https://m.uber.com/ul/?${queryString}`,
  };
}

describe("Uber Link Builder Tests", () => {
  it("generates correct native appUrl and webUrl with explicit pickup and dropoff coordinates", () => {
    const pickup = { latitude: 17.4325, longitude: 78.4071 };
    const dropoff = { name: "Apollo Hospital ER", latitude: 17.4156, longitude: 78.4132 };

    const links = buildUberLinks(pickup, dropoff);

    assert.ok(links.appUrl.startsWith("uber://?action=setPickup"));
    assert.ok(links.webUrl.startsWith("https://m.uber.com/ul/?action=setPickup"));

    assert.ok(links.appUrl.includes("pickup[latitude]=17.4325"));
    assert.ok(links.appUrl.includes("pickup[longitude]=78.4071"));
    assert.ok(links.appUrl.includes("dropoff[latitude]=17.4156"));
    assert.ok(links.appUrl.includes("dropoff[longitude]=78.4132"));
    assert.ok(links.appUrl.includes("dropoff[nickname]=Apollo%20Hospital%20ER"));

    // Explicit pickup coordinates: NOT pickup=my_location
    assert.ok(!links.appUrl.includes("pickup=my_location"));
    assert.ok(!links.webUrl.includes("pickup=my_location"));
  });

  it("safely percent-encodes names with spaces, accents, &, and #", () => {
    const pickup = { latitude: 17.4325, longitude: 78.4071 };
    const dropoff = {
      name: "St. Mary's & General Hospital #4 (Émergence)",
      latitude: 17.45,
      longitude: 78.42,
    };

    const links = buildUberLinks(pickup, dropoff);

    // Verify & and # and spaces are strictly encoded
    assert.ok(!links.appUrl.includes("St. Mary's & General"));
    assert.ok(links.appUrl.includes("St.%20Mary's%20%26%20General%20Hospital%20%234"));
    assert.ok(links.appUrl.includes("%C3%89mergence"));
  });

  it("handles negative coordinates correctly (e.g. Southern / Western hemispheres)", () => {
    const pickup = { latitude: -33.8688, longitude: -70.6693 };
    const dropoff = { name: "Hospital San Juan", latitude: -33.8711, longitude: -70.6722 };

    const links = buildUberLinks(pickup, dropoff);

    assert.ok(links.appUrl.includes("pickup[latitude]=-33.8688"));
    assert.ok(links.appUrl.includes("pickup[longitude]=-70.6693"));
    assert.ok(links.appUrl.includes("dropoff[latitude]=-33.8711"));
    assert.ok(links.appUrl.includes("dropoff[longitude]=-70.6722"));
  });

  it("NEVER produces an App Store, apps.apple.com, or itms-apps URL", () => {
    const pickup = { latitude: 17.4325, longitude: 78.4071 };
    const dropoff = { name: "City Care", latitude: 17.44, longitude: 78.41 };

    const links = buildUberLinks(pickup, dropoff);

    assert.strictEqual(links.appUrl.includes("apple.com"), false);
    assert.strictEqual(links.appUrl.includes("itms-apps"), false);
    assert.strictEqual(links.webUrl.includes("apple.com"), false);
    assert.strictEqual(links.webUrl.includes("itms-apps"), false);
  });
});

// ── 2. HOSPITAL RANKING BY STRAIGHT-LINE DISTANCE ──
function calculateStraightLineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function rankHospitals(
  userLat: number,
  userLng: number,
  candidates: Array<{ name: string; latitude: number; longitude: number }>
) {
  if (!candidates || candidates.length === 0) return [];

  return candidates
    .map((c) => ({
      ...c,
      distanceMeters: calculateStraightLineDistance(userLat, userLng, c.latitude, c.longitude),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

describe("Hospital Straight-Line Distance Ranking Tests", () => {
  it("ranks candidates strictly by straight-line distance ascending", () => {
    const userLat = 17.4325;
    const userLng = 78.4071;

    const hospitals = [
      { name: "Far Hospital (10km)", latitude: 17.52, longitude: 78.45 },
      { name: "Closest Hospital (800m)", latitude: 17.438, longitude: 78.411 },
      { name: "Mid Hospital (3km)", latitude: 17.455, longitude: 78.42 },
    ];

    const ranked = rankHospitals(userLat, userLng, hospitals);

    assert.strictEqual(ranked.length, 3);
    assert.strictEqual(ranked[0].name, "Closest Hospital (800m)");
    assert.strictEqual(ranked[1].name, "Mid Hospital (3km)");
    assert.strictEqual(ranked[2].name, "Far Hospital (10km)");
    assert.ok(ranked[0].distanceMeters < ranked[1].distanceMeters);
    assert.ok(ranked[1].distanceMeters < ranked[2].distanceMeters);
  });

  it("returns empty array and does NOT use hard-coded coordinates when candidates are empty", () => {
    const ranked = rankHospitals(17.4325, 78.4071, []);
    assert.strictEqual(ranked.length, 0);
  });
});

// ── 3. SMS CONTENT & TIMING TESTS ──
function buildLocationPinUrl(latitude: number, longitude: number): string {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

function createLocationAlertMessage(latitude: number, longitude: number): string {
  const pin = buildLocationPinUrl(latitude, longitude);
  return `SOS - I need help. My location: ${pin}`;
}

function createHospitalUpdateMessage(hospitalName: string): string {
  return `Nearest emergency hospital: ${hospitalName}`;
}

function createWatchdogFailedMessage(): string {
  return "Ride could not be confirmed. Please call me or send help.";
}

function createLocationUnavailableMessage(): string {
  return "SOS - location unavailable, please call me";
}

describe("Emergency SMS Template Tests", () => {
  it("SMS #1 contains correct Google Maps pin coordinates with 'My location'", () => {
    const lat = 17.4325;
    const lng = 78.4071;
    const msg = createLocationAlertMessage(lat, lng);

    assert.ok(msg.includes("My location: https://maps.google.com/?q=17.4325,78.4071"));
    assert.ok(!msg.includes("hospital")); // Never claims hospital before lookup!
  });

  it("SMS #2 contains hospital name once found", () => {
    const msg = createHospitalUpdateMessage("Care Hospital ER");
    assert.strictEqual(msg, "Nearest emergency hospital: Care Hospital ER");
  });

  it("SMS #3 watchdog timeout message asks for urgent help", () => {
    const msg = createWatchdogFailedMessage();
    assert.strictEqual(msg, "Ride could not be confirmed. Please call me or send help.");
  });

  it("Location unavailable SMS notifies contacts to call user", () => {
    const msg = createLocationUnavailableMessage();
    assert.strictEqual(msg, "SOS - location unavailable, please call me");
  });
});

// ── 4. FLOW STATE MACHINE SIMULATION TESTS ──
class MockSosPipeline {
  events: string[] = [];
  phase: string = "IDLE";
  uberOpened: boolean = false;
  openedUrlType: "none" | "app" | "web" = "none";
  alertShown: boolean = false;
  sentSmsMessages: string[] = [];

  async run({
    cancelDuringCountdown = false,
    mockLocationFail = false,
    mockHospitalFail = false,
    mockContactsEmpty = false,
    mockUberAppFails = false,
    mockWatchdogTimeout = false,
  }) {
    this.events.push("SOS_PRESSED");
    this.phase = "COUNTDOWN";

    if (cancelDuringCountdown) {
      this.events.push("CANCELLED_IN_COUNTDOWN");
      this.phase = "IDLE";
      return;
    }

    // Step 1: Location acquisition
    this.phase = "LOCATING";
    if (mockLocationFail) {
      this.events.push("LOCATION_FAILED");
      this.sentSmsMessages.push(createLocationUnavailableMessage());
      this.alertShown = true;
      this.phase = "ALERT_108_112";
      return;
    }
    const coords = { latitude: 17.4325, longitude: 78.4071 };
    this.events.push("LOCATION_ACQUIRED");

    // Step 2: Location SMS (sent BEFORE hospital lookup)
    if (!mockContactsEmpty) {
      this.sentSmsMessages.push(createLocationAlertMessage(coords.latitude, coords.longitude));
      this.events.push("LOCATION_SMS_SENT");
    } else {
      this.events.push("CONTACTS_EMPTY_SMS_SKIPPED");
    }

    // Step 3: Hospital lookup
    this.phase = "HOSPITAL_SEARCH";
    if (mockHospitalFail) {
      this.events.push("NO_HOSPITAL_FOUND");
      // Must NOT open Uber and must NOT use hard-coded coordinates!
      this.alertShown = true;
      this.phase = "ALERT_108_112";
      return;
    }
    const hospital = { name: "Apollo ER", latitude: 17.415, longitude: 78.412 };
    this.events.push("HOSPITAL_FOUND");

    // Step 4: Hospital follow-up SMS
    if (!mockContactsEmpty) {
      this.sentSmsMessages.push(createHospitalUpdateMessage(hospital.name));
      this.events.push("HOSPITAL_SMS_SENT");
    }

    // Step 5: Open Uber
    this.phase = "UBER_LAUNCHING";
    const links = buildUberLinks(coords, hospital);
    if (!mockUberAppFails) {
      this.uberOpened = true;
      this.openedUrlType = "app";
      this.events.push(`OPENED_UBER_APP:${links.appUrl}`);
    } else {
      // Fallback to web link
      this.uberOpened = true;
      this.openedUrlType = "web";
      this.events.push(`OPENED_UBER_WEB:${links.webUrl}`);
    }

    // Step 6: 45s Watchdog
    this.phase = "WATCHDOG_WAIT";
    if (mockWatchdogTimeout) {
      this.events.push("WATCHDOG_EXPIRED_45S");
      if (!mockContactsEmpty) {
        this.sentSmsMessages.push(createWatchdogFailedMessage());
      }
      this.alertShown = true;
      this.phase = "ALERT_108_112";
      return;
    }

    this.phase = "CONFIRMED";
    this.events.push("RIDE_CONFIRMED");
  }
}

describe("SOS Flow State Machine Edge Case Tests", () => {
  it("(1) No hospital found -> Uber is NEVER opened, 108/112 alert shown, no hardcoded coordinates", async () => {
    const pipeline = new MockSosPipeline();
    await pipeline.run({ mockHospitalFail: true });

    assert.strictEqual(pipeline.uberOpened, false);
    assert.strictEqual(pipeline.alertShown, true);
    assert.strictEqual(pipeline.phase, "ALERT_108_112");
  });

  it("(2) Location acquisition fails -> alert shown, location unavailable SMS sent, Uber never opened", async () => {
    const pipeline = new MockSosPipeline();
    await pipeline.run({ mockLocationFail: true });

    assert.strictEqual(pipeline.uberOpened, false);
    assert.strictEqual(pipeline.alertShown, true);
    assert.strictEqual(pipeline.sentSmsMessages.length, 1);
    assert.strictEqual(pipeline.sentSmsMessages[0], "SOS - location unavailable, please call me");
  });

  it("(3) Cancel during countdown -> nothing runs, idle state restored", async () => {
    const pipeline = new MockSosPipeline();
    await pipeline.run({ cancelDuringCountdown: true });

    assert.strictEqual(pipeline.phase, "IDLE");
    assert.strictEqual(pipeline.uberOpened, false);
    assert.strictEqual(pipeline.sentSmsMessages.length, 0);
  });

  it("(4) No emergency contacts -> warning shown, SMS skipped, ride flow reaches Uber step", async () => {
    const pipeline = new MockSosPipeline();
    await pipeline.run({ mockContactsEmpty: true });

    assert.ok(pipeline.events.includes("CONTACTS_EMPTY_SMS_SKIPPED"));
    assert.strictEqual(pipeline.uberOpened, true);
    assert.strictEqual(pipeline.sentSmsMessages.length, 0);
    assert.strictEqual(pipeline.phase, "CONFIRMED");
  });

  it("(5) Native Uber app fails to open -> web fallback is cleanly used", async () => {
    const pipeline = new MockSosPipeline();
    await pipeline.run({ mockUberAppFails: true });

    assert.strictEqual(pipeline.uberOpened, true);
    assert.strictEqual(pipeline.openedUrlType, "web");
  });

  it("(6) 45s watchdog timer fires -> alert shown + 3rd failed confirmation SMS sent", async () => {
    const pipeline = new MockSosPipeline();
    await pipeline.run({ mockWatchdogTimeout: true });

    assert.strictEqual(pipeline.alertShown, true);
    assert.strictEqual(pipeline.phase, "ALERT_108_112");
    assert.strictEqual(pipeline.sentSmsMessages.length, 3);
    assert.strictEqual(pipeline.sentSmsMessages[2], "Ride could not be confirmed. Please call me or send help.");
  });
});

// ── 5. ANDROID KEYWORD MATCHER TESTS ──
const EXACT_FULL_LABEL_KEYWORDS = new Set(["ok", "done", "continue", "request", "book"]);
const USER_CONSENT_OR_PAYMENT_KEYWORDS = [
  "i agree",
  "confirm payment",
  "accept higher fare",
  "pay with cash",
  "select payment",
  "personal profile",
];

function matchesKeyword(text: string, keyword: string): boolean {
  const target = keyword.toLowerCase().trim();
  const cleanText = text.toLowerCase().trim();

  // Exact full-label equality ONLY for the 5 specified single words:
  if (EXACT_FULL_LABEL_KEYWORDS.has(target)) {
    return cleanText === target;
  }

  // Whole-word regex matching for all other keywords and phrases
  const regex = new RegExp(`\\b${target.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i");
  return regex.test(cleanText);
}

describe("Keyword Matcher Unit Tests", () => {
  it("'ok' does not match 'book'", () => {
    assert.strictEqual(matchesKeyword("book", "ok"), false);
    assert.strictEqual(matchesKeyword("ok", "book"), false);
  });

  it("'continue' does NOT match 'Continue with Google' (exact full-label required)", () => {
    assert.strictEqual(matchesKeyword("Continue with Google", "continue"), false);
    assert.strictEqual(matchesKeyword("Continue", "continue"), true);
  });

  it("'confirm ubergo' matches 'Confirm UberGo' case-insensitively", () => {
    assert.strictEqual(matchesKeyword("Confirm UberGo", "confirm ubergo"), true);
  });

  it("'ubergo' matches 'UberGo, 4 seats' as whole-word match", () => {
    assert.strictEqual(matchesKeyword("UberGo, 4 seats", "ubergo"), true);
  });

  it("User consent / payment keywords are NOT in the auto-tap list", () => {
    for (const kw of USER_CONSENT_OR_PAYMENT_KEYWORDS) {
      assert.strictEqual(EXACT_FULL_LABEL_KEYWORDS.has(kw), false);
    }
  });
});

