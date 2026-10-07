import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    phone: {
      type: String,
    },

    profilePicture: {
      type: String,
      default: "",
    },

    dob: {
      type: Date,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },

    bloodGroup: {
      type: String,
      default: "",
    },

    emergencyContact: {
      type: String,
      default: "",
    },

    // ─── SOS Emergency & Medical ID ───────────────────────────────────────────
    medicalId: {
      bloodGroup: { type: String, default: "" },
      allergies: { type: String, default: "" },
      conditions: { type: String, default: "" },
      medications: { type: String, default: "" },
    },
    
    // Uber Emergency Auto-Dispatch Linking
    uberAccount: {
      isConnected: { type: Boolean, default: false },
      uberEmail: { type: String, default: "" },
      connectedAt: { type: Date }
    },
    emergencyContacts: [
      {
        name: { type: String },
        phone: { type: String },
      }
    ],

    role: {
      type: String,
      enum: [
        "patient",
        "doctor",
        "clinic_admin",
        "receptionist",
        "lab_technician",
        "admin" // Retained for backwards compatibility; auto-migrates to clinic_admin
      ],
      default: "patient",
    },

    // Medical Record Number (MRN) for clinical identification
    mrn: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    // ─── Family Profiles ──────────────────────────────────────────────────────
    dependents: [
      {
        name: { type: String, required: true },
        relation: { type: String, required: true }, // e.g. "Parent", "Child", "Spouse"
        dob: { type: Date },
        gender: { type: String, enum: ["male", "female", "other", ""] }
      }
    ],

    // ─── Email Verification ───────────────────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },

    // ─── Password Reset ───────────────────────────────────────────────────────
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },

    // ─── Refresh Token ────────────────────────────────────────────────────────
    refreshToken: {
      type: String,
      select: false,
    },
  },
  { timestamps: true }
);

// Auto-migrate legacy 'admin' to 'clinic_admin' and hash password before save
userSchema.pre("save", async function () {
  if (this.role === "admin") {
    this.role = "clinic_admin";
  }
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

// compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// generate password reset token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  return resetToken;
};

// generate email verification token
userSchema.methods.getEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto.createHash("sha256").update(token).digest("hex");
  return token;
};

// generate unique Medical Record Number (MRN)
userSchema.statics.generateMRN = async function () {
  const year = new Date().getFullYear();
  const prefix = `MED-${year}-`;
  const lastPatient = await this.findOne({ mrn: new RegExp(`^${prefix}`) })
    .sort({ mrn: -1 })
    .select("mrn")
    .lean();

  let nextSeq = 1;
  if (lastPatient && lastPatient.mrn) {
    const parts = lastPatient.mrn.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }
  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
};

// ─── Indexes for query performance ──────────────────────────────────────────
userSchema.index({ email: 1, role: 1 });
userSchema.index({ role: 1 });

export default mongoose.model("User", userSchema);