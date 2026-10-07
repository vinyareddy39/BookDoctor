import { useState, useEffect, useCallback } from "react";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import { exportInvoiceToPDF } from "../utils/export";
import toast from "react-hot-toast";

export default function BillingManagement() {
  const { user, isAdmin, isClinicAdmin, isReceptionist, isDoctor, isPatient } = useAuth();
  const canManageBilling = isAdmin || isClinicAdmin || isReceptionist;
  const canAdminAdjust = isAdmin || isClinicAdmin;

  // Invoices list state
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'issued' | 'partial' | 'paid' | 'void'
  const [searchQuery, setSearchQuery] = useState("");
  const [clinicConfig, setClinicConfig] = useState(null);

  // Revenue analytics state
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [revenueReport, setRevenueReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // New Invoice Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  // Invoice Form
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [formLineItems, setFormLineItems] = useState([
    { serviceId: "", description: "General Consultation", category: "consultation", quantity: 1, unitPrice: 500, total: 500 },
  ]);
  const [taxRate, setTaxRate] = useState(5);
  const [discountType, setDiscountType] = useState("fixed");
  const [discountValue, setDiscountValue] = useState(0);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [collectNow, setCollectNow] = useState(true);
  const [immediatePayment, setImmediatePayment] = useState({
    paymentMethod: "cash",
    amount: 500,
    referenceNumber: "",
    notes: "Counter collection",
  });

  // Collect Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);

  // Refund Modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [processingRefund, setProcessingRefund] = useState(false);

  // Void Modal state
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [processingVoid, setProcessingVoid] = useState(false);

  // Fetch Invoices
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, clinicRes] = await Promise.all([
        API.get("/billing/invoices"),
        API.get("/clinic").catch(() => ({ data: { data: {} } })),
      ]);
      setInvoices(invRes.data?.data?.invoices || invRes.data?.data || []);
      setClinicConfig(clinicRes.data?.data || {});
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Load lookup options (patients, services, doctors) for invoice creation
  const loadLookups = async () => {
    if (patients.length > 0 && services.length > 0) return;
    setLoadingLookups(true);
    try {
      const [patRes, srvRes, docRes, settingsRes] = await Promise.all([
        API.get("/emr/patients").catch(() => ({ data: { data: [] } })),
        API.get("/services").catch(() => ({ data: { data: [] } })),
        API.get("/doctors").catch(() => ({ data: { data: [] } })),
        API.get("/billing/settings").catch(() => ({ data: { data: {} } })),
      ]);

      setPatients(patRes.data?.data || []);
      setServices(srvRes.data?.data || []);
      setDoctors(docRes.data?.data || []);

      const settings = settingsRes.data?.data || {};
      if (settings.taxPercentage !== undefined) {
        setTaxRate(settings.taxPercentage);
      }
      if (settings.defaultConsultationFee !== undefined) {
        const defaultFee = settings.defaultConsultationFee;
        setFormLineItems([
          { serviceId: "", description: "General Consultation", category: "consultation", quantity: 1, unitPrice: defaultFee, total: defaultFee },
        ]);
        setImmediatePayment((prev) => ({ ...prev, amount: defaultFee }));
      }
    } catch (err) {
      console.warn("Could not load lookups:", err);
    } finally {
      setLoadingLookups(false);
    }
  };

  const handleOpenCreateModal = () => {
    loadLookups();
    setSelectedPatientId("");
    setSelectedDoctorId("");
    setDiscountValue(0);
    setInvoiceNotes("");
    setShowCreateModal(true);
  };

  // Line item manipulation
  const handleAddLineItem = () => {
    setFormLineItems([
      ...formLineItems,
      { serviceId: "", description: "", category: "service", quantity: 1, unitPrice: 0, total: 0 },
    ]);
  };

  const handleRemoveLineItem = (idx) => {
    if (formLineItems.length <= 1) return;
    setFormLineItems(formLineItems.filter((_, i) => i !== idx));
  };

  const handleLineItemChange = (idx, field, value) => {
    const updated = [...formLineItems];
    updated[idx][field] = value;

    if (field === "serviceId" && value) {
      const srv = services.find((s) => s._id === value);
      if (srv) {
        updated[idx].description = srv.name;
        updated[idx].category = srv.category || "procedure";
        updated[idx].unitPrice = srv.price;
        updated[idx].total = Math.round(updated[idx].quantity * srv.price * 100) / 100;
      }
    } else if (field === "quantity" || field === "unitPrice") {
      const q = Number(updated[idx].quantity) || 1;
      const p = Number(updated[idx].unitPrice) || 0;
      updated[idx].total = Math.round(q * p * 100) / 100;
    }

    setFormLineItems(updated);
  };

  // Real-time calculation helpers for invoice form
  const formSubtotal = formLineItems.reduce((acc, i) => acc + (Number(i.total) || 0), 0);
  const formDiscountAmount =
    discountType === "percentage"
      ? (formSubtotal * (Number(discountValue) || 0)) / 100
      : Math.min(formSubtotal, Number(discountValue) || 0);
  const formTaxable = Math.max(0, formSubtotal - formDiscountAmount);
  const formTaxAmount = Math.round(((formTaxable * (Number(taxRate) || 0)) / 100) * 100) / 100;
  const formTotal = Math.round((formTaxable + formTaxAmount) * 100) / 100;

  // Synchronize immediate payment amount when total changes
  useEffect(() => {
    if (collectNow) {
      setImmediatePayment((prev) => ({ ...prev, amount: formTotal }));
    }
  }, [formTotal, collectNow]);

  // Create Invoice Submission
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      toast.error("Please select a patient");
      return;
    }

    const validItems = formLineItems.filter((i) => i.description.trim() && i.unitPrice >= 0);
    if (validItems.length === 0) {
      toast.error("Please add at least one valid service line item");
      return;
    }

    setSubmittingInvoice(true);
    try {
      const payload = {
        patientId: selectedPatientId,
        doctorId: selectedDoctorId || null,
        lineItems: validItems,
        taxRate: Number(taxRate) || 0,
        discountType,
        discountValue: Number(discountValue) || 0,
        notes: invoiceNotes,
        initialPayment: collectNow && Number(immediatePayment.amount) > 0 ? immediatePayment : null,
      };

      await API.post("/billing/invoices", payload);
      toast.success("Invoice generated successfully");
      setShowCreateModal(false);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create invoice");
    } finally {
      setSubmittingInvoice(false);
    }
  };

  // Open Payment Modal
  const handleOpenPaymentModal = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.balanceAmount);
    setPaymentMethod("cash");
    setReferenceNumber("");
    setPaymentNotes("");
    setShowPaymentModal(true);
  };

  // Submit Counter Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    setProcessingPayment(true);
    try {
      const res = await API.post(`/billing/invoices/${selectedInvoice._id}/payments`, {
        amount: amt,
        paymentMethod,
        referenceNumber,
        notes: paymentNotes,
      });

      toast.success(res.data?.message || `Payment of ₹${amt} recorded successfully`);
      setShowPaymentModal(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record payment");
    } finally {
      setProcessingPayment(false);
    }
  };

  // Online Razorpay Payment Checkout
  const handleRazorpayPayment = async (invoice) => {
    try {
      const toastId = toast.loading("Initializing secure payment gateway…");
      const res = await API.post(`/billing/invoices/${invoice._id}/checkout`);
      const checkoutData = res.data?.data;
      toast.dismiss(toastId);

      // Handle Demo Mode Bypass (non-production when keys are not configured)
      if (checkoutData?.demoMode) {
        const verifyRes = await API.post(`/billing/invoices/${invoice._id}/verify-payment`, {
          demoMode: true,
          razorpay_order_id: checkoutData.orderId,
          razorpay_payment_id: `pay_demo_${Date.now()}`,
          razorpay_signature: "demo_signature",
        });
        toast.success(verifyRes.data?.message || "Demo payment settled successfully!");
        fetchInvoices();
        return;
      }

      // Check if Razorpay script is loaded
      if (typeof window.Razorpay === "undefined") {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      const options = {
        key: checkoutData.keyId,
        amount: checkoutData.amount,
        currency: checkoutData.currency || "INR",
        name: "MedAssist Healthcare",
        description: `Settlement for Invoice ${invoice.invoiceNumber}`,
        order_id: checkoutData.orderId,
        prefill: {
          name: checkoutData.patientName,
          email: checkoutData.patientEmail,
          contact: checkoutData.patientPhone,
        },
        theme: {
          color: "#0f172a",
        },
        handler: async function (response) {
          try {
            const vToast = toast.loading("Verifying payment transaction…");
            await API.post(`/billing/invoices/${invoice._id}/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.dismiss(vToast);
            toast.success("Payment verified and invoice settled!");
            fetchInvoices();
          } catch (err) {
            toast.error(err.response?.data?.message || "Payment verification failed");
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to initialize online payment");
    }
  };

  // Void Invoice
  const handleOpenVoidModal = (invoice) => {
    setSelectedInvoice(invoice);
    setVoidReason("");
    setShowVoidModal(true);
  };

  const handleConfirmVoid = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setProcessingVoid(true);
    try {
      await API.patch(`/billing/invoices/${selectedInvoice._id}/void`, {
        reason: voidReason,
      });
      toast.success("Invoice voided successfully");
      setShowVoidModal(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to void invoice");
    } finally {
      setProcessingVoid(false);
    }
  };

  // Process Refund
  const handleOpenRefundModal = (invoice) => {
    setSelectedInvoice(invoice);
    setRefundAmount(invoice.paidAmount);
    setRefundReason("");
    setShowRefundModal(true);
  };

  const handleConfirmRefund = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setProcessingRefund(true);
    try {
      await API.post(`/billing/invoices/${selectedInvoice._id}/refund`, {
        amount: Number(refundAmount),
        reason: refundReason,
      });
      toast.success(`Refund of ₹${refundAmount} processed successfully`);
      setShowRefundModal(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to process refund");
    } finally {
      setProcessingRefund(false);
    }
  };

  // Load Financial Revenue Report
  const handleOpenRevenueModal = async () => {
    setShowRevenueModal(true);
    setLoadingReport(true);
    try {
      const res = await API.get("/billing/reports/revenue");
      setRevenueReport(res.data?.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate revenue report");
    } finally {
      setLoadingReport(false);
    }
  };

  // Filter Invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (activeTab === "issued" && inv.status !== "issued") return false;
    if (activeTab === "partial" && inv.status !== "partial") return false;
    if (activeTab === "paid" && inv.status !== "paid") return false;
    if (activeTab === "void" && inv.status !== "void") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const num = inv.invoiceNumber?.toLowerCase() || "";
      const pat = inv.patientId?.name?.toLowerCase() || "";
      const mrn = inv.patientId?.mrn?.toLowerCase() || "";
      const phone = inv.patientId?.phone || "";
      if (!num.includes(q) && !pat.includes(q) && !mrn.includes(q) && !phone.includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Financial Summary Cards
  const totalBilled = invoices
    .filter((i) => i.status !== "void")
    .reduce((acc, i) => acc + (i.totalAmount || 0), 0);
  const totalCollected = invoices
    .filter((i) => i.status !== "void")
    .reduce((acc, i) => acc + (i.paidAmount || 0), 0);
  const totalOutstanding = invoices
    .filter((i) => i.status !== "void")
    .reduce((acc, i) => acc + (i.balanceAmount || 0), 0);
  const totalVoidCount = invoices.filter((i) => i.status === "void").length;

  const getStatusBadge = (status) => {
    switch (status) {
      case "paid":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Paid in Full</span>;
      case "partial":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">Partially Paid</span>;
      case "issued":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">Issued • Pending</span>;
      case "void":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">Void</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="section py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 md:p-8 rounded-3xl text-white shadow-xl shadow-slate-950/20">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">💳</span>
            <span className="text-xs font-bold tracking-widest uppercase bg-teal-500/30 text-teal-200 px-2.5 py-1 rounded-full border border-teal-400/30">
              Accounts & Financial Desk
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Clinic Billing & Invoices</h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Generate service invoices, record counter receipts (Cash/UPI/Card), facilitate Razorpay online checkout, and track clinical revenue.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canAdminAdjust && (
            <button
              onClick={handleOpenRevenueModal}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition text-sm font-semibold flex items-center gap-2"
              title="View Financial Revenue Analytics"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="hidden sm:inline">Revenue Intelligence</span>
            </button>
          )}

          {canManageBilling && (
            <button
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-sm shadow-lg shadow-teal-500/25 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Billed</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">₹{totalBilled.toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-slate-400 mt-1">Excludes voided invoices</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-100 shadow-sm bg-gradient-to-br from-white to-emerald-50/20">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Net Collected</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1">₹{totalCollected.toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-emerald-600/70 mt-1">Cash, UPI & Razorpay settlements</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-100 shadow-sm bg-gradient-to-br from-white to-rose-50/20">
          <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Outstanding Due</p>
          <p className="text-2xl sm:text-3xl font-black text-rose-800 mt-1">₹{totalOutstanding.toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-rose-600/70 mt-1">Pending patient receivables</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Invoices</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">{invoices.length}</p>
          <p className="text-[10px] text-slate-400 mt-1">{totalVoidCount} voided records</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All Invoices" },
            { id: "issued", label: "Pending" },
            { id: "partial", label: "Partial" },
            { id: "paid", label: "Paid in Full" },
            { id: "void", label: "Void" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search Invoice #, patient, MRN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-8 py-1.5 text-xs rounded-xl bg-slate-50 border-slate-200 w-full"
          />
          <svg
            className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Invoices List */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200/80 text-center flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-semibold text-slate-500">Loading clinic invoices…</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200/80 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">
            🧾
          </div>
          <h3 className="text-base font-bold text-slate-800">No invoices found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || activeTab !== "all"
              ? "Try adjusting your search criteria or status filter."
              : "No clinical service invoices have been issued yet."}
          </p>
          {canManageBilling && (
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition"
            >
              Issue First Invoice
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredInvoices.map((inv) => {
            const patient = inv.patientId || {};
            const doctor = inv.doctorId || {};
            const docName = doctor.userId?.name || doctor.name || null;
            const isSettled = inv.balanceAmount === 0;

            return (
              <div
                key={inv._id}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 p-5 shadow-sm transition hover:shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Left: Invoice Details */}
                <div className="space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                      {inv.invoiceNumber}
                    </span>
                    {getStatusBadge(inv.status)}
                    <span className="text-[11px] text-slate-400">
                      Issued: {new Date(inv.issuedAt || inv.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>{patient.name || "Patient"}</span>
                      {patient.mrn && (
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {patient.mrn}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Phone: <span className="font-medium text-slate-700">{patient.phone || "N/A"}</span>
                      {docName && (
                        <span> • Consultant: <span className="font-semibold text-slate-700">Dr. {docName}</span></span>
                      )}
                    </p>
                  </div>

                  {/* Line Items summary */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {inv.lineItems?.map((item, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium"
                      >
                        {item.description} {item.quantity > 1 ? `(x${item.quantity})` : ""} - ₹{item.total}
                      </span>
                    ))}
                  </div>

                  {inv.notes && (
                    <p className="text-xs text-slate-400 italic">Notes: {inv.notes}</p>
                  )}
                  {inv.status === "void" && inv.voidReason && (
                    <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-200">
                      Voided: {inv.voidReason}
                    </p>
                  )}
                </div>

                {/* Center / Right: Financial Numbers */}
                <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center border-t lg:border-t-0 pt-3 lg:pt-0 gap-1 min-w-[150px]">
                  <p className="text-xs text-slate-400 font-medium">
                    Total: <span className="text-slate-800 font-bold">₹{inv.totalAmount?.toFixed(2)}</span>
                  </p>
                  <p className="text-xs text-emerald-700 font-medium">
                    Paid: <span className="font-bold">₹{inv.paidAmount?.toFixed(2)}</span>
                  </p>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Balance Due</p>
                    <p className={`text-xl font-black ${inv.balanceAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {inv.balanceAmount > 0 ? `₹${inv.balanceAmount?.toFixed(2)}` : "₹0.00"}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0">
                  {/* Collect Counter Payment */}
                  {!isSettled && inv.status !== "void" && canManageBilling && (
                    <button
                      onClick={() => handleOpenPaymentModal(inv)}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                    >
                      <span>💵</span> Collect Payment
                    </button>
                  )}

                  {/* Online Razorpay Payment */}
                  {!isSettled && inv.status !== "void" && (
                    <button
                      onClick={() => handleRazorpayPayment(inv)}
                      className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>⚡</span> Pay Online
                    </button>
                  )}

                  {/* Print / Download Invoice PDF */}
                  <button
                    onClick={() => exportInvoiceToPDF(inv, clinicConfig)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Print PDF</span>
                  </button>

                  {/* Admin: Refund */}
                  {canAdminAdjust && inv.paidAmount > 0 && inv.status !== "void" && (
                    <button
                      onClick={() => handleOpenRefundModal(inv)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-amber-700 hover:bg-amber-50 text-xs font-semibold transition"
                      title="Process Refund"
                    >
                      Refund
                    </button>
                  )}

                  {/* Admin: Void */}
                  {canAdminAdjust && inv.paidAmount === 0 && inv.status !== "void" && (
                    <button
                      onClick={() => handleOpenVoidModal(inv)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
                      title="Void Invoice"
                    >
                      Void
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: Create New Invoice ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span>🧾</span> Issue Medical Services Invoice
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Generate a billing invoice with itemized clinical services & taxes</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-5">
              {/* Patient and Doctor Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Patient *
                  </label>
                  {loadingLookups ? (
                    <p className="text-xs text-slate-400">Loading patients…</p>
                  ) : (
                    <select
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      required
                      className="input w-full rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
                    >
                      <option value="">-- Choose Patient (MRN / Name) --</option>
                      {patients.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} {p.mrn ? `(${p.mrn})` : ""} - {p.phone || p.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Attending Physician (Optional)
                  </label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="input w-full rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
                  >
                    <option value="">-- Select Doctor --</option>
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        Dr. {d.userId?.name || d.name} ({d.specialization || "General"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Service Line Items ({formLineItems.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                  >
                    + Add Service
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formLineItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-2.5 items-center">
                      {/* Pick from services dropdown if available */}
                      <div className="w-full sm:w-1/3">
                        <select
                          value={item.serviceId}
                          onChange={(e) => handleLineItemChange(idx, "serviceId", e.target.value)}
                          className="input py-1 px-2 text-xs rounded-lg w-full bg-white border-slate-200"
                        >
                          <option value="">-- Pick Clinic Service --</option>
                          {services.map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.name} (₹{s.price})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Description */}
                      <div className="w-full sm:flex-1">
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => handleLineItemChange(idx, "description", e.target.value)}
                          required
                          className="input py-1 px-2 text-xs rounded-lg w-full bg-white border-slate-200"
                        />
                      </div>

                      {/* Qty */}
                      <div className="w-20">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleLineItemChange(idx, "quantity", e.target.value)}
                          className="input py-1 px-2 text-xs rounded-lg w-full text-center bg-white border-slate-200"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Price (₹)"
                          value={item.unitPrice}
                          onChange={(e) => handleLineItemChange(idx, "unitPrice", e.target.value)}
                          className="input py-1 px-2 text-xs rounded-lg w-full font-bold bg-white border-slate-200"
                        />
                      </div>

                      {/* Item Total & Delete */}
                      <div className="flex items-center justify-between w-full sm:w-auto gap-3">
                        <span className="font-bold text-xs text-slate-800 w-16 text-right">
                          ₹{item.total}
                        </span>
                        {formLineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            className="text-slate-300 hover:text-rose-500 font-bold transition p-1"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax & Discount Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    GST / Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="input py-1 px-2 text-xs rounded-lg bg-white border-slate-200 w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="input py-1 px-2 text-xs rounded-lg bg-white border-slate-200 w-full"
                  >
                    <option value="fixed">Fixed Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Discount Value
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="input py-1 px-2 text-xs rounded-lg bg-white border-slate-200 w-full"
                  />
                </div>
              </div>

              {/* Real-time Financial Breakdown */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 text-xs text-slate-600 border-t sm:border-t-0 pt-2 sm:pt-0">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-800">₹{formSubtotal.toFixed(2)}</span>
                  </div>
                  {formDiscountAmount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Discount:</span>
                      <span>- ₹{formDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {formTaxAmount > 0 && (
                    <div className="flex justify-between">
                      <span>GST ({taxRate}%):</span>
                      <span className="font-semibold text-slate-800">₹{formTaxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-slate-900 border-t pt-1.5 border-slate-200">
                    <span>Total Payable:</span>
                    <span>₹{formTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Immediate Counter Payment Checkbox */}
              <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-200 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={collectNow}
                    onChange={(e) => setCollectNow(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded border-teal-300 focus:ring-teal-500"
                  />
                  <span className="text-xs font-bold text-teal-900">
                    Record immediate payment received at front desk
                  </span>
                </label>

                {collectNow && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-teal-800 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={immediatePayment.paymentMethod}
                        onChange={(e) =>
                          setImmediatePayment({ ...immediatePayment, paymentMethod: e.target.value })
                        }
                        className="input py-1 px-2 text-xs rounded-lg bg-white border-teal-200 w-full"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI / QR</option>
                        <option value="card">Debit / Credit Card</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-teal-800 mb-1">
                        Amount Paid (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={formTotal}
                        value={immediatePayment.amount}
                        onChange={(e) =>
                          setImmediatePayment({ ...immediatePayment, amount: Number(e.target.value) })
                        }
                        className="input py-1 px-2 text-xs rounded-lg bg-white border-teal-200 w-full font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-teal-800 mb-1">
                        Reference / UPI ID (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. UTR-982341"
                        value={immediatePayment.referenceNumber}
                        onChange={(e) =>
                          setImmediatePayment({ ...immediatePayment, referenceNumber: e.target.value })
                        }
                        className="input py-1 px-2 text-xs rounded-lg bg-white border-teal-200 w-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Billing Remarks / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="e.g. Included 10% senior citizen concession."
                  className="input w-full rounded-xl bg-slate-50 border-slate-200 text-xs"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInvoice}
                  className="btn-primary py-2.5 px-6 font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {submittingInvoice ? "Issuing Invoice…" : "Issue & Save Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Collect Counter Payment ── */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>💵</span> Collect Payment
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Invoice <span className="font-mono font-bold text-slate-700">{selectedInvoice.invoiceNumber}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedInvoice(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <p className="text-slate-400 font-medium">Patient</p>
                  <p className="font-bold text-slate-800">{selectedInvoice.patientId?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 font-medium">Outstanding Balance</p>
                  <p className="text-base font-black text-rose-600">₹{selectedInvoice.balanceAmount?.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Method *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "cash", label: "Cash", icon: "💵" },
                    { id: "upi", label: "UPI / QR", icon: "📱" },
                    { id: "card", label: "Card", icon: "💳" },
                  ].map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        paymentMethod === m.id
                          ? "bg-teal-50 border-teal-500 font-bold text-teal-900 ring-2 ring-teal-500/20"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 text-xs"
                      }`}
                    >
                      <span className="block text-base">{m.icon}</span>
                      <span className="text-xs">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Amount Received (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedInvoice.balanceAmount}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="input py-2 text-sm font-bold w-full rounded-xl bg-slate-50 border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reference / Transaction ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref / Card Last 4 digits"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="input py-1.5 text-xs w-full rounded-xl bg-slate-50 border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Receipt Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid at reception counter"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="input py-1.5 text-xs w-full rounded-xl bg-slate-50 border-slate-200"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingPayment}
                  className="flex-1 btn-primary py-2.5 text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {processingPayment ? "Recording…" : "Confirm Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Process Refund (Admin Only) ── */}
      {showRefundModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>🔄</span> Process Payment Refund
            </h3>
            <p className="text-xs text-slate-500">
              Issue refund for Invoice <span className="font-mono font-bold">{selectedInvoice.invoiceNumber}</span>. Net paid: ₹{selectedInvoice.paidAmount}.
            </p>

            <form onSubmit={handleConfirmRefund} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Refund Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedInvoice.paidAmount}
                  step="0.01"
                  required
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="input mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Reason for Refund *</label>
                <textarea
                  rows={2}
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Appointment cancelled by doctor; Service not availed"
                  className="input mt-1 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="flex-1 btn-secondary text-xs py-2.5 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingRefund}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs py-2.5 font-bold rounded-xl"
                >
                  {processingRefund ? "Processing…" : "Confirm Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Void Invoice (Admin Only) ── */}
      {showVoidModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-rose-700 flex items-center gap-2">
              <span>⚠️</span> Void Invoice
            </h3>
            <p className="text-xs text-slate-500">
              Voiding cancels Invoice <span className="font-mono font-bold">{selectedInvoice.invoiceNumber}</span> permanently. This action is recorded in the immutable audit log.
            </p>

            <form onSubmit={handleConfirmVoid} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Reason for Voiding *</label>
                <textarea
                  rows={2}
                  required
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Issued in error; Duplicate invoice"
                  className="input mt-1 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowVoidModal(false)}
                  className="flex-1 btn-secondary text-xs py-2.5 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingVoid}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs py-2.5 font-bold rounded-xl"
                >
                  {processingVoid ? "Voiding…" : "Confirm Void"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Revenue & Financial Analytics ── */}
      {showRevenueModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span>📊</span> Financial & Revenue Intelligence
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Comprehensive audit of clinic cashflow and payment collections</p>
              </div>
              <button
                onClick={() => setShowRevenueModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            {loadingReport ? (
              <div className="p-8 text-center text-slate-400 text-xs font-semibold">Generating report…</div>
            ) : revenueReport ? (
              <div className="space-y-4">
                {/* Financial KPI Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Gross Invoiced</p>
                    <p className="text-lg font-black text-slate-900 mt-1">₹{revenueReport.totalInvoiced?.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Net Realized</p>
                    <p className="text-lg font-black text-emerald-800 mt-1">₹{revenueReport.totalCollected?.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200">
                    <p className="text-[10px] font-bold text-rose-600 uppercase">Receivables</p>
                    <p className="text-lg font-black text-rose-800 mt-1">₹{revenueReport.totalOutstanding?.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200">
                    <p className="text-[10px] font-bold text-amber-600 uppercase">Refunds Disbursed</p>
                    <p className="text-lg font-black text-amber-800 mt-1">₹{revenueReport.totalRefunded?.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="p-3.5 bg-indigo-50 rounded-2xl border border-indigo-200">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase">GST Collected</p>
                    <p className="text-lg font-black text-indigo-800 mt-1">₹{revenueReport.totalTaxCollected?.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200">
                    <p className="text-[10px] font-bold text-purple-600 uppercase">Discounts Conceded</p>
                    <p className="text-lg font-black text-purple-800 mt-1">₹{revenueReport.totalDiscountGiven?.toLocaleString("en-IN")}</p>
                  </div>
                </div>

                {/* Collections by Payment Method */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Collections Breakdown by Payment Channel
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { label: "Cash Desk", val: revenueReport.methodBreakdown?.cash || 0, icon: "💵" },
                      { label: "UPI / QR", val: revenueReport.methodBreakdown?.upi || 0, icon: "📱" },
                      { label: "Card POS", val: revenueReport.methodBreakdown?.card || 0, icon: "💳" },
                      { label: "Razorpay Online", val: revenueReport.methodBreakdown?.razorpay || 0, icon: "⚡" },
                    ].map((m) => (
                      <div key={m.label} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span>{m.icon}</span>
                          <span className="text-xs font-semibold text-slate-600">{m.label}</span>
                        </div>
                        <p className="text-sm font-black text-slate-800">₹{m.val.toLocaleString("en-IN")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowRevenueModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
