import mongoose from "mongoose";

const medicalIdSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      default: "",
    },
    dob: {
      type: Date,
      default: null,
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"],
      default: "Unknown",
    },
    allergies: [
      {
        type: String,
      },
    ],
    chronicConditions: [
      {
        type: String,
      },
    ],
    emergencyContacts: [
      {
        name: { type: String, required: true },
        relationship: { type: String, default: "Emergency Contact" },
        phone: { type: String, required: true },
      },
    ],
    activeMedications: [
      {
        drug: String,
        strength: String,
        frequency: String,
      },
    ],
    organDonor: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: "",
    },
    shareableTokens: [
      {
        token: { type: String, required: true, index: true },
        expiresAt: { type: Date, required: true },
        isRevoked: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("MedicalId", medicalIdSchema);
