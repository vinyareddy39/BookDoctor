import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    dependentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null, // Null means booked for the patient themselves
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    appointmentDate: {
      type: Date,
      required: true,
    },

    appointmentTime: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed", "no_show", "waiting", "called", "in_consultation"],
      default: "pending",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    amount: {
      type: Number,
      required: true,
    },

    review: {
      type: String,
      default: "",
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
    },

    prescription: {
      type: String,
      default: "",
    },
    
    rescheduleCount: {
      type: Number,
      default: 0,
    },

    // ── Phase 3: Walk-In Queue & Conflict Tracking ──
    type: {
      type: String,
      enum: ["scheduled", "walk_in"],
      default: "scheduled",
    },

    tokenNumber: {
      type: Number,
      default: null,
    },

    queueStatus: {
      type: String,
      enum: ["none", "waiting", "called", "in_consultation", "completed", "skipped"],
      default: "none",
    },

    duration: {
      type: Number,
      default: 30, // in minutes
    },

    notes: {
      type: String,
      default: "",
    },

    // ── Cancellation Details ──
    cancellationReason: {
      type: String,
      default: "",
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Indexes for query performance ──────────────────────────────────────────
appointmentSchema.index({ patientId: 1, appointmentDate: -1 });
appointmentSchema.index({ doctorId: 1, status: 1 });
appointmentSchema.index({ doctorId: 1, appointmentDate: 1, appointmentTime: 1 });
appointmentSchema.index({ appointmentDate: 1, tokenNumber: 1 });

export default mongoose.model("Appointment", appointmentSchema);