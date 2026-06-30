import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import API from "../services/api";
import toast from "react-hot-toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map day names (any format) → JS getDay() index (0=Sun … 6=Sat) */
const DAY_MAP = {
  sunday: 0,    sun: 0,
  monday: 1,    mon: 1,
  tuesday: 2,   tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4,  thu: 4,
  friday: 5,    fri: 5,
  saturday: 6,  sat: 6,
};

/**
 * Parse doctor.availableDays (array like ["Mon","Wed","Fri"] or ["Monday","Wednesday"])
 * → Set of JS day-of-week numbers: {1, 3, 5}
 */
function parseAllowedDays(availableDays = []) {
  const allowed = new Set();
  availableDays.forEach((d) => {
    const key = d.trim().toLowerCase();
    if (DAY_MAP[key] !== undefined) allowed.add(DAY_MAP[key]);
  });
  return allowed;
}

/**
 * Given a date string "YYYY-MM-DD", check if that day of week is allowed.
 * NOTE: We parse with no timezone offset so the date stays local.
 */
function isDateAllowed(dateStr, allowedSet) {
  if (!dateStr || allowedSet.size === 0) return true; // no restriction if no days configured
  const [y, m, d] = dateStr.split("-").map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay(); // local date — no UTC shift
  return allowedSet.has(dayOfWeek);
}

/**
 * Build the nearest valid date on or after today that falls on an allowed day.
 * Returns "YYYY-MM-DD" string or "" if no allowed days configured.
 */
function nearestAllowedDate(allowedSet) {
  if (allowedSet.size === 0) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (allowedSet.has(d.getDay())) {
      return d.toISOString().split("T")[0];
    }
  }
  return "";
}

