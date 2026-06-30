import { SPECIALIZATIONS, CITIES } from "../../utils/constants";

/**
 * ClinicSettingsForm — All doctor profile & clinic settings in one focused form.
 * Extracted from DoctorDashboard.jsx for better readability and maintainability.
 */

const TIME_OPTIONS = [
  "08:00 AM","08:30 AM","09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM",
  "12:00 PM","12:30 PM","01:00 PM","01:30 PM","02:00 PM","02:30 PM","03:00 PM","03:30 PM",
  "04:00 PM","04:30 PM","05:00 PM","05:30 PM","06:00 PM","06:30 PM","07:00 PM","07:30 PM",
  "08:00 PM","08:30 PM","09:00 PM","09:30 PM","10:00 PM","10:30 PM","11:00 PM","11:30 PM",
];

export default function ClinicSettingsForm({
  form, setForm,
  startTime, setStartTime,
  endTime, setEndTime,
  profile,
  onToggle, toggling,
  onSave, saving,
}) {
  return (
    <form onSubmit={onSave} className="card p-6 sm:p-8 pb-12 mb-12 space-y-8 animate-fade-in-up">
      <div>
        <h2 className="text-lg font-black text-slate-800 tracking-tight">Edit Profile & Clinic Info</h2>
        <p className="text-xs text-slate-400 mt-0.5">Manage your digital clinic settings, available hours, and medical rates.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

        <div>
          <label className="input-label">Doctor Full Name</label>
          <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="input" />
        </div>

        <div>
          <label className="input-label">Phone Number</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input" />
        </div>

        <div>
          <label className="input-label">Qualification</label>
          <input type="text" value={form.qualification} onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))} placeholder="E.g. MBBS, MD, DM" className="input" />
        </div>

        <div>
          <label className="input-label">Experience (Years)</label>
          <input type="number" min="0" max="60" value={form.experience} onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))} className="input" />
        </div>

        <div>
          <label className="input-label">Consultation Fee (₹)</label>
          <input type="number" min="0" value={form.consultationFee} onChange={(e) => setForm((f) => ({ ...f, consultationFee: e.target.value }))} className="input" />
        </div>

        <div>
          <label className="input-label">Available Days</label>
          <input type="text" value={form.availableDays} onChange={(e) => setForm((f) => ({ ...f, availableDays: e.target.value }))} placeholder="Mon, Tue, Wed, Thu, Fri" className="input" />
        </div>

        {/* Time range pickers */}
        <div className="sm:col-span-2 grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">Available From</label>
            <select value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input cursor-pointer">
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Available To</label>
            <select value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input cursor-pointer">
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Availability toggle */}
        <div className="sm:col-span-2 bg-slate-50 border border-slate-100 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Currently Accepting Appointments</h3>
            <p className="text-xs text-slate-500 mt-0.5">Turn this off if you are on leave or fully booked.</p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            disabled={toggling}
            className={`relative inline-flex items-center focus:outline-none w-[50px] h-[26px] rounded-full transition-colors duration-200 ${profile?.isAvailable ? "bg-green-500" : "bg-slate-300"}`}
          >
            <span className={`inline-block bg-white rounded-full shadow-sm transform transition-transform duration-200 w-[22px] h-[22px] ${profile?.isAvailable ? "translate-x-[26px]" : "translate-x-[2px]"}`} />
          </button>
        </div>

        <div>
          <label className="input-label">Clinic Name</label>
          <input type="text" value={form.clinicName} onChange={(e) => setForm((f) => ({ ...f, clinicName: e.target.value }))} placeholder="E.g. City Health Clinic" className="input" />
        </div>

        <div>
          <label className="input-label">Specialization</label>
          <select value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} className="input cursor-pointer">
            {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="input-label">City</label>
          <select value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="input cursor-pointer">
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="input-label">Clinic Address</label>
          <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} className="input" placeholder="Full clinic street address" />
        </div>

        <div className="sm:col-span-2">
          <label className="input-label">Google Maps Embed URL</label>
          <input type="url" value={form.mapUrl} onChange={(e) => setForm((f) => ({ ...f, mapUrl: e.target.value }))} className="input" placeholder="https://www.google.com/maps/embed?pb=..." />
        </div>

        <div className="sm:col-span-2">
          <label className="input-label">Bio / About Me</label>
          <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={3} className="input" placeholder="Describe your medical practice details..." />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving settings...
            </span>
          ) : "Save Settings Profile"}
        </button>
      </div>
    </form>
  );
}
