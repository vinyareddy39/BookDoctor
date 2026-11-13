import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  openEmergencySmsComposer,
  createSosCombinedAlertMessage,
  createWatchdogFailedMessage,
  createRideConfirmedMessage,
  createLocationUnavailableMessage,
  isSosInCooldown,
  markSosAlertCompleted,
  clearSosCooldown,
  MAX_EMERGENCY_CONTACTS,
} from "../src/services/smsService.ts";
import { SMS_MOCK_STATE } from "./expo-sms-mock.mjs";

describe("Messages App Emergency SMS Flow Tests", () => {
  beforeEach(() => {
    SMS_MOCK_STATE.reset();
    clearSosCooldown();
  });

  // ── 1. COMPOSER OPENS WITH ALL RECIPIENTS AND CORRECT MESSAGE ──
  it("opens composer with all recipients (up to 5) and combined location + hospital message", async () => {
    const contacts = [
      { name: "Mom", phone: "+919876543210" },
      { name: "Dad", phone: "+919123456789" },
      { name: "Sister", phone: "+919000000001" },
    ];
    const message = createSosCombinedAlertMessage(17.4325, 78.4071, "Apollo ER Hospital");

    assert.ok(message.includes("https://maps.google.com/?q=17.4325,78.4071"));
    assert.ok(message.includes("Nearest emergency hospital: Apollo ER Hospital"));

    const result = await openEmergencySmsComposer(contacts, message);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.method, "composer");
    assert.strictEqual(SMS_MOCK_STATE.calls.length, 1);
    assert.deepStrictEqual(SMS_MOCK_STATE.calls[0].addresses, [
      "+919876543210",
      "+919123456789",
      "+919000000001",
    ]);
    assert.strictEqual(SMS_MOCK_STATE.calls[0].message, message);
  });

  // ── 2. LOCATION-ONLY MESSAGE WHEN HOSPITAL LOOKUP FAILS OR TIMES OUT ──
  it("generates location-only message when hospital lookup is null or timed out (8s)", async () => {
    const contacts = [{ name: "Brother", phone: "+919876543210" }];
    const messageNoHospital = createSosCombinedAlertMessage(17.4325, 78.4071, null);

    assert.strictEqual(
      messageNoHospital,
      "SOS - I need help. My location: https://maps.google.com/?q=17.4325,78.4071"
    );
    assert.strictEqual(messageNoHospital.includes("hospital"), false);

    const result = await openEmergencySmsComposer(contacts, messageNoHospital);
    assert.strictEqual(result.success, true);
    assert.strictEqual(SMS_MOCK_STATE.calls[0].message, messageNoHospital);
  });

  // ── 3. FAILURE AND RIDE-CONFIRMED BUTTONS OPEN THE COMPOSER ──
  it("failure message composer is triggered on demand (not automatically)", async () => {
    const contacts = [{ name: "Emergency Contact", phone: "+919876543210" }];
    const failMessage = createWatchdogFailedMessage();

    assert.strictEqual(failMessage, "Ride could not be confirmed. Please call me or send help.");

    const result = await openEmergencySmsComposer(contacts, failMessage);
    assert.strictEqual(result.success, true);
    assert.strictEqual(SMS_MOCK_STATE.calls[0].message, failMessage);
  });

  it("ride-confirmed message composer carries driver, vehicle, plate, ETA, and tracking URL", async () => {
    const contacts = [{ name: "Emergency Contact", phone: "+919876543210" }];
    const rideMessage = createRideConfirmedMessage({
      driverName: "K. Mohan Rao",
      vehicleModel: "Hyundai Aura (Silver)",
      licensePlate: "TS 07 UA 9012",
      etaMinutes: 4,
      hospitalName: "Apollo ER",
      trackingUrl: "https://book-doctor-six.vercel.app/track/tok_123",
    });

    assert.ok(rideMessage.includes("Driver: K. Mohan Rao"));
    assert.ok(rideMessage.includes("Hyundai Aura (Silver)"));
    assert.ok(rideMessage.includes("(TS 07 UA 9012)"));
    assert.ok(rideMessage.includes("ETA: ~4 mins"));
    assert.ok(rideMessage.includes("Destination: Apollo ER"));
    assert.ok(rideMessage.includes("https://book-doctor-six.vercel.app/track/tok_123"));

    const result = await openEmergencySmsComposer(contacts, rideMessage);
    assert.strictEqual(result.success, true);
    assert.strictEqual(SMS_MOCK_STATE.calls[0].message, rideMessage);
  });

  // ── 4. UNAVAILABLE FALLBACK SHOWS COPYABLE TEXT ──
  it("returns unavailable method with recipients and messageText when SMS composer is unavailable", async () => {
    SMS_MOCK_STATE.available = false;

    const contacts = [
      { name: "Mom", phone: "+919876543210" },
      { name: "Dad", phone: "+919123456789" },
    ];
    const alertMessage = createSosCombinedAlertMessage(17.4325, 78.4071, "Apollo ER");

    const result = await openEmergencySmsComposer(contacts, alertMessage);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.method, "unavailable");
    assert.deepStrictEqual(result.recipients, ["+919876543210", "+919123456789"]);
    assert.strictEqual(result.messageText, alertMessage);
    assert.ok(result.error?.includes("unavailable"));
  });

  // ── 5. STRICT 5-CONTACT CAP ──
  it("caps recipients to a maximum of 5 contacts when more are provided", async () => {
    const contacts = [
      { name: "C1", phone: "+919000000001" },
      { name: "C2", phone: "+919000000002" },
      { name: "C3", phone: "+919000000003" },
      { name: "C4", phone: "+919000000004" },
      { name: "C5", phone: "+919000000005" },
      { name: "C6", phone: "+919000000006" },
      { name: "C7", phone: "+919000000007" },
    ];
    assert.strictEqual(MAX_EMERGENCY_CONTACTS, 5);

    const result = await openEmergencySmsComposer(contacts, "Test emergency text");
    assert.strictEqual(result.success, true);
    assert.strictEqual(SMS_MOCK_STATE.calls[0].addresses.length, 5);
    assert.deepStrictEqual(SMS_MOCK_STATE.calls[0].addresses, [
      "+919000000001",
      "+919000000002",
      "+919000000003",
      "+919000000004",
      "+919000000005",
    ]);
  });

  // ── 6. RATE LIMITING & COOLDOWN ──
  it("tracks 60s cooldown and allows clearing on cancellation", () => {
    assert.strictEqual(isSosInCooldown(), false);
    markSosAlertCompleted();
    assert.strictEqual(isSosInCooldown(), true);
    clearSosCooldown();
    assert.strictEqual(isSosInCooldown(), false);
  });

  // ── 7. ZERO PII IN LOGS ──
  it("never logs raw phone numbers or message bodies to console", async () => {
    const secretPhone = "+919876543210";
    const secretMessage = "Confidential Emergency Text Body 9876543210";
    const logs: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;

    console.log = (...args) => logs.push(args.join(" "));
    console.warn = (...args) => logs.push(args.join(" "));

    try {
      await openEmergencySmsComposer([{ name: "Aunt", phone: secretPhone }], secretMessage);

      for (const log of logs) {
        assert.strictEqual(log.includes(secretPhone), false, `PII leak detected: phone in log "${log}"`);
        assert.strictEqual(
          log.includes("Confidential Emergency Text"),
          false,
          `PII leak detected: body in log "${log}"`
        );
      }
    } finally {
      console.log = origLog;
      console.warn = origWarn;
    }
  });
});

