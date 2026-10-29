import cron from "node-cron";
import Appointment from "../models/Appointment.js";
import { sendReminderEmail } from "./emailService.js";
import { dispatchNotification, EVENT_TYPES } from "../services/centralNotificationService.js";

const parseAppointmentDateTime = (appointmentDate, appointmentTime) => {
  const d = new Date(appointmentDate);
  if (appointmentTime) {
    const parts = appointmentTime.split(" ");
    const timePart = parts[0] || "00:00";
    const ampm = parts[1] ? parts[1].toUpperCase() : "";
    let [hh, mm] = timePart.split(":").map(Number);
    if (ampm === "PM" && hh < 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    d.setHours(hh || 0, mm || 0, 0, 0);
  }
  return d;
};

/**
 * Check and dispatch 24h and 1h reminders (can be called manually by tests or via cron)
 */
export const checkAndSendAppointmentReminders = async (referenceTime = new Date()) => {
  const nowMs = referenceTime.getTime();
  const summary = { reminders24h: 0, reminders1h: 0 };

  try {
    // 1. Process 24-Hour Reminders (Target appointments between 23h and 25h from now)
    const window24hStart = new Date(nowMs + 23 * 60 * 60 * 1000);
    const window24hEnd = new Date(nowMs + 25 * 60 * 60 * 1000);

    const appointments24h = await Appointment.find({
      status: "confirmed",
      reminderSent24h: false,
      appointmentDate: {
        $gte: new Date(new Date(window24hStart).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(window24hEnd).setHours(23, 59, 59, 999)),
      },
    })
      .populate("patientId", "name email phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name email phone" } });

    for (const appt of appointments24h) {
      const apptExactTime = parseAppointmentDateTime(appt.appointmentDate, appt.appointmentTime);
      const diffMs = apptExactTime.getTime() - nowMs;
      // Allow window between 22h and 26h
      if (diffMs >= 22 * 60 * 60 * 1000 && diffMs <= 26 * 60 * 60 * 1000) {
        appt.reminderSent24h = true;
        await appt.save();
        summary.reminders24h++;

        const patientId = appt.patientId?._id || appt.patientId;
        const doctorName = appt.doctorId?.userId?.name || "your doctor";

        if (patientId) {
          await dispatchNotification({
            userId: patientId,
            eventType: EVENT_TYPES.APPOINTMENT_REMINDER_24H,
            title: "Consultation Tomorrow",
            message: `Reminder: You have a scheduled appointment with Dr. ${doctorName} tomorrow at ${appt.appointmentTime}.`,
            channels: ["in_app", "email", "sms"],
            data: {
              entityType: "appointment",
              entityId: appt._id,
              deepLink: "/appointments",
              metadata: {
                doctorName: `Dr. ${doctorName}`,
                time: appt.appointmentTime,
                date: appt.appointmentDate.toISOString().split("T")[0],
              },
            },
          });
        }

        if (appt.patientId?.email) {
          try {
            await sendReminderEmail({
              patientName: appt.patientId.name,
              patientEmail: appt.patientId.email,
              doctorName,
              date: appt.appointmentDate,
              time: appt.appointmentTime,
            });
          } catch (e) {
            console.warn("[Cron] 24h email failed:", e.message);
          }
        }
      }
    }

    // 2. Process 1-Hour Reminders (Target appointments between 30m and 90m from now)
    const window1hStart = new Date(nowMs);
    const window1hEnd = new Date(nowMs + 2 * 60 * 60 * 1000);

    const appointments1h = await Appointment.find({
      status: "confirmed",
      reminderSent1h: false,
      appointmentDate: {
        $gte: new Date(new Date(window1hStart).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(window1hEnd).setHours(23, 59, 59, 999)),
      },
    })
      .populate("patientId", "name email phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name email phone" } });

    for (const appt of appointments1h) {
      const apptExactTime = parseAppointmentDateTime(appt.appointmentDate, appt.appointmentTime);
      const diffMs = apptExactTime.getTime() - nowMs;
      // Allow window between 15m and 75m
      if (diffMs >= 15 * 60 * 1000 && diffMs <= 75 * 60 * 1000) {
        appt.reminderSent1h = true;
        await appt.save();
        summary.reminders1h++;

        const patientId = appt.patientId?._id || appt.patientId;
        const doctorName = appt.doctorId?.userId?.name || "your doctor";

        if (patientId) {
          await dispatchNotification({
            userId: patientId,
            eventType: EVENT_TYPES.APPOINTMENT_REMINDER_1H,
            title: "Consultation in 1 Hour",
            message: `Your appointment with Dr. ${doctorName} starts in 1 hour at ${appt.appointmentTime}. Click to view directions or join consultation.`,
            channels: ["in_app", "email", "sms"],
            data: {
              entityType: "appointment",
              entityId: appt._id,
              deepLink: `/room/${appt._id}`,
              metadata: {
                doctorName: `Dr. ${doctorName}`,
                time: appt.appointmentTime,
              },
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("[Cron] Reminder execution error:", error.message);
  }

  return summary;
};

export const startReminderCron = () => {
  // Run every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    console.log("[Cron] Running 15-minute appointment reminder check...");
    const result = await checkAndSendAppointmentReminders();
    console.log(`[Cron] Sent reminders: 24h=${result.reminders24h}, 1h=${result.reminders1h}`);
  });
};
