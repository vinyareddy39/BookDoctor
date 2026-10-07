# MedAssist – Clinic Operations & Patient Care Portal
## Complete API Reference Documentation

This document describes all REST API endpoints, Role-Based Access Control (RBAC) permissions, request/response contracts, and environment variable requirements for **MedAssist**.

---

## 🔐 1. Authentication & Session Architecture

All protected endpoints require either a Bearer JWT token in the `Authorization` header (`Bearer <access_token>`) or an HTTP-only secure cookie.

### Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register a new user (`patient` or `doctor`) |
| `POST` | `/api/auth/login` | Public | Authenticate user, returns Access Token + Refresh Token |
| `POST` | `/api/auth/refresh-token` | Public | Rotate refresh token and issue new access token |
| `POST` | `/api/auth/logout` | Authenticated | Revoke current device session token |
| `POST` | `/api/auth/logout-all` | Authenticated | Revoke all active sessions across all devices |
| `GET` | `/api/auth/sessions` | Authenticated | List all active sessions for current user |
| `DELETE` | `/api/auth/sessions/:id` | Authenticated | Revoke a specific active device session |

---

## 👥 2. RBAC & System Roles

MedAssist enforces 5 core roles via central RBAC middleware:

| Role | Core Responsibilities | Access Boundaries |
| :--- | :--- | :--- |
| `clinic_admin` | Medical Director, clinic config, master audit log, user management, billing refund/void | Superuser across all clinic resources |
| `doctor` | Consultations, EMR SOAP notes, diagnoses, prescriptions, lab ordering | Scoped strictly to assigned patients |
| `receptionist` | Walk-in registration with auto-generated MRN, queue management, counter payments | **Strictly blocked** from reading/editing clinical notes |
| `lab_technician` | Specimen intake, diagnostic test entry, results verification | **Strictly blocked** from clinical notes; subject to dual-verifier check |
| `patient` | Telemedicine, appointments, viewing released lab reports, prescriptions, follow-ups | Scoped strictly to self and registered dependents |

---

## 🏥 3. Clinic Configuration & Master Catalog (Phase 2)

### Clinic Settings
- `GET /api/clinic`: Returns clinic metadata, working hours, billing/tax settings. (All roles)
- `PUT /api/clinic`: Update clinic configuration, tax rates, working hours. (`clinic_admin`)

### Departments & Services
- `GET /api/departments`: List active clinic departments with filter & search. (All roles)
- `POST /api/departments`: Create department. (`clinic_admin`)
- `PUT /api/departments/:id`: Update department details. (`clinic_admin`)
- `GET /api/services`: Catalog of billable clinic services. (All roles)
- `POST /api/services`: Create service with pricing and duration. (`clinic_admin`)
- `PUT /api/services/:id`: Update service item. (`clinic_admin`)

### Patient Registration & Walk-In Intake
- `POST /api/patients/walk-in`: Front-desk registration for walk-in patients. (`receptionist`, `clinic_admin`)
  - Auto-assigns MRN: `MED-YYYY-XXXXX`
  - Body: `{ name, phone, email, gender, age, street, city, state, postalCode, dependents[] }`
- `GET /api/patients`: Paginated patient directory with search by name, phone, or MRN. (`receptionist`, `doctor`, `clinic_admin`)

---

## 📅 4. Appointments, Calendar & Queue (Phase 3)

### Appointments
- `GET /api/appointments`: Paginated appointment list with status, date, doctor filters.
- `POST /api/appointments`: Schedule appointment with conflict detection & doctor leave checks.
  - Detects overlapping slot collisions (double-booking).
  - Detects doctor approved leaves and blocked slots.
- `PATCH /api/appointments/:id/reschedule`: Reschedule appointment to a new date/time.
- `PATCH /api/appointments/:id/cancel`: Cancel appointment with required cancellation reason.
- `PATCH /api/appointments/:id/no-show`: Mark patient as no-show.

### Doctor Availability & Leave Management
- `GET /api/schedule/leaves`: List doctor leave requests.
- `POST /api/schedule/leaves`: Submit doctor leave exception.
- `PATCH /api/schedule/leaves/:id/approve`: Approve leave exception (`clinic_admin`).

### Walk-In Token Queue
- `GET /api/queue`: Real-time queue worklist with token numbers (`T-001`).
- `POST /api/queue`: Generate token for arrival/walk-in. (`receptionist`)
- `PATCH /api/queue/:id/status`: Transitions: `waiting` ➔ `called` ➔ `in_consultation` ➔ `completed`.
  - Broadcasts live Web Audio chimes and state updates via Socket.io.

---

## 🩺 5. Electronic Medical Records (EMR) (Phase 4)

### Structured SOAP Notes
- `GET /api/emr/notes?patientId=...`: Scoped clinical notes list with version history.
- `POST /api/emr/notes`: Author draft or sign SOAP clinical note.
  - Vitals: BP, HR, Temp, RR, SpO2, Weight, Height, auto-calculated BMI.
  - SOAP sections: Chief complaint, HPI, Physical exam, Assessment, Plan.
  - Signed notes become tamper-proof and locked.
- `POST /api/emr/notes/:id/amend`: Creates a new immutable version (`v2`, `v3`) with mandatory rationale.

### Prescriptions & Diagnoses
- `GET /api/emr/prescriptions?patientId=...`: Prescription list.
- `POST /api/emr/prescriptions`: Issue versioned electronic prescription with itemized medicines, dosages, frequencies, and durations.
- `POST /api/emr/diagnoses`: Record ICD-coded problem list item.
- `PUT /api/emr/diagnoses/:id`: Toggle diagnosis status (`active`, `resolved`, `chronic`).

