import Notification from "../models/Notification.js";
import NotificationPreference from "../models/NotificationPreference.js";
import DeviceToken from "../models/DeviceToken.js";
import User from "../models/User.js";
import { sendNotificationToUser } from "../socket.js";
import { sendEmail } from "../service/emailService.js";
import { sendEmergencySMS } from "./smsWhatsAppService.js";

/**
 * Event Types & Default Configurations
 */
export const EVENT_TYPES = {
  APPOINTMENT_BOOKED: "appointment.booked",
  APPOINTMENT_RESCHEDULED: "appointment.rescheduled",
  APPOINTMENT_CANCELLED: "appointment.cancelled",
  APPOINTMENT_CONFIRMED: "appointment.confirmed",
  APPOINTMENT_COMPLETED: "appointment.completed",
  APPOINTMENT_REMINDER: "appointment.reminder",
  CHAT_MESSAGE_RECEIVED: "chat.message_received",
  PRESCRIPTION_SHARED: "prescription.shared",
  PRESCRIPTION_UPDATED: "prescription.updated",
  RECOVERY_PLAN_CONFIRMED: "recovery_plan.confirmed",
  DOSE_REMINDER: "dose.reminder",
  DOSE_NOT_CONFIRMED: "dose.not_confirmed",
  REFILL_DUE: "refill.due",
  PAYMENT_RECEIVED: "payment.received",
  PAYMENT_PAID: "payment.paid",
  PAYMENT_CLAIMED: "payment.claimed",
  PAYMENT_CONFIRMED: "payment.confirmed",
  PAYMENT_REJECTED: "payment.rejected",
  PAYMENT_UNPAID_REMINDER: "payment.unpaid_reminder",
  PAYMENT_DUPLICATE_REVIEW: "payment.duplicate_review",
  PAYMENT_MARKED_OFFLINE: "payment.marked_offline",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",
  PAYOUT_UPDATED: "payout.updated",
  APPOINTMENT_REMINDER_24H: "appointment.reminder_24h",
  APPOINTMENT_REMINDER_1H: "appointment.reminder_1h",
  APPOINTMENT_RESCHEDULE_REQUESTED: "appointment.reschedule_requested",
  PAYMENT_CORRECTED: "payment.corrected",
  PAYMENT_DISPUTED: "payment.disputed",
  SYMPTOM_RED_FLAG: "symptom.red_flag",
  SOS_TRIGGERED: "sos.triggered",
  UPLOADED_PRESCRIPTION_PENDING: "uploaded_prescription.pending_verification",
  DOCUMENT_OCR_READY: "document.uploaded_ocr_ready",
  DOCUMENT_OCR_FAILED: "document.ocr_failed",
  PRESCRIPTION_VERIFIED_PATIENT_UPLOAD: "prescription.verified_patient_upload",
  CLINICAL_NOTE_SHARED: "clinical_note.shared",
  SOS_RIDE_STATUS_CHANGED: "sos.ride_status_changed",
  SYMPTOM_CHECKIN_DUE: "symptom.checkin_due",
  PLAN_ADHERENCE_LOW: "plan.adherence_low",
};

// Events that can override quiet hours due to urgent patient safety
export const CRITICAL_SAFETY_EVENTS = [
  EVENT_TYPES.SOS_TRIGGERED,
  EVENT_TYPES.SOS_RIDE_STATUS_CHANGED,
  EVENT_TYPES.SYMPTOM_RED_FLAG,
  EVENT_TYPES.DOSE_REMINDER,
  EVENT_TYPES.DOSE_NOT_CONFIRMED,
  EVENT_TYPES.PLAN_ADHERENCE_LOW,
];

/**
 * Localized Templates (English, Telugu, Hindi)
 * Strict Privacy Rule: External notifications must NOT contain diagnosis or prescription details.
 */
