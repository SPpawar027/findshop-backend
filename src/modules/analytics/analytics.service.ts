import { Op, fn, col, literal } from "sequelize";
import { randomUUID } from "crypto";
import { sequelize } from "../../config/database";
import { Shop } from "../shops/shop.model";
import { Product } from "../products/product.model";
import {
  ShopAnalyticsEvent,
  AnalyticsEventType,
  AnalyticsPlatform,
} from "./shopAnalyticsEvent.model";
import { ShopAnalyticsDaily } from "./shopAnalyticsDaily.model";
import { ShopAnalyticsUniqueVisitor } from "./shopAnalyticsUniqueVisitor.model";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../core/errors/AppError";
import type { AuthenticatedUser } from "../../core/middlewares/auth.middleware";

export interface TrackEventDto {
  shopId: number;
  eventType: AnalyticsEventType;
  productId?: number | null;
  visitorId: string;
  eventId?: string;
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
  prevStartDateStr: string;
  prevEndDateStr: string;
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
  whatsappClicks: number;
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
    whatsappClicks: PercentageChange;
    productViews: PercentageChange;
  };
  disclaimer: string;
}

const ALLOWED_EVENT_TYPES: readonly AnalyticsEventType[] = [
  "shop_view",
  "product_view",
  "directions_click",
  "call_click",
  "whatsapp_click",
  "wishlist_add",
  "offer_view",
  "offer_redeemed",
  "qr_checkin",
] as const;

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AnalyticsService {
  /**
   * Helper: Format Date to YYYY-MM-DD in Asia/Kolkata (IST: UTC+5:30)
   */
  public getISTDateString(d: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(d);
  }

  /**
   * Helper: Parse Date Bounds for Period in Asia/Kolkata
   */
  public resolveDateRange(
    period: string,
    customStart?: string,
    customEnd?: string
  ): AnalyticsDateRange {
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

    const startDate = new Date(startIst.getTime() - istOffsetMs);
    const endDate = new Date(endIst.getTime() - istOffsetMs);

    const durationMs = Math.max(
      endDate.getTime() - startDate.getTime(),
      24 * 60 * 60 * 1000
    );
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

    const prevStartIst = new Date(prevStartDate.getTime() + istOffsetMs);
    const prevEndIst = new Date(prevEndDate.getTime() + istOffsetMs);

    return {
      startDate,
      endDate,
      startDateStr: startIst.toISOString().slice(0, 10),
      endDateStr: endIst.toISOString().slice(0, 10),
      prevStartDate,
      prevEndDate,
      prevStartDateStr: prevStartIst.toISOString().slice(0, 10),
      prevEndDateStr: prevEndIst.toISOString().slice(0, 10),
    };
  }

  /**
   * Safe percentage change calculator
   */
  public computePercentageChange(
    current: number,
    previous: number
  ): PercentageChange {
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
  public async verifyShopAccess(
    user: AuthenticatedUser,
    shopId: number
  ): Promise<Shop> {
    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with id ${shopId} not found`);
    }

    if (user.role !== "super_admin" && shop.ownerId !== user.id) {
      throw new ForbiddenError(
        "You are not authorized to view analytics for this shop"
      );
    }

    return shop;
  }

  /**
   * Track an Analytics Event with strict MVP transactional guarantees:
   * 1. Validate eventType against allowlist
   * 2. Validate shop existence and active status
   * 3. For product events, validate product existence and verify it belongs to this shop
   * 4. For shop events, nullify product_id to ensure clean isolation
   * 5. Validate visitorId format and eventId UUID
   * 6. Filter self-views & super-admin traffic
   * 7. Start database transaction
   * 8. Insert raw event with event_id (idempotency key); reject/suppress duplicate event_id
   * 9. For shop_view: insert into shop_analytics_unique_visitors using ON CONFLICT DO NOTHING
   * 10. Atomic upsert into shop_analytics_daily (Asia/Kolkata date) with zero JS read-modify-write
   * 11. Commit transaction
   */
  public async trackEvent(
    dto: TrackEventDto,
    authenticatedUser?: AuthenticatedUser
  ): Promise<{
    recorded: boolean;
    reason?: string;
    eventId?: string;
  }> {
    const { shopId, eventType, productId, visitorId, platform, metadata } = dto;

    // 1. Basic field validation
    if (!shopId || isNaN(shopId) || shopId <= 0) {
      throw new BadRequestError("Valid positive shopId is required");
    }

    if (!eventType || !ALLOWED_EVENT_TYPES.includes(eventType)) {
      throw new BadRequestError(
        `Invalid eventType. Allowed types: ${ALLOWED_EVENT_TYPES.join(", ")}`
      );
    }

    if (
      !visitorId ||
      typeof visitorId !== "string" ||
      visitorId.trim().length === 0 ||
      visitorId.trim().length > 100
    ) {
      throw new BadRequestError(
        "visitorId is required and must be between 1 and 100 characters"
      );
    }
    const cleanVisitorId = visitorId.trim().slice(0, 100);

    // 2. EventId UUID validation (generate UUID if missing to preserve backward compatibility)
    let finalEventId = dto.eventId ? String(dto.eventId).trim() : "";
    if (finalEventId) {
      if (!UUID_V4_REGEX.test(finalEventId)) {
        throw new BadRequestError("eventId must be a valid UUID");
      }
    } else {
      finalEventId = randomUUID();
    }

    // 3. Verify Shop Exists and is Active
    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with ID ${shopId} does not exist`);
    }
    if (shop.isOpen === false) {
      throw new BadRequestError(`Shop with ID ${shopId} is inactive`);
    }

    // 4. Product event validation & relationship check
    let finalProductId: number | null = null;
    if (eventType === "product_view") {
      if (!productId || isNaN(Number(productId)) || Number(productId) <= 0) {
        throw new BadRequestError(
          "Valid productId is required for product_view events"
        );
      }
      const prodNum = Number(productId);
      const product = await Product.findByPk(prodNum);
      if (!product || product.deletedAt) {
        throw new NotFoundError(`Product with ID ${prodNum} not found`);
      }
      if (product.shopId !== shopId) {
        throw new BadRequestError(
          `Product with ID ${prodNum} does not belong to shop ${shopId}`
        );
      }
      finalProductId = prodNum;
    } else {
      // For shop-level events (shop_view, directions_click, call_click, whatsapp_click),
      // ensure product_id is nullified to prevent corrupting product statistics.
      finalProductId = null;
    }

    // 5. Identify User & Filter Self-Views / Super Admin Activity
    const userId = authenticatedUser?.id || dto.userId || null;
    const userRole = authenticatedUser?.role;

    if (userRole === "super_admin") {
      return {
        recorded: false,
        reason: "super_admin_preview_filtered",
        eventId: finalEventId,
      };
    }

    if (userId && shop.ownerId === userId) {
      return {
        recorded: false,
        reason: "shop_owner_self_view_filtered",
        eventId: finalEventId,
      };
    }

    // 6. Compute business analytics date in Asia/Kolkata (IST: UTC+5:30)
    const analyticsDate = this.getISTDateString();

    // 7. Atomic Transaction Execution
    const transaction = await sequelize.transaction();

    try {
      // Check existing event_id (idempotency key for network retries)
      const existing = await ShopAnalyticsEvent.findOne({
        where: { eventId: finalEventId },
        transaction,
      });

      if (existing) {
        await transaction.rollback();
        return {
          recorded: false,
          reason: "duplicate_event_id",
          eventId: finalEventId,
        };
      }

      // Insert raw event record
      try {
        await ShopAnalyticsEvent.create(
          {
            eventId: finalEventId,
            shopId,
            userId,
            visitorId: cleanVisitorId,
            productId: finalProductId,
            eventType,
            platform: platform === "mobile" ? "mobile" : "website",
            metadata: metadata || null,
            createdAt: new Date(),
          },
          { transaction }
        );
      } catch (err: any) {
        // Catch duplicate event_id under concurrent execution
        if (
          err.name === "SequelizeUniqueConstraintError" ||
          err.original?.code === "23505"
        ) {
          await transaction.rollback();
          return {
            recorded: false,
            reason: "duplicate_event_id",
            eventId: finalEventId,
          };
        }
        throw err;
      }

      // Check / record unique visitor on shop_view
      let isNewUniqueVisitor = false;
      if (eventType === "shop_view") {
        const [insertResults] = await sequelize.query(
          `INSERT INTO shop_analytics_unique_visitors (shop_id, visitor_id, analytics_date, created_at)
           VALUES (:shopId, :visitorId, :analyticsDate, NOW())
           ON CONFLICT (shop_id, visitor_id, analytics_date) DO NOTHING
           RETURNING id;`,
          {
            replacements: {
              shopId,
              visitorId: cleanVisitorId,
              analyticsDate,
            },
            transaction,
          }
        );
        isNewUniqueVisitor =
          Array.isArray(insertResults) && insertResults.length > 0;
      }

      // Increments calculation
      const viewsInc = eventType === "shop_view" ? 1 : 0;
      const uniqueInc = isNewUniqueVisitor ? 1 : 0;
      const directionsInc = eventType === "directions_click" ? 1 : 0;
      const callsInc = eventType === "call_click" ? 1 : 0;
      const whatsappInc = eventType === "whatsapp_click" ? 1 : 0;
      const productsInc = eventType === "product_view" ? 1 : 0;
      const wishlistInc = eventType === "wishlist_add" ? 1 : 0;
      const offerViewsInc = eventType === "offer_view" ? 1 : 0;
      const offerRedemptionsInc = eventType === "offer_redeemed" ? 1 : 0;

      // Atomic UPSERT into shop_analytics_daily table
      await sequelize.query(
        `INSERT INTO shop_analytics_daily (
           shop_id,
           analytics_date,
           total_views,
           unique_visitors,
           directions_clicks,
           call_clicks,
           whatsapp_clicks,
           product_views,
           wishlist_adds,
           offer_views,
           offer_redemptions,
           created_at,
           updated_at
         )
         VALUES (
           :shopId,
           :analyticsDate,
           :viewsInc,
           :uniqueInc,
           :directionsInc,
           :callsInc,
           :whatsappInc,
           :productsInc,
           :wishlistInc,
           :offerViewsInc,
           :offerRedemptionsInc,
           NOW(),
           NOW()
         )
         ON CONFLICT (shop_id, analytics_date)
         DO UPDATE SET
           total_views = shop_analytics_daily.total_views + EXCLUDED.total_views,
           unique_visitors = shop_analytics_daily.unique_visitors + EXCLUDED.unique_visitors,
           directions_clicks = shop_analytics_daily.directions_clicks + EXCLUDED.directions_clicks,
           call_clicks = shop_analytics_daily.call_clicks + EXCLUDED.call_clicks,
           whatsapp_clicks = shop_analytics_daily.whatsapp_clicks + EXCLUDED.whatsapp_clicks,
           product_views = shop_analytics_daily.product_views + EXCLUDED.product_views,
           wishlist_adds = shop_analytics_daily.wishlist_adds + EXCLUDED.wishlist_adds,
           offer_views = shop_analytics_daily.offer_views + EXCLUDED.offer_views,
           offer_redemptions = shop_analytics_daily.offer_redemptions + EXCLUDED.offer_redemptions,
           updated_at = NOW();`,
        {
          replacements: {
            shopId,
            analyticsDate,
            viewsInc,
            uniqueInc,
            directionsInc,
            callsInc,
            whatsappInc,
            productsInc,
            wishlistInc,
            offerViewsInc,
            offerRedemptionsInc,
          },
          transaction,
        }
      );

      await transaction.commit();
      return { recorded: true, eventId: finalEventId };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Internal helper: Query Metrics from shop_analytics_daily
   * Queries aggregated daily table for reliable, high-speed metric calculations
   * even after raw events have been pruned by the 7-day retention cleanup.
   */
  private async queryPeriodMetrics(
    shopId: number,
    startStr: string,
    endStr: string
  ): Promise<ShopSummaryMetrics> {
    const dailyRecords = (await ShopAnalyticsDaily.findAll({
      where: {
        shopId,
        analyticsDate: {
          [Op.between]: [startStr, endStr],
        },
      },
      attributes: [
        [fn("COALESCE", fn("SUM", col("total_views")), 0), "totalViews"],
        [fn("COALESCE", fn("SUM", col("unique_visitors")), 0), "uniqueVisitors"],
        [fn("COALESCE", fn("SUM", col("directions_clicks")), 0), "directionsClicks"],
        [fn("COALESCE", fn("SUM", col("call_clicks")), 0), "callClicks"],
        [fn("COALESCE", fn("SUM", col("whatsapp_clicks")), 0), "whatsappClicks"],
        [fn("COALESCE", fn("SUM", col("product_views")), 0), "productViews"],
        [fn("COALESCE", fn("SUM", col("wishlist_adds")), 0), "wishlistAdds"],
        [fn("COALESCE", fn("SUM", col("offer_views")), 0), "offerViews"],
        [fn("COALESCE", fn("SUM", col("offer_redemptions")), 0), "offerRedemptions"],
      ],
      raw: true,
    })) as any[];

    const row = dailyRecords[0] || {};

    return {
      totalViews: Number(row.totalViews || 0),
      uniqueVisitors: Number(row.uniqueVisitors || 0),
      directionsClicks: Number(row.directionsClicks || 0),
      callClicks: Number(row.callClicks || 0),
      whatsappClicks: Number(row.whatsappClicks || 0),
      productViews: Number(row.productViews || 0),
      wishlistAdds: Number(row.wishlistAdds || 0),
      offerViews: Number(row.offerViews || 0),
      offerRedemptions: Number(row.offerRedemptions || 0),
    };
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
    const currentMetrics = await this.queryPeriodMetrics(
      shopId,
      range.startDateStr,
      range.endDateStr
    );
    const prevMetrics = await this.queryPeriodMetrics(
      shopId,
      range.prevStartDateStr,
      range.prevEndDateStr
    );

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
        totalViews: this.computePercentageChange(
          currentMetrics.totalViews,
          prevMetrics.totalViews
        ),
        uniqueVisitors: this.computePercentageChange(
          currentMetrics.uniqueVisitors,
          prevMetrics.uniqueVisitors
        ),
        directionsClicks: this.computePercentageChange(
          currentMetrics.directionsClicks,
          prevMetrics.directionsClicks
        ),
        callClicks: this.computePercentageChange(
          currentMetrics.callClicks,
          prevMetrics.callClicks
        ),
        whatsappClicks: this.computePercentageChange(
          currentMetrics.whatsappClicks,
          prevMetrics.whatsappClicks
        ),
        productViews: this.computePercentageChange(
          currentMetrics.productViews,
          prevMetrics.productViews
        ),
      },
      disclaimer:
        "Metrics represent customer online engagement and discovery on FindShopEasily, not confirmed physical footfall or sales.",
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

    // Fetch daily aggregated rows from shop_analytics_daily
    const dailyRecords = await ShopAnalyticsDaily.findAll({
      where: {
        shopId,
        analyticsDate: {
          [Op.between]: [range.startDateStr, range.endDateStr],
        },
      },
      raw: true,
    });

    const dailyDbMap = new Map<string, any>();
    for (const rec of dailyRecords as any[]) {
      dailyDbMap.set(rec.analyticsDate, rec);
    }

    // Build complete calendar day series
    const dailyBreakdown: Array<{
      date: string;
      label: string;
      views: number;
      uniqueVisitors: number;
      directions: number;
      calls: number;
      whatsapp: number;
      productViews: number;
    }> = [];

    const cur = new Date(range.startDate);
    const end = new Date(range.endDate);

    while (cur <= end) {
      const dateKey = this.getISTDateString(cur);
      const dayLabel = cur.toLocaleDateString("en-US", { weekday: "short" });
      const record = dailyDbMap.get(dateKey);

      dailyBreakdown.push({
        date: dateKey,
        label: dayLabel,
        views: Number(record?.totalViews || 0),
        uniqueVisitors: Number(record?.uniqueVisitors || 0),
        directions: Number(record?.directionsClicks || 0),
        calls: Number(record?.callClicks || 0),
        whatsapp: Number(record?.whatsappClicks || 0),
        productViews: Number(record?.productViews || 0),
      });

      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // Platform breakdown for available events
    const platformStats = (await ShopAnalyticsEvent.findAll({
      where: {
        shopId,
        createdAt: {
          [Op.between]: [range.startDate, range.endDate],
        },
      },
      attributes: [
        "platform",
        [fn("COUNT", col("id")), "count"],
      ],
      group: ["platform"],
      raw: true,
    })) as any[];

    let mobileCount = 0;
    let websiteCount = 0;
    let otherCount = 0;

    for (const p of platformStats) {
      const count = Number(p.count || 0);
      if (p.platform === "mobile") mobileCount += count;
      else if (p.platform === "website") websiteCount += count;
      else otherCount += count;
    }

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
          fn(
            "SUM",
            literal("CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END")
          ),
          "viewsCount",
        ],
        [
          fn(
            "SUM",
            literal("CASE WHEN event_type = 'wishlist_add' THEN 1 ELSE 0 END")
          ),
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
      const conversion =
        views > 0 ? `${((wishlist / views) * 100).toFixed(1)}%` : "0.0%";

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
   */
  public async getAdminOverview(
    period: string = "30d",
    customStart?: string,
    customEnd?: string
  ) {
    const range = this.resolveDateRange(period, customStart, customEnd);

    // Sum from shop_analytics_daily for comprehensive historical accuracy
    const [currentDaily, prevDaily, totalShopsCount, activeShopsCount] =
      await Promise.all([
        ShopAnalyticsDaily.findOne({
          where: {
            analyticsDate: {
              [Op.between]: [range.startDateStr, range.endDateStr],
            },
          },
          attributes: [
            [fn("COALESCE", fn("SUM", col("total_views")), 0), "totalViews"],
            [
              fn("COALESCE", fn("SUM", col("unique_visitors")), 0),
              "uniqueVisitors",
            ],
            [
              fn("COALESCE", fn("SUM", col("directions_clicks")), 0),
              "directionsClicks",
            ],
            [fn("COALESCE", fn("SUM", col("call_clicks")), 0), "callClicks"],
            [
              fn("COALESCE", fn("SUM", col("whatsapp_clicks")), 0),
              "whatsappClicks",
            ],
            [
              fn("COALESCE", fn("SUM", col("product_views")), 0),
              "productViews",
            ],
            [
              fn("COALESCE", fn("SUM", col("wishlist_adds")), 0),
              "wishlistAdds",
            ],
          ],
          raw: true,
        }),
        ShopAnalyticsDaily.findOne({
          where: {
            analyticsDate: {
              [Op.between]: [range.prevStartDateStr, range.prevEndDateStr],
            },
          },
          attributes: [
            [fn("COALESCE", fn("SUM", col("total_views")), 0), "totalViews"],
            [
              fn("COALESCE", fn("SUM", col("unique_visitors")), 0),
              "uniqueVisitors",
            ],
            [
              fn("COALESCE", fn("SUM", col("directions_clicks")), 0),
              "directionsClicks",
            ],
            [fn("COALESCE", fn("SUM", col("call_clicks")), 0), "callClicks"],
            [
              fn("COALESCE", fn("SUM", col("whatsapp_clicks")), 0),
              "whatsappClicks",
            ],
          ],
          raw: true,
        }),
        Shop.count(),
        Shop.count({ where: { isOpen: true } }),
      ]);

    const cur = (currentDaily as any) || {};
    const prev = (prevDaily as any) || {};

    const totalViews = Number(cur.totalViews || 0);
    const uniqueVisitors = Number(cur.uniqueVisitors || 0);
    const directionsClicks = Number(cur.directionsClicks || 0);
    const callClicks = Number(cur.callClicks || 0);
    const whatsappClicks = Number(cur.whatsappClicks || 0);
    const productViews = Number(cur.productViews || 0);
    const wishlistAdds = Number(cur.wishlistAdds || 0);

    const prevViews = Number(prev.totalViews || 0);
    const prevVisitors = Number(prev.uniqueVisitors || 0);
    const prevDirections = Number(prev.directionsClicks || 0);
    const prevCalls = Number(prev.callClicks || 0);
    const prevWhatsapp = Number(prev.whatsappClicks || 0);

    // Platform breakdown
    const platformStats = (await ShopAnalyticsEvent.findAll({
      where: {
        createdAt: { [Op.between]: [range.startDate, range.endDate] },
      },
      attributes: ["platform", [fn("COUNT", col("id")), "count"]],
      group: ["platform"],
      raw: true,
    })) as any[];

    let mobileCount = 0;
    let websiteCount = 0;
    for (const p of platformStats) {
      if (p.platform === "mobile") mobileCount += Number(p.count || 0);
      else websiteCount += Number(p.count || 0);
    }

    return {
      period,
      dateRange: {
        start: range.startDateStr,
        end: range.endDateStr,
      },
      totals: {
        totalViews,
        uniqueVisitors,
        directionsClicks,
        callClicks,
        whatsappClicks,
        productViews,
        wishlistAdds,
        totalShops: totalShopsCount,
        activeShops: activeShopsCount,
      },
      comparisons: {
        totalViews: this.computePercentageChange(totalViews, prevViews),
        uniqueVisitors: this.computePercentageChange(
          uniqueVisitors,
          prevVisitors
        ),
        directionsClicks: this.computePercentageChange(
          directionsClicks,
          prevDirections
        ),
        callClicks: this.computePercentageChange(callClicks, prevCalls),
        whatsappClicks: this.computePercentageChange(
          whatsappClicks,
          prevWhatsapp
        ),
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
   */
  public async getAdminTopShops(
    period: string = "30d",
    limit: number = 10,
    customStart?: string,
    customEnd?: string
  ) {
    const range = this.resolveDateRange(period, customStart, customEnd);

    const stats = (await ShopAnalyticsDaily.findAll({
      where: {
        analyticsDate: {
          [Op.between]: [range.startDateStr, range.endDateStr],
        },
      },
      attributes: [
        "shopId",
        [fn("COALESCE", fn("SUM", col("total_views")), 0), "views_count"],
        [
          fn("COALESCE", fn("SUM", col("unique_visitors")), 0),
          "unique_visitors_count",
        ],
        [
          fn("COALESCE", fn("SUM", col("directions_clicks")), 0),
          "directions_count",
        ],
        [fn("COALESCE", fn("SUM", col("call_clicks")), 0), "calls_count"],
        [fn("COALESCE", fn("SUM", col("whatsapp_clicks")), 0), "whatsapp_count"],
      ],
      group: ["shopId"],
      order: [[literal("views_count"), "DESC"]],
      limit,
      raw: true,
    })) as any[];

    if (stats.length === 0) {
      return [];
    }

    const shopIds = stats.map((s: any) => s.shopId);
    const shops = await Shop.findAll({
      where: { id: shopIds },
      attributes: ["id", "name", "category", "city", "address", "logoUrl"],
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
        address: (sh as any).address || "",
        logoUrl: (sh as any).logoUrl || null,
        totalViews: Number(s.views_count || 0),
        uniqueVisitors: Number(s.unique_visitors_count || 0),
        directionsClicks: Number(s.directions_count || 0),
        callClicks: Number(s.calls_count || 0),
        whatsappClicks: Number(s.whatsapp_count || 0),
      };
    });
  }

  /**
   * 7-Day Data Retention Cleanup:
   * Safely purges raw shop_analytics_events and shop_analytics_unique_visitors
   * records older than the specified retention window (default 7 days).
   * Aggregated rows in shop_analytics_daily are strictly PRESERVED forever.
   */
  public async purgeOldAnalyticsData(retentionDays: number = 7): Promise<{
    deletedEvents: number;
    deletedUniqueVisitors: number;
    cutoffDate: Date;
    retentionDays: number;
  }> {
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000
    );

    const deletedEvents = await ShopAnalyticsEvent.destroy({
      where: {
        createdAt: {
          [Op.lt]: cutoffDate,
        },
      },
    });

    const deletedUniqueVisitors = await ShopAnalyticsUniqueVisitor.destroy({
      where: {
        createdAt: {
          [Op.lt]: cutoffDate,
        },
      },
    });

    return {
      deletedEvents: Number(deletedEvents || 0),
      deletedUniqueVisitors: Number(deletedUniqueVisitors || 0),
      cutoffDate,
      retentionDays,
    };
  }

  /**
   * Idempotent daily aggregation trigger
   */
  public async runDailyAggregation(targetDateStr?: string): Promise<{
    processedDate: string;
    shopsAggregated: number;
  }> {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const targetDate =
      targetDateStr ||
      (() => {
        const y = new Date(Date.now() + istOffsetMs);
        y.setUTCDate(y.getUTCDate() - 1);
        return y.toISOString().slice(0, 10);
      })();

    const startUtc = new Date(
      new Date(`${targetDate}T00:00:00.000Z`).getTime() - istOffsetMs
    );
    const endUtc = new Date(
      new Date(`${targetDate}T23:59:59.999Z`).getTime() - istOffsetMs
    );

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
          fn(
            "SUM",
            literal("CASE WHEN event_type = 'shop_view' THEN 1 ELSE 0 END")
          ),
          "viewsCount",
        ],
        [
          fn(
            "SUM",
            literal(
              "CASE WHEN event_type = 'directions_click' THEN 1 ELSE 0 END"
            )
          ),
          "directionsCount",
        ],
        [
          fn(
            "SUM",
            literal("CASE WHEN event_type = 'call_click' THEN 1 ELSE 0 END")
          ),
          "callsCount",
        ],
        [
          fn(
            "SUM",
            literal("CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END")
          ),
          "whatsappCount",
        ],
        [
          fn(
            "SUM",
            literal("CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END")
          ),
          "productViewsCount",
        ],
        [
          fn(
            "SUM",
            literal("CASE WHEN event_type = 'wishlist_add' THEN 1 ELSE 0 END")
          ),
          "wishlistCount",
        ],
        [
          fn(
            "SUM",
            literal("CASE WHEN event_type = 'offer_view' THEN 1 ELSE 0 END")
          ),
          "offerViewsCount",
        ],
        [
          fn(
            "SUM",
            literal(
              "CASE WHEN event_type = 'offer_redeemed' THEN 1 ELSE 0 END"
            )
          ),
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
      const whatsappClicks = Number(row.whatsappCount || 0);
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
          whatsappClicks,
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
          whatsappClicks,
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
