import type { Response, NextFunction } from "express";
import { uploadService } from "./upload.service";
import { storageService } from "../../core/storage/storage.service";
import { sendSuccess } from "../../core/utils/response";
import { BadRequestError, UnauthorizedError } from "../../core/errors/AppError";
import type { AuthenticatedRequest } from "../../core/middlewares/auth.middleware";

export class UploadController {
  /**
   * POST /api/upload/authorize
   * (and POST /api/upload/presigned-url for backward compatibility)
   * Validates authentication, ownership, upload limits, and generates S3 presigned PUT URL.
   */
  async authorize(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication is required to authorize image uploads");
      }

      const { entityType, shopId, productId, fileName, contentType, fileSize } = req.body;

      const result = await uploadService.authorizeUpload(req.user, {
        entityType,
        shopId: Number(shopId),
        productId: productId ? Number(productId) : undefined,
        fileName: fileName || "image.webp",
        contentType: contentType || "image/webp",
        fileSize: fileSize ? Number(fileSize) : undefined,
      });

      sendSuccess(res, result, "Upload authorization granted successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/upload/confirm
   * Confirms direct S3 upload, verifies object via HeadObject and authenticates WebP file signature.
   */
  async confirm(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication is required to confirm image uploads");
      }

      const uploadIdOrKey = req.body.uploadId || req.body.storageKey || req.body.keyOrUrl;
      if (!uploadIdOrKey) {
        throw new BadRequestError("uploadId or storageKey is required in request body");
      }

      const result = await uploadService.confirmUpload(req.user, uploadIdOrKey);
      sendSuccess(res, result, "Image upload confirmed and verified successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/upload/delete-request
   * Safely registers an ImageDeletionJob, verifies entity ownership, and performs background deletion.
   */
  async deleteRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication is required to request image deletion");
      }

      const { entityType, entityId, objectKey, keyOrUrl } = req.body;
      const targetKey = objectKey || keyOrUrl;

      if (!targetKey) {
        throw new BadRequestError("objectKey is required for deletion request");
      }

      // If legacy call without entityType/entityId, verify it's not arbitrary
      if (!entityType || !entityId) {
        // Fallback safe deletion for temporary unattached user uploads
        const clean = storageService.extractKeyFromUrl(targetKey);
        if (clean.startsWith(`temp/uploads/${req.user.id}/`)) {
          await storageService.deleteObject(clean);
          sendSuccess(res, { key: clean }, "Temporary file deleted successfully");
          return;
        }
        throw new BadRequestError("entityType and entityId are required to verify ownership before deletion");
      }

      const result = await uploadService.requestImageDeletion(req.user, {
        entityType,
        entityId: Number(entityId),
        objectKey: targetKey,
      });

      sendSuccess(res, result, "Image deletion request queued successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/upload/cleanup
   * Periodic reconciliation job: deletes expired temporary uploads and retries failed deletions.
   */
  async runCleanup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || (req.user.role !== "super_admin" && req.user.role !== "shop_admin")) {
        throw new UnauthorizedError("Unauthorized to trigger storage cleanup");
      }

      const result = await uploadService.runPeriodicCleanup();
      sendSuccess(res, result, "Storage cleanup executed successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/upload/info
   * Returns non-sensitive configuration details about the active storage provider.
   */
  async getStorageInfo(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = storageService.getConfigSummary();
      sendSuccess(res, summary, "Storage provider configuration details");
    } catch (error) {
      next(error);
    }
  }
}

export const uploadController = new UploadController();
