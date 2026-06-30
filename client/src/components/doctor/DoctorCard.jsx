import { Link } from "react-router-dom";

const SPEC_COLORS = {
  "Cardiologist":      "from-red-400 to-rose-600",
  "Dermatologist":     "from-pink-400 to-fuchsia-600",
  "Pediatrician":      "from-yellow-400 to-amber-600",
  "Neurologist":       "from-purple-400 to-violet-600",
  "Orthopedist":       "from-blue-400 to-indigo-600",
  "General Physician": "from-green-400 to-emerald-600",
  "Ophthalmologist":   "from-teal-400 to-cyan-600",
  "Dentist":           "from-sky-400 to-blue-600",
  "Psychiatrist":      "from-violet-400 to-purple-600",
  "Gynecologist":      "from-rose-400 to-pink-600",
  "ENT Specialist":    "from-orange-400 to-amber-600",
  "Urologist":         "from-indigo-400 to-blue-600",
};

const SPEC_EMOJIS = {
  "Cardiologist": "❤️", "Dermatologist": "🧴", "Pediatrician": "👶",
  "Neurologist": "🧠", "Orthopedist": "🦴", "General Physician": "🩺",
  "Ophthalmologist": "👁️", "Dentist": "🦷", "Psychiatrist": "🧘",
  "Gynecologist": "👩‍⚕️", "ENT Specialist": "👂", "Urologist": "🏥",
};

// Star rating display
function StarRating({ rating = 4.5 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`w-3.5 h-3.5 ${s <= Math.round(rating) ? "text-amber-400" : "text-slate-200"} fill-current`}
          viewBox="0 0 24 24"
        >
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ))}
      <span className="text-xs font-bold text-slate-500 ml-1">{rating}</span>
    </div>
  );
}

export default function DoctorCard({ doctor }) {
  const name           = doctor?.userId?.name || doctor?.name || "Unknown";
  const specialization = doctor?.specialization || "General Physician";
  const fee            = doctor?.consultationFee;
  const experience     = doctor?.experience;
  const city           = doctor?.city || "";
  const clinicName     = doctor?.clinicName || "";
  const isAvailable    = doctor?.isAvailable !== false;
  const id             = doctor?._id || "1";
  const initials       = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const gradient       = SPEC_COLORS[specialization] || "from-primary-400 to-primary-600";
  const emoji          = SPEC_EMOJIS[specialization] || "🏥";
  // Simulate a rating (4.0–5.0) based on doctor id for display purposes
  const rating         = parseFloat(((parseInt(id?.slice(-2) || "50", 16) % 10) / 10 + 4.0).toFixed(1));

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden flex flex-col transition-all duration-300 hover:shadow-card-lg hover:-translate-y-1.5 group">

      {/* ── Card Header ── */}
      <div className="relative px-5 pt-6 pb-5 flex flex-col items-center text-center">
        {/* Available badge — top right */}
        <div className="absolute top-4 right-4">
          {isAvailable ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Available Today
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Unavailable
            </span>
          )}
        </div>

        {/* Avatar with gradient ring */}
        <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300 mb-3`}>
          <span className="text-3xl">{emoji}</span>
        </div>

        {/* Name & Specialty */}
        <h3 className="text-base font-extrabold text-slate-800 leading-tight">Dr. {name}</h3>
        <p className="text-xs font-bold text-primary-600 mt-0.5">{specialization}</p>

        {/* Rating */}
        <div className="mt-2">
          <StarRating rating={Math.min(5.0, rating)} />
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/50">
        <div className="py-3 px-4 text-center">
          <span className="block text-base font-extrabold text-primary-600">₹{fee ?? "—"}</span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Consult Fee</span>
        </div>
        <div className="py-3 px-4 text-center">
          <span className="block text-base font-extrabold text-slate-700">{experience ?? "—"} yrs</span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Experience</span>
        </div>
      </div>

      {/* ── Location ── */}
      {(city || clinicName) && (
        <div className="px-5 py-2.5 flex items-center gap-1.5 border-t border-slate-100">
          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs text-slate-500 font-medium truncate">
            {clinicName ? `${clinicName}, ` : ""}{city}
          </span>
        </div>
      )}

      {/* ── Book Button ── */}
      <div className="px-5 pb-5 pt-3 mt-auto">
        <Link to={`/book/${id}`} className="block">
          <button
            disabled={!isAvailable}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 active:scale-95 ${
              isAvailable
                ? "bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg shadow-primary-200/60 hover:-translate-y-0.5"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isAvailable ? "Book Appointment →" : "Not Available"}
          </button>
        </Link>
      </div>
    </div>
  );
}
