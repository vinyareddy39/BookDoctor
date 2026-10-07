import express from "express";
import {
  getVisitSummaryDraft,
  approveVisitSummary,
  getPlainLanguageExplanation,
} from "../controllers/aiController.js";
import { auth } from "../middleware/index.js";
import { authorize } from "../middleware/rbac.js";
import { aiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Apply AI rate limiter to all AI endpoints
router.use(aiLimiter);

// ── Feature 1: Clinical Visit Summary (Clinician Review Draft) ───────────────
router.post("/visit-summary", auth, authorize("clinical_note", "create"), getVisitSummaryDraft);

// ── Feature 1b: Approve & Attach AI Summary to EMR Note ──────────────────────
router.post("/approve-summary", auth, authorize("clinical_note", "update"), approveVisitSummary);

// ── Feature 2: Plain-Language Patient Explanation (Safety Guardrailed) ──────
router.post("/explain-instructions", auth, getPlainLanguageExplanation);

export default router;
