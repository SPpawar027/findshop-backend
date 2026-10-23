import { Router } from "express";
import { appVersionController } from "./appVersion.controller";
import { authMiddleware } from "../../core/middlewares/auth.middleware";

export const appVersionRouter = Router();

// Public endpoint used by mobile app on launch
appVersionRouter.get("/check", (req, res, next) =>
  appVersionController.checkUpdate(req, res, next)
);

// Endpoints for Super Admin
appVersionRouter.get("/", (req, res, next) =>
  appVersionController.getAll(req, res, next)
);

appVersionRouter.put("/:platform", authMiddleware, (req, res, next) =>
  appVersionController.update(req, res, next)
);
