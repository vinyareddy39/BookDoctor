import rateLimit from "express-rate-limit";

// Auth routes: max 15 requests per 15 minutes per IP (brute-force protection)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { success: false, message: "Too many attempts. Please try again after 15 minutes." },
});

// General API limiter: 200 requests per 15 min
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { success: false, message: "Too many requests. Please slow down." },
});

// AI Assistant Limiter: 40 requests per 15 min
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { success: false, message: "AI service request rate limit reached. Please wait a moment before trying again." },
});

// Payment Limiter: max 30 payment operations per 15 min per IP (financial protection)
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { success: false, message: "Payment request limit reached. Please wait a few minutes before trying again." },
});

// Emergency Dispatch Limiter: max 15 emergency requests per 10 min per IP
export const emergencyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { success: false, message: "Emergency dispatch limit reached. Please call 108 or your local emergency services directly." },
});

