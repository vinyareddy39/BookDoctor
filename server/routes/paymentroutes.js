import express from "express";
import {
  createOrder,
  verifyPayment,
  razorpayWebhook
} from "../controllers/paymentController.js";

import { auth } from "../middleware/index.js";

const router = express.Router();

router.post("/create-order", auth, createOrder);
router.post("/verify", auth, verifyPayment);
router.post("/webhook", razorpayWebhook);

export default router;