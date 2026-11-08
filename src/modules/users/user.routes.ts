import { Router } from "express";
import { userController } from "./user.controller";
import { authMiddleware } from "../../core/middlewares/auth.middleware";

export const userRouter = Router();

userRouter.put("/profile", authMiddleware, (req, res, next) => userController.updateProfile(req, res, next));
userRouter.get("/", (req, res, next) => userController.getById(req, res, next));
userRouter.get("/:id", (req, res, next) => userController.getById(req, res, next));
userRouter.put("/:id", (req, res, next) => userController.update(req, res, next));
userRouter.delete("/:id", (req, res, next) => userController.delete(req, res, next));
