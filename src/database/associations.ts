import { User } from "../modules/users/user.model";
import { Shop } from "../modules/shops/shop.model";
import { Product } from "../modules/products/product.model";

/**
 * ============================================================================
 * HOW SEQUELIZE ASSOCIATIONS WORK & PREREQUISITES
 * ============================================================================
 *
 * 1. WHAT WAS SETUP BEFORE THIS?
 * ----------------------------------------------------------------------------
 * A. Physical DB Layer (Migrations):
 *    - In PostgreSQL, the 'shops' table has a column 'ownerId' that points to
 *      'users(id)' with a FOREIGN KEY constraint.
 *    - The 'products' table has 'shopId' pointing to 'shops(id)'.
 *
 * B. TypeScript / Model Layer:
 *    - In User.ts:  `declare shops?: NonAttribute<Shop[]>;`
 *    - In Shop.ts:  `declare owner?: NonAttribute<User>;`
 *                   `declare products?: NonAttribute<Product[]>;`
 *    - In Product.ts: `declare shop?: NonAttribute<Shop>;`
 *
 * 2. WHAT DOES THIS FILE DO?
 * ----------------------------------------------------------------------------
 * Even if the DB has foreign keys, Sequelize (the ORM) does NOT know how to
 * automatically JOIN tables unless you tell it here.
 *
 * Calling `setupAssociations()` teaches Sequelize how to write SQL JOINs when
 * you run queries like:
 *
 *   // Example: Get shop with its owner and all its products
 *   Shop.findByPk(1, {
 *     include: [
 *       { model: User, as: "owner" },       // LEFT OUTER JOIN "users" ON "shops"."ownerId" = "users"."id"
 *       { model: Product, as: "products" }, // LEFT OUTER JOIN "products" ON "shops"."id" = "products"."shopId"
 *     ]
 *   });
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
  // Rule of thumb: The model that holds the foreignKey column uses "belongsTo".
  // The parent model uses "hasMany" or "hasOne".

  // A User can own multiple Shops
  User.hasMany(Shop, {
    foreignKey: "ownerId", // Column on the target table ('shops') that holds the user id
    as: "shops",           // Alias name when querying: user.shops, or include: [{ as: "shops" }]
    onDelete: "RESTRICT",  // Prevents deleting a User if they still own active Shops
  });

  // A Shop belongs to exactly one owner (User)
  Shop.belongsTo(User, {
    foreignKey: "ownerId", // Column on this table ('shops') pointing to User
    as: "owner",           // Alias name when querying: shop.owner, or include: [{ as: "owner" }]
  });

  // --------------------------------------------------------------------------
  // RELATIONSHIP 2: Shop <---- One-to-Many (1:N) ----> Product
  // --------------------------------------------------------------------------

  // A Shop can have many Products
  Shop.hasMany(Product, {
    foreignKey: "shopId",  // Column on the target table ('products') that holds the shop id
    as: "products",        // Alias name: shop.products
    onDelete: "CASCADE",   // If a Shop is deleted, all its products are automatically deleted
  });

  // A Product belongs to one Shop
  Product.belongsTo(Shop, {
    foreignKey: "shopId",  // Column on this table ('products') pointing to Shop
    as: "shop",            // Alias name: product.shop
  });
}
