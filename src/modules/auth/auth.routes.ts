import { Router } from "express";
import { authController } from "./auth.controller";
import { authMiddleware } from "../../core/middlewares/auth.middleware";

export const authRouter = Router();

authRouter.post("/register", (req, res, next) => authController.register(req, res, next));
authRouter.post("/login", (req, res, next) => authController.login(req, res, next));
authRouter.get("/me", authMiddleware, (req, res, next) => authController.getMe(req, res, next));
