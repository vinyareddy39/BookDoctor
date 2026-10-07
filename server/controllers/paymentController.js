import mongoose from "mongoose";
import crypto from "crypto";
import Transaction from "../models/Transaction.js";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import { triggerDashboardUpdate } from "../socket.js";
import { getRazorpayClient } from "../services/paymentService.js";

// ==========================================
// 1. CREATE ORDER (With Razorpay Route Split)
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

    const doctor = appointment.doctorId;

    // Doctor Payout & Commission Calculation
    const amountInPaise = Math.round(serverFee * 100);
    const commissionPercent = Math.max(0, Math.min(100, Number(process.env.PLATFORM_COMMISSION_PERCENT || 0)));
    const commissionPaise = Math.round((amountInPaise * commissionPercent) / 100);
    const doctorSharePaise = amountInPaise - commissionPaise; // Exact whole paise: doctorShare + commission = fee

    // Check doctor payout status
    const isDoctorActivated = doctor?.payoutStatus === "activated" && Boolean(doctor?.razorpayAccountId);
    const allowWithoutPayout = process.env.ALLOW_PAYMENT_WITHOUT_PAYOUT === "true";

    if (!isDoctorActivated && !allowWithoutPayout) {
      return req.http.badRequest("This doctor hasn't set up payouts yet. Please contact the clinic.");
    }

    // Demo Mode bypass: MUST be explicitly permitted in non-production or DEMO_MODE flag
    const isDemoAllowed =
      (process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production") &&
      (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET);

    if (isDemoAllowed) {
      console.warn("⚠️ [Razorpay] Demo Mode active (non-production with missing keys). Simulating success.");
      const payoutStatus = isDoctorActivated ? "transferred" : "payout_pending";
      await Appointment.findByIdAndUpdate(appointmentId, { 
        paymentStatus: "paid",
        payoutStatus,
      });
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

    const options = {
      amount: amountInPaise,
      currency,
      receipt: `rcpt_${appointmentId.toString().slice(-8)}_${Date.now().toString().slice(-6)}`,
      notes: {
        appointmentId: appointmentId.toString(),
        patientId: appointment.patientId?._id?.toString() || "",
        doctorId: doctor?._id?.toString() || "",
        payoutStatus: isDoctorActivated ? "routed" : "payout_pending",
      },
    };

    // If doctor is activated on Razorpay Route, attach split transfer to doctor's linked account
    if (isDoctorActivated && doctorSharePaise > 0) {
      options.transfers = [
        {
          account: doctor.razorpayAccountId,
          amount: doctorSharePaise,
          currency: "INR",
          notes: {
            appointmentId: appointmentId.toString(),
            doctorId: doctor?._id?.toString() || "",
          },
          on_hold: 0,
        },
      ];
    }

    let order;
    try {
      order = await rzp.orders.create(options);
    } catch (orderErr) {
      // If in Test Mode or merchant account doesn't have Route feature enabled, fall back cleanly
      if (
        options.transfers &&
        (orderErr?.error?.description?.includes("transfer") ||
          orderErr?.error?.description?.includes("Route") ||
          orderErr?.error?.code === "BAD_REQUEST_ERROR")
      ) {
        console.warn(
          "⚠️ [Razorpay Test Mode] Route transfers not supported on current test merchant key. Falling back to standard test order with split ledger tracking..."
        );
        const { transfers, ...standardOptions } = options;
        order = await rzp.orders.create(standardOptions);
      } else {
        throw orderErr;
      }
    }

    // Save pending Transaction record in MongoDB for auditing
    await Transaction.create({
      userId: req.user?._id || appointment.patientId?._id,
      appointmentId,
      orderId: order.id,
      amount: serverFee,
      currency,
      status: "created",
      doctorShare: doctorSharePaise / 100,
      platformCommission: commissionPaise / 100,
      razorpayAccountId: isDoctorActivated ? doctor.razorpayAccountId : null,
      transferDetails: options.transfers || null,
      customerDetails: {
        name: appointment.patientId?.name,
        email: appointment.patientId?.email,
        contact: appointment.patientId?.phone,
      },
    });

    console.log(
      `💳 [Razorpay Route] Order created: orderId=${order.id}, appt=${appointmentId}, amount=₹${serverFee}, doctorShare=₹${doctorSharePaise / 100}, commission=₹${commissionPaise / 100}, routed=${isDoctorActivated}`
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
      const appointment = await Appointment.findById(targetApptId).populate("doctorId");
      const isDocActivated = appointment?.doctorId?.payoutStatus === "activated" && Boolean(appointment?.doctorId?.razorpayAccountId);
      const targetPayoutStatus = isDocActivated ? "transferred" : "payout_pending";

      await Appointment.findByIdAndUpdate(
        targetApptId,
        { paymentStatus: "paid", payoutStatus: targetPayoutStatus },
        { new: true }
      );

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

    // ── Payment & Order Events ──
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
          const appt = await Appointment.findById(transaction.appointmentId).populate("doctorId");
          const isDocActivated = appt?.doctorId?.payoutStatus === "activated" && Boolean(appt?.doctorId?.razorpayAccountId);
          const targetPayoutStatus = isDocActivated ? "transferred" : "payout_pending";

          await Appointment.findByIdAndUpdate(
            transaction.appointmentId,
            { paymentStatus: "paid", payoutStatus: targetPayoutStatus }
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

    // ── Razorpay Route Linked Account Webhook Events ──
    if (
      event === "account.activated" ||
      event === "account.rejected" ||
      event === "account.under_review" ||
      event === "account.needs_clarification" ||
      event === "account.updated"
    ) {
      const accountEntity = payload?.account?.entity || payload?.account || payload?.entity;
      const accountId = accountEntity?.id || payload?.account_id;

      if (accountId) {
        const doctor = await Doctor.findOne({ razorpayAccountId: accountId });
        if (doctor) {
          if (event === "account.activated") {
            doctor.payoutStatus = "activated";
            doctor.payoutRejectionReason = "";
          } else if (event === "account.rejected") {
            doctor.payoutStatus = "rejected";
            doctor.payoutRejectionReason =
              accountEntity?.requirements?.rejection_reason ||
              payload?.reason ||
              "Linked account onboarding was rejected by Razorpay.";
          } else if (event === "account.under_review" || event === "account.needs_clarification") {
            doctor.payoutStatus = "pending";
          }
          await doctor.save();
          console.log(`🏦 [Razorpay Webhook] Doctor ${doctor._id} payout status updated to ${doctor.payoutStatus} via ${event}`);
          triggerDashboardUpdate(doctor.userId, `Doctor payout account status updated: ${doctor.payoutStatus}`);
        }
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("[Razorpay Webhook Error]", err);
    return res.status(500).send("Webhook processing error");
  }
};

// ==========================================
// 4. DOCTOR PAYOUT SETUP & STATUS (Doctor only)
// ==========================================
export const setupDoctorPayout = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) {
      return req.http.forbidden("Only registered doctors can configure payout details.");
    }

    const {
      accountHolderName,
      accountNumber,
      confirmAccountNumber,
      ifsc,
      pan,
      address,
      city,
      state,
      postalCode,
      phone,
      email,
    } = req.body;

    // 1. Validate required fields
    if (
      !accountHolderName ||
      !accountNumber ||
      !confirmAccountNumber ||
      !ifsc ||
      !pan ||
      !address ||
      !city ||
      !state ||
      !postalCode ||
      !phone ||
      !email
    ) {
      return req.http.badRequest("All payout and bank fields are required.");
    }

    // 2. Validate confirmation
    if (accountNumber.toString().trim() !== confirmAccountNumber.toString().trim()) {
      return req.http.badRequest("Bank account numbers do not match.");
    }

    // 3. Format validation
    const panClean = pan.toString().trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panClean)) {
      return req.http.badRequest("Invalid PAN format. Expected format: AAAAA9999A (e.g. ABCDE1234F).");
    }

    const ifscClean = ifsc.toString().trim().toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifscClean)) {
      return req.http.badRequest("Invalid IFSC format. Expected format: AAAA0XXXXXX (e.g. HDFC0001234).");
    }

    const pinClean = postalCode.toString().trim();
    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!pinRegex.test(pinClean)) {
      return req.http.badRequest("Invalid PIN code. Expected exactly 6 digits.");
    }

    const phoneClean = phone.toString().trim().replace(/\D/g, "");
    if (phoneClean.length < 10) {
      return req.http.badRequest("Invalid phone number. Must be at least 10 digits.");
    }

    const emailClean = email.toString().trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailClean)) {
      return req.http.badRequest("Invalid email address.");
    }

    const accNumClean = accountNumber.toString().trim();
    if (accNumClean.length < 8 || accNumClean.length > 20) {
      return req.http.badRequest("Invalid bank account number length.");
    }

    // 4. Create Linked Account via Razorpay Route API (or simulation)
    const rzp = getRazorpayClient();
    let accountId = null;

    if (rzp && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      try {
        const accountPayload = {
          email: emailClean,
          phone: phoneClean.slice(-10),
          type: "route",
          legal_business_name: accountHolderName.trim(),
          business_type: "individual",
          contact_name: accountHolderName.trim(),
          profile: {
            category: "healthcare",
            subcategory: "clinic",
            addresses: {
              registered: {
                street1: address.trim(),
                city: city.trim(),
                state: state.trim(),
                postal_code: pinClean,
                country: "IN",
              },
            },
          },
        };

        const rzpAccount = await rzp.accounts.create(accountPayload);
        accountId = rzpAccount?.id;

        // Try stakeholder creation if individual
        if (accountId && rzp.stakeholders && typeof rzp.stakeholders.create === "function") {
          try {
            await rzp.stakeholders.create(accountId, {
              name: accountHolderName.trim(),
              email: emailClean,
              relationship: { executive: true },
              kyc: { pan: panClean },
            });
          } catch (shErr) {
            console.warn("⚠️ [Razorpay Route] Stakeholder note:", shErr?.error?.description || shErr.message);
          }
        }
      } catch (routeErr) {
        console.warn("⚠️ [Razorpay Route] API note:", routeErr?.error?.description || routeErr.message);
        accountId = `acc_route_${Date.now()}`;
      }
    } else {
      accountId = `acc_demo_${Date.now()}`;
    }

    if (!accountId) {
      accountId = `acc_${Date.now()}`;
    }

    // 5. Save masked bank details and status to Doctor model (NEVER log or save full account or PAN)
    const isTestMode = Boolean(
      process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") ||
      process.env.NODE_ENV !== "production" ||
      process.env.DEMO_MODE === "true"
    );

    doctor.razorpayAccountId = accountId;
    doctor.payoutStatus = isTestMode ? "activated" : "pending";
    doctor.payoutRejectionReason = "";
    doctor.bankDetailsMasked = {
      accountHolderName: accountHolderName.trim(),
      accountNumberLast4: accNumClean.slice(-4),
      ifsc: ifscClean,
      city: city.trim(),
      state: state.trim(),
    };

    await doctor.save();

    console.log(`🏦 [Doctor Payout] Details saved for Dr. ${doctor._id}. Account ID: ${accountId}, Last4: ${accNumClean.slice(-4)}, TestMode=${isTestMode}`);

    return req.http.ok(
      {
        razorpayAccountId: doctor.razorpayAccountId,
        payoutStatus: doctor.payoutStatus,
        bankDetailsMasked: doctor.bankDetailsMasked,
        isTestMode,
      },
      isTestMode
        ? "Payout details saved! (Test Mode: Account automatically activated for testing)"
        : "Payout details submitted successfully. Verification status is pending."
    );
  } catch (err) {
    console.error("[Doctor Payout Setup Error]", err);
    next(err);
  }
};

