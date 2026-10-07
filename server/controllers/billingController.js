import crypto from "crypto";
import Invoice from "../models/Invoice.js";
import Service from "../models/Service.js";
import Clinic from "../models/Clinic.js";
import Appointment from "../models/Appointment.js";
import User from "../models/User.js";
import { recordAudit } from "../middleware/auditLogger.js";
import { getRazorpayClient } from "../services/paymentService.js";
import { createNotification } from "../services/notificationService.js";

// Helper: Fetch Clinic Billing Settings
const getClinicBillingConfig = async () => {
  const clinic = await Clinic.findOne().lean();
  return clinic?.billingSettings || {
    defaultConsultationFee: 500,
    taxPercentage: 5,
    invoicePrefix: "INV-MED-",
    acceptedPaymentMethods: ["Cash", "UPI", "Razorpay", "Card"],
  };
};

// ── 1. CREATE INVOICE (Receptionist, Clinic Admin) ──────────────────────────
export const createInvoice = async (req, res, next) => {
  try {
    const {
      patientId,
      appointmentId,
      doctorId,
      lineItems,
      taxRate,
      discountType = "fixed",
      discountValue = 0,
      notes = "",
      dueDate,
      initialPayment,
    } = req.body;

    if (!patientId) {
      return req.http.badRequest("patientId is required");
    }

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return req.http.badRequest("At least one line item is required to generate an invoice");
    }

    // Verify patient exists
    const patient = await User.findById(patientId);
    if (!patient) {
      return req.http.notFound("Patient record not found");
    }

    // Retrieve clinic tax defaults if not provided
    const billingConfig = await getClinicBillingConfig();
    const effectiveTaxRate = taxRate !== undefined ? Number(taxRate) : billingConfig.taxPercentage || 0;

    // Process and sanitize line items
    const processedItems = lineItems.map((item) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      return {
        serviceId: item.serviceId || null,
        description: item.description || "Medical Service",
        category: item.category || "general",
        quantity: qty,
        unitPrice: price,
        total: Math.round(qty * price * 100) / 100,
      };
    });

    const invoiceNumber = await Invoice.generateInvoiceNumber(billingConfig.invoicePrefix || "INV-MED-");

    const invoice = new Invoice({
      invoiceNumber,
      patientId,
      appointmentId: appointmentId || null,
      doctorId: doctorId || null,
      lineItems: processedItems,
      taxRate: effectiveTaxRate,
      discountType,
      discountValue: Number(discountValue) || 0,
      notes,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdBy: req.user._id,
      payments: [],
      refunds: [],
    });

    // Handle immediate counter payment if submitted with invoice creation
    if (initialPayment && Number(initialPayment.amount) > 0) {
      invoice.payments.push({
        paymentMethod: initialPayment.paymentMethod || "cash",
        amount: Number(initialPayment.amount),
        referenceNumber: initialPayment.referenceNumber || "",
        recordedBy: req.user._id,
        receiptNumber: Invoice.generateReceiptNumber(),
        notes: initialPayment.notes || "Initial payment on invoice creation",
        recordedAt: new Date(),
      });
    }

    // Calculate totals, tax, discount, balance, and status
    invoice.recalculateTotals();
    await invoice.save();

    // If linked to an appointment and balance is zero, update appointment status
    if (appointmentId && invoice.balanceAmount === 0) {
      await Appointment.findByIdAndUpdate(appointmentId, { paymentStatus: "paid" });
    }

    // Immutable audit record
    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "billing",
      resourceId: invoice._id,
      after: invoice.toObject(),
      req,
    });

    // Notify patient
    createNotification({
      recipient: patientId,
      sender: req.user._id,
      title: "New Medical Invoice Issued",
      message: `Invoice ${invoiceNumber} for ₹${invoice.totalAmount} has been issued. Balance due: ₹${invoice.balanceAmount}.`,
      type: "invoice_issued",
      referenceId: invoice._id,
      referenceModel: "Invoice",
      link: "/billing",
    });

    const populated = await Invoice.findById(invoice._id)
      .populate("patientId", "name mrn phone email")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
      .populate("lineItems.serviceId", "name code category");

    return req.http.created(populated, `Invoice ${invoiceNumber} issued successfully`);
  } catch (err) {
    next(err);
  }
};

