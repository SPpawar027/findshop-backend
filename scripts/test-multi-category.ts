/**
 * In-memory unit & security regression tests for Multi-Category & Subcategory logic.
 * Runs without touching any real database or requiring migrations to be applied.
 * Run: npx tsx scripts/test-multi-category.ts
 */
import assert from "node:assert/strict";
import { Op } from "sequelize";
import { Category } from "../src/modules/categories/category.model";
import { Product } from "../src/modules/products/product.model";
import { ShopCategory } from "../src/modules/shops/shopCategory.model";
import { ShopSubcategory } from "../src/modules/categories/shopSubcategory.model";
import {
  validateShopCategorySelection,
  assertSafeCategoryRemoval,
  attachShopCategoriesMeta,
} from "../src/modules/shops/shopCategory.helper";
import { BadRequestError, ConflictError } from "../src/core/errors/AppError";

const MOCK_CATEGORIES: any[] = [
  { id: 1, name: "Gifts & Toys", slug: "gifts-and-toys", level: 1, parentId: null, isActive: true, icon: "gift", emoji: "🎁", imageUrl: null },
  { id: 2, name: "Stationery", slug: "stationery", level: 1, parentId: null, isActive: true, icon: "book", emoji: "✏️", imageUrl: null },
  { id: 3, name: "Home & Decor", slug: "home-and-decor", level: 1, parentId: null, isActive: true, icon: "home", emoji: "🛋️", imageUrl: null },
  { id: 4, name: "Electronics", slug: "electronics", level: 1, parentId: null, isActive: true, icon: "cpu", emoji: "📱", imageUrl: null },
  { id: 5, name: "Archived L1", slug: "archived-l1", level: 1, parentId: null, isActive: false, icon: "archive", emoji: "📦", imageUrl: null },
  { id: 10, name: "Birthday Gifts", slug: "birthday-gifts", level: 2, parentId: 1, isActive: true, icon: "gift", emoji: "🎂", imageUrl: null },
  { id: 20, name: "Notebooks", slug: "notebooks", level: 2, parentId: 2, isActive: true, icon: "book", emoji: "📓", imageUrl: null },
  { id: 21, name: "Pens", slug: "pens", level: 2, parentId: 2, isActive: true, icon: "pen", emoji: "🖊️", imageUrl: null },
];

async function runTests() {
  let passed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // Stub Category.findAll
  const origCatFindAll = Category.findAll.bind(Category);
  const origProdCount = Product.count.bind(Product);

  (Category as any).findAll = async (opts: any) => {
    const where = opts?.where || {};
    let items = [...MOCK_CATEGORIES];
    if (where.id) {
      const ids = Array.isArray(where.id) ? where.id : where.id[Op.in];
      items = items.filter((c) => ids.includes(c.id));
    }
    if (where.parentId) {
      const pids = Array.isArray(where.parentId) ? where.parentId : where.parentId[Op.in];
      items = items.filter((c) => pids.includes(c.parentId));
    }
    if (where.level !== undefined) {
      items = items.filter((c) => c.level === where.level);
    }
    return items;
  };

  try {
    await test("Accepts 1, 2, or 3 valid active L1 categories", async () => {
      const res1 = await validateShopCategorySelection([1]);
      assert.equal(res1.categoryIds.length, 1);
      assert.equal(res1.primaryCategoryId, 1);

      const res2 = await validateShopCategorySelection([1, 2], 2);
      assert.deepEqual(res2.categoryIds, [1, 2]);
      assert.equal(res2.primaryCategoryId, 2);
      assert.equal(res2.primaryCategory.name, "Stationery");

      const res3 = await validateShopCategorySelection([1, 2, 3], 3);
      assert.deepEqual(res3.categoryIds, [1, 2, 3]);
      assert.equal(res3.primaryCategoryId, 3);
    });

    await test("Rejects 0 categories", async () => {
      await assert.rejects(
        () => validateShopCategorySelection([]),
        (err: any) => err instanceof BadRequestError && err.statusCode === 400
      );
    });

    await test("Rejects 4th category (enforces max 3 limit)", async () => {
      await assert.rejects(
        () => validateShopCategorySelection([1, 2, 3, 4]),
        (err: any) => err instanceof BadRequestError && err.message.includes("maximum of 3")
      );
    });

    await test("Rejects duplicate category IDs", async () => {
      await assert.rejects(
        () => validateShopCategorySelection([1, 1]),
        (err: any) => err instanceof BadRequestError && err.message.includes("Duplicate")
      );
    });

    await test("Rejects inactive L1 category", async () => {
      await assert.rejects(
        () => validateShopCategorySelection([1, 5]),
        (err: any) => err instanceof BadRequestError && err.message.includes("inactive")
      );
    });

    await test("Rejects L2 subcategory passed as a main shop category", async () => {
      await assert.rejects(
        () => validateShopCategorySelection([1, 10]),
        (err: any) => err instanceof BadRequestError && err.message.includes("not a main (L1)")
      );
    });

    await test("Rejects non-existent category ID", async () => {
      await assert.rejects(
        () => validateShopCategorySelection([999]),
        (err: any) => err instanceof BadRequestError && err.message.includes("does not exist")
      );
    });

    await test("Rejects primaryCategoryId that is not in selected categoryIds", async () => {
      await assert.rejects(
        () => validateShopCategorySelection([1, 2], 3),
        (err: any) => err instanceof BadRequestError && err.message.includes("primaryCategoryId")
      );
    });

    await test("Blocks unsafe category removal when active products exist (409 Conflict with count)", async () => {
      (Product as any).count = async () => 40;
      await assert.rejects(
        () => assertSafeCategoryRemoval(101, [2]),
        (err: any) =>
          err instanceof ConflictError &&
          err.statusCode === 409 &&
          err.message.includes("Stationery") &&
          err.message.includes("40") &&
          err.details?.code === "CATEGORY_HAS_DEPENDENT_PRODUCTS" &&
          err.details?.totalAffectedProducts === 40
      );
    });

    await test("Allows category removal when 0 active products depend on it", async () => {
      (Product as any).count = async () => 0;
      await assertSafeCategoryRemoval(101, [2]);
    });

    await test("attachShopCategoriesMeta sorts primary category first and exposes IDs", async () => {
      const enriched = attachShopCategoriesMeta(
        { id: 10, name: "Demo Store", category: "Stationery" },
        [
          { id: 1, name: "Gifts & Toys", slug: "gifts-and-toys", icon: "gift", emoji: "🎁", imageUrl: null, isPrimary: false },
          { id: 2, name: "Stationery", slug: "stationery", icon: "book", emoji: "✏️", imageUrl: null, isPrimary: true },
        ]
      );
      assert.equal(enriched.primaryCategoryId, 2);
      assert.deepEqual(enriched.categoryIds, [2, 1]);
      assert.equal(enriched.categories[0].name, "Stationery");
    });

    // Verify models are defined
    assert.ok(ShopCategory.tableName === "shop_categories");
    assert.ok(ShopSubcategory.tableName === "shop_subcategories");

    console.log(`\n🎉 All ${passed} multi-category backend tests passed!`);
  } finally {
    (Category as any).findAll = origCatFindAll;
    (Product as any).count = origProdCount;
  }
}

runTests();
