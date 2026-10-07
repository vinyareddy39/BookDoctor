import express from "express";
import { getAuditLogs, exportAuditLogsCSV } from "../controllers/auditController.js";
import { auth, authorize } from "../middleware/index.js";

const router = express.Router();

// Retrieve filterable, paginated audit logs (Clinic Admin only)
router.get("/", auth, authorize("audit_log", "read"), getAuditLogs);

// Export filtered audit logs as downloadable CSV
router.get("/export-csv", auth, authorize("audit_log", "read"), exportAuditLogsCSV);

export default router;
