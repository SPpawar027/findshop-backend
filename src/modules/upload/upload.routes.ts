import { Router } from "express";
import { uploadController } from "./upload.controller";

export const uploadRouter = Router();

uploadRouter.post("/presigned-url", (req, res, next) =>
  uploadController.getPresignedUrl(req, res, next)
);
