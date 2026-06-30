import DoctorCard from "./DoctorCard";

export default function DoctorList({ doctors, onClearFilters }) {
  if (!doctors || doctors.length === 0) {
    return (
      <div className="card p-16 text-center max-w-lg mx-auto border border-slate-100">
        <div className="text-7xl mb-4">🔍</div>
        <h3 className="text-xl font-black text-slate-800 mb-2">No Match Found</h3>
        <p className="text-slate-500 text-sm mb-6">
          We couldn't find any doctors matching your current filters. Try resetting them.
        </p>
        {onClearFilters && (
          <button onClick={onClearFilters} className="btn-primary py-2.5">
            Reset Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {doctors.map((doc) => (
        <DoctorCard key={doc._id} doctor={doc} />
      ))}
    </div>
  );
}
