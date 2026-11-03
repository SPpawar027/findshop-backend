import { Router } from "express";
import { categoryController } from "./category.controller";
import { authMiddleware } from "../../core/middlewares/auth.middleware";

export const categoryRouter = Router();

// ============================================================================
// PUBLIC READ ROUTES
// ============================================================================

// 1. Nested Category Tree (L1 Sectors with L2 Subcategories)
categoryRouter.get("/tree", (req, res, next) => categoryController.getTree(req, res, next));

// 2. Shop-Specific Subcategories (with custom shop sort order & visibility)
categoryRouter.get("/shop/:shopId/subcategories", (req, res, next) =>
  categoryController.getShopSubcategories(req, res, next)
);

// 3. Subcategories for a given parent ID
categoryRouter.get("/:id/subcategories", (req, res, next) =>
  categoryController.getSubcategories(req, res, next)
);

// 4. Slug lookup
categoryRouter.get("/slug/:slug", (req, res, next) =>
  categoryController.getBySlug(req, res, next)
);

// 5. List all categories (with level, parentId, or search query)
categoryRouter.get("/", (req, res, next) => categoryController.getAll(req, res, next));

// 6. Single Category by ID
categoryRouter.get("/:id", (req, res, next) => categoryController.getById(req, res, next));

// ============================================================================
// SUPER ADMIN MANAGEMENT & REORDERING ROUTES
// ============================================================================

// 7. Reorder L1 Categories (Drag & Drop sorting)
categoryRouter.post("/reorder", authMiddleware, (req, res, next) =>
  categoryController.reorderCategories(req, res, next)
);

// 8. Reorder L2 Subcategories under a parent category
categoryRouter.post("/:parentId/subcategories/reorder", authMiddleware, (req, res, next) =>
  categoryController.reorderSubcategories(req, res, next)
);

// 9. Create Category (Super Admin)
categoryRouter.post("/", authMiddleware, (req, res, next) =>
  categoryController.create(req, res, next)
);

// 10. Update Category (Super Admin)
categoryRouter.put("/:id", authMiddleware, (req, res, next) =>
  categoryController.update(req, res, next)
);

// 11. Delete Category (Super Admin)
categoryRouter.delete("/:id", authMiddleware, (req, res, next) =>
  categoryController.delete(req, res, next)
);

// 12. Seed default categories
categoryRouter.post("/seed", authMiddleware, (req, res, next) =>
  categoryController.seed(req, res, next)
);

// ============================================================================
// SHOPKEEPER SHOP-SPECIFIC SUBCATEGORY CUSTOMIZATION
// ============================================================================

// 13. Update subcategory visibility for shop (enable/disable)
categoryRouter.put("/shop/:shopId/subcategories/:subcategoryId", authMiddleware, (req, res, next) =>
  categoryController.updateShopSubcategoryVisibility(req, res, next)
);

// 14. Reorder shop-specific subcategories (independent per shop)
categoryRouter.post("/shop/:shopId/subcategories/reorder", authMiddleware, (req, res, next) =>
  categoryController.reorderShopSubcategories(req, res, next)
);

// 15. Reset shop subcategories to global default order
categoryRouter.post("/shop/:shopId/subcategories/reset", authMiddleware, (req, res, next) =>
  categoryController.resetShopSubcategories(req, res, next)
);
