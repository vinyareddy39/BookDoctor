# 🩺 MedAssist – Clinic Operations & Patient Care Portal

[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express 5](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_9-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Jest Tests](https://img.shields.io/badge/Tests-31%20Passed-brightgreen?logo=jest)](https://jestjs.io/)

**MedAssist** is an enterprise-grade, full-stack clinic operations management and patient care portal built with the MERN stack. Extended from BookDoctor, MedAssist delivers complete end-to-end ambulatory and clinical workflows across 5 distinct system roles without compromising legacy telemedicine, SOS emergency, or chat capabilities.

---

## 🌟 Key Functional Modules (Phases 1–9)

### 1. Central RBAC & Session Management
- **5 System Roles**: `clinic_admin`, `doctor`, `receptionist`, `lab_technician`, `patient`.
- **Declarative Permissions Matrix**: Scoped access by resource and action (`read`, `create`, `update`, `delete`).
- **Record-Level Scoping**: Doctors see only their patients; patients see only self & dependents; receptionists and lab techs are strictly restricted from clinical notes.
- **Session Management**: Multi-device tracking, refresh token rotation, single-device and all-device logout.
- **Immutable Audit Logging**: Automatic audit trails for create/update/delete/read operations with Mongoose-level tamper-proofing.

### 2. Clinic Master Configuration & Front Desk Intake
- **Clinic Settings**: Multi-specialty working hours, tax rates (GST), and billing configurations.
- **Department & Service Catalog**: Billable service catalog with codes, pricing, and duration.
- **Walk-In Registration**: Front-desk receptionist registration with auto-generated Medical Record Numbers (`MED-YYYY-XXXXX`).

### 3. Smart Scheduling & Live Queue
- **Conflict Detection Engine**: Server-side double-booking prevention and doctor approved leave/blocked time checks.
- **Doctor Availability**: Exceptions calendar, leave approvals, and schedule management.
- **Day/Week Calendar**: Visual appointment calendar for doctors and receptionists.
- **Live Walk-In Queue**: Sequential token management (`waiting` ➔ `called` ➔ `in_consultation` ➔ `completed`) with real-time Socket.io state sync and Web Audio chimes.

### 4. Electronic Medical Records (EMR)
- **Structured SOAP Notes**: Chief complaint, HPI, examination, assessment, treatment plan, and vitals with auto-calculated BMI.
- **Tamper-Proof Locking & Versioning**: Signed notes are permanently locked; modifications create traceable amendment versions (`v2`, `v3`).
- **ICD Problem List**: Diagnoses catalog with ICD codes and status management.
- **Electronic Prescriptions**: Itemized medications, dosages, frequencies, and durations with instant AutoTable PDF export.
- **Follow-Up Consultations**: Follow-up scheduling, patient request workflow, and doctor approval.

### 5. Diagnostic Laboratory Workflow
- **Specimen Lifecycle**: `ordered` ➔ `sample_collected` ➔ `processing` ➔ `result_entered` ➔ `verified` ➔ `released`.
- **Dual-Verifier Enforcement**: Enforces `verifier != entry user` so a second technician must independently inspect and sign off on results.
- **Patient Result Masking**: Test parameters are safely withheld from patient view until pathologist/doctor release.
- **Diagnostic PDF Reports**: Printable clinical laboratory reports with reference ranges and abnormal flags.

### 6. Billing & Revenue Intelligence
- **Itemized Tax Invoices**: Automatically calculated subtotals, dynamic clinic taxes (GST), and discounts.
- **Counter & Online Intake**: Counter intake for Cash and UPI QR scan alongside Razorpay online checkout.
- **Refunds & Voids**: Documented administrative voiding and refund workflows.
- **Revenue Analytics**: Total revenue, collection breakdowns, and pending balances.

### 7. Patient Timeline, Global Search & Notifications
- **Chronological Timeline**: Unified view merging appointments, SOAP notes, prescriptions, lab results, and invoices.
- **Global Search**: Instant Ctrl+K modal search across patients, doctors, appointments, and lab orders.
- **Real-Time Notifications**: Socket.io in-app notification center with persistent bell and read/unread counters.
- **Secure Document Vault**: Virus-safe file uploads (`.pdf`, `.png`, `.jpg` up to 10MB) with strict RBAC access control.

### 8. Safety-Critical AI Features (Anthropic Claude)
- **Backend-Only Integration**: Claude Messages API handled exclusively on the backend with zero client exposure.
- **PII Scrubbing Engine**: Redacts emails, phone numbers, MRNs, and IDs before dispatching prompts.
- **AI Visit Summary Draft**: Synthesizes SOAP note elements into a draft marked for **Clinician Review Required**. Physicians review and edit before approving; approval is permanently logged in the audit trail with AI provenance.
- **Plain-Language Patient Guide**: Translates medication plans into reading-age-12 instructions with strict negative constraints (**NO diagnosis**, **NO dosage changes**) and mandatory educational disclaimers.
- **Offline Rule-Based Fallback**: Seamless fallback ensures the application remains functional even when offline or without an API key.

### 9. Security, Quality & Test Data
- **Security Hardening**: Helmet security headers, NoSQL injection sanitization, CORS allowlists, multi-tier rate limiting, and DOMPurify.
- **Comprehensive Seed Script**: Seeds 1 clinic, 1 admin, 3 doctors, 2 receptionists, 2 lab techs, 20 patients with MRNs, appointments, EMR records, and invoices.
- **Automated Test Suite**: 31 unit and integration tests across 6 Jest test suites covering RBAC, conflict detection, lab status transitions, invoice math, and AI guardrails.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v20+ (Node 24 recommended)
- **MongoDB**: Local instance or MongoDB Atlas replica set

### 1. Clone & Install Dependencies
```bash
# Clone repository
git clone https://github.com/vinyareddy39/BookDoctor.git
cd BookDoctor

# Install Backend dependencies
cd server
npm install

# Install Frontend dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables
Create `.env` in the `server` directory:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/bookdoctor
JWT_SECRET=your_jwt_secret_key_here
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# AI Features (Optional - Falls back to rule-based engine if omitted)
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Payment & Telemedicine
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

### 3. Seed Comprehensive Clinic Test Data
Populate the database with a complete multi-specialty clinic dataset:
```bash
cd server
npm run seed
```

### 4. Run Automated Test Suite
Execute the 31 Jest integration tests:
```bash
cd server
npm test
```

### 5. Launch Application
In one terminal (Backend):
```bash
cd server
npm run dev
```

In a second terminal (Frontend):
```bash
cd client
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 🔐 Pre-Seeded Test Credentials

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Clinic Admin** | Dr. Rajeshwar Rao | `admin@medassist.com` | `Password@123` |
| **Doctor (Cardiology)** | Dr. Ananya Sharma | `dr.sharma@medassist.com` | `Password@123` |
| **Doctor (General Med)** | Dr. Vikram Patel | `dr.patel@medassist.com` | `Password@123` |
| **Doctor (Pediatrics)** | Dr. Shalini Singh | `dr.singh@medassist.com` | `Password@123` |
| **Receptionist 1** | Sunita Reddy | `reception1@medassist.com` | `Password@123` |
| **Receptionist 2** | Pooja Varma | `reception2@medassist.com` | `Password@123` |
| **Lab Technician 1** | Kiran Kumar | `labtech1@medassist.com` | `Password@123` |
| **Lab Technician 2** | Deepa Menon | `labtech2@medassist.com` | `Password@123` |
| **Patient 1** | Aarav Gupta (MRN: MED-2026-00001) | `patient1@example.com` | `Password@123` |
| **Patients 2–20** | Various (MRNs: MED-2026-00002...20) | `patient2@example.com` ... | `Password@123` |

---

## 📚 Complete API Documentation

For the full list of REST endpoints, request/response bodies, error formats, and RBAC matrix specifications, refer to [**`API_DOCUMENTATION.md`**](./API_DOCUMENTATION.md).
