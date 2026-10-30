import type { Request, Response, NextFunction } from "express";
import { reviewService } from "./review.service";
import type { ReviewTargetType, ReviewStatus } from "./review.model";

export class ReviewController {
  /**
   * POST /api/reviews
   * Submit or update a review for a shop or product
   */
  public async createReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const { targetType, shopId, productId, rating, title, comment, authorName } = req.body;

      const review = await reviewService.createReview(
        {
          targetType: (targetType || "SHOP").toUpperCase() as ReviewTargetType,
          shopId: shopId ? Number(shopId) : undefined,
          productId: productId ? Number(productId) : undefined,
          rating: Number(rating),
          title: title || null,
          comment,
          authorName,
        },
        user
      );

      res.status(201).json({
        success: true,
        message: "Review submitted successfully and is now publicly visible",
        data: review,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/reviews
   * List reviews with filtering, pagination, and rating summary
   */
  public async getReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { shopId, productId, targetType, rating, page, limit, sort, isReported, status } = req.query;

      const result = await reviewService.getReviews({
        shopId: shopId ? Number(shopId) : undefined,
        productId: productId ? Number(productId) : undefined,
        targetType: targetType ? ((targetType as string).toUpperCase() as ReviewTargetType) : undefined,
        rating: rating ? Number(rating) : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        sort: sort as any,
        isReported: isReported === "true" ? true : isReported === "false" ? false : undefined,
        status: status as any,
      });

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
        summary: result.summary,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/reviews/:id
   * Get single review by ID
   */
  public async getReviewById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reviewId = Number(req.params.id);
      const review = await reviewService.getReviewById(reviewId);
      res.json({
        success: true,
        data: review,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/reviews/:id
   * Update an existing review
   */
  public async updateReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reviewId = Number(req.params.id);
      const user = (req as any).user;
      const { rating, title, comment } = req.body;

      const review = await reviewService.updateReview(
        reviewId,
        {
          rating: rating ? Number(rating) : undefined,
          title,
          comment,
        },
        user
      );

      res.json({
        success: true,
        message: "Review updated successfully",
        data: review,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/reviews/:id/report
   * Shop Owner marks an issue with a review (flags to super admin)
   */
  public async reportReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reviewId = Number(req.params.id);
      const { shopId, reason } = req.body;
      const user = (req as any).user;

      const effectiveShopId = shopId ? Number(shopId) : user?.shopId || 1;

      const review = await reviewService.reportReview(reviewId, effectiveShopId, reason);

      res.json({
        success: true,
        message: "Review has been reported to Super Admin for investigation",
        data: review,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/reviews/:id/reply
   * Shop Owner replies to a review
   */
  public async replyToReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reviewId = Number(req.params.id);
      const { shopId, reply } = req.body;
      const user = (req as any).user;

      const effectiveShopId = shopId ? Number(shopId) : user?.shopId || 1;

      const review = await reviewService.replyToReview(reviewId, effectiveShopId, reply);

      res.json({
        success: true,
        message: "Merchant reply published successfully",
        data: review,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/reviews/reported
   * Super Admin: View all reported reviews needing investigation
   */
  public async getReportedReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 50;

      const result = await reviewService.getReviews({
        isReported: true,
        status: "ALL",
        page,
        limit,
      });

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/reviews/:id/moderate
   * Super Admin: Action on review (HIDE, UNHIDE, DISMISS, DELETE)
   */
  public async moderateReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reviewId = Number(req.params.id);
      const { action } = req.body; // 'HIDE' | 'UNHIDE' | 'DISMISS' | 'DELETE'

      const result = await reviewService.moderateReview(reviewId, action);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/reviews/:id
   * Customer deletes their own review, or Admin removes review
   */
  public async deleteReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reviewId = Number(req.params.id);
      const user = (req as any).user;
      const isAdmin = user?.role === "super_admin";

      await reviewService.deleteReview(reviewId, user?.id || 0, isAdmin);

      res.json({
        success: true,
        message: "Review successfully deleted",
      });
    } catch (err) {
      next(err);
    }
  }
}

export const reviewController = new ReviewController();
