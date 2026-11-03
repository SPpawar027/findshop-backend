import type { Response, NextFunction } from "express";
import { analyticsService } from "./analytics.service";
import { sendSuccess } from "../../core/utils/response";
import { BadRequestError, UnauthorizedError, ForbiddenError } from "../../core/errors/AppError";
import type { AuthenticatedRequest } from "../../core/middlewares/auth.middleware";

export class AnalyticsController {
  /**
   * POST /api/analytics/events
   * Track customer discovery and engagement events (shop views, direction clicks, call clicks, product views, wishlist adds)
   */
  async trackEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { shopId, eventType, productId, visitorId, platform, metadata } = req.body;

      if (!shopId) {
        throw new BadRequestError("shopId is required");
      }

      if (!eventType) {
        throw new BadRequestError("eventType is required");
      }

      if (!visitorId) {
        throw new BadRequestError("visitorId is required");
      }

      const result = await analyticsService.trackEvent(
        {
          shopId: Number(shopId),
          eventType,
          productId: productId ? Number(productId) : undefined,
          visitorId: String(visitorId),
          platform,
          metadata,
        },
        req.user
      );

      sendSuccess(res, result, "Analytics event processed successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/analytics/shop/:shopId/summary
   * Summary KPI cards and comparative growth metrics for Shopkeeper
   */
  async getShopSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication is required to view shop analytics");
      }

      const shopId = Number(req.params.shopId);
      if (isNaN(shopId)) {
        throw new BadRequestError("Valid shopId is required");
      }

      await analyticsService.verifyShopAccess(req.user, shopId);

      const period = String(req.query.period || "7d");
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const summary = await analyticsService.getShopSummary(shopId, period, startDate, endDate);
      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/analytics/shop/:shopId/charts
   * Time series daily trend and platform breakdown
   */
  async getShopCharts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication is required to view shop charts");
      }

      const shopId = Number(req.params.shopId);
      if (isNaN(shopId)) {
        throw new BadRequestError("Valid shopId is required");
      }

      await analyticsService.verifyShopAccess(req.user, shopId);

      const period = String(req.query.period || "7d");
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const charts = await analyticsService.getShopCharts(shopId, period, startDate, endDate);
      sendSuccess(res, charts);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/analytics/shop/:shopId/top-products
   * Top viewed products and wishlist conversions
   */
  async getShopTopProducts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication is required to view top products");
      }

      const shopId = Number(req.params.shopId);
      if (isNaN(shopId)) {
        throw new BadRequestError("Valid shopId is required");
      }

      await analyticsService.verifyShopAccess(req.user, shopId);

      const period = String(req.query.period || "7d");
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 5;

      const topProducts = await analyticsService.getShopTopProducts(shopId, period, startDate, endDate, limit);
      sendSuccess(res, topProducts);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/analytics/admin/overview
   * Platform-wide metrics for Super Admin
   */
  async getAdminOverview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      if (req.user.role !== "super_admin") {
        throw new ForbiddenError("Super Admin privileges required to view platform analytics");
      }

      const period = String(req.query.period || "30d");
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const overview = await analyticsService.getAdminOverview(period, startDate, endDate);
      sendSuccess(res, overview);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/analytics/admin/top-shops
   * Platform-wide leaderboard of shops for Super Admin
   */
  async getAdminTopShops(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      if (req.user.role !== "super_admin") {
        throw new ForbiddenError("Super Admin privileges required to view top shops");
      }

      const period = String(req.query.period || "30d");
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const topShops = await analyticsService.getAdminTopShops(period, limit, startDate, endDate);
      sendSuccess(res, topShops);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/analytics/aggregate-daily
   * Idempotent daily aggregation trigger
   */
  async triggerDailyAggregation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== "super_admin") {
        throw new ForbiddenError("Super Admin privileges required to trigger aggregation");
      }

      const targetDate = req.body.targetDate ? String(req.body.targetDate) : undefined;
      const result = await analyticsService.runDailyAggregation(targetDate);
      sendSuccess(res, result, "Daily analytics aggregated successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();

