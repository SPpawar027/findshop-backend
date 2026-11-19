export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: Record<string, unknown>) {
    super(message, 404, true, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: Record<string, unknown>) {
    super(message, 400, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized access", details?: Record<string, unknown>) {
    super(message, 401, true, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden action", details?: Record<string, unknown>) {
    super(message, 403, true, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists", details?: Record<string, unknown>) {
    super(message, 409, true, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal server error") {
    super(message, 500);
  }
}
