import AuditLog from "../models/AuditLog.js";

/**
 * Safely creates an immutable audit log record asynchronously without blocking client responses.
 */
export const recordAudit = async ({
  userId = null,
  userName = "System / Anonymous",
  role = "system",
  action,
  resource,
  resourceId = null,
  details = "",
  diff = { before: null, after: null },
  ip = "unknown",
  userAgent = "unknown",
}) => {
  try {
    await AuditLog.create({
      userId,
      userName,
      role,
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : undefined,
      details,
      diff,
      ip,
      userAgent,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("⚠️ [AuditLogger] Failed to write audit record:", err.message);
  }
};

/**
 * Express middleware to automatically log request actions upon successful HTTP completion.
 * 
 * @param {string} action - e.g. "CREATE", "READ", "UPDATE", "DELETE", "VIEW_PATIENT_RECORD"
 * @param {string} resource - e.g. "Patient", "Appointment", "ClinicalNote", "Prescription", "LabOrder"
 */
export const auditRequest = (action, resource) => {
  return (req, res, next) => {
    const originalJson = res.json;
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    // Capture response payload for diff/ID extraction
    res.json = function (body) {
      res.json = originalJson; // Restore original

      // Only audit successful 2xx actions
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user;
        const resourceId =
          req.params?.id ||
          body?.data?._id ||
          body?._id ||
          req.body?._id ||
          null;

        const diff = {
          before: req._auditBefore || null,
          after: action !== "DELETE" && action !== "READ" ? (req.body ? { ...req.body } : null) : null,
        };

        // Redact passwords or sensitive tokens from diff if present
        if (diff.before?.password) delete diff.before.password;
        if (diff.after?.password) delete diff.after.password;

        setImmediate(() => {
          recordAudit({
            userId: user?._id || null,
            userName: user?.name || "System / Guest",
            role: user?.role || "guest",
            action,
            resource,
            resourceId,
            details: `${action} operation on ${resource} [status: ${res.statusCode}]`,
            diff,
            ip,
            userAgent,
          });
        });
      }

      return res.json(body);
    };

    next();
  };
};
