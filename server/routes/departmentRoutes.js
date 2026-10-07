import express from "express";
import {
  getDepartments,
  createDepartment,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} from "../controllers/departmentController.js";
import { auth, authorize } from "../middleware/index.js";

const router = express.Router();

router.get("/", getDepartments);
router.get("/:id", getDepartmentById);

// Admin restricted modifications
router.post("/", auth, authorize("clinic_settings", "update"), createDepartment);
router.put("/:id", auth, authorize("clinic_settings", "update"), updateDepartment);
router.delete("/:id", auth, authorize("clinic_settings", "update"), deleteDepartment);

export default router;
