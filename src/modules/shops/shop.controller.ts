import type { Request, Response, NextFunction } from "express";
import { shopService } from "./shop.service";
import { sendSuccess, sendCreated } from "../../core/utils/response";
import { BadRequestError } from "../../core/errors/AppError";
import { formatMediaUrls } from "../../core/utils/media";

export class ShopController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = {
        ...req.query,
        lat: req.query.lat !== undefined ? Number(req.query.lat) : undefined,
        lng: req.query.lng !== undefined ? Number(req.query.lng) : undefined,
        radiusKm: req.query.radius !== undefined
          ? Number(req.query.radius)
          : (req.query.radiusKm !== undefined ? Number(req.query.radiusKm) : undefined),
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
      if (!lat || !lng) {
        throw new BadRequestError("Latitude ('lat') and Longitude ('lng') are required query parameters");
      }

      const latitude = Number(lat);
      const longitude = Number(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        throw new BadRequestError("Invalid latitude or longitude values");
      }

      const shops = await shopService.findNearby({
        latitude,
        longitude,
        radiusKm: radius ? Number(radius) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      const formattedShops = shops.map((s) => formatMediaUrls(s));
      sendSuccess(res, formattedShops, "Nearby shops fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shop = await shopService.create(req.body);
      sendCreated(res, formatMediaUrls(shop), "Shop created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new BadRequestError("Invalid shop ID");
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

