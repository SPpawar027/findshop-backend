import { Router } from "express";
import { categoryController } from "./category.controller";

export const categoryRouter = Router();

// Category Tree (L1 Department with L2 Subcategories nested)
categoryRouter.get("/tree", (req, res, next) => categoryController.getTree(req, res, next));

// Seed default categories
categoryRouter.post("/seed", (req, res, next) => categoryController.seed(req, res, next));

// Subcategories for a given parent ID
categoryRouter.get("/:id/subcategories", (req, res, next) =>
  categoryController.getSubcategories(req, res, next)
);

// Slug lookup
categoryRouter.get("/slug/:slug", (req, res, next) =>
  categoryController.getBySlug(req, res, next)
);

// List all categories (with level, parentId, or search query)
categoryRouter.get("/", (req, res, next) => categoryController.getAll(req, res, next));

// Single Category by ID
categoryRouter.get("/:id", (req, res, next) => categoryController.getById(req, res, next));

// Super Admin Management Routes
categoryRouter.post("/", (req, res, next) => categoryController.create(req, res, next));
categoryRouter.put("/:id", (req, res, next) => categoryController.update(req, res, next));
categoryRouter.delete("/:id", (req, res, next) => categoryController.delete(req, res, next));
