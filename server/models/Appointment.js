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
      enum: ["pending", "unpaid", "claimed", "partially_paid", "paid", "failed", "refunded", "waived"],
      default: "pending",
    },

    paymentMode: {
      type: String,
      enum: ["online", "cash", "upi_clinic", "card_clinic", "upi_direct", "other", "none"],
      default: "none",
    },

    paymentSource: {
      type: String,
      enum: ["gateway", "direct_upi", "offline_marked", "none"],
      default: "none",
    },

    claimedPayment: {
      claimedAt: { type: Date, default: null },
      claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      utr: { type: String, default: "" },
      screenshotUrl: { type: String, default: "" },
    },

    duplicatePaymentFlag: {
      type: Boolean,
      default: false,
    },

    duplicatePaymentReview: {
      flagged: { type: Boolean, default: false },
      onlinePaymentId: { type: String, default: "" },
      amount: { type: Number, default: 0 },
      flaggedAt: { type: Date, default: null },
      resolved: { type: Boolean, default: false },
      resolution: { type: String, default: "" },
    },

    amountPaid: {
      type: Number,
      default: 0,
    },

    amountDue: {
      type: Number,
      default: 0,
    },

    offlinePaymentReceipt: {
      type: String,
      default: "",
    },

    paymentMarkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    paymentMarkedAt: {
      type: Date,
      default: null,
    },

    payoutStatus: {
      type: String,
      enum: ["none", "transferred", "payout_pending", "failed"],
      default: "none",
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

    rescheduleApprovalRequired: {
      type: Boolean,
      default: false,
    },

    rescheduleStatus: {
      type: String,
      enum: ["none", "pending_doctor_approval", "approved", "rejected"],
      default: "none",
    },

    proposedChange: {
      date: { type: Date, default: null },
      timeSlot: { type: String, default: "" },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, default: "" },
      requestedAt: { type: Date, default: null },
    },

    reminderSent24h: {
      type: Boolean,
      default: false,
    },

    reminderSent1h: {
      type: Boolean,
      default: false,
    },

    changeHistory: [
      {
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        actorRole: { type: String, enum: ["patient", "doctor", "admin", "receptionist", "system"] },
        changeType: {
          type: String,
          enum: [
            "rescheduled",
            "cancelled",
            "confirmed",
            "status_change",
            "payment_marked",
            "payment_corrected",
            "payment_disputed",
            "reschedule_requested",
            "reschedule_approved",
            "reschedule_rejected",
          ],
        },
        before: {
          date: Date,
          timeSlot: String,
          status: String,
          paymentStatus: String,
          amount: Number,
          paymentMode: String,
        },
        after: {
          date: Date,
          timeSlot: String,
          status: String,
          paymentStatus: String,
          amount: Number,
          paymentMode: String,
        },
        reason: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
      },
    ],

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