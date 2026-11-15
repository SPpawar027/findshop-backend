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
import { categoryRouter } from "./modules/categories/category.routes";
import { reviewRouter } from "./modules/reviews/review.routes";
import { analyticsRouter } from "./modules/analytics/analytics.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { requestLogger } from "./core/middlewares/requestLogger";
import { errorHandler } from "./core/middlewares/errorHandler";
import { NotFoundError } from "./core/errors/AppError";

import { getSystemHealthAndInfo } from "./core/utils/systemInfo";
import { neonHeartbeat } from "./config/neonHeartbeat";

export function createApp(): express.Application {
  const app = express();

  // Global Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  // Normalize route prefix: automatically route both /endpoint and /api/endpoint
  app.use((req, _res, next) => {
    if (!req.url.startsWith("/api") && !req.url.startsWith("/knowbackend")) {
      req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
    }
    next();
  });

  // Record REAL user HTTP activity to coordinate with Neon Keep-Alive Heartbeat (development/local only).
  // Uptime pings (/api/health, /knowbackend, HEAD) are explicitly EXCLUDED so that UptimeRobot 24/7 pings
  // keep Render awake without preventing Neon from sleeping after 45 minutes of real user inactivity!
  if (process.env.NODE_ENV !== "production") {
    app.use((req, _res, next) => {
      const cleanPath = req.path.toLowerCase();
      const isUptimePing =
        cleanPath === "/api/health" ||
        cleanPath === "/health" ||
        cleanPath === "/api/knowbackend" ||
        cleanPath === "/knowbackend" ||
        req.method === "HEAD";

      if (!isUptimePing) {
        neonHeartbeat.recordActivity();
      }
      next();
    });
  }

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      message: "FindShopEasily backend is running",
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV !== "production"
        ? { neonHeartbeat: neonHeartbeat.getStatus() }
        : {}),
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
  app.use("/api/categories", categoryRouter);
  app.use("/api/locations", locationRouter);
  app.use("/api/upload", uploadRouter);
  app.use("/api/legal", legalRouter);
  app.use("/api/app-version", appVersionRouter);
  app.use("/api/reviews", reviewRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/dashboard", dashboardRouter);

  // 404 handler for unknown routes
  app.use((_req, _res, next) => {
    next(new NotFoundError("API endpoint not found"));
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

