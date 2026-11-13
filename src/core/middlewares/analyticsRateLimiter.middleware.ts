import type { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  timestamps: number[];
}

const windowMs = 60 * 1000; // 1 minute
const maxRequestsPerWindow = 60; // 60 events per minute per key

const ipVisitorMap = new Map<string, RateLimitRecord>();

// Periodic in-memory cleanup every 5 minutes to avoid memory accumulation
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipVisitorMap.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
    if (record.timestamps.length === 0) {
      ipVisitorMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Lightweight in-memory rate limiter for analytics ingestion.
 * Operates without external Redis/Kafka dependencies.
 */
export function analyticsRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown_ip";
  const visitorId = req.body?.visitorId ? String(req.body.visitorId).trim().slice(0, 100) : "unknown_visitor";
  const rateKey = `${ip}:${visitorId}`;

  const now = Date.now();
  let record = ipVisitorMap.get(rateKey);

  if (!record) {
    record = { timestamps: [now] };
    ipVisitorMap.set(rateKey, record);
    return next();
  }

  // Filter timestamps outside current rolling window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxRequestsPerWindow) {
    res.status(429).json({
      success: false,
      message: "Too many analytics events submitted. Rate limit exceeded.",
      error: "RATE_LIMIT_EXCEEDED",
    });
    return;
  }

  record.timestamps.push(now);
  next();
}

