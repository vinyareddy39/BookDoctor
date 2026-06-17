import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    razorpayOrderId: String,
    razorpayPaymentId: String,

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);