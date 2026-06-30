# BookDoctor 🏥

BookDoctor is a full-stack, production-grade web application for booking and managing doctor appointments. Built with the MERN stack (MongoDB, Express, React, Node.js), it provides a secure, reliable, and user-friendly platform for patients, doctors, and administrators.

![BookDoctor Banner](media__1782823013722.png)

## Features

### 🧑‍⚕️ For Patients
- **Search & Filter:** Find doctors by city, specialization, and availability.
- **Instant Booking:** Select a date/time and book an appointment instantly.
- **Dashboard:** Manage your upcoming, completed, and cancelled appointments.
- **Smart Validation:** You can only book on days the doctor is actually available.
- **Profile:** Keep your personal and emergency contact details up to date.
- **Cancel Appointments:** Easily cancel pending or confirmed appointments.
- **Email Notifications:** Receive booking confirmations and cancellation notices.

### ⚕️ For Doctors
- **Profile Management:** Set your availability days, consultation fee, clinic address, and bio.
- **Availability Toggle:** Quickly mark yourself available or unavailable.
- **Dashboard:** View all appointments specific to your clinic.
- **Status Updates:** Mark appointments as confirmed, completed, or cancelled.

### 🛡️ Security & Reliability Features
- **Rate Limiting:** Protection against brute-force attacks on login/registration.
- **Role-Based Access Control (RBAC):** Strict boundaries separating patients, doctors, and admins.
- **Data Integrity:** Ownership checks prevent users from modifying records that aren't theirs.
- **Sanitized Errors:** Internal server errors are caught and sanitized before reaching the client in production.
- **CORS Protection:** API locked down to authorized domains via environment variables.
- **Performance:** Optimized MongoDB indexes for fast search queries.

## Architecture

BookDoctor follows a standard 3-tier architecture:

1. **Client (Frontend):** React + Vite + Tailwind CSS. Hosted on Vercel.
2. **Server (Backend):** Node.js + Express.
3. **Database:** MongoDB (via Mongoose).

## Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/vinyareddy39/BookDoctor.git
cd "BookDoctor"
```

### 2. Set up the Backend
```bash
cd server
npm install
```
Create a `.env` file based on the provided `.env.example`:
```
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
ALLOWED_ORIGINS=http://localhost:5173
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_app_password
```
Start the backend:
```bash
npm run dev
```

### 3. Set up the Frontend
```bash
cd ../client
npm install
```
Create a `.env` file based on the provided `.env.example`:
```
VITE_API_URL=http://localhost:5000/api
```
Start the frontend:
```bash
npm run dev
```

## Future Improvements / What I'd Do Differently
*   **Payment Gateway Integration:** The current payment flow is mocked. I'd integrate a full Razorpay flow for handling consultation fees upfront.
*   **Real-time Notifications:** Add WebSockets (e.g., Socket.io) for real-time alerts when a doctor confirms an appointment or a patient books one.
*   **Advanced Scheduling:** Integrate with Google Calendar API so doctors can sync their availability automatically instead of manually setting "Available Days" and hours.
*   **Testing:** Add full E2E testing using Cypress or Playwright to cover critical user flows like registration, booking, and cancellation.
