import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { sendSuccess, sendCreated } from "../../core/utils/response";
import { BadRequestError } from "../../core/errors/AppError";
import type { AuthenticatedRequest } from "../../core/middlewares/auth.middleware";

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password, phone, role } = req.body;
      if (!name || !email || !password) {
        throw new BadRequestError("Name, email, and password are required");
      }

      const result = await authService.register({ name, email, password, phone, role });
      sendCreated(res, result, "Account registered successfully");
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        throw new BadRequestError("Email and password are required");
      }

      const result = await authService.login({ email, password });
      sendSuccess(res, result, "Logged in successfully");
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
}

export const authController = new AuthController();
