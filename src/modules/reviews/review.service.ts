import { Op } from "sequelize";
import { Review, ReviewStatus, ReviewTargetType } from "./review.model";
import { Shop } from "../shops/shop.model";
import { Product } from "../products/product.model";
import { User } from "../users/user.model";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../core/errors/AppError";

export interface CreateReviewInput {
  targetType: ReviewTargetType;
  shopId?: number;
  productId?: number;
  rating: number;
  title?: string;
  comment: string;
  authorName?: string;
  userId?: number;
}

export interface GetReviewsQuery {
  userId?: number;
  shopId?: number;
  productId?: number;
  targetType?: ReviewTargetType;
  rating?: number;
  page?: number;
  limit?: number;
  sort?: "recent" | "highest" | "lowest";
  isReported?: boolean;
  status?: ReviewStatus | "ALL";
}

export interface RatingDistributionItem {
  stars: number;
  count: number;
  percentage: number;
}

export interface RatingSummary {
  averageRating: number;
  totalReviews: number;
  distribution: RatingDistributionItem[];
}

export class ReviewService {
  /**
   * Recalculates average rating and review count for a shop or product
   */
  public async recalculateRatings(
    targetType: ReviewTargetType,
    shopId: number,
    productId?: number | null
  ): Promise<void> {
    if (targetType === "SHOP" || shopId) {
      const shopReviews = await Review.findAll({
        where: {
          shopId,
          targetType: "SHOP",
          status: "PUBLISHED",
        },
        attributes: ["rating"],
      });

      const count = shopReviews.length;
      const sum = shopReviews.reduce((acc, r) => acc + Number(r.rating), 0);
      const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

      await Shop.update(
        { rating: avg, reviewCount: count },
        { where: { id: shopId } }
      );
    }

    if (productId) {
      const productReviews = await Review.findAll({
        where: {
          productId,
          status: "PUBLISHED",
        },
        attributes: ["rating"],
      });

      const count = productReviews.length;
      const sum = productReviews.reduce((acc, r) => acc + Number(r.rating), 0);
      const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

      await Product.update(
        { rating: avg, reviewCount: count },
        { where: { id: productId } }
      );
    }
  }

  /**
   * Generates star distribution breakdown
   */
  public async getRatingSummary(
    targetType: ReviewTargetType,
    targetId: number
  ): Promise<RatingSummary> {
    const whereClause: any = {
      status: "PUBLISHED",
    };

    if (targetType === "SHOP") {
      whereClause.shopId = targetId;
      whereClause.targetType = "SHOP";
    } else {
      whereClause.productId = targetId;
      whereClause.targetType = "PRODUCT";
    }

    const reviews = await Review.findAll({
      where: whereClause,
      attributes: ["rating"],
    });

    const total = reviews.length;
    if (total === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        distribution: [5, 4, 3, 2, 1].map((stars) => ({
          stars,
          count: 0,
          percentage: 0,
        })),
      };
    }

    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    for (const r of reviews) {
      const star = Math.min(5, Math.max(1, Math.round(Number(r.rating))));
      counts[star] = (counts[star] || 0) + 1;
      sum += Number(r.rating);
    }

    const averageRating = Math.round((sum / total) * 10) / 10;
    const distribution: RatingDistributionItem[] = [5, 4, 3, 2, 1].map((stars) => {
      const count = counts[stars] || 0;
      return {
        stars,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });

    return {
      averageRating,
      totalReviews: total,
      distribution,
    };
  }

  /**
   * Create or update a customer review
   */
  public async createReview(
    input: CreateReviewInput,
    authenticatedUser?: { id: number; name?: string; role?: string }
  ): Promise<Review> {
    const { targetType, rating, title, comment } = input;
    let { shopId, productId, authorName, userId } = input;

    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestError("Rating must be an integer between 1 and 5");
    }
    if (!comment || !comment.trim()) {
      throw new BadRequestError("Review comment is required");
    }

    // Determine user ID
    if (authenticatedUser?.id) {
      userId = authenticatedUser.id;
      authorName = authorName || authenticatedUser.name || "Customer";
    } else if (!userId) {
      // Find default customer or first available user
      const defaultUser = await User.findOne({ where: { role: "customer" } }) || await User.findOne();
      if (!defaultUser) {
        throw new BadRequestError("No user account available to attribute review");
      }
      userId = defaultUser.id;
      authorName = authorName || defaultUser.name || "Customer";
    }

