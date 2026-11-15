import type { Request, Response, NextFunction } from "express";
import { shopService } from "./shop.service";
import { Shop } from "./shop.model";
import { sendSuccess, sendCreated } from "../../core/utils/response";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../core/errors/AppError";
import { formatMediaUrls } from "../../core/utils/media";
import type { AuthenticatedRequest } from "../../core/middlewares/auth.middleware";

export class ShopController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = {
        ...req.query,
        page: req.query.page !== undefined ? Math.max(1, Number(req.query.page)) : 1,
        limit: req.query.limit !== undefined ? Math.min(100, Math.max(1, Number(req.query.limit))) : 20,
        lat: req.query.lat !== undefined ? Number(req.query.lat) : undefined,
        lng: req.query.lng !== undefined ? Number(req.query.lng) : undefined,
        radiusKm: req.query.radius !== undefined
          ? Number(req.query.radius)
          : (req.query.radiusKm !== undefined ? Number(req.query.radiusKm) : undefined),
        sortBy: req.query.sortBy ? String(req.query.sortBy) : undefined,
      };
      const result = await shopService.findAll(query);
      const formattedShops = result.shops.map((s) => formatMediaUrls(s));
      sendSuccess(res, formattedShops, "Shops fetched successfully", 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawIdentifier = req.params.identifier || req.params.id || req.params.slug;
      const identifier = Array.isArray(rawIdentifier) ? rawIdentifier[0] : rawIdentifier;
      if (!identifier) {
        throw new BadRequestError("Shop identifier (ID or slug) is required");
      }

      const userRole = (req as any).user?.role;
      const allowSuspended =
        req.query.allowSuspended === "true" ||
        userRole === "super_admin" ||
        userRole === "shop_admin";

      const query = {
        lat: req.query.lat !== undefined ? Number(req.query.lat) : undefined,
        lng: req.query.lng !== undefined ? Number(req.query.lng) : undefined,
        category: typeof req.query.category === "string" ? req.query.category : undefined,
        productSearch:
          typeof req.query.productSearch === "string"
            ? req.query.productSearch
            : typeof req.query.search === "string"
              ? req.query.search
              : undefined,
        availableOnly: req.query.availableOnly === "true",
        productsLimit: req.query.productsLimit ? Number(req.query.productsLimit) : undefined,
        productsPage: req.query.productsPage ? Number(req.query.productsPage) : undefined,
        allowSuspended,
      };

      const shop = await shopService.getDetail(identifier, query);
      sendSuccess(res, formatMediaUrls(shop), "Shop detail fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!id) {
        throw new BadRequestError("Shop ID is required");
      }

      const userRole = (req as any).user?.role;
      const allowSuspended =
        req.query.allowSuspended === "true" ||
        userRole === "super_admin" ||
        userRole === "shop_admin";

      const query = {
        lat: req.query.lat !== undefined ? Number(req.query.lat) : undefined,
        lng: req.query.lng !== undefined ? Number(req.query.lng) : undefined,
        category: typeof req.query.category === "string" ? req.query.category : undefined,
        productSearch:
          typeof req.query.productSearch === "string"
            ? req.query.productSearch
            : typeof req.query.search === "string"
              ? req.query.search
              : undefined,
        availableOnly: req.query.availableOnly === "true",
        productsLimit: req.query.productsLimit ? Number(req.query.productsLimit) : undefined,
        productsPage: req.query.productsPage ? Number(req.query.productsPage) : undefined,
        allowSuspended,
      };

      const shop = await shopService.getDetail(id, query);
      sendSuccess(res, formatMediaUrls(shop), "Shop fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      if (!slug) {
        throw new BadRequestError("Slug parameter is required");
      }

      const userRole = (req as any).user?.role;
      console.log("🚀 ~ ShopController ~ getBySlug ~ userRole:", userRole)
      const allowSuspended =
        req.query.allowSuspended === "true" ||
        userRole === "super_admin" ||
        userRole === "shop_admin";

      const query = {
        lat: req.query.lat !== undefined ? Number(req.query.lat) : undefined,
        lng: req.query.lng !== undefined ? Number(req.query.lng) : undefined,
        category: typeof req.query.category === "string" ? req.query.category : undefined,
        productSearch:
          typeof req.query.productSearch === "string"
            ? req.query.productSearch
            : typeof req.query.search === "string"
              ? req.query.search
              : undefined,
        availableOnly: req.query.availableOnly === "true",
        productsLimit: req.query.productsLimit ? Number(req.query.productsLimit) : undefined,
        productsPage: req.query.productsPage ? Number(req.query.productsPage) : undefined,
        allowSuspended,
      };

      const shop = await shopService.getDetail(slug, query);
      sendSuccess(res, formatMediaUrls(shop), "Shop fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async getNearby(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lat, lng, radius, limit } = req.query;
      const parsedLimit = Math.min(100, Math.max(1, Number(limit || 20)));

      // If lat/lng are omitted, return general active and verified shops instead of failing
      if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) {
        const result = await shopService.findAll({
          limit: parsedLimit,
          status: "active",
          activeOnly: true,
        });
        const formattedShops = result.shops.map((s) => formatMediaUrls(s));
        sendSuccess(res, formattedShops, "General shops fetched successfully (location omitted)", 200, result.meta);
        return;
      }

      const latitude = Number(lat);
      const longitude = Number(lng);

      const shops = await shopService.findNearby({
        latitude,
        longitude,
        radiusKm: radius ? Number(radius) : undefined,
        limit: parsedLimit,
      });

      const formattedShops = shops.map((s) => formatMediaUrls(s));
      sendSuccess(res, formattedShops, "Nearby shops fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopData = { ...req.body };
      // If created by a shop_admin, bind ownerId to the authenticated merchant and prevent self-verification
      if (req.user && req.user.role === "shop_admin") {
        shopData.ownerId = req.user.id;
        shopData.isVerified = false;
        delete shopData.rating;
        delete shopData.reviewCount;
      }
      const shop = await shopService.create(shopData);
      const formatted = formatMediaUrls(shop);
      if ((shop as any).merchantCredentials) {
        (formatted as any).merchantCredentials = (shop as any).merchantCredentials;
      }
      sendCreated(res, formatted, "Shop created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new BadRequestError("Invalid shop ID");
      }

      // Enforce strict ownership check for shop_admin (prevent IDOR)
      if (req.user && req.user.role === "shop_admin") {
        const existingShop = await Shop.findByPk(id);
        if (!existingShop) {
          throw new NotFoundError(`Shop with id ${id} not found`);
        }
        if (existingShop.ownerId !== req.user.id) {
          throw new ForbiddenError("You do not have permission to update this shop");
        }

        // Prevent unauthorized privilege escalation by shop owners
        delete req.body.isVerified;
        delete req.body.rating;
        delete req.body.reviewCount;
        delete req.body.ownerId;
      }

      const shop = await shopService.update(id, req.body);
      sendSuccess(res, formatMediaUrls(shop), "Shop updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new BadRequestError("Invalid shop ID");
      }
      await shopService.delete(id);
      sendSuccess(res, null, "Shop deleted successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const shopController = new ShopController();

