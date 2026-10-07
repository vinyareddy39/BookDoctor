import ClinicalNote from "../models/ClinicalNote.js";
import { recordAudit } from "../middleware/auditLogger.js";
import { generateVisitSummary, generatePatientExplanation } from "../services/aiService.js";

// ── 1. GENERATE VISIT SUMMARY DRAFT (Doctor, Clinic Admin) ─────────────────
export const getVisitSummaryDraft = async (req, res, next) => {
  try {
    const {
      chiefComplaint,
      historyOfPresentIllness,
      vitals,
      examination,
      assessment,
      plan,
      diagnoses,
    } = req.body;

    const result = await generateVisitSummary({
      chiefComplaint,
      history: historyOfPresentIllness,
      vitals,
      examination,
      assessment,
      plan,
      diagnoses,
    });

    return req.http.ok(result, "Visit summary draft generated for clinician review");
  } catch (err) {
    next(err);
  }
};

// ── 2. APPROVE & ATTACH VISIT SUMMARY TO CHART (Doctor, Clinic Admin) ───────
export const approveVisitSummary = async (req, res, next) => {
  try {
    const { noteId, approvedSummary, originalDraftSummary } = req.body;

    if (!noteId) {
      return req.http.badRequest("noteId is required");
    }

    if (!approvedSummary || !approvedSummary.trim()) {
      return req.http.badRequest("Approved summary text is required");
    }

    const note = await ClinicalNote.findById(noteId);
    if (!note) {
      return req.http.notFound("Clinical note not found");
    }

    const beforeState = note.toObject();

    // Attach approved summary
    note.aiVisitSummary = approvedSummary.trim();
    note.aiSummaryApproved = true;
    note.aiSummaryApprovedBy = req.user._id;
    note.aiSummaryApprovedAt = new Date();
    await note.save();

    // Record immutable audit entry documenting AI origin & clinician approval
    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "clinical_note",
      resourceId: note._id,
      before: {
        aiSummary: beforeState.aiVisitSummary || null,
        draft: originalDraftSummary || null,
      },
      after: {
        aiVisitSummary: note.aiVisitSummary,
        aiSummaryApproved: true,
        approvedBy: req.user.name,
        aiOrigin: "anthropic-claude",
        approvedAt: note.aiSummaryApprovedAt,
      },
      req,
    });

    return req.http.ok(
      note,
      "Clinical visit summary verified, approved, and attached to chart"
    );
  } catch (err) {
    next(err);
  }
};

// ── 3. PLAIN-LANGUAGE PATIENT EXPLANATION (Doctor, Patient, Clinic Admin) ───
export const getPlainLanguageExplanation = async (req, res, next) => {
  try {
    const { medicines, followUpPlan, lifestyleAdvice } = req.body;

    const result = await generatePatientExplanation({
      medicines: medicines || [],
      followUpPlan: followUpPlan || "",
      lifestyleAdvice: lifestyleAdvice || "",
    });

    return req.http.ok(result, "Patient instructions generated with safety guardrails");
  } catch (err) {
    next(err);
  }
};
