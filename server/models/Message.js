import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: false, // Optional for legacy records
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: false, // NOT tied strictly to appointments
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      default: "",
    },
    attachments: [
      {
        url: { type: String, required: true },
        fileType: { type: String, default: "image" },
        originalName: { type: String, default: "" },
        sizeBytes: { type: Number, default: 0 },
      },
    ],
    hasRedFlag: {
      type: Boolean,
      default: false,
    },
    redFlagKeywords: [
      {
        type: String,
      },
    ],
    redFlagSeverity: {
      type: String,
      enum: ["none", "critical", "warning"],
      default: "none",
    },
    messageType: {
      type: String,
      enum: ["text", "image", "document", "prescription_link", "system_alert"],
      default: "text",
    },
    read: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
  },
  { timestamps: true }
);

// ─── Indexes for fast query performance ──────────────────────────────────────
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ appointmentId: 1, createdAt: 1 });
messageSchema.index({ receiverId: 1, read: 1 });

export default mongoose.model("Message", messageSchema);
