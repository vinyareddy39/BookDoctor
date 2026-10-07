/**
 * RBAC (Role-Based Access Control) & Record-Level Security Matrix
 * 
 * Enforces declarative permissions: resource x action x role
 * Enforces strict record-level scoping:
 * - Doctors: restricted to assigned/consulted patients.
 * - Patients: restricted to self and registered dependents.
 * - Lab Technicians: restricted to laboratory orders & results.
 * - Receptionists: restricted to front desk, scheduling, billing; strictly BLOCKED from clinical notes.
 */

// System Roles List
export const ROLES = ["clinic_admin", "doctor", "receptionist", "lab_technician", "patient"];

// Normalized role alias helper
export const normalizeRole = (role) => {
  if (role === "admin") return "clinic_admin";
  return role;
};

// Check if a given role has permission for a resource and action
export const checkPermission = (role, resource, action) => {
  const userRole = normalizeRole(role);
  if (userRole === "clinic_admin") return true;
  return PERMISSIONS[resource]?.[action]?.includes(userRole) || false;
};

// Declarative Permission Map: resource -> action -> allowed roles
export const PERMISSIONS = {
  patient_profile: {
    create: ["clinic_admin", "receptionist"],
    read:   ["clinic_admin", "doctor", "receptionist", "patient"],
    update: ["clinic_admin", "receptionist", "doctor", "patient"],
    delete: ["clinic_admin"],
  },
  clinical_note: {
    create: ["doctor", "clinic_admin"],
    read:   ["doctor", "clinic_admin"], // Receptionists and Lab Techs EXPLICITLY BLOCKED
    update: ["doctor", "clinic_admin"],
    delete: [], // Clinical notes are immutable EMR records
  },
  prescription: {
    create: ["doctor", "clinic_admin", "patient"],
    read:   ["doctor", "clinic_admin", "patient"],
    update: ["doctor", "clinic_admin", "patient"],
    delete: [], // Prescriptions are historical clinical records
  },
  lab_order: {
    create: ["doctor", "clinic_admin"],
    read:   ["doctor", "lab_technician", "clinic_admin", "patient"],
    update: ["doctor", "lab_technician", "clinic_admin"],
    delete: ["clinic_admin"],
  },
  lab_result: {
    create: ["lab_technician", "clinic_admin"],
    read:   ["doctor", "lab_technician", "clinic_admin", "patient"],
    update: ["lab_technician", "clinic_admin"],
    delete: [],
  },
  appointment: {
    create: ["clinic_admin", "receptionist", "doctor", "patient"],
    read:   ["clinic_admin", "receptionist", "doctor", "patient"],
    update: ["clinic_admin", "receptionist", "doctor", "patient"],
    delete: ["clinic_admin"],
  },
  billing: {
    create: ["clinic_admin", "receptionist"],
    read:   ["clinic_admin", "receptionist", "doctor", "patient"],
    update: ["clinic_admin", "receptionist"],
    delete: ["clinic_admin"],
  },
  diagnosis: {
    create: ["doctor", "clinic_admin"],
    read:   ["doctor", "clinic_admin", "patient"],
    update: ["doctor", "clinic_admin"],
    delete: ["clinic_admin"],
  },
  follow_up: {
    create: ["doctor", "clinic_admin", "patient"],
    read:   ["doctor", "clinic_admin", "receptionist", "patient"],
    update: ["doctor", "clinic_admin", "receptionist", "patient"],
    delete: ["clinic_admin"],
  },
  audit_log: {
    read:   ["clinic_admin"],
    create: ["system"],
    update: [],
    delete: [],
  },
  clinic_settings: {
    read:   ["clinic_admin", "doctor", "receptionist", "lab_technician", "patient"],
    update: ["clinic_admin"],
  },
};

/**
 * Middleware: Verify user role has permission for resource and action
 */
export const authorize = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return req.http?.unauthorized
        ? req.http.unauthorized("Authentication required")
        : res.status(401).json({ success: false, message: "Authentication required" });
    }

    const userRole = normalizeRole(req.user.role);

    // Clinic Admin has superuser administrative privilege for supported actions
    if (userRole === "clinic_admin") {
      return next();
    }

    const allowedRoles = PERMISSIONS[resource]?.[action];

    if (!allowedRoles || !allowedRoles.includes(userRole)) {
      return req.http?.forbidden
        ? req.http.forbidden(`Access Denied: '${userRole}' role cannot '${action}' on '${resource}'.`)
        : res.status(403).json({
            success: false,
            message: `Access Denied: '${userRole}' role cannot '${action}' on '${resource}'.`,
          });
    }

    next();
  };
};

/**
 * Middleware: Builds Mongoose record-level filter scoping based on caller's identity
 * Attaches req.recordScope to the request for controllers to apply to queries
 */
export const enforceRecordScope = (resource) => {
  return (req, res, next) => {
    if (!req.user) return next();

    const role = normalizeRole(req.user.role);
    const userId = req.user._id;

    // Clinic Admin sees all records
    if (role === "clinic_admin") {
      req.recordScope = {};
      return next();
    }

    switch (resource) {
      case "patient_records":
        if (role === "patient") {
          // Patient can only access records matching their userId or listed as a dependent
          req.recordScope = {
            $or: [{ patientId: userId }, { userId: userId }],
          };
        } else if (role === "doctor") {
          // Doctor can access records where they are the attending/assigned doctor
          req.recordScope = {
            $or: [{ doctorId: userId }, { assignedDoctorId: userId }],
          };
        } else if (role === "receptionist") {
          // Receptionist only accesses operational appointment & profile data, never clinical records
          req.recordScope = {};
        } else if (role === "lab_technician") {
          // Lab tech only sees lab-related records
          req.recordScope = {};
        }
        break;

      case "clinical_note":
        if (role === "receptionist" || role === "lab_technician") {
          return req.http?.forbidden
            ? req.http.forbidden("Access Denied: Front desk and lab personnel cannot view clinical doctor notes.")
            : res.status(403).json({ success: false, message: "Access Denied: Cannot view clinical doctor notes." });
        }
        if (role === "doctor") {
          req.recordScope = { doctorId: userId };
        } else if (role === "patient") {
          req.recordScope = { patientId: userId, isSigned: true }; // Patients only see finalized signed notes
        }
        break;

      case "lab_order":
        if (role === "patient") {
          req.recordScope = { patientId: userId, status: "released" }; // Patients only see released lab results
        } else if (role === "doctor") {
          req.recordScope = { $or: [{ doctorId: userId }, { patientDoctorId: userId }] };
        } else if (role === "lab_technician") {
          req.recordScope = {}; // Lab techs can access orders in progress
        }
        break;

      default:
        req.recordScope = {};
        break;
    }

    next();
  };
};
