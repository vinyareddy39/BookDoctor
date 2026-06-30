import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";

// Routes
import authRoutes        from "./routes/authroutes.js";
import doctorRoutes      from "./routes/doctorroutes.js";
import appointmentRoutes from "./routes/appointmentroutes.js";
import userRoutes        from "./routes/userroutes.js";
import adminRoutes       from "./routes/adminroutes.js";
import paymentRoutes     from "./routes/paymentroutes.js";

// Middleware
import { response, errorHandler } from "./middleware/index.js";
import { initSocket } from "./socket.js";
import http from "http";

dotenv.config();

const app = express();
const server = http.createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ===============================
// CORS — locked to allowed origins
// ===============================
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., curl, mobile apps, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS policy: origin '${origin}' is not allowed.`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ===============================
// SOCKET.IO INITIALIZATION
// ===============================
initSocket(server, allowedOrigins);

// ===============================
// RATE LIMITING
// ===============================
// Auth routes: max 15 requests per 15 minutes per IP (brute-force protection)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again after 15 minutes." },
});

// General API limiter: 200 requests / 15 min (reasonable for normal use)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down." },
});

app.use("/api", apiLimiter);

// ===============================
// BODY PARSING
// ===============================
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Static uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Custom response helper (attaches req.http.ok / req.http.badRequest etc.)
app.use(response);

// ===============================
// DATABASE CONNECTION
// ===============================
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ DB Connection Error:", error.message);
    process.exit(1);
  }
};

connectDB();

// ===============================
// API ROUTES
// ===============================
app.use("/api/auth",         authRoutes);
app.use("/api/doctors",      doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/users",        userRoutes);
app.use("/api/admin",        adminRoutes);
app.use("/api/payments",     paymentRoutes);

// ===============================
// HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
  res.json({ success: true, message: "BookDoctor API is running 🚀", env: process.env.NODE_ENV || "development" });
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} not found.` });
});

// ===============================
// GLOBAL ERROR HANDLER (must be last)
// ===============================
app.use(errorHandler);

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});