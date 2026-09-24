import "dotenv/config";
import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const isProd = process.env.NODE_ENV === "production";

// In production, throw clear startup error if keys are missing
if (isProd && (!keyId || !keySecret)) {
  throw new Error("FATAL: Razorpay API keys (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) must be configured in production.");
}

// Instantiate configured client
export const razorpay = (keyId && keySecret)
  ? new Razorpay({ key_id: keyId, key_secret: keySecret })
  : null;

/**
 * Helper to retrieve Razorpay client instance.
 * Throws error if missing in production.
 */
export const getRazorpayClient = () => {
  if (razorpay) return razorpay;

  const currentKeyId = process.env.RAZORPAY_KEY_ID;
  const currentKeySecret = process.env.RAZORPAY_KEY_SECRET;

  if (currentKeyId && currentKeySecret) {
    return new Razorpay({ key_id: currentKeyId, key_secret: currentKeySecret });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Razorpay API keys (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are missing.");
  }

  return null;
};

export default razorpay;
