import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import mongoose from "mongoose";
import crypto from "crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import PaymentRecord from "../models/PaymentRecord.js";
import {
  markOfflinePayment,
  correctPayment,
  disputePayment,
  getDoctorPaymentsSummary,
} from "../controllers/appointmentController.js";
import {
  razorpayWebhook,
  getDirectUpiDetails,
  claimDirectUpiPayment,
  confirmDirectUpiPayment,
  updateDoctorUpiProfile,
} from "../controllers/paymentController.js";

let mongoServer;
let patientUser;
let doctorUser;
let doctorDoc;

const mockRes = () => {
  const res = {
    headers: {},
    statusCode: 200,
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.setHeader = (k, v) => {
    res.headers[k] = v;
  };
  res.send = (data) => {
    res.sendData = data;
    return res;
  };
  res.json = (data) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

const mockReq = (user, body = {}, params = {}, query = {}, headers = {}) => ({
  user,
  body,
  params,
  query,
  headers: headers || {},
  ip: "127.0.0.1",
  http: {
    ok: (data, msg) => ({ status: "success", data, message: msg }),
    badRequest: (msg) => ({ status: "fail", message: msg, statusCode: 400 }),
    conflict: (msg) => ({ status: "fail", message: msg, statusCode: 409 }),
    forbidden: (msg) => ({ status: "fail", message: msg, statusCode: 403 }),
    notFound: (msg) => ({ status: "fail", message: msg, statusCode: 404 }),
  },
});

describe("Phase 3: Payments & Offline Payment Marking Tests", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    patientUser = await User.create({
      name: "Rahul Roy",
      email: "rahul@example.com",
      role: "patient",
      password: "Password123!",
      phone: "+919811223344",
    });

    doctorUser = await User.create({
      name: "Dr. Vikram Seth",
      email: "vikram@example.com",
      role: "doctor",
      password: "Password123!",
      phone: "+919811223345",
    });

    doctorDoc = await Doctor.create({
      userId: doctorUser._id,
      specialization: "Cardiologist",
      experience: 12,
      consultationFee: 750,
      availableDays: ["Monday", "Tuesday", "Wednesday"],
      timeSlots: ["10:00 AM", "11:00 AM"],
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("1. Doctor records offline payment (Cash at clinic) -> generates receipt and updates appointment", async () => {
    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: new Date(),
      appointmentTime: "10:00 AM",
      amount: 750,
      status: "confirmed",
      paymentStatus: "pending",
    });

    const req = mockReq(doctorUser, {
      amount: 750,
      paymentMode: "cash",
      notes: "Received at reception counter",
    }, { id: appt._id });

    const result = await markOfflinePayment(req, mockRes(), (e) => { throw e; });
    expect(result.status).toBe("success");
    expect(result.data.appointment.paymentStatus).toBe("paid");
    expect(result.data.appointment.paymentMode).toBe("cash");
    expect(result.data.paymentRecord.receiptNumber).toMatch(/^RCP-/);

    const reloaded = await Appointment.findById(appt._id);
    expect(reloaded.amountPaid).toBe(750);
    expect(reloaded.offlinePaymentReceipt).toBeTruthy();
    expect(reloaded.changeHistory.some(c => c.changeType === "payment_marked")).toBe(true);
  });

  it("2. Doctor corrects payment with audit reason -> records correction history", async () => {
    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: new Date(),
      appointmentTime: "11:00 AM",
      amount: 750,
      amountPaid: 750,
      paymentMode: "cash",
      status: "completed",
      paymentStatus: "paid",
    });

    const paymentRecord = await PaymentRecord.create({
      appointmentId: appt._id,
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      amount: 750,
      paymentMode: "cash",
      paymentStatus: "paid",
      markedBy: doctorUser._id,
      markedRole: "doctor",
    });

    // Attempt without reason -> fails
    const reqNoReason = mockReq(doctorUser, { newAmount: 650, reason: "" }, { id: appt._id });
    const failRes = await correctPayment(reqNoReason, mockRes(), (e) => { throw e; });
    expect(failRes.statusCode).toBe(400);

    // Provide mandatory reason
    const reqWithReason = mockReq(doctorUser, {
      newAmount: 650,
      newMode: "upi_clinic",
      reason: "Patient applied senior citizen discount coupon post consultation",
    }, { id: appt._id });

    const successRes = await correctPayment(reqWithReason, mockRes(), (e) => { throw e; });
    expect(successRes.status).toBe("success");

    const updatedRecord = await PaymentRecord.findById(paymentRecord._id);
    expect(updatedRecord.amount).toBe(650);
    expect(updatedRecord.paymentMode).toBe("upi_clinic");
    expect(updatedRecord.corrections.length).toBe(1);
    expect(updatedRecord.corrections[0].reason).toContain("senior citizen discount");

    const updatedAppt = await Appointment.findById(appt._id);
    expect(updatedAppt.amountPaid).toBe(650);
    expect(updatedAppt.paymentMode).toBe("upi_clinic");
    expect(updatedAppt.changeHistory.some(c => c.changeType === "payment_corrected")).toBe(true);
  });

  it("3. Patient disputes payment -> flags record and notifies clinic", async () => {
    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: new Date(),
      appointmentTime: "10:00 AM",
      amount: 750,
      amountPaid: 750,
      paymentMode: "cash",
      status: "completed",
      paymentStatus: "paid",
    });

    const record = await PaymentRecord.create({
      appointmentId: appt._id,
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      amount: 750,
      paymentMode: "cash",
      markedBy: doctorUser._id,
      markedRole: "doctor",
    });

    const disputeReq = mockReq(patientUser, {
      reason: "I paid via UPI ID instead of Cash, please reconcile",
    }, { id: appt._id });

    const res = await disputePayment(disputeReq, mockRes(), (e) => { throw e; });
    expect(res.status).toBe("success");

    const updatedRecord = await PaymentRecord.findById(record._id);
    expect(updatedRecord.dispute.isDisputed).toBe(true);
    expect(updatedRecord.dispute.reason).toContain("UPI ID instead of Cash");
  });

  it("4. Doctor payments summary aggregates online vs offline breakdown and exports CSV", async () => {
    const reqJson = mockReq(doctorUser, {}, {}, {});
    const summaryRes = await getDoctorPaymentsSummary(reqJson, mockRes(), (e) => { throw e; });
    expect(summaryRes.status).toBe("success");
    expect(summaryRes.data.totals).toHaveProperty("totalRevenue");
    expect(summaryRes.data.totals).toHaveProperty("cashTotal");
    expect(summaryRes.data.totals).toHaveProperty("upiClinicTotal");

    // CSV format
    const reqCsv = mockReq(doctorUser, {}, {}, { format: "csv" });
    const resCsv = mockRes();
    await getDoctorPaymentsSummary(reqCsv, resCsv, (e) => { throw e; });
    expect(resCsv.headers["Content-Type"]).toBe("text/csv");
    expect(resCsv.sendData).toContain("ID,Date,Time,Patient,Amount,AmountPaid,PaymentStatus,PaymentMode,Source,Receipt,ClaimedUTR,DuplicateFlag");
  });

  it("5. Razorpay Webhook rejects invalid signatures with 400", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_key_123";

    const body = {
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_fake_123", amount: 50000 } } },
    };

    const req = mockReq(
      null,
      body,
      {},
      {},
      { "x-razorpay-signature": "invalid_fake_signature_hex" }
    );
    const res = mockRes();

    await razorpayWebhook(req, res, (e) => { throw e; });
    expect(res.statusCode).toBe(400);
    expect(res.sendData).toContain("Invalid webhook signature");
  });

  it("6. Razorpay Webhook captures payment and enforces idempotency with duplicate event ID", async () => {
    const webhookSecret = "test_webhook_secret_key_123";
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: new Date(),
      appointmentTime: "02:00 PM",
      amount: 500,
      status: "confirmed",
      paymentStatus: "unpaid",
    });

    const eventId = `evt_test_${Date.now()}`;
    const orderId = `order_test_${Date.now()}`;
    const paymentId = `pay_test_${Date.now()}`;

    const body = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: 50000,
            notes: { appointmentId: appt._id.toString() },
          },
        },
      },
    };

    const rawPayload = JSON.stringify(body);
    const validSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawPayload)
      .digest("hex");

    const req1 = mockReq(
      null,
      body,
      {},
      {},
      {
        "x-razorpay-signature": validSignature,
        "x-razorpay-event-id": eventId,
      }
    );
    req1.rawBody = Buffer.from(rawPayload);
    const res1 = mockRes();

    await razorpayWebhook(req1, res1, (e) => { throw e; });
    expect(res1.statusCode).toBe(200);

    const updatedAppt = await Appointment.findById(appt._id);
    expect(updatedAppt.paymentStatus).toBe("paid");
    expect(updatedAppt.paymentMode).toBe("online");
    expect(updatedAppt.paymentSource).toBe("gateway");

    // Second call with identical eventId must be ignored idempotently
    const req2 = mockReq(
      null,
      body,
      {},
      {},
      {
        "x-razorpay-signature": validSignature,
        "x-razorpay-event-id": eventId,
      }
    );
    req2.rawBody = Buffer.from(rawPayload);
    const res2 = mockRes();

    await razorpayWebhook(req2, res2, (e) => { throw e; });
    expect(res2.statusCode).toBe(200);
    expect(res2.sendData).toContain("Duplicate event ignored");
  });

  it("7. Online payment after offline marked paid flags duplicate payment review and notifies doctor", async () => {
    const webhookSecret = "test_webhook_secret_key_123";
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

    // Appointment already marked Paid offline via Cash
    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: new Date(),
      appointmentTime: "03:00 PM",
      amount: 600,
      amountPaid: 600,
      status: "completed",
      paymentStatus: "paid",
      paymentMode: "cash",
      paymentSource: "offline_marked",
    });

    const orderId = `order_dup_${Date.now()}`;
    const paymentId = `pay_dup_${Date.now()}`;
    const eventId = `evt_dup_${Date.now()}`;

    const body = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: 60000,
            notes: { appointmentId: appt._id.toString() },
          },
        },
      },
    };

    const rawPayload = JSON.stringify(body);
    const validSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawPayload)
      .digest("hex");

    const req = mockReq(
      null,
      body,
      {},
      {},
      {
        "x-razorpay-signature": validSignature,
        "x-razorpay-event-id": eventId,
      }
    );
    req.rawBody = Buffer.from(rawPayload);
    const res = mockRes();

    await razorpayWebhook(req, res, (e) => { throw e; });
    expect(res.statusCode).toBe(200);

    const reloaded = await Appointment.findById(appt._id);
    expect(reloaded.duplicatePaymentFlag).toBe(true);
    expect(reloaded.duplicatePaymentReview.flagged).toBe(true);
    expect(reloaded.duplicatePaymentReview.amount).toBe(600);
    // Keeps offline payment status intact without silent overwrite
    expect(reloaded.paymentMode).toBe("cash");

    const dupRecord = await PaymentRecord.findOne({ duplicateFlag: true, appointmentId: appt._id });
    expect(dupRecord).toBeTruthy();
    expect(dupRecord.duplicateDetails.refundStatus).toBe("pending_refund");
  });

  it("8. Doctor updates direct UPI VPA profile with validation", async () => {
    // Valid update
    const validReq = mockReq(doctorUser, {
      upiId: "dr.vikram@oksbi",
      payeeName: "Dr. Vikram Seth",
      acceptsDirectUpi: true,
    });
    const validRes = await updateDoctorUpiProfile(validReq, mockRes(), (e) => { throw e; });
    expect(validRes.status).toBe("success");
    expect(validRes.data.upiId).toBe("dr.vikram@oksbi");
    expect(validRes.data.acceptsDirectUpi).toBe(true);

    const doc = await Doctor.findOne({ userId: doctorUser._id });
    expect(doc.upiId).toBe("dr.vikram@oksbi");
    expect(doc.acceptsDirectUpi).toBe(true);

    // Invalid VPA format fails with 400
    const invalidReq = mockReq(doctorUser, { upiId: "invalid-vpa-without-at" });
    const invalidRes = await updateDoctorUpiProfile(invalidReq, mockRes(), (e) => { throw e; });
    expect(invalidRes.statusCode).toBe(400);
  });

  it("9. Patient claims direct UPI payment -> status is 'claimed', NEVER 'paid'", async () => {
    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: new Date(),
      appointmentTime: "04:00 PM",
      amount: 750,
      status: "confirmed",
      paymentStatus: "unpaid",
    });

    const claimReq = mockReq(
      patientUser,
      { utr: "123456789012", screenshotUrl: "https://example.com/receipt.png" },
      { id: appt._id }
    );
    const res = await claimDirectUpiPayment(claimReq, mockRes(), (e) => { throw e; });
    expect(res.status).toBe("success");

    const reloaded = await Appointment.findById(appt._id);
    expect(reloaded.paymentStatus).toBe("claimed");
    expect(reloaded.paymentMode).toBe("upi_direct");
    expect(reloaded.paymentSource).toBe("direct_upi");
    expect(reloaded.claimedPayment.utr).toBe("123456789012");
    // CRITICAL SAFETY RULE: Never marked as paid on patient word alone!
    expect(reloaded.paymentStatus).not.toBe("paid");

    const record = await PaymentRecord.findOne({ appointmentId: appt._id, paymentStatus: "claimed" });
    expect(record).toBeTruthy();
    expect(record.utr).toBe("123456789012");
  });

  it("10. Doctor confirms direct UPI payment -> status becomes 'paid' (Paid · UPI)", async () => {
    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: new Date(),
      appointmentTime: "05:00 PM",
      amount: 750,
      status: "confirmed",
      paymentStatus: "claimed",
      paymentMode: "upi_direct",
    });

    await PaymentRecord.create({
      appointmentId: appt._id,
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      amount: 750,
      paymentMode: "upi_direct",
      paymentStatus: "claimed",
      source: "direct_upi",
      utr: "998877665544",
      claimedBy: patientUser._id,
    });

    const confirmReq = mockReq(doctorUser, { action: "confirm" }, { id: appt._id });
    const res = await confirmDirectUpiPayment(confirmReq, mockRes(), (e) => { throw e; });
    expect(res.status).toBe("success");

    const reloaded = await Appointment.findById(appt._id);
    expect(reloaded.paymentStatus).toBe("paid");
    expect(reloaded.paymentMode).toBe("upi_direct");
    expect(reloaded.amountPaid).toBe(750);

    const updatedRecord = await PaymentRecord.findOne({ appointmentId: appt._id, paymentStatus: "paid" });
    expect(updatedRecord).toBeTruthy();
    expect(String(updatedRecord.confirmedBy)).toBe(String(doctorUser._id));
  });

  it("11. Doctor rejects direct UPI payment without reason -> fails; with reason -> resets to 'unpaid'", async () => {
    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: new Date(),
      appointmentTime: "06:00 PM",
      amount: 750,
      status: "confirmed",
      paymentStatus: "claimed",
      paymentMode: "upi_direct",
    });

    // Rejection without reason fails
    const failReq = mockReq(doctorUser, { action: "reject", reason: "" }, { id: appt._id });
    const failRes = await confirmDirectUpiPayment(failReq, mockRes(), (e) => { throw e; });
    expect(failRes.statusCode).toBe(400);

    // Rejection with mandatory reason succeeds and resets to unpaid
    const successReq = mockReq(
      doctorUser,
      { action: "reject", reason: "UTR not found in bank statement" },
      { id: appt._id }
    );
    const successRes = await confirmDirectUpiPayment(successReq, mockRes(), (e) => { throw e; });
    expect(successRes.status).toBe("success");

    const reloaded = await Appointment.findById(appt._id);
    expect(reloaded.paymentStatus).toBe("unpaid");
    expect(reloaded.paymentMode).toBe("none");
  });

  it("12. Non-assigned doctor cannot confirm payment for another doctor (403)", async () => {
    const anotherDoctorUser = await User.create({
      name: "Dr. Another Doctor",
      email: "another_doc@example.com",
      role: "doctor",
      password: "Password123!",
      phone: "+919811223399",
    });

    await Doctor.create({
      userId: anotherDoctorUser._id,
      specialization: "Dermatologist",
      experience: 5,
      consultationFee: 500,
    });

    const appt = await Appointment.create({
      patientId: patientUser._id,
      doctorId: doctorDoc._id,
      appointmentDate: new Date(),
      appointmentTime: "07:00 PM",
      amount: 750,
      status: "confirmed",
      paymentStatus: "claimed",
      paymentMode: "upi_direct",
    });

    const forbiddenReq = mockReq(anotherDoctorUser, { action: "confirm" }, { id: appt._id });
    const forbiddenRes = await confirmDirectUpiPayment(forbiddenReq, mockRes(), (e) => { throw e; });
    expect(forbiddenRes.statusCode).toBe(403);
  });
});
