import { User } from "../modules/users/user.model";
import { Shop } from "../modules/shops/shop.model";
import { Product } from "../modules/products/product.model";
import { Category } from "../modules/categories/category.model";
import { Review } from "../modules/reviews/review.model";

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
}


