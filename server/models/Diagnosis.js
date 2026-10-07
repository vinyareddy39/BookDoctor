import mongoose from "mongoose";

const diagnosisSchema = new mongoose.Schema(
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
    clinicalNoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClinicalNote",
      default: null,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true, // e.g. "I10", "E11.9", "J06.9"
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "General",
    },
    status: {
      type: String,
      enum: ["active", "resolved", "chronic", "in_remission"],
      default: "active",
    },
    diagnosedDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

diagnosisSchema.index({ patientId: 1, status: 1 });

export default mongoose.model("Diagnosis", diagnosisSchema);
