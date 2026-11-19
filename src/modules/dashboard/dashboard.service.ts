import { Op, fn, col, literal } from "sequelize";
import { sequelize } from "../../config/database";
import { Shop } from "../shops/shop.model";
import { User } from "../users/user.model";
import { Product } from "../products/product.model";
import { Review } from "../reviews/review.model";
import { ShopAnalyticsDaily } from "../analytics/shopAnalyticsDaily.model";
import { ShopAnalyticsEvent } from "../analytics/shopAnalyticsEvent.model";
import { NotFoundError, ForbiddenError } from "../../core/errors/AppError";
import { getFullMediaUrl, formatMediaUrls } from "../../core/utils/media";

export interface SuperAdminDashboardData {
  metrics: {
    totalShops: number;
    activeShops: number;
    pendingShops: number;
    suspendedShops: number;
    totalUsers: number;
    activeUsers: number;
    customerUsers: number;
    shopAdminUsers: number;
    totalProducts: number;
    liveProducts: number;
    lowStockProducts: number;
    totalReviews: number;
    averageRating: number;
    reportedReviews: number;
  };
  platformGrowth: Array<{
    month: string;
    year: number;
    shops: number;
    users: number;
    interactions: number;
    orders: number; // Backwards-compatible alias for interactions
    newShops: number;
    newUsers: number;
    newInteractions: number;
  }>;
  recentShops: Array<Record<string, unknown>>;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    subtitle: string;
    timeAgo: string;
    actionText: string;
    targetUrl: string;
    timestamp: string;
  }>;
}

export interface ShopDashboardData {
  profile: Record<string, unknown>;
  metrics: {
    totalProducts: number;
    inStockProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    activeCampaigns: number;
    activeCategoriesCount: number;
    totalViews: number;
    totalClicks: number;
    directionsClicks: number;
    callClicks: number;
    wishlistAdds: number;
    averageRating: number;
    reviewCount: number;
  };
  performanceData: {
    views: Array<{ day: string; date: string; thisWeek: number; lastWeek: number }>;
    clicks: Array<{ day: string; date: string; thisWeek: number; lastWeek: number }>;
    inquiries: Array<{ day: string; date: string; thisWeek: number; lastWeek: number }>;
  };
  lowStockItems: Array<Record<string, unknown>>;
  recentProducts: Array<Record<string, unknown>>;
  recentReviews: Array<Record<string, unknown>>;
}

export class DashboardService {
  /**
   * Optimized Super Admin Dashboard
   * Leverages SQL counts and parallel execution to minimize database roundtrips.
   */
  async getSuperAdminDashboard(timeRange: "3m" | "6m" | "1y" = "6m"): Promise<SuperAdminDashboardData> {
    const monthsCount = timeRange === "3m" ? 3 : timeRange === "1y" ? 12 : 6;

    // 1. Parallel KPI Counts
    const [
      totalShops,
      activeShops,
      pendingShops,
      suspendedShops,
      totalUsers,
      activeUsers,
      customerUsers,
      shopAdminUsers,
      totalProducts,
      liveProducts,
      lowStockProducts,
      totalReviews,
      reportedReviews,
      ratingAggregate,
      recentShopsList,
      recentUsersList,
      recentReviewsList,
    ] = await Promise.all([
      Shop.count(),
      Shop.count({ where: { isVerified: true, isOpen: true } }),
      Shop.count({ where: { isVerified: false } }),
      Shop.count({ where: { isVerified: true, isOpen: false } }),
      User.count(),
      User.count({ where: { isActive: true } }),
      User.count({ where: { role: "customer" } }),
      User.count({ where: { role: "shop_admin" } }),
      Product.count(),
      Product.count({ where: { isAvailable: true } }),
      Product.count({ where: { stockQuantity: { [Op.lt]: 10 } } }),
      Review.count(),
      Review.count({ where: { isReported: true } }),
      Review.findOne({
        attributes: [[fn("AVG", col("rating")), "avgRating"]],
        raw: true,
      }) as unknown as Promise<{ avgRating: string | number | null } | null>,
      Shop.findAll({
        order: [["createdAt", "DESC"]],
        limit: 10,
        include: [
          {
            model: User,
            as: "owner",
            attributes: ["id", "name", "email", "phone"],
          },
        ],
      }),
      User.findAll({
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: ["id", "name", "email", "role", "createdAt"],
      }),
      Review.findAll({
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: ["id", "rating", "comment", "authorName", "createdAt", "shopId"],
        include: [
          {
            model: Shop,
            as: "shop",
            attributes: ["id", "name", "city"],
          },
        ],
      }),
    ]);

    const avgRatingRaw = ratingAggregate?.avgRating;
    const averageRating = avgRatingRaw ? Number(Number(avgRatingRaw).toFixed(1)) : 5.0;

    // 2. Real Monthly Growth Calculation (for the past N months)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthsData: Array<{
      month: string;
      year: number;
      startDate: Date;
      endDate: Date;
    }> = [];

