import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Ensure secure storage directory exists
const SECURE_DOCS_DIR = path.resolve("server/storage/secure-docs");
if (!fs.existsSync(SECURE_DOCS_DIR)) {
  fs.mkdirSync(SECURE_DOCS_DIR, { recursive: true });
}

// Storage configuration with virus-safe randomized filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, SECURE_DOCS_DIR);
  },
  filename: (req, file, cb) => {
    // Sanitize extension (only alphanumeric, lowercase)
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
    const safeHash = crypto.randomBytes(16).toString("hex");
    const timestamp = Date.now();
    const safeFilename = `doc_${timestamp}_${safeHash}${ext}`;
    cb(null, safeFilename);
  },
});

// Strict MIME type validation
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "application/pdf",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file format. Only PDF, JPG, and PNG documents are allowed for medical records."), false);
  }
};

export const secureUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
  fileFilter,
});

export { SECURE_DOCS_DIR };
