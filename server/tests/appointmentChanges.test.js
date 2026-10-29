import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import {
  rescheduleAppointment,
  rescheduleDecision,
  cancelAppointment,
  getDoctorActivityFeed,
} from "../controllers/appointmentController.js";
import { checkAndSendAppointmentReminders } from "../service/cronService.js";

let mongoServer;
let patientUser;
let doctorUser;
let doctorDoc;

const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

const mockReq = (user, body = {}, params = {}, query = {}) => ({
  user,
  body,
  params,
  query,
  headers: {},
  ip: "127.0.0.1",
  http: {
    ok: (data, msg) => ({ status: "success", data, message: msg }),
    badRequest: (msg) => ({ status: "fail", message: msg, statusCode: 400 }),
    conflict: (msg) => ({ status: "fail", message: msg, statusCode: 409 }),
    forbidden: (msg) => ({ status: "fail", message: msg, statusCode: 403 }),
    notFound: (msg) => ({ status: "fail", message: msg, statusCode: 404 }),
  },
});

describe("Phase 2: Appointment Changes & Activity Feed Tests", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    patientUser = await User.create({
      name: "Sneha Reddy",
      email: "sneha@example.com",
      role: "patient",
      password: "Password123!",
      phone: "+919988776655",
    });

    doctorUser = await User.create({
      name: "Kiran Sharma",
      email: "kiran@example.com",
      role: "doctor",
      password: "Password123!",
      phone: "+919988776656",
    });

    doctorDoc = await Doctor.create({
      userId: doctorUser._id,
      specialization: "General Physician",
      experience: 10,
      consultationFee: 500,
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      timeSlots: ["10:00 AM", "11:00 AM", "02:00 PM", "04:00 PM"],
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("1. Rescheduling records changeHistory and updates slot", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);

    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: futureDate,
      appointmentTime: "10:00 AM",
      amount: 500,
      status: "confirmed",
    });

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 7);
    const newDateStr = newDate.toISOString().split("T")[0];

    const req = mockReq(patientUser, {
      appointmentDate: newDateStr,
      appointmentTime: "02:00 PM",
      reason: "Traveling out of town",
    }, { id: appt._id });

    const result = await rescheduleAppointment(req, mockRes(), (e) => { throw e; });
    expect(result.status).toBe("success");
    expect(result.data.rescheduleCount).toBe(1);

    const updated = await Appointment.findById(appt._id);
    expect(updated.changeHistory.length).toBe(1);
    expect(updated.changeHistory[0].changeType).toBe("rescheduled");
    expect(updated.changeHistory[0].reason).toBe("Traveling out of town");
    expect(updated.changeHistory[0].actorRole).toBe("patient");
    expect(updated.changeHistory[0].before.timeSlot).toBe("10:00 AM");
    expect(updated.changeHistory[0].after.timeSlot).toBe("02:00 PM");
  });

  it("2. Notice window: rejects reschedule within 2 hours of appointment for patient", async () => {
    // Appointment scheduled 30 minutes from now
    const imminentDate = new Date(Date.now() + 30 * 60 * 1000);
    const hours = imminentDate.getHours();
    const mins = imminentDate.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;
    const timeStr = `${formattedHours}:${mins < 10 ? "0" + mins : mins} ${ampm}`;

    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: imminentDate,
      appointmentTime: timeStr,
      amount: 500,
      status: "confirmed",
    });

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);

    const req = mockReq(patientUser, {
      appointmentDate: targetDate.toISOString().split("T")[0],
      appointmentTime: "11:00 AM",
    }, { id: appt._id });

    const result = await rescheduleAppointment(req, mockRes(), (e) => { throw e; });
    expect(result.statusCode).toBe(400);
    expect(result.message).toContain("less than 2 hours");
  });

  it("3. Max reschedule limit: blocks 4th reschedule attempt", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: futureDate,
      appointmentTime: "10:00 AM",
      amount: 500,
      status: "confirmed",
      rescheduleCount: 3, // Already reached limit
    });

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 12);

    const req = mockReq(patientUser, {
      appointmentDate: targetDate.toISOString().split("T")[0],
      appointmentTime: "11:00 AM",
    }, { id: appt._id });

    const result = await rescheduleAppointment(req, mockRes(), (e) => { throw e; });
    expect(result.statusCode).toBe(400);
    expect(result.message).toContain("Maximum reschedule limit (3 times) has been reached");
  });

  it("4. Doctor approval workflow: patient request puts appointment in pending approval", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 6);

    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: futureDate,
      appointmentTime: "10:00 AM",
      amount: 500,
      status: "confirmed",
      rescheduleApprovalRequired: true,
    });

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 8);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    const req = mockReq(patientUser, {
      appointmentDate: targetDateStr,
      appointmentTime: "04:00 PM",
      reason: "Meeting clash",
    }, { id: appt._id });

    const result = await rescheduleAppointment(req, mockRes(), (e) => { throw e; });
    expect(result.status).toBe("success");
    expect(result.message).toContain("Reschedule request submitted for doctor approval");

    const pending = await Appointment.findById(appt._id);
    expect(pending.rescheduleStatus).toBe("pending_doctor_approval");
    expect(pending.proposedChange.timeSlot).toBe("04:00 PM");

    // Doctor approves
    const approveReq = mockReq(doctorUser, {
      action: "approve",
      reason: "Approved per patient request",
    }, { id: appt._id });

    const approveResult = await rescheduleDecision(approveReq, mockRes(), (e) => { throw e; });
    expect(approveResult.status).toBe("success");

    const approved = await Appointment.findById(appt._id);
    expect(approved.rescheduleStatus).toBe("approved");
    expect(approved.appointmentTime).toBe("04:00 PM");
    expect(approved.changeHistory.some(c => c.changeType === "reschedule_approved")).toBe(true);
  });

  it("5. Cancellation requires reason, writes changeHistory and cancels appointment", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 4);

    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: futureDate,
      appointmentTime: "11:00 AM",
      amount: 500,
      status: "confirmed",
    });

    // Attempt without reason -> fails
    const reqNoReason = mockReq(patientUser, { reason: "" }, { id: appt._id });
    const failResult = await cancelAppointment(reqNoReason, mockRes(), (e) => { throw e; });
    expect(failResult.statusCode).toBe(400);

    // Provide reason
    const reqWithReason = mockReq(patientUser, {
      reason: "Feeling much better, not needed",
    }, { id: appt._id });

    const successResult = await cancelAppointment(reqWithReason, mockRes(), (e) => { throw e; });
    expect(successResult.status).toBe("success");

    const cancelled = await Appointment.findById(appt._id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancellationReason).toBe("Feeling much better, not needed");
    expect(cancelled.changeHistory.some(c => c.changeType === "cancelled")).toBe(true);
  });

  it("6. Doctor activity feed aggregates events with filter support", async () => {
    const req = mockReq(doctorUser, {}, {}, { limit: 20 });
    const result = await getDoctorActivityFeed(req, mockRes(), (e) => { throw e; });
    expect(result.status).toBe("success");
    expect(result.data.feed.length).toBeGreaterThan(0);

    // Verify events contain patient names, types, and timestamps
    const firstEvent = result.data.feed[0];
    expect(firstEvent).toHaveProperty("patientName");
    expect(firstEvent).toHaveProperty("type");
    expect(firstEvent).toHaveProperty("timestamp");

    // Filter by cancelled
    const filterReq = mockReq(doctorUser, {}, {}, { type: "cancelled" });
    const filterResult = await getDoctorActivityFeed(filterReq, mockRes(), (e) => { throw e; });
    expect(filterResult.data.feed.every(e => e.type === "cancelled")).toBe(true);
  });

  it("7. Automated reminders: 24h reminder flags reminderSent24h idempotently", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // set to same hour as tomorrow
    const hour = tomorrow.getHours();
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    const timeSlot = `${h12}:00 ${ampm}`;

    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: tomorrow,
      appointmentTime: timeSlot,
      amount: 500,
      status: "confirmed",
      reminderSent24h: false,
    });

    const summary1 = await checkAndSendAppointmentReminders();
    expect(summary1.reminders24h).toBeGreaterThanOrEqual(1);

    const reloaded = await Appointment.findById(appt._id);
    expect(reloaded.reminderSent24h).toBe(true);

    // Calling again should not re-dispatch (idempotent)
    const summary2 = await checkAndSendAppointmentReminders();
    expect(summary2.reminders24h).toBe(0);
  });
});
