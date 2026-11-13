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

// Device Session Limiters: max 5 requests per hour per IP and per deviceId
export const deviceSessionIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { success: false, message: "Too many device session requests from this IP. Try again later." },
});

export const deviceSessionIdLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const rawId = typeof req.body?.deviceId === "string" ? req.body.deviceId.trim() : "";
    return rawId ? `device:${rawId}` : `ip:${req.ip || "unknown"}`;
  },
  validate: { xForwardedForHeader: false, trustProxy: false, keyGeneratorIpFallback: false },
  message: { success: false, message: "Too many device session requests for this deviceId. Try again later." },
});

// SMS Alert Limiter: max 10 SMS alert dispatches per hour per authenticated device/user
export const smsPerDeviceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?._id) return `sms_user:${String(req.user._id)}`;
    return `sms_ip:${req.ip || "unknown"}`;
  },
  validate: { xForwardedForHeader: false, trustProxy: false, keyGeneratorIpFallback: false },
  message: { success: false, error: "Hourly SMS dispatch cap (10/hour per device) reached. Use device SMS or call 108/112." },
});

// ── Daily SMS Abuse Caps (Global across all devices + Per-Device daily cap) ──
let smsDailyState = {
  date: new Date().toISOString().slice(0, 10),
  globalCount: 0,
  warned80: false,
  perDevice: new Map(),
};

export function resetSmsDailyCaps() {
  smsDailyState = {
    date: new Date().toISOString().slice(0, 10),
    globalCount: 0,
    warned80: false,
    perDevice: new Map(),
  };
}

/**
 * Checks and consumes daily SMS quota (global SMS_DAILY_CAP default 200, per-device SMS_DEVICE_DAILY_CAP default 30).
 * Logs a warning when 80% of the global daily cap is reached.
 */
export function consumeSmsDailyCaps(deviceKey, recipientCount = 1) {
  const today = new Date().toISOString().slice(0, 10);
  if (smsDailyState.date !== today) {
    smsDailyState = {
      date: today,
      globalCount: 0,
      warned80: false,
      perDevice: new Map(),
    };
  }

  const count = Math.max(1, Number(recipientCount) || 1);
  const globalCap = Math.max(1, parseInt(process.env.SMS_DAILY_CAP || "200", 10) || 200);
  const deviceCap = Math.max(1, parseInt(process.env.SMS_DEVICE_DAILY_CAP || "30", 10) || 30);

  if (smsDailyState.globalCount + count > globalCap) {
    return {
      allowed: false,
      code: "SMS_DAILY_CAP_REACHED",
      error: `Global daily SMS limit (${globalCap}) reached. Opening device SMS composer fallback.`,
    };
  }

  const normalizedDevice = String(deviceKey || "unknown");
  const currentDeviceCount = smsDailyState.perDevice.get(normalizedDevice) || 0;
  if (currentDeviceCount + count > deviceCap) {
    return {
      allowed: false,
      code: "SMS_DEVICE_DAILY_CAP_REACHED",
      error: `Daily per-device SMS limit (${deviceCap}) reached. Opening device SMS composer fallback.`,
    };
  }

  smsDailyState.globalCount += count;
  smsDailyState.perDevice.set(normalizedDevice, currentDeviceCount + count);

  const warnThreshold = Math.ceil(globalCap * 0.8);
  if (!smsDailyState.warned80 && smsDailyState.globalCount >= warnThreshold) {
    smsDailyState.warned80 = true;
    console.warn(
      `⚠️ [SMS Cap Warning] Global daily SMS usage reached ${smsDailyState.globalCount}/${globalCap} (>=80% of SMS_DAILY_CAP).`
    );
  }

  return {
    allowed: true,
    globalCount: smsDailyState.globalCount,
    globalCap,
    deviceCount: currentDeviceCount + count,
    deviceCap,
  };
}