    // Resolve shopId and productId
    if (targetType === "PRODUCT") {
      if (!productId) {
        throw new BadRequestError("productId is required for product reviews");
      }
      const product = await Product.findByPk(productId);
      if (!product) {
        throw new NotFoundError("Product not found");
      }
      shopId = product.shopId;
    } else {
      if (!shopId) {
        throw new BadRequestError("shopId is required for shop reviews");
      }
      const shop = await Shop.findByPk(shopId);
      if (!shop) {
        throw new NotFoundError("Shop not found");
      }
      productId = undefined;
    }

    // Check if user already reviewed this target -> update if so
    const existingWhere: any = {
      userId,
      shopId,
      targetType,
    };
    if (productId) {
      existingWhere.productId = productId;
    } else {
      existingWhere.productId = null;
    }

    let review = await Review.findOne({ where: existingWhere });

    if (review) {
      await review.update({
        rating,
        title: title?.trim() || null,
        comment: comment.trim(),
        authorName: authorName?.trim() || review.authorName,
        status: "PUBLISHED", // re-publish if updated
      });
    } else {
      review = await Review.create({
        userId,
        shopId,
        productId,
        targetType,
        rating,
        title: title?.trim() || null,
        comment: comment.trim(),
        authorName: authorName?.trim() || "Customer",
        status: "PUBLISHED",
      });
    }

    // Recalculate target ratings
    await this.recalculateRatings(targetType, shopId, productId);

