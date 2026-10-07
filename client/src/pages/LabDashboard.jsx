import { useState, useEffect, useCallback } from "react";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import { exportLabReportToPDF } from "../utils/export";
import toast from "react-hot-toast";

const COMMON_TEST_PRESETS = [
  {
    code: "CBC",
    name: "Complete Blood Count",
    category: "Hematology",
    defaultParameters: [
      { name: "Hemoglobin", unit: "g/dL", referenceRange: "13.5 - 17.5" },
      { name: "WBC Count", unit: "/mcL", referenceRange: "4,500 - 11,000" },
      { name: "Platelet Count", unit: "/mcL", referenceRange: "150,000 - 450,000" },
      { name: "RBC Count", unit: "million/mcL", referenceRange: "4.3 - 5.9" },
      { name: "Hematocrit", unit: "%", referenceRange: "41.0 - 50.0" },
    ],
  },
  {
    code: "LIPID",
    name: "Lipid Profile Panel",
    category: "Biochemistry",
    defaultParameters: [
      { name: "Total Cholesterol", unit: "mg/dL", referenceRange: "< 200" },
      { name: "HDL Cholesterol", unit: "mg/dL", referenceRange: "> 40" },
      { name: "LDL Cholesterol", unit: "mg/dL", referenceRange: "< 100" },
      { name: "Triglycerides", unit: "mg/dL", referenceRange: "< 150" },
      { name: "VLDL", unit: "mg/dL", referenceRange: "5 - 30" },
    ],
  },
  {
    code: "HBA1C",
    name: "Glycated Hemoglobin (HbA1c)",
    category: "Endocrinology",
    defaultParameters: [
      { name: "HbA1c", unit: "%", referenceRange: "< 5.7 (Normal), 5.7-6.4 (Prediabetic)" },
      { name: "Estimated Avg Glucose (eAG)", unit: "mg/dL", referenceRange: "< 117" },
    ],
  },
  {
    code: "LFT",
    name: "Liver Function Test (LFT)",
    category: "Biochemistry",
    defaultParameters: [
      { name: "Total Bilirubin", unit: "mg/dL", referenceRange: "0.2 - 1.2" },
      { name: "Direct Bilirubin", unit: "mg/dL", referenceRange: "0.0 - 0.3" },
      { name: "SGOT (AST)", unit: "U/L", referenceRange: "10 - 40" },
      { name: "SGPT (ALT)", unit: "U/L", referenceRange: "7 - 56" },
      { name: "Alkaline Phosphatase (ALP)", unit: "U/L", referenceRange: "44 - 147" },
      { name: "Total Protein", unit: "g/dL", referenceRange: "6.0 - 8.3" },
      { name: "Albumin", unit: "g/dL", referenceRange: "3.5 - 5.0" },
    ],
  },
  {
    code: "RFT",
    name: "Renal Function Test (KFT)",
    category: "Biochemistry",
    defaultParameters: [
      { name: "Blood Urea Nitrogen (BUN)", unit: "mg/dL", referenceRange: "7 - 20" },
      { name: "Serum Creatinine", unit: "mg/dL", referenceRange: "0.7 - 1.3" },
      { name: "Uric Acid", unit: "mg/dL", referenceRange: "3.5 - 7.2" },
      { name: "eGFR", unit: "mL/min/1.73m2", referenceRange: "> 90" },
    ],
  },
  {
    code: "TSH",
    name: "Thyroid Stimulating Hormone (TSH)",
    category: "Endocrinology",
    defaultParameters: [
      { name: "TSH", unit: "uIU/mL", referenceRange: "0.4 - 4.0" },
    ],
  },
  {
    code: "URINE",
    name: "Urinalysis Routine",
    category: "Clinical Pathology",
    defaultParameters: [
      { name: "Urine Color", unit: "-", referenceRange: "Pale yellow" },
      { name: "Urine pH", unit: "-", referenceRange: "4.6 - 8.0" },
      { name: "Specific Gravity", unit: "-", referenceRange: "1.005 - 1.030" },
      { name: "Protein", unit: "-", referenceRange: "Negative" },
      { name: "Glucose", unit: "-", referenceRange: "Negative" },
      { name: "Pus Cells (WBC)", unit: "/HPF", referenceRange: "0 - 5" },
    ],
  },
  {
    code: "VIT_D",
    name: "Vitamin D (25-Hydroxy)",
    category: "Biochemistry",
    defaultParameters: [
      { name: "25-OH Vitamin D", unit: "ng/mL", referenceRange: "30.0 - 100.0 (Sufficient)" },
    ],
  },
];

