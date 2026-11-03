import { Op, fn, col, literal } from "sequelize";
import { Shop } from "../shops/shop.model";
import { Product } from "../products/product.model";
import { ShopAnalyticsEvent, AnalyticsEventType, AnalyticsPlatform } from "./shopAnalyticsEvent.model";
import { ShopAnalyticsDaily } from "./shopAnalyticsDaily.model";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../core/errors/AppError";
import type { AuthenticatedUser } from "../../core/middlewares/auth.middleware";

export interface TrackEventDto {
  shopId: number;
  eventType: AnalyticsEventType;
  productId?: number | null;
  visitorId: string;
  userId?: number | null;
  platform?: AnalyticsPlatform;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsDateRange {
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
  prevStartDate: Date;
  prevEndDate: Date;
}

export interface PercentageChange {
  change: number;
  formatted: string;
  isPositive: boolean;
}

export interface ShopSummaryMetrics {
  totalViews: number;
  uniqueVisitors: number;
  directionsClicks: number;
  callClicks: number;
  productViews: number;
  wishlistAdds: number;
  offerViews: number;
  offerRedemptions: number;
}

export interface ShopSummaryResponse {
  shopId: number;
  shopName: string;
  period: string;
  dateRange: {
    start: string;
    end: string;
  };
  metrics: ShopSummaryMetrics;
  comparisons: {
    totalViews: PercentageChange;
    uniqueVisitors: PercentageChange;
    directionsClicks: PercentageChange;
    callClicks: PercentageChange;
    productViews: PercentageChange;
  };
  disclaimer: string;
}

export class AnalyticsService {
  /**
   * Helper: Format Date to YYYY-MM-DD in Asia/Kolkata (IST: UTC+5:30)
   */
  public getISTDateString(d: Date = new Date()): string {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffsetMs);
    return istDate.toISOString().slice(0, 10);
  }

  /**
   * Helper: Parse Date Bounds for Period in Asia/Kolkata
   */
  public resolveDateRange(period: string, customStart?: string, customEnd?: string): AnalyticsDateRange {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowUtc = new Date();
    const nowIst = new Date(nowUtc.getTime() + istOffsetMs);

    let startIst: Date;
    let endIst = new Date(nowIst);

    if (period === "today") {
      startIst = new Date(nowIst);
      startIst.setUTCHours(0, 0, 0, 0);
    } else if (period === "30d") {
      startIst = new Date(nowIst);
      startIst.setUTCDate(startIst.getUTCDate() - 29);
      startIst.setUTCHours(0, 0, 0, 0);
    } else if (period === "month") {
      startIst = new Date(nowIst);
      startIst.setUTCDate(1);
      startIst.setUTCHours(0, 0, 0, 0);
    } else if (period === "custom" && customStart && customEnd) {
      startIst = new Date(`${customStart}T00:00:00.000Z`);
      endIst = new Date(`${customEnd}T23:59:59.999Z`);
    } else {
      // Default: 7d
      startIst = new Date(nowIst);
      startIst.setUTCDate(startIst.getUTCDate() - 6);
      startIst.setUTCHours(0, 0, 0, 0);
    }

    // Convert IST representation back to UTC dates for SQL queries
    const startDate = new Date(startIst.getTime() - istOffsetMs);
    const endDate = new Date(endIst.getTime() - istOffsetMs);

    // Calculate equivalent prior comparison period
    const durationMs = Math.max(endDate.getTime() - startDate.getTime(), 24 * 60 * 60 * 1000);
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

    return {
      startDate,
      endDate,
      startDateStr: startIst.toISOString().slice(0, 10),
      endDateStr: endIst.toISOString().slice(0, 10),
      prevStartDate,
      prevEndDate,
    };
  }

