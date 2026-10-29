# BookDoctor System Documentation & Known Limitations

## 1. Third-Party Integrations & Sandboxing
- **SMS & WhatsApp (Twilio)**:
  - When `TWILIO_ACCOUNT_SID` or `TWILIO_AUTH_TOKEN` is unset or running in testing/development environments, outgoing SMS and WhatsApp alerts are routed through the internal sandbox logger (`smsWhatsAppService.js`), logging delivery payloads safely without making live billing calls.
  - In production, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and `TWILIO_WHATSAPP_NUMBER` in the `.env` configuration.
- **Email Delivery (SMTP / Nodemailer)**:
  - When SMTP credentials are not configured, emails are logged to console stubs. In production, configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, and `EMAIL_PASS`.
- **Payment Gateway (Razorpay)**:
  - In dev and test environments, mock signatures and sandbox orders are accepted. Never pass live card credentials in test suites.

---

## 2. Medical Safety, Emergencies, & Disclaimer
- **Not for Life-Threatening Emergencies**:
  - BookDoctor's chat, symptom tracker, and RecoverTrack modules are designed for non-emergency coordination and post-discharge recovery monitoring.
  - Prominent emergency text is enforced throughout the application:
    > "This app does not replace emergency medical care. In a life-threatening emergency, immediately call Ambulance 108 or 112."
- **Rule-Based Triage & Red-Flag Detection**:
  - Emergency keyword triggers in chat (e.g., *chest pain*, *cannot breathe*, *stroke signs*, *heavy bleeding*) and symptom check-in red flags (pain $\ge 8$, wound discharge/bleeding, temperature $> 101^\circ\text{F}$) use deterministic rule-based algorithms rather than non-deterministic AI models to ensure immediate, predictable emergency alerts.

---

## 3. Quiet Hours & Safety Override
- **Quiet Hours Behavior**:
  - Configurable in user Notification Preferences (`/settings/notifications`).
  - By default, non-urgent notifications (marketing, general tips) respect user quiet hours.
  - **Critical Patient Safety Events override quiet hours unconditionally**:
    - `sos.triggered`
    - `symptom.red_flag`
    - `dose.reminder`
    - `dose.not_confirmed`

---

## 4. Appointment Policies & Notice Windows
- **Reschedule Limits**:
  - Notice Window: Patients must reschedule at least 2 hours prior to the booked slot.
  - Maximum Reschedules: An appointment can be rescheduled at most 3 times.
  - Doctor Approval: When `rescheduleApprovalRequired` is enabled on the appointment, patient reschedule requests are put into `pending_doctor_approval` until the doctor confirms or declines.

---

## 5. Offline Medical ID & Shareable Token Links
- **Offline Storage**:
  - Medical ID data is cached in client storage (`localStorage` & Service Worker) so users can access their blood group, allergies, conditions, and active medications during network dropouts or emergencies.
- **24-Hour Public Share Link**:
  - Generated emergency links (`/medical-id/share/:token`) expire after 24 hours and can be manually revoked at any time by the patient. Minimal clinical data is exposed to preserve patient privacy.
