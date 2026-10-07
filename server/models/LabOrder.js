import mongoose from "mongoose";

const labTestItemSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      default: "",
    },
    name: {
      type: String,
      required: true,
      trim: true, // e.g. "Complete Blood Count (CBC)"
    },
    category: {
      type: String,
      enum: ["Hematology", "Biochemistry", "Pathology", "Microbiology", "Radiology", "Serology", "General"],
      default: "General",
    },
    instructions: {
      type: String,
      default: "", // e.g. "12-hour fasting required"
    },
  },
  { _id: false }
);

const labOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
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
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    clinicalNoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClinicalNote",
      default: null,
    },
    tests: {
      type: [labTestItemSchema],
      required: true,
      validate: [(v) => v.length > 0, "At least one test must be ordered"],
    },
    priority: {
      type: String,
      enum: ["routine", "urgent", "stat"],
      default: "routine",
    },
    clinicalNotes: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["ordered", "sample_collected", "processing", "result_entered", "verified", "released", "cancelled"],
      default: "ordered",
      index: true,
    },
    orderedAt: {
      type: Date,
      default: Date.now,
    },
    sampleCollectedAt: {
      type: Date,
      default: null,
    },
    sampleCollectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    resultEnteredAt: {
      type: Date,
      default: null,
    },
    resultEnteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    releasedAt: {
      type: Date,
      default: null,
    },
    releasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancellationReason: {
      type: String,
      default: "",
    },
    labResultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabResult",
      default: null,
    },
  },
  { timestamps: true }
);

// Auto-generate order number e.g. LAB-2026-00001
labOrderSchema.statics.generateOrderNumber = async function () {
  const currentYear = new Date().getFullYear();
  const prefix = `LAB-${currentYear}-`;

  const latestOrder = await this.findOne({ orderNumber: new RegExp(`^${prefix}`) })
    .sort({ createdAt: -1 })
    .select("orderNumber")
    .lean();

  let nextSequence = 1;
  if (latestOrder && latestOrder.orderNumber) {
    const parts = latestOrder.orderNumber.split("-");
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(5, "0")}`;
};

labOrderSchema.index({ patientId: 1, createdAt: -1 });
labOrderSchema.index({ status: 1, priority: 1 });

export default mongoose.model("LabOrder", labOrderSchema);
