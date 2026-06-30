/**
 * DashboardStats — Displays 4 appointment stat cards at the top of the doctor dashboard.
 */
const STAT_CONFIG = [
  { key: "total",     label: "Total Bookings",    color: "from-slate-700 to-slate-800" },
  { key: "pending",   label: "Pending Approval",  color: "from-amber-500 to-amber-600" },
  { key: "confirmed", label: "Confirmed Slots",   color: "from-emerald-500 to-emerald-600" },
  { key: "completed", label: "Completed",         color: "from-primary-600 to-primary-700" },
];

export default function DashboardStats({ appts }) {
  const stats = {
    total:     appts.length,
    pending:   appts.filter((a) => a.status === "pending").length,
    confirmed: appts.filter((a) => a.status === "confirmed").length,
    completed: appts.filter((a) => a.status === "completed").length,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-8">
      {STAT_CONFIG.map((s) => (
        <div
          key={s.key}
          className={`bg-gradient-to-br ${s.color} rounded-3xl p-5 text-white shadow-md hover:shadow-lg transition-shadow border border-white/10`}
        >
          <p className="text-3xl font-black">{stats[s.key]}</p>
          <p className="text-xs opacity-90 font-bold tracking-wide uppercase mt-1.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
