import type { Request, Response, NextFunction } from "express";
import { productService } from "./product.service";
import { sendSuccess, sendCreated } from "../../core/utils/response";
import { BadRequestError } from "../../core/errors/AppError";
import { formatMediaUrls } from "../../core/utils/media";

export class ProductController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await productService.findAll(req.query);
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

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productService.create(req.body);
      sendCreated(res, formatMediaUrls(product), "Product created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
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

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
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
}

export const productController = new ProductController();