    for (let i = monthsCount - 1; i >= 0; i--) {
      const targetDate = new Date(currentYear, currentMonth - i, 1);
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth();

      const startDate = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
      const isCurrentMonth = i === 0;
      const endDate = isCurrentMonth
        ? now
        : new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

      const monthLabel = startDate.toLocaleString("en-US", { month: "short" });
      monthsData.push({
        month: monthLabel,
        year: targetYear,
        startDate,
        endDate,
      });
    }

    const growthPromises = monthsData.map(async ({ month, year, startDate, endDate }) => {
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      // 1. Cumulative counts (up to endDate)
      const [
        shopsUpToDate,
        usersUpToDate,
        reviewsUpToDate,
        dirClicksTotal,
        callClicksTotal,
        waClicksTotal,
        wishlistTotal,
        eventsTotal,
      ] = await Promise.all([
        Shop.count({ where: { createdAt: { [Op.lte]: endDate } } }),
        User.count({ where: { createdAt: { [Op.lte]: endDate } } }),
        Review.count({ where: { createdAt: { [Op.lte]: endDate } } }),
        ShopAnalyticsDaily.sum("directionsClicks", {
          where: { analyticsDate: { [Op.lte]: endDateStr } },
        }),
        ShopAnalyticsDaily.sum("callClicks", {
          where: { analyticsDate: { [Op.lte]: endDateStr } },
        }),
        ShopAnalyticsDaily.sum("whatsappClicks", {
          where: { analyticsDate: { [Op.lte]: endDateStr } },
        }),
        ShopAnalyticsDaily.sum("wishlistAdds", {
          where: { analyticsDate: { [Op.lte]: endDateStr } },
        }),
        ShopAnalyticsEvent.count({
          where: {
            eventType: { [Op.in]: ["directions_click", "call_click", "whatsapp_click", "wishlist_add"] },
            createdAt: { [Op.lte]: endDate },
          },
        }),
      ]);

      // 2. Monthly New additions (between startDate and endDate)
      const [
        newShops,
        newUsers,
        newReviews,
        dirClicksMonth,
        callClicksMonth,
        waClicksMonth,
        wishlistMonth,
        eventsMonth,
      ] = await Promise.all([
        Shop.count({ where: { createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } } }),
        User.count({ where: { createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } } }),
        Review.count({ where: { createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } } }),
        ShopAnalyticsDaily.sum("directionsClicks", {
          where: { analyticsDate: { [Op.gte]: startDateStr, [Op.lte]: endDateStr } },
        }),
        ShopAnalyticsDaily.sum("callClicks", {
          where: { analyticsDate: { [Op.gte]: startDateStr, [Op.lte]: endDateStr } },
        }),
        ShopAnalyticsDaily.sum("whatsappClicks", {
          where: { analyticsDate: { [Op.gte]: startDateStr, [Op.lte]: endDateStr } },
        }),
        ShopAnalyticsDaily.sum("wishlistAdds", {
          where: { analyticsDate: { [Op.gte]: startDateStr, [Op.lte]: endDateStr } },
        }),
        ShopAnalyticsEvent.count({
          where: {
            eventType: { [Op.in]: ["directions_click", "call_click", "whatsapp_click", "wishlist_add"] },
            createdAt: { [Op.gte]: startDate, [Op.lte]: endDate },
          },
        }),
      ]);

      const dailyInteractionsCumulative =
        (Number(dirClicksTotal) || 0) +
        (Number(callClicksTotal) || 0) +
        (Number(waClicksTotal) || 0) +
        (Number(wishlistTotal) || 0);
      const totalInteractionsCumulative =
        Math.max(dailyInteractionsCumulative, Number(eventsTotal) || 0) + reviewsUpToDate;

      const dailyInteractionsMonth =
        (Number(dirClicksMonth) || 0) +
        (Number(callClicksMonth) || 0) +
        (Number(waClicksMonth) || 0) +
        (Number(wishlistMonth) || 0);
      const totalInteractionsMonth =
        Math.max(dailyInteractionsMonth, Number(eventsMonth) || 0) + newReviews;

      return {
        month,
        year,
        shops: shopsUpToDate,
        users: usersUpToDate,
        interactions: totalInteractionsCumulative,
        orders: totalInteractionsCumulative, // alias for backwards compatibility
        newShops,
        newUsers,
        newInteractions: totalInteractionsMonth,
      };
    });

    const platformGrowth = await Promise.all(growthPromises);

    // 3. Synthesize Real Recent Activities
    const recentActivities: SuperAdminDashboardData["recentActivities"] = [];

    recentShopsList.forEach((s) => {
      recentActivities.push({
        id: `shop-${s.id}`,
        type: "shop_registration",
        title: `Store registered: ${s.name}`,
        subtitle: `${s.category} in ${s.city} • Owned by ${s.owner?.name || s.phone || "Merchant"}`,
        timeAgo: this.formatRelativeTime(s.createdAt),
        actionText: s.isVerified ? "Inspect" : "Review Approval",
        targetUrl: `/shops`,
        timestamp: s.createdAt.toISOString(),
      });
    });

    recentReviewsList.forEach((r) => {
      const shopName = r.shop?.name || `Shop #${r.shopId}`;
      recentActivities.push({
        id: `review-${r.id}`,
        type: "review_posted",
        title: `${r.rating}★ Review for ${shopName}`,
        subtitle: `"${r.comment?.slice(0, 50) || "Customer feedback"}" by ${r.authorName || "Shopper"}`,
        timeAgo: this.formatRelativeTime(r.createdAt),
        actionText: "View Review",
        targetUrl: `/reviews`,
        timestamp: r.createdAt.toISOString(),
      });
    });

    recentUsersList.forEach((u) => {
      recentActivities.push({
        id: `user-${u.id}`,
        type: "user_signup",
        title: `New ${u.role === "shop_admin" ? "Merchant" : "Customer"} onboarded: ${u.name}`,
        subtitle: u.email,
        timeAgo: this.formatRelativeTime(u.createdAt),
        actionText: "Manage Users",
        targetUrl: `/users`,
        timestamp: u.createdAt.toISOString(),
      });
    });

    // Sort combined activities by latest timestamp
    recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      metrics: {
        totalShops,
        activeShops,
        pendingShops,
        suspendedShops,
        totalUsers,
        activeUsers,
        customerUsers,
        shopAdminUsers,
        totalProducts,
        liveProducts,
        lowStockProducts,
        totalReviews,
        averageRating,
        reportedReviews,
      },
      platformGrowth,
      recentShops: recentShopsList.map((s) => formatMediaUrls(s.toJSON())),
      recentActivities: recentActivities.slice(0, 10),
    };
  }

  /**
   * Optimized Shopkeeper Dashboard
   * Aggregates live catalog, real engagement (views, clicks, calls), and stock health.
   */
  async getShopDashboard(shopId: number, authenticatedUserId?: number, role?: string): Promise<ShopDashboardData> {
    const shop = await Shop.findByPk(shopId, {
      include: [
        {
          model: User,
          as: "owner",
          attributes: ["id", "name", "email", "phone"],
        },
      ],
    });

    if (!shop) {
      throw new NotFoundError(`Shop with ID ${shopId} not found`);
    }

    // Role check: non-super_admin users can only view their own store dashboard
    if (role !== "super_admin" && authenticatedUserId && shop.ownerId !== authenticatedUserId) {
      throw new ForbiddenError("Access denied: You can only view your own store dashboard");
    }

    // 1. Parallel Catalog & Inventory Calculations
    const [
      totalProducts,
      inStockProducts,
      lowStockProducts,
      outOfStockProducts,
      activeCampaigns,
      distinctCategories,
      lowStockItems,
      recentProducts,
      recentReviews,
      analyticsSumDaily,
      realtimeEventCounts,
    ] = await Promise.all([
      Product.count({ where: { shopId } }),
      Product.count({ where: { shopId, stockQuantity: { [Op.gte]: 10 }, isAvailable: true } }),
      Product.count({ where: { shopId, stockQuantity: { [Op.gt]: 0, [Op.lt]: 10 } } }),
      Product.count({ where: { shopId, stockQuantity: 0 } }),
      Product.count({
        where: {
          shopId,
          isAvailable: true,
          [Op.and]: [
            literal(`"Product"."discountPrice" IS NOT NULL AND "Product"."discountPrice" > 0 AND "Product"."discountPrice" < "Product"."price"`),
          ],
        },
      }),
      Product.findAll({
        where: { shopId },
        attributes: [[fn("DISTINCT", col("category")), "category"]],
        raw: true,
      }) as unknown as Promise<Array<{ category: string }>>,
      Product.findAll({
        where: {
          shopId,
          [Op.or]: [{ stockQuantity: { [Op.lt]: 10 } }, { isAvailable: false }],
        },
        order: [["stockQuantity", "ASC"]],
        limit: 6,
      }),
      Product.findAll({
        where: { shopId },
        order: [["updatedAt", "DESC"]],
        limit: 8,
      }),
      Review.findAll({
        where: { shopId },
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: ["id", "rating", "comment", "authorName", "createdAt", "merchantReply"],
      }),
      ShopAnalyticsDaily.findOne({
        where: { shopId },
        attributes: [
          [fn("SUM", col("total_views")), "totalViews"],
          [fn("SUM", col("directions_clicks")), "directionsClicks"],
          [fn("SUM", col("call_clicks")), "callClicks"],
          [fn("SUM", col("product_views")), "productViews"],
          [fn("SUM", col("wishlist_adds")), "wishlistAdds"],
        ],
        raw: true,
      }) as unknown as Promise<{
        totalViews: string | number | null;
        directionsClicks: string | number | null;
        callClicks: string | number | null;
        productViews: string | number | null;
        wishlistAdds: string | number | null;
      } | null>,
      ShopAnalyticsEvent.findAll({
        where: { shopId },
        attributes: ["eventType", [fn("COUNT", col("id")), "count"]],
        group: ["eventType"],
        raw: true,
      }) as unknown as Promise<Array<{ eventType: string; count: string | number }>>,
    ]);

    // Consolidate real analytics
    let totalViews = Number(analyticsSumDaily?.totalViews) || 0;
    let directionsClicks = Number(analyticsSumDaily?.directionsClicks) || 0;
    let callClicks = Number(analyticsSumDaily?.callClicks) || 0;
    let wishlistAdds = Number(analyticsSumDaily?.wishlistAdds) || 0;

    // Supplement with unaggregated raw events if present
    const eventMap: Record<string, number> = {};
    realtimeEventCounts.forEach((e) => {
      eventMap[e.eventType] = Number(e.count) || 0;
    });

    totalViews = Math.max(totalViews, (eventMap["shop_view"] || 0) + (eventMap["product_view"] || 0));
    directionsClicks = Math.max(directionsClicks, eventMap["directions_click"] || 0);
    callClicks = Math.max(callClicks, eventMap["call_click"] || 0);
    wishlistAdds = Math.max(wishlistAdds, eventMap["wishlist_add"] || 0);
    const totalClicks = directionsClicks + callClicks;

    // 2. Compute Real 7-Day Performance Trends (views, clicks, inquiries)
    const days: string[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const performanceViews: ShopDashboardData["performanceData"]["views"] = [];
    const performanceClicks: ShopDashboardData["performanceData"]["clicks"] = [];
    const performanceInquiries: ShopDashboardData["performanceData"]["inquiries"] = [];

    // Query daily records for this shop over the last 14 days (7 for this week, 7 for last week comparison)
    const today = new Date();
    const dateRangeStart = new Date(today);
    dateRangeStart.setDate(dateRangeStart.getDate() - 14);

    const dailyRecords = await ShopAnalyticsDaily.findAll({
      where: {
        shopId,
        analyticsDate: { [Op.gte]: dateRangeStart.toISOString().split("T")[0] },
      },
      raw: true,
    });

    const dailyMap: Record<string, { views: number; clicks: number; calls: number }> = {};
    dailyRecords.forEach((rec) => {
      dailyMap[rec.analyticsDate] = {
        views: (Number(rec.totalViews) || 0) + (Number(rec.productViews) || 0),
        clicks: Number(rec.directionsClicks) || 0,
        calls: Number(rec.callClicks) || 0,
      };
    });

    for (let i = 6; i >= 0; i--) {
      const thisDayDate = new Date(today);
      thisDayDate.setDate(thisDayDate.getDate() - i);
      const thisDayStr = thisDayDate.toISOString().split("T")[0];
      const dayLabel = days[thisDayDate.getDay()];

      const lastDayDate = new Date(thisDayDate);
      lastDayDate.setDate(lastDayDate.getDate() - 7);
      const lastDayStr = lastDayDate.toISOString().split("T")[0];

      const thisDayData = dailyMap[thisDayStr] || { views: 0, clicks: 0, calls: 0 };
      const lastDayData = dailyMap[lastDayStr] || { views: 0, clicks: 0, calls: 0 };

      performanceViews.push({
        day: dayLabel,
        date: thisDayStr,
        thisWeek: thisDayData.views,
        lastWeek: lastDayData.views,
      });

      performanceClicks.push({
        day: dayLabel,
        date: thisDayStr,
        thisWeek: thisDayData.clicks,
        lastWeek: lastDayData.clicks,
      });

      performanceInquiries.push({
        day: dayLabel,
        date: thisDayStr,
        thisWeek: thisDayData.calls,
        lastWeek: lastDayData.calls,
      });
    }

    return {
      profile: {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        category: shop.category,
        description: shop.description,
        address: shop.address,
        city: shop.city,
        state: shop.state,
        postalCode: shop.postalCode,
        latitude: shop.latitude,
        longitude: shop.longitude,
        phone: shop.phone,
        email: shop.email,
        rating: shop.rating,
        reviewCount: shop.reviewCount,
        isVerified: shop.isVerified,
        isOpen: shop.isOpen,
        openingHours: shop.openingHours,
        bannerUrl: getFullMediaUrl(shop.bannerUrl),
        logoUrl: getFullMediaUrl(shop.logoUrl),
        ownerName: shop.owner?.name,
        ownerEmail: shop.owner?.email,
        ownerPhone: shop.owner?.phone,
      },
      metrics: {
        totalProducts,
        inStockProducts,
        lowStockProducts,
        outOfStockProducts,
        activeCampaigns,
        activeCategoriesCount: distinctCategories.length,
        totalViews,
        totalClicks,
        directionsClicks,
        callClicks,
        wishlistAdds,
        averageRating: Number(shop.rating) || 5.0,
        reviewCount: Number(shop.reviewCount) || 0,
      },
      performanceData: {
        views: performanceViews,
        clicks: performanceClicks,
        inquiries: performanceInquiries,
      },
      lowStockItems: lowStockItems.map((p) => formatMediaUrls(p.toJSON())),
      recentProducts: recentProducts.map((p) => formatMediaUrls(p.toJSON())),
      recentReviews: recentReviews.map((r) => r.toJSON()),
    };
  }

  /**
   * Helper to format relative time (e.g. "5m ago", "2h ago", "Yesterday")
   */
  private formatRelativeTime(date: Date): string {
    const diffMs = Date.now() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }
}

export const dashboardService = new DashboardService();
