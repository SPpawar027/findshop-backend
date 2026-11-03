import { Router } from "express";
import { uploadController } from "./upload.controller";
import { authMiddleware } from "../../core/middlewares/auth.middleware";

export const uploadRouter = Router();

// 1. Upload Authorization (Primary endpoint & legacy backward compatibility)
uploadRouter.post("/authorize", authMiddleware, (req, res, next) =>
  uploadController.authorize(req, res, next)
);

uploadRouter.post("/presigned-url", authMiddleware, (req, res, next) =>
  uploadController.authorize(req, res, next)
);

// 2. Direct S3 Upload Confirmation & File Signature Verification
uploadRouter.post("/confirm", authMiddleware, (req, res, next) =>
  uploadController.confirm(req, res, next)
);

// 3. Image Deletion Request & Tracking (Primary endpoint & legacy backward compatibility)
uploadRouter.post("/delete-request", authMiddleware, (req, res, next) =>
  uploadController.deleteRequest(req, res, next)
);

uploadRouter.delete("/file", authMiddleware, (req, res, next) =>
  uploadController.deleteRequest(req, res, next)
);

// 4. Temporary Upload & Deletion Job Cleanup Job
uploadRouter.post("/cleanup", authMiddleware, (req, res, next) =>
  uploadController.runCleanup(req, res, next)
);

// 5. Public / Non-sensitive Storage Health Info
uploadRouter.get("/info", (req, res, next) =>
  uploadController.getStorageInfo(req, res, next)
);
