import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { env } from "../../config/env";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Client / Operational Errors (4xx) - Expected validation/business errors
  // Never expose stack trace for 4xx errors; the client just needs the clear message
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      // Uncomment below only for temporary local debugging:
      // ...(env.isDev ? { stack: err.stack } : {}),
    });
    return;
  }

  // 2. Database validation/constraint errors (400)
  if (
    err.name === "SequelizeValidationError" ||
    err.name === "SequelizeUniqueConstraintError"
  ) {
    res.status(400).json({
      success: false,
      message: err.message,
      // Uncomment below only for temporary local debugging:
      // ...(env.isDev ? { stack: err.stack } : {}),
    });
    return;
  }

  // 3. Unexpected Server Errors (500)
  // Full stack trace is logged safely to server terminal/logs
  console.error("Internal Server Error:", err);

  // Return a secure, sanitized response to the client (no server path or file leakage)
  res.status(500).json({
    success: false,
    message: env.isProd ? "Internal server error" : err.message,
    // Uncomment below only for temporary local debugging:
    // ...(env.isDev ? { stack: err.stack } : {}),
  });
}
