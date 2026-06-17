import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

// Routes
import authRoutes from "./routes/authroutes.js";
import doctorRoutes from "./routes/doctorroutes.js";
import appointmentRoutes from "./routes/appointmentroutes.js";
import userRoutes from "./routes/userroutes.js";
import adminRoutes from "./routes/adminroutes.js";
import paymentRoutes from "./routes/paymentroutes.js";

// Middleware
import {
  response,
  errorHandler,
} from "./middleware/index.js";

dotenv.config();

const app = express();

// Fix __dirname in ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// MIDDLEWARES
// ===============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// static folder for uploads
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// custom response middleware
app.use(response);

// ===============================
// DATABASE CONNECTION
// ===============================
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI
    );

    console.log(
      `MongoDB Connected: ${conn.connection.host}`
    );
  } catch (error) {
    console.error("DB Connection Error:", error.message);
    process.exit(1);
  }
};

connectDB();

// ===============================
// API ROUTES
// ===============================
app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);

// ===============================
// HEALTH CHECK ROUTE
// ===============================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Book a Doctor API is running 🚀",
  });
});

// ===============================
// ERROR HANDLER
// ===============================
app.use(errorHandler);

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});