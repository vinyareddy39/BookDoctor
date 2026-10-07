import mongoose from "mongoose";

const followUpSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    clinicalNoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClinicalNote",
      default: null,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    plan: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "requested_by_patient", "approved", "scheduled", "completed", "cancelled"],
      default: "pending",
    },
    patientNotes: {
      type: String,
      default: "",
    },
    requestedDate: {
      type: Date,
      default: null,
    },
    scheduledAppointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

followUpSchema.index({ patientId: 1, dueDate: 1 });
followUpSchema.index({ doctorId: 1, dueDate: 1 });

export default mongoose.model("FollowUp", followUpSchema);
