import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
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
    description: {
      type: String,
      default: "",
    },
    headDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

departmentSchema.index({ name: 1, isActive: 1 });

export default mongoose.model("Department", departmentSchema);
