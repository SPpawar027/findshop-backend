import type { Request, Response, NextFunction } from "express";
import { locationService } from "./location.service";
import { sendSuccess } from "../../core/utils/response";
import { BadRequestError } from "../../core/errors/AppError";

export class LocationController {
  async reverseGeocode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
      const lng =
        req.query.lng !== undefined
          ? Number(req.query.lng)
          : req.query.lon !== undefined
          ? Number(req.query.lon)
          : undefined;

      if (lat === undefined || isNaN(lat) || lng === undefined || isNaN(lng)) {
        throw new BadRequestError("Valid 'lat' and 'lng' (or 'lon') query parameters are required");
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new BadRequestError("Latitude must be between -90 and 90, Longitude between -180 and 180");
      }

      const result = await locationService.reverseGeocode(lat, lng);
      sendSuccess(res, result, "Location resolved successfully");
    } catch (error) {
      next(error);
    }
  }

  async searchPlaces(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = typeof req.query.q === "string" ? req.query.q : "";
      if (!query.trim()) {
        sendSuccess(res, [], "Query is empty");
        return;
      }

      const results = await locationService.searchPlaces(query);
      sendSuccess(res, results, "Places searched successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const locationController = new LocationController();
