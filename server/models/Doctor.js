import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    specialization: {
      type: String,
      required: true,
    },

    qualification: {
      type: String,
    },

    experience: {
      type: Number,
      default: 0,
    },

    consultationFee: {
      type: Number,
      required: true,
    },

    bio: {
      type: String,
    },

    image: {
      type: String,
    },

    availableDays: {
      type: [String], // ["Mon","Tue"]
    },

    availableTime: {
      type: String, // "10:00 AM - 5:00 PM"
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    city: {
      type: String,
      default: "Hyderabad",
    },

    clinicName: {
      type: String,
      default: "City Health Clinic",
    },

    address: {
      type: String,
      default: "123 Main St, Hyderabad, Telangana, India",
    },

    mapUrl: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// ─── Indexes for search performance ─────────────────────────────────────────
// Powers GET /doctors?city=&specialization=&available=true
doctorSchema.index({ city: 1, specialization: 1, isAvailable: 1 });
// Ensures one doctor profile per user account
doctorSchema.index({ userId: 1 }, { unique: true });

export default mongoose.model("Doctor", doctorSchema);