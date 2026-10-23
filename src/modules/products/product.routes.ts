import { Router } from "express";
import { productController } from "./product.controller";

export const productRouter = Router();

productRouter.get("/", (req, res, next) => productController.getAll(req, res, next));
productRouter.get("/shop/:shopId", (req, res, next) => productController.getByShop(req, res, next));
productRouter.get("/slug/:slug", (req, res, next) => productController.getBySlug(req, res, next));
productRouter.get("/:id", (req, res, next) => productController.getById(req, res, next));
productRouter.post("/", (req, res, next) => productController.create(req, res, next));
productRouter.put("/:id", (req, res, next) => productController.update(req, res, next));
productRouter.delete("/:id", (req, res, next) => productController.delete(req, res, next));

