import DoctorCard from "./DoctorCard";

export default function DoctorList({ doctors }) {
  if (!doctors || doctors.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No doctors available at the moment.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {doctors.map((doc) => (
        <DoctorCard key={doc._id} doctor={doc} />
      ))}
    </div>
  );
}
