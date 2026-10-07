import mongoose from "mongoose";

const vitalsSchema = new mongoose.Schema(
  {
    bloodPressure: { type: String, default: "" }, // e.g. "120/80 mmHg"
    heartRate:     { type: Number, default: null }, // bpm
    temperature:   { type: Number, default: null }, // °F
    respiratoryRate: { type: Number, default: null }, // breaths/min
    spO2:          { type: Number, default: null }, // %
    weight:        { type: Number, default: null }, // kg
    height:        { type: Number, default: null }, // cm
    bmi:           { type: Number, default: null },
  },
  { _id: false }
);

const diagnosisItemSchema = new mongoose.Schema(
  {
    code:  { type: String, required: true }, // e.g. "I10", "E11.9"
    label: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const clinicalNoteSchema = new mongoose.Schema(
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
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    parentNoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClinicalNote",
      default: null,
    },
    status: {
      type: String,
      enum: ["draft", "signed", "amended"],
      default: "draft",
    },
    signedAt: {
      type: Date,
      default: null,
    },
    signedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── Structured Clinical Sections ──
    chiefComplaint: {
      type: String,
      required: true,
      trim: true,
    },
    historyOfPresentIllness: {
      type: String,
      default: "",
    },
    vitals: {
      type: vitalsSchema,
      default: () => ({}),
    },
    examination: {
      type: String,
      default: "",
    },
    assessment: {
      type: String,
      default: "",
    },
    plan: {
      type: String,
      default: "",
    },
    diagnoses: {
      type: [diagnosisItemSchema],
      default: [],
    },
    amendmentReason: {
      type: String,
      default: "",
    },
    // ── AI Summary & Physician Approval ──
    aiVisitSummary: {
      type: String,
      default: null,
    },
    aiSummaryApproved: {
      type: Boolean,
      default: false,
    },
    aiSummaryApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    aiSummaryApprovedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Calculate BMI automatically if height & weight are provided
clinicalNoteSchema.pre("save", function (next) {
  if (this.vitals?.weight && this.vitals?.height) {
    const heightInMeters = this.vitals.height / 100;
    if (heightInMeters > 0) {
      this.vitals.bmi = parseFloat((this.vitals.weight / (heightInMeters * heightInMeters)).toFixed(1));
    }
  }
  next();
});

clinicalNoteSchema.index({ patientId: 1, createdAt: -1 });
clinicalNoteSchema.index({ doctorId: 1, createdAt: -1 });

export default mongoose.model("ClinicalNote", clinicalNoteSchema);
