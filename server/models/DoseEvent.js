import mongoose from "mongoose";

const doseEventSchema = new mongoose.Schema(
  {
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    drug: {
      type: String,
      required: true,
      trim: true,
    },
    strength: {
      type: String,
      default: "",
      trim: true,
    },
    dose: {
      type: String,
      default: "1 tablet",
      trim: true,
    },
    scheduledDate: {
      type: String, // YYYY-MM-DD for easy day grouping
      required: true,
      index: true,
    },
    scheduledTime: {
      type: String, // "08:00" (24h)
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    instructions: {
      type: String,
      default: "",
    },
    timing: {
      type: String,
      default: "after_food",
    },
    status: {
      type: String,
      enum: ["scheduled", "taken", "skipped", "not_confirmed"],
      default: "scheduled",
      index: true,
    },
    recordedAt: {
      type: Date,
      default: null,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    method: {
      type: String,
      enum: ["self_reported", "caregiver_reported", "system_timeout", null],
      default: null,
    },
    reminderSentAt: {
      type: Date,
      default: null,
    },
    reminderCount: {
      type: Number,
      default: 0,
    },
    caregiverNotifiedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

doseEventSchema.index({ patientId: 1, scheduledDate: 1 });
doseEventSchema.index({ patientId: 1, scheduledAt: 1 });
doseEventSchema.index({ status: 1, scheduledAt: 1 });

export default mongoose.model("DoseEvent", doseEventSchema);
