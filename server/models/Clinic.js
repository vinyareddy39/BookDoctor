import mongoose from "mongoose";

const clinicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: "MedAssist Multi-Specialty Clinic",
    },
    tagline: {
      type: String,
      default: "Advanced Clinical Operations & Patient Care Portal",
    },
    address: {
      type: String,
      default: "Road No. 12, Banjara Hills",
    },
    city: {
      type: String,
      default: "Hyderabad",
    },
    state: {
      type: String,
      default: "Telangana",
    },
    pincode: {
      type: String,
      default: "500034",
    },
    phone: {
      type: String,
      default: "+91 9398927430",
    },
    email: {
      type: String,
      default: "contact@medassist.org",
    },
    emergencyHotline: {
      type: String,
      default: "+91 9849512453",
    },
    taxId: {
      type: String,
      default: "36AAAAA0000A1Z5", // Sample GSTIN
    },
    currency: {
      type: String,
      default: "INR",
    },
    currencySymbol: {
      type: String,
      default: "₹",
    },
    workingHours: {
      days: {
        type: [String],
        default: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      },
      openTime: {
        type: String,
        default: "08:00",
      },
      closeTime: {
        type: String,
        default: "20:00",
      },
    },
    billingSettings: {
      defaultConsultationFee: {
        type: Number,
        default: 500,
      },
      taxPercentage: {
        type: Number,
        default: 5,
      },
      invoicePrefix: {
        type: String,
        default: "INV-MED-",
      },
      acceptedPaymentMethods: {
        type: [String],
        default: ["Cash", "UPI", "Razorpay", "Card"],
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Clinic", clinicSchema);
