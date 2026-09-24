import mongoose from "mongoose";
import crypto from "crypto";
import Transaction from "../models/Transaction.js";
import Appointment from "../models/Appointment.js";
import { triggerDashboardUpdate } from "../socket.js";
import { getRazorpayClient } from "../services/paymentService.js";

// ==========================================
// 1. CREATE ORDER
// ==========================================
export const createOrder = async (req, res, next) => {
  try {
    const { appointmentId, currency = "INR" } = req.body;

    if (!appointmentId) {
      return req.http.badRequest("Appointment ID is required");
    }

    // Verify appointment exists
    const appointment = await Appointment.findById(appointmentId)
      .populate("patientId", "name email phone")
      .populate("doctorId");

    if (!appointment) {
      return req.http.notFound("Appointment not found");
    }

    // Idempotency: Prevent re-paying for an already paid appointment
    if (appointment.paymentStatus === "paid") {
      return req.http.badRequest("This appointment has already been paid for.");
    }

    // SECURITY: Always fetch amount server-side (never trust user-submitted fee)
    const serverFee = appointment.amount ?? appointment.doctorId?.consultationFee;
    if (serverFee === undefined || serverFee === null || serverFee < 0) {
      return req.http.badRequest("Valid consultation fee could not be determined for this appointment.");
    }

    // Demo Mode bypass: MUST be explicitly permitted in non-production or DEMO_MODE flag
    const isDemoAllowed =
      (process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production") &&
      (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET);

    if (isDemoAllowed) {
      console.warn("⚠️ [Razorpay] Demo Mode active (non-production with missing keys). Simulating success.");
      await Appointment.findByIdAndUpdate(appointmentId, { paymentStatus: "paid" });
      if (appointment.doctorId) {
        const docUserId = appointment.doctorId.userId || appointment.doctorId;
        triggerDashboardUpdate(docUserId, "A payment was captured (Demo Mode)");
      }
      return req.http.ok({ demoMode: true }, "Demo Mode: Payment marked as successful");
    }

    // Get Razorpay client (throws clear error in production if keys are missing)
    const rzp = getRazorpayClient();
    if (!rzp) {
      return req.http.serverError("Razorpay payment gateway is not configured.");
    }

    // Convert fee to integer paise (amount * 100)
    const amountInPaise = Math.round(serverFee * 100);

    const options = {
      amount: amountInPaise,
      currency,
      receipt: `rcpt_${appointmentId.toString().slice(-8)}_${Date.now().toString().slice(-6)}`,
      notes: {
        appointmentId: appointmentId.toString(),
        patientId: appointment.patientId?._id?.toString() || "",
        doctorId: appointment.doctorId?._id?.toString() || "",
      },
    };

    const order = await rzp.orders.create(options);

    // Save pending Transaction record in MongoDB for auditing
    await Transaction.create({
      userId: req.user?._id || appointment.patientId?._id,
      appointmentId,
      orderId: order.id,
      amount: serverFee,
      currency,
      status: "created",
      customerDetails: {
        name: appointment.patientId?.name,
        email: appointment.patientId?.email,
        contact: appointment.patientId?.phone,
      },
    });

    console.log(
      `💳 [Razorpay] Order created: orderId=${order.id}, appt=${appointmentId}, amount=₹${serverFee} (${amountInPaise} paise)`
    );

    return req.http.ok(
      {
        orderId: order.id,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, appointmentId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return req.http.badRequest("Missing payment verification details");
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return req.http.serverError("Razorpay key secret not configured on server");
    }

    // Check existing transaction for Idempotency
    const existingTransaction = await Transaction.findOne({ orderId: razorpay_order_id });
    if (existingTransaction && existingTransaction.status === "captured") {
      console.log(`ℹ️ [Razorpay Verify] Order ${razorpay_order_id} already captured. Returning success (idempotent).`);
      return req.http.ok(
        { paymentId: existingTransaction.paymentId, status: "captured" },
        "Payment verified successfully (already processed)"
      );
    }

    // Verify HMAC-SHA256 signature server-side
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    let isAuthentic = false;
    try {
      isAuthentic = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "utf8"),
        Buffer.from(razorpay_signature, "utf8")
      );
    } catch {
      isAuthentic = false;
    }

    if (!isAuthentic) {
      console.error(`❌ [Razorpay Verify] Signature mismatch for order: ${razorpay_order_id}`);
      await Transaction.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { status: "failed", paymentId: razorpay_payment_id }
      );
      return req.http.badRequest("Payment signature verification failed");
    }

    // Mark Transaction as captured
    const transaction = await Transaction.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        status: "captured",
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      },
      { new: true }
    );

    const targetApptId = transaction?.appointmentId || appointmentId;
    if (targetApptId) {
      const appointment = await Appointment.findByIdAndUpdate(
        targetApptId,
        { paymentStatus: "paid" },
        { new: true }
      ).populate("doctorId");

      // Notify doctor via real-time WebSocket
      if (appointment?.doctorId) {
        const docUserId = appointment.doctorId.userId || appointment.doctorId;
        triggerDashboardUpdate(docUserId, "A consultation payment was successfully captured");
      }
    }

    console.log(
      `✅ [Razorpay Verify] Payment verified: orderId=${razorpay_order_id}, paymentId=${razorpay_payment_id}, appt=${targetApptId}`
    );

    return req.http.ok(
      { paymentId: razorpay_payment_id, status: "captured" },
      "Payment verified successfully"
    );
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
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("❌ [Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured.");
      return res.status(500).send("Webhook secret not configured");
    }

    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      return res.status(400).send("Missing x-razorpay-signature header");
    }

    // Use raw body buffer for cryptographically exact signature verification
    const rawPayload = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawPayload)
      .digest("hex");

    let isAuthentic = false;
    try {
      isAuthentic = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "utf8"),
        Buffer.from(signature, "utf8")
      );
    } catch {
      isAuthentic = false;
    }

    if (!isAuthentic) {
      console.error("❌ [Razorpay Webhook] Invalid webhook signature detected.");
      return res.status(400).send("Invalid webhook signature");
    }

    const event = req.body.event;
    const payload = req.body.payload;
    console.log(`🔔 [Razorpay Webhook] Verified event received: ${event}`);

    if (event === "payment.captured" || event === "payment.authorized" || event === "order.paid") {
      const paymentEntity = payload?.payment?.entity;
      const orderId = paymentEntity?.order_id || payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        // Idempotency: Check if already captured
        const existingTx = await Transaction.findOne({ orderId });
        if (existingTx && existingTx.status === "captured") {
          console.log(`ℹ️ [Razorpay Webhook] Order ${orderId} already captured. Skipping redundant write.`);
          return res.status(200).send("OK (Already processed)");
        }

        const transaction = await Transaction.findOneAndUpdate(
          { orderId },
          { status: "captured", paymentId: paymentId || existingTx?.paymentId },
          { new: true }
        );

        if (transaction?.appointmentId) {
          await Appointment.findByIdAndUpdate(
            transaction.appointmentId,
            { paymentStatus: "paid" }
          );
          console.log(`✅ [Razorpay Webhook] Appointment ${transaction.appointmentId} marked paid via webhook.`);
        }
      }
    } else if (event === "payment.failed") {
      const paymentEntity = payload?.payment?.entity;
      if (paymentEntity?.order_id) {
        await Transaction.findOneAndUpdate(
          { orderId: paymentEntity.order_id },
          { status: "failed", paymentId: paymentEntity.id }
        );
        console.log(`⚠️ [Razorpay Webhook] Order ${paymentEntity.order_id} marked as failed.`);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("[Razorpay Webhook Error]", err);
    return res.status(500).send("Webhook processing error");
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

    const rzp = getRazorpayClient();
    if (!rzp) {
      console.error("Razorpay client unavailable for refund");
      return false;
    }

    const refund = await rzp.payments.refund(transaction.paymentId, {
      amount: Math.round(transaction.amount * 100),
    });

    if (refund.status === "processed" || refund.status === "created") {
      transaction.status = "refunded";
      await transaction.save();
      console.log(`↩️ [Razorpay] Refund processed for appointment ${appointmentId}, paymentId=${transaction.paymentId}`);
      return true;
    }

    return false;
  } catch (err) {
    console.error("[Razorpay Refund Error]", err);
    return false;
  }
};
