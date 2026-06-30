import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import API from "../services/api";
import toast from "react-hot-toast";

// Parse "10:00 AM - 5:00 PM" → array of "10:00 AM", "10:30 AM", etc.
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
    const h24 = Math.floor(m / 60);
    const min = m % 60;
    const ampm = h24 < 12 ? "AM" : "PM";
    const h12  = h24 % 12 === 0 ? 12 : (h24 > 12 ? h24 - 12 : h24);
    slots.push(`${h12}:${min.toString().padStart(2, "0")} ${ampm}`);
  }
  return slots;
}

export default function BookAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doctor, setDoctor]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [date, setDate]         = useState("");
  const [time, setTime]         = useState("");
  const [booking, setBooking]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const mapEmbedUrl = doctor?.mapUrl
    ? doctor.mapUrl
    : doctor?.address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(doctor.address)}&output=embed`
    : null;

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

  const handleBook = async () => {
    if (!date || !time) {
      toast.error("Please select a valid date and time slot.");
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

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-surface">
        <div className="animate-spin w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent"></div>
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

  const name           = doctor.userId?.name || "Unknown Doctor";
  const specialization = doctor.specialization;
  const fee            = doctor.consultationFee;
  const experience     = doctor.experience;
  const city           = doctor.city;
  const clinicName     = doctor.clinicName;
  const address        = doctor.address;
  const bio            = doctor.bio;
  const availableTime  = doctor.availableTime;
  const availableDays  = doctor.availableDays || [];
  const isAvailable    = doctor.isAvailable !== false;
  const initials       = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const timeSlots      = generateTimeSlots(availableTime);

  return (
    <div className="min-h-screen bg-surface py-10 px-4">
      <div className="max-w-5xl mx-auto">

        {/* ── Back & Support Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-500 hover:text-primary-600 font-semibold text-sm transition-colors"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Specialists
          </button>
          
          <div className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
            Support: <a href="mailto:findoctor@gmail.com" className="text-primary-600 hover:underline">findoctor@gmail.com</a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Left column: Info card ── */}
          <div className="lg:col-span-3 space-y-6">

            {/* Profile info */}
            <div className="card overflow-hidden">
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

              {/* Fee, Experience, City */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/50">
                {[
                  { label: "Consultation Fee", value: `₹${fee}`, color: "text-primary-600" },
                  { label: "Experience",        value: `${experience} yrs`, color: "text-slate-800" },
                  { label: "Practice City",      value: city || "—", color: "text-secondary-600" },
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

                {availableDays.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Available Consultation Days</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {availableDays.map((d) => (
                        <span key={d} className="badge-blue text-[10px]">
                          {d}
                        </span>
                      ))}
                    </div>
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

          {/* ── Right column: Scheduling form ── */}
          <div className="lg:col-span-2">
            <div className="card p-6 space-y-6 sticky top-24">
              <h2 className="text-lg font-black text-slate-800">Select Date & Time Slot</h2>

              <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-primary-600 uppercase tracking-widest">Total consultation fee</p>
                  <p className="text-3xl font-black text-primary-700">₹{fee}</p>
                </div>
                <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center text-xl">
                  💳
                </div>
              </div>

              <div className="space-y-4">
                {/* Date Input */}
                <div>
                  <label className="input-label">Select Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="input"
                    required
                  />
                </div>

                {/* Time slot grid selectors */}
                <div>
                  <label className="input-label mb-2">Available Time Slots</label>
                  {timeSlots.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setTime(slot)}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition-all duration-150 ${
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
                      className="input"
                      required
                    />
                  )}
                  {availableTime && (
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      Note: Doctor consultations are held between {availableTime}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => {
                  if (!date || !time) {
                    toast.error("Please fill in both Date and Time Slot.");
                    return;
                  }
                  setShowConfirm(true);
                }}
                disabled={!isAvailable}
                className="btn-primary w-full py-4 text-base"
              >
                {isAvailable ? "Book Appointment" : "Doctor Unavailable"}
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
            <p className="text-slate-500 text-sm mb-5">Please verify your appointment details below before confirming:</p>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">Doctor:</span>
                <span className="font-black text-slate-800">Dr. {name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">Specialty:</span>
                <span className="font-semibold text-slate-600">{specialization}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">Scheduled Date:</span>
                <span className="font-black text-slate-800">{new Date(date).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">Time Slot:</span>
                <span className="font-black text-slate-800">{time}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-200 pt-3">
                <span className="font-bold text-slate-500">Total Consultation Fee:</span>
                <span className="font-black text-primary-600">₹{fee}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="btn-secondary flex-1 py-3 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBook}
                disabled={booking}
                className="btn-primary flex-1 py-3 text-sm"
              >
                {booking ? "Booking..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
