import mongoose from "mongoose";

const medicationItemSchema = new mongoose.Schema(
  {
    drug: {
      type: String,
      required: true,
      trim: true,
    },
    // Backwards-compatible alias for existing code
    name: {
      type: String,
      trim: true,
      default: function () {
        return this.drug;
      },
    },
    strength: {
      type: String,
      default: "", // e.g. "500 mg"
      trim: true,
    },
    dose: {
      type: String,
      default: "1 tablet", // e.g. "1 tablet", "2 puffs"
      trim: true,
    },
    dosage: {
      type: String,
      default: function () {
        return this.dose || "1 tablet";
      },
    },
    frequency: {
      type: String,
      default: "Twice daily", // Morning / Afternoon / Evening / Night / Twice daily / Thrice daily / Custom
      trim: true,
    },
    times: {
      type: [String],
      default: ["08:00", "20:00"], // 24-hr times e.g. ["08:00", "20:00"]
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
      default: 5,
    },
    duration: {
      type: String,
      default: function () {
        return `${this.durationDays || 5} days`;
      },
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    timing: {
      type: String,
      enum: ["before_food", "after_food", "with_food", "empty_stomach", "bedtime", "as_needed", "unspecified"],
      default: "after_food",
    },
    instructions: {
      type: String,
      default: "", // e.g. "after food, drink plenty of water"
      trim: true,
    },
    fieldConfidence: {
      drug: { type: Number, default: 1.0 },
      strength: { type: Number, default: 1.0 },
      dose: { type: Number, default: 1.0 },
      frequency: { type: Number, default: 1.0 },
      durationDays: { type: Number, default: 1.0 },
    },
    needsReview: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

// Keep name and drug in sync
medicationItemSchema.pre("validate", function () {
  if (this.drug && !this.name) this.name = this.drug;
  if (this.name && !this.drug) this.drug = this.name;
  if (this.dose && !this.dosage) this.dosage = this.dose;
  if (this.dosage && !this.dose) this.dose = this.dosage;
  if (this.durationDays && !this.duration) this.duration = `${this.durationDays} days`;
});

const prescriptionSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
      index: true,
    },
    clinicalNoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClinicalNote",
      default: null,
    },
    parentPrescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      default: null,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["draft", "shared", "confirmed", "active", "completed", "superseded", "discontinued", "amended"],
      default: "shared",
      index: true,
    },
    source: {
      type: String,
      enum: ["doctor_structured", "extracted", "manual", "patient_upload", "ocr"],
      default: "doctor_structured",
    },
    doctorName: {
      type: String,
      default: "",
      trim: true,
    },
    clinicName: {
      type: String,
      default: "",
      trim: true,
    },
    rawOcrText: {
      type: String,
      default: "",
    },
    ocrConfidence: {
      type: Number,
      default: 0.0,
      min: 0.0,
      max: 1.0,
    },
    medications: {
      type: [medicationItemSchema],
      default: [],
    },
    // Backwards-compatibility alias for medicines
    medicines: {
      type: [medicationItemSchema],
      default: [],
    },
    attachmentUrl: {
      type: String,
      default: null,
    },
    attachmentType: {
      type: String,
      enum: ["image", "pdf", null],
      default: null,
    },
    attachmentName: {
      type: String,
      default: null,
    },
    uploadedBy: {
      type: String,
      enum: ["doctor", "patient", "clinic_admin"],
      default: "doctor",
    },
    notes: {
      type: String,
      default: "",
    },
    generalInstructions: {
      type: String,
      default: "",
    },
    validUntil: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // default 30 days
    },
    sharedAt: {
      type: Date,
      default: Date.now,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    signedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Sync medications and medicines arrays before save
prescriptionSchema.pre("validate", function () {
  if (Array.isArray(this.medications) && this.medications.length > 0 && (!this.medicines || this.medicines.length === 0)) {
    this.medicines = this.medications;
  } else if (Array.isArray(this.medicines) && this.medicines.length > 0 && (!this.medications || this.medications.length === 0)) {
    this.medications = this.medicines;
  }
});

prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ doctorId: 1, createdAt: -1 });

export default mongoose.model("Prescription", prescriptionSchema);