    return review;
  }

  /**
   * Get reviews with flexible filtering, pagination, and rating summary
   */
  public async getReviews(query: GetReviewsQuery): Promise<{
    data: any[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    summary?: RatingSummary;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const where: any = {};

    if (query.userId) {
      where.userId = Number(query.userId);
    }
    if (query.shopId) {
      where.shopId = Number(query.shopId);
    }
    if (query.productId) {
      where.productId = Number(query.productId);
    }
    if (query.targetType) {
      where.targetType = query.targetType;
    }
    if (query.rating) {
      where.rating = Number(query.rating);
    }
    if (query.isReported !== undefined) {
      where.isReported = query.isReported;
    }
    if (query.status && query.status !== "ALL") {
      where.status = query.status;
    } else if (!query.status) {
      where.status = "PUBLISHED";
    }

    let order: any[] = [["createdAt", "DESC"]];
    if (query.sort === "highest") {
      order = [["rating", "DESC"], ["createdAt", "DESC"]];
    } else if (query.sort === "lowest") {
      order = [["rating", "ASC"], ["createdAt", "DESC"]];
    }

    const { count, rows } = await Review.findAndCountAll({
      where,
      limit,
      offset,
      order,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
        },
        {
          model: Shop,
          as: "shop",
          attributes: ["id", "name", "slug", "logoUrl"],
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "slug", "images"],
          required: false,
        },
      ],
    });

    // Compute summary if filtered by a single target
    let summary: RatingSummary | undefined;
    if (query.targetType && (query.shopId || query.productId)) {
      const targetId = query.targetType === "SHOP" ? query.shopId! : query.productId!;
      summary = await this.getRatingSummary(query.targetType, targetId);
    }

    const mappedData = rows.map((r) => {
      const json = r.toJSON() as any;
      const author = json.authorName || json.user?.name || "Customer";
      const initials = author
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      return {
        ...json,
        authorName: author,
        authorInitials: initials || "C",
      };
    });

    return {
      data: mappedData,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
      summary,
    };
  }

  /**
   * Shop Owner marks an issue with a review (report to super admin)
   */
  public async reportReview(
    reviewId: number,
    shopId: number,
    reason: string
  ): Promise<Review> {
    if (!reason || !reason.trim()) {
      throw new BadRequestError("Please provide a reason for reporting this review");
    }

    const review = await Review.findByPk(reviewId);
    if (!review) {
      throw new NotFoundError("Review not found");
    }

    if (review.shopId !== Number(shopId)) {
      throw new ForbiddenError("You can only report reviews associated with your shop");
    }

    await review.update({
      isReported: true,
      reportReason: reason.trim(),
      reportedByShopId: shopId,
      reportedAt: new Date(),
    });

    return review;
  }

  /**
   * Shop Owner posts official merchant reply
   */
  public async replyToReview(
    reviewId: number,
    shopId: number,
    replyText: string
  ): Promise<Review> {
    if (!replyText || !replyText.trim()) {
      throw new BadRequestError("Reply message cannot be empty");
    }

    const review = await Review.findByPk(reviewId);
    if (!review) {
      throw new NotFoundError("Review not found");
    }

    if (review.shopId !== Number(shopId)) {
      throw new ForbiddenError("You can only reply to reviews associated with your shop");
    }

    await review.update({
      merchantReply: replyText.trim(),
      merchantRepliedAt: new Date(),
    });

    return review;
  }

  /**
   * Super Admin moderation: HIDE, UNHIDE, DISMISS, or DELETE
   */
  public async moderateReview(
    reviewId: number,
    action: "HIDE" | "UNHIDE" | "DISMISS" | "DELETE"
  ): Promise<{ success: boolean; message: string; review?: Review }> {
    const review = await Review.findByPk(reviewId);
    if (!review) {
      throw new NotFoundError("Review not found");
    }

    const targetType = review.targetType;
    const shopId = review.shopId;
    const productId = review.productId;

    if (action === "HIDE") {
      await review.update({ status: "HIDDEN" });
      await this.recalculateRatings(targetType, shopId, productId);
      return { success: true, message: "Review has been hidden from public storefronts", review };
    }

    if (action === "UNHIDE") {
      await review.update({ status: "PUBLISHED" });
      await this.recalculateRatings(targetType, shopId, productId);
      return { success: true, message: "Review is now published and visible", review };
    }

    if (action === "DISMISS") {
      await review.update({
        isReported: false,
        reportReason: null,
        reportedByShopId: null,
        reportedAt: null,
      });
      return { success: true, message: "Report has been dismissed. Review remains active.", review };
    }

    if (action === "DELETE") {
      await review.destroy();
      await this.recalculateRatings(targetType, shopId, productId);
      return { success: true, message: "Review permanently deleted." };
    }

    throw new BadRequestError("Invalid moderation action. Choose HIDE, UNHIDE, DISMISS, or DELETE.");
  }

  /**
   * Delete a review (User deleting own review)
   */
  public async deleteReview(
    reviewId: number,
    userId: number,
    isAdmin: boolean = false
  ): Promise<void> {
    const review = await Review.findByPk(reviewId);
    if (!review) {
      throw new NotFoundError("Review not found");
    }

    if (!isAdmin && review.userId !== userId) {
      throw new ForbiddenError("You can only delete your own reviews");
    }

    const targetType = review.targetType;
    const shopId = review.shopId;
    const productId = review.productId;

    await review.destroy();
    await this.recalculateRatings(targetType, shopId, productId);
  }

  /**
   * Get a single review by ID
   */
  public async getReviewById(reviewId: number): Promise<any> {
    const review = await Review.findByPk(reviewId, {
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email"] },
        { model: Shop, as: "shop", attributes: ["id", "name", "slug", "logoUrl"] },
        { model: Product, as: "product", attributes: ["id", "name", "slug", "images"], required: false },
      ],
    });

    if (!review) {
      throw new NotFoundError("Review not found");
    }

    const json = review.toJSON() as any;
    const author = json.authorName || json.user?.name || "Customer";
    const initials = author.slice(0, 2).toUpperCase();

    return {
      ...json,
      authorName: author,
      authorInitials: initials,
    };
  }

  /**
   * Update an existing review by ID
   */
  public async updateReview(
    reviewId: number,
    data: { rating?: number; title?: string; comment?: string },
    user?: { id: number; role?: string }
  ): Promise<Review> {
    const review = await Review.findByPk(reviewId);
    if (!review) {
      throw new NotFoundError("Review not found");
    }

    if (user && user.role !== "super_admin" && review.userId !== user.id) {
      throw new ForbiddenError("You can only edit your own reviews");
    }

    if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
      throw new BadRequestError("Rating must be between 1 and 5");
    }

    await review.update({
      rating: data.rating !== undefined ? Number(data.rating) : review.rating,
      title: data.title !== undefined ? data.title?.trim() || null : review.title,
      comment: data.comment !== undefined ? data.comment.trim() : review.comment,
    });

    await this.recalculateRatings(review.targetType, review.shopId, review.productId);
    return review;
  }
}

export const reviewService = new ReviewService();
