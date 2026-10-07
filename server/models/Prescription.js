import mongoose from "mongoose";

const medicineItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      default: "1 tablet",
    },
    frequency: {
      type: String,
      default: "1-0-1 (Twice daily)",
    },
    duration: {
      type: String,
      default: "5 days",
    },
    timing: {
      type: String,
      enum: ["before_food", "after_food", "with_food", "empty_stomach", "bedtime", "as_needed"],
      default: "after_food",
    },
    instructions: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

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
    version: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["active", "discontinued", "amended", "completed"],
      default: "active",
    },
    medicines: {
      type: [medicineItemSchema],
      default: [],
      validate: [
        function (v) {
          return (Array.isArray(v) && v.length > 0) || Boolean(this.attachmentUrl);
        },
        "Either prescribed medicines or an uploaded prescription document/photo is required",
      ],
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
    signedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ doctorId: 1, createdAt: -1 });

export default mongoose.model("Prescription", prescriptionSchema);
