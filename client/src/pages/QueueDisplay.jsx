import { useState, useEffect, useCallback, useRef } from "react";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import toast from "react-hot-toast";

// Helper: Web Audio API gentle hospital chime
const playChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq, delay, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur);
    };

    // Ding-dong two-tone chime (587.33 Hz D5 -> 880 Hz A5)
    playTone(587.33, 0.0, 0.6);
    playTone(880.00, 0.3, 0.8);
  } catch (err) {
    console.warn("Audio chime failed:", err);
  }
};

export default function QueueDisplay() {
  const { user, isDoctor, isReceptionist, isAdmin } = useAuth();
  const socketContext = useSocket();
  const socket = socketContext?.socket || socketContext;

  const [queue, setQueue] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    waitingCount: 0,
    calledCount: 0,
    inConsultationCount: 0,
    completedCount: 0,
    nowServing: null,
  });
  const [loading, setLoading] = useState(true);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [isTvMode, setIsTvMode] = useState(false);

  // New Token Modal
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [tokenDoctorId, setTokenDoctorId] = useState("");
  const [tokenAmount, setTokenAmount] = useState(500);
  const [tokenNotes, setTokenNotes] = useState("");
  const [generatingToken, setGeneratingToken] = useState(false);

  // Newly generated token badge display
  const [justGeneratedToken, setJustGeneratedToken] = useState(null);

  // Fetch doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await API.get("/doctors");
        const list = res.data?.data || res.data || [];
        setDoctors(list);

        if (isDoctor && user?._id) {
          const myDoc = list.find((d) => String(d.userId?._id || d.userId) === String(user._id));
          if (myDoc) {
            setSelectedDoctorId(myDoc._id);
            setTokenDoctorId(myDoc._id);
          }
        } else if (list.length > 0) {
          setTokenDoctorId(list[0]._id);
        }
      } catch (err) {
        console.error("Doctors load failed:", err);
      }
    };
    fetchDoctors();
  }, [isDoctor, user?._id]);

  // Fetch Queue
  const fetchQueue = useCallback(async () => {
    try {
      let params = {};
      if (selectedDoctorId) params.doctorId = selectedDoctorId;
      const res = await API.get("/queue", { params });
      setQueue(res.data?.data?.queue || []);
      setSummary(res.data?.data?.summary || {});
    } catch (err) {
      console.error("Queue fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId]);

  useEffect(() => {
    fetchQueue();
    // Fallback polling every 20s if socket drops
    const interval = setInterval(fetchQueue, 20000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Real-time socket listener
  useEffect(() => {
    if (!socket) return;
    const onQueueUpdate = (data) => {
      fetchQueue();
      if (data.type === "TOKEN_CALLED") {
        playChime();
        toast.success(`🔊 Token #${data.tokenNumber} Called for Dr. ${data.doctorName || "Doctor"}`);
      }
    };

    socket.on("queue-updated", onQueueUpdate);
    return () => {
      socket.off("queue-updated", onQueueUpdate);
    };
  }, [socket, fetchQueue]);

  // Search patients for walk-in token issuance
  const searchPatients = async (query) => {
    setPatientSearch(query);
    if (!query || query.length < 2) return;
    try {
      const res = await API.get(`/patients?search=${encodeURIComponent(query)}&limit=10`);
      setPatients(res.data?.data?.patients || []);
    } catch (err) {
      console.warn("Patient search failed:", err);
    }
  };

  // Generate Token
  const handleGenerateToken = async (e) => {
    e.preventDefault();
    if (!selectedPatientId || !tokenDoctorId) {
      toast.error("Please pick a patient and doctor");
      return;
    }
    setGeneratingToken(true);
    try {
      const res = await API.post("/queue/token", {
        patientId: selectedPatientId,
        doctorId: tokenDoctorId,
        amount: tokenAmount,
        notes: tokenNotes,
      });
      const created = res.data?.data;
      setJustGeneratedToken(created);
      toast.success(`Token #${created.tokenNumber} generated!`);
      setSelectedPatientId("");
      setPatientSearch("");
      setTokenNotes("");
      fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate token");
    } finally {
      setGeneratingToken(false);
    }
  };

  // Status Actions
  const handleCallToken = async (id) => {
    try {
      await API.patch(`/queue/${id}/call`);
      fetchQueue();
    } catch (err) {
      toast.error("Failed to call token");
    }
  };

  const handleStartConsultation = async (id) => {
    try {
      await API.patch(`/queue/${id}/start`);
      fetchQueue();
    } catch (err) {
      toast.error("Failed to start consultation");
    }
  };

  const handleCompleteConsultation = async (id) => {
    try {
      await API.patch(`/queue/${id}/complete`);
      toast.success("Consultation completed!");
      fetchQueue();
    } catch (err) {
      toast.error("Failed to complete");
    }
  };

  const handleSkipToken = async (id) => {
    if (!window.confirm("Skip this token and mark as No-Show?")) return;
    try {
      await API.patch(`/queue/${id}/skip`);
      toast.success("Token skipped");
      fetchQueue();
    } catch (err) {
      toast.error("Failed to skip");
    }
  };

  return (
    <div className={`min-h-screen transition-colors ${isTvMode ? "bg-slate-950 text-white p-6" : "bg-slate-50/70 py-8 px-4"}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border ${
          isTvMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/80 shadow-sm"
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <h1 className="text-2xl font-black">Live Walk-In Queue</h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Sync
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isTvMode ? "text-slate-400" : "text-slate-500"}`}>
              Real-time patient tokens, calling board, and status progression
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Doctor Filter */}
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className={`input py-2 text-xs font-semibold max-w-[200px] ${isTvMode ? "bg-slate-800 text-white border-slate-700" : ""}`}
            >
              <option value="">All Doctors / Clinic</option>
              {doctors.map((d) => (
                <option key={d._id} value={d._id}>
                  Dr. {d.userId?.name}
                </option>
              ))}
            </select>

            {/* TV Mode Toggle */}
            <button
              onClick={() => setIsTvMode(!isTvMode)}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                isTvMode
                  ? "bg-slate-800 text-white border-slate-700 hover:bg-slate-700"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>📺</span>
              <span>{isTvMode ? "Staff Mode" : "TV Lobby Mode"}</span>
            </button>

            {/* Issue Token Button (Staff only) */}
            {(isReceptionist || isAdmin || isDoctor) && !isTvMode && (
              <button
                onClick={() => {
                  setJustGeneratedToken(null);
                  setShowTokenModal(true);
                }}
                className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <span>➕</span>
                <span>Issue Token</span>
              </button>
            )}
          </div>
        </div>

        {/* ── NOW SERVING PROMINENT HERO DISPLAY ── */}
        <div className={`rounded-3xl p-6 border shadow-lg relative overflow-hidden ${
          isTvMode
            ? "bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border-indigo-900/50"
            : "bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white border-primary-800 shadow-primary-500/10"
        }`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-primary-200/90 bg-white/10 px-3 py-1 rounded-full">
                Now Serving
              </span>
              <div className="mt-3 flex items-baseline gap-4">
                <span className="text-6xl sm:text-7xl font-black tracking-tight text-white">
                  {summary.nowServing?.tokenNumber ? `#${summary.nowServing.tokenNumber}` : "None"}
                </span>
                {summary.nowServing && (
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {summary.nowServing.patientId?.name || "Patient"}
                    </h2>
                    <p className="text-xs text-primary-200">
                      Dr. {summary.nowServing.doctorId?.userId?.name || "Doctor"} • Room 102
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Stat Pills */}
            <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
              <div className="bg-black/20 backdrop-blur-xs p-3.5 rounded-2xl text-center border border-white/10">
                <span className="text-[10px] uppercase font-bold text-white/70">Waiting</span>
                <p className="text-2xl font-black text-amber-300 mt-0.5">{summary.waitingCount || 0}</p>
              </div>
              <div className="bg-black/20 backdrop-blur-xs p-3.5 rounded-2xl text-center border border-white/10">
                <span className="text-[10px] uppercase font-bold text-white/70">In Consult</span>
                <p className="text-2xl font-black text-emerald-300 mt-0.5">{summary.inConsultationCount || 0}</p>
              </div>
              <div className="bg-black/20 backdrop-blur-xs p-3.5 rounded-2xl text-center border border-white/10">
                <span className="text-[10px] uppercase font-bold text-white/70">Completed</span>
                <p className="text-2xl font-black text-sky-200 mt-0.5">{summary.completedCount || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── QUEUE LIST ── */}
        <div className={`rounded-2xl border p-5 ${
          isTvMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/80 shadow-sm"
        }`}>
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 mb-4">
            <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
              <span>📋</span> Today's Queue List ({queue.length})
            </h2>
          </div>

          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : queue.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <span className="text-4xl block mb-2">🎉</span>
              <p className="font-semibold text-sm">No patients in today's queue.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {queue.map((item) => {
                const isNowServing = summary.nowServing?._id === item._id;
                return (
                  <div
                    key={item._id}
                    className={`py-3.5 px-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      isNowServing
                        ? isTvMode ? "bg-indigo-950/60 border border-indigo-800" : "bg-primary-50/50 border border-primary-200"
                        : "hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black ${
                        isNowServing
                          ? "bg-primary-600 text-white shadow-md shadow-primary-500/20"
                          : "bg-slate-100 text-slate-800"
                      }`}>
                        #{item.tokenNumber || "—"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm">{item.patientId?.name || "Patient"}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            item.queueStatus === "in_consultation"
                              ? "bg-purple-100 text-purple-700"
                              : item.queueStatus === "called"
                              ? "bg-blue-100 text-blue-700 animate-pulse"
                              : item.queueStatus === "completed"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {item.queueStatus?.replace("_", " ")}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${isTvMode ? "text-slate-400" : "text-slate-500"}`}>
                          MRN: {item.patientId?.mrn || "N/A"} • Dr. {item.doctorId?.userId?.name || "Doctor"} • Arrival: {item.appointmentTime}
                        </p>
                      </div>
                    </div>

                    {/* Staff Control Buttons */}
                    {!isTvMode && (isReceptionist || isDoctor || isAdmin) && (
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        {item.queueStatus === "waiting" && (
                          <button
                            onClick={() => handleCallToken(item._id)}
                            className="py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition flex items-center gap-1 shadow-xs"
                          >
                            <span>📢</span> Call
                          </button>
                        )}

                        {item.queueStatus === "called" && (
                          <button
                            onClick={() => handleStartConsultation(item._id)}
                            className="py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition flex items-center gap-1 shadow-xs"
                          >
                            <span>🩺</span> Start
                          </button>
                        )}

                        {item.queueStatus === "in_consultation" && (
                          <button
                            onClick={() => handleCompleteConsultation(item._id)}
                            className="py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center gap-1 shadow-xs"
                          >
                            <span>✓</span> Finish
                          </button>
                        )}

                        {item.queueStatus !== "completed" && item.queueStatus !== "skipped" && (
                          <button
                            onClick={() => handleSkipToken(item._id)}
                            className="py-1.5 px-2.5 rounded-lg text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition border border-transparent hover:border-rose-200"
                            title="Skip / No-Show"
                          >
                            Skip
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── ISSUE WALK-IN TOKEN MODAL ── */}
        {showTokenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fade-in border border-slate-100 text-slate-900">
              
              {justGeneratedToken ? (
                /* Instant Token Print Card */
                <div className="text-center py-4 space-y-4">
                  <span className="text-4xl block">🎫</span>
                  <h3 className="text-xl font-black text-slate-900">Walk-In Token Issued!</h3>
                  <div className="p-6 bg-primary-50 rounded-2xl border border-primary-200 inline-block max-w-xs w-full">
                    <p className="text-xs uppercase font-bold text-primary-600">Token Number</p>
                    <p className="text-5xl font-black text-primary-700 mt-1">
                      #{justGeneratedToken.tokenNumber}
                    </p>
                    <p className="text-xs text-slate-600 font-semibold mt-2">
                      {justGeneratedToken.patientId?.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      MRN: {justGeneratedToken.patientId?.mrn}
                    </p>
                    <div className="border-t border-primary-200/80 mt-3 pt-2 text-[11px] text-primary-700 font-bold">
                      Dr. {justGeneratedToken.doctorId?.userId?.name || "Doctor"}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setJustGeneratedToken(null)}
                      className="flex-1 btn-secondary text-xs py-2.5 font-bold"
                    >
                      Issue Another
                    </button>
                    <button
                      onClick={() => {
                        setShowTokenModal(false);
                        setJustGeneratedToken(null);
                      }}
                      className="flex-1 btn-primary text-xs py-2.5 font-bold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* Intake Form */
                <>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="font-black text-base flex items-center gap-2">
                      <span>🎫</span> Issue Walk-In Token
                    </h3>
                    <button
                      onClick={() => setShowTokenModal(false)}
                      className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleGenerateToken} className="space-y-3.5">
                    {/* Patient Search */}
                    <div>
                      <label className="text-xs font-bold text-slate-700">Find Patient by Name / MRN</label>
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => searchPatients(e.target.value)}
                        placeholder="Type patient name, phone, or MRN..."
                        className="input mt-1 text-xs"
                      />
                      {patients.length > 0 && !selectedPatientId && (
                        <div className="border border-slate-200 rounded-xl mt-1.5 max-h-36 overflow-y-auto divide-y divide-slate-100 bg-white shadow-lg">
                          {patients.map((p) => (
                            <div
                              key={p._id}
                              onClick={() => {
                                setSelectedPatientId(p._id);
                                setPatientSearch(`${p.name} (${p.mrn || "No MRN"})`);
                                setPatients([]);
                              }}
                              className="p-2 text-xs hover:bg-primary-50 cursor-pointer flex justify-between items-center"
                            >
                              <span className="font-bold">{p.name}</span>
                              <span className="text-slate-400 text-[11px]">{p.mrn} • {p.phone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Doctor Selector */}
                    <div>
                      <label className="text-xs font-bold text-slate-700">Assign Doctor</label>
                      <select
                        required
                        value={tokenDoctorId}
                        onChange={(e) => setTokenDoctorId(e.target.value)}
                        className="input mt-1 text-xs font-semibold"
                      >
                        {doctors.map((d) => (
                          <option key={d._id} value={d._id}>
                            Dr. {d.userId?.name} ({d.specialization}) - ₹{d.consultationFee}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Consultation Fee */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700">Fee (₹)</label>
                        <input
                          type="number"
                          value={tokenAmount}
                          onChange={(e) => setTokenAmount(Number(e.target.value))}
                          className="input mt-1 text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">Notes / Complaint</label>
                        <input
                          type="text"
                          value={tokenNotes}
                          onChange={(e) => setTokenNotes(e.target.value)}
                          placeholder="e.g. Acute headache"
                          className="input mt-1 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowTokenModal(false)}
                        className="flex-1 btn-secondary text-xs py-2.5 font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={generatingToken || !selectedPatientId}
                        className="flex-1 btn-primary text-xs py-2.5 font-bold"
                      >
                        {generatingToken ? "Generating..." : "Generate Token"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
