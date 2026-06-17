import multer from "multer";
import path from "path";

// ===============================
// STORAGE CONFIG
// ===============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/medical-records/");
  },

  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(
      null,
      file.fieldname +
        "-" +
        uniqueSuffix +
        path.extname(file.originalname)
    );
  },
});

// ===============================
// FILE FILTER (only docs/images)
// ===============================
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "application/pdf",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Only JPG, PNG, PDF files are allowed"),
      false
    );
  }
};

// ===============================
// MULTER INSTANCE
// ===============================
export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter,
});