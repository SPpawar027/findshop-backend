"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create normalized shop_categories join table (idempotent)
    const tableExists = await queryInterface.tableExists("shop_categories");
    if (!tableExists) {
      await queryInterface.createTable("shop_categories", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        shop_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "shops",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        category_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "categories",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        is_primary: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });
    }

    // 2. Constraints & Indexes on shop_categories
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_categories_shop_category
      ON shop_categories (shop_id, category_id);
    `);

    // Native PostgreSQL partial unique index: guarantees at most ONE primary category per shop
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_categories_one_primary_per_shop
      ON shop_categories (shop_id)
      WHERE is_primary = true;
    `);

    // Fast category-based shop discovery index
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_shop_categories_category_id
      ON shop_categories (category_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_shop_categories_shop_primary
      ON shop_categories (shop_id, is_primary);
    `);

    // 3. Product query & pagination composite indexes
    // Optimizes GET /api/products?shopId=...&categoryId=...&page=...&limit=...
    // and GROUP BY subcategory active product count queries
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_products_shop_cat_avail_sort
      ON products ("shopId", "categoryId", "isAvailable", sort_order, id)
      WHERE "deletedAt" IS NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_products_shop_sort_id
      ON products ("shopId", sort_order, "createdAt" DESC, id)
      WHERE "deletedAt" IS NULL;
    `);

    // 4. Safe, unambiguous backfill for existing shops -> shop_categories
    // Matches legacy shops.category strictly against active L1 categories by exact case-insensitive name or slug.
    // Ambiguous (multiple matches) or unmatched shop categories are NEVER silently assigned;
    // they are logged clearly for manual review.
    try {
      const [shops] = await queryInterface.sequelize.query(`
        SELECT s.id, s.name, s.category
        FROM shops s
        WHERE NOT EXISTS (
          SELECT 1 FROM shop_categories sc WHERE sc.shop_id = s.id
        )
        ORDER BY s.id ASC;
      `);

      const [l1Categories] = await queryInterface.sequelize.query(`
        SELECT id, name, slug
        FROM categories
        WHERE level = 1 AND "isActive" = true;
      `);

      const slugify = (val) =>
        String(val || "")
          .toLowerCase()
          .trim()
          .replace(/&/g, "and")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

      const unmatched = [];
      const ambiguous = [];
      let backfilledCount = 0;

      for (const shop of shops) {
        const rawCat = String(shop.category || "").trim();
        if (!rawCat) {
          unmatched.push({ shopId: shop.id, shopName: shop.name, legacyCategory: rawCat, reason: "Empty legacy category" });
          continue;
        }

        const lowerRaw = rawCat.toLowerCase();
        const slugRaw = slugify(rawCat);

        const matches = l1Categories.filter((cat) => {
          const catName = String(cat.name || "").trim().toLowerCase();
          const catSlug = String(cat.slug || "").trim().toLowerCase();
          return catName === lowerRaw || catSlug === slugRaw || slugify(catName) === slugRaw;
        });

        if (matches.length === 1) {
          const matchedCat = matches[0];
          await queryInterface.sequelize.query(
            `
            INSERT INTO shop_categories (shop_id, category_id, is_primary, created_at, updated_at)
            VALUES (:shopId, :categoryId, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (shop_id, category_id) DO NOTHING;
            `,
            {
              replacements: { shopId: shop.id, categoryId: matchedCat.id },
            }
          );
          backfilledCount++;

          // Preserve existing shop visibility for subcategories that already have products
          // or were previously visible by default for this legacy shop (if shop has no shop_subcategories yet)
          const [existingSubRows] = await queryInterface.sequelize.query(
            `SELECT COUNT(*)::int AS cnt FROM shop_subcategories WHERE shop_id = :shopId;`,
            { replacements: { shopId: shop.id } }
          );
          const hasExistingSubConfig = (existingSubRows[0]?.cnt || 0) > 0;
          if (!hasExistingSubConfig) {
            // Seed existing L2 subcategories under this legacy L1 category as visible
            // so existing shops retain their previous live visibility settings seamlessly.
            await queryInterface.sequelize.query(
              `
              INSERT INTO shop_subcategories (shop_id, subcategory_id, sort_order, is_visible, created_at, updated_at)
              SELECT :shopId, c.id, c."orderIndex", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              FROM categories c
              WHERE c."parentId" = :categoryId AND c.level = 2 AND c."isActive" = true
              ON CONFLICT (shop_id, subcategory_id) DO NOTHING;
              `,
              {
                replacements: { shopId: shop.id, categoryId: matchedCat.id },
              }
            );
          }
        } else if (matches.length > 1) {
          ambiguous.push({
            shopId: shop.id,
            shopName: shop.name,
            legacyCategory: rawCat,
            candidates: matches.map((m) => `${m.id}:${m.name}`),
          });
        } else {
          unmatched.push({
            shopId: shop.id,
            shopName: shop.name,
            legacyCategory: rawCat,
            reason: "No matching active L1 category",
          });
        }
      }

      console.log(`[Migration shop_categories] Backfilled ${backfilledCount} shop(s) unambiguously.`);
      if (ambiguous.length > 0) {
        console.warn(
          `[Migration shop_categories] WARNING: ${ambiguous.length} shop(s) had AMBIGUOUS legacy categories (skipped, manual review required):`,
          JSON.stringify(ambiguous)
        );
      }
      if (unmatched.length > 0) {
        console.warn(
          `[Migration shop_categories] WARNING: ${unmatched.length} shop(s) had UNMATCHED legacy categories (skipped, manual review required):`,
          JSON.stringify(unmatched)
        );
      }
    } catch (backfillErr) {
      console.error("[Migration shop_categories] Backfill step encountered an error:", backfillErr);
      throw backfillErr;
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_products_shop_sort_id;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_products_shop_cat_avail_sort;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_shop_categories_shop_primary;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_shop_categories_category_id;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS uq_shop_categories_one_primary_per_shop;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS uq_shop_categories_shop_category;`);
    await queryInterface.dropTable("shop_categories");
  },
};
