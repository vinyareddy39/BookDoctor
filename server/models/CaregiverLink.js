import mongoose from "mongoose";

const caregiverLinkSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    caregiverEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    caregiverName: {
      type: String,
      default: "",
      trim: true,
    },
    relationship: {
      type: String,
      default: "family", // family, friend, nurse, other
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "revoked"],
      default: "pending",
      index: true,
    },
    inviteToken: {
      type: String,
      default: null,
      index: true,
    },
    permissions: {
      canViewSchedule: { type: Boolean, default: true },
      canRecordCheckin: { type: Boolean, default: true },
      receiveAlerts: { type: Boolean, default: true },
    },
    consentedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

caregiverLinkSchema.index({ patientId: 1, caregiverEmail: 1 }, { unique: true });

export default mongoose.model("CaregiverLink", caregiverLinkSchema);