### Follow-Ups
- `POST /api/emr/follow-ups`: Doctor schedules recommended follow-up date and plan.
- `PATCH /api/emr/follow-ups/:id/request`: Patient requests booking on preferred date.
- `PATCH /api/emr/follow-ups/:id/approve`: Doctor/Clinic approves requested follow-up.

---

## 🧪 6. Diagnostic Laboratory Workflow (Phase 5)

### Status Flow
`ordered` ➔ `sample_collected` ➔ `processing` ➔ `result_entered` ➔ `verified` ➔ `released`

### Dual-Verifier Enforcement
- Technicians enter parameter values, units, reference ranges, and abnormal flags (`result_entered`).
- A **second distinct technician** (`verifier != entry user`) must inspect and verify (`verified`).
- Pathologist/Doctor authorizes release (`released`).
- **Patient Result Masking**: Parameters are withheld from patient responses until status is `released`.

### Endpoints
- `GET /api/lab/orders`: Diagnostic worklist filtered by priority and status.
- `POST /api/lab/orders`: Requisition new lab panel. (`doctor`, `clinic_admin`)
- `PATCH /api/lab/orders/:id/status`: Advance specimen lifecycle stage.
- `POST /api/lab/orders/:id/results`: Technicians enter parameter findings.
- `PATCH /api/lab/orders/:id/verify`: Dual-verifier authorization.
- `PATCH /api/lab/orders/:id/release`: Doctor release to patient portal.

---

## 💳 7. Invoicing & Billing (Phase 6)

### Endpoints
- `GET /api/billing/invoices`: Paginated invoice list with status and date filters.
- `POST /api/billing/invoices`: Issue itemized invoice from clinic services with dynamic tax & discount calculations.
- `POST /api/billing/invoices/:id/payments`: Record counter payment (`cash`, `upi`, `card`).
- `POST /api/billing/invoices/:id/void`: Void invoice with documented reason. (`clinic_admin`)
- `GET /api/billing/analytics`: Revenue intelligence analytics, collection breakdowns, and pending balances.

---

## 🔍 8. Patient Timeline, Global Search & Documents (Phase 7)

- `GET /api/patients/:id/timeline`: Merges appointments, clinical notes, prescriptions, lab results, and invoices chronologically into a single unified stream.
- `GET /api/search?q=...`: Global Ctrl+K instant lookup across patients, appointments, doctors, and lab orders.
- `POST /api/documents/upload`: Secure multipart file upload (`.pdf`, `.png`, `.jpg` up to 10MB) with virus-safe UUID naming.
- `GET /api/documents/:id/stream`: Secure stream delivery with RBAC access control.
- `GET /api/notifications`: In-app notification center with real-time Socket.io broadcasts.

---

## 🤖 9. AI Features & Safety Guardrails (Phase 8)

Backend-only Anthropic Claude integration (`POST /api/ai/*`) protected with strict rate limiting (`aiLimiter`), PII scrubbing, and offline fallback.

| Endpoint | Access | Guardrails | Description |
| :--- | :--- | :--- | :--- |
| `POST /api/ai/visit-summary` | `doctor`, `clinic_admin` | PII Redaction, mandatory clinician review flag | Synthesizes SOAP note elements into a clinician-review draft. |
| `POST /api/ai/approve-summary` | `doctor`, `clinic_admin` | Immutable Audit Log | Attaches clinician-verified summary to patient chart with AI origin metadata. |
| `POST /api/ai/explain-instructions` | `doctor`, `patient`, `clinic_admin` | **NO diagnosis**, **NO dosage changes**, mandatory disclaimer | Translates complex medication plans into clear reading-level-12 instructions. |

---

## 🛡️ 10. Security & Compliance Architecture (Phase 9)

- **Helmet**: Secures HTTP response headers against clickjacking, MIME sniffing, and cross-site scripting.
- **NoSQL Injection Sanitizer**: Recursively strips MongoDB operator injection keys (`$gt`, `$ne`, `$where`, `.`) from request bodies, parameters, and query strings.
- **Immutable Audit Logging**: Auto-logs create, update, delete, and read operations on patient records. Database-level hooks block modifications to existing audit logs.
- **Express Rate Limiting**: Multi-tier rate limiting for auth, general API, and AI routes.
- **DOMPurify**: Sanitizes all user-supplied inputs on the client before DOM insertion.

---

## ⚙️ 11. Environment Variables Reference

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | Backend HTTP Port | `5000` |
| `NODE_ENV` | Runtime Environment | `development` / `production` / `test` |
| `MONGO_URI` | MongoDB Connection String | `mongodb://localhost:27017/bookdoctor` |
| `JWT_SECRET` | Secret key for JWT signing | `your-secure-jwt-secret` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `http://localhost:5173,http://localhost:3000` |
| `ANTHROPIC_API_KEY` | Anthropic Messages API Key | `sk-ant-api03-...` |
| `ANTHROPIC_MODEL` | Claude model identifier | `claude-3-5-sonnet-20241022` |
| `RAZORPAY_KEY_ID` | Razorpay Merchant Key ID | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Merchant Secret | `your_razorpay_secret` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `AC...` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `your_auth_token` |
| `TWILIO_PHONE_NUMBER` | Twilio Voice Caller ID | `+919398927430` |
