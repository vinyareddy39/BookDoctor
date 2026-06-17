import { useEffect, useState } from "react";
import API from "../services/api";
import DoctorList from "../components/doctor/DoctorList.jsx";

const SPECIALIZATIONS = [
  "All", "General Physician", "Cardiologist", "Dermatologist",
  "Neurologist", "Orthopedist", "Pediatrician", "Gynecologist",
  "Ophthalmologist", "ENT Specialist", "Dentist", "Psychiatrist", "Urologist",
];

const CITIES = [
  "All Cities", "Hyderabad", "Bangalore", "Chennai", "Mumbai",
  "Delhi", "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow",
];

export default function Doctors() {
  const [allDoctors, setAllDoctors] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [city, setCity]             = useState("All Cities");
  const [spec, setSpec]             = useState("All");
  const [search, setSearch]         = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

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

  // Client-side filtering
  const filtered = allDoctors.filter((doc) => {
    const docName  = doc.userId?.name || "";
    const docCity  = doc.city || "";
    const docSpec  = doc.specialization || "";

    const matchCity  = city === "All Cities" || docCity.toLowerCase().includes(city.toLowerCase());
    const matchSpec  = spec === "All"        || docSpec.toLowerCase().includes(spec.toLowerCase());
    const matchAvail = !onlyAvailable        || doc.isAvailable === true;
    const matchText  = !search
      || docName.toLowerCase().includes(search.toLowerCase())
      || docSpec.toLowerCase().includes(search.toLowerCase())
      || docCity.toLowerCase().includes(search.toLowerCase());

    return matchCity && matchSpec && matchAvail && matchText;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-primary-600 to-secondary-600 text-white py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3 tracking-tight">
            Find Your Doctor
          </h1>
          <p className="text-primary-100 text-lg mb-8">
            Search by city, specialization or name across India
          </p>

          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, specialization or city…"
              className="w-full pl-12 pr-4 py-4 rounded-2xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-[73px] z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap gap-3 items-center">
          {/* City Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <svg className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Specialization Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <svg className="w-4 h-4 text-secondary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <select
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Available Only Toggle */}
          <button
            onClick={() => setOnlyAvailable(!onlyAvailable)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              onlyAvailable
                ? "bg-green-500 text-white border-green-500 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-green-300"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${onlyAvailable ? "bg-white" : "bg-green-400"}`}></span>
            Available Now
          </button>

          {/* Result count */}
          <span className="ml-auto text-sm text-slate-500 font-medium">
            {loading ? "Loading…" : `${filtered.length} doctor${filtered.length !== 1 ? "s" : ""} found`}
          </span>
        </div>
      </div>

      {/* Quick Spec Pills */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex gap-2 flex-wrap">
          {["All", "Dermatologist", "Cardiologist", "Pediatrician", "Dentist", "Neurologist", "Orthopedist"].map((s) => (
            <button
              key={s}
              onClick={() => setSpec(s)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                spec === s
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:text-primary-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Doctor Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent"></div>
          </div>
        ) : (
          <DoctorList doctors={filtered} />
        )}
      </div>
    </div>
  );
}
