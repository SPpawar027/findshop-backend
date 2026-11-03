import { Router } from "express";
import { analyticsController } from "./analytics.controller";
import { authMiddleware, optionalAuthMiddleware } from "../../core/middlewares/auth.middleware";

export const analyticsRouter = Router();

// 1. Ingest Event (Public / Optional Auth for guest + logged-in users)
analyticsRouter.post("/events", optionalAuthMiddleware, (req, res, next) =>
  analyticsController.trackEvent(req, res, next)
);

// 2. Shopkeeper Analytics (Requires Auth & Shop Ownership or Super Admin)
analyticsRouter.get("/shop/:shopId/summary", authMiddleware, (req, res, next) =>
  analyticsController.getShopSummary(req, res, next)
);

analyticsRouter.get("/shop/:shopId/charts", authMiddleware, (req, res, next) =>
  analyticsController.getShopCharts(req, res, next)
);

analyticsRouter.get("/shop/:shopId/top-products", authMiddleware, (req, res, next) =>
  analyticsController.getShopTopProducts(req, res, next)
);

// 3. Super Admin Platform Analytics (Requires Super Admin Role)
analyticsRouter.get("/admin/overview", authMiddleware, (req, res, next) =>
  analyticsController.getAdminOverview(req, res, next)
);

analyticsRouter.get("/admin/top-shops", authMiddleware, (req, res, next) =>
  analyticsController.getAdminTopShops(req, res, next)
);

// 4. Daily Aggregation Job Trigger (Super Admin or Internal Cron)
analyticsRouter.post("/aggregate-daily", authMiddleware, (req, res, next) =>
  analyticsController.triggerDailyAggregation(req, res, next)
);

