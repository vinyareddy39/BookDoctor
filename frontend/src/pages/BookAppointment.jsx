import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import API from "../services/api";

// Parse "10:00 AM - 5:00 PM" → array of "10:00 AM", "11:00 AM", ...
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
  for (let m = startMin; m < endMin; m += 60) {
    const h24 = Math.floor(m / 60);
    const min = m % 60;
    const ampm = h24 < 12 ? "AM" : "PM";
    const h12  = h24 % 12 === 0 ? 12 : h24 % 12;
    slots.push(`${h12}:${min.toString().padStart(2, "0")} ${ampm}`);
  }
  return slots;
}

export default function BookAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doctor, setDoctor]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate]       = useState("");
  const [time, setTime]       = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  // Build a Google Maps search embed URL from the address
  const mapEmbedUrl = doctor?.mapUrl
    ? doctor.mapUrl
    : doctor?.address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(doctor.address)}&output=embed`
    : null;

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await API.get(`/doctors/${id}`);
        setDoctor(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleBook = async (e) => {
    e.preventDefault();
    setError("");
    setBooking(true);
    try {
      await API.post("/appointments", {
        doctorId:        id,
        appointmentDate: date,
        appointmentTime: time,
        amount:          doctor?.consultationFee || 500,
      });
      setSuccess(true);
      setTimeout(() => navigate("/appointments"), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-lg">Doctor not found.</p>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary-50/30 py-10 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-primary-600 font-medium text-sm mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Doctors
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ─── Left Panel: Doctor Profile ─── */}
          <div className="lg:col-span-3 space-y-5">

            {/* Doctor Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-600 to-secondary-600 p-6 text-white">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-3xl font-extrabold text-white shadow-lg flex-shrink-0">
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-2xl font-extrabold">Dr. {name}</h1>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isAvailable ? "bg-green-400/30 text-green-100" : "bg-white/20 text-white/70"
                      }`}>
                        {isAvailable ? "● Available" : "○ Unavailable"}
                      </span>
                    </div>
                    <p className="text-primary-100 font-medium">{specialization}</p>
                    {clinicName && <p className="text-primary-200 text-sm mt-1">{clinicName}</p>}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                {[
                  { label: "Consult Fee", value: `₹${fee}`, color: "text-primary-600" },
                  { label: "Experience",  value: `${experience} yrs`, color: "text-slate-800" },
                  { label: "City",        value: city || "—", color: "text-secondary-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="py-4 px-4 text-center">
                    <span className={`block text-xl font-extrabold ${color}`}>{value}</span>
                    <span className="text-xs text-slate-400 font-medium">{label}</span>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div className="p-6 space-y-4">
                {bio && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">About</h3>
                    <p className="text-slate-700 text-sm leading-relaxed">{bio}</p>
                  </div>
                )}

                {availableDays.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Available Days</h3>
                    <div className="flex flex-wrap gap-2">
                      {availableDays.map((d) => (
                        <span key={d} className="bg-primary-50 text-primary-700 text-xs font-semibold px-3 py-1 rounded-full border border-primary-100">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {availableTime && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Clinic Hours</h3>
                    <p className="text-slate-700 text-sm font-medium">🕐 {availableTime}</p>
                  </div>
                )}

                {address && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Clinic Address</h3>
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-slate-700 text-sm">{address}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Google Maps Embed ─── */}
            {mapEmbedUrl && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <h3 className="font-bold text-slate-800">Clinic Location</h3>
                </div>
                <div className="w-full h-64">
                  <iframe
                    src={mapEmbedUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`${clinicName || "Clinic"} location map`}
                  ></iframe>
                </div>
                {address && (
                  <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-600 text-sm font-semibold hover:underline flex items-center gap-1"
                    >
                      Open in Google Maps →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Right Panel: Booking Form ─── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sticky top-28">
              <h2 className="text-xl font-extrabold text-slate-800 mb-1">Book Appointment</h2>
              <p className="text-slate-500 text-sm mb-6">with Dr. {name}</p>

              {/* Fee highlight */}
              <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-primary-600 font-semibold uppercase tracking-wider">Consultation Fee</p>
                  <p className="text-3xl font-extrabold text-primary-700">₹{fee}</p>
                </div>
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              {success ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-green-700 mb-1">Appointment Booked!</h3>
                  <p className="text-slate-500 text-sm">Redirecting to your appointments…</p>
                </div>
              ) : (
                <form onSubmit={handleBook} className="space-y-4">
                  {error && (
                    <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Select Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Select Time</label>
                    {timeSlots.length > 0 ? (
                      <select
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                      >
                        <option value="">-- Select a time slot --</option>
                        {timeSlots.map((slot) => (
                          <option key={slot} value={slot}>{slot}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-sm font-medium"
                      />
                    )}
                    {availableTime && (
                      <p className="text-xs text-slate-400 mt-1">🕐 Doctor available: {availableTime}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={booking || !isAvailable}
                    className={`w-full font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-2 ${
                      isAvailable
                        ? "bg-primary-600 hover:bg-primary-700 text-white hover:shadow-primary-200"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    } disabled:opacity-70`}
                  >
                    {booking ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        Booking…
                      </>
                    ) : isAvailable ? (
                      "Confirm Appointment"
                    ) : (
                      "Doctor Unavailable"
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
