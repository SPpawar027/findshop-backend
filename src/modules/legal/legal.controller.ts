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

      const { title, version } = req.body;
      const rawContent = req.body.contentHtml || req.body.content;
      if (!rawContent || typeof rawContent !== "string" || rawContent.trim().length === 0) {
        throw new BadRequestError("Document content cannot be empty");
      }

      const adminUser = req.user?.email || "Super Admin";

      const doc = await legalService.updateLegalDoc(type, {
        title,
        content: rawContent,
        contentHtml: rawContent,
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
