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
      required: true,
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
