import { User } from "../modules/users/user.model";
import { Shop } from "../modules/shops/shop.model";
import { Product } from "../modules/products/product.model";
import { Category } from "../modules/categories/category.model";
import { Review } from "../modules/reviews/review.model";
import { TemporaryUpload } from "../modules/upload/temporaryUpload.model";
import { ImageDeletionJob } from "../modules/upload/imageDeletionJob.model";
import { ImageAsset } from "../modules/upload/imageAsset.model";
import { ShopAnalyticsEvent } from "../modules/analytics/shopAnalyticsEvent.model";
import { ShopAnalyticsDaily } from "../modules/analytics/shopAnalyticsDaily.model";
import { ShopAnalyticsUniqueVisitor } from "../modules/analytics/shopAnalyticsUniqueVisitor.model";
import { ShopSubcategory } from "../modules/categories/shopSubcategory.model";
import { ShopCategory } from "../modules/shops/shopCategory.model";

/**
 * ============================================================================
 * HOW SEQUELIZE ASSOCIATIONS WORK & PREREQUISITES
 * ============================================================================
 */

let associationsInitialized = false;

export function setupAssociations(): void {
  if (associationsInitialized) {
    return;
  }
  associationsInitialized = true;

  // --------------------------------------------------------------------------
  // RELATIONSHIP 1: User (Shop Admin) <---- One-to-Many (1:N) ----> Shop
  // --------------------------------------------------------------------------
  User.hasMany(Shop, {
    foreignKey: "ownerId",
    as: "shops",
    onDelete: "RESTRICT",
  });

  Shop.belongsTo(User, {
    foreignKey: "ownerId",
    as: "owner",
  });

  // --------------------------------------------------------------------------
  // RELATIONSHIP 2: Shop <---- One-to-Many (1:N) ----> Product
  // --------------------------------------------------------------------------
  Shop.hasMany(Product, {
    foreignKey: "shopId",
    as: "products",
    onDelete: "CASCADE",
  });

  Product.belongsTo(Shop, {
    foreignKey: "shopId",
    as: "shop",
  });

  // --------------------------------------------------------------------------
  // RELATIONSHIP 3: Category (Self-Reference Hierarchy: L1 <-> L2)
  // --------------------------------------------------------------------------
  Category.hasMany(Category, {
    foreignKey: "parentId",
    as: "subcategories",
    onDelete: "CASCADE",
  });

  Category.belongsTo(Category, {
    foreignKey: "parentId",
    as: "parent",
  });

  // --------------------------------------------------------------------------
  // RELATIONSHIP 4: Category <---- One-to-Many (1:N) ----> Product
  // --------------------------------------------------------------------------
  Category.hasMany(Product, {
    foreignKey: "categoryId",
    as: "products",
    onDelete: "SET NULL",
  });

  Product.belongsTo(Category, {
    foreignKey: "categoryId",
    as: "categoryRef",
  });

  // --------------------------------------------------------------------------
  // RELATIONSHIP 5: Review <---- (Shop, Product, User)
  // --------------------------------------------------------------------------
  Review.belongsTo(User, {
    foreignKey: "userId",
    as: "user",
  });

  User.hasMany(Review, {
    foreignKey: "userId",
    as: "reviews",
    onDelete: "CASCADE",
  });

  Review.belongsTo(Shop, {
    foreignKey: "shopId",
    as: "shop",
  });

  Shop.hasMany(Review, {
    foreignKey: "shopId",
    as: "reviews",
    onDelete: "CASCADE",
  });

  Review.belongsTo(Product, {
    foreignKey: "productId",
    as: "product",
  });

  Product.hasMany(Review, {
    foreignKey: "productId",
    as: "reviews",
    onDelete: "CASCADE",
  });

  Review.belongsTo(Shop, {
    foreignKey: "reportedByShopId",
    as: "reportedByShop",
  });

  // --------------------------------------------------------------------------
  // RELATIONSHIP 6: Storage & Image Assets
  // --------------------------------------------------------------------------
  User.hasMany(TemporaryUpload, {
    foreignKey: "userId",
    as: "temporaryUploads",
    onDelete: "CASCADE",
  });

  TemporaryUpload.belongsTo(User, {
    foreignKey: "userId",
    as: "user",
  });

  Shop.hasMany(TemporaryUpload, {
    foreignKey: "shopId",
    as: "temporaryUploads",
    onDelete: "SET NULL",
  });

  TemporaryUpload.belongsTo(Shop, {
    foreignKey: "shopId",
    as: "shop",
  });

  Shop.hasMany(ImageAsset, {
    foreignKey: "shopId",
    as: "imageAssets",
    onDelete: "CASCADE",
  });

  ImageAsset.belongsTo(Shop, {
    foreignKey: "shopId",
    as: "shop",
  });

  User.hasMany(ImageDeletionJob, {
    foreignKey: "requestedByUserId",
    as: "deletionJobs",
    onDelete: "SET NULL",
  });

  ImageDeletionJob.belongsTo(User, {
    foreignKey: "requestedByUserId",
    as: "requestedByUser",
  });

  // --------------------------------------------------------------------------
  // RELATIONSHIP 7: Shop Analytics (Raw Events & Daily Aggregates)
  // --------------------------------------------------------------------------
  Shop.hasMany(ShopAnalyticsEvent, {
    foreignKey: "shopId",
    as: "analyticsEvents",
    onDelete: "CASCADE",
  });

  ShopAnalyticsEvent.belongsTo(Shop, {
    foreignKey: "shopId",
    as: "shop",
  });

  User.hasMany(ShopAnalyticsEvent, {
    foreignKey: "userId",
    as: "analyticsEvents",
    onDelete: "SET NULL",
  });

  ShopAnalyticsEvent.belongsTo(User, {
    foreignKey: "userId",
    as: "user",
  });

  Product.hasMany(ShopAnalyticsEvent, {
    foreignKey: "productId",
    as: "analyticsEvents",
    onDelete: "SET NULL",
  });

  ShopAnalyticsEvent.belongsTo(Product, {
    foreignKey: "productId",
    as: "product",
  });

  Shop.hasMany(ShopAnalyticsDaily, {
    foreignKey: "shopId",
    as: "dailyAnalytics",
    onDelete: "CASCADE",
  });

  ShopAnalyticsDaily.belongsTo(Shop, {
    foreignKey: "shopId",
    as: "shop",
  });

  Shop.hasMany(ShopAnalyticsUniqueVisitor, {
    foreignKey: "shopId",
    as: "uniqueVisitors",
    onDelete: "CASCADE",
  });

  ShopAnalyticsUniqueVisitor.belongsTo(Shop, {
    foreignKey: "shopId",
    as: "shop",
  });

  // --------------------------------------------------------------------------
  // RELATIONSHIP 8: Shop Subcategories (Shop-Specific Subcategory Ordering & Visibility)
  // --------------------------------------------------------------------------
  Shop.hasMany(ShopSubcategory, {
    foreignKey: "shopId",
    as: "shopSubcategories",
    onDelete: "CASCADE",
  });

  ShopSubcategory.belongsTo(Shop, {
    foreignKey: "shopId",
    as: "shop",
  });

  Category.hasMany(ShopSubcategory, {
    foreignKey: "subcategoryId",
    as: "shopSubcategories",
    onDelete: "CASCADE",
  });

  ShopSubcategory.belongsTo(Category, {
    foreignKey: "subcategoryId",
    as: "subcategory",
  });

  // --------------------------------------------------------------------------
  // RELATIONSHIP 9: Shop <-> Category (Many-to-Many L1 Shop Categories, max 3)
  // --------------------------------------------------------------------------
  Shop.hasMany(ShopCategory, {
    foreignKey: "shopId",
    as: "shopCategories",
    onDelete: "CASCADE",
  });

  ShopCategory.belongsTo(Shop, {
    foreignKey: "shopId",
    as: "shop",
  });

  Category.hasMany(ShopCategory, {
    foreignKey: "categoryId",
    as: "shopCategories",
    onDelete: "RESTRICT",
  });

  ShopCategory.belongsTo(Category, {
    foreignKey: "categoryId",
    as: "category",
  });

  Shop.belongsToMany(Category, {
    through: ShopCategory,
    foreignKey: "shopId",
    otherKey: "categoryId",
    as: "categories",
  });

  Category.belongsToMany(Shop, {
    through: ShopCategory,
    foreignKey: "categoryId",
    otherKey: "shopId",
    as: "shops",
  });
}


