import type { Request, Response, NextFunction } from "express";
import { storageService, type ImageEntityType } from "../../core/storage/storage.service";
import { sendSuccess } from "../../core/utils/response";
import { BadRequestError } from "../../core/errors/AppError";

export class UploadController {
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
}

export const uploadController = new UploadController();
