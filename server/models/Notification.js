import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Alias userId to recipient
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: function () {
        return this.recipient;
      },
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    // Alias body to message
    body: {
      type: String,
      default: function () {
        return this.message;
      },
      trim: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    data: {
      entityType: { type: String, default: null },
      entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
      deepLink: { type: String, default: null },
      metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceModel: {
      type: String,
      default: null,
    },
    link: {
      type: String,
      default: null,
    },
    channels: {
      type: [String],
      enum: ["in_app", "email", "push", "sms_whatsapp"],
      default: ["in_app"],
    },
    status: {
      in_app: { type: String, enum: ["queued", "sent", "delivered", "failed", "none"], default: "sent" },
      email: { type: String, enum: ["queued", "sent", "delivered", "failed", "none"], default: "none" },
      push: { type: String, enum: ["queued", "sent", "delivered", "failed", "none"], default: "none" },
      sms_whatsapp: { type: String, enum: ["queued", "sent", "delivered", "failed", "none"], default: "none" },
    },
    idempotencyKey: {
      type: String,
      default: null,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Synchronize recipient/userId and message/body
notificationSchema.pre("validate", function () {
  if (this.recipient && !this.userId) this.userId = this.recipient;
  if (this.userId && !this.recipient) this.recipient = this.userId;
  if (this.message && !this.body) this.body = this.message;
  if (this.body && !this.message) this.message = this.body;
  if (this.data?.deepLink && !this.link) this.link = this.data.deepLink;
  if (this.link && !this.data?.deepLink) {
    if (!this.data) this.data = {};
    this.data.deepLink = this.link;
  }
});

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