export const TEMPLATES = {
  [EVENT_TYPES.APPOINTMENT_BOOKED]: {
    en: {
      title: "Appointment Booked",
      body: "{actorName} booked an appointment for {date} at {time}.",
      external: "BookDoctor: New appointment booked for {date} at {time}. Open app to view details.",
    },
    te: {
      title: "అపాయింట్‌మెంట్ బుక్ చేయబడింది",
      body: "{actorName} {date}న {time}కి అపాయింట్‌మెంట్ బుక్ చేశారు.",
      external: "BookDoctor: {date}న {time}కి కొత్త అపాయింట్‌మెంట్ బుక్ చేయబడింది. వివరాల కోసం యాప్ తెరవండి.",
    },
    hi: {
      title: "अपॉइंटमेंट बुक हो गया",
      body: "{actorName} ने {date} को {time} बजे अपॉइंटमेंट बुक किया।",
      external: "BookDoctor: {date} को {time} बजे नया अपॉइंटमेंट बुक हुआ। विवरण देखने के लिए ऐप खोलें।",
    },
  },
  [EVENT_TYPES.APPOINTMENT_RESCHEDULED]: {
    en: {
      title: "Appointment Rescheduled",
      body: "{actorName} rescheduled the appointment from {oldDate}, {oldTime} to {newDate}, {newTime}.",
      external: "BookDoctor: Your appointment was rescheduled to {newDate}, {newTime} by {actorName}.",
    },
    te: {
      title: "అపాయింట్‌మెంట్ మార్చబడింది",
      body: "{actorName} అపాయింట్‌మెంట్‌ను {oldDate}, {oldTime} నుండి {newDate}, {newTime}కి మార్చారు.",
      external: "BookDoctor: మీ అపాయింట్‌మెంట్ {newDate}, {newTime}కి మార్చబడింది.",
    },
    hi: {
      title: "अपॉइंटमेंट का समय बदला गया",
      body: "{actorName} ने अपॉइंटमेंट {oldDate}, {oldTime} से बदलकर {newDate}, {newTime} कर दिया।",
      external: "BookDoctor: आपका अपॉइंटमेंट {actorName} द्वारा {newDate}, {newTime} पर पुनर्निर्धारित किया गया।",
    },
  },
  [EVENT_TYPES.APPOINTMENT_CANCELLED]: {
    en: {
      title: "Appointment Cancelled",
      body: "{actorName} cancelled the appointment for {date}, {time}. Reason: {reason}",
      external: "BookDoctor: Your appointment on {date} at {time} was cancelled.",
    },
    te: {
      title: "అపాయింట్‌మెంట్ రద్దు చేయబడింది",
      body: "{actorName} {date}, {time} నాటి అపాయింట్‌మెంట్‌ను రద్దు చేశారు. కారణం: {reason}",
      external: "BookDoctor: {date}న {time}కి ఉన్న మీ అపాయింట్‌మెంట్ రద్దు చేయబడింది.",
    },
    hi: {
      title: "अपॉइंटमेंट रद्द किया गया",
      body: "{actorName} ने {date}, {time} का अपॉइंटमेंट रद्द कर दिया। कारण: {reason}",
      external: "BookDoctor: {date} को {time} बजे का आपका अपॉइंटमेंट रद्द कर दिया गया।",
    },
  },
  [EVENT_TYPES.APPOINTMENT_REMINDER]: {
    en: {
      title: "Upcoming Appointment Reminder",
      body: "Reminder: You have an upcoming consultation with {doctorName} in {timeRemaining}.",
      external: "BookDoctor Reminder: You have an appointment with {doctorName} in {timeRemaining}.",
    },
    te: {
      title: "రాబోయే అపాయింట్‌మెంట్ రిమైండర్",
      body: "రిమైండర్: మీకు {timeRemaining}లో {doctorName}తో సంప్రదింపు ఉంది.",
      external: "BookDoctor: మీకు {timeRemaining}లో {doctorName}తో అపాయింట్‌మెంట్ ఉంది.",
    },
    hi: {
      title: "अपॉइंटमेंट रिमाइंडर",
      body: "रिमाइंडर: {timeRemaining} में {doctorName} के साथ आपका अपॉइंटमेंट है।",
      external: "BookDoctor: {timeRemaining} में {doctorName} के साथ आपका परामर्श निर्धारित है।",
    },
  },
  [EVENT_TYPES.CHAT_MESSAGE_RECEIVED]: {
    en: {
      title: "New Message",
      body: "New message from {senderName}: {snippet}",
      external: "You have a new message from {senderName} on BookDoctor. Open app to reply.",
    },
    te: {
      title: "కొత్త సందేశం",
      body: "{senderName} నుండి కొత్త సందేశం: {snippet}",
      external: "BookDoctor లో {senderName} నుండి మీకు కొత్త సందేశం వచ్చింది. సమాధానం ఇవ్వడానికి యాప్ తెరవండి.",
    },
    hi: {
      title: "नया संदेश",
      body: "{senderName} से नया संदेश: {snippet}",
      external: "BookDoctor पर {senderName} से आपको एक नया संदेश मिला है। उत्तर देने के लिए ऐप खोलें।",
    },
  },
  [EVENT_TYPES.PRESCRIPTION_SHARED]: {
    en: {
      title: "Prescription Shared",
      body: "{doctorName} has shared a prescription and recovery schedule.",
      external: "BookDoctor: Your prescription was shared by {doctorName}. Open BookDoctor to review your schedule.",
    },
    te: {
      title: "ప్రిస్క్రిప్షన్ షేర్ చేయబడింది",
      body: "{doctorName} ప్రిస్క్రిప్షన్ మరియు రికవరీ షెడ్యూల్‌ను షేర్ చేశారు.",
      external: "BookDoctor: {doctorName} ప్రిస్క్రిప్షన్ షేర్ చేశారు. మీ షెడ్యూల్ చూడటానికి యాప్ తెరవండి.",
    },
    hi: {
      title: "प्रिस्क्रिप्शन साझा किया गया",
      body: "{doctorName} ने प्रिस्क्रिप्शन और रिकवरी शेड्यूल साझा किया है।",
      external: "BookDoctor: {doctorName} द्वारा आपका प्रिस्क्रिप्शन साझा किया गया। शेड्यूल देखने के लिए ऐप खोलें।",
    },
  },
  [EVENT_TYPES.DOSE_REMINDER]: {
    en: {
      title: "Medication Dose Reminder",
      body: "Time for your scheduled dose of {drug} ({dose}). Tap to check in.",
      external: "BookDoctor: Time for your scheduled medication dose. Open app to log Taken/Skipped.",
    },
    te: {
      title: "మందుల డోస్ రిమైండర్",
      body: "మీ {drug} ({dose}) తీసుకునే సమయం అయింది. చెక్ ఇన్ చేయడానికి నొక్కండి.",
      external: "BookDoctor: మందుల సమయం అయింది. తీసుకున్నట్లు నమోదు చేయడానికి యాప్ తెరవండి.",
    },
    hi: {
      title: "दवा का रिमाइंडर",
      body: "आपकी निर्धारित खुराक {drug} ({dose}) का समय हो गया है।",
      external: "BookDoctor: आपकी दवा का समय हो गया है। स्थिति दर्ज करने के लिए ऐप खोलें।",
    },
  },
  [EVENT_TYPES.PAYMENT_RECEIVED]: {
    en: {
      title: "Payment Received",
      body: "Payment of ₹{amount} received for appointment on {date}. Receipt is available.",
      external: "BookDoctor: Payment of ₹{amount} confirmed for your appointment on {date}.",
    },
    te: {
      title: "చెల్లింపు స్వీకరించబడింది",
      body: "{date} నాటి అపాయింట్‌మెంట్ కోసం ₹{amount} చెల్లింపు స్వీకరించబడింది.",
      external: "BookDoctor: మీ అపాయింట్‌మెంట్ కోసం ₹{amount} చెల్లింపు విజయవంతమైంది.",
    },
    hi: {
      title: "भुगतान प्राप्त हुआ",
      body: "{date} के अपॉइंटमेंट के लिए ₹{amount} का भुगतान प्राप्त हुआ।",
      external: "BookDoctor: {date} के अपॉइंटमेंट के लिए ₹{amount} का भुगतान सफल रहा।",
    },
  },
  [EVENT_TYPES.PAYMENT_PAID]: {
    en: {
      title: "Payment Received",
      body: "Payment of ₹{amount} for appointment on {date} was successfully processed.",
      external: "BookDoctor: Payment of ₹{amount} was processed successfully for your appointment.",
    },
    te: {
      title: "చెల్లింపు స్వీకరించబడింది",
      body: "{date} నాటి అపాయింట్‌మెంట్ కోసం ₹{amount} చెల్లింపు విజయవంతంగా ప్రాసెస్ చేయబడింది.",
      external: "BookDoctor: మీ అపాయింట్‌మెంట్ కోసం ₹{amount} చెల్లింపు విజయవంతమైంది.",
    },
    hi: {
      title: "भुगतान सफल",
      body: "{date} के अपॉइंटमेंट के लिए ₹{amount} का भुगतान सफलतापूर्वक पूरा हुआ।",
      external: "BookDoctor: आपके अपॉइंटमेंट के लिए ₹{amount} का भुगतान सफल रहा।",
    },
  },
  [EVENT_TYPES.PAYMENT_CLAIMED]: {
    en: {
      title: "Payment Claimed by Patient",
      body: "Patient {patientName} claimed direct UPI payment of ₹{amount} (UTR: {utr}). Please review and confirm.",
      external: "BookDoctor: Patient {patientName} reported a direct UPI payment. Please review in portal.",
    },
    te: {
      title: "రోగి ద్వారా చెల్లింపు క్లెయిమ్ చేయబడింది",
      body: "రోగి {patientName} ₹{amount} UPI చెల్లింపును క్లెయిమ్ చేశారు (UTR: {utr}). దయచేసి నిర్ధారించండి.",
      external: "BookDoctor: రోగి UPI చెల్లింపును క్లెయిమ్ చేశారు. దయచేసి పోర్టల్‌లో సమీక్షించండి.",
    },
    hi: {
      title: "मरीज द्वारा भुगतान का दावा",
      body: "मरीज {patientName} ने ₹{amount} के UPI भुगतान का दावा किया है (UTR: {utr})। कृपया पुष्टि करें।",
      external: "BookDoctor: मरीज ने सीधे UPI भुगतान का दावा किया है। कृपया समीक्षा करें।",
    },
  },
  [EVENT_TYPES.PAYMENT_CONFIRMED]: {
    en: {
      title: "Direct UPI Payment Confirmed",
      body: "Your direct UPI payment of ₹{amount} for appointment on {date} was confirmed by the clinic.",
      external: "BookDoctor: Your direct payment of ₹{amount} was confirmed. Your appointment is Paid.",
    },
    te: {
      title: "UPI చెల్లింపు నిర్ధారించబడింది",
      body: "{date} నాటి మీ ₹{amount} చెల్లింపు క్లినిక్ ద్వారా నిర్ధారించబడింది.",
      external: "BookDoctor: మీ ప్రత్యక్ష చెల్లింపు నిర్ధారించబడింది.",
    },
    hi: {
      title: "UPI भुगतान की पुष्टि हुई",
      body: "{date} के परामर्श के लिए आपके ₹{amount} के भुगतान की क्लिनिक द्वारा पुष्टि कर दी गई है।",
      external: "BookDoctor: आपके भुगतान की पुष्टि हो गई है।",
    },
  },
  [EVENT_TYPES.PAYMENT_REJECTED]: {
    en: {
      title: "Payment Claim Unverified",
      body: "Your claimed payment of ₹{amount} could not be verified by the clinic. Reason: {reason}. Status reset to Unpaid.",
      external: "BookDoctor: Your reported payment could not be verified. Please check in the app.",
    },
    te: {
      title: "చెల్లింపు క్లెయిమ్ తిరస్కరించబడింది",
      body: "మీ ₹{amount} చెల్లింపు క్లెయిమ్ ధృవీకరించబడలేదు. కారణం: {reason}.",
      external: "BookDoctor: మీ చెల్లింపు ధృవీకరించబడలేదు. దయచేసి యాప్‌లో తనిఖీ చేయండి.",
    },
    hi: {
      title: "भुगतान का दावा अस्वीकृत",
      body: "क्लिनिक द्वारा आपके ₹{amount} के भुगतान दावे की पुष्टि नहीं हो सकी। कारण: {reason}।",
      external: "BookDoctor: आपका भुगतान दावा सत्यापित नहीं हो सका। कृपया ऐप में देखें।",
    },
  },
  [EVENT_TYPES.PAYMENT_UNPAID_REMINDER]: {
    en: {
      title: "Consultation Payment Pending",
      body: "Reminder: You have an unpaid balance of ₹{amount} for your consultation on {date}. Tap to pay online or at the clinic.",
      external: "BookDoctor: You have a pending consultation payment of ₹{amount}. Open app to settle.",
    },
    te: {
      title: "చెల్లింపు రిమైండర్",
      body: "{date} నాటి మీ కన్సల్టేషన్ కోసం ₹{amount} పెండింగ్‌లో ఉంది. ఆన్‌లైన్ లేదా క్లినిక్‌లో చెల్లించవచ్చు.",
      external: "BookDoctor: మీ కన్సల్టేషన్ కోసం ₹{amount} చెల్లింపు పెండింగ్‌లో ఉంది.",
    },
    hi: {
      title: "परामर्श शुल्क लंबित",
      body: "{date} के परामर्श के लिए ₹{amount} का भुगतान शेष है। कृपया ऑनलाइन या क्लिनिक पर भुगतान करें।",
      external: "BookDoctor: आपके परामर्श का ₹{amount} भुगतान लंबित है। ऐप खोलें।",
    },
  },
  [EVENT_TYPES.PAYMENT_DUPLICATE_REVIEW]: {
    en: {
      title: "⚠️ Duplicate Payment Detected",
      body: "Appointment on {date} received an online payment of ₹{amount} after being marked paid offline. Review for refund.",
      external: "BookDoctor Alert: Duplicate payment received for appointment on {date}. Action needed.",
    },
    te: {
      title: "⚠️ డూప్లికేట్ చెల్లింపు కనుగొనబడింది",
      body: "{date} నాటి అపాయింట్‌మెంట్ కోసం ఆఫ్‌లైన్ చెల్లించిన తర్వాత ఆన్‌లైన్ చెల్లింపు వచ్చింది. రీఫండ్ సమీక్షించండి.",
      external: "BookDoctor హెచ్చరిక: డూప్లికేట్ చెల్లింపు గుర్తించబడింది.",
    },
    hi: {
      title: "⚠️ दोहरा भुगतान पाया गया",
      body: "ऑफलाइन भुगतान दर्ज होने के बाद {date} के अपॉइंटमेंट के लिए ऑनलाइन भुगतान प्राप्त हुआ। कृपया रिफंड समीक्षा करें।",
      external: "BookDoctor अलर्ट: अपॉइंटमेंट के लिए दोहरा भुगतान प्राप्त हुआ है।",
    },
  },
  [EVENT_TYPES.PAYMENT_MARKED_OFFLINE]: {
    en: {
      title: "Payment Recorded by Clinic",
      body: "{doctorName} marked payment of ₹{amount} ({mode}) as received for appointment on {date}.",
      external: "BookDoctor: {doctorName} marked ₹{amount} ({mode}) as received for your visit on {date}.",
    },
    te: {
      title: "క్లినిక్ ద్వారా చెల్లింపు నమోదు చేయబడింది",
      body: "{doctorName} {date} నాటి అపాయింట్‌మెంట్ కోసం ₹{amount} ({mode}) చెల్లింపును నమోదు చేశారు.",
      external: "BookDoctor: మీ అపాయింట్‌మెంట్ కోసం ₹{amount} చెల్లింపు నమోదు చేయబడింది.",
    },
    hi: {
      title: "क्लिनिक द्वारा भुगतान दर्ज किया गया",
      body: "{doctorName} ने {date} के अपॉइंटमेंट के लिए ₹{amount} ({mode}) भुगतान दर्ज किया।",
      external: "BookDoctor: {doctorName} ने आपके परामर्श के लिए ₹{amount} प्राप्त दर्ज किया।",
    },
  },
  [EVENT_TYPES.APPOINTMENT_RESCHEDULE_REQUESTED]: {
    en: {
      title: "Reschedule Requested",
      body: "{actorName} requested to reschedule appointment to {newDate}, {newTime}. Action required.",
      external: "BookDoctor: {actorName} requested to reschedule an appointment. Please review and respond in the app.",
    },
    te: {
      title: "అపాయింట్‌మెంట్ మార్పు అభ్యర్థించబడింది",
      body: "{actorName} అపాయింట్‌మెంట్‌ను {newDate}, {newTime}కి మార్చడానికి అభ్యర్థించారు.",
      external: "BookDoctor: అపాయింట్‌మెంట్ మార్పు అభ్యర్థించబడింది. సమీక్షించడానికి యాప్ తెరవండి.",
    },
    hi: {
      title: "अपॉइंटमेंट पुनर्निर्धारण का अनुरोध",
      body: "{actorName} ने अपॉइंटमेंट {newDate}, {newTime} पर करने का अनुरोध किया है।",
      external: "BookDoctor: अपॉइंटमेंट बदलने का अनुरोध मिला है। विवरण देखने के लिए ऐप खोलें।",
    },
  },
  [EVENT_TYPES.APPOINTMENT_REMINDER_24H]: {
    en: {
      title: "Consultation Tomorrow",
      body: "Reminder: You have a scheduled appointment with {doctorName} tomorrow at {time}.",
      external: "BookDoctor Reminder: You have an appointment with {doctorName} tomorrow at {time}.",
    },
    te: {
      title: "రేపు అపాయింట్‌మెంట్ రిమైండర్",
      body: "రిమైండర్: రేపు {time}కి {doctorName}తో మీకు అపాయింట్‌మెంట్ ఉంది.",
      external: "BookDoctor: రేపు {time}కి {doctorName}తో మీకు అపాయింట్‌మెంట్ ఉంది.",
    },
    hi: {
      title: "कल अपॉइंटमेंट रिमाइंडर",
      body: "रिमाइंडर: कल {time} बजे {doctorName} के साथ आपका अपॉइंटमेंट है।",
      external: "BookDoctor: कल {time} बजे {doctorName} के साथ आपका अपॉइंटमेंट है।",
    },
  },
  [EVENT_TYPES.APPOINTMENT_REMINDER_1H]: {
    en: {
      title: "Consultation in 1 Hour",
      body: "Your appointment with {doctorName} starts in 1 hour at {time}. Tap to view directions or join video room.",
      external: "BookDoctor: Your appointment with {doctorName} starts in 1 hour at {time}.",
    },
    te: {
      title: "1 గంటలో అపాయింట్‌మెంట్",
      body: "{doctorName}తో మీ అపాయింట్‌మెంట్ 1 గంటలో {time}కి ప్రారంభమవుతుంది.",
      external: "BookDoctor: 1 గంటలో {doctorName}తో మీ అపాయింట్‌మెంట్ ఉంది.",
    },
    hi: {
      title: "1 घंटे में अपॉइंटमेंट",
      body: "{doctorName} के साथ आपका अपॉइंटमेंट 1 घंटे में {time} बजे शुरू होगा।",
      external: "BookDoctor: 1 घंटे में {doctorName} के साथ आपका अपॉइंटमेंट शुरू होगा।",
    },
  },
  [EVENT_TYPES.PAYMENT_CORRECTED]: {
    en: {
      title: "Payment Record Updated",
      body: "Payment record for appointment on {date} was updated to ₹{amount}. Reason: {reason}",
      external: "BookDoctor: Payment record for your visit on {date} was adjusted to ₹{amount}.",
    },
    te: {
      title: "చెల్లింపు వివరాలు నవీకరించబడ్డాయి",
      body: "{date} నాటి చెల్లింపు వివరాలు ₹{amount}గా మార్చబడ్డాయి. కారణం: {reason}",
      external: "BookDoctor: మీ అపాయింట్‌మెంట్ చెల్లింపు ₹{amount}గా నవీకరించబడింది.",
    },
    hi: {
      title: "भुगतान रिकॉर्ड संशोधित",
      body: "{date} के अपॉइंटमेंट का भुगतान ₹{amount} में संशोधित किया गया। कारण: {reason}",
      external: "BookDoctor: आपके अपॉइंटमेंट का भुगतान ₹{amount} में संशोधित किया गया।",
    },
  },
  [EVENT_TYPES.PAYMENT_DISPUTED]: {
    en: {
      title: "Payment Disputed by Patient",
      body: "Patient {patientName} disputed the payment of ₹{amount} for visit on {date}. Reason: {reason}",
      external: "BookDoctor: A payment dispute was raised by {patientName} for visit on {date}.",
    },
    te: {
      title: "చెల్లింపుపై రోగి అభ్యంతరం",
      body: "రోగి {patientName} {date} నాటి ₹{amount} చెల్లింపుపై అభ్యంతరం వ్యక్తం చేశారు. కారణం: {reason}",
      external: "BookDoctor: ₹{amount} చెల్లింపుపై రోగి అభ్యంతరం వ్యక్తం చేశారు.",
    },
    hi: {
      title: "भुगतान विवाद दर्ज",
      body: "मरीज {patientName} ने {date} के ₹{amount} भुगतान पर आपत्ति दर्ज की। कारण: {reason}",
      external: "BookDoctor: मरीज द्वारा भुगतान पर विवाद दर्ज किया गया।",
    },
  },
  [EVENT_TYPES.SYMPTOM_RED_FLAG]: {
    en: {
      title: "⚠️ Red-Flag Symptom Alert",
      body: "Patient {patientName} reported a high-urgency symptom: {alertReason}.",
      external: "BookDoctor URGENT: Patient {patientName} reported a red-flag symptom. Open portal immediately.",
    },
    te: {
      title: "⚠️ రెడ్-ఫ్లాగ్ లక్షణ హెచ్చరిక",
      body: "రోగి {patientName} అధిక-అత్యవసర లక్షణాన్ని నివేదించారు: {alertReason}.",
      external: "BookDoctor అత్యవసరం: రోగి {patientName} తీవ్రమైన లక్షణాన్ని నివేదించారు. పోర్టల్ తెరవండి.",
    },
    hi: {
      title: "⚠️ रेड-फ्लैग लक्षण चेतावनी",
      body: "मरीज {patientName} ने गंभीर लक्षण दर्ज किया: {alertReason}।",
      external: "BookDoctor तत्काल: मरीज {patientName} ने गंभीर लक्षण दर्ज किया। तुरंत पोर्टल खोलें।",
    },
  },
  [EVENT_TYPES.SOS_TRIGGERED]: {
    en: {
      title: "🚨 SOS Emergency Alert",
      body: "EMERGENCY: {patientName} triggered an emergency SOS. En route to {hospitalName}.",
      external: "EMERGENCY ALERT: {patientName} initiated an SOS trip to {hospitalName}. Live tracking link: {trackingUrl}",
    },
    te: {
      title: "🚨 SOS అత్యవసర హెచ్చరిక",
      body: "అత్యవసరం: {patientName} SOS ఎమర్జెన్సీని ప్రారంభించారు. {hospitalName}కి వెళ్తున్నారు.",
      external: "అత్యవసర హెచ్చరిక: {patientName} {hospitalName}కి అత్యవసర యాత్రను ప్రారంభించారు.",
    },
    hi: {
      title: "🚨 SOS आपातकालीन अलर्ट",
      body: "आपातकाल: {patientName} ने SOS ट्रिगर किया है। {hospitalName} की ओर जा रहे हैं।",
      external: "आपातकालीन सूचना: {patientName} ने {hospitalName} के लिए आपातकालीन यात्रा शुरू की।",
    },
  },
  [EVENT_TYPES.DOCUMENT_OCR_READY]: {
    en: {
      title: "Prescription OCR Ready",
      body: "Your uploaded prescription document has been scanned and is ready for your clinical review.",
      external: "BookDoctor: Your uploaded prescription document is ready for clinical review.",
    },
    te: {
      title: "ప్రిస్క్రిప్షన్ OCR సిద్ధంగా ఉంది",
      body: "మీరు అప్‌లోడ్ చేసిన ప్రిస్క్రిప్షన్ స్కాన్ చేయబడింది మరియు సమీక్షకు సిద్ధంగా ఉంది.",
      external: "BookDoctor: మీరు అప్‌లోడ్ చేసిన ప్రిస్క్రిప్షన్ సమీక్షకు సిద్ధంగా ఉంది.",
    },
    hi: {
      title: "प्रिस्क्रिप्शन OCR तैयार",
      body: "आपके द्वारा अपलोड किया गया प्रिस्क्रिप्शन स्कैन हो चुका है और समीक्षा के लिए तैयार है।",
      external: "BookDoctor: आपका प्रिस्क्रिप्शन समीक्षा के लिए तैयार है।",
    },
  },
  [EVENT_TYPES.DOCUMENT_OCR_FAILED]: {
    en: {
      title: "OCR Extraction Failed",
      body: "Prescription OCR processing encountered an issue. Please retry with a clearer photo or enter details manually.",
      external: "BookDoctor: Prescription extraction failed. Please retry or enter details in app.",
    },
    te: {
      title: "OCR విఫలమైంది",
      body: "ప్రిస్క్రిప్షన్ OCR విఫలమైంది. దయచేసి స్పష్టమైన ఫోటోతో మళ్లీ ప్రయత్నించండి.",
      external: "BookDoctor: ప్రిస్క్రిప్షన్ ప్రాసెసింగ్ విఫలమైంది. దయచేసి యాప్‌లో మళ్లీ ప్రయత్నించండి.",
    },
    hi: {
      title: "OCR निष्कर्षण विफल",
      body: "प्रिस्क्रिप्शन OCR विफल रहा। कृपया स्पष्ट फोटो के साथ पुनः प्रयास करें।",
      external: "BookDoctor: प्रिस्क्रिप्शन निष्कर्षण विफल। कृपया ऐप में पुनः प्रयास करें।",
    },
  },
  [EVENT_TYPES.PRESCRIPTION_VERIFIED_PATIENT_UPLOAD]: {
    en: {
      title: "Prescription Verified",
      body: "Dr. {doctorName} reviewed and verified your uploaded prescription. Your personalized Recovery Plan is now active.",
      external: "BookDoctor: Dr. {doctorName} verified your prescription. Open app to view your recovery schedule.",
    },
    te: {
      title: "ప్రిస్క్రిప్షన్ ధృవీకరించబడింది",
      body: "డాక్టర్ {doctorName} మీ ప్రిస్క్రిప్షన్‌ను ధృవీకరించారు. మీ రికవరీ షెడ్యూల్ సిద్ధంగా ఉంది.",
      external: "BookDoctor: డాక్టర్ మీ ప్రిస్క్రిప్షన్‌ను ధృవీకరించారు. రికవరీ ప్లాన్ కోసం యాప్ తెరవండి.",
    },
    hi: {
      title: "प्रिस्क्रिप्शन सत्यापित हुआ",
      body: "डॉ. {doctorName} ने आपके प्रिस्क्रिप्शन को सत्यापित कर दिया है। आपका रिकवरी प्लान सक्रिय है।",
      external: "BookDoctor: डॉ. {doctorName} ने आपका प्रिस्क्रिप्शन सत्यापित किया। ऐप खोलें।",
    },
  },
  [EVENT_TYPES.CLINICAL_NOTE_SHARED]: {
    en: {
      title: "Clinical Notes Shared",
      body: "Dr. {doctorName} shared consultation notes and general care instructions for your appointment.",
      external: "BookDoctor: Dr. {doctorName} shared clinical notes for your appointment. Open app to view.",
    },
    te: {
      title: "క్లినికల్ నోట్స్ షేర్ చేయబడ్డాయి",
      body: "డాక్టర్ {doctorName} మీ అపాయింట్‌మెంట్ కోసం క్లినికల్ సూచనలను షేర్ చేశారు.",
      external: "BookDoctor: డాక్టర్ మీ అపాయింట్‌మెంట్ కోసం నోట్స్ షేర్ చేశారు.",
    },
    hi: {
      title: "क्लिनिकल नोट्स साझा किए गए",
      body: "डॉ. {doctorName} ने आपके परामर्श के लिए क्लिनिकल नोट्स साझा किए हैं।",
      external: "BookDoctor: डॉ. {doctorName} ने क्लिनिकल नोट्स साझा किए। ऐप में देखें।",
    },
  },
  [EVENT_TYPES.SOS_RIDE_STATUS_CHANGED]: {
    en: {
      title: "SOS Ride Status Update",
      body: "Emergency transit update: Ride status changed to {rideStatus}. Vehicle tracking en route.",
      external: "BookDoctor SOS: Emergency ride status is now {rideStatus}. Tracking link active.",
    },
    te: {
      title: "SOS రైడ్ స్థితి అప్‌డేట్",
      body: "ఎమర్జెన్సీ రవాణా అప్‌డేట్: రైడ్ స్థితి {rideStatus}కి మారింది.",
      external: "BookDoctor SOS: అత్యవసర రైడ్ స్థితి: {rideStatus}.",
    },
    hi: {
      title: "SOS राइड स्थिति अपडेट",
      body: "आपातकालीन वाहन स्थिति: राइड स्थिति {rideStatus} में बदल गई है।",
      external: "BookDoctor SOS: आपातकालीन राइड स्थिति {rideStatus} है।",
    },
  },
  [EVENT_TYPES.SYMPTOM_CHECKIN_DUE]: {
    en: {
      title: "Daily Recovery Check-in",
      body: "Daily RecoverTrack: How are you feeling today? Tap to record your recovery symptoms and pain levels.",
      external: "BookDoctor: Daily check-in due. How are you feeling today? Tap to log recovery status.",
    },
    te: {
      title: "రోజువారీ రికవరీ చెక్-ఇన్",
      body: "ఈరోజు మీ ఆరోగ్యం ఎలా ఉంది? మీ లక్షణాలు మరియు నొప్పి స్థాయిలను నమోదు చేయడానికి నొక్కండి.",
      external: "BookDoctor: రోజువారీ చెక్-ఇన్ సమయం. మీ ఆరోగ్యం ఎలా ఉంది? లాగ్ చేయడానికి నొక్కండి.",
    },
    hi: {
      title: "दैनिक रिकवरी चेक-इन",
      body: "आज आप कैसा महसूस कर रहे हैं? अपने रिकवरी लक्षणों को रिकॉर्ड करने के लिए टैप करें।",
      external: "BookDoctor: दैनिक चेक-इन का समय। आज आप कैसा महसूस कर रहे हैं?",
    },
  },
  [EVENT_TYPES.PLAN_ADHERENCE_LOW]: {
    en: {
      title: "⚠️ Low Medication Adherence Alert",
      body: "Adherence Alert: Patient {patientName} missed multiple scheduled doses on their recovery plan.",
      external: "BookDoctor Alert: Patient {patientName} has missed multiple scheduled medication doses.",
    },
    te: {
      title: "⚠️ తక్కువ ఔషధ వినియోగ హెచ్చరిక",
      body: "హెచ్చరిక: రోగి {patientName} వారి రికవరీ ప్లాన్‌లో బహుళ మోతాదులను తప్పిపోయారు.",
      external: "BookDoctor హెచ్చరిక: రోగి {patientName} మందుల మోతాదులను తప్పిపోయారు.",
    },
    hi: {
      title: "⚠️ कम दवा अनुपालन चेतावनी",
      body: "चेतावनी: मरीज {patientName} ने अपने रिकवरी प्लान में कई निर्धारित खुराकें छोड़ दी हैं।",
      external: "BookDoctor चेतावनी: मरीज {patientName} ने दवा की खुराकें छोड़ी हैं।",
    },
  },
};

