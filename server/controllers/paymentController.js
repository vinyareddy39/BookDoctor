import Razorpay from "razorpay";
import mongoose from "mongoose";
import crypto from "crypto";
import Transaction from "../models/Transaction.js";
import Appointment from "../models/Appointment.js";
import { getIO, triggerDashboardUpdate } from "../socket.js";

// Initialize Razorpay instance lazily to avoid crash if keys are missing initially
const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay API keys are not configured.");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// ==========================================
// 1. CREATE ORDER
// ==========================================
export const createOrder = async (req, res, next) => {
  try {
    const { amount, currency = "INR", appointmentId } = req.body;

    if (!amount || !appointmentId) {
      return req.http.badRequest("Amount and Appointment ID are required");
    }

    // Verify appointment exists
    const appointment = await Appointment.findById(appointmentId).populate("patientId", "name email phone");
    if (!appointment) {
      return req.http.notFound("Appointment not found");
    }

    const rzp = getRazorpayInstance();

    // Create Razorpay order (amount is in paise)
    const options = {
      amount: amount * 100, 
      currency,
      receipt: `receipt_${appointmentId}`,
    };

    const order = await rzp.orders.create(options);

    // Create pending transaction in DB
    await Transaction.create({
      userId: req.user._id,
      appointmentId,
      orderId: order.id,
      amount,
      currency,
      status: "created",
      customerDetails: {
        name: appointment.patientId?.name,
        email: appointment.patientId?.email,
        contact: appointment.patientId?.phone,
      }
    });

    return req.http.ok(
      {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
      },
      "Order created successfully"
    );
  } catch (err) {
    console.error("[Razorpay Create Order Error]", err);
    next(err);
  }
};

// ==========================================
// 2. VERIFY PAYMENT (Called by Frontend after success)
// ==========================================
export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return req.http.badRequest("Missing payment verification details");
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      // Mark transaction as failed
      await Transaction.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { status: "failed", paymentId: razorpay_payment_id }
      );
      return req.http.badRequest("Payment signature verification failed");
    }

    // Mark transaction as captured
    const transaction = await Transaction.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        status: "captured",
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      },
      { new: true }
    );

    if (transaction) {
      // Mark appointment as paid
      const appointment = await Appointment.findByIdAndUpdate(
        transaction.appointmentId,
        { paymentStatus: "paid" },
        { new: true }
      );

      // Notify doctor
      if (appointment?.doctorId) {
        // Need to get the actual userId of the doctor
        const doctor = await mongoose.model("Doctor").findById(appointment.doctorId);
        if (doctor) {
          triggerDashboardUpdate(doctor.userId, "A payment was captured");
        }
      }
    }

    return req.http.ok(null, "Payment verified successfully");
  } catch (err) {
    console.error("[Razorpay Verify Error]", err);
    next(err);
  }
};

// ==========================================
// 3. WEBHOOK (Called by Razorpay asynchronously)
// ==========================================
export const razorpayWebhook = async (req, res, next) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(500).send("Webhook secret not configured");

    const signature = req.headers["x-razorpay-signature"];

    // Validate signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).send("Invalid signature");
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === "payment.captured" || event === "payment.authorized") {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;

      // Ensure transaction is updated
      const transaction = await Transaction.findOneAndUpdate(
        { orderId },
        { status: "captured", paymentId: paymentEntity.id },
        { new: true }
      );

      if (transaction) {
        await Appointment.findByIdAndUpdate(
          transaction.appointmentId,
          { paymentStatus: "paid" }
        );
      }
    } else if (event === "payment.failed") {
      const paymentEntity = payload.payment.entity;
      await Transaction.findOneAndUpdate(
        { orderId: paymentEntity.order_id },
        { status: "failed" }
      );
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("[Razorpay Webhook Error]", err);
    res.status(500).send("Webhook processing error");
  }
};

// ==========================================
// 4. REFUND PAYMENT
// ==========================================
export const refundPayment = async (appointmentId) => {
  try {
    const transaction = await Transaction.findOne({ appointmentId, status: "captured" });
    if (!transaction || !transaction.paymentId) {
      console.warn(`No captured payment found for appointment ${appointmentId}`);
      return false;
    }

    const rzp = getRazorpayInstance();
    const refund = await rzp.payments.refund(transaction.paymentId, {
      amount: transaction.amount * 100,
    });

    if (refund.status === "processed") {
      transaction.status = "refunded";
      await transaction.save();
      return true;
    }
    
    return false;
  } catch (err) {
    console.error("[Razorpay Refund Error]", err);
    return false; // Safely return false if refund fails (e.g. invalid payment state)
  }
};
