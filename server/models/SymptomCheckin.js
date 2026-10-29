import mongoose from "mongoose";

const symptomCheckinSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      default: null,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
      index: true,
    },
    painLevel: {
      type: Number,
      min: 0,
      max: 10,
      required: true,
    },
    woundCondition: {
      type: String,
      enum: ["none", "normal", "redness", "swelling", "discharge", "bleeding"],
      default: "none",
    },
    temperature: {
      type: Number,
      default: null,
    },
    temperatureUnit: {
      type: String,
      enum: ["F", "C"],
      default: "F",
    },
    generalFeeling: {
      type: String,
      enum: ["better", "same", "worse"],
      required: true,
      default: "same",
    },
    notes: {
      type: String,
      default: "",
    },
    isRedFlag: {
      type: Boolean,
      default: false,
      index: true,
    },
    redFlagReasons: [
      {
        type: String,
      },
    ],
    doctorReviewed: {
      type: Boolean,
      default: false,
    },
    doctorNotes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

symptomCheckinSchema.index({ patientId: 1, createdAt: -1 });

export default mongoose.model("SymptomCheckin", symptomCheckinSchema);
