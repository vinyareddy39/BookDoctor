import "dotenv/config";
import Razorpay from "razorpay";

/**
 * Validates Razorpay configuration.
 * In production:
 * - RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET must exist.
 * - RAZORPAY_KEY_ID must start with 'rzp_live_'
 */
export const validateRazorpayConfig = () => {
  const isProd = process.env.NODE_ENV === "production";
  const allowTestKeys = process.env.RAZORPAY_ALLOW_TEST_KEYS === "true";
  const currentKeyId = process.env.RAZORPAY_KEY_ID;
  const currentKeySecret = process.env.RAZORPAY_KEY_SECRET;
  const currentWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (isProd) {
    if (!currentKeyId || !currentKeySecret || !currentWebhookSecret) {
      throw new Error(
        "FATAL [Razorpay Configuration]: In production, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET must all be defined. Please configure them in your environment settings."
      );
    }
    if (!allowTestKeys && !currentKeyId.startsWith("rzp_live_")) {
      throw new Error(
        `FATAL [Razorpay Configuration]: In production, RAZORPAY_KEY_ID must start with 'rzp_live_'. Found: '${currentKeyId.slice(0, 9)}...'. If running in a staging environment with test credentials, set RAZORPAY_ALLOW_TEST_KEYS=true.`
      );
    }
  }
};

// Validate immediately on module load
validateRazorpayConfig();

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

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
