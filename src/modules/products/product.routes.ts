import { Router } from "express";
import { productController } from "./product.controller";
import { authMiddleware } from "../../core/middlewares/auth.middleware";

export const productRouter = Router();

// Public Read Routes
productRouter.get("/", (req, res, next) => productController.getAll(req, res, next));
productRouter.get("/shop/:shopId", (req, res, next) => productController.getByShop(req, res, next));
productRouter.get("/slug/:slug", (req, res, next) => productController.getBySlug(req, res, next));
productRouter.get("/:id", (req, res, next) => productController.getById(req, res, next));

// Shopkeeper & Admin Reorder Route
productRouter.post("/shop/:shopId/category/:categoryId/reorder", authMiddleware, (req, res, next) =>
  productController.reorderProducts(req, res, next)
);

// Product Write Routes (Authenticated)
productRouter.post("/", authMiddleware, (req, res, next) => productController.create(req, res, next));
productRouter.put("/:id", authMiddleware, (req, res, next) => productController.update(req, res, next));
productRouter.delete("/:id", authMiddleware, (req, res, next) => productController.delete(req, res, next));
