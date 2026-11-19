import { Router } from "express";
import { userController } from "./user.controller";
import { authMiddleware, requireRole } from "../../core/middlewares/auth.middleware";

export const userRouter = Router();

userRouter.put("/profile", authMiddleware, (req, res, next) => userController.updateProfile(req, res, next));
userRouter.get("/", authMiddleware, requireRole(["super_admin"]), (req, res, next) => userController.getById(req, res, next));
userRouter.get("/:id", authMiddleware, (req, res, next) => userController.getById(req, res, next));
userRouter.put("/:id", authMiddleware, (req, res, next) => userController.update(req, res, next));
userRouter.delete("/me/account", authMiddleware, (req, res, next) => userController.deleteSelf(req, res, next));
userRouter.delete("/:id", authMiddleware, requireRole(["super_admin"]), (req, res, next) => userController.delete(req, res, next));
