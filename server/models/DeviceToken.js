import mongoose from "mongoose";

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["web", "android", "ios"],
      default: "web",
    },
    token: {
      type: String,
      default: null,
    },
    endpoint: {
      type: String,
      default: null,
    },
    keys: {
      p256dh: { type: String, default: null },
      auth: { type: String, default: null },
    },
    userAgent: {
      type: String,
      default: "",
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

deviceTokenSchema.index({ userId: 1, platform: 1 });
deviceTokenSchema.index({ endpoint: 1 });

export default mongoose.model("DeviceToken", deviceTokenSchema);
