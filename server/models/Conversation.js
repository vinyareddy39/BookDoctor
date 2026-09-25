import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      text: { type: String, default: "" },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timestamp: { type: Date, default: Date.now },
      status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
    },
    lastMessageTimestamp: {
      type: Date,
      default: Date.now,
    },
    // Unread count keyed by string userId: { "64fa...": 2, "64fb...": 0 }
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: false,
    },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageTimestamp: -1 });

export default mongoose.model("Conversation", conversationSchema);
