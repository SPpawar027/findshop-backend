import { Router } from "express";
import { locationController } from "./location.controller";

export const locationRouter = Router();

locationRouter.get("/reverse-geocode", (req, res, next) =>
  locationController.reverseGeocode(req, res, next)
);

locationRouter.get("/search", (req, res, next) =>
  locationController.searchPlaces(req, res, next)
);
