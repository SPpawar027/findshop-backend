import { sequelize } from "../config/database";
import { User } from "../modules/users/user.model";
import { Shop } from "../modules/shops/shop.model";
import { Product } from "../modules/products/product.model";
import { Category } from "../modules/categories/category.model";
import { Review } from "../modules/reviews/review.model";
import { LegalDocument } from "../modules/legal/legal.model";
import { AppVersionConfig } from "../modules/appVersion/appVersion.model";
import { TemporaryUpload } from "../modules/upload/temporaryUpload.model";
import { ImageDeletionJob } from "../modules/upload/imageDeletionJob.model";
import { ImageAsset } from "../modules/upload/imageAsset.model";
import { ShopAnalyticsEvent } from "../modules/analytics/shopAnalyticsEvent.model";
import { ShopAnalyticsDaily } from "../modules/analytics/shopAnalyticsDaily.model";
import { ShopSubcategory } from "../modules/categories/shopSubcategory.model";
import { setupAssociations } from "./associations";

// Initialize associations
setupAssociations();

export {
  sequelize,
  User,
  Shop,
  Product,
  Category,
  Review,
  LegalDocument,
  AppVersionConfig,
  TemporaryUpload,
  ImageDeletionJob,
  ImageAsset,
  ShopAnalyticsEvent,
  ShopAnalyticsDaily,
  ShopSubcategory,
};

