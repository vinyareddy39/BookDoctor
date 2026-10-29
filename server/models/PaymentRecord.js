import mongoose from "mongoose";

const paymentRecordSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
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
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMode: {
      type: String,
      enum: ["online", "cash", "upi_clinic", "card_clinic", "other", "upi_direct"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "claimed", "paid", "refunded", "disputed", "corrected", "void"],
      default: "paid",
    },
    source: {
      type: String,
      enum: ["gateway", "direct_upi", "offline_marked"],
      default: "offline_marked",
    },
    receiptNumber: {
      type: String,
      default: () => `RCP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      unique: true,
    },
    transactionReference: {
      type: String,
      default: "",
    },
    // Gateway Details
    gatewayOrderId: {
      type: String,
      default: null,
      index: true,
    },
    gatewayPaymentId: {
      type: String,
      default: null,
      index: true,
    },
    webhookEventId: {
      type: String,
      default: null,
      sparse: true,
    },
    // Direct UPI Claim & Confirmation
    claimedAt: {
      type: Date,
      default: null,
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    utr: {
      type: String,
      trim: true,
      default: "",
    },
    screenshotUrl: {
      type: String,
      default: "",
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: "",
    },
    // Duplicate Payment Guard
    duplicateFlag: {
      type: Boolean,
      default: false,
    },
    duplicateDetails: {
      detectedAt: { type: Date, default: null },
      reason: { type: String, default: "" },
      onlinePaymentId: { type: String, default: "" },
      amount: { type: Number, default: 0 },
      refundStatus: { type: String, enum: ["none", "pending_refund", "refunded"], default: "none" },
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    markedRole: {
      type: String,
      enum: ["patient", "doctor", "receptionist", "admin", "system"],
      default: "system",
    },
    notes: {
      type: String,
      default: "",
    },
    dispute: {
      isDisputed: { type: Boolean, default: false },
      reason: { type: String, default: "" },
      disputedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      disputedAt: { type: Date, default: null },
      resolution: { type: String, default: "" },
      resolvedAt: { type: Date, default: null },
    },
    corrections: [
      {
        correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: String,
        previousAmount: Number,
        newAmount: Number,
        previousMode: String,
        newMode: String,
        reason: { type: String, required: true },
        correctedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

paymentRecordSchema.index({ doctorId: 1, createdAt: -1 });
paymentRecordSchema.index({ appointmentId: 1 });

export default mongoose.model("PaymentRecord", paymentRecordSchema);
