import express from "express";
import {
  getServices,
  createService,
  getServiceById,
  updateService,
  deleteService,
} from "../controllers/serviceController.js";
import { auth, authorize } from "../middleware/index.js";

const router = express.Router();

router.get("/", getServices);
router.get("/:id", getServiceById);

// Admin restricted modifications
router.post("/", auth, authorize("clinic_settings", "update"), createService);
router.put("/:id", auth, authorize("clinic_settings", "update"), updateService);
router.delete("/:id", auth, authorize("clinic_settings", "update"), deleteService);

export default router;
