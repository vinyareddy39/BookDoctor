import React from 'react';

export default function MedicalTimeline({ appointments }) {
  // Filter only completed appointments
  const history = appointments
    .filter(a => a.status === 'completed')
    .sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));

  if (!history || history.length === 0) {
    return (
      <div className="card p-16 text-center">
        <div className="text-6xl mb-4">📜</div>
        <h3 className="text-xl font-black text-slate-700 mb-2">No Medical History Yet</h3>
        <p className="text-slate-500 text-sm">Completed appointments and prescriptions will appear here as a timeline.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="relative border-l-2 border-primary-100 ml-4 md:ml-6 space-y-12">
        {history.map((appt, index) => {
          const dateObj = new Date(appt.appointmentDate);
          const dateStr = dateObj.toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          });
          const doctorName = appt.doctorId?.userId?.name || "Unknown Doctor";
          const specialization = appt.doctorId?.specialization || "Specialist";

          return (
            <div key={appt._id} className="relative pl-8 md:pl-12">
              {/* Timeline Node */}
              <div className="absolute w-6 h-6 bg-primary-100 rounded-full -left-[13px] top-1 flex items-center justify-center border-4 border-white shadow-sm">
                <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              </div>

              {/* Content Card */}
              <div className="card p-5 hover:shadow-card-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <span className="text-xs font-black text-primary-600 uppercase tracking-widest bg-primary-50 px-2 py-1 rounded">
                      {dateStr}
                    </span>
                    <h3 className="text-lg font-black text-slate-800 mt-2">Consultation with Dr. {doctorName}</h3>
                    <p className="text-sm font-semibold text-slate-500">{specialization}</p>
                  </div>
                  {appt.dependentId && (
                    <div className="bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1 rounded-full border border-amber-100 h-fit">
                      For Dependent
                    </div>
                  )}
                </div>

                {/* Prescription Box */}
                {appt.prescription ? (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">💊</span>
                      <h4 className="text-sm font-black text-slate-700 uppercase tracking-wide">Doctor's Notes</h4>
                    </div>
                    <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">
                      {appt.prescription}
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mt-2 border-dashed">
                    <p className="text-slate-400 text-sm font-medium italic">No clinical notes recorded for this visit.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
