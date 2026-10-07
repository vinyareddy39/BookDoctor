import AuditLog from "../models/AuditLog.js";
import { recordAudit } from "../middleware/auditLogger.js";

/**
 * Helper to build Mongoose filter query from request parameters
 */
const buildAuditFilter = (query) => {
  const filter = {};

  if (query.role) filter.role = query.role;
  if (query.action) filter.action = query.action;
  if (query.resource) filter.resource = query.resource;
  if (query.userId) filter.userId = query.userId;

  if (query.startDate || query.endDate) {
    filter.timestamp = {};
    if (query.startDate) filter.timestamp.$gte = new Date(query.startDate);
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      filter.timestamp.$lte = end;
    }
  }

  if (query.search) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [{ userName: regex }, { details: regex }, { resourceId: regex }];
  }

  return filter;
};

/**
 * GET /api/audit-logs
 * Filterable, paginated audit log retrieval (Clinic Admin only)
 */
export const getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = buildAuditFilter(req.query);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return req.http.ok(
      {
        logs,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
      "Audit logs retrieved successfully"
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/audit-logs/export-csv
 * Streams / downloads filtered audit logs as a compliant CSV file
 */
export const exportAuditLogsCSV = async (req, res, next) => {
  try {
    const filter = buildAuditFilter(req.query);
    const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(10000).lean();

    const headers = [
      "Timestamp",
      "User ID",
      "User Name",
      "Role",
      "Action",
      "Resource",
      "Resource ID",
      "IP Address",
      "User Agent",
      "Details",
    ];

    const escapeCSV = (field) => {
      if (field === null || field === undefined) return '""';
      const str = String(field).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.join(",")];

    for (const log of logs) {
      const row = [
        escapeCSV(new Date(log.timestamp).toISOString()),
        escapeCSV(log.userId || ""),
        escapeCSV(log.userName || "System"),
        escapeCSV(log.role || ""),
        escapeCSV(log.action),
        escapeCSV(log.resource),
        escapeCSV(log.resourceId || ""),
        escapeCSV(log.ip || ""),
        escapeCSV(log.userAgent || ""),
        escapeCSV(log.details || ""),
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\r\n");

    // Record the export action in audit log
    recordAudit({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "EXPORT_AUDIT",
      resource: "AuditLog",
      details: `Exported ${logs.length} audit log entries to CSV`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="medassist-audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};
