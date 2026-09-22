import mongoose from "mongoose";

const emergencySchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    emergencyType: {
      type: String,
      default: "general",
    },
    status: {
      type: String,
      enum: ["active", "resolved"],
      default: "active",
    },
    locationHistory: [
      {
        lat: { type: Number },
        lng: { type: Number },
        timestamp: { type: Date, default: Date.now },
      }
    ],
    resolvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Indexes for performance (especially for finding active emergencies quickly)
emergencySchema.index({ status: 1 });
emergencySchema.index({ assignedDoctorId: 1, status: 1 });

export default mongoose.model("Emergency", emergencySchema);

