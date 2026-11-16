import type { Request, Response, NextFunction } from "express";

interface AuthRateRecord {
  lastRequestTime: number;
  timestamps: number[];
}

const windowMs = 15 * 60 * 1000; // 15-minute rolling window
const maxPerWindow = 5; // Max 5 OTP requests per 15 minutes
const minIntervalMs = 60 * 1000; // 60-second cooldown between requests

const emailIpStore = new Map<string, AuthRateRecord>();

// Cleanup stale records every 5 minutes to avoid memory accumulation
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of emailIpStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
    if (record.timestamps.length === 0 && now - record.lastRequestTime > windowMs) {
      emailIpStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Rate limiter for OTP dispatch endpoints (forgot-password, resend-otp).
 * Enforces a 60-second cooldown between consecutive requests and
 * limits each client/email to a maximum of 5 requests per 15-minute window.
 */
export function authOtpRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown_ip";
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : "anonymous";
  const rateKey = `${ip}:${email}`;

  const now = Date.now();
  const record = emailIpStore.get(rateKey);

  if (!record) {
    emailIpStore.set(rateKey, { lastRequestTime: now, timestamps: [now] });
    return next();
  }

  // 1. Enforce 60-second cooldown
  const timeSinceLast = now - record.lastRequestTime;
  if (timeSinceLast < minIntervalMs) {
    const remainingSec = Math.ceil((minIntervalMs - timeSinceLast) / 1000);
    res.status(429).json({
      success: false,
      message: `Please wait ${remainingSec} second${remainingSec === 1 ? "" : "s"} before requesting another verification code.`,
    });
    return;
  }

  // 2. Filter rolling window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxPerWindow) {
    res.status(429).json({
      success: false,
      message: "Too many code requests. For security reasons, please try again in 15 minutes.",
    });
    return;
  }

  record.lastRequestTime = now;
  record.timestamps.push(now);
  next();
}
