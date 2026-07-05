import express from "express";
import {
  getUsers,
  updateProfile,
  getMyProfile,
  addDependent,
  removeDependent,
  uploadHealthRecord,
  getHealthRecords,
  deleteHealthRecord,
} from "../controllers/userController.js";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

import {
  auth,
  role,
} from "../middleware/index.js";

const router = express.Router();

// Admin only
router.get("/", auth, role("admin"), getUsers);

// User profile
router.get("/profile", auth, getMyProfile);
router.put("/profile", auth, updateProfile);

// Dependents
router.post("/dependents", auth, addDependent);
router.delete("/dependents/:depId", auth, removeDependent);

// Health Records
router.get("/health-records", auth, getHealthRecords);
router.post("/health-records", auth, upload.single("file"), uploadHealthRecord);
router.delete("/health-records/:id", auth, deleteHealthRecord);

export default router;