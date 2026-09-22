import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    specialties: [{ type: String }],
    erBedsAvailable: { type: Number, default: 0 },
    icuBedsAvailable: { type: Number, default: 0 },
    phone: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Hospital", hospitalSchema);
