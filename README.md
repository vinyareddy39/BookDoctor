# 🏥 BookDoctor — Doctor Appointment Booking System

A full-stack MERN application that connects patients with doctors for seamless appointment booking, real-time availability, and feedback management.

🔗 **Live Demo**: https://book-doctor-six.vercel.app  
🔗 **Backend API**: https://bookdoctor-9ns2.onrender.com

---

## ✨ Features

### 👤 Patient
- Separate **Patient Registration & Login**
- **Find Doctors** by city, specialization, and availability
- View doctor profile with consultation fee, experience, clinic address, and **live Google Maps embed**
- Book appointments with **time slots** generated from doctor's available hours
- View & track all **My Appointments** (status: pending → confirmed → completed)
- **Rate & Review** completed appointments (1–5 stars + comment)
- Edit **My Profile** (name, phone)

### 👨‍⚕️ Doctor
- Separate **Doctor Registration & Login**
- Toggle **availability on/off** in real time
- Set **specialization, city, clinic address, and Google Maps URL**
- Set **available hours** (e.g., `10:00 AM - 5:00 PM`) — patients can only book within these hours
- View all incoming appointments with patient details
- **Accept, Cancel, or Mark Complete** appointments
- When appointment is marked **Complete**, payment is automatically marked as **Paid**
- View **Patient Feedback** (rating + review) on completed appointments (read-only)

---

## 🛠️ Tech Stack

| Layer      | Technology                     |
|------------|-------------------------------|
| Frontend   | React, Vite, Tailwind CSS     |
| Backend    | Node.js, Express.js           |
| Database   | MongoDB + Mongoose            |
| Auth       | JWT (JSON Web Tokens)         |
| Deployment | Vercel (frontend), Render (backend), MongoDB Atlas (DB) |

---

## 🚀 Getting Started (Local)

### Prerequisites
- Node.js v18+
- MongoDB running locally

### 1. Clone the Repository
```bash
git clone https://github.com/vinyareddy39/BookDoctor.git
cd BookDoctor
```

### 2. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` folder:
```env
MONGO_URI=mongodb://localhost:27017/bookdoctor
JWT_SECRET=your_jwt_secret_here
PORT=5000
```
Start the backend:
```bash
npm start
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```
Create a `.env` file in the `frontend/` folder:
```env
VITE_API_URL=http://localhost:5000/api
```
Start the frontend:
```bash
npm run dev
```

---

## 📁 Project Structure

```
BookDoctor/
├── backend/
│   ├── controllers/     # Auth, Doctor, Appointment, User controllers
│   ├── middleware/       # Auth guard, response helpers
│   ├── models/          # User, Doctor, Appointment schemas
│   ├── routes/          # Express route files
│   └── server.js        # Entry point
└── frontend/
    └── src/
        ├── components/  # Navbar, AppointmentCard, DoctorCard, etc.
        ├── context/     # AuthContext (JWT decode, role helpers)
        ├── pages/       # Login, Register, DoctorLogin, DoctorRegister,
        │                #  Doctors, BookAppointment, MyAppointments,
        │                #  DoctorDashboard, Profile
        └── services/    # Axios API config
```

---

## 🌐 Deployment

| Service | Platform |
|---------|----------|
| Frontend | [Vercel](https://vercel.com) — Root directory: `frontend` |
| Backend  | [Render](https://render.com) — Start: `node server.js` |
| Database | [MongoDB Atlas](https://mongodb.com/cloud/atlas) |

**Environment variables required on Render:**
```
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/bookdoctor
JWT_SECRET=your_secret_key
```

**Environment variables required on Vercel:**
```
VITE_API_URL=https://bookdoctor-9ns2.onrender.com
```

---

## 📝 License
MIT
