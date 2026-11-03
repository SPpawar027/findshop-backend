import type { Request, Response, NextFunction } from "express";
import { categoryService } from "./category.service";
import { Shop } from "../shops/shop.model";
import { sendSuccess, sendCreated } from "../../core/utils/response";
import { BadRequestError, ForbiddenError, UnauthorizedError, NotFoundError } from "../../core/errors/AppError";
import { formatMediaUrls } from "../../core/utils/media";
import type { AuthenticatedRequest } from "../../core/middlewares/auth.middleware";

export class CategoryController {
  async getTree(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tree = await categoryService.getTree();
      const formatted = tree.map((cat) => formatMediaUrls(cat));
      sendSuccess(res, formatted, "Category tree fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = {
        level: req.query.level !== undefined ? Number(req.query.level) : undefined,
        parentId: req.query.parentId !== undefined
          ? req.query.parentId === "null" || req.query.parentId === ""
            ? null
            : Number(req.query.parentId)
          : undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
      };

      const categories = await categoryService.findAll(query);
      const formatted = categories.map((cat) => formatMediaUrls(cat));
      sendSuccess(res, formatted, "Categories fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new BadRequestError("Invalid category ID");
      }
      const category = await categoryService.findById(id);
      sendSuccess(res, formatMediaUrls(category), "Category fetched successfully");
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
      const category = await categoryService.findBySlug(slug);
      sendSuccess(res, formatMediaUrls(category), "Category fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async getSubcategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parentId = Number(req.params.id);
      if (isNaN(parentId)) {
        throw new BadRequestError("Invalid parent category ID");
      }
      const subcategories = await categoryService.findSubcategories(parentId);
      const formatted = subcategories.map((cat) => formatMediaUrls(cat));
      sendSuccess(res, formatted, "Subcategories fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== "super_admin") {
        throw new ForbiddenError("Only Super Admins can create global categories");
      }

      const { name, slug, description, parentId, level, icon, emoji, imageUrl, orderIndex, isActive } = req.body;
      if (!name) {
        throw new BadRequestError("Category name is required");
      }

      const category = await categoryService.create({
        name,
        slug,
        description,
        parentId: parentId ? Number(parentId) : null,
        level: level ? Number(level) : undefined,
        icon,
        emoji,
        imageUrl,
        orderIndex: orderIndex !== undefined ? Number(orderIndex) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      });

      sendCreated(res, formatMediaUrls(category), "Category created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== "super_admin") {
        throw new ForbiddenError("Only Super Admins can update global categories");
      }

      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new BadRequestError("Invalid category ID");
      }

      const category = await categoryService.update(id, req.body);
      sendSuccess(res, formatMediaUrls(category), "Category updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== "super_admin") {
        throw new ForbiddenError("Only Super Admins can delete global categories");
      }

      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new BadRequestError("Invalid category ID");
      }

      const result = await categoryService.delete(id);
      sendSuccess(res, result, "Category deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  async seed(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await categoryService.ensureDefaultCategories();
      sendSuccess(res, result, "Default categories verification completed");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/categories/reorder
   * Super Admin reorders L1 Categories
   */
  async reorderCategories(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== "super_admin") {
        throw new ForbiddenError("Only Super Admins can reorder global categories");
      }

      const items = req.body.items;
      if (!Array.isArray(items)) {
        throw new BadRequestError("Request body must contain an 'items' array with id and orderIndex");
      }

      const result = await categoryService.reorderCategories(items);
      sendSuccess(res, result, "Categories reordered successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/categories/:parentId/subcategories/reorder
   * Super Admin reorders L2 Subcategories under a Parent Category
   */
  async reorderSubcategories(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== "super_admin") {
        throw new ForbiddenError("Only Super Admins can reorder global subcategories");
      }

      const parentId = Number(req.params.parentId);
      if (isNaN(parentId)) {
        throw new BadRequestError("Invalid parent category ID");
      }

      const items = req.body.items;
      if (!Array.isArray(items)) {
        throw new BadRequestError("Request body must contain an 'items' array with id and orderIndex");
      }

      const result = await categoryService.reorderSubcategories(parentId, items);
      sendSuccess(res, result, "Subcategories reordered successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * Helper to verify shop ownership
   */
  private async verifyShopOwnership(req: AuthenticatedRequest, shopId: number): Promise<Shop> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication is required");
    }

    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with ID ${shopId} not found`);
    }

    if (req.user.role !== "super_admin" && shop.ownerId !== req.user.id) {
      throw new ForbiddenError("You do not have permission to manage this shop's configuration");
    }

    return shop;
  }

  /**
   * GET /api/categories/shop/:shopId/subcategories
   * (or /api/shops/:shopId/subcategories)
   * Fetches shop's subcategories with custom ordering & visibility
   */
  async getShopSubcategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = Number(req.params.shopId);
      if (isNaN(shopId)) {
        throw new BadRequestError("Invalid shop ID");
      }

      const parentId = req.query.parentId ? Number(req.query.parentId) : undefined;
      const subcats = await categoryService.getShopSubcategories(shopId, parentId);
      const formatted = subcats.map((sub) => formatMediaUrls(sub));
      sendSuccess(res, formatted, "Shop subcategories fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/categories/shop/:shopId/subcategories/:subcategoryId
   * Updates visibility of a subcategory for this shop
   */
  async updateShopSubcategoryVisibility(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = Number(req.params.shopId);
      const subcategoryId = Number(req.params.subcategoryId);

      if (isNaN(shopId) || isNaN(subcategoryId)) {
        throw new BadRequestError("Valid shopId and subcategoryId are required");
      }

      await this.verifyShopOwnership(req, shopId);

      const isVisible = Boolean(req.body.isVisible);
      const result = await categoryService.updateShopSubcategoryVisibility(shopId, subcategoryId, isVisible);
      sendSuccess(res, result, `Subcategory visibility set to ${isVisible ? "enabled" : "disabled"}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/categories/shop/:shopId/subcategories/reorder
   * Reorders subcategories for this specific shop independently
   */
  async reorderShopSubcategories(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = Number(req.params.shopId);
      if (isNaN(shopId)) {
        throw new BadRequestError("Valid shop ID is required");
      }

      await this.verifyShopOwnership(req, shopId);

      const items = req.body.items;
      if (!Array.isArray(items)) {
        throw new BadRequestError("Request body must contain an 'items' array with subcategoryId and sortOrder");
      }

      const result = await categoryService.reorderShopSubcategories(shopId, items);
      sendSuccess(res, result, "Shop subcategories reordered successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/categories/shop/:shopId/subcategories/reset
   * Resets shop's subcategory order to global default
   */
  async resetShopSubcategories(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const shopId = Number(req.params.shopId);
      if (isNaN(shopId)) {
        throw new BadRequestError("Valid shop ID is required");
      }

      await this.verifyShopOwnership(req, shopId);

      const result = await categoryService.resetShopSubcategories(shopId);
      sendSuccess(res, result, "Shop subcategories reset to default order");
    } catch (error) {
      next(error);
    }
  }
}

export const categoryController = new CategoryController();
