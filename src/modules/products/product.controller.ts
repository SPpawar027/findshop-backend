import type { Request, Response, NextFunction } from "express";
import { productService } from "./product.service";
import { Shop } from "../shops/shop.model";
import { sendSuccess, sendCreated } from "../../core/utils/response";
import { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError } from "../../core/errors/AppError";
import { formatMediaUrls } from "../../core/utils/media";
import type { AuthenticatedRequest } from "../../core/middlewares/auth.middleware";

export class ProductController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = {
        ...req.query,
        categoryId: req.query.categoryId !== undefined ? Number(req.query.categoryId) : undefined,
        lat: req.query.lat !== undefined ? Number(req.query.lat) : undefined,
        lng: req.query.lng !== undefined ? Number(req.query.lng) : undefined,
        radiusKm: req.query.radius !== undefined
          ? Number(req.query.radius)
          : (req.query.radiusKm !== undefined ? Number(req.query.radiusKm) : undefined),
      };
      const result = await productService.findAll(query);
      const formattedProducts = result.products.map((p) => formatMediaUrls(p));
      sendSuccess(res, formattedProducts, "Products fetched successfully", 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new BadRequestError("Invalid product ID");
      }
      const product = await productService.findById(id);
      sendSuccess(res, formatMediaUrls(product), "Product fetched successfully");
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
      const product = await productService.findBySlug(slug);
      sendSuccess(res, formatMediaUrls(product), "Product fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async getByShop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = Number(req.params.shopId);
      if (isNaN(shopId)) {
        throw new BadRequestError("Invalid shop ID");
      }
      const availableOnly = req.query.availableOnly === "true";
      const products = await productService.findByShopId(shopId, availableOnly);
      const formattedProducts = products.map((p) => formatMediaUrls(p));
      sendSuccess(res, formattedProducts, "Shop products fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productService.create(req.body);
      sendCreated(res, formatMediaUrls(product), "Product created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new BadRequestError("Invalid product ID");
      }
      const product = await productService.update(id, req.body);
      sendSuccess(res, formatMediaUrls(product), "Product updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new BadRequestError("Invalid product ID");
      }
      await productService.delete(id);
      sendSuccess(res, null, "Product deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/products/shop/:shopId/category/:categoryId/reorder
   * Reorders products within a specific shop and subcategory
   */
  async reorderProducts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }

      const shopId = Number(req.params.shopId);
      const categoryId = Number(req.params.categoryId);

      if (isNaN(shopId) || isNaN(categoryId)) {
        throw new BadRequestError("Valid shopId and categoryId are required");
      }

      // Shop ownership check
      const shop = await Shop.findByPk(shopId);
      if (!shop) {
        throw new NotFoundError(`Shop with ID ${shopId} not found`);
      }

      if (req.user.role !== "super_admin" && shop.ownerId !== req.user.id) {
        throw new ForbiddenError("You do not have permission to manage this shop's products");
      }

      const items = req.body.items;
      if (!Array.isArray(items)) {
        throw new BadRequestError("Request body must contain an 'items' array with id and sortOrder");
      }

      const updatedProducts = await productService.reorderProducts(shopId, categoryId, items);
      const formatted = updatedProducts.map((p) => formatMediaUrls(p));
      sendSuccess(res, formatted, "Products reordered successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const productController = new ProductController();
