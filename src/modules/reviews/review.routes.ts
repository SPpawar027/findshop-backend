import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { reviewController } from "./review.controller";

const JWT_SECRET = process.env.JWT_SECRET || "findshop_jwt_secret_dev_key_change_in_prod";

/**
 * Optional Auth middleware: attaches user to request if valid Bearer token is provided,
 * but allows unauthenticated callers through as guest/demo users.
 */
function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      (req as any).user = decoded;
    } catch {
      // ignore invalid token in optional auth
    }
  }
  next();
}

export const reviewRouter = Router();

// 1. Public / Client Endpoints
reviewRouter.get("/", reviewController.getReviews);
reviewRouter.post("/", optionalAuth, reviewController.createReview);

// 2. Super Admin Dispute Queue (Must precede :id)
reviewRouter.get("/reported", optionalAuth, reviewController.getReportedReviews);

// 3. Single Review Operations
reviewRouter.get("/:id", reviewController.getReviewById);
reviewRouter.put("/:id", optionalAuth, reviewController.updateReview);
reviewRouter.delete("/:id", optionalAuth, reviewController.deleteReview);

// 4. Shop Owner Management & Dispute Reporting
reviewRouter.post("/:id/reply", optionalAuth, reviewController.replyToReview);
reviewRouter.post("/:id/report", optionalAuth, reviewController.reportReview);

// 5. Super Admin Moderation
reviewRouter.patch("/:id/moderate", optionalAuth, reviewController.moderateReview);