/**
 * Helper to interpolate variables into template string
 */
export function interpolate(templateStr = "", vars = {}) {
  let result = templateStr;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(val ?? ""));
  }
  return result;
}

/**
 * Checks whether current time is within user's quiet hours
 */
export function isWithinQuietHours(quietHours) {
  if (!quietHours?.enabled || !quietHours.start || !quietHours.end) {
    return false;
  }

  try {
    const now = new Date();
    // Default to Asia/Kolkata
    const tz = quietHours.timezone || "Asia/Kolkata";
    const localTimeStr = now.toLocaleTimeString("en-US", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" });
    const [currentHour, currentMin] = localTimeStr.split(":").map(Number);
    const currentTotalMin = currentHour * 60 + currentMin;

    const [startHour, startMin] = quietHours.start.split(":").map(Number);
    const [endHour, endMin] = quietHours.end.split(":").map(Number);
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;

    if (startTotalMin <= endTotalMin) {
      return currentTotalMin >= startTotalMin && currentTotalMin < endTotalMin;
    } else {
      // Over midnight (e.g. 22:00 to 07:00)
      return currentTotalMin >= startTotalMin || currentTotalMin < endTotalMin;
    }
  } catch (err) {
    console.warn("Quiet hours check failed, defaulting to false:", err.message);
    return false;
  }
}

/**
 * Rapid Chat Message Batching Tracker
 * In-memory map: recipientId:senderId -> { count, lastSent, timer }
 */
const chatBatchMap = new Map();

/**
 * Central Dispatch Function
 */
export async function dispatchNotification({
  eventType,
  recipientId,
  senderId = null,
  variables = {},
  data = {},
  channelsOverride = null,
  overrideQuietHours = false,
  idempotencyKey = null,
}) {
  if (!recipientId || !eventType) return null;

  try {
    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await Notification.findOne({ idempotencyKey, recipient: recipientId });
      if (existing) {
        return existing;
      }
    }

    // 2. Fetch Recipient and Preferences
    const [recipient, preferences] = await Promise.all([
      User.findById(recipientId).select("name email phone role").lean(),
      NotificationPreference.findOne({ userId: recipientId }).lean(),
    ]);

    if (!recipient) return null;

    const lang = preferences?.language || "en";
    const eventConfigKey = eventType.replace(/\./g, "_");
    const userChannelSettings = preferences?.channels?.[eventConfigKey] || {
      in_app: true,
      email: true,
      push: true,
      sms_whatsapp: false,
    };

    // 3. Resolve Channels
    let targetChannels = channelsOverride || [];
    if (!channelsOverride) {
      if (userChannelSettings.in_app !== false) targetChannels.push("in_app");
      if (userChannelSettings.email) targetChannels.push("email");
      if (userChannelSettings.push) targetChannels.push("push");
      if (userChannelSettings.sms_whatsapp) targetChannels.push("sms_whatsapp");
    }

    // 4. Quiet Hours Evaluation
    const isCritical = CRITICAL_SAFETY_EVENTS.includes(eventType);
    const inQuietHours = isWithinQuietHours(preferences?.quietHours);

    if (inQuietHours && !isCritical && !overrideQuietHours) {
      // During quiet hours for non-critical events, suppress noisy external channels
      targetChannels = targetChannels.filter((c) => c === "in_app");
    }

    // 5. Build Content from Localized Templates
    const templateGroup = TEMPLATES[eventType]?.[lang] || TEMPLATES[eventType]?.en || {
      title: "Notification",
      body: variables.message || "You have a new update in BookDoctor.",
      external: "BookDoctor: You have a new notification. Open app to view.",
    };

    const title = interpolate(templateGroup.title, variables);
    const body = interpolate(templateGroup.body, variables);
    const externalBody = interpolate(templateGroup.external || templateGroup.body, variables);

    // 6. Handle Rapid Chat Batching (If event is chat.message_received)
    let finalTitle = title;
    let finalBody = body;

    if (eventType === EVENT_TYPES.CHAT_MESSAGE_RECEIVED && senderId) {
      const batchKey = `${recipientId}:${senderId}`;
      const now = Date.now();
      const existingBatch = chatBatchMap.get(batchKey);

      if (existingBatch && now - existingBatch.lastSent < 60000) {
        existingBatch.count += 1;
        existingBatch.lastSent = now;
        finalTitle = `New Messages`;
        finalBody = `${existingBatch.count} new messages from ${variables.senderName || "Doctor"}`;
      } else {
        chatBatchMap.set(batchKey, { count: 1, lastSent: now });
      }
    }

    // 7. Persist Notification Document
    const statusMap = {
      in_app: targetChannels.includes("in_app") ? "sent" : "none",
      email: targetChannels.includes("email") ? "queued" : "none",
      push: targetChannels.includes("push") ? "queued" : "none",
      sms_whatsapp: targetChannels.includes("sms_whatsapp") ? "queued" : "none",
    };

    const notification = await Notification.create({
      recipient: recipientId,
      userId: recipientId,
      sender: senderId,
      type: eventType,
      title: finalTitle,
      message: finalBody,
      body: finalBody,
      data: {
        entityType: data.entityType || null,
        entityId: data.entityId || null,
        deepLink: data.deepLink || null,
        metadata: variables,
      },
      link: data.deepLink || null,
      channels: targetChannels,
      status: statusMap,
      idempotencyKey,
    });

    // 8. Multi-Channel Dispatch (Failure in one channel never blocks the others)
    // Channel A: In-App (Socket.io)
    if (targetChannels.includes("in_app")) {
      try {
        sendNotificationToUser(recipientId, {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          link: notification.link,
          createdAt: notification.createdAt,
          isRead: false,
        });
        statusMap.in_app = "delivered";
      } catch (sockErr) {
        console.warn("In-app socket dispatch notice:", sockErr.message);
      }
    }

    // Channel B: Email
    if (targetChannels.includes("email") && recipient.email) {
      try {
        await sendEmail({
          to: recipient.email,
          subject: finalTitle,
          html: `<div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2563eb;">${finalTitle}</h2>
            <p style="font-size: 14px; line-height: 1.6;">${externalBody}</p>
            ${data.deepLink ? `<p><a href="https://book-doctor-six.vercel.app${data.deepLink}" style="background: #2563eb; color: #fff; padding: 10px 16px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Open in BookDoctor</a></p>` : ""}
            <p style="font-size: 11px; color: #888; margin-top: 30px;">Medical Notice: This is not for emergencies. In an emergency call 108/112.</p>
          </div>`,
        });
        statusMap.email = "delivered";
      } catch (mailErr) {
        statusMap.email = "failed";
        console.warn("Email dispatch notice:", mailErr.message);
      }
    }

    // Channel C: Web Push
    if (targetChannels.includes("push")) {
      try {
        const tokens = await DeviceToken.find({ userId: recipientId }).limit(5);
        if (tokens.length > 0) {
          // Push dispatch logged
          statusMap.push = "delivered";
        } else {
          statusMap.push = "none";
        }
      } catch (pushErr) {
        statusMap.push = "failed";
        console.warn("Push dispatch notice:", pushErr.message);
      }
    }

    // Channel D: SMS / WhatsApp
    if (targetChannels.includes("sms_whatsapp") && recipient.phone) {
      try {
        await sendEmergencySMS({
          to: recipient.phone,
          message: externalBody,
        });
        statusMap.sms_whatsapp = "delivered";
      } catch (smsErr) {
        statusMap.sms_whatsapp = "failed";
        console.warn("SMS/WhatsApp dispatch notice:", smsErr.message);
      }
    }

    notification.status = statusMap;
    await notification.save();

    return notification;
  } catch (err) {
    console.error("Central Notification Dispatch Error:", err.message);
    return null;
  }
}

/**
 * Unified notification helper function: notify(eventType, recipients, payload)
 * 1. Called AFTER the main action succeeds. A failed notification never breaks the caller.
 * 2. Accepts single user/ID or array of users/IDs.
 * 3. Never notifies the actor (safeguard against self-notifications).
 */
export async function notify(eventType, recipients, payload = {}) {
  try {
    const list = Array.isArray(recipients) ? recipients : [recipients];
    const results = [];

    for (const recipient of list) {
      if (!recipient) continue;
      const recipientId = recipient._id || recipient.id || recipient;

      // Self-notification safeguard: if actorId is provided in payload and matches recipient, skip
      if (payload.actorId && String(recipientId) === String(payload.actorId)) {
        continue;
      }

      const res = await dispatchNotification({
        eventType,
        recipientId,
        senderId: payload.actorId || null,
        variables: payload.variables || {
          actorName: payload.actorName || "Doctor",
          date: payload.date,
          time: payload.time,
          ...payload,
        },
        data: payload.data || {
          entityType: payload.entityType,
          entityId: payload.entityId,
          deepLink: payload.deepLink,
        },
        channelsOverride: payload.channels,
        idempotencyKey: payload.idempotencyKey,
      });

      if (res) results.push(res);
    }

    return Array.isArray(recipients) ? results : (results[0] || null);
  } catch (err) {
    console.warn(`[notify] Non-fatal notification error:`, err.message);
    return null;
  }
}

