import mongoose from "mongoose";

const uberConnectionSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    encryptedAccessToken: {
      type: String,
      required: true,
    },
    encryptedRefreshToken: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    scope: {
      type: String,
      default: "request",
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("UberConnection", uberConnectionSchema);
