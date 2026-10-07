import express from "express";
import {
  uploadDocument,
  getPatientDocuments,
  downloadDocument,
} from "../controllers/documentController.js";
import { auth } from "../middleware/index.js";
import { secureUpload } from "../middleware/secureUpload.js";

const router = express.Router();

router.post("/upload", auth, secureUpload.single("document"), uploadDocument);
router.get("/", auth, getPatientDocuments);
router.get("/:id/download", auth, downloadDocument);

export default router;
