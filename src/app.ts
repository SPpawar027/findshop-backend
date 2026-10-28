import express from "express";
import cors from "cors";
import "./database";
import { authRouter } from "./modules/auth/auth.routes";
import { userRouter } from "./modules/users/user.routes";
import { shopRouter } from "./modules/shops/shop.routes";
import { productRouter } from "./modules/products/product.routes";
import { uploadRouter } from "./modules/upload/upload.routes";
import { legalRouter } from "./modules/legal/legal.routes";
import { appVersionRouter } from "./modules/appVersion/appVersion.routes";
import { locationRouter } from "./modules/locations/location.routes";
import { requestLogger } from "./core/middlewares/requestLogger";
import { errorHandler } from "./core/middlewares/errorHandler";
import { NotFoundError } from "./core/errors/AppError";

import { getSystemHealthAndInfo } from "./core/utils/systemInfo";

export function createApp(): express.Application {
  const app = express();

  // Global Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      message: "FindShopEasily backend is running",
      timestamp: new Date().toISOString(),
    });
  });

  // Know Backend & Deployment Details (/knowbackend and /api/knowbackend)
  const handleKnowBackend = async (_req: express.Request, res: express.Response) => {
    try {
      const info = await getSystemHealthAndInfo();
      res.json(info);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || "Failed to inspect backend status",
      });
    }
  };

  app.get("/knowbackend", handleKnowBackend);
  app.get("/api/knowbackend", handleKnowBackend);

  // Feature Module Routes
  app.use("/api/auth", authRouter);
  app.use("/api/users", userRouter);
  app.use("/api/shops", shopRouter);
  app.use("/api/products", productRouter);
  app.use("/api/locations", locationRouter);
  app.use("/api/upload", uploadRouter);
  app.use("/api/legal", legalRouter);
  app.use("/api/app-version", appVersionRouter);

  // 404 handler for unknown routes
  app.use((_req, _res, next) => {
    next(new NotFoundError("API endpoint not found"));
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

