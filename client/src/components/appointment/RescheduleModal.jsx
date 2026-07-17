import { useState, useEffect, useMemo } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";
import { parseAllowedDays, isDateAllowed, nearestAllowedDate, generateTimeSlots, formatDateDisplay } from "../../utils/dateUtils";

export default function RescheduleModal({ isOpen, onClose, appointment, onSuccess }) {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [loading, setLoading] = useState(false);

  const doctor = appointment?.doctorId;

  // Memoize allowed days and slots
  const allowedSet = useMemo(() => parseAllowedDays(doctor?.availableDays), [doctor?.availableDays]);
  const allTimeSlots = useMemo(() => generateTimeSlots(doctor?.availableTime), [doctor?.availableTime]);

  // Set initial valid date on open
  useEffect(() => {
    if (isOpen && doctor) {
      const defaultDate = nearestAllowedDate(allowedSet);
      setSelectedDate(defaultDate);
      setSelectedTime(""); // reset time
    }
  }, [isOpen, doctor, allowedSet]);

  if (!isOpen || !appointment) return null;

  const handleDateChange = (e) => {
    const d = e.target.value;
    setSelectedDate(d);
    setSelectedTime(""); // Reset time on date change
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) {
      return toast.error("Please select a valid date and time.");
    }
    if (!isDateAllowed(selectedDate, allowedSet)) {
      return toast.error(`Dr. ${doctor?.userId?.name || "the doctor"} is not available on this day of the week.`);
    }

    setLoading(true);
    try {
      const res = await API.patch(`/appointments/${appointment._id}/reschedule`, {
        appointmentDate: selectedDate,
        appointmentTime: selectedTime
      });
      toast.success("Appointment rescheduled successfully!");
      onSuccess(res.data.data || res.data);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to reschedule.");
    } finally {
      setLoading(false);
    }
  };

  const isSelectedDateValid = isDateAllowed(selectedDate, allowedSet);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-black text-slate-800">Reschedule</h2>
          <p className="text-slate-500 text-sm mt-1">
            Pick a new date and time for your appointment.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date Picker */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Select Date</label>
            <input
              type="date"
              required
              min={new Date().toISOString().split("T")[0]}
              value={selectedDate}
              onChange={handleDateChange}
              className={`w-full px-4 py-3 rounded-xl border ${
                selectedDate && !isSelectedDateValid
                  ? "border-red-300 bg-red-50 text-red-900"
                  : "border-slate-200 bg-slate-50 focus:border-primary-500 focus:bg-white"
              } transition-colors outline-none`}
            />
            {selectedDate && !isSelectedDateValid && (
              <p className="text-xs text-red-500 mt-2 font-medium">
                The doctor is only available on: {doctor?.availableDays?.join(", ")}.
              </p>
            )}
            {selectedDate && isSelectedDateValid && (
              <p className="text-xs text-green-600 mt-2 font-bold">
                {formatDateDisplay(selectedDate)}
              </p>
            )}
          </div>

          {/* Time Picker */}
          <div className={`${!isSelectedDateValid || !selectedDate ? "opacity-50 pointer-events-none" : ""}`}>
            <label className="block text-sm font-bold text-slate-700 mb-2">Select Time</label>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {allTimeSlots.length > 0 ? (
                allTimeSlots.map((time) => (
                  <button
                    type="button"
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`py-2 px-1 text-xs font-bold rounded-lg transition-all ${
                      selectedTime === time
                        ? "bg-primary-600 text-white shadow-md shadow-primary-200/50"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {time}
                  </button>
                ))
              ) : (
                <p className="col-span-3 text-sm text-slate-500">No time slots configured.</p>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !isSelectedDateValid || !selectedTime}
            className="w-full btn-primary py-3.5 mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Confirm Reschedule"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
