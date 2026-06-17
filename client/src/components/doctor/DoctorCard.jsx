import { Link } from "react-router-dom";

export default function DoctorCard({ doctor }) {
  const name           = doctor?.userId?.name || doctor?.name || "Dr. Unknown";
  const specialization = doctor?.specialization || "General Physician";
  const fee            = doctor?.consultationFee;
  const experience     = doctor?.experience;
  const city           = doctor?.city || "";
  const clinicName     = doctor?.clinicName || "";
  const isAvailable    = doctor?.isAvailable !== false; // default true
  const id             = doctor?._id || "1";
  const initials       = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group">
      {/* Card Top */}
      <div className="bg-gradient-to-br from-primary-50 to-secondary-50 px-6 pt-6 pb-4 flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="w-20 h-20 bg-white rounded-2xl shadow-md flex items-center justify-center text-2xl font-extrabold text-primary-600 mb-3 group-hover:scale-105 transition-transform">
          {initials}
        </div>

        {/* Availability badge */}
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${
          isAvailable
            ? "bg-green-100 text-green-700"
            : "bg-slate-100 text-slate-500"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? "bg-green-500 animate-pulse" : "bg-slate-400"}`}></span>
          {isAvailable ? "Available" : "Unavailable"}
        </span>

        <h3 className="text-lg font-extrabold text-slate-800 leading-tight">Dr. {name}</h3>
        <p className="text-sm font-semibold text-secondary-600 mt-0.5">{specialization}</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
        <div className="py-3 px-4 text-center">
          <span className="block text-lg font-extrabold text-primary-600">₹{fee ?? "—"}</span>
          <span className="text-[11px] text-slate-400 font-medium">Consult Fee</span>
        </div>
        <div className="py-3 px-4 text-center">
          <span className="block text-lg font-extrabold text-slate-700">{experience ?? "—"} yrs</span>
          <span className="text-[11px] text-slate-400 font-medium">Experience</span>
        </div>
      </div>

      {/* City & Clinic */}
      {(city || clinicName) && (
        <div className="px-5 py-3 flex items-center gap-2 border-t border-slate-50 bg-slate-50/60">
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs text-slate-500 font-medium truncate">
            {clinicName ? `${clinicName}, ` : ""}{city}
          </span>
        </div>
      )}

      {/* Book Button */}
      <div className="px-5 pb-5 pt-3 mt-auto">
        <Link to={`/book/${id}`} className="block">
          <button
            disabled={!isAvailable}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
              isAvailable
                ? "bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg shadow-primary-100"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isAvailable ? "Book Appointment" : "Not Available"}
          </button>
        </Link>
      </div>
    </div>
  );
}
