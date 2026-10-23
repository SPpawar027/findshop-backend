import { Request, Response, NextFunction } from "express";
import { appVersionService } from "./appVersion.service";

export class AppVersionController {
  /**
   * Public endpoint to check update status for mobile clients
   * GET /api/app-version/check?platform=android&version=1.0.0
   */
  async checkUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const platform = (req.query.platform as string) || "android";
      const clientVersion = (req.query.version as string) || "1.0.0";

      const result = await appVersionService.checkUpdate(platform, clientVersion);
      res.json({
        success: true,
        message: result.hasUpdate
          ? `Update available (${result.updateType})`
          : "App is up to date",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin endpoint: get all platform version configurations
   * GET /api/app-version
   */
  async getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configs = await appVersionService.getAll();
      res.json({
        success: true,
        message: "Version configurations retrieved successfully",
        data: configs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin endpoint: update version config for a platform
   * PUT /api/app-version/:platform
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const platform = String(req.params.platform || "android");
      const updated = await appVersionService.updateConfig(platform, req.body);
      res.json({
        success: true,
        message: `App version config for ${platform} updated successfully`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const appVersionController = new AppVersionController();
