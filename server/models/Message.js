import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
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
    }
  },
  { timestamps: true }
);

// ─── Indexes for query performance ──────────────────────────────────────────
messageSchema.index({ appointmentId: 1, createdAt: 1 });

export default mongoose.model("Message", messageSchema);
