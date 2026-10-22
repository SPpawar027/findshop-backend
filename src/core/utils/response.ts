import type { Response } from "express";

export interface ApiResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200,
  meta?: ApiResponseMeta
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function sendCreated<T>(
  res: Response,
  data: T,
  message = "Created successfully"
): Response {
  return sendSuccess(res, data, message, 201);
}