  /**
   * Safe percentage change calculator
   */
  public computePercentageChange(current: number, previous: number): PercentageChange {
    if (previous === 0) {
      if (current === 0) return { change: 0, formatted: "0%", isPositive: true };
      return { change: 100, formatted: "+100%", isPositive: true };
    }
    const pct = ((current - previous) / previous) * 100;
    const rounded = Math.round(pct * 10) / 10;
    const sign = rounded > 0 ? "+" : "";
    return {
      change: rounded,
      formatted: `${sign}${rounded}%`,
      isPositive: rounded >= 0,
    };
  }

  /**
   * Verify Shop Ownership
   */
  public async verifyShopAccess(user: AuthenticatedUser, shopId: number): Promise<Shop> {
    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with id ${shopId} not found`);
    }

    if (user.role !== "super_admin" && shop.ownerId !== user.id) {
      throw new ForbiddenError("You are not authorized to view analytics for this shop");
    }

    return shop;
  }

  /**
   * Track an Analytics Event
   * Features:
   * - Shop existence validation
   * - Self-view filtering (Shop owners viewing own shop are ignored)
   * - Super admin / internal test traffic filtering
   * - 30-second deduplication window for repeated actions
   * - Non-blocking safe execution
   */
  public async trackEvent(dto: TrackEventDto, authenticatedUser?: AuthenticatedUser): Promise<{
    recorded: boolean;
    reason?: string;
  }> {
    const { shopId, eventType, productId, visitorId, platform, metadata } = dto;

    if (!shopId || isNaN(shopId)) {
      throw new BadRequestError("Valid shopId is required");
    }

    if (!visitorId || visitorId.trim() === "") {
      throw new BadRequestError("visitorId is required for analytics tracking");
    }

    // 1. Verify Shop Exists
    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with ID ${shopId} does not exist`);
    }

    // 2. Identify User & Filter Self-Views / Super Admin Activity
    const userId = authenticatedUser?.id || dto.userId || null;
    const userRole = authenticatedUser?.role;

    if (userRole === "super_admin") {
      return { recorded: false, reason: "super_admin_preview_filtered" };
    }

    if (userId && shop.ownerId === userId) {
      return { recorded: false, reason: "shop_owner_self_view_filtered" };
    }

    // 3. Deduplicate events within 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const whereClause: any = {
      shopId,
      eventType,
      visitorId: visitorId.trim().slice(0, 100),
      createdAt: { [Op.gte]: thirtySecondsAgo },
    };

    if (productId) {
      whereClause.productId = productId;
    }

    const existingRecent = await ShopAnalyticsEvent.findOne({
      where: whereClause,
      order: [["createdAt", "DESC"]],
    });

    if (existingRecent) {
      return { recorded: false, reason: "duplicate_suppressed" };
    }

    // 4. Create raw event record
    await ShopAnalyticsEvent.create({
      shopId,
      userId,
      visitorId: visitorId.trim().slice(0, 100),
      productId: productId ? Number(productId) : null,
      eventType,
      platform: platform === "mobile" ? "mobile" : "website",
      metadata: metadata || null,
      createdAt: new Date(),
    });

    return { recorded: true };
  }

  /**
   * Internal helper: Query Metrics for a specific Date Range
   */
  private async queryPeriodMetrics(shopId: number, start: Date, end: Date): Promise<ShopSummaryMetrics> {
    // 1. Aggregate from raw events table for real-time accuracy
    const rawEvents = await ShopAnalyticsEvent.findAll({
      where: {
        shopId,
        createdAt: {
          [Op.between]: [start, end],
        },
      },
      attributes: [
        "eventType",
        [fn("COUNT", col("id")), "eventCount"],
        [fn("COUNT", fn("DISTINCT", col("visitor_id"))), "distinctVisitors"],
      ],
      group: ["eventType"],
      raw: true,
    });

    // 2. Compute overall distinct visitors across all events in window
    const overallVisitorsRes = await ShopAnalyticsEvent.findOne({
      where: {
        shopId,
        createdAt: {
          [Op.between]: [start, end],
        },
      },
      attributes: [[fn("COUNT", fn("DISTINCT", col("visitor_id"))), "totalUniqueVisitors"]],
      raw: true,
    });

    const metrics: ShopSummaryMetrics = {
      totalViews: 0,
      uniqueVisitors: Number((overallVisitorsRes as any)?.totalUniqueVisitors || 0),
      directionsClicks: 0,
      callClicks: 0,
      productViews: 0,
      wishlistAdds: 0,
      offerViews: 0,
      offerRedemptions: 0,
    };

    for (const row of rawEvents as any[]) {
      const type = row.eventType;
      const count = Number(row.eventCount || 0);

      switch (type) {
        case "shop_view":
          metrics.totalViews += count;
          break;
        case "directions_click":
          metrics.directionsClicks += count;
          break;
        case "call_click":
          metrics.callClicks += count;
          break;
        case "product_view":
          metrics.productViews += count;
          break;
        case "wishlist_add":
          metrics.wishlistAdds += count;
          break;
        case "offer_view":
          metrics.offerViews += count;
          break;
        case "offer_redeemed":
          metrics.offerRedemptions += count;
          break;
      }
    }

    return metrics;
  }

  /**
   * GET /api/analytics/shop/:shopId/summary
   */
  public async getShopSummary(
    shopId: number,
    period: string = "7d",
    customStart?: string,
    customEnd?: string
  ): Promise<ShopSummaryResponse> {
    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with id ${shopId} not found`);
    }

    const range = this.resolveDateRange(period, customStart, customEnd);
    const currentMetrics = await this.queryPeriodMetrics(shopId, range.startDate, range.endDate);
    const prevMetrics = await this.queryPeriodMetrics(shopId, range.prevStartDate, range.prevEndDate);

    return {
      shopId: shop.id,
      shopName: shop.name,
      period,
      dateRange: {
        start: range.startDateStr,
        end: range.endDateStr,
      },
      metrics: currentMetrics,
      comparisons: {
        totalViews: this.computePercentageChange(currentMetrics.totalViews, prevMetrics.totalViews),
        uniqueVisitors: this.computePercentageChange(currentMetrics.uniqueVisitors, prevMetrics.uniqueVisitors),
        directionsClicks: this.computePercentageChange(currentMetrics.directionsClicks, prevMetrics.directionsClicks),
        callClicks: this.computePercentageChange(currentMetrics.callClicks, prevMetrics.callClicks),
        productViews: this.computePercentageChange(currentMetrics.productViews, prevMetrics.productViews),
      },
      disclaimer: "Metrics represent customer online engagement and discovery on FindShopEasily, not confirmed physical footfall or sales.",
    };
  }

  /**
   * GET /api/analytics/shop/:shopId/charts
   */
  public async getShopCharts(
    shopId: number,
    period: string = "7d",
    customStart?: string,
    customEnd?: string
  ) {
    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with id ${shopId} not found`);
    }

    const range = this.resolveDateRange(period, customStart, customEnd);

    // Fetch all raw events in range
    const events = await ShopAnalyticsEvent.findAll({
      where: {
        shopId,
        createdAt: {
          [Op.between]: [range.startDate, range.endDate],
        },
      },
      attributes: ["eventType", "platform", "visitorId", "createdAt"],
      raw: true,
    });

    // Daily breakdown map keyed by IST date (YYYY-MM-DD)
    const dailyMap = new Map<
      string,
      {
        date: string;
        label: string;
        views: number;
        uniqueVisitors: Set<string>;
        directions: number;
        calls: number;
        productViews: number;
      }
    >();

    // Pre-populate days in range
    const cur = new Date(range.startDate);
    while (cur <= range.endDate) {
      const dateKey = this.getISTDateString(cur);
      const dayLabel = cur.toLocaleDateString("en-US", { weekday: "short" });
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          label: dayLabel,
          views: 0,
          uniqueVisitors: new Set<string>(),
          directions: 0,
          calls: 0,
          productViews: 0,
        });
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // Platform and Actions counters
    let mobileCount = 0;
    let websiteCount = 0;
    let otherCount = 0;

    for (const ev of events as any[]) {
      const istDateStr = this.getISTDateString(new Date(ev.createdAt));
      const entry = dailyMap.get(istDateStr);

      if (entry) {
        entry.uniqueVisitors.add(ev.visitorId);
        if (ev.eventType === "shop_view") entry.views += 1;
        else if (ev.eventType === "directions_click") entry.directions += 1;
        else if (ev.eventType === "call_click") entry.calls += 1;
        else if (ev.eventType === "product_view") entry.productViews += 1;
      }

      if (ev.platform === "mobile") mobileCount++;
      else if (ev.platform === "website") websiteCount++;
      else otherCount++;
    }

    const dailyBreakdown = Array.from(dailyMap.values()).map((item) => ({
      date: item.date,
      label: item.label,
      views: item.views,
      uniqueVisitors: item.uniqueVisitors.size,
      directions: item.directions,
      calls: item.calls,
      productViews: item.productViews,
    }));

    return {
      shopId,
      period,
      dailyBreakdown,
      platformBreakdown: {
        mobile: mobileCount,
        website: websiteCount,
        other: otherCount,
        total: mobileCount + websiteCount + otherCount,
      },
    };
  }

  /**
   * GET /api/analytics/shop/:shopId/top-products
   */
  public async getShopTopProducts(
    shopId: number,
    period: string = "7d",
    customStart?: string,
    customEnd?: string,
    limit: number = 5
  ) {
    const range = this.resolveDateRange(period, customStart, customEnd);

    // Group by product_id
    const productStats = await ShopAnalyticsEvent.findAll({
      where: {
        shopId,
        productId: { [Op.ne]: null },
        createdAt: {
          [Op.between]: [range.startDate, range.endDate],
        },
      },
      attributes: [
        "productId",
        [fn("COUNT", col("id")), "totalEvents"],
        [
          fn("SUM", literal("CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END")),
          "viewsCount",
        ],
        [
          fn("SUM", literal("CASE WHEN event_type = 'wishlist_add' THEN 1 ELSE 0 END")),
          "wishlistCount",
        ],
      ],
      group: ["productId"],
      order: [[literal("viewsCount"), "DESC"]],
      limit,
      raw: true,
    });

    if (productStats.length === 0) {
      return [];
    }

    const productIds = productStats.map((p: any) => p.productId);
    const products = await Product.findAll({
      where: { id: productIds },
      attributes: ["id", "name", "category", "price", "images"],
      raw: true,
    });

    const productMap = new Map(products.map((p: any) => [p.id, p]));

    return productStats.map((stat: any) => {
      const prod = productMap.get(stat.productId) || {};
      const views = Number(stat.viewsCount || 0);
      const wishlist = Number(stat.wishlistCount || 0);
      const conversion = views > 0 ? `${((wishlist / views) * 100).toFixed(1)}%` : "0.0%";

      return {
        productId: stat.productId,
        name: (prod as any).name || `Product #${stat.productId}`,
        category: (prod as any).category || "General",
        price: (prod as any).price || 0,
        images: (prod as any).images || [],
        views,
        wishlist,
        conversion,
      };
    });
  }

  /**
   * GET /api/analytics/admin/overview
   * Global platform metrics for Super Admin
   */
  public async getAdminOverview(period: string = "30d", customStart?: string, customEnd?: string) {
    const range = this.resolveDateRange(period, customStart, customEnd);

    const [events, prevEvents, totalShopsCount, activeShopsCount] = await Promise.all([
      ShopAnalyticsEvent.findAll({
        where: {
          createdAt: { [Op.between]: [range.startDate, range.endDate] },
        },
        attributes: [
          "eventType",
          "platform",
          "visitorId",
          "createdAt",
          "shopId",
        ],
        raw: true,
      }),
      ShopAnalyticsEvent.findAll({
        where: {
          createdAt: { [Op.between]: [range.prevStartDate, range.prevEndDate] },
        },
        attributes: ["eventType", "visitorId"],
        raw: true,
      }),
      Shop.count(),
      Shop.count({ where: { isOpen: true } }),
    ]);

    // Current period metrics
    let totalViews = 0;
    let directionsClicks = 0;
    let callClicks = 0;
    let productViews = 0;
    let wishlistAdds = 0;
    let mobileCount = 0;
    let websiteCount = 0;
    const uniqueVisitors = new Set<string>();

    for (const ev of events as any[]) {
      uniqueVisitors.add(ev.visitorId);
      if (ev.eventType === "shop_view") totalViews++;
      else if (ev.eventType === "directions_click") directionsClicks++;
      else if (ev.eventType === "call_click") callClicks++;
      else if (ev.eventType === "product_view") productViews++;
      else if (ev.eventType === "wishlist_add") wishlistAdds++;

      if (ev.platform === "mobile") mobileCount++;
      else websiteCount++;
    }

    // Previous period metrics
    let prevViews = 0;
    let prevDirections = 0;
    let prevCalls = 0;
    const prevVisitors = new Set<string>();

    for (const pev of prevEvents as any[]) {
      prevVisitors.add(pev.visitorId);
      if (pev.eventType === "shop_view") prevViews++;
      else if (pev.eventType === "directions_click") prevDirections++;
      else if (pev.eventType === "call_click") prevCalls++;
    }

    return {
      period,
      dateRange: {
        start: range.startDateStr,
        end: range.endDateStr,
      },
      totals: {
        totalViews,
        uniqueVisitors: uniqueVisitors.size,
        directionsClicks,
        callClicks,
        productViews,
        wishlistAdds,
        totalShops: totalShopsCount,
        activeShops: activeShopsCount,
      },
      comparisons: {
        totalViews: this.computePercentageChange(totalViews, prevViews),
        uniqueVisitors: this.computePercentageChange(uniqueVisitors.size, prevVisitors.size),
        directionsClicks: this.computePercentageChange(directionsClicks, prevDirections),
        callClicks: this.computePercentageChange(callClicks, prevCalls),
      },
      platformBreakdown: {
        mobile: mobileCount,
        website: websiteCount,
        total: mobileCount + websiteCount,
      },
    };
  }

  /**
   * GET /api/analytics/admin/top-shops
   * Top Performing Shops Leaderboard
   */
  public async getAdminTopShops(
    period: string = "30d",
    limit: number = 10,
    customStart?: string,
    customEnd?: string
  ) {
    const range = this.resolveDateRange(period, customStart, customEnd);

    const stats = await ShopAnalyticsEvent.findAll({
      where: {
        createdAt: { [Op.between]: [range.startDate, range.endDate] },
      },
      attributes: [
        "shopId",
        [fn("COUNT", col("id")), "totalEvents"],
        [fn("COUNT", fn("DISTINCT", col("visitor_id"))), "uniqueVisitors"],
        [
          fn("SUM", literal("CASE WHEN event_type = 'shop_view' THEN 1 ELSE 0 END")),
          "viewsCount",
        ],
        [
          fn("SUM", literal("CASE WHEN event_type = 'directions_click' THEN 1 ELSE 0 END")),
          "directionsCount",
        ],
        [
          fn("SUM", literal("CASE WHEN event_type = 'call_click' THEN 1 ELSE 0 END")),
          "callsCount",
        ],
      ],
      group: ["shopId"],
      order: [[literal("viewsCount"), "DESC"]],
      limit,
      raw: true,
    });

    if (stats.length === 0) {
      return [];
    }

    const shopIds = stats.map((s: any) => s.shopId);
    const shops = await Shop.findAll({
      where: { id: shopIds },
      attributes: ["id", "name", "category", "city", "locality", "logo"],
      raw: true,
    });

    const shopMap = new Map(shops.map((s: any) => [s.id, s]));

    return stats.map((s: any) => {
      const sh = shopMap.get(s.shopId) || {};
      return {
        shopId: s.shopId,
        shopName: (sh as any).name || `Shop #${s.shopId}`,
        category: (sh as any).category || "Retail",
        city: (sh as any).city || "Betul",
        locality: (sh as any).locality || "",
        logo: (sh as any).logo || null,
        totalViews: Number(s.viewsCount || 0),
        uniqueVisitors: Number(s.uniqueVisitors || 0),
        directionsClicks: Number(s.directionsCount || 0),
        callClicks: Number(s.callsCount || 0),
      };
    });
  }

  /**
   * Scheduled/Manual Daily Aggregation Job
   * Aggregates raw events into shop_analytics_daily table
   * Idempotent: re-running for the same date updates rather than duplicates records
   */
  public async runDailyAggregation(targetDateStr?: string): Promise<{
    processedDate: string;
    shopsAggregated: number;
  }> {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const targetDate = targetDateStr || (() => {
      // Default: Yesterday in IST
      const y = new Date(Date.now() + istOffsetMs);
      y.setUTCDate(y.getUTCDate() - 1);
      return y.toISOString().slice(0, 10);
    })();

    const startUtc = new Date(new Date(`${targetDate}T00:00:00.000Z`).getTime() - istOffsetMs);
    const endUtc = new Date(new Date(`${targetDate}T23:59:59.999Z`).getTime() - istOffsetMs);

    const aggregated = await ShopAnalyticsEvent.findAll({
      where: {
        createdAt: {
          [Op.between]: [startUtc, endUtc],
        },
      },
      attributes: [
        "shopId",
        [fn("COUNT", fn("DISTINCT", col("visitor_id"))), "uniqueVisitors"],
        [
          fn("SUM", literal("CASE WHEN event_type = 'shop_view' THEN 1 ELSE 0 END")),
          "viewsCount",
        ],
        [
          fn("SUM", literal("CASE WHEN event_type = 'directions_click' THEN 1 ELSE 0 END")),
          "directionsCount",
        ],
        [
          fn("SUM", literal("CASE WHEN event_type = 'call_click' THEN 1 ELSE 0 END")),
          "callsCount",
        ],
        [
          fn("SUM", literal("CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END")),
          "productViewsCount",
        ],
        [
          fn("SUM", literal("CASE WHEN event_type = 'wishlist_add' THEN 1 ELSE 0 END")),
          "wishlistCount",
        ],
        [
          fn("SUM", literal("CASE WHEN event_type = 'offer_view' THEN 1 ELSE 0 END")),
          "offerViewsCount",
        ],
        [
          fn("SUM", literal("CASE WHEN event_type = 'offer_redeemed' THEN 1 ELSE 0 END")),
          "offerRedemptionsCount",
        ],
      ],
      group: ["shopId"],
      raw: true,
    });

    let count = 0;
    for (const row of aggregated as any[]) {
      const shopId = Number(row.shopId);
      const totalViews = Number(row.viewsCount || 0);
      const uniqueVisitors = Number(row.uniqueVisitors || 0);
      const directionsClicks = Number(row.directionsCount || 0);
      const callClicks = Number(row.callsCount || 0);
      const productViews = Number(row.productViewsCount || 0);
      const wishlistAdds = Number(row.wishlistCount || 0);
      const offerViews = Number(row.offerViewsCount || 0);
      const offerRedemptions = Number(row.offerRedemptionsCount || 0);

      const existing = await ShopAnalyticsDaily.findOne({
        where: { shopId, analyticsDate: targetDate },
      });

      if (existing) {
        await existing.update({
          totalViews,
          uniqueVisitors,
          directionsClicks,
          callClicks,
          productViews,
          wishlistAdds,
          offerViews,
          offerRedemptions,
          updatedAt: new Date(),
        });
      } else {
        await ShopAnalyticsDaily.create({
          shopId,
          analyticsDate: targetDate,
          totalViews,
          uniqueVisitors,
          directionsClicks,
          callClicks,
          productViews,
          wishlistAdds,
          offerViews,
          offerRedemptions,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      count++;
    }

    return {
      processedDate: targetDate,
      shopsAggregated: count,
    };
  }
}

export const analyticsService = new AnalyticsService();

