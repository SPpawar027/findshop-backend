import type { Response, NextFunction } from "express";
import { dashboardService } from "./dashboard.service";
import { Shop } from "../shops/shop.model";
import { sendSuccess } from "../../core/utils/response";
import { BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError } from "../../core/errors/AppError";
import type { AuthenticatedRequest } from "../../core/middlewares/auth.middleware";

export class DashboardController {
  /**
   * GET /api/dashboard/superadmin
   * Delivers optimized real platform analytics, KPI metrics, growth graphs, and recent activities.
   */
  async getSuperAdminDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required to access Super Admin dashboard");
      }

      if (req.user.role !== "super_admin") {
        throw new ForbiddenError("Super Admin privileges required to view platform overview");
      }

      const timeRange = (req.query.timeRange as "3m" | "6m" | "1y") || "6m";
      const data = await dashboardService.getSuperAdminDashboard(timeRange);

      sendSuccess(res, data, "Super Admin dashboard metrics loaded successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dashboard/shop
   * GET /api/dashboard/shop/:shopId
   * Delivers optimized real store metrics, catalog breakdown, 7-day performance trend, and stock alerts.
   */
  async getShopDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required to access store dashboard");
      }

      let shopId: number;

      if (req.params.shopId) {
        shopId = Number(req.params.shopId);
        if (isNaN(shopId)) {
          throw new BadRequestError("Valid shopId is required");
        }
      } else {
        // Resolve shop owned by authenticated user
        const userShop = await Shop.findOne({
          where: { ownerId: req.user.id },
          attributes: ["id"],
        });

        if (!userShop) {
          // If super_admin, default to first available shop
          if (req.user.role === "super_admin") {
            const firstShop = await Shop.findOne({ attributes: ["id"], order: [["id", "ASC"]] });
            if (firstShop) {
              shopId = firstShop.id;
            } else {
              sendSuccess(res, {
                hasShop: false,
                profile: null,
                metrics: {
                  totalProducts: 0,
                  inStockProducts: 0,
                  lowStockProducts: 0,
                  outOfStockProducts: 0,
                  activeCampaigns: 0,
                  activeCategoriesCount: 0,
                  totalViews: 0,
                  totalClicks: 0,
                  directionsClicks: 0,
                  callClicks: 0,
                  wishlistAdds: 0,
                  ratingAverage: 0,
                  totalReviews: 0,
                },
                recentActivity: [],
                performanceTrend: [],
                inventorySummary: { healthyStock: 0, lowStock: 0, outOfStock: 0 },
                stockAlerts: [],
                catalogOverview: { totalCategories: 0, featuredProducts: 0 },
              }, "Store dashboard initialized");
              return;
            }
          } else {
            sendSuccess(res, {
              hasShop: false,
              profile: null,
              metrics: {
                totalProducts: 0,
                inStockProducts: 0,
                lowStockProducts: 0,
                outOfStockProducts: 0,
                activeCampaigns: 0,
                activeCategoriesCount: 0,
                totalViews: 0,
                totalClicks: 0,
                directionsClicks: 0,
                callClicks: 0,
                wishlistAdds: 0,
                ratingAverage: 0,
                totalReviews: 0,
              },
              recentActivity: [],
              performanceTrend: [],
              inventorySummary: { healthyStock: 0, lowStock: 0, outOfStock: 0 },
              stockAlerts: [],
              catalogOverview: { totalCategories: 0, featuredProducts: 0 },
            }, "No store associated with your merchant account yet.");
            return;
          }
        } else {
          shopId = userShop.id;
        }
      }

      const data = await dashboardService.getShopDashboard(shopId, req.user.id, req.user.role);

      sendSuccess(res, data, "Store dashboard metrics loaded successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();

