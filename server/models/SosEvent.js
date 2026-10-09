import mongoose from "mongoose";
import crypto from "crypto";

const sosEventSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    triageAnswers: {
      chestPain: { type: Boolean, default: false },
      difficultyBreathing: { type: Boolean, default: false },
      severeBleeding: { type: Boolean, default: false },
      unconscious: { type: Boolean, default: false },
      strokeSigns: { type: Boolean, default: false },
      severeInjury: { type: Boolean, default: false },
      otherSymptoms: { type: String, default: "" },
    },
    critical: {
      type: Boolean,
      default: false,
      index: true,
    },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      address: { type: String, default: "" },
    },
    hospital: {
      name: { type: String, default: "" },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      phone: { type: String, default: "108" },
      address: { type: String, default: "" },
      source: {
        type: String,
        enum: ["verified_db", "overpass_osm", "nominatim_fallback", "manual_fallback", ""],
        default: "",
      },
      has24x7ER: { type: Boolean, default: true },
      travelDurationMinutes: { type: Number, default: null },
      distanceKm: { type: Number, default: null },
    },
    provider: {
      type: String,
      enum: ["uber_api", "uber_deep_link"],
      default: "uber_deep_link",
    },
    rideRequestId: {
      type: String,
      default: null,
      index: true,
    },
    rideStatus: {
      type: String,
      enum: [
        "unrequested",
        "processing",
        "accepted",
        "arriving",
        "in_progress",
        "completed",
        "rider_canceled",
        "driver_canceled",
        "failed",
      ],
      default: "unrequested",
      index: true,
    },
    driver: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      vehicle: { type: String, default: "" },
      plate: { type: String, default: "" },
      etaMinutes: { type: Number, default: null },
      carLat: { type: Number, default: null },
      carLng: { type: Number, default: null },
    },
    fareEstimate: {
      estimate: { type: String, default: "" },
      productId: { type: String, default: "uber-go" },
      currencyCode: { type: String, default: "INR" },
    },
    shareWithDoctorConsent: {
      type: Boolean,
      default: true,
    },
    assignedDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
      index: true,
    },
    trackingToken: {
      type: String,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(24).toString("hex"),
    },
    trackingTokenExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
    },
    contactsNotifiedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: [
        "initiated",
        "triage_critical",
        "hospital_selected",
        "ride_confirmed",
        "en_route",
        "arrived",
        "resolved",
        "cancelled",
      ],
      default: "initiated",
      index: true,
    },
    audit: [
      {
        action: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        details: { type: mongoose.Schema.Types.Mixed },
      },
    ],
  },
  { timestamps: true }
);

sosEventSchema.index({ patientId: 1, createdAt: -1 });
sosEventSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("SosEvent", sosEventSchema);