/** Parse "10:00 AM - 5:00 PM" → 30-min slot array */
function generateTimeSlots(availableTime) {
  if (!availableTime) return [];
  const parts = availableTime.split("-").map((s) => s.trim());
  if (parts.length < 2) return [];

  const parseTime = (str) => {
    const match = str.match(/(\d+):?(\d*)\s*(AM|PM)/i);
    if (!match) return null;
    let h = parseInt(match[1]);
    const m = parseInt(match[2] || "0");
    const ampm = match[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h * 60 + m;
  };

  const startMin = parseTime(parts[0]);
  const endMin   = parseTime(parts[1]);
  if (startMin === null || endMin === null || startMin >= endMin) return [];

  const slots = [];
  for (let m = startMin; m <= endMin; m += 30) {
    const h24  = Math.floor(m / 60);
    const min  = m % 60;
    const ampm = h24 < 12 ? "AM" : "PM";
    const h12  = h24 % 12 === 0 ? 12 : h24 % 12;
    slots.push(`${h12}:${min.toString().padStart(2, "0")} ${ampm}`);
  }
  return slots;
}

/** Format "YYYY-MM-DD" → "Monday, 30 June 2026" */
function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookAppointment() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [doctor,      setDoctor]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [date,        setDate]        = useState("");
  const [time,        setTime]        = useState("");
  const [booking,     setBooking]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [dateError,   setDateError]   = useState("");

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await API.get(`/doctors/${id}`);
        setDoctor(res.data.data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load doctor profile.");
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [id]);

  // Pre-fill the nearest valid date once doctor loads
  useEffect(() => {
    if (!doctor) return;
    const allowed = parseAllowedDays(doctor.availableDays || []);
    if (allowed.size > 0) {
      setDate(nearestAllowedDate(allowed));
    }
  }, [doctor]);

  const handleDateChange = useCallback((e) => {
    const val = e.target.value;
    setDate(val);
    setTime("");
    setDateError("");

    if (!val) return;
    const allowed = parseAllowedDays(doctor?.availableDays || []);
    if (allowed.size > 0 && !isDateAllowed(val, allowed)) {
      const dayNames = [...allowed].map((d) =>
        ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d]
      ).join(", ");
      setDateError(`❌ Dr. ${doctor?.userId?.name || "this doctor"} is only available on: ${dayNames}. Please pick a different date.`);
    }
  }, [doctor]);

  const handleBook = async () => {
    if (!date || !time) {
      toast.error("Please select a valid date and time slot.");
      return;
    }
    const allowed = parseAllowedDays(doctor?.availableDays || []);
    if (allowed.size > 0 && !isDateAllowed(date, allowed)) {
      toast.error("Selected date is not an available day for this doctor.");
      return;
    }
    setBooking(true);
    try {
      await API.post("/appointments", {
        doctorId:        id,
        appointmentDate: date,
        appointmentTime: time,
        amount:          doctor?.consultationFee || 500,
      });
      toast.success("Appointment booked successfully! 🎉");
      setShowConfirm(false);
      navigate("/appointments");
    } catch (err) {
      toast.error(err.response?.data?.message || "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  // ── Loading / not-found states ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-surface">
        <div className="animate-spin w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-surface">
        <div className="text-center p-8 card max-w-sm">
          <p className="text-6xl mb-3">👨‍⚕️</p>
          <p className="text-slate-500 font-bold text-lg">Doctor Profile Not Found</p>
          <button onClick={() => navigate("/doctors")} className="btn-primary mt-4">Browse Doctors</button>
        </div>
      </div>
    );
  }

  const name          = doctor.userId?.name || "Unknown Doctor";
  const specialization = doctor.specialization;
  const fee           = doctor.consultationFee;
  const experience    = doctor.experience;
  const city          = doctor.city;
  const clinicName    = doctor.clinicName;
  const address       = doctor.address;
  const bio           = doctor.bio;
  const availableTime = doctor.availableTime;
  const availableDays = doctor.availableDays || [];
  const isAvailable   = doctor.isAvailable !== false;

  const allowedDaySet = parseAllowedDays(availableDays);
  const timeSlots     = generateTimeSlots(availableTime);
  const todayStr      = new Date().toISOString().split("T")[0];

  const mapEmbedUrl = doctor?.mapUrl
    ? doctor.mapUrl
    : doctor?.address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(doctor.address)}&output=embed`
    : null;

  // Day names for display
  const dayLabels = allowedDaySet.size > 0
    ? [...allowedDaySet].sort().map((d) =>
        ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]
      )
    : [];

  const canBook = date && time && !dateError && isAvailable;

  return (
    <div className="min-h-screen bg-surface py-10 px-4">
      <div className="max-w-5xl mx-auto">

        {/* ── Back & Support ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-500 hover:text-primary-600 font-semibold text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Specialists
          </button>
          <div className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
            Support: <a href="mailto:support@bookdoctor.com" className="text-primary-600 hover:underline">support@bookdoctor.com</a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Left: Doctor Info ── */}
          <div className="lg:col-span-3 space-y-6">
            <div className="card overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary-600 to-secondary-600 p-6 text-white">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-3xl font-extrabold shadow-lg flex-shrink-0">
                    👨‍⚕️
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-black">Dr. {name}</h1>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                        isAvailable ? "bg-green-400/30 text-green-100" : "bg-white/20 text-white/70"
                      }`}>
                        {isAvailable ? "● Active Today" : "○ Inactive"}
                      </span>
                    </div>
                    <p className="text-primary-100 font-bold mt-0.5">{specialization}</p>
                    {clinicName && <p className="text-primary-200 text-xs mt-1 font-semibold">🏢 {clinicName}</p>}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/50">
                {[
                  { label: "Consultation Fee", value: `₹${fee}`,           color: "text-primary-600"   },
                  { label: "Experience",        value: `${experience} yrs`, color: "text-slate-800"     },
                  { label: "Practice City",     value: city || "—",         color: "text-secondary-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="py-4 text-center">
                    <span className={`block text-lg font-black ${color}`}>{value}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{label}</span>
                  </div>
                ))}
              </div>

              {/* Bio & details */}
              <div className="p-6 space-y-6">
                {bio && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Doctor Profile</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{bio}</p>
                  </div>
                )}

                {/* Available Days with visual chips */}
                {availableDays.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Available Consultation Days</h3>
                    <div className="flex flex-wrap gap-2">
                      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((dayShort, idx) => {
                        const isActive = allowedDaySet.has(idx);
                        return (
                          <span
                            key={dayShort}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                              isActive
                                ? "bg-primary-50 border-primary-200 text-primary-700"
                                : "bg-slate-50 border-slate-200 text-slate-300"
                            }`}
                          >
                            {dayShort}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Appointments only on: <span className="font-bold text-primary-600">{availableDays.join(", ")}</span>
                    </p>
                  </div>
                )}

                {availableTime && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Available Hours</h3>
                    <p className="text-slate-700 text-sm font-semibold flex items-center gap-1.5">
                      <span>🕐</span> {availableTime}
                    </p>
                  </div>
                )}

                {address && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Clinic Address</h3>
                    <p className="text-slate-600 text-sm leading-relaxed flex items-start gap-2">
                      <span className="text-red-500 mt-0.5 flex-shrink-0">📍</span>
                      {address}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Map Embed */}
            {mapEmbedUrl && (
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-xl">🗺️</span>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Directions & Location</h3>
                </div>
                <div className="w-full h-64 bg-slate-100">
                  <iframe
                    src={mapEmbedUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`${clinicName || "Clinic"} directions map`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Booking Form ── */}
          <div className="lg:col-span-2">
            <div className="card p-6 space-y-6 sticky top-24">
              <h2 className="text-lg font-black text-slate-800">Select Date & Time Slot</h2>

              {/* Fee display */}
              <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-primary-600 uppercase tracking-widest">Total Consultation Fee</p>
                  <p className="text-3xl font-black text-primary-700">₹{fee}</p>
                </div>
                <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center text-xl">💳</div>
              </div>

              {/* Available days hint */}
              {dayLabels.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5 flex items-start gap-3">
                  <span className="text-xl mt-0.5 flex-shrink-0">📅</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">Booking days restriction</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      This doctor is available only on{" "}
                      <span className="font-extrabold">{dayLabels.join(", ")}</span>.
                      Please select one of these days.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">

                {/* Date picker */}
                <div>
                  <label htmlFor="appt-date" className="input-label">Select Date</label>
                  <input
                    id="appt-date"
                    type="date"
                    value={date}
                    onChange={handleDateChange}
                    min={todayStr}
                    className={`input ${dateError ? "border-rose-400 bg-rose-50 focus:ring-rose-500/20" : ""}`}
                    required
                  />
                  {/* Inline day-validation error */}
                  {dateError && (
                    <p className="text-xs font-semibold text-rose-600 mt-1.5 leading-relaxed">{dateError}</p>
                  )}
                  {/* Valid date confirmation */}
                  {date && !dateError && (
                    <p className="text-xs font-semibold text-emerald-600 mt-1.5 flex items-center gap-1">
                      <span>✅</span> {formatDateDisplay(date)}
                    </p>
                  )}
                </div>

                {/* Time slots */}
                <div>
                  <label className="input-label mb-2">Available Time Slots</label>
                  {timeSlots.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setTime(slot)}
                          disabled={!!dateError || !date}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                            time === slot
                              ? "bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-500/25"
                              : "bg-white text-slate-600 border-slate-200 hover:border-primary-400 hover:text-primary-600"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      disabled={!!dateError || !date}
                      className="input disabled:opacity-40"
                      required
                    />
                  )}
                  {availableTime && (
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      Consultation hours: <span className="font-bold text-slate-600">{availableTime}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Book button */}
              <button
                type="button"
                onClick={() => {
                  if (!date || !time) { toast.error("Please fill in both Date and Time Slot."); return; }
                  if (dateError)       { toast.error("Selected date is not an available day."); return; }
                  setShowConfirm(true);
                }}
                disabled={!isAvailable || !!dateError}
                className={`w-full py-4 text-base rounded-2xl font-bold shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${
                  !isAvailable
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : dateError
                    ? "bg-rose-100 text-rose-400 cursor-not-allowed"
                    : "btn-primary"
                }`}
              >
                {!isAvailable ? "🚫 Doctor Unavailable" : "Book Appointment"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Confirmation Modal ─── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-fade-in-up">
            <h3 className="text-lg font-black text-slate-800 mb-2">Confirm Booking</h3>
            <p className="text-slate-500 text-sm mb-5">Please verify your appointment details below:</p>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-3 mb-6">
              {[
                { label: "Doctor",     value: `Dr. ${name}` },
                { label: "Specialty",  value: specialization },
                { label: "Date",       value: formatDateDisplay(date) },
                { label: "Time Slot",  value: time },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm gap-4">
                  <span className="font-bold text-slate-500 flex-shrink-0">{label}:</span>
                  <span className="font-black text-slate-800 text-right">{value}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm border-t border-slate-200 pt-3">
                <span className="font-bold text-slate-500">Consultation Fee:</span>
                <span className="font-black text-primary-600">₹{fee}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowConfirm(false)} className="btn-secondary flex-1 py-3 text-sm">
                Cancel
              </button>
              <button type="button" onClick={handleBook} disabled={booking} className="btn-primary flex-1 py-3 text-sm">
                {booking ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Booking…
                  </span>
                ) : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
