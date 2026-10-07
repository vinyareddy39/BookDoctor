import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    userName: {
      type: String,
      default: "System / Anonymous",
    },
    role: {
      type: String,
      default: "system",
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
      // e.g. "CREATE", "READ", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "VIEW_PATIENT_RECORD", "EXPORT_AUDIT"
    },
    resource: {
      type: String,
      required: true,
      index: true,
      // e.g. "Patient", "Appointment", "ClinicalNote", "Prescription", "LabOrder", "Invoice", "User"
    },
    resourceId: {
      type: String,
      index: true,
    },
    details: {
      type: String,
      default: "",
    },
    diff: {
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    ip: {
      type: String,
      default: "unknown",
    },
    userAgent: {
      type: String,
      default: "unknown",
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// ─── IMMUTABILITY ENFORCEMENT HOOKS ──────────────────────────────────────────
// Block any attempt to update, alter, or delete an existing audit log entry
const blockMutation = function (next) {
  const err = new Error("SECURITY VIOLATION: Audit logs are strictly immutable and cannot be updated or deleted.");
  err.statusCode = 403;
  next(err);
};

auditLogSchema.pre("updateOne", blockMutation);
auditLogSchema.pre("updateMany", blockMutation);
auditLogSchema.pre("findOneAndUpdate", blockMutation);
auditLogSchema.pre("findOneAndReplace", blockMutation);
auditLogSchema.pre("replaceOne", blockMutation);
auditLogSchema.pre("deleteOne", blockMutation);
auditLogSchema.pre("deleteMany", blockMutation);
auditLogSchema.pre("findOneAndDelete", blockMutation);
auditLogSchema.pre("remove", blockMutation);

auditLogSchema.index({ timestamp: -1, resource: 1, action: 1 });

export default mongoose.model("AuditLog", auditLogSchema);
