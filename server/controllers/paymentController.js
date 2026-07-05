import Razorpay from "razorpay";
import crypto from "crypto";
import Payment from "../models/Payment.js";
import Appointment from "../models/Appointment.js";

// Initialize Razorpay
const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay API keys are missing in the environment config.");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// CREATE ORDER
export const createOrder = async (req, res, next) => {
  try {
    const { amount, appointmentId } = req.body;
    if (!amount || !appointmentId) {
      return req.http.badRequest("Amount and appointmentId are required.");
    }

    const instance = getRazorpayInstance();
    const options = {
      amount: Math.round(amount * 100), // in paisa
      currency: "INR",
      receipt: `receipt_${appointmentId}`,
    };

    const order = await instance.orders.create(options);

    // Save initial payment record
    await Payment.create({
      appointmentId,
      userId: req.user._id,
      razorpayOrderId: order.id,
      amount,
      status: "created",
    });

    return req.http.ok(order, "Razorpay order created successfully");
  } catch (err) {
    next(err);
  }
};

// VERIFY PAYMENT
export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return req.http.badRequest("Missing required Razorpay parameters.");
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return req.http.badRequest("Payment signature verification failed.");
    }

    // Update payment record
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      { razorpayPaymentId: razorpay_payment_id, status: "paid" },
      { new: true }
    );

    if (!payment) return req.http.notFound("Payment order matching ID not found.");

    // Update appointment payment status
    await Appointment.findByIdAndUpdate(payment.appointmentId, {
      paymentStatus: "paid",
    });

    return req.http.ok(payment, "Payment verified and recorded successfully.");
  } catch (err) {
    next(err);
  }
};

// REFUND PAYMENT (Helper function called during cancellation)
export const refundPayment = async (appointmentId) => {
  try {
    const payment = await Payment.findOne({ appointmentId, status: "paid" });
    if (!payment || !payment.razorpayPaymentId) {
      console.log(`[Refund] No paid Razorpay transaction found for appointment ${appointmentId}`);
      return false;
    }

    const instance = getRazorpayInstance();
    const refund = await instance.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(payment.amount * 100),
      notes: { reason: "Appointment cancelled by patient/doctor" },
    });

    payment.status = "failed"; // mark transaction status or create a refund doc
    await payment.save();

    console.log(`[Refund] Refund processed for payment ID: ${payment.razorpayPaymentId}`);
    return true;
  } catch (err) {
    console.error("Razorpay refund error:", err.message);
    return false;
  }
};
