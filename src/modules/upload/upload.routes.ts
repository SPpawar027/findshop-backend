import { Router } from "express";
import { uploadController } from "./upload.controller";

export const uploadRouter = Router();

uploadRouter.post("/presigned-url", (req, res, next) =>
  uploadController.getPresignedUrl(req, res, next)
);

uploadRouter.delete("/file", (req, res, next) =>
  uploadController.deleteFile(req, res, next)
);

uploadRouter.get("/info", (req, res, next) =>
  uploadController.getStorageInfo(req, res, next)
);
