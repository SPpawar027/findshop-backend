import { Router } from "express";
import { shopController } from "./shop.controller";

export const shopRouter = Router();

shopRouter.get("/", (req, res, next) => shopController.getAll(req, res, next));
shopRouter.get("/nearby", (req, res, next) => shopController.getNearby(req, res, next));
shopRouter.get("/detail/:identifier", (req, res, next) => shopController.getDetail(req, res, next));
shopRouter.get("/slug/:slug", (req, res, next) => shopController.getBySlug(req, res, next));
shopRouter.get("/:id/detail", (req, res, next) => shopController.getDetail(req, res, next));
shopRouter.get("/:id", (req, res, next) => shopController.getById(req, res, next));
shopRouter.post("/", (req, res, next) => shopController.create(req, res, next));
shopRouter.put("/:id", (req, res, next) => shopController.update(req, res, next));
shopRouter.delete("/:id", (req, res, next) => shopController.delete(req, res, next));

