import { Op } from "sequelize";
import {
  storageService,
  type ImageEntityType,
  type PresignedUrlResponse,
} from "../../core/storage/storage.service";
import { TemporaryUpload } from "./temporaryUpload.model";
import { ImageDeletionJob } from "./imageDeletionJob.model";
import { ImageAsset } from "./imageAsset.model";
import { Shop } from "../shops/shop.model";
import { Product } from "../products/product.model";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../core/errors/AppError";
import type { AuthenticatedUser } from "../../core/middlewares/auth.middleware";

export interface AuthorizeUploadInput {
  entityType: ImageEntityType;
  shopId: number;
  productId?: number;
  fileName: string;
  contentType: string;
  fileSize?: number;
}

export interface ImageDeletionRequestInput {
  entityType: "shop" | "product";
  entityId: number;
  objectKey: string;
}

const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export class UploadService {
  /**
   * Verifies that the authenticated user owns the specified shop (or has super_admin role).
   */
  private async verifyShopOwnership(user: AuthenticatedUser, shopId: number): Promise<Shop> {
    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with id ${shopId} not found`);
    }

    if (user.role !== "super_admin" && shop.ownerId !== user.id) {
      throw new ForbiddenError("You do not have permission to manage images for this shop");
    }

    return shop;
  }

  /**
   * Validates upload limits:
   * - Shop logo: 1 max
   * - Shop banner: 1 max
   * - Product images: 3 max per product
   */
  private async enforceUploadLimits(
    entityType: ImageEntityType,
    shopId: number,
    productId?: number,
    userId?: number
  ): Promise<void> {
    if (entityType === "product-image") {
      let permanentCount = 0;
      if (productId) {
        const product = await Product.findByPk(productId);
        if (product && Array.isArray(product.images)) {
          permanentCount = product.images.length;
        }
      }

      // Count active unattached uploads for this specific product or session
      const pendingWhere: any = {
        shopId,
        intendedUsage: "product_image",
        uploadStatus: { [Op.in]: ["pending", "uploaded"] },
        expiresAt: { [Op.gt]: new Date() },
      };

      if (productId) {
        pendingWhere.productId = productId;
      } else if (userId) {
        pendingWhere.userId = userId;
        pendingWhere.productId = null;
      }

      const pendingCount = await TemporaryUpload.count({ where: pendingWhere });

      if (permanentCount + pendingCount >= 3) {
        throw new BadRequestError(
          `Maximum 3 images allowed per product. Currently ${permanentCount} permanent and ${pendingCount} pending upload(s). Remove an image before uploading a new one.`
        );
      }
    }
  }

  /**
   * Generates a backend-authorized presigned PUT URL and creates a temporary upload record.
   */
  async authorizeUpload(
    user: AuthenticatedUser,
    input: AuthorizeUploadInput
  ): Promise<PresignedUrlResponse> {
    const { entityType, shopId, productId, fileName, contentType, fileSize } = input;

    if (!entityType || !shopId || !fileName || !contentType) {
      throw new BadRequestError("entityType, shopId, fileName, and contentType are required");
    }

    const validTypes: ImageEntityType[] = ["shop-banner", "shop-logo", "product-image"];
    if (!validTypes.includes(entityType)) {
      throw new BadRequestError(`Invalid entityType. Must be one of: ${validTypes.join(", ")}`);
    }

    // Verify ownership
    await this.verifyShopOwnership(user, Number(shopId));

    // Verify product ownership if productId provided
    if (productId) {
      const product = await Product.findByPk(productId);
      if (!product) {
        throw new NotFoundError(`Product with id ${productId} not found`);
      }
      if (product.shopId !== Number(shopId)) {
        throw new BadRequestError(`Product ${productId} does not belong to shop ${shopId}`);
      }
    }

    // Validate MIME type
    if (contentType !== "image/webp") {
      throw new BadRequestError("Only image/webp is accepted. Please convert image to WebP before uploading.");
    }

    // Validate file size limit
    if (fileSize && fileSize > MAX_IMAGE_FILE_SIZE) {
      throw new BadRequestError(`File size exceeds maximum allowed limit of 5MB (${Math.round(fileSize / 1024)} KB)`);
    }

    // Enforce limits
    await this.enforceUploadLimits(entityType, Number(shopId), productId ? Number(productId) : undefined, user.id);

    // Generate unique uploadId & presigned URL
    const presigned = await storageService.getPresignedUploadUrl({
      entityType,
      userId: user.id,
      shopId: Number(shopId),
      productId: productId ? Number(productId) : undefined,
      fileName,
      contentType: "image/webp",
      fileSize,
    });

    const intendedUsage =
      entityType === "shop-logo"
        ? "shop_logo"
        : entityType === "shop-banner"
        ? "shop_banner"
        : "product_image";

    // Create TemporaryUpload record (expires in 24 hours for abandoned upload cleanup)
    await TemporaryUpload.create({
      id: presigned.uploadId,
      userId: user.id,
      shopId: Number(shopId),
      productId: productId ? Number(productId) : null,
      objectKey: presigned.storageKey,
      originalName: fileName,
      mimeType: "image/webp",
      fileSize: fileSize || 0,
      uploadStatus: "pending",
      intendedUsage,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return presigned;
  }

  /**
   * Confirms that direct S3 upload completed, verifies object existence and authentic WebP file signature.
   */
  async confirmUpload(
    user: AuthenticatedUser,
    uploadIdOrKey: string
  ): Promise<{ success: boolean; uploadId: string; storageKey: string; publicUrl: string }> {
    if (!uploadIdOrKey) {
      throw new BadRequestError("uploadId or storageKey is required to confirm upload");
    }

    const clean = storageService.extractKeyFromUrl(uploadIdOrKey);

    const tempUpload = await TemporaryUpload.findOne({
      where: {
        [Op.or]: [{ id: uploadIdOrKey }, { objectKey: clean }],
      },
    });

    if (!tempUpload) {
      throw new NotFoundError("Temporary upload record not found or has already expired");
    }

    // Bind confirmation to authenticated user
    if (user.role !== "super_admin" && tempUpload.userId !== user.id) {
      throw new ForbiddenError("You are not authorized to confirm this upload");
    }

    if (tempUpload.uploadStatus === "attached") {
      return {
        success: true,
        uploadId: tempUpload.id,
        storageKey: tempUpload.objectKey,
        publicUrl: storageService.getPublicUrl(tempUpload.objectKey),
      };
    }

    if (tempUpload.uploadStatus === "expired" || tempUpload.uploadStatus === "failed") {
      throw new BadRequestError(`Cannot confirm upload with status: ${tempUpload.uploadStatus}`);
    }

    // 1. Verify existence via HeadObject
    let head;
    try {
      head = await storageService.headObject(tempUpload.objectKey);
    } catch (err: any) {
      throw new BadRequestError(`S3 object not found or upload has not completed: ${err?.message || "HeadObject error"}`);
    }

    if (!head.contentLength || head.contentLength <= 0) {
      throw new BadRequestError("Uploaded file is empty (0 bytes)");
    }

    if (head.contentLength > MAX_IMAGE_FILE_SIZE) {
      // Delete oversized object immediately
      await storageService.deleteObject(tempUpload.objectKey).catch(() => {});
      await tempUpload.update({ uploadStatus: "failed" });
      throw new BadRequestError(`Uploaded file exceeds 5MB limit (${Math.round(head.contentLength / 1024)} KB)`);
    }

    // 2. Validate authentic WebP file signature (Magic Numbers)
    const sigCheck = await storageService.validateWebPSignature(tempUpload.objectKey);
    if (!sigCheck.isValid) {
      // Delete corrupted/invalid object from S3 immediately
      await storageService.deleteObject(tempUpload.objectKey).catch(() => {});
      await tempUpload.update({ uploadStatus: "failed" });
      throw new BadRequestError(`Invalid file signature: ${sigCheck.error || "File is not a valid WebP image"}`);
    }

    // Mark as uploaded
    await tempUpload.update({
      uploadStatus: "uploaded",
      fileSize: head.contentLength,
      mimeType: "image/webp",
    });

    return {
      success: true,
      uploadId: tempUpload.id,
      storageKey: tempUpload.objectKey,
      publicUrl: storageService.getPublicUrl(tempUpload.objectKey),
    };
  }

  /**
   * Promotes a verified temporary upload to its permanent S3 key and registers the permanent ImageAsset.
   */
  async promoteUpload(params: {
    tempKeyOrId: string;
    targetPermanentKey: string;
    entityType: "shop" | "product";
    entityId: number;
    shopId: number;
    imageRole: "logo" | "banner" | "product_gallery";
    userId?: number;
  }): Promise<string> {
    const { tempKeyOrId, targetPermanentKey, entityType, entityId, shopId, imageRole, userId } = params;
    const cleanSourceKey = storageService.extractKeyFromUrl(tempKeyOrId);

    const tempUpload = await TemporaryUpload.findOne({
      where: {
        [Op.or]: [{ id: tempKeyOrId }, { objectKey: cleanSourceKey }],
      },
    });

    // If already a permanent key, return as-is
    if (!cleanSourceKey.startsWith("temp/")) {
      return cleanSourceKey;
    }

    // Execute S3 copy
    await storageService.copyObject(cleanSourceKey, targetPermanentKey);

    // Delete temp object from S3
    await storageService.deleteObject(cleanSourceKey).catch((delErr) => {
      console.warn(`[Storage Warning] Failed to delete temp source after promotion [${cleanSourceKey}]:`, delErr?.message);
    });

    // Update TemporaryUpload record
    if (tempUpload) {
      await tempUpload.update({
        uploadStatus: "attached",
        attachedAt: new Date(),
      });
    }

    // Register / update permanent ImageAsset
    const head = await storageService.headObject(targetPermanentKey).catch(() => null);
    await ImageAsset.upsert({
      entityType,
      entityId,
      shopId,
      objectKey: targetPermanentKey,
      mimeType: "image/webp",
      fileSize: head?.contentLength || (tempUpload?.fileSize || 0),
      imageRole,
      status: "active",
      createdByUserId: userId || null,
    });

    return targetPermanentKey;
  }

  /**
   * Requests deletion of an image, verifies ownership, creates an ImageDeletionJob,
   * and safely removes the S3 object in the background.
   */
  async requestImageDeletion(
    user: AuthenticatedUser,
    input: ImageDeletionRequestInput
  ): Promise<{ success: boolean; jobId: number; objectKey: string }> {
    const { entityType, entityId, objectKey } = input;
    if (!entityType || !entityId || !objectKey) {
      throw new BadRequestError("entityType, entityId, and objectKey are required");
    }

    const cleanKey = storageService.extractKeyFromUrl(objectKey);

    // Verify entity ownership
    if (entityType === "shop") {
      await this.verifyShopOwnership(user, entityId);
    } else if (entityType === "product") {
      const product = await Product.findByPk(entityId);
      if (!product) {
        throw new NotFoundError(`Product with id ${entityId} not found`);
      }
      await this.verifyShopOwnership(user, product.shopId);
    }

    // Prevent deleting arbitrary S3 objects: verify key belongs to this entity
    const belongsToEntity =
      cleanKey.startsWith(`shops/${entityId}/`) ||
      cleanKey.startsWith(`products/`) ||
      cleanKey.startsWith(`temp/uploads/${user.id}/`);

    if (!belongsToEntity) {
      throw new ForbiddenError("You cannot delete an object that does not belong to your entity");
    }

    // Create deletion audit job
    const job = await ImageDeletionJob.create({
      objectKey: cleanKey,
      entityType,
      entityId,
      requestedByUserId: user.id,
      status: "pending",
      retryCount: 0,
    });

    // Mark ImageAsset as deleted if exists
    await ImageAsset.update(
      { status: "deleted" },
      { where: { objectKey: cleanKey } }
    );

    // Trigger immediate safe background deletion
    void this.executeDeletionJob(job.id);

    return {
      success: true,
      jobId: job.id,
      objectKey: cleanKey,
    };
  }

  /**
   * Executes a single deletion job with error handling and retry tracking.
   */
  async executeDeletionJob(jobId: number): Promise<void> {
    const job = await ImageDeletionJob.findByPk(jobId);
    if (!job || job.status === "completed" || job.status === "cancelled") {
      return;
    }

    await job.update({ status: "processing" });

    try {
      await storageService.deleteObject(job.objectKey);
      await job.update({
        status: "completed",
        deletedAt: new Date(),
        errorMessage: null,
      });
    } catch (err: any) {
      const nextRetry = (job.retryCount || 0) + 1;
      const status = nextRetry >= 3 ? "failed" : "pending";
      await job.update({
        status,
        retryCount: nextRetry,
        errorMessage: err?.message || "S3 deletion error",
      });
    }
  }

  /**
   * Background cleanup: processes pending deletion jobs and removes expired temporary uploads.
   */
  async runPeriodicCleanup(): Promise<{ deletedUploads: number; processedJobs: number }> {
    // 1. Clean up expired temporary uploads (>24 hours old and not attached)
    const expiredUploads = await TemporaryUpload.findAll({
      where: {
        uploadStatus: { [Op.in]: ["pending", "uploaded"] },
        expiresAt: { [Op.lt]: new Date() },
      },
      limit: 50,
    });

    let deletedUploads = 0;
    for (const item of expiredUploads) {
      try {
        await storageService.deleteObject(item.objectKey);
        await item.update({ uploadStatus: "expired" });
        deletedUploads++;
      } catch (err: any) {
        console.error(`Failed to clean up expired upload [${item.objectKey}]:`, err?.message);
      }
    }

    // 2. Process pending deletion jobs
    const pendingJobs = await ImageDeletionJob.findAll({
      where: {
        status: "pending",
        retryCount: { [Op.lt]: 3 },
      },
      limit: 50,
    });

    let processedJobs = 0;
    for (const job of pendingJobs) {
      await this.executeDeletionJob(job.id);
      processedJobs++;
    }

    return { deletedUploads, processedJobs };
  }
}

export const uploadService = new UploadService();
