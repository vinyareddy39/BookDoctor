import mongoose from "mongoose";

const emergencyContactSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    relationship: {
      type: String,
      default: "family",
      trim: true,
    },
    notifyOnSOS: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

emergencyContactSchema.index({ patientId: 1, phone: 1 });

export default mongoose.model("EmergencyContact", emergencyContactSchema);
