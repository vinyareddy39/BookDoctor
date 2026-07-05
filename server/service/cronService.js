import cron from "node-cron";
import Appointment from "../models/Appointment.js";
import { sendReminderEmail } from "./emailService.js";

export const startReminderCron = () => {
  // Run every day at 9:00 AM
  cron.schedule("0 9 * * *", async () => {
    console.log("[Cron] Running daily appointment reminder check...");
    try {
      const tomorrowStart = new Date();
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      tomorrowStart.setHours(0, 0, 0, 0);

      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setHours(23, 59, 59, 999);

      // Find all confirmed appointments for tomorrow
      const appointments = await Appointment.find({
        status: "confirmed",
        appointmentDate: { $gte: tomorrowStart, $lte: tomorrowEnd }
      })
      .populate("patientId", "name email")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });

      console.log(`[Cron] Found ${appointments.length} appointments for tomorrow.`);

      for (const appt of appointments) {
        if (appt.patientId?.email) {
          try {
            await sendReminderEmail({
              patientName: appt.patientId.name,
              patientEmail: appt.patientId.email,
              doctorName: appt.doctorId?.userId?.name,
              date: appt.appointmentDate,
              time: appt.appointmentTime
            });
          } catch (mailErr) {
            console.warn(`[Cron] Failed to send reminder email to ${appt.patientId.email}:`, mailErr.message);
          }
        }
      }
    } catch (error) {
      console.error("[Cron] Reminder cron error:", error.message);
    }
  });
};
