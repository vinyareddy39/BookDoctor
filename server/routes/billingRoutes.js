import express from "express";
import {
  createInvoice,
  getInvoices,
  getInvoiceById,
  recordCounterPayment,
  createRazorpayCheckout,
  verifyRazorpayPayment,
  voidInvoice,
  processRefund,
  getRevenueReport,
  getBillingSettings,
  updateBillingSettings,
} from "../controllers/billingController.js";
import { auth } from "../middleware/index.js";
import { authorize } from "../middleware/rbac.js";

const router = express.Router();

// ── Invoices ──
router.post("/invoices", auth, authorize("billing", "create"), createInvoice);
router.get("/invoices", auth, authorize("billing", "read"), getInvoices);
router.get("/invoices/:id", auth, authorize("billing", "read"), getInvoiceById);

// ── Payments & Gateways ──
router.post("/invoices/:id/payments", auth, authorize("billing", "update"), recordCounterPayment);
router.post("/invoices/:id/checkout", auth, createRazorpayCheckout);
router.post("/invoices/:id/verify-payment", auth, verifyRazorpayPayment);

// ── Administrative Adjustments (Void & Refund) ──
router.patch("/invoices/:id/void", auth, authorize("billing", "delete"), voidInvoice);
router.post("/invoices/:id/refund", auth, authorize("billing", "delete"), processRefund);

// ── Financial Intelligence & Settings ──
router.get("/reports/revenue", auth, authorize("billing", "read"), getRevenueReport);
router.get("/settings", auth, getBillingSettings);
router.put("/settings", auth, authorize("clinic_settings", "update"), updateBillingSettings);

export default router;
