import mongoose from "mongoose";

const channelSettingSchema = new mongoose.Schema(
  {
    in_app: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms_whatsapp: { type: Boolean, default: false },
  },
  { _id: false }
);

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    language: {
      type: String,
      enum: ["en", "te", "hi"],
      default: "en",
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: "22:00" }, // 24-hr format (e.g. 22:00)
      end: { type: String, default: "07:00" },   // 24-hr format (e.g. 07:00)
      timezone: { type: String, default: "Asia/Kolkata" },
    },
    // Channels per event category
    channels: {
      appointment_booked: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: true }) },
      appointment_rescheduled: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: true }) },
      appointment_cancelled: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: true }) },
      appointment_reminder: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: true }) },
      chat_message_received: { type: channelSettingSchema, default: () => ({ in_app: true, email: false, push: true, sms_whatsapp: false }) },
      prescription_shared: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: false }) },
      recovery_plan_confirmed: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: false }) },
      dose_reminder: { type: channelSettingSchema, default: () => ({ in_app: true, email: false, push: true, sms_whatsapp: true }) },
      dose_not_confirmed: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: true }) },
      refill_due: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: false }) },
      payment_received: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: true }) },
      payment_marked_offline: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: true }) },
      payment_failed: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: true }) },
      payment_refunded: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: true }) },
      symptom_red_flag: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: true }) },
      sos_triggered: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: true }) },
      uploaded_prescription_pending: { type: channelSettingSchema, default: () => ({ in_app: true, email: true, push: true, sms_whatsapp: false }) },
    },
  },
  { timestamps: true }
);

export default mongoose.model("NotificationPreference", notificationPreferenceSchema);
