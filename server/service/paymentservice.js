import "dotenv/config";
import razorpay, { getRazorpayClient } from "../services/paymentService.js";

export { razorpay, getRazorpayClient };
export default razorpay;