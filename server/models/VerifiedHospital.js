import mongoose from "mongoose";

const verifiedHospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
    phone: {
      type: String,
      default: "108",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    has24x7ER: {
      type: Boolean,
      default: true,
    },
    verified: {
      type: Boolean,
      default: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["seed", "admin", "osm"],
      default: "seed",
    },
  },
  { timestamps: true }
);

verifiedHospitalSchema.index({ lat: 1, lng: 1 });

export default mongoose.model("VerifiedHospital", verifiedHospitalSchema);
