"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable("products").catch(() => ({}));
    if (!tableInfo.sort_order && !tableInfo.sortOrder) {
      await queryInterface.addColumn("products", "sort_order", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });

      await queryInterface.addIndex("products", ["shopId", "categoryId", "sort_order"], {
        name: "idx_products_shop_category_sort_order",
      });
    }

    // 1. Safe deterministic backfill of categoryId for legacy products
    try {
      await queryInterface.sequelize.query(`
        UPDATE products p
        SET "categoryId" = c.id
        FROM categories c
        WHERE p."categoryId" IS NULL
          AND LOWER(TRIM(p.category)) = LOWER(TRIM(c.name));
      `);
    } catch {
      // Ignore if categories table does not exist or has no matching records
    }

    // 2. Safe deterministic backfill of sequential sort_order partitioned by shopId and categoryId
    try {
      await queryInterface.sequelize.query(`
        WITH numbered AS (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY "shopId", COALESCE("categoryId", 0)
            ORDER BY "createdAt" ASC, id ASC
          ) AS seq
          FROM products
        )
        UPDATE products
        SET sort_order = numbered.seq
        FROM numbered
        WHERE products.id = numbered.id
          AND (products.sort_order IS NULL OR products.sort_order = 0);
      `);
    } catch {
      // Ignore if products table is empty
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable("products").catch(() => ({}));
    if (tableInfo.sort_order) {
      await queryInterface.removeColumn("products", "sort_order");
    }
  },
};

