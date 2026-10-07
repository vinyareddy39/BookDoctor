import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Ensure prescription uploads directory exists under server/uploads/prescriptions
const PRESCRIPTION_UPLOAD_DIR = path.resolve("server/uploads/prescriptions");
if (!fs.existsSync(PRESCRIPTION_UPLOAD_DIR)) {
  fs.mkdirSync(PRESCRIPTION_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PRESCRIPTION_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
    const safeHash = crypto.randomBytes(8).toString("hex");
    const timestamp = Date.now();
    const safeFilename = `rx_${timestamp}_${safeHash}${ext}`;
    cb(null, safeFilename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file format. Only PDF, JPG, PNG, and WebP files are supported for prescription uploads."), false);
  }
};

export const prescriptionUpload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit for high-res prescription photos
    files: 1,
  },
  fileFilter,
});

export { PRESCRIPTION_UPLOAD_DIR };
