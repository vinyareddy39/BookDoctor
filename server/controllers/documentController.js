import path from "path";
import fs from "fs";
import HealthRecord from "../models/HealthRecord.js";
import User from "../models/User.js";
import { SECURE_DOCS_DIR } from "../middleware/secureUpload.js";
import { recordAudit } from "../middleware/auditLogger.js";

// ── UPLOAD SECURE DOCUMENT ──────────────────────────────────────────────────
export const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return req.http.badRequest("No document file was uploaded");
    }

    const { title, notes, dependentId } = req.body;
    let targetPatientId = req.body.patientId;

    if (!targetPatientId || req.user.role === "patient") {
      targetPatientId = req.user._id;
    }

    if (!title || !title.trim()) {
      // Remove temporary file if validation fails
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return req.http.badRequest("Document title is required");
    }

    const mime = req.file.mimetype;
    let fileType = "other";
    if (mime.startsWith("image/")) fileType = "image";
    else if (mime === "application/pdf") fileType = "pdf";

    const record = await HealthRecord.create({
      patientId: targetPatientId,
      dependentId: dependentId || null,
      title: title.trim(),
      notes: notes || "",
      fileUrl: req.file.filename, // Store safe filename only, accessed via secure route
      fileType,
      date: new Date(),
    });

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "medical_document",
      resourceId: record._id,
      after: record.toObject(),
      req,
    });

    return req.http.created(record, "Document uploaded securely");
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
};

// ── GET PATIENT DOCUMENTS ───────────────────────────────────────────────────
export const getPatientDocuments = async (req, res, next) => {
  try {
    let patientId = req.query.patientId;
    if (req.user.role === "patient" || !patientId) {
      patientId = req.user._id;
    }

    const filter = { patientId };
    if (req.query.dependentId) {
      filter.dependentId = req.query.dependentId;
    }

    const records = await HealthRecord.find(filter)
      .populate("patientId", "name mrn")
      .sort({ date: -1 })
      .lean();

    return req.http.ok(records);
  } catch (err) {
    next(err);
  }
};

// ── ACCESS-CONTROLLED SECURE DOWNLOAD ───────────────────────────────────────
export const downloadDocument = async (req, res, next) => {
  try {
    const record = await HealthRecord.findById(req.params.id);
    if (!record) {
      return req.http.notFound("Document record not found");
    }

    // Role-based record level check
    if (req.user.role === "patient") {
      const isOwner = String(record.patientId) === String(req.user._id);
      if (!isOwner) {
        // Check if it belongs to registered dependent
        const patient = await User.findById(req.user._id).select("dependents");
        const hasDep = patient?.dependents?.some(
          (d) => String(d._id) === String(record.dependentId)
        );
        if (!hasDep) {
          return req.http.forbidden("Access denied: You may only access your own medical records");
        }
      }
    }

    // Resolve file from secure storage
    const filename = path.basename(record.fileUrl);
    const filePath = path.join(SECURE_DOCS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return req.http.notFound("Physical document file does not exist on storage");
    }

    // Audit log read of medical document
    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "read",
      resource: "medical_document",
      resourceId: record._id,
      req,
    });

    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
        ? "image/png"
        : "image/jpeg";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${record.title.replace(/[^a-zA-Z0-9_-]/g, "_")}${ext}"`);
    return res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
};