export default function LabDashboard() {
  const { user, isDoctor, isAdmin, isClinicAdmin, isLabTech } = useAuth();
  const canCreateOrder = isDoctor || isAdmin || isClinicAdmin;
  const canProcessLab = isLabTech || isAdmin || isClinicAdmin;

  // State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'ordered' | 'in_progress' | 'result_entered' | 'verified' | 'released'
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);

  // Create Order Form
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [orderPatientId, setOrderPatientId] = useState("");
  const [orderPriority, setOrderPriority] = useState("routine");
  const [orderNotes, setOrderNotes] = useState("");
  const [selectedTests, setSelectedTests] = useState([]);
  const [customTestName, setCustomTestName] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Result Entry Form
  const [resultParameters, setResultParameters] = useState([]);
  const [resultInterpretation, setResultInterpretation] = useState("");
  const [savingResults, setSavingResults] = useState(false);

  // Fetch Orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/lab/orders");
      setOrders(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load laboratory orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Load Patients list for Order Creation
  const loadPatients = async () => {
    if (patients.length > 0) return;
    setLoadingPatients(true);
    try {
      const res = await API.get("/emr/patients");
      setPatients(res.data?.data || []);
    } catch (err) {
      console.warn("Could not fetch patients for lab order:", err);
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleOpenCreateModal = () => {
    loadPatients();
    setSelectedTests([COMMON_TEST_PRESETS[0]]); // default to CBC
    setOrderPriority("routine");
    setOrderNotes("");
    setOrderPatientId("");
    setShowCreateModal(true);
  };

  // Test Selection Handlers
  const togglePresetTest = (preset) => {
    if (selectedTests.some((t) => t.code === preset.code)) {
      setSelectedTests(selectedTests.filter((t) => t.code !== preset.code));
    } else {
      setSelectedTests([...selectedTests, preset]);
    }
  };

  const addCustomTest = () => {
    if (!customTestName.trim()) return;
    const custom = {
      code: `CUST-${Date.now().toString().slice(-4)}`,
      name: customTestName.trim(),
      category: "Specialized Investigation",
      defaultParameters: [{ name: customTestName.trim(), unit: "", referenceRange: "" }],
    };
    setSelectedTests([...selectedTests, custom]);
    setCustomTestName("");
  };

  const removeSelectedTest = (code) => {
    setSelectedTests(selectedTests.filter((t) => t.code !== code));
  };

  // Submit New Order
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!orderPatientId) {
      toast.error("Please select a patient");
      return;
    }
    if (selectedTests.length === 0) {
      toast.error("Please select at least one laboratory test");
      return;
    }

    setSubmittingOrder(true);
    try {
      const payload = {
        patientId: orderPatientId,
        priority: orderPriority,
        clinicalNotes: orderNotes,
        tests: selectedTests.map((t) => ({
          name: t.name,
          code: t.code,
          category: t.category,
        })),
      };

      await API.post("/lab/orders", payload);
      toast.success("Laboratory requisition created successfully");
      setShowCreateModal(false);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create lab requisition");
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Lifecycle Action Handlers
  const handleCollectSample = async (orderId) => {
    try {
      await API.patch(`/lab/orders/${orderId}/collect-sample`);
      toast.success("Specimen marked as collected");
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to collect specimen");
    }
  };

  const handleStartProcessing = async (orderId) => {
    try {
      await API.patch(`/lab/orders/${orderId}/start-processing`);
      toast.success("Specimen is now under diagnostic analysis");
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start processing");
    }
  };

  // Open Results Entry Modal
  const handleOpenResultModal = (order) => {
    setActiveOrder(order);

    // Pre-populate parameters from existing result or from tests presets
    if (order.labResultId && order.labResultId.parameters?.length > 0) {
      setResultParameters(order.labResultId.parameters);
      setResultInterpretation(order.labResultId.interpretation || "");
    } else {
      // Aggregate default parameters from ordered tests
      const initialParams = [];
      order.tests?.forEach((test) => {
        const foundPreset = COMMON_TEST_PRESETS.find(
          (p) => p.code === test.code || p.name.toLowerCase() === test.name.toLowerCase()
        );
        if (foundPreset && foundPreset.defaultParameters) {
          foundPreset.defaultParameters.forEach((dp) => {
            initialParams.push({
              name: dp.name,
              value: "",
              unit: dp.unit,
              referenceRange: dp.referenceRange,
              flag: "normal",
            });
          });
        } else {
          initialParams.push({
            name: test.name,
            value: "",
            unit: "",
            referenceRange: "",
            flag: "normal",
          });
        }
      });
      setResultParameters(initialParams.length > 0 ? initialParams : [{ name: "", value: "", unit: "", referenceRange: "", flag: "normal" }]);
      setResultInterpretation("");
    }

    setShowResultModal(true);
  };

  const handleAddParameterRow = () => {
    setResultParameters([
      ...resultParameters,
      { name: "", value: "", unit: "", referenceRange: "", flag: "normal" },
    ]);
  };

  const handleRemoveParameterRow = (idx) => {
    setResultParameters(resultParameters.filter((_, i) => i !== idx));
  };

  const handleParameterChange = (index, field, value) => {
    const updated = [...resultParameters];
    updated[index][field] = value;
    setResultParameters(updated);
  };

  // Submit Results
  const handleSaveResults = async (e) => {
    e.preventDefault();
    if (!activeOrder) return;

    const validParams = resultParameters.filter((p) => p.name.trim() && p.value.trim());
    if (validParams.length === 0) {
      toast.error("Please enter at least one observed test parameter value");
      return;
    }

    setSavingResults(true);
    try {
      await API.post(`/lab/orders/${activeOrder._id}/results`, {
        parameters: validParams,
        interpretation: resultInterpretation,
      });
      toast.success("Laboratory findings recorded. Awaiting verification.");
      setShowResultModal(false);
      setActiveOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record lab results");
    } finally {
      setSavingResults(false);
    }
  };

  // Verify Results (Strict 2-person check)
  const handleVerifyResults = async (order) => {
    if (!window.confirm(`Verify and approve diagnostic findings for order ${order.orderNumber}?`)) {
      return;
    }

    try {
      await API.patch(`/lab/orders/${order._id}/verify`);
      toast.success("Results verified and approved!");
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Verification failed");
    }
  };

  // Release Results to Patient
  const handleReleaseResults = async (order) => {
    if (!window.confirm(`Release lab report ${order.orderNumber} to patient portal?`)) {
      return;
    }

    try {
      await API.patch(`/lab/orders/${order._id}/release`);
      toast.success("Lab report released. Patient can now view results.");
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to release results");
    }
  };

  // Cancel Order
  const handleCancelOrder = async (orderId) => {
    const reason = window.prompt("Reason for requisition cancellation:");
    if (!reason) return;

    try {
      await API.patch(`/lab/orders/${orderId}/cancel`, { reason });
      toast.success("Requisition cancelled");
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel order");
    }
  };

  // Filter Orders
  const filteredOrders = orders.filter((o) => {
    // Tab filter
    if (activeTab === "ordered" && o.status !== "ordered") return false;
    if (activeTab === "in_progress" && !["sample_collected", "processing"].includes(o.status)) return false;
    if (activeTab === "result_entered" && o.status !== "result_entered") return false;
    if (activeTab === "verified" && o.status !== "verified") return false;
    if (activeTab === "released" && o.status !== "released") return false;

    // Priority filter
    if (priorityFilter !== "all" && o.priority !== priorityFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const patientName = o.patientId?.name?.toLowerCase() || "";
      const mrn = o.patientId?.mrn?.toLowerCase() || "";
      const orderNum = o.orderNumber?.toLowerCase() || "";
      const testNames = o.tests?.map((t) => t.name.toLowerCase()).join(" ") || "";
      if (!patientName.includes(q) && !mrn.includes(q) && !orderNum.includes(q) && !testNames.includes(q)) {
        return false;
      }
    }

    return true;
  });

  // KPI Calculations
  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "ordered").length,
    processing: orders.filter((o) => ["sample_collected", "processing"].includes(o.status)).length,
    needsVerification: orders.filter((o) => o.status === "result_entered").length,
    released: orders.filter((o) => o.status === "released").length,
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "ordered":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">Requisitioned</span>;
      case "sample_collected":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">Sample In Lab</span>;
      case "processing":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse">Analyzing</span>;
      case "result_entered":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200">Needs Verification</span>;
      case "verified":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-50 text-teal-700 border border-teal-200">Verified • Ready</span>;
      case "released":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Released to Patient</span>;
      case "cancelled":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "stat":
        return <span className="px-2 py-0.5 text-[11px] font-black uppercase tracking-wider rounded-md bg-rose-100 text-rose-800 animate-pulse border border-rose-300">⚡ STAT (Immediate)</span>;
      case "urgent":
        return <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-md bg-amber-100 text-amber-800 border border-amber-300">Urgent</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-md">Routine</span>;
    }
  };

  return (
    <div className="section py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 rounded-3xl text-white shadow-xl shadow-slate-950/20">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔬</span>
            <span className="text-xs font-bold tracking-widest uppercase bg-indigo-500/30 text-indigo-200 px-2.5 py-1 rounded-full border border-indigo-400/30">
              Diagnostic Laboratory Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Clinical Pathology & Diagnostics</h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Complete specimen custody workflow: requisition, sample collection, test processing, double-verifier quality control, and electronic report dissemination.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrders}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition text-sm font-semibold flex items-center gap-2"
            title="Refresh Orders"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {canCreateOrder && (
            <button
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-sm shadow-lg shadow-teal-500/25 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Requisition</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => setActiveTab("all")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === "all"
              ? "bg-white border-primary-500 shadow-md ring-2 ring-primary-500/20"
              : "bg-white border-slate-200/80 hover:border-slate-300 shadow-sm"
          }`}
        >
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Requisitions</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{stats.total}</p>
        </div>

        <div
          onClick={() => setActiveTab("ordered")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === "ordered"
              ? "bg-amber-50/60 border-amber-500 shadow-md ring-2 ring-amber-500/20"
              : "bg-white border-slate-200/80 hover:border-amber-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pending Sample</p>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </div>
          <p className="text-2xl font-black text-amber-800 mt-1">{stats.pending}</p>
        </div>

        <div
          onClick={() => setActiveTab("in_progress")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === "in_progress"
              ? "bg-indigo-50/60 border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
              : "bg-white border-slate-200/80 hover:border-indigo-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">In Analysis</p>
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
          </div>
          <p className="text-2xl font-black text-indigo-800 mt-1">{stats.processing}</p>
        </div>

        <div
          onClick={() => setActiveTab("result_entered")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === "result_entered"
              ? "bg-purple-50/60 border-purple-500 shadow-md ring-2 ring-purple-500/20"
              : "bg-white border-slate-200/80 hover:border-purple-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Awaiting Verification</p>
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
          </div>
          <p className="text-2xl font-black text-purple-800 mt-1">{stats.needsVerification}</p>
        </div>

        <div
          onClick={() => setActiveTab("released")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === "released"
              ? "bg-emerald-50/60 border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
              : "bg-white border-slate-200/80 hover:border-emerald-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Released Reports</p>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-2xl font-black text-emerald-800 mt-1">{stats.released}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All Requisitions" },
            { id: "ordered", label: "Pending Collection" },
            { id: "in_progress", label: "Processing" },
            { id: "result_entered", label: "Needs Verification" },
            { id: "verified", label: "Verified" },
            { id: "released", label: "Released" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="input py-1.5 px-3 text-xs font-semibold rounded-xl bg-slate-50 border-slate-200"
          >
            <option value="all">All Priorities</option>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">⚡ STAT</option>
          </select>

          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Search MRN, patient, test..."
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
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200/80 text-center flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-semibold text-slate-500">Loading diagnostic worklist…</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200/80 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">
            🧪
          </div>
          <h3 className="text-base font-bold text-slate-800">No laboratory orders found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || priorityFilter !== "all" || activeTab !== "all"
              ? "Try adjusting your filters or search terms."
              : "No diagnostic tests have been requisitioned yet."}
          </p>
          {canCreateOrder && (
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition"
            >
              Create First Requisition
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map((order) => {
            const patient = order.patientId || {};
            const doctor = order.doctorId || {};
            const doctorName = doctor.userId?.name || doctor.name || "Physician";
            const isEntryUser = order.labResultId?.enteredBy && String(order.labResultId.enteredBy) === String(user?._id);

            return (
              <div
                key={order._id}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 p-5 shadow-sm transition hover:shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Left: Requisition Details */}
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">
                      {order.orderNumber}
                    </span>
                    {getPriorityBadge(order.priority)}
                    {getStatusBadge(order.status)}
                    <span className="text-[11px] text-slate-400">
                      Requisitioned: {new Date(order.orderedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>{patient.name || "Unknown Patient"}</span>
                      {patient.mrn && (
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {patient.mrn}
                        </span>
                      )}
                      {patient.gender && (
                        <span className="text-xs font-medium text-slate-400 capitalize">
                          ({patient.gender}{patient.dob ? `, ${new Date().getFullYear() - new Date(patient.dob).getFullYear()}y` : ""})
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ordering Physician: <span className="font-semibold text-slate-700">Dr. {doctorName}</span>
                    </p>
                  </div>

                  {/* Tests Ordered Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {order.tests?.map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs font-semibold"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        {t.name}
                      </span>
                    ))}
                  </div>

                  {order.clinicalNotes && (
                    <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                      Note: {order.clinicalNotes}
                    </p>
                  )}
                </div>

                {/* Right: Custody & Actions */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 border-t lg:border-t-0 pt-3 lg:pt-0">
                  {/* Custody Info */}
                  <div className="text-xs text-slate-400 space-y-0.5 text-left lg:text-right">
                    {order.sampleCollectedAt && (
                      <p>
                        Collected: <span className="font-medium text-slate-600">{new Date(order.sampleCollectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    )}
                    {order.verifiedAt && (
                      <p>
                        Verified: <span className="font-medium text-teal-600">✓ {order.verifiedBy?.name || "Dr. Staff"}</span>
                      </p>
                    )}
                  </div>

                  {/* Action Buttons based on status */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* View Details / Report button */}
                    {order.labResultId && (
                      <button
                        onClick={() => {
                          setActiveOrder(order);
                          setShowViewModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
                      >
                        View Results
                      </button>
                    )}

                    {/* Step 1: Collect Sample */}
                    {order.status === "ordered" && canProcessLab && (
                      <button
                        onClick={() => handleCollectSample(order._id)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                      >
                        <span>🧪</span> Collect Specimen
                      </button>
                    )}

                    {/* Step 2: Start Processing */}
                    {order.status === "sample_collected" && canProcessLab && (
                      <button
                        onClick={() => handleStartProcessing(order._id)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                      >
                        <span>⚙️</span> Start Analysis
                      </button>
                    )}

                    {/* Step 3: Enter Results */}
                    {["processing", "sample_collected"].includes(order.status) && canProcessLab && (
                      <button
                        onClick={() => handleOpenResultModal(order)}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                      >
                        <span>📝</span> Enter Findings
                      </button>
                    )}

                    {/* Step 4: Verify Results (Double check rule) */}
                    {order.status === "result_entered" && (isLabTech || isDoctor || isAdmin || isClinicAdmin) && (
                      <div className="flex items-center gap-1.5">
                        {isEntryUser && !isAdmin && !isClinicAdmin ? (
                          <span
                            title="Another technician or doctor must verify results for quality assurance"
                            className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-lg border border-amber-200 cursor-help"
                          >
                            Peer Verifier Needed
                          </span>
                        ) : (
                          <button
                            onClick={() => handleVerifyResults(order)}
                            className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                          >
                            <span>✓</span> Verify & Sign
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenResultModal(order)}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                    )}

                    {/* Step 5: Release to Patient */}
                    {order.status === "verified" && (isLabTech || isDoctor || isAdmin || isClinicAdmin) && (
                      <button
                        onClick={() => handleReleaseResults(order)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                      >
                        <span>🚀</span> Release to Patient
                      </button>
                    )}

                    {/* Step 6: Download Official PDF Report */}
                    {order.status === "released" && (
                      <button
                        onClick={() => exportLabReportToPDF(order)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>PDF Report</span>
                      </button>
                    )}

                    {/* Cancel Order Option */}
                    {!["released", "cancelled"].includes(order.status) && (isAdmin || isClinicAdmin || isDoctor) && (
                      <button
                        onClick={() => handleCancelOrder(order._id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition"
                        title="Cancel Requisition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: Create New Lab Requisition ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span>🔬</span> New Diagnostic Investigation Requisition
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Order laboratory panels for clinical evaluation</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-5">
              {/* Select Patient */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Patient *
                </label>
                {loadingPatients ? (
                  <p className="text-xs text-slate-400">Loading patients…</p>
                ) : (
                  <select
                    value={orderPatientId}
                    onChange={(e) => setOrderPatientId(e.target.value)}
                    required
                    className="input w-full rounded-xl bg-slate-50 border-slate-200 text-sm font-medium"
                  >
                    <option value="">-- Choose Patient (Name / MRN) --</option>
                    {patients.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} {p.mrn ? `(${p.mrn})` : ""} - {p.phone || p.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Priority Urgency
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: "routine", label: "Routine", desc: "Standard turnaround" },
                    { id: "urgent", label: "Urgent", desc: "Prioritize in queue" },
                    { id: "stat", label: "⚡ STAT", desc: "Immediate critical processing" },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setOrderPriority(p.id)}
                      className={`p-3 rounded-xl border text-left transition ${
                        orderPriority === p.id
                          ? p.id === "stat"
                            ? "bg-rose-50 border-rose-500 ring-2 ring-rose-500/20"
                            : "bg-primary-50 border-primary-500 ring-2 ring-primary-500/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <p className={`text-xs font-bold ${orderPriority === p.id ? "text-primary-800" : "text-slate-800"}`}>
                        {p.label}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Test Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Diagnostic Test Panels ({selectedTests.length} selected)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {COMMON_TEST_PRESETS.map((preset) => {
                    const isSelected = selectedTests.some((t) => t.code === preset.code);
                    return (
                      <button
                        type="button"
                        key={preset.code}
                        onClick={() => togglePresetTest(preset)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-500 text-indigo-950 font-bold shadow-xs"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
                        }`}
                      >
                        <p className="text-xs leading-snug">{preset.name}</p>
                        <span className="text-[9px] uppercase tracking-wider opacity-60">{preset.code}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Test Adder */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Or enter custom test name (e.g. Troponin-I, COVID-19 RT-PCR)"
                    value={customTestName}
                    onChange={(e) => setCustomTestName(e.target.value)}
                    className="input flex-1 py-1.5 text-xs rounded-xl bg-slate-50 border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={addCustomTest}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
                  >
                    + Add Test
                  </button>
                </div>

                {/* Selected Tests Chips */}
                {selectedTests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    {selectedTests.map((t) => (
                      <span
                        key={t.code}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 shadow-2xs"
                      >
                        {t.name}
                        <button
                          type="button"
                          onClick={() => removeSelectedTest(t.code)}
                          className="text-slate-400 hover:text-rose-600 transition"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Clinical Notes / Indication */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clinical Indication / Physician Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Routine diabetic workup; Rule out iron deficiency anemia"
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
                  disabled={submittingOrder}
                  className="btn-primary py-2.5 px-6 font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {submittingOrder ? "Requisitioning…" : "Create Lab Requisition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Enter Diagnostic Findings (Results) ── */}
      {showResultModal && activeOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span>📝</span> Record Laboratory Findings
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Order <span className="font-mono font-bold text-slate-700">{activeOrder.orderNumber}</span> • Patient:{" "}
                  <span className="font-semibold text-slate-800">{activeOrder.patientId?.name}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowResultModal(false);
                  setActiveOrder(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveResults} className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Observed Test Parameters ({resultParameters.length})
                </p>
                <button
                  type="button"
                  onClick={handleAddParameterRow}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                >
                  + Add Parameter Row
                </button>
              </div>

              {/* Dynamic Parameter Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Parameter Name *</th>
                      <th className="py-2.5 px-3">Observed Value *</th>
                      <th className="py-2.5 px-3">Units</th>
                      <th className="py-2.5 px-3">Reference Range</th>
                      <th className="py-2.5 px-3">Flag</th>
                      <th className="py-2.5 px-2 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resultParameters.map((row, idx) => (
                      <tr key={idx} className={row.flag !== "normal" ? "bg-amber-50/30" : ""}>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleParameterChange(idx, "name", e.target.value)}
                            placeholder="e.g. Hemoglobin"
                            required
                            className="input py-1 px-2 text-xs rounded-lg w-full bg-white border-slate-200"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.value}
                            onChange={(e) => handleParameterChange(idx, "value", e.target.value)}
                            placeholder="e.g. 14.2"
                            required
                            className="input py-1 px-2 text-xs rounded-lg w-full font-bold bg-white border-slate-200"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => handleParameterChange(idx, "unit", e.target.value)}
                            placeholder="g/dL"
                            className="input py-1 px-2 text-xs rounded-lg w-full bg-white border-slate-200"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.referenceRange}
                            onChange={(e) => handleParameterChange(idx, "referenceRange", e.target.value)}
                            placeholder="13.5 - 17.5"
                            className="input py-1 px-2 text-xs rounded-lg w-full bg-white border-slate-200"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={row.flag}
                            onChange={(e) => handleParameterChange(idx, "flag", e.target.value)}
                            className={`input py-1 px-2 text-xs font-bold rounded-lg w-full ${
                              row.flag === "critical"
                                ? "bg-rose-100 text-rose-800 border-rose-300"
                                : row.flag === "abnormal"
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-white text-slate-700 border-slate-200"
                            }`}
                          >
                            <option value="normal">Normal</option>
                            <option value="abnormal">Abnormal</option>
                            <option value="critical">Critical</option>
                          </select>
                        </td>
                        <td className="p-2 text-center">
                          {resultParameters.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveParameterRow(idx)}
                              className="text-slate-300 hover:text-rose-500 font-bold transition p-1"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Lab Remarks / Interpretation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pathologist / Technician Clinical Remarks & Interpretation
                </label>
                <textarea
                  rows={3}
                  value={resultInterpretation}
                  onChange={(e) => setResultInterpretation(e.target.value)}
                  placeholder="e.g. Mild microcytic hypochromic picture observed. Correlate clinically with serum ferritin levels."
                  className="input w-full rounded-xl bg-slate-50 border-slate-200 text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <p className="text-[11px] text-slate-400">
                  Saving transitions status to <span className="font-semibold text-purple-700">Needs Verification</span>.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResultModal(false);
                      setActiveOrder(null);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingResults}
                    className="btn-primary py-2.5 px-6 font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                  >
                    {savingResults ? "Saving Results…" : "Submit Diagnostic Findings"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: View Results & Interpretation ── */}
      {showViewModal && activeOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span>📋</span> Diagnostic Report Preview
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Order <span className="font-mono font-bold text-slate-700">{activeOrder.orderNumber}</span> • {activeOrder.patientId?.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setActiveOrder(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Results Table */}
            <div className="space-y-4">
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Test Parameter</th>
                      <th className="py-2.5 px-3">Observed Value</th>
                      <th className="py-2.5 px-3">Units</th>
                      <th className="py-2.5 px-3">Reference Range</th>
                      <th className="py-2.5 px-3">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeOrder.labResultId?.parameters?.map((p, idx) => (
                      <tr key={idx} className={p.flag !== "normal" ? "bg-amber-50/50" : ""}>
                        <td className="p-2.5 font-semibold text-slate-800">{p.name}</td>
                        <td className="p-2.5 font-bold text-slate-900">{p.value}</td>
                        <td className="p-2.5 text-slate-500">{p.unit || "-"}</td>
                        <td className="p-2.5 text-slate-500">{p.referenceRange || "-"}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              p.flag === "critical"
                                ? "bg-rose-100 text-rose-800"
                                : p.flag === "abnormal"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {p.flag}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {activeOrder.labResultId?.interpretation && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <p className="font-bold text-slate-800 mb-1">Pathologist Remarks / Interpretation:</p>
                  <p className="text-slate-600 leading-relaxed">{activeOrder.labResultId.interpretation}</p>
                </div>
              )}

              {/* Signatures & Chain of Custody */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-[11px] text-slate-500">
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Requisitioned</p>
                  <p className="font-semibold text-slate-700 mt-0.5">Dr. {activeOrder.doctorId?.userId?.name || "Doctor"}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Sample Custody</p>
                  <p className="font-semibold text-slate-700 mt-0.5">{activeOrder.sampleCollectedBy?.name || "Pending"}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Result Entered</p>
                  <p className="font-semibold text-slate-700 mt-0.5">{activeOrder.resultEnteredBy?.name || "Pending"}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Verified By</p>
                  <p className="font-semibold text-teal-700 mt-0.5">{activeOrder.verifiedBy?.name || "Pending"}</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowViewModal(false);
                  setActiveOrder(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition"
              >
                Close
              </button>

              <button
                onClick={() => exportLabReportToPDF(activeOrder)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-md flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Official PDF Report</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
