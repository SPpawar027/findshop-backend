import { Router } from "express";
import { legalController } from "./legal.controller";
import { authMiddleware } from "../../core/middlewares/auth.middleware";

export const legalRouter = Router();

// Public endpoints to fetch legal documentation (for mobile, website, playstore)
legalRouter.get("/", (req, res, next) => legalController.getAll(req, res, next));
legalRouter.get("/:type", (req, res, next) => legalController.getDoc(req, res, next));

// Super Admin protected endpoint to edit & publish legal docs
legalRouter.put("/:type", authMiddleware, (req, res, next) =>
  legalController.updateDoc(req, res, next)
);