// ── 2. GET INVOICES (Role-Scoped List with Filters) ──────────────────────────
export const getInvoices = async (req, res, next) => {
  try {
    const { status, patientId, search, startDate, endDate, page = 1, limit = 50 } = req.query;
    let query = {};

    // Patient sees only their own invoices
    if (req.user.role === "patient") {
      query.patientId = req.user._id;
    } else if (patientId) {
      query.patientId = patientId;
    }

    if (status) query.status = status;

    if (startDate || endDate) {
      query.issuedAt = {};
      if (startDate) query.issuedAt.$gte = new Date(startDate);
      if (endDate) query.issuedAt.$lte = new Date(endDate);
    }

    let searchFilter = {};
    if (search && search.trim()) {
      const term = search.trim();
      const matchedPatients = await User.find({
        $or: [
          { name: { $regex: term, $options: "i" } },
          { mrn: { $regex: term, $options: "i" } },
          { phone: { $regex: term, $options: "i" } },
        ],
      }).select("_id");

      const patientIds = matchedPatients.map((p) => p._id);
      searchFilter = {
        $or: [
          { invoiceNumber: { $regex: term, $options: "i" } },
          { patientId: { $in: patientIds } },
        ],
      };
    }

    const finalQuery = { ...query, ...searchFilter };
    const skip = (Number(page) - 1) * Number(limit);

    const [invoices, total] = await Promise.all([
      Invoice.find(finalQuery)
        .populate("patientId", "name mrn phone email")
        .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
        .populate("payments.recordedBy", "name role")
        .sort({ issuedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Invoice.countDocuments(finalQuery),
    ]);

    return req.http.ok(
      {
        invoices,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
      "Invoices retrieved successfully"
    );
  } catch (err) {
    next(err);
  }
};

// ── 3. GET INVOICE BY ID ───────────────────────────────────────────────────
export const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("patientId", "name mrn phone email address dob gender bloodGroup")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
      .populate("lineItems.serviceId", "name code category durationMinutes")
      .populate("payments.recordedBy", "name role")
      .populate("refunds.refundedBy", "name role")
      .populate("voidedBy", "name")
      .populate("createdBy", "name role");

    if (!invoice) {
      return req.http.notFound("Invoice not found");
    }

    // Record-level permission: Patients only see their own
    if (req.user.role === "patient" && String(invoice.patientId._id) !== String(req.user._id)) {
      return req.http.forbidden("Access denied: You may only view your own billing records");
    }

    return req.http.ok(invoice);
  } catch (err) {
    next(err);
  }
};

// ── 4. RECORD COUNTER PAYMENT (Cash / UPI / Card by Receptionist/Admin) ─────
export const recordCounterPayment = async (req, res, next) => {
  try {
    const { amount, paymentMethod, referenceNumber = "", notes = "" } = req.body;
    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      return req.http.badRequest("A positive payment amount is required");
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return req.http.notFound("Invoice not found");
    }

    if (invoice.status === "void") {
      return req.http.badRequest("Cannot collect payment for a voided invoice");
    }

    if (invoice.balanceAmount <= 0) {
      return req.http.badRequest("This invoice has already been paid in full");
    }

    if (paymentAmount > invoice.balanceAmount + 0.01) {
      return req.http.badRequest(
        `Payment amount (₹${paymentAmount}) exceeds outstanding balance (₹${invoice.balanceAmount})`
      );
    }

    const receiptNumber = Invoice.generateReceiptNumber();
    const beforeState = invoice.toObject();

    invoice.payments.push({
      paymentMethod: paymentMethod || "cash",
      amount: paymentAmount,
      referenceNumber,
      recordedBy: req.user._id,
      receiptNumber,
      notes,
      recordedAt: new Date(),
    });

    invoice.recalculateTotals();
    await invoice.save();

    // If attached to an appointment and now paid in full, synchronize appointment
    if (invoice.appointmentId && invoice.balanceAmount === 0) {
      await Appointment.findByIdAndUpdate(invoice.appointmentId, { paymentStatus: "paid" });
    }

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "billing",
      resourceId: invoice._id,
      before: beforeState,
      after: invoice.toObject(),
      req,
    });

    return req.http.ok(
      invoice,
      `Payment of ₹${paymentAmount} recorded successfully (Receipt: ${receiptNumber})`
    );
  } catch (err) {
    next(err);
  }
};

