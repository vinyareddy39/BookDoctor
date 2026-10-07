import mongoose from "mongoose";

const lineItemSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "general",
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const paymentRecordSchema = new mongoose.Schema(
  {
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "razorpay", "other"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    referenceNumber: {
      type: String,
      default: "",
      trim: true,
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
    receiptNumber: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { _id: true }
);

const refundRecordSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    refundedAt: {
      type: Date,
      default: Date.now,
    },
    method: {
      type: String,
      enum: ["cash", "upi", "original_method", "other"],
      default: "original_method",
    },
    reference: {
      type: String,
      default: "",
    },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
    },
    lineItems: [lineItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    taxRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    taxAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "fixed",
    },
    discountValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paidAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    balanceAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ["draft", "issued", "paid", "partial", "void"],
      default: "issued",
      index: true,
    },
    payments: [paymentRecordSchema],
    refunds: [refundRecordSchema],
    notes: {
      type: String,
      default: "",
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    voidReason: {
      type: String,
      default: null,
    },
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    voidedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-calculate financial totals before saving
invoiceSchema.methods.recalculateTotals = function () {
  const sub = this.lineItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  this.subtotal = Math.round(sub * 100) / 100;

  // Calculate discount
  let disc = 0;
  if (this.discountType === "percentage") {
    disc = (this.subtotal * (this.discountValue || 0)) / 100;
  } else {
    disc = this.discountValue || 0;
  }
  this.discountAmount = Math.min(this.subtotal, Math.round(disc * 100) / 100);

  const taxableAmount = Math.max(0, this.subtotal - this.discountAmount);
  this.taxAmount = Math.round(((taxableAmount * (this.taxRate || 0)) / 100) * 100) / 100;

  this.totalAmount = Math.round((taxableAmount + this.taxAmount) * 100) / 100;

  const totalPaid = this.payments.reduce((acc, p) => acc + p.amount, 0);
  const totalRefunded = this.refunds.reduce((acc, r) => acc + r.amount, 0);
  this.paidAmount = Math.round((totalPaid - totalRefunded) * 100) / 100;

  this.balanceAmount = Math.max(0, Math.round((this.totalAmount - this.paidAmount) * 100) / 100);

  if (this.status !== "void") {
    if (this.paidAmount >= this.totalAmount && this.totalAmount > 0) {
      this.status = "paid";
      if (!this.paidAt) this.paidAt = new Date();
    } else if (this.paidAmount > 0) {
      this.status = "partial";
    } else {
      this.status = "issued";
    }
  }
};

// Static helper to generate sequential invoice number
invoiceSchema.statics.generateInvoiceNumber = async function (prefix = "INV-MED-") {
  const currentYear = new Date().getFullYear();
  const searchPrefix = `${prefix}${currentYear}-`;
  const count = await this.countDocuments({
    invoiceNumber: { $regex: `^${searchPrefix}` },
  });
  const sequence = String(count + 1).padStart(5, "0");
  return `${searchPrefix}${sequence}`;
};

// Static helper to generate sequential payment receipt number
invoiceSchema.statics.generateReceiptNumber = function () {
  const now = new Date();
  const yr = now.getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RCP-${yr}-${rand}`;
};

export default mongoose.model("Invoice", invoiceSchema);
