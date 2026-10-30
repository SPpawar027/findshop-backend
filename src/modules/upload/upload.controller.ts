import type { Request, Response, NextFunction } from "express";
import { storageService, type ImageEntityType } from "../../core/storage/storage.service";
import { sendSuccess } from "../../core/utils/response";
import { BadRequestError } from "../../core/errors/AppError";

export class UploadController {
  /**
   * POST /api/upload/presigned-url
   * Generates a signed PUT URL for direct client-to-storage binary upload.
   */
  async getPresignedUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entityType, shopId, productId, fileName, contentType } = req.body;

      if (!entityType || !shopId || !fileName || !contentType) {
        throw new BadRequestError("entityType, shopId, fileName, and contentType are required");
      }

      const validTypes: ImageEntityType[] = ["shop-banner", "shop-logo", "product-image"];
      if (!validTypes.includes(entityType)) {
        throw new BadRequestError(`Invalid entityType. Must be one of: ${validTypes.join(", ")}`);
      }

      const result = await storageService.getPresignedUploadUrl({
        entityType,
        shopId: Number(shopId),
        productId: productId ? Number(productId) : undefined,
        fileName,
        contentType,
      });

      sendSuccess(res, result, "Presigned upload URL generated successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/upload/file
   * Safely deletes an object from AWS S3 or Cloudflare R2 given keyOrUrl.
   */
  async deleteFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const keyOrUrl = req.body.keyOrUrl || (req.query.key as string);

      if (!keyOrUrl) {
        throw new BadRequestError("keyOrUrl is required to delete a storage object");
      }

      const key = storageService.extractKeyFromUrl(keyOrUrl);
      await storageService.deleteObject(key);

      sendSuccess(res, { key }, "File deleted from storage successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/upload/info
   * Returns non-sensitive configuration details about the active storage provider.
   */
  async getStorageInfo(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = storageService.getConfigSummary();
      sendSuccess(res, summary, "Storage provider configuration details");
    } catch (error) {
      next(error);
    }
  }
}

export const uploadController = new UploadController();
