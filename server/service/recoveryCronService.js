import cron from "node-cron";
import DoseEvent from "../models/DoseEvent.js";
import CaregiverLink from "../models/CaregiverLink.js";
import User from "../models/User.js";
import { createNotification } from "../services/notificationService.js";

export const startRecoveryCron = () => {
  // Check every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const tenMinutesAhead = new Date(now.getTime() + 10 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    try {
      // 1. Initial dose reminders: due now, reminderCount === 0
      const dueDoses = await DoseEvent.find({
        status: "scheduled",
        reminderCount: 0,
        scheduledAt: { $gte: tenMinutesAgo, $lte: tenMinutesAhead },
      }).limit(50);

      for (const dose of dueDoses) {
        await createNotification({
          recipient: dose.patientId,
          title: "Medication Reminder",
          message: `Time for your dose of ${dose.drug} (${dose.dose}${dose.instructions ? ` - ${dose.instructions}` : ""}). Tap to check in.`,
          type: "DOSE_REMINDER",
          link: "/recovery-plan",
        });

        dose.reminderCount = 1;
        dose.reminderSentAt = new Date();
        await dose.save();
      }

      // 2. 30-minute follow-up reminder: scheduled > 30m ago, reminderCount === 1
      const followUpDoses = await DoseEvent.find({
        status: "scheduled",
        reminderCount: 1,
        scheduledAt: { $lte: thirtyMinutesAgo, $gt: twoHoursAgo },
      }).limit(50);

      for (const dose of followUpDoses) {
        await createNotification({
          recipient: dose.patientId,
          title: "Gentle Dose Reminder",
          message: `Did you take your dose of ${dose.drug} scheduled for ${dose.scheduledTime}? Please update your check-in.`,
          type: "DOSE_REMINDER",
          link: "/recovery-plan",
        });

        dose.reminderCount = 2;
        await dose.save();
      }

      // 3. 2-hour timeout: mark not_confirmed and notify caregiver if active
      const timedOutDoses = await DoseEvent.find({
        status: "scheduled",
        scheduledAt: { $lte: twoHoursAgo },
      }).limit(50);

      for (const dose of timedOutDoses) {
        dose.status = "not_confirmed";
        dose.method = "system_timeout";
        await dose.save();

        // Check for active caregivers
        const caregiverLinks = await CaregiverLink.find({
          patientId: dose.patientId,
          status: "active",
          "permissions.receiveAlerts": true,
        });

        if (caregiverLinks.length > 0) {
          const patient = await User.findById(dose.patientId).select("name");
          const patientName = patient?.name || "The patient";

          for (const link of caregiverLinks) {
            if (link.caregiverId) {
              await createNotification({
                recipient: link.caregiverId,
                title: "Unconfirmed Medication Dose",
                message: `${patientName} has an unconfirmed dose of ${dose.drug} scheduled for ${dose.scheduledTime}.`,
                type: "CAREGIVER_ALERT",
                link: `/recovery-plan?caregiverFor=${dose.patientId}`,
              });
            }
          }
          dose.caregiverNotifiedAt = new Date();
          await dose.save();
        }
      }
    } catch (err) {
      console.error("[RecoveryCron] Error processing medication reminders:", err.message);
    }
  });
};
