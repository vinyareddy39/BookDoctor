import Razorpay from "razorpay";
import crypto from "crypto";
import Payment from "../models/Payment.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// CREATE ORDER
export const createOrderService = async (amount) => {
  const options = {
    amount: amount * 100,
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
  };

  return await razorpay.orders.create(options);
};

// VERIFY PAYMENT
export const verifyPaymentService = async (data) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = data;

  const body =
    razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  const isValid = expectedSignature === razorpay_signature;

  if (!isValid) {
    throw new Error("Invalid payment signature");
  }

  return true;
};

// SAVE PAYMENT
export const savePaymentService = async (data) => {
  return await Payment.create(data);
};