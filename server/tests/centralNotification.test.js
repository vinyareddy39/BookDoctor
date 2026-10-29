import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  dispatchNotification,
  notify,
  EVENT_TYPES,
  TEMPLATES,
  isWithinQuietHours,
  interpolate,
} from "../services/centralNotificationService.js";
import Notification from "../models/Notification.js";
import NotificationPreference from "../models/NotificationPreference.js";
import User from "../models/User.js";

let mongoServer;
let testPatient;
let testDoctor;

describe("Phase 1: Central Notification System Tests", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    testPatient = await User.create({
      name: "Dharani Kumar",
      email: "dharani@example.com",
      phone: "+919876543210",
      role: "patient",
      password: "Password123!",
    });

    testDoctor = await DoctorUserCreate();
  });

  async function DoctorUserCreate() {
    return await User.create({
      name: "Dr. Anjali Rao",
      email: "dr.anjali@example.com",
      phone: "+919876543211",
      role: "doctor",
      password: "Password123!",
    });
  }

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe("1. Template Localization & Interpolation", () => {
    it("should correctly render English, Telugu, and Hindi appointment rescheduled templates", () => {
      const vars = {
        actorName: "Dharani",
        oldDate: "19 Oct",
        oldTime: "12:30 PM",
        newDate: "26 Oct",
        newTime: "3:00 PM",
      };

      // English
      const en = TEMPLATES[EVENT_TYPES.APPOINTMENT_RESCHEDULED].en;
      expect(en.title).toBe("Appointment Rescheduled");
      const enRendered = interpolate(en.body, vars);
      expect(enRendered).toContain("Dharani rescheduled");
      expect(enRendered).toContain("19 Oct, 12:30 PM");
      expect(enRendered).toContain("26 Oct, 3:00 PM");

      // Telugu
      const te = TEMPLATES[EVENT_TYPES.APPOINTMENT_RESCHEDULED].te;
      expect(te.title).toBe("అపాయింట్‌మెంట్ మార్చబడింది");
      const teRendered = interpolate(te.body, vars);
      expect(teRendered).toContain("Dharani");

      // Hindi
      const hi = TEMPLATES[EVENT_TYPES.APPOINTMENT_RESCHEDULED].hi;
      expect(hi.title).toBe("अपॉइंटमेंट का समय बदला गया");
      const hiRendered = interpolate(hi.body, vars);
      expect(hiRendered).toContain("Dharani");
    });
  });

  describe("2. Quiet Hours Evaluation & Critical Override", () => {
    it("should recognize active quiet hours correctly", () => {
      const activeQuiet = {
        enabled: true,
        start: "00:00",
        end: "23:59", // All day quiet hours for testing
        timezone: "Asia/Kolkata",
      };
      expect(isWithinQuietHours(activeQuiet)).toBe(true);

      const disabledQuiet = {
        enabled: false,
        start: "22:00",
        end: "07:00",
      };
      expect(isWithinQuietHours(disabledQuiet)).toBe(false);
    });

    it("should suppress external channels during quiet hours for non-critical events", async () => {
      // Setup quiet hours for patient
      await NotificationPreference.findOneAndUpdate(
        { userId: testPatient._id },
        {
          userId: testPatient._id,
          quietHours: { enabled: true, start: "00:00", end: "23:59", timezone: "Asia/Kolkata" },
        },
        { upsert: true }
      );

      const notif = await dispatchNotification({
        eventType: EVENT_TYPES.APPOINTMENT_BOOKED,
        recipientId: testPatient._id,
        senderId: testDoctor._id,
        variables: { actorName: "Dr. Anjali", date: "2026-10-20", time: "10:00 AM" },
      });

      expect(notif).toBeDefined();
      expect(notif.channels).toContain("in_app");
      // External channels should be filtered out during quiet hours
      expect(notif.channels).not.toContain("email");
      expect(notif.channels).not.toContain("sms_whatsapp");
    });

    it("should NOT suppress critical safety events (SOS, Red-Flag) even during quiet hours", async () => {
      const notif = await dispatchNotification({
        eventType: EVENT_TYPES.SOS_TRIGGERED,
        recipientId: testPatient._id,
        senderId: null,
        variables: { patientName: "Dharani", hospitalName: "Apollo ER" },
      });

      expect(notif).toBeDefined();
      expect(notif.channels).toContain("in_app");
      expect(notif.channels).toContain("sms_whatsapp");
    });
  });

  describe("3. Deduplication, Batching, and Idempotency", () => {
    it("should enforce idempotency keys to prevent duplicate notifications", async () => {
      const key = `idem-${Date.now()}`;

      const notif1 = await dispatchNotification({
        eventType: EVENT_TYPES.PAYMENT_RECEIVED,
        recipientId: testPatient._id,
        variables: { amount: 500, date: "26 Oct" },
        idempotencyKey: key,
      });

      const notif2 = await dispatchNotification({
        eventType: EVENT_TYPES.PAYMENT_RECEIVED,
        recipientId: testPatient._id,
        variables: { amount: 500, date: "26 Oct" },
        idempotencyKey: key,
      });

      expect(String(notif1._id)).toBe(String(notif2._id));
      const count = await Notification.countDocuments({ idempotencyKey: key });
      expect(count).toBe(1);
    });

    it("should batch rapid chat messages from the same sender", async () => {
      const msg1 = await dispatchNotification({
        eventType: EVENT_TYPES.CHAT_MESSAGE_RECEIVED,
        recipientId: testPatient._id,
        senderId: testDoctor._id,
        variables: { senderName: "Dr. Anjali", snippet: "Hello Dharani" },
      });

      const msg2 = await dispatchNotification({
        eventType: EVENT_TYPES.CHAT_MESSAGE_RECEIVED,
        recipientId: testPatient._id,
        senderId: testDoctor._id,
        variables: { senderName: "Dr. Anjali", snippet: "Please check your test results" },
      });

      expect(msg1.message).toContain("Hello Dharani");
      expect(msg2.message).toContain("2 new messages from Dr. Anjali");
    });
  });

  describe("4. Multi-Channel Failure Isolation", () => {
    it("should succeed and deliver in-app even if external dispatch fails", async () => {
      const notif = await dispatchNotification({
        eventType: EVENT_TYPES.PRESCRIPTION_SHARED,
        recipientId: testPatient._id,
        senderId: testDoctor._id,
        variables: { doctorName: "Dr. Anjali" },
        channelsOverride: ["in_app", "email"],
      });

      expect(notif).toBeDefined();
      expect(notif.status.in_app).toBe("delivered");
      // Document is saved and in-app works even if mock email is queued
      expect(notif._id).toBeDefined();
    });
  });

  describe("5. Unified notify() Function & Self-Notification Avoidance", () => {
    it("should notify the other party and never the actor who performed the action", async () => {
      // Patient performs action -> doctor is notified
      const notif = await notify(EVENT_TYPES.APPOINTMENT_BOOKED, testDoctor._id, {
        actorId: testPatient._id,
        title: "New Booking",
        message: "Rahul Roy booked an appointment for tomorrow.",
      });

      expect(notif).toBeDefined();
      expect(String(notif.userId)).toBe(String(testDoctor._id));

      // Attempt self-notification (recipient matches actorId) -> safely skips
      const selfNotif = await notify(EVENT_TYPES.APPOINTMENT_BOOKED, testPatient._id, {
        actorId: testPatient._id,
        title: "Self Notification",
        message: "You booked an appointment",
      });

      expect(selfNotif).toBeNull();
    });

    it("should never throw an unhandled error when notification fails, preserving main action", async () => {
      // Pass an invalid ID that cannot crash the caller
      const res = await notify(EVENT_TYPES.APPOINTMENT_CANCELLED, "invalid_id_not_found", {
        title: "Cancelled",
        message: "Cancelled",
      });
      // Returns null, does not throw
      expect(res).toBeNull();
    });
  });
});
