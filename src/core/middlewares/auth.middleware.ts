import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError, ForbiddenError } from "../errors/AppError";

const JWT_SECRET = process.env.JWT_SECRET || "findshop_jwt_secret_dev_key_change_in_prod";

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0]?.trim();
    if (!name) return;
    const value = parts.slice(1).join("=").trim();
    try {
      list[name] = decodeURIComponent(value);
    } catch {
      list[name] = value;
    }
  });
  return list;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  // Strategy 1: Authorization: Bearer <token> (React Native Mobile App & In-Memory Web Clients)
  let token: string | undefined;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1]?.trim();
  }

  // Strategy 2: HttpOnly / Browser Cookie Fallback (Web Frontends: Customer, Shopkeeper, Super Admin)
  if (!token && req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    token =
      cookies.fse_admin_token ||
      cookies.fse_shop_token ||
      cookies.fse_customer_token ||
      cookies.fse_token ||
      cookies.token;
  }

  if (!token) {
    throw new UnauthorizedError("Authentication token is missing");
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err) {
    throw new UnauthorizedError("Invalid or expired authentication token");
  }
}

/**
 * Enforces role-based access control (RBAC).
 * Rejects requests if user does not possess one of the allowed roles.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError("Authentication token required");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Access denied: Account role '${req.user.role}' is not authorized. Required: [${allowedRoles.join(", ")}]`
      );
    }

    next();
  };
}

export function optionalAuthMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  let token: string | undefined;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1]?.trim();
  } else if (req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    token =
      cookies.fse_admin_token ||
      cookies.fse_shop_token ||
      cookies.fse_customer_token ||
      cookies.fse_token ||
      cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
    } catch {
      // Ignore invalid/expired tokens for optional authentication and continue as guest
    }
  }

  next();
}
