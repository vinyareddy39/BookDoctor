# BookDoctor ??

BookDoctor is a full-stack, production-grade web application for booking and managing doctor appointments. Built with the MERN stack (MongoDB, Express, React, Node.js), it provides a secure, reliable, and user-friendly platform for patients, doctors, and administrators.

## ?? Project Structure

```text
BookDoctor/
¦
+-- client/                 ? React/Vite (Frontend)
¦   +-- src/
¦   +-- public/
¦   +-- package.json
¦   +-- ...
¦
+-- server/                 ? Node + Express (Backend)
¦   +-- controllers/
¦   +-- models/
¦   +-- routes/
¦   +-- package.json
¦   +-- ...
¦
+-- .gitignore
+-- README.md
```

## ? Key Features

### ????? For Patients
- **Search & Filter:** Find doctors by city, specialization, and availability.
- **Instant Booking:** Select a date/time and book an appointment instantly.
- **Real-Time Chat:** WhatsApp-style instant messaging with your doctor, including unread message badges and blue double-tick read receipts.
- **Medical Records:** Instantly receive and download your medical notes and prescriptions as auto-generated PDFs.
- **Dashboard:** Manage your upcoming, completed, and cancelled appointments.
- **Email Notifications:** Receive booking confirmations and cancellation notices.

### ?? For Doctors
- **Real-Time Communication:** Instantly chat with your patients via the dedicated Messages portal.
- **Clinical Notes & PDF Generation:** Type clinical notes and instantly share them with the patient as a downloadable PDF.
- **Profile Management:** Set your availability days, consultation fee, clinic address, and bio.
- **Dashboard:** View all appointments specific to your clinic and mark them as confirmed, completed, or cancelled.

### ??? Security & Real-Time Architecture
- **WebSockets (Socket.io):** Lightning-fast, real-time bidirectional communication for live chats and instant dashboard updates.
- **Rate Limiting:** Protection against brute-force attacks on login/registration.
- **Role-Based Access Control (RBAC):** Strict boundaries separating patients, doctors, and admins.
- **CORS Protection:** API locked down to authorized domains via environment variables.

## ??? Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/vinyareddy39/BookDoctor.git
cd BookDoctor
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

