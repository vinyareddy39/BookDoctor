import mongoose from "mongoose";

const healthRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    dependentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null, // Null means it belongs to the patient themselves
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    fileUrl: {
      type: String,
      required: true,
    },

    fileType: {
      type: String,
      enum: ["image", "pdf", "other"],
      default: "other",
    },

    date: {
      type: Date,
      default: Date.now,
    },
    
    notes: {
      type: String,
      default: "",
    }
  },
  { timestamps: true }
);

healthRecordSchema.index({ patientId: 1, date: -1 });

export default mongoose.model("HealthRecord", healthRecordSchema);
