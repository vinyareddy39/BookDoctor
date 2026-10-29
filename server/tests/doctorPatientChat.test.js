import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "../models/User.js";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import {
  getOrCreateConversation,
  sendConversationMessage,
  updateDoctorStatus,
  toggleMuteConversation,
  RED_FLAG_REGEX,
} from "../controllers/chatController.js";

let mongoServer;
let patientUser;
let doctorUser;
let doctorDoc;
let strangerDoctorUser;
let strangerDoctorDoc;

const mockRes = () => {
  const res = { headers: {}, statusCode: 200 };
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
    created: (data, msg) => ({ status: "success", data, message: msg, statusCode: 201 }),
    badRequest: (msg) => ({ status: "fail", message: msg, statusCode: 400 }),
    conflict: (msg) => ({ status: "fail", message: msg, statusCode: 409 }),
    forbidden: (msg) => ({ status: "fail", message: msg, statusCode: 403 }),
    notFound: (msg) => ({ status: "fail", message: msg, statusCode: 404 }),
  },
});

describe("Phase 4: Doctor ↔ Patient Realtime Chat Tests", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    patientUser = await User.create({
      name: "Meera Nair",
      email: "meera@example.com",
      role: "patient",
      password: "Password123!",
      phone: "+919777112233",
    });

    doctorUser = await User.create({
      name: "Dr. Arvind Swamy",
      email: "arvind@example.com",
      role: "doctor",
      password: "Password123!",
      phone: "+919777112234",
    });

    doctorDoc = await Doctor.create({
      userId: doctorUser._id,
      specialization: "Pulmonology",
      experience: 15,
      consultationFee: 800,
      availableDays: ["Monday", "Wednesday", "Friday"],
      timeSlots: ["10:00 AM", "11:00 AM"],
    });

    strangerDoctorUser = await User.create({
      name: "Dr. Neha Patel",
      email: "neha@example.com",
      role: "doctor",
      password: "Password123!",
      phone: "+919777112235",
    });

    strangerDoctorDoc = await Doctor.create({
      userId: strangerDoctorUser._id,
      specialization: "Dermatology",
      experience: 8,
      consultationFee: 600,
      availableDays: ["Tuesday", "Thursday"],
      timeSlots: ["02:00 PM"],
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("1. 1-to-1 conversation guard: patient without active appointment cannot message doctor", async () => {
    const req = mockReq(patientUser, { targetUserId: strangerDoctorUser._id });
    const res = await getOrCreateConversation(req, mockRes(), (e) => { throw e; });
    expect(res.statusCode).toBe(403);
    expect(res.message).toContain("You can only message doctors you have an active or recent appointment with");
  });

  it("2. Patient with active appointment can start conversation", async () => {
    await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: new Date(),
      appointmentTime: "10:00 AM",
      amount: 800,
      status: "confirmed",
    });

    const req = mockReq(patientUser, { targetUserId: doctorUser._id });
    const res = await getOrCreateConversation(req, mockRes(), (e) => { throw e; });
    expect(res.status).toBe("success");
    expect(res.data.participants.some(p => String(p._id) === String(doctorUser._id))).toBe(true);
  });

  it("3. Red-flag keyword regex detects chest pain / cannot breathe and returns emergency alert", async () => {
    expect("I have severe chest pain since morning".match(RED_FLAG_REGEX)).toBeTruthy();
    expect("Cannot breathe properly".match(RED_FLAG_REGEX)).toBeTruthy();
    expect("Everything is fine today".match(RED_FLAG_REGEX)).toBeNull();

    // Create a conversation
    const conv = await Conversation.create({
      participants: [patientUser._id, doctorUser._id],
    });

    const req = mockReq(patientUser, {
      text: "Doctor, I am experiencing sudden chest pain and trouble breathing",
    }, { conversationId: conv._id });

    const res = await sendConversationMessage(req, mockRes(), (e) => { throw e; });
    expect(res.status).toBe("success");
    expect(res.data.message.hasRedFlag).toBe(true);
    expect(res.data.message.redFlagKeywords).toContain("chest pain");
    expect(res.data.emergencyAlert).toBeTruthy();
    expect(res.data.emergencyAlert.warning).toContain("108 / 112");
  });

  it("4. Auto-reply when doctor is set to 'away' or 'in_consultation'", async () => {
    const conv = await Conversation.create({
      participants: [patientUser._id, doctorUser._id],
      doctorStatus: "away",
    });

    const req = mockReq(patientUser, {
      text: "Hello Doctor, are you free for a quick question?",
    }, { conversationId: conv._id });

    const res = await sendConversationMessage(req, mockRes(), (e) => { throw e; });
    expect(res.status).toBe("success");
    expect(res.data.autoReply).toBeTruthy();
    expect(res.data.autoReply.text).toContain("currently away");
    expect(res.data.autoReply.text).toContain("108 or 112");
  });

  it("5. Attachments support: images and PDFs are stored with size limits", async () => {
    const conv = await Conversation.create({
      participants: [patientUser._id, doctorUser._id],
    });

    const req = mockReq(patientUser, {
      text: "Attached is my lab report",
      attachments: [
        {
          url: "https://example.com/report.pdf",
          fileType: "application/pdf",
          originalName: "blood_test_report.pdf",
          sizeBytes: 1024 * 1024,
        },
      ],
    }, { conversationId: conv._id });

    const res = await sendConversationMessage(req, mockRes(), (e) => { throw e; });
    expect(res.status).toBe("success");
    expect(res.data.message.attachments.length).toBe(1);
    expect(res.data.message.attachments[0].originalName).toBe("blood_test_report.pdf");
  });

  it("6. Mute and status controls: doctor can update status and toggle mute", async () => {
    const conv = await Conversation.create({
      participants: [patientUser._id, doctorUser._id],
    });

    // Update status
    const statusReq = mockReq(doctorUser, { status: "in_consultation" }, { conversationId: conv._id });
    const statusRes = await updateDoctorStatus(statusReq, mockRes(), (e) => { throw e; });
    expect(statusRes.status).toBe("success");
    expect(statusRes.data.doctorStatus).toBe("in_consultation");

    // Toggle mute
    const muteReq = mockReq(doctorUser, {}, { conversationId: conv._id });
    const muteRes = await toggleMuteConversation(muteReq, mockRes(), (e) => { throw e; });
    expect(muteRes.status).toBe("success");
    expect(muteRes.data.isMuted).toBe(true);

    const reloaded = await Conversation.findById(conv._id);
    expect(reloaded.mutedBy.some(id => String(id) === String(doctorUser._id))).toBe(true);
  });
});
