import type { Request, Response, NextFunction, CookieOptions } from "express";
import { authService } from "./auth.service";
import { sendSuccess, sendCreated } from "../../core/utils/response";
import { BadRequestError } from "../../core/errors/AppError";
import { type AuthenticatedRequest, parseCookies } from "../../core/middlewares/auth.middleware";

function setAuthCookies(res: Response, role: string, accessToken: string, refreshToken: string) {
  const isProd = process.env.NODE_ENV === "production";
  const cookieBaseOptions: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };

  const accessOptions: CookieOptions = {
    ...cookieBaseOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  };

  const refreshOptions: CookieOptions = {
    ...cookieBaseOptions,
    maxAge: 10 * 24 * 60 * 60 * 1000, // 10 days
  };

  if (role === "super_admin") {
    res.cookie("fse_admin_token", accessToken, accessOptions);
    res.cookie("fse_admin_session", refreshToken, refreshOptions);
  } else if (role === "shop_admin") {
    res.cookie("fse_shop_token", accessToken, accessOptions);
    res.cookie("fse_shop_session", refreshToken, refreshOptions);
  } else {
    res.cookie("fse_customer_token", accessToken, accessOptions);
    res.cookie("fse_customer_session", refreshToken, refreshOptions);
  }

  // Also set common cookie for backward-compatible fallback
  res.cookie("fse_token", accessToken, accessOptions);
  res.cookie("fse_session", refreshToken, refreshOptions);
}

function clearAuthCookies(res: Response) {
  const isProd = process.env.NODE_ENV === "production";
  const clearOptions: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };

  const cookieNames = [
    "fse_admin_token",
    "fse_admin_session",
    "fse_shop_token",
    "fse_shop_session",
    "fse_customer_token",
    "fse_customer_session",
    "fse_token",
    "fse_session",
    "token",
    "refreshToken",
  ];

  cookieNames.forEach((name) => {
    res.clearCookie(name, clearOptions);
  });
}

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password, phone, role } = req.body;
      if (!name || !email || !password) {
        throw new BadRequestError("Name, email, and password are required");
      }

      const result = await authService.register({ name, email, password, phone, role });
      setAuthCookies(res, result.user.role, result.accessToken, result.refreshToken);
      sendCreated(res, result, "Account registered successfully");
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, expectedRole, portal } = req.body;
      if (!email || !password) {
        throw new BadRequestError("Email and password are required");
      }

      const targetRole = expectedRole || portal;
      const result = await authService.login({
        email,
        password,
        expectedRole: targetRole,
      });
      setAuthCookies(res, result.user.role, result.accessToken, result.refreshToken);
      sendSuccess(res, result, "Logged in successfully");
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const refreshToken =
        req.body?.refreshToken ||
        (req.headers["x-refresh-token"] as string) ||
        cookies.fse_admin_session ||
        cookies.fse_shop_session ||
        cookies.fse_customer_session ||
        cookies.fse_session ||
        cookies.refreshToken;

      if (!refreshToken || typeof refreshToken !== "string") {
        throw new BadRequestError("Refresh token is required");
      }
      const result = await authService.refreshToken(refreshToken);
      setAuthCookies(res, result.user.role, result.accessToken, result.refreshToken);
      sendSuccess(res, result, "Session token refreshed successfully");
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new BadRequestError("User context missing");
      }
      const user = await authService.getCurrentUser(req.user.id);
      sendSuccess(res, user, "Current user profile fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        throw new BadRequestError("Valid email is required");
      }
      const origin = req.get("origin") || req.get("referer");
      const result = await authService.forgotPassword(email, origin);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        throw new BadRequestError("Token and new password are required");
      }
      const result = await authService.resetPassword(token, newPassword);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken, token, expectedRole, portal } = req.body;
      const targetToken = idToken || token;
      if (!targetToken) {
        throw new BadRequestError("Google ID token is required");
      }

      const targetRole = expectedRole || portal;
      const result = await authService.googleLogin(targetToken, targetRole);
      setAuthCookies(res, result.user.role, result.accessToken, result.refreshToken);
      sendSuccess(res, result, "Google authentication successful");
    } catch (error) {
      next(error);
    }
  }

  async verifyEmailOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        throw new BadRequestError("Email and 6-digit OTP code are required");
      }
      const result = await authService.verifyEmailOtp(email, otp);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async resendEmailOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        throw new BadRequestError("Email is required");
      }
      const result = await authService.resendEmailOtp(email);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async resetPasswordWithOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        throw new BadRequestError("Email, 6-digit OTP code, and new password are required");
      }
      const result = await authService.resetPasswordWithOtp(email, otp, newPassword);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async setPassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new BadRequestError("User authentication context missing");
      }
      const { newPassword } = req.body;
      if (!newPassword) {
        throw new BadRequestError("New password is required");
      }
      const result = await authService.setPassword(req.user.id, newPassword);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const refreshToken =
        req.body?.refreshToken ||
        (req.headers["x-refresh-token"] as string | undefined) ||
        cookies.fse_admin_session ||
        cookies.fse_shop_session ||
        cookies.fse_customer_session ||
        cookies.fse_session ||
        cookies.refreshToken;

      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;

      // Clear all authentication cookies across portals
      clearAuthCookies(res);

      const result = await authService.logout(userId, refreshToken);
      sendSuccess(res, result, "Logged out successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
