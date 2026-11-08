import type { Request, Response, NextFunction } from "express";
import { userService } from "./user.service";
import { sendSuccess } from "../../core/utils/response";
import { BadRequestError } from "../../core/errors/AppError";

export class UserController {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let user
      if (req.params.id) {
        const id = Number(req.params.id);
        if (isNaN(id)) {
          throw new BadRequestError("Invalid user ID");
        }
        user = await userService.getById(id);
      } else {
        user = await userService.getAll();
      }
      sendSuccess(res, user, "User fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new BadRequestError("Invalid user ID");
      }
      const user = await userService.update(id, req.body);
      sendSuccess(res, user, "User updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as any;
      const id = Number(authReq.user?.id);
      if (!id || isNaN(id)) {
        throw new BadRequestError("User authentication required");
      }
      const user = await userService.update(id, req.body);
      sendSuccess(res, user, "Profile updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new BadRequestError("Invalid user ID");
      }
      await userService.delete(id);
      sendSuccess(res, null, "User deactivated successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