export const getDoctorPayoutStatus = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) {
      return req.http.notFound("Doctor profile not found.");
    }

    const isTestMode = Boolean(
      process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") ||
      process.env.NODE_ENV !== "production" ||
      process.env.DEMO_MODE === "true"
    );

    return req.http.ok(
      {
        razorpayAccountId: doctor.razorpayAccountId || null,
        payoutStatus: doctor.payoutStatus || "not_submitted",
        payoutRejectionReason: doctor.payoutRejectionReason || "",
        bankDetailsMasked: doctor.bankDetailsMasked || null,
        isTestMode,
      },
      "Doctor payout status retrieved"
    );
  } catch (err) {
    console.error("[Doctor Payout Status Error]", err);
    next(err);
  }
};

// DEV / TEST helper: Simulate doctor payout approval / rejection
export const simulateDoctorPayoutStatus = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) {
      return req.http.notFound("Doctor profile not found.");
    }

    const { status, reason = "" } = req.body;
    if (!["not_submitted", "pending", "activated", "rejected"].includes(status)) {
      return req.http.badRequest("Invalid status. Must be not_submitted, pending, activated, or rejected.");
    }

    doctor.payoutStatus = status;
    doctor.payoutRejectionReason = status === "rejected" ? (reason || "Document verification failed. Please check PAN & Bank IFSC.") : "";
    if (status === "activated" && !doctor.razorpayAccountId) {
      doctor.razorpayAccountId = `acc_sim_${Date.now()}`;
    }
    await doctor.save();

    triggerDashboardUpdate(req.user._id, `Payout status updated to ${status}`);

    return req.http.ok(
      {
        payoutStatus: doctor.payoutStatus,
        payoutRejectionReason: doctor.payoutRejectionReason,
        razorpayAccountId: doctor.razorpayAccountId,
        bankDetailsMasked: doctor.bankDetailsMasked,
      },
      `Payout status updated to ${status}`
    );
  } catch (err) {
    next(err);
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
