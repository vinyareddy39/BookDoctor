import mongoose from "mongoose";

const labParameterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true, // e.g. "Hemoglobin", "Total Cholesterol"
    },
    value: {
      type: String,
      required: true, // e.g. "14.2", "Negative", "125"
    },
    unit: {
      type: String,
      default: "", // e.g. "g/dL", "mg/dL"
    },
    referenceRange: {
      type: String,
      default: "", // e.g. "12.0 - 15.5", "< 200"
    },
    flag: {
      type: String,
      enum: ["normal", "low", "high", "critical", "abnormal"],
      default: "normal",
    },
    isAbnormal: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const labResultSchema = new mongoose.Schema(
  {
    labOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabOrder",
      required: true,
      unique: true,
      index: true,
    },
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
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    releasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    parameters: {
      type: [labParameterSchema],
      required: true,
      validate: [(v) => v.length > 0, "At least one result parameter must be entered"],
    },
    interpretation: {
      type: String,
      default: "", // General clinical comment from the laboratory
    },
    hasAbnormalValues: {
      type: Boolean,
      default: false,
    },
    attachedFile: {
      url:      { type: String, default: "" },
      filename: { type: String, default: "" },
      fileType: { type: String, default: "" },
      size:     { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["draft", "verified", "released"],
      default: "draft",
      index: true,
    },
  },
  { timestamps: true }
);

// Automatically calculate hasAbnormalValues before save
labResultSchema.pre("save", function (next) {
  if (Array.isArray(this.parameters)) {
    this.hasAbnormalValues = this.parameters.some((p) => p.isAbnormal || p.flag !== "normal");
  }
  next();
});

export default mongoose.model("LabResult", labResultSchema);
