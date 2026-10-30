import type { Request, Response, NextFunction } from "express";
import { categoryService } from "./category.service";
import { sendSuccess, sendCreated } from "../../core/utils/response";
import { BadRequestError } from "../../core/errors/AppError";

export class CategoryController {
  async getTree(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tree = await categoryService.getTree();
      sendSuccess(res, tree, "Category tree fetched successfully");
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
      sendSuccess(res, categories, "Categories fetched successfully");
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
      sendSuccess(res, category, "Category fetched successfully");
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
      sendSuccess(res, category, "Category fetched successfully");
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
      sendSuccess(res, subcategories, "Subcategories fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, slug, description, parentId, level, icon, emoji, orderIndex, isActive } = req.body;
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
        orderIndex: orderIndex !== undefined ? Number(orderIndex) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      });

      sendCreated(res, category, "Category created successfully");
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new BadRequestError("Invalid category ID");
      }

      const category = await categoryService.update(id, req.body);
      sendSuccess(res, category, "Category updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
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
}

export const categoryController = new CategoryController();
