import type { Request, Response, NextFunction } from "express";
import { env } from "../../config/env";

// ANSI Terminal Colors
const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

/**
 * Array of sensitive keys to redact from logs during development.
 * Any key matching these (case-insensitive) will have its value replaced with "[REDACTED]".
 */
export const SENSITIVE_KEYS: readonly string[] = [
  "password",
  "passwordHash",
  "confirmPassword",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "authorization",
  "apiKey",
  "creditCard",
  "cvv",
  "pin",
  "otp",
];

const sensitiveSet = new Set(SENSITIVE_KEYS.map((k) => k.toLowerCase()));

/**
 * Deeply clone and mask sensitive fields (passwords, tokens, secrets)
 */
function sanitizePayload(data: unknown): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizePayload(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (sensitiveSet.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = sanitizePayload(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

function getStatusColor(status: number): string {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  if (status >= 200) return colors.green;
  return colors.reset;
}

function getMethodColor(method: string): string {
  switch (method) {
    case "GET":
      return colors.blue;
    case "POST":
      return colors.green;
    case "PUT":
    case "PATCH":
      return colors.yellow;
    case "DELETE":
      return colors.red;
    default:
      return colors.magenta;
  }
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  const method = req.method;
  const path = req.originalUrl || req.url;

  // In DEVELOPMENT ONLY: capture and sanitize request payloads
  // In PRODUCTION: skip payload processing entirely for performance and security
  let sanitizedBody: unknown = null;
  let sanitizedQuery: unknown = null;

  if (env.isDev) {
    const hasBody = req.body && Object.keys(req.body).length > 0;
    const hasQuery = req.query && Object.keys(req.query).length > 0;

    if (hasBody) sanitizedBody = sanitizePayload(req.body);
    if (hasQuery) sanitizedQuery = sanitizePayload(req.query);
  }

  // Listen for response completion
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const statusText = res.statusMessage || "";

    const methodColor = getMethodColor(method);
    const statusColor = getStatusColor(statusCode);

    // Standard API Hit Log (Dev and Prod)
    // Format: [METHOD] /path  STATUS StatusText • Duration
    const logLine = `${methodColor}${colors.bold}[${method}]${colors.reset} ${path}  ${statusColor}${statusCode} ${statusText}${colors.reset} ${colors.dim}• ${duration}ms${colors.reset}`;
    console.log(logLine);

    // In DEV MODE ONLY: print the sanitized payloads
    if (env.isDev) {
      if (sanitizedQuery) {
        console.log(
          `  ${colors.dim}↳ Query:${colors.reset}`,
          JSON.stringify(sanitizedQuery)
        );
      }

      if (sanitizedBody) {
        console.log(
          `  ${colors.dim}↳ Body: ${colors.reset}`,
          JSON.stringify(sanitizedBody)
        );
      }
    }
  });

  next();
}