// ── 5. CREATE RAZORPAY CHECKOUT ORDER (Online Patient Payment) ──────────────
export const createRazorpayCheckout = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("patientId", "name email phone");
    if (!invoice) {
      return req.http.notFound("Invoice not found");
    }

    if (invoice.status === "void") {
      return req.http.badRequest("Cannot pay a voided invoice");
    }

    if (invoice.balanceAmount <= 0) {
      return req.http.badRequest("This invoice is already paid in full");
    }

    // Patient access check
    if (req.user.role === "patient" && String(invoice.patientId._id) !== String(req.user._id)) {
      return req.http.forbidden("You may only pay your own invoices");
    }

    const amountInPaise = Math.round(invoice.balanceAmount * 100);

    // Non-production or Demo Mode fallback if Razorpay keys are not configured
    const isDemoMode =
      (process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production") &&
      (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET);

    if (isDemoMode) {
      return req.http.ok({
        demoMode: true,
        orderId: `order_demo_${Date.now()}`,
        amount: amountInPaise,
        currency: "INR",
        keyId: "rzp_test_demokey",
        invoiceNumber: invoice.invoiceNumber,
        patientName: invoice.patientId?.name,
        balanceAmount: invoice.balanceAmount,
      }, "Demo payment order initialized");
    }

    const rzp = getRazorpayClient();
    if (!rzp) {
      return req.http.serverError("Razorpay gateway client is uninitialized");
    }

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `inv_${invoice._id.toString().slice(-8)}_${Date.now().toString().slice(-4)}`,
      notes: {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        patientId: invoice.patientId?._id?.toString(),
      },
    };

    const order = await rzp.orders.create(options);

    return req.http.ok({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      invoiceNumber: invoice.invoiceNumber,
      patientName: invoice.patientId?.name,
      patientEmail: invoice.patientId?.email,
      patientPhone: invoice.patientId?.phone,
      balanceAmount: invoice.balanceAmount,
    });
  } catch (err) {
    next(err);
  }
};

// ── 6. VERIFY RAZORPAY PAYMENT ──────────────────────────────────────────────
export const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, demoMode } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return req.http.notFound("Invoice not found");
    }

    if (invoice.balanceAmount <= 0) {
      return req.http.badRequest("Invoice is already fully settled");
    }

    // Demo Mode Verification Bypass
    const isDemoAllowed =
      (process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production") && demoMode;

    if (!isDemoAllowed) {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return req.http.badRequest("Razorpay payment credentials and signature are required");
      }

      const secret = process.env.RAZORPAY_KEY_SECRET;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return req.http.badRequest("Invalid Razorpay payment signature. Payment verification failed.");
      }
    }

    const beforeState = invoice.toObject();
    const paidAmount = invoice.balanceAmount; // Settles current remaining balance
    const receiptNumber = Invoice.generateReceiptNumber();

    invoice.payments.push({
      paymentMethod: "razorpay",
      amount: paidAmount,
      referenceNumber: razorpay_payment_id || `demo_pay_${Date.now()}`,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      recordedBy: req.user._id,
      receiptNumber,
      notes: "Online Payment via Razorpay Gateway",
      recordedAt: new Date(),
    });

    invoice.recalculateTotals();
    await invoice.save();

    if (invoice.appointmentId && invoice.balanceAmount === 0) {
      await Appointment.findByIdAndUpdate(invoice.appointmentId, { paymentStatus: "paid" });
    }

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "billing",
      resourceId: invoice._id,
      before: beforeState,
      after: invoice.toObject(),
      req,
    });

    return req.http.ok(
      invoice,
      `Online payment of ₹${paidAmount} verified successfully. Receipt: ${receiptNumber}`
    );
  } catch (err) {
    next(err);
  }
};

// ── 7. VOID INVOICE (Clinic Admin Only) ─────────────────────────────────────
export const voidInvoice = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return req.http.badRequest("A justification reason is required to void an invoice");
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return req.http.notFound("Invoice not found");
    }

    if (invoice.status === "void") {
      return req.http.badRequest("Invoice is already voided");
    }

    if (invoice.paidAmount > 0) {
      return req.http.badRequest(
        "Cannot void an invoice with recorded payments. Please process refunds first."
      );
    }

    const beforeState = invoice.toObject();
    invoice.status = "void";
    invoice.voidReason = reason.trim();
    invoice.voidedBy = req.user._id;
    invoice.voidedAt = new Date();
    await invoice.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "billing",
      resourceId: invoice._id,
      before: beforeState,
      after: invoice.toObject(),
      req,
    });

    return req.http.ok(invoice, `Invoice ${invoice.invoiceNumber} has been voided`);
  } catch (err) {
    next(err);
  }
};

