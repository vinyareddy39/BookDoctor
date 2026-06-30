import { useEffect, useState } from "react";
import API from "../services/api";
import DoctorList from "../components/doctor/DoctorList.jsx";
import { SPECIALIZATIONS as CONST_SPECS, CITIES as CONST_CITIES } from "../utils/constants";

const SPECIALIZATIONS = ["All Specialists", ...CONST_SPECS];
const CITIES = ["All Cities", ...CONST_CITIES];


function DoctorSkeleton() {
  return (
    <div className="card p-5 animate-pulse space-y-4">
      <div className="flex flex-col items-center">
        <div className="skeleton w-20 h-20 rounded-2xl mb-3" />
        <div className="skeleton h-4 w-32 rounded mb-2" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-b border-slate-100 py-3">
        <div className="skeleton h-4 w-12 mx-auto rounded" />
        <div className="skeleton h-4 w-12 mx-auto rounded" />
      </div>
      <div className="skeleton h-3 w-3/4 mx-auto rounded" />
      <div className="skeleton h-10 w-full rounded-xl mt-3" />
    </div>
  );
}

export default function Doctors() {
  const [allDoctors,    setAllDoctors]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [city,          setCity]          = useState("All Cities");
  const [spec,          setSpec]          = useState("All Specialists");
  const [search,         setSearch]        = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [maxFee,        setMaxFee]        = useState(2000);
  const [minExperience, setMinExperience] = useState(0);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await API.get("/doctors");
        setAllDoctors(res.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, []);

  const handleClearFilters = () => {
    setCity("All Cities");
    setSpec("All Specialists");
    setSearch("");
    setOnlyAvailable(false);
    setMaxFee(2000);
    setMinExperience(0);
  };

  // Client-side filtering
  const filtered = allDoctors.filter((doc) => {
    const name           = doc.userId?.name || doc.name || "";
    const docCity        = doc.city || "";
    const docSpec        = doc.specialization || "";
    const fee            = doc.consultationFee || 0;
    const exp            = doc.experience || 0;
    const clinicName     = doc.clinicName || "";

    const matchCity      = city === "All Cities" || docCity.toLowerCase().includes(city.toLowerCase());
    const matchSpec      = spec === "All Specialists" || docSpec.toLowerCase().includes(spec.replace(" Specialists", "").toLowerCase());
    const matchAvail     = !onlyAvailable || doc.isAvailable === true;
    const matchFee       = fee <= maxFee;
    const matchExp       = exp >= minExperience;
    const matchText      = !search
      || name.toLowerCase().includes(search.toLowerCase())
      || docSpec.toLowerCase().includes(search.toLowerCase())
      || clinicName.toLowerCase().includes(search.toLowerCase())
      || docCity.toLowerCase().includes(search.toLowerCase());

    return matchCity && matchSpec && matchAvail && matchFee && matchExp && matchText;
  });

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Hero Search Banner ── */}
      <div className="bg-gradient-to-r from-primary-600 to-secondary-600 text-white py-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4 animate-fade-in-up">
          <span className="text-xs font-extrabold uppercase tracking-widest bg-white/10 px-3.5 py-1 rounded-full border border-white/20">
            Search Verified Specialists
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
            Find Your Doctor
          </h1>
          <p className="text-primary-100 text-base md:text-lg max-w-md mx-auto">
            Book online instantly to consult with expert doctors matching your needs.
          </p>

          {/* Search Input */}
          <div className="relative max-w-xl mx-auto pt-4">
            <svg className="absolute left-4 top-[60%] -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by doctor name, specialty, or clinic..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-primary-500/20 shadow-lg border border-slate-100 bg-white"
            />
          </div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="section py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* ── Sidebar Filters ── */}
          <div className="lg:col-span-1 space-y-6">
            <div className="card p-6 space-y-6 sticky top-24">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-base font-black text-slate-800">Filter By</h3>
                <button
                  onClick={handleClearFilters}
                  className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Reset All
                </button>
              </div>

              {/* City Selection */}
              <div>
                <label className="input-label">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="input cursor-pointer"
                >
                  {CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Specialty Selection */}
              <div>
                <label className="input-label">Specialty</label>
                <select
                  value={spec}
                  onChange={(e) => setSpec(e.target.value)}
                  className="input cursor-pointer"
                >
                  {SPECIALIZATIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Max Consultation Fee */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Max Consultation Fee</label>
                  <span className="text-sm font-bold text-primary-600">₹{maxFee}</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="2000"
                  step="100"
                  value={maxFee}
                  onChange={(e) => setMaxFee(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1">
                  <span>₹200</span>
                  <span>₹2000</span>
                </div>
              </div>

              {/* Experience */}
              <div>
                <label className="input-label">Min Experience (Years)</label>
                <select
                  value={minExperience}
                  onChange={(e) => setMinExperience(Number(e.target.value))}
                  className="input cursor-pointer"
                >
                  <option value={0}>Any Experience</option>
                  <option value={3}>3+ Years</option>
                  <option value={5}>5+ Years</option>
                  <option value={10}>10+ Years</option>
                  <option value={15}>15+ Years</option>
                </select>
              </div>

              {/* Availability Toggle */}
              <div className="pt-2">
                <button
                  onClick={() => setOnlyAvailable(!onlyAvailable)}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all duration-200 ${
                    onlyAvailable
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-white text-slate-600 border-slate-200 hover:border-green-300"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${onlyAvailable ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
                  Available Now
                </button>
              </div>
            </div>
          </div>

          {/* ── Doctor Grid Content ── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header info */}
            <div className="flex items-center justify-between bg-white border border-slate-100 shadow-sm rounded-2xl px-6 py-4">
              <span className="text-sm font-bold text-slate-500">
                {loading ? "Finding doctors..." : `${filtered.length} specialist${filtered.length !== 1 ? "s" : ""} available`}
              </span>
              <span className="text-xs font-bold text-primary-600 bg-primary-50 border border-primary-100 rounded-full px-3 py-1 uppercase">
                ⚡ Real-time updates
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <DoctorSkeleton key={i} />
                ))}
              </div>
            ) : (
              <DoctorList doctors={filtered} onClearFilters={handleClearFilters} />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
