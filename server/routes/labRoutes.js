import express from "express";
import {
  createLabOrder,
  getLabOrders,
  getLabOrderById,
  collectSample,
  startProcessing,
  enterResults,
  verifyResults,
  releaseResults,
  cancelLabOrder,
} from "../controllers/labController.js";
import { auth } from "../middleware/index.js";
import { authorize } from "../middleware/rbac.js";

const router = express.Router();

// ── Orders ──
router.post("/orders", auth, authorize("lab_order", "create"), createLabOrder);
router.get("/orders", auth, authorize("lab_order", "read"), getLabOrders);
router.get("/orders/:id", auth, authorize("lab_order", "read"), getLabOrderById);

// ── Lifecycle Transitions ──
router.patch("/orders/:id/collect-sample", auth, authorize("lab_order", "update"), collectSample);
router.patch("/orders/:id/start-processing", auth, authorize("lab_order", "update"), startProcessing);
router.post("/orders/:id/results", auth, authorize("lab_result", "create"), enterResults);
router.patch("/orders/:id/verify", auth, authorize("lab_result", "update"), verifyResults);
router.patch("/orders/:id/release", auth, authorize("lab_order", "update"), releaseResults);
router.patch("/orders/:id/cancel", auth, authorize("lab_order", "update"), cancelLabOrder);

export default router;
