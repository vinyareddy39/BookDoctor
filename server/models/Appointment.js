import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
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
  },
  { timestamps: true }
);

// ─── Indexes for query performance ──────────────────────────────────────────
// Patient dashboard: fetch by patientId sorted by date
appointmentSchema.index({ patientId: 1, appointmentDate: -1 });
// Doctor dashboard: fetch by doctorId + status filter
appointmentSchema.index({ doctorId: 1, status: 1 });

export default mongoose.model("Appointment", appointmentSchema);