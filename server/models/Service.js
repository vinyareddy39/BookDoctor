import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    durationMinutes: {
      type: Number,
      default: 15,
      min: 5,
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      enum: ["consultation", "diagnostic", "laboratory", "procedure", "other"],
      default: "consultation",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

serviceSchema.index({ departmentId: 1, isActive: 1 });

export default mongoose.model("Service", serviceSchema);
