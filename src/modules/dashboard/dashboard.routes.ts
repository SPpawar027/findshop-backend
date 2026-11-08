import { Router } from "express";
import { dashboardController } from "./dashboard.controller";
import { authMiddleware, requireRole } from "../../core/middlewares/auth.middleware";

export const dashboardRouter = Router();

// Super Admin Platform Overview Dashboard
dashboardRouter.get(
  "/superadmin",
  authMiddleware,
  requireRole(["super_admin"]),
  (req, res, next) => dashboardController.getSuperAdminDashboard(req, res, next)
);

// Shopkeeper Store Dashboard (auto-resolves authenticated merchant's store)
dashboardRouter.get(
  "/shop",
  authMiddleware,
  requireRole(["shop_admin", "super_admin"]),
  (req, res, next) => dashboardController.getShopDashboard(req, res, next)
);

// Shopkeeper Store Dashboard by specific shopId
dashboardRouter.get(
  "/shop/:shopId",
  authMiddleware,
  (req, res, next) => dashboardController.getShopDashboard(req, res, next)
);

