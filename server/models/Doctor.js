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

    // ─── Admin Verification ───────────────────────────────────────────────────
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Average rating (denormalized for fast sorting)
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalReviews: {
      type: Number,
      default: 0,
    },

    // ─── Google Calendar Integration ─────────────────────────────────────
    googleAccessToken: {
      type: String,
      select: false, // never returned in API responses
    },
    googleRefreshToken: {
      type: String,
      select: false, // never returned in API responses
    },
    // ─── Google Calendar Sync ────────────────────────────────────────────────
    googleAccessToken: String,
    googleRefreshToken: String,
    googleCalendarSynced: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ─── Indexes for search performance ─────────────────────────────────────────
doctorSchema.index({ city: 1, specialization: 1, isAvailable: 1 });
doctorSchema.index({ userId: 1 }, { unique: true });
doctorSchema.index({ averageRating: -1 });
doctorSchema.index({ consultationFee: 1 });

export default mongoose.model("Doctor", doctorSchema);