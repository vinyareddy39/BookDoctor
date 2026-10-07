import { useState, useEffect, useCallback } from "react";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const STATUS_COLORS = {
  confirmed:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending:         "bg-amber-50 text-amber-700 border-amber-200",
  waiting:         "bg-sky-50 text-sky-700 border-sky-200",
  called:          "bg-blue-50 text-blue-700 border-blue-200",
  in_consultation: "bg-purple-50 text-purple-700 border-purple-200",
  completed:       "bg-slate-100 text-slate-700 border-slate-200",
  cancelled:       "bg-rose-50 text-rose-700 border-rose-200",
  no_show:         "bg-orange-50 text-orange-700 border-orange-200",
};

export default function AppointmentCalendar() {
  const { user, isDoctor, isAdmin, isReceptionist } = useAuth();

  const [viewMode, setViewMode] = useState("day"); // 'day' | 'week'
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected appointment for detail drawer / modal
  const [activeAppt, setActiveAppt] = useState(null);

  // Reschedule Modal State
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  // Cancel Modal State
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Doctor Leave Modal State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveType, setLeaveType] = useState("leave");
  const [doctorLeaves, setDoctorLeaves] = useState([]);

  // Fetch doctors list for staff filter
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await API.get("/doctors");
        const list = res.data?.data || res.data || [];
        setDoctors(list);

        // If user is doctor, auto-lock to their doctor record
        if (isDoctor && user?._id) {
          const myDoc = list.find((d) => String(d.userId?._id || d.userId) === String(user._id));
          if (myDoc) setSelectedDoctorId(myDoc._id);
        } else if (list.length > 0) {
          setSelectedDoctorId(list[0]._id);
        }
      } catch (err) {
        console.error("Failed to fetch doctors:", err);
      }
    };
    fetchDoctors();
  }, [isDoctor, user?._id]);

  // Fetch appointments for current view
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      let params = {};
      if (selectedDoctorId) params.doctorId = selectedDoctorId;

      if (viewMode === "day") {
        params.date = currentDate;
      } else {
        // Week range: start from Sunday or Monday
        const curr = new Date(currentDate);
        const firstDay = new Date(curr.setDate(curr.getDate() - curr.getDay()));
        const lastDay = new Date(curr.setDate(curr.getDate() - curr.getDay() + 6));
        params.startDate = firstDay.toISOString().split("T")[0];
        params.endDate = lastDay.toISOString().split("T")[0];
      }

      const res = await API.get("/appointments", { params });
      setAppointments(res.data?.data || res.data || []);
    } catch (err) {
      console.error("Error loading appointments:", err);
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId, currentDate, viewMode]);

  // Fetch doctor leaves
  const fetchLeaves = useCallback(async () => {
    if (!selectedDoctorId) return;
    try {
      const res = await API.get(`/schedule/leaves?doctorId=${selectedDoctorId}&upcomingOnly=true`);
      setDoctorLeaves(res.data?.data || []);
    } catch (err) {
      console.warn("Could not fetch leaves:", err);
    }
  }, [selectedDoctorId]);

  useEffect(() => {
    if (selectedDoctorId) {
      fetchAppointments();
      fetchLeaves();
    }
  }, [fetchAppointments, fetchLeaves, selectedDoctorId]);

  // Navigate Date
  const handlePrev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - (viewMode === "day" ? 1 : 7));
    setCurrentDate(d.toISOString().split("T")[0]);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (viewMode === "day" ? 1 : 7));
    setCurrentDate(d.toISOString().split("T")[0]);
  };

  const handleToday = () => {
    setCurrentDate(new Date().toISOString().split("T")[0]);
  };

  // Fetch available slots when selecting new reschedule date
  const handleDateChangeForReschedule = async (dateVal) => {
    setNewDate(dateVal);
    setNewTime("");
    if (!dateVal || !activeAppt) return;
    setLoadingSlots(true);
    try {
      const docId = activeAppt.doctorId?._id || activeAppt.doctorId;
      const res = await API.get(`/schedule/slots?doctorId=${docId}&date=${dateVal}`);
      if (res.data?.data?.onLeave) {
        toast.error(`Doctor is on leave: ${res.data.data.leaveReason}`);
        setRescheduleSlots([]);
      } else {
        setRescheduleSlots(res.data?.data?.slots || []);
      }
    } catch (err) {
      toast.error("Could not fetch slots");
    } finally {
      setLoadingSlots(false);
    }
  };

  // Submit Reschedule
  const handleRescheduleSubmit = async () => {
    if (!newDate || !newTime) {
      toast.error("Please select a date and time");
      return;
    }
    setRescheduleSubmitting(true);
    try {
      await API.patch(`/appointments/${activeAppt._id}/reschedule`, {
        appointmentDate: newDate,
        appointmentTime: newTime,
      });
      toast.success("Appointment rescheduled successfully!");
      setShowReschedule(false);
      setActiveAppt(null);
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reschedule");
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  // Submit Cancel
  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }
    setCancelSubmitting(true);
    try {
      await API.patch(`/appointments/${activeAppt._id}/cancel`, {
        cancellationReason: cancelReason,
      });
      toast.success("Appointment cancelled");
      setShowCancel(false);
      setActiveAppt(null);
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel");
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Mark No-Show
  const handleMarkNoShow = async (apptId) => {
    if (!window.confirm("Mark this patient as No-Show?")) return;
    try {
      await API.patch(`/appointments/${apptId}/no-show`);
      toast.success("Marked as No-Show");
      setActiveAppt(null);
      fetchAppointments();
    } catch (err) {
      toast.error("Failed to mark No-Show");
    }
  };

  // Submit Doctor Leave
  const handleAddLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!leaveStartDate || !leaveEndDate || !leaveReason) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      await API.post("/schedule/leaves", {
        doctorId: selectedDoctorId,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason,
        type: leaveType,
      });
      toast.success("Doctor leave recorded!");
      setShowLeaveModal(false);
      setLeaveReason("");
      fetchLeaves();
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add leave");
    }
  };

  // Calculate Week Days
  const getWeekDays = () => {
    const curr = new Date(currentDate);
    const first = curr.getDate() - curr.getDay();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const next = new Date(curr.getTime());
      next.setDate(first + i);
      days.push(next.toISOString().split("T")[0]);
    }
    return days;
  };

  const selectedDoctorObj = doctors.find((d) => d._id === selectedDoctorId);

  return (
    <div className="min-h-screen bg-slate-50/60 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <span>📅</span> Clinic Appointment Calendar
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Day & week view with live status tracking and conflict prevention
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Doctor Picker (if staff/admin) */}
            {(!isDoctor || isAdmin || isReceptionist) && (
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="input py-2 text-xs font-semibold max-w-[220px]"
              >
                {doctors.map((d) => (
                  <option key={d._id} value={d._id}>
                    Dr. {d.userId?.name} ({d.specialization})
                  </option>
                ))}
              </select>
            )}

            {/* Leave / Absence button for staff */}
            {(isDoctor || isReceptionist || isAdmin) && (
              <button
                onClick={() => setShowLeaveModal(true)}
                className="btn-secondary py-2 px-3 text-xs font-bold flex items-center gap-1.5"
              >
                <span>🏖️</span>
                <span>Block Leave / Out</span>
              </button>
            )}

            {/* View Switcher */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                onClick={() => setViewMode("day")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === "day" ? "bg-white text-primary-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === "week" ? "bg-white text-primary-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Week
              </button>
            </div>
          </div>
        </div>

        {/* Date Navigator Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold transition"
              title="Previous"
            >
              ◀
            </button>
            <button
              onClick={handleToday}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold transition"
              title="Next"
            >
              ▶
            </button>
            <span className="ml-2 font-black text-slate-800 text-sm sm:text-base">
              {new Date(currentDate).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="input py-1.5 text-xs font-semibold w-auto"
            />
          </div>
        </div>

        {/* Doctor Leave Alerts Banner */}
        {doctorLeaves.length > 0 && (
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="text-xs">
              <span className="font-bold text-amber-900">Scheduled Doctor Absences:</span>
              <ul className="list-disc list-inside mt-0.5 text-amber-800">
                {doctorLeaves.map((l) => (
                  <li key={l._id}>
                    {new Date(l.startDate).toLocaleDateString()} to {new Date(l.endDate).toLocaleDateString()} — {l.type.toUpperCase()}: {l.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Calendar Body */}
        {loading ? (
          <div className="h-72 flex items-center justify-center bg-white rounded-2xl border border-slate-200">
            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viewMode === "day" ? (
          /* DAY VIEW */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">
                Schedule for Dr. {selectedDoctorObj?.userId?.name || "Doctor"} ({appointments.length} appointments)
              </h3>
            </div>

            {appointments.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <span className="text-4xl block mb-2">🗓️</span>
                <p className="font-semibold text-sm">No appointments scheduled for this date.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {appointments.map((appt) => (
                  <div
                    key={appt._id}
                    onClick={() => setActiveAppt(appt)}
                    className="p-4 rounded-xl border border-slate-200/80 hover:border-primary-400 hover:shadow-md transition cursor-pointer bg-white relative group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-black text-primary-700 bg-primary-50 px-2.5 py-1 rounded-lg">
                        ⏰ {appt.appointmentTime}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[appt.status] || "bg-slate-100 text-slate-600"}`}>
                        {appt.status?.toUpperCase().replace("_", " ")}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {appt.patientId?.name || "Unknown Patient"}
                    </h4>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                      <span>MRN: {appt.patientId?.mrn || "N/A"}</span>
                      {appt.type === "walk_in" && (
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                          Token #{appt.tokenNumber}
                        </span>
                      )}
                    </div>

                    {appt.cancellationReason && (
                      <p className="text-[11px] text-rose-600 mt-2 italic bg-rose-50/60 p-1.5 rounded">
                        Cancelled: {appt.cancellationReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* WEEK VIEW */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 overflow-x-auto">
            <div className="grid grid-cols-7 gap-2 min-w-[800px]">
              {getWeekDays().map((dayStr) => {
                const dayDate = new Date(dayStr);
                const dayAppts = appointments.filter((a) => {
                  const aDate = new Date(a.appointmentDate).toISOString().split("T")[0];
                  return aDate === dayStr;
                });
                const isToday = dayStr === new Date().toISOString().split("T")[0];

                return (
                  <div
                    key={dayStr}
                    className={`rounded-xl border p-2.5 flex flex-col min-h-[300px] ${
                      isToday ? "border-primary-400 bg-primary-50/20" : "border-slate-100 bg-slate-50/50"
                    }`}
                  >
                    <div className="text-center pb-2 border-b border-slate-200/60 mb-2">
                      <p className="text-[11px] font-bold text-slate-400 uppercase">
                        {dayDate.toLocaleDateString("en-IN", { weekday: "short" })}
                      </p>
                      <p className={`text-base font-black ${isToday ? "text-primary-600" : "text-slate-800"}`}>
                        {dayDate.getDate()}
                      </p>
                    </div>

                    <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[360px]">
                      {dayAppts.length === 0 ? (
                        <p className="text-[11px] text-slate-300 text-center pt-8">No appts</p>
                      ) : (
                        dayAppts.map((appt) => (
                          <div
                            key={appt._id}
                            onClick={() => setActiveAppt(appt)}
                            className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-primary-400 cursor-pointer text-xs"
                          >
                            <p className="font-black text-slate-800 text-[11px]">{appt.appointmentTime}</p>
                            <p className="font-semibold text-slate-700 text-[11px] truncate">
                              {appt.patientId?.name || "Patient"}
                            </p>
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-1 ${STATUS_COLORS[appt.status] || "bg-slate-100"}`}>
                              {appt.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── APPOINTMENT ACTION MODAL / DRAWER ── */}
        {activeAppt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-fade-in border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">📋</span>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Appointment Details</h3>
                    <p className="text-xs text-slate-400">ID: {activeAppt._id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveAppt(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              {/* Patient and Slot Details */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Patient</span>
                  <p className="font-black text-slate-900 mt-0.5">{activeAppt.patientId?.name || "N/A"}</p>
                  <p className="text-slate-500">MRN: {activeAppt.patientId?.mrn || "N/A"}</p>
                  <p className="text-slate-500">Phone: {activeAppt.patientId?.phone || "N/A"}</p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Date & Slot</span>
                  <p className="font-black text-slate-900 mt-0.5">
                    {new Date(activeAppt.appointmentDate).toLocaleDateString()}
                  </p>
                  <p className="text-primary-600 font-bold">{activeAppt.appointmentTime}</p>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${STATUS_COLORS[activeAppt.status] || "bg-slate-100"}`}>
                    {activeAppt.status?.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                {["pending", "confirmed", "waiting"].includes(activeAppt.status) && (
                  <>
                    <button
                      onClick={() => {
                        setShowReschedule(true);
                        handleDateChangeForReschedule(currentDate);
                      }}
                      className="flex-1 btn-secondary text-xs font-bold py-2.5 flex items-center justify-center gap-1.5"
                    >
                      <span>🔄</span> Reschedule
                    </button>
                    <button
                      onClick={() => handleMarkNoShow(activeAppt._id)}
                      className="flex-1 btn-secondary text-xs font-bold py-2.5 text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100 flex items-center justify-center gap-1.5"
                    >
                      <span>🚫</span> No-Show
                    </button>
                    <button
                      onClick={() => setShowCancel(true)}
                      className="flex-1 btn-secondary text-xs font-bold py-2.5 text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 flex items-center justify-center gap-1.5"
                    >
                      <span>✕</span> Cancel
                    </button>
                  </>
                )}
                <button
                  onClick={() => setActiveAppt(null)}
                  className="w-full btn-primary text-xs font-bold py-2.5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── RESCHEDULE MODAL ── */}
        {showReschedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in border border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <span>🔄</span> Reschedule Appointment
              </h3>
              <div>
                <label className="text-xs font-bold text-slate-700">Select New Date</label>
                <input
                  type="date"
                  value={newDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => handleDateChangeForReschedule(e.target.value)}
                  className="input mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Available Slots</label>
                {loadingSlots ? (
                  <p className="text-xs text-slate-400 py-3">Checking availability & conflicts...</p>
                ) : rescheduleSlots.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">No available slots for this date.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 mt-1.5 max-h-44 overflow-y-auto p-1">
                    {rescheduleSlots.map((slot) => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => setNewTime(slot.time)}
                        className={`p-2 rounded-lg text-xs font-bold transition border ${
                          !slot.available
                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                            : newTime === slot.time
                            ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:border-primary-400"
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowReschedule(false)}
                  className="flex-1 btn-secondary text-xs py-2.5 font-bold"
                >
                  Cancel
                </button>
                <button
                  disabled={!newDate || !newTime || rescheduleSubmitting}
                  onClick={handleRescheduleSubmit}
                  className="flex-1 btn-primary text-xs py-2.5 font-bold"
                >
                  {rescheduleSubmitting ? "Rescheduling..." : "Confirm Slot"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CANCEL REASON MODAL ── */}
        {showCancel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in border border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <span>⚠️</span> Cancel Appointment
              </h3>
              <p className="text-xs text-slate-500">
                Please provide a clear reason for the audit trail. If payment was collected, refund will be initiated.
              </p>
              <div>
                <label className="text-xs font-bold text-slate-700">Cancellation Reason</label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Patient requested cancellation, doctor emergency..."
                  className="input mt-1 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCancel(false)}
                  className="flex-1 btn-secondary text-xs py-2.5 font-bold"
                >
                  Back
                </button>
                <button
                  disabled={!cancelReason.trim() || cancelSubmitting}
                  onClick={handleCancelSubmit}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 transition"
                >
                  {cancelSubmitting ? "Cancelling..." : "Confirm Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── DOCTOR LEAVE MODAL ── */}
        {showLeaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in border border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <span>🏖️</span> Schedule Doctor Absence / Leave
              </h3>
              <p className="text-xs text-slate-500">
                Patients will be blocked from booking slots for Dr. {selectedDoctorObj?.userId?.name} during this period.
              </p>
              <form onSubmit={handleAddLeaveSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Start Date</label>
                    <input
                      type="date"
                      required
                      value={leaveStartDate}
                      onChange={(e) => setLeaveStartDate(e.target.value)}
                      className="input mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">End Date</label>
                    <input
                      type="date"
                      required
                      value={leaveEndDate}
                      onChange={(e) => setLeaveEndDate(e.target.value)}
                      className="input mt-1 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Absence Type</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="input mt-1 text-xs font-semibold"
                  >
                    <option value="leave">Vacation / Leave</option>
                    <option value="holiday">Official Holiday</option>
                    <option value="emergency">Emergency Absence</option>
                    <option value="conference">Medical Conference</option>
                    <option value="off_duty">Off Duty</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Reason / Notes</label>
                  <input
                    type="text"
                    required
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="e.g. Annual Leave, Cardiology Summit"
                    className="input mt-1 text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLeaveModal(false)}
                    className="flex-1 btn-secondary text-xs py-2.5 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn-primary text-xs py-2.5 font-bold"
                  >
                    Save Absence
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
