import type { Request, Response, NextFunction } from "express";
import { legalService } from "./legal.service";
import { sendSuccess } from "../../core/utils/response";
import { BadRequestError } from "../../core/errors/AppError";
import type { AuthenticatedRequest } from "../../core/middlewares/auth.middleware";

export class LegalController {
  async getDoc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawType = req.params.type;
      const type = Array.isArray(rawType) ? rawType[0] : rawType;
      if (!type) {
        throw new BadRequestError("Document type is required");
      }

      const doc = await legalService.getLegalDoc(type);
      sendSuccess(res, doc, "Legal document fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docs = await legalService.getAllLegalDocs();
      sendSuccess(res, docs, "Legal documents fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  async updateDoc(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawType = req.params.type;
      const type = Array.isArray(rawType) ? rawType[0] : rawType;
      if (!type) {
        throw new BadRequestError("Document type is required");
      }

      const { title, content, version } = req.body;
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        throw new BadRequestError("Document content cannot be empty");
      }

      const adminUser = req.user?.email || "Super Admin";

      const doc = await legalService.updateLegalDoc(type, {
        title,
        content,
        version,
        lastUpdatedBy: adminUser,
      });

      sendSuccess(res, doc, `Document ${type} updated and published successfully`);
    } catch (error) {
      next(error);
    }
  }
}

export const legalController = new LegalController();
