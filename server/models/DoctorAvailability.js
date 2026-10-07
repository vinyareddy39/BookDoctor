import mongoose from "mongoose";

const dailyScheduleSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      required: true,
      min: 0,
      max: 6,
    },
    dayName: {
      type: String,
      required: true,
    },
    isWorking: {
      type: Boolean,
      default: true,
    },
    startTime: {
      type: String,
      default: "09:00",
    },
    endTime: {
      type: String,
      default: "17:00",
    },
    breakStartTime: {
      type: String,
      default: "13:00",
    },
    breakEndTime: {
      type: String,
      default: "14:00",
    },
  },
  { _id: false }
);

const doctorAvailabilitySchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      unique: true,
      index: true,
    },
    slotDuration: {
      type: Number,
      default: 30, // in minutes
    },
    maxPatientsPerSlot: {
      type: Number,
      default: 1,
    },
    weeklySchedule: {
      type: [dailyScheduleSchema],
      default: [
        { dayOfWeek: 1, dayName: "Monday",    isWorking: true,  startTime: "09:00", endTime: "17:00", breakStartTime: "13:00", breakEndTime: "14:00" },
        { dayOfWeek: 2, dayName: "Tuesday",   isWorking: true,  startTime: "09:00", endTime: "17:00", breakStartTime: "13:00", breakEndTime: "14:00" },
        { dayOfWeek: 3, dayName: "Wednesday", isWorking: true,  startTime: "09:00", endTime: "17:00", breakStartTime: "13:00", breakEndTime: "14:00" },
        { dayOfWeek: 4, dayName: "Thursday",  isWorking: true,  startTime: "09:00", endTime: "17:00", breakStartTime: "13:00", breakEndTime: "14:00" },
        { dayOfWeek: 5, dayName: "Friday",    isWorking: true,  startTime: "09:00", endTime: "17:00", breakStartTime: "13:00", breakEndTime: "14:00" },
        { dayOfWeek: 6, dayName: "Saturday",  isWorking: false, startTime: "09:00", endTime: "13:00", breakStartTime: "", breakEndTime: "" },
        { dayOfWeek: 0, dayName: "Sunday",    isWorking: false, startTime: "09:00", endTime: "13:00", breakStartTime: "", breakEndTime: "" },
      ],
    },
  },
  { timestamps: true }
);

export default mongoose.model("DoctorAvailability", doctorAvailabilitySchema);
