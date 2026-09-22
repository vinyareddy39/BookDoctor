import mongoose from "mongoose";

const ambulanceSchema = new mongoose.Schema(
  {
    driverName: { type: String, required: true },
    phone: { type: String, required: true },
    vehicleNumber: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    isAvailable: { type: Boolean, default: true },
    currentEmergencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Emergency", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Ambulance", ambulanceSchema);
