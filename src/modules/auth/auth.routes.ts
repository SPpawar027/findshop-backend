import { Router } from "express";
import { authController } from "./auth.controller";
import { authMiddleware, optionalAuthMiddleware } from "../../core/middlewares/auth.middleware";
import { authOtpRateLimiter } from "../../core/middlewares/authRateLimiter.middleware";

export const authRouter = Router();

authRouter.post("/register", (req, res, next) => authController.register(req, res, next));
authRouter.post("/login", (req, res, next) => authController.login(req, res, next));
authRouter.post("/google", (req, res, next) => authController.googleLogin(req, res, next));
authRouter.post("/verify-otp", (req, res, next) => authController.verifyEmailOtp(req, res, next));
authRouter.post("/resend-otp", authOtpRateLimiter, (req, res, next) => authController.resendEmailOtp(req, res, next));
authRouter.post("/refresh", (req, res, next) => authController.refreshToken(req, res, next));
authRouter.post("/logout", optionalAuthMiddleware, (req, res, next) => authController.logout(req, res, next));
authRouter.get("/me", authMiddleware, (req, res, next) => authController.getMe(req, res, next));
authRouter.post("/forgot-password", authOtpRateLimiter, (req, res, next) => authController.forgotPassword(req, res, next));
authRouter.post("/reset-password", (req, res, next) => authController.resetPassword(req, res, next));
authRouter.post("/reset-password-otp", (req, res, next) => authController.resetPasswordWithOtp(req, res, next));
authRouter.post("/set-password", authMiddleware, (req, res, next) => authController.setPassword(req, res, next));
