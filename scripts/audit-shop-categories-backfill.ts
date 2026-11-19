/**
 * Dry-run audit script for legacy `shops.category` -> `shop_categories` backfill.
 * Usage (after configuring .env): npx ts-node scripts/audit-shop-categories-backfill.ts
 *
 * Does NOT modify the database. Prints matched, ambiguous, and unmatched legacy shop categories.
 */
import "../src/config/env";
import { sequelize, Shop, Category } from "../src/database";
import { slugifyCategoryName } from "../src/modules/shops/shopCategory.helper";

async function audit() {
  try {
    await sequelize.authenticate();
    const shops = await Shop.findAll({
      attributes: ["id", "name", "slug", "category"],
      order: [["id", "ASC"]],
    });

    const l1Categories = await Category.findAll({
      where: { level: 1, isActive: true },
      attributes: ["id", "name", "slug"],
      order: [["orderIndex", "ASC"]],
    });

    const matched: Array<{ shopId: number; shopName: string; legacy: string; matchedTo: string }> = [];
    const ambiguous: Array<{ shopId: number; shopName: string; legacy: string; candidates: string[] }> = [];
    const unmatched: Array<{ shopId: number; shopName: string; legacy: string }> = [];

    for (const shop of shops) {
      const raw = String(shop.category || "").trim();
      if (!raw) {
        unmatched.push({ shopId: shop.id, shopName: shop.name, legacy: raw });
        continue;
      }

      const lower = raw.toLowerCase();
      const slug = slugifyCategoryName(raw);
      const hits = l1Categories.filter((c) => {
        const cn = c.name.trim().toLowerCase();
        const cs = c.slug.trim().toLowerCase();
        return cn === lower || cs === slug || slugifyCategoryName(cn) === slug;
      });

      if (hits.length === 1) {
        matched.push({
          shopId: shop.id,
          shopName: shop.name,
          legacy: raw,
          matchedTo: `${hits[0].id}:${hits[0].name}`,
        });
      } else if (hits.length > 1) {
        ambiguous.push({
          shopId: shop.id,
          shopName: shop.name,
          legacy: raw,
          candidates: hits.map((h) => `${h.id}:${h.name}`),
        });
      } else {
        unmatched.push({ shopId: shop.id, shopName: shop.name, legacy: raw });
      }
    }

    console.log("=== Shop Categories Backfill Audit (READ-ONLY) ===");
    console.log(`Total shops scanned: ${shops.length}`);
    console.log(`Unambiguous matches: ${matched.length}`);
    console.log(`Ambiguous matches  : ${ambiguous.length}`);
    console.log(`Unmatched shops    : ${unmatched.length}`);

    if (ambiguous.length > 0) {
      console.log("\n[AMBIGUOUS - Resolve manually]:");
      console.table(ambiguous);
    }
    if (unmatched.length > 0) {
      console.log("\n[UNMATCHED - Resolve manually]:");
      console.table(unmatched);
    }
  } finally {
    await sequelize.close();
  }
}

audit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