// ── 8. PROCESS REFUND (Clinic Admin Only) ───────────────────────────────────
export const processRefund = async (req, res, next) => {
  try {
    const { amount, reason, method = "original_method", reference = "" } = req.body;
    const refundAmount = Number(amount);

    if (!refundAmount || refundAmount <= 0) {
      return req.http.badRequest("A valid positive refund amount is required");
    }

    if (!reason || !reason.trim()) {
      return req.http.badRequest("Refund reason is required");
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return req.http.notFound("Invoice not found");
    }

    if (refundAmount > invoice.paidAmount) {
      return req.http.badRequest(
        `Refund amount (₹${refundAmount}) cannot exceed net paid amount (₹${invoice.paidAmount})`
      );
    }

    const beforeState = invoice.toObject();
    invoice.refunds.push({
      amount: refundAmount,
      reason: reason.trim(),
      refundedBy: req.user._id,
      refundedAt: new Date(),
      method,
      reference,
    });

    invoice.recalculateTotals();
    await invoice.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "billing",
      resourceId: invoice._id,
      before: beforeState,
      after: invoice.toObject(),
      req,
    });

    return req.http.ok(invoice, `Refund of ₹${refundAmount} recorded successfully`);
  } catch (err) {
    next(err);
  }
};

// ── 9. REVENUE & FINANCIAL REPORT (Clinic Admin, Receptionist) ──────────────
export const getRevenueReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    let matchQuery = { status: { $ne: "void" } };

    if (startDate || endDate) {
      matchQuery.issuedAt = {};
      if (startDate) matchQuery.issuedAt.$gte = new Date(startDate);
      if (endDate) matchQuery.issuedAt.$lte = new Date(endDate);
    }

    const invoices = await Invoice.find(matchQuery).lean();

    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalRefunded = 0;
    let totalTaxCollected = 0;
    let totalDiscountGiven = 0;

    const methodBreakdown = {
      cash: 0,
      upi: 0,
      card: 0,
      razorpay: 0,
      other: 0,
    };

    invoices.forEach((inv) => {
      totalInvoiced += inv.totalAmount || 0;
      totalCollected += inv.paidAmount || 0;
      totalOutstanding += inv.balanceAmount || 0;
      totalTaxCollected += inv.taxAmount || 0;
      totalDiscountGiven += inv.discountAmount || 0;

      inv.payments?.forEach((p) => {
        const m = p.paymentMethod?.toLowerCase() || "other";
        if (methodBreakdown[m] !== undefined) {
          methodBreakdown[m] += p.amount || 0;
        } else {
          methodBreakdown.other += p.amount || 0;
        }
      });

      inv.refunds?.forEach((r) => {
        totalRefunded += r.amount || 0;
      });
    });

    return req.http.ok({
      totalInvoices: invoices.length,
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalRefunded: Math.round(totalRefunded * 100) / 100,
      totalTaxCollected: Math.round(totalTaxCollected * 100) / 100,
      totalDiscountGiven: Math.round(totalDiscountGiven * 100) / 100,
      methodBreakdown,
    });
  } catch (err) {
    next(err);
  }
};

// ── 10. GET & UPDATE BILLING SETTINGS (Clinic Admin) ────────────────────────
export const getBillingSettings = async (req, res, next) => {
  try {
    const config = await getClinicBillingConfig();
    return req.http.ok(config);
  } catch (err) {
    next(err);
  }
};

export const updateBillingSettings = async (req, res, next) => {
  try {
    const { defaultConsultationFee, taxPercentage, invoicePrefix, acceptedPaymentMethods } = req.body;

    let clinic = await Clinic.findOne();
    if (!clinic) {
      clinic = new Clinic({ name: "MedAssist Clinic" });
    }

    if (!clinic.billingSettings) {
      clinic.billingSettings = {};
    }

    if (defaultConsultationFee !== undefined) {
      clinic.billingSettings.defaultConsultationFee = Number(defaultConsultationFee);
    }
    if (taxPercentage !== undefined) {
      clinic.billingSettings.taxPercentage = Number(taxPercentage);
    }
    if (invoicePrefix !== undefined) {
      clinic.billingSettings.invoicePrefix = invoicePrefix.trim();
    }
    if (acceptedPaymentMethods && Array.isArray(acceptedPaymentMethods)) {
      clinic.billingSettings.acceptedPaymentMethods = acceptedPaymentMethods;
    }

    await clinic.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "clinic_settings",
      resourceId: clinic._id,
      after: clinic.billingSettings,
      req,
    });

    return req.http.ok(clinic.billingSettings, "Billing settings updated successfully");
  } catch (err) {
    next(err);
  }
};
