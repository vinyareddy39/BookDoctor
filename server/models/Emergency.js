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
    // New fields for fallback flow
    responseMode: {
      type: String,
      enum: ["doctor", "ambulance", "uber"],
      default: "doctor",
    },
    assignedAmbulanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ambulance",
      default: null,
    },
    assignedHospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
    },
    ambulanceEtaMinutes: {
      type: Number,
    },
    hospitalEtaMinutes: {
      type: Number,
    },
    ambulanceRouteGeoJSON: {
      type: mongoose.Schema.Types.Mixed,
    },
    hospitalRouteGeoJSON: {
      type: mongoose.Schema.Types.Mixed,
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
    // Uber Ride Request API integration state
    uberRide: {
      requestId: { type: String, default: null },
      status: {
        type: String,
        enum: ["idle", "processing", "accepted", "arriving", "in_progress", "completed", "cancelled"],
        default: "idle",
      },
      productId: { type: String, default: "uber-go" },
      vehicleName: { type: String, default: "Uber Go" },
      driverName: { type: String, default: null },
      driverPhone: { type: String, default: null },
      vehiclePlate: { type: String, default: null },
      etaMinutes: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

// Indexes for performance (especially for finding active emergencies quickly)
emergencySchema.index({ status: 1 });
emergencySchema.index({ assignedDoctorId: 1, status: 1 });

export default mongoose.model("Emergency", emergencySchema);

