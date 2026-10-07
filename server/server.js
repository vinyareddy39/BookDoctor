import "dotenv/config";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import helmet from "helmet";
import mongoSanitize from "./middleware/mongoSanitize.js";

// Routes
import authRoutes        from "./routes/authroutes.js";
import doctorRoutes      from "./routes/doctorroutes.js";
import appointmentRoutes from "./routes/appointmentroutes.js";
import userRoutes        from "./routes/userroutes.js";
import adminRoutes       from "./routes/adminroutes.js";
import paymentRoutes     from "./routes/paymentroutes.js";
import googleRoutes      from "./routes/googleroutes.js";
import chatRoutes        from "./routes/chatroutes.js";
import emergencyRoutes   from "./routes/emergencyRoutes.js";
import ambulanceRoutes   from "./routes/ambulanceRoutes.js";
import auditRoutes       from "./routes/auditRoutes.js";
import clinicRoutes      from "./routes/clinicRoutes.js";
import departmentRoutes  from "./routes/departmentRoutes.js";
import serviceRoutes     from "./routes/serviceRoutes.js";
import patientRoutes     from "./routes/patientRoutes.js";
import doctorScheduleRoutes from "./routes/doctorScheduleRoutes.js";
import queueRoutes       from "./routes/queueRoutes.js";
import emrRoutes         from "./routes/emrRoutes.js";
import labRoutes         from "./routes/labRoutes.js";
import billingRoutes     from "./routes/billingRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import documentRoutes    from "./routes/documentRoutes.js";
import searchRoutes      from "./routes/searchRoutes.js";
import aiRoutes          from "./routes/aiRoutes.js";
import { triggerEmergencyCall } from "./controllers/emergencyController.js";
import { handleOutboundCall, getConnectTwiml } from "./controllers/callController.js";

// Swagger
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";

// Middleware
import { response, errorHandler } from "./middleware/index.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { initSocket } from "./socket.js";
import http from "http";
import cookieParser from "cookie-parser";
import { startReminderCron } from "./service/cronService.js";
import { validateRazorpayConfig } from "./services/paymentService.js";

dotenv.config();

// Enforce production gateway security checks on startup
validateRazorpayConfig();

if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.error("FATAL CONFIG ERROR: JWT_SECRET must be set and at least 16 characters in production.");
    process.exit(1);
  }
}

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ===============================
// SENTRY INITIALIZATION
// ===============================
if (process.env.NODE_ENV !== "test") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || "",
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
}

// ===============================
// CORS — locked to allowed origins
// ===============================
const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://book-doctor-six.vercel.app", // production frontend
];

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/book-doctor[a-z0-9-]*\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }
    // Return false — do NOT throw an Error here.
    // Throwing causes Express to send a response with no CORS headers,
    // making the browser show a confusing opaque CORS failure instead of a 403.
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Explicit OPTIONS preflight handler — regex wildcard required in Express 5+ / path-to-regexp v8+
app.options(/(.*)/,  cors());

// ===============================
// SOCKET.IO INITIALIZATION
// ===============================
initSocket(server, allowedOrigins);

// ===============================
// RATE LIMITING — General API
// ===============================
app.use("/api", apiLimiter);

// ===============================
// SECURITY HEADERS — HELMET
// ===============================
app.use(
  helmet({
    contentSecurityPolicy: false, // Preserves Daily.co video iframes & WebRTC functionality
    crossOriginEmbedderPolicy: false,
  })
);

// ===============================
// COMPRESSION
// ===============================
app.use(compression());

// ===============================
// BODY PARSING & COOKIES
// ===============================
app.use(cookieParser());
app.use(express.json({
  limit: "1mb",
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// NoSQL Injection Sanitization
app.use(mongoSanitize);

// Static uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Custom response helper (attaches req.http.ok / req.http.badRequest etc.)
app.use(response);

// ===============================
// DATABASE CONNECTION
// ===============================
const connectDB = async () => {
  try {
    mongoose.set("returnDocument", "after");
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ DB Connection Error:", error.message);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== "test") {
  connectDB();
  startReminderCron();
}

// ===============================
// HEALTH CHECK (For UptimeRobot to prevent Render sleep)
// ===============================
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ===============================
// API ROUTES
// ===============================
app.use("/api/auth",         authRoutes);
app.use("/api/doctors",      doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/users",        userRoutes);
app.use("/api/admin",        adminRoutes);
app.use("/api/payments",     paymentRoutes);
app.use("/api/google",       googleRoutes);
app.use("/api/chat",         chatRoutes);
app.use("/api/emergency",    emergencyRoutes);
app.use("/api/ambulance",    ambulanceRoutes);
app.use("/api/audit-logs",   auditRoutes);
app.use("/api/clinic",       clinicRoutes);
app.use("/api/departments",  departmentRoutes);
app.use("/api/services",     serviceRoutes);
app.use("/api/patients",     patientRoutes);
app.use("/api/schedule",     doctorScheduleRoutes);
app.use("/api/queue",        queueRoutes);
app.use("/api/emr",          emrRoutes);
app.use("/api/lab",          labRoutes);
app.use("/api/billing",      billingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/documents",    documentRoutes);
app.use("/api/search",       searchRoutes);
app.use("/api/ai",           aiRoutes);
app.post("/api/emergency-call", triggerEmergencyCall);

// Twilio Voice Click-to-Call
app.post("/api/call", handleOutboundCall);
app.all("/twiml/connect", getConnectTwiml);
app.all("/api/twiml/connect", getConnectTwiml);

// Swagger API Docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
if (process.env.NODE_ENV !== "test") {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
  });
}

export { app };