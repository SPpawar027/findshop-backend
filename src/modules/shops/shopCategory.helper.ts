import { Op, Transaction } from "sequelize";
import { Category } from "../categories/category.model";
import { ShopCategory } from "./shopCategory.model";
import { Shop } from "./shop.model";
import { Product } from "../products/product.model";
import { BadRequestError, ConflictError } from "../../core/errors/AppError";

export const MAX_SHOP_CATEGORIES = 3;
export const MIN_SHOP_CATEGORIES = 1;

export interface ShopCategorySummary {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  emoji: string | null;
  imageUrl: string | null;
  isPrimary: boolean;
}

export interface ValidatedShopCategorySelection {
  categoryIds: number[];
  primaryCategoryId: number;
  categories: Category[];
  primaryCategory: Category;
}

export function slugifyCategoryName(value: string): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Validates raw categoryIds & primaryCategoryId payload:
 * - 1 to 3 unique positive integer IDs
 * - All IDs must exist in `categories`, be active (`isActive: true`), and be L1 (`level: 1`)
 * - Rejects duplicates, invalid IDs, L2 categories, or inactive categories
 * - Ensures exactly one primaryCategoryId (defaults to categoryIds[0] if omitted)
 */
export async function validateShopCategorySelection(
  rawCategoryIds: unknown,
  rawPrimaryCategoryId?: unknown,
  transaction?: Transaction
): Promise<ValidatedShopCategorySelection> {
  if (!Array.isArray(rawCategoryIds)) {
    throw new BadRequestError("categoryIds must be an array of 1 to 3 main category IDs");
  }

  if (rawCategoryIds.length < MIN_SHOP_CATEGORIES) {
    throw new BadRequestError("At least 1 main category must be selected");
  }

  if (rawCategoryIds.length > MAX_SHOP_CATEGORIES) {
    throw new BadRequestError(
      `A shop can have a maximum of ${MAX_SHOP_CATEGORIES} main categories`
    );
  }

  const parsedIds: number[] = [];
  const seen = new Set<number>();

  for (const raw of rawCategoryIds) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestError(`Invalid category ID: "${String(raw)}"`);
    }
    if (seen.has(id)) {
      throw new BadRequestError(`Duplicate category ID ${id} is not allowed`);
    }
    seen.add(id);
    parsedIds.push(id);
  }

  const foundCategories = await Category.findAll({
    where: { id: { [Op.in]: parsedIds } },
    transaction,
  });

  const foundMap = new Map<number, Category>();
  for (const cat of foundCategories) {
    foundMap.set(cat.id, cat);
  }

  for (const id of parsedIds) {
    const cat = foundMap.get(id);
    if (!cat) {
      throw new BadRequestError(`Category with ID ${id} does not exist`);
    }
    if (!cat.isActive) {
      throw new BadRequestError(`Category "${cat.name}" (ID ${id}) is inactive and cannot be selected`);
    }
    if (cat.level !== 1 || cat.parentId !== null) {
      throw new BadRequestError(
        `Category "${cat.name}" (ID ${id}) is not a main (L1) category`
      );
    }
  }

  let primaryCategoryId: number;
  if (rawPrimaryCategoryId !== undefined && rawPrimaryCategoryId !== null && rawPrimaryCategoryId !== "") {
    const parsedPrimary = Number(rawPrimaryCategoryId);
    if (!Number.isInteger(parsedPrimary) || !seen.has(parsedPrimary)) {
      throw new BadRequestError(
        "primaryCategoryId must be one of the selected categoryIds"
      );
    }
    primaryCategoryId = parsedPrimary;
  } else {
    primaryCategoryId = parsedIds[0];
  }

  const orderedCategories = parsedIds.map((id) => foundMap.get(id)!);
  const primaryCategory = foundMap.get(primaryCategoryId)!;

  return {
    categoryIds: parsedIds,
    primaryCategoryId,
    categories: orderedCategories,
    primaryCategory,
  };
}

/**
 * Resolves a legacy single category string (e.g. "Gifts & Toys") to an active L1 Category
 * when exact unambiguous match exists.
 */
export async function resolveLegacyCategoryName(
  categoryName: string | null | undefined,
  transaction?: Transaction
): Promise<Category | null> {
  const trimmed = String(categoryName || "").trim();
  if (!trimmed) return null;

  const slug = slugifyCategoryName(trimmed);
  const matches = await Category.findAll({
    where: {
      level: 1,
      isActive: true,
      [Op.or]: [
        { name: { [Op.iLike]: trimmed } },
        { slug: { [Op.iLike]: slug } },
      ],
    },
    transaction,
  });

  if (matches.length === 1) {
    return matches[0];
  }
  return null;
}

/**
 * Returns the effective L1 categories assigned to a shop.
 * Primary source: `shop_categories` join table.
 * Transition fallback: resolves legacy `shop.category` string if no `shop_categories` rows exist yet.
 */
export async function getEffectiveShopL1Categories(
  shop: Pick<Shop, "id" | "category">,
  transaction?: Transaction
): Promise<ShopCategorySummary[]> {
  let rows: ShopCategory[] = [];
  try {
    rows = await ShopCategory.findAll({
      where: { shopId: shop.id },
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name", "slug", "icon", "emoji", "imageUrl", "isActive", "level"],
          required: true,
        },
      ],
      order: [
        ["isPrimary", "DESC"],
        ["id", "ASC"],
      ],
      transaction,
    });
  } catch (err: any) {
    // Graceful transition fallback if shop_categories migration hasn't been executed yet
    if (err?.parent?.code === "42P01" || String(err?.message || "").includes("shop_categories")) {
      rows = [];
    } else {
      throw err;
    }
  }

  if (rows.length > 0) {
    return rows
      .filter((r) => Boolean(r.category))
      .map((r) => ({
        id: r.category!.id,
        name: r.category!.name,
        slug: r.category!.slug,
        icon: r.category!.icon,
        emoji: r.category!.emoji,
        imageUrl: r.category!.imageUrl ?? null,
        isPrimary: Boolean(r.isPrimary),
      }));
  }

  // Legacy transition fallback
  const legacyCat = await resolveLegacyCategoryName(shop.category, transaction);
  if (legacyCat) {
    return [
      {
        id: legacyCat.id,
        name: legacyCat.name,
        slug: legacyCat.slug,
        icon: legacyCat.icon,
        emoji: legacyCat.emoji,
        imageUrl: legacyCat.imageUrl ?? null,
        isPrimary: true,
      },
    ];
  }

  return [];
}

/**
 * Batch-fetches shop categories for multiple shops in a SINGLE query (zero N+1).
 */
export async function batchFetchShopCategoriesMap(
  shops: Array<Pick<Shop, "id" | "category">>
): Promise<Map<number, ShopCategorySummary[]>> {
  const result = new Map<number, ShopCategorySummary[]>();
  if (shops.length === 0) return result;

  const shopIds = shops.map((s) => s.id);
  let rows: ShopCategory[] = [];
  try {
    rows = await ShopCategory.findAll({
      where: { shopId: { [Op.in]: shopIds } },
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name", "slug", "icon", "emoji", "imageUrl"],
          required: true,
        },
      ],
      order: [
        ["isPrimary", "DESC"],
        ["id", "ASC"],
      ],
    });
  } catch (err: any) {
    if (err?.parent?.code === "42P01" || String(err?.message || "").includes("shop_categories")) {
      rows = [];
    } else {
      throw err;
    }
  }

  for (const r of rows) {
    if (!r.category) continue;
    const list = result.get(r.shopId) || [];
    list.push({
      id: r.category.id,
      name: r.category.name,
      slug: r.category.slug,
      icon: r.category.icon,
      emoji: r.category.emoji,
      imageUrl: r.category.imageUrl ?? null,
      isPrimary: Boolean(r.isPrimary),
    });
    result.set(r.shopId, list);
  }

  // For any shop without shop_categories rows yet, resolve legacy category names in 1 batched query
  const unmappedShops = shops.filter((s) => !result.has(s.id) && s.category?.trim());
  if (unmappedShops.length > 0) {
    const l1Cats = await Category.findAll({
      where: { level: 1, isActive: true },
      attributes: ["id", "name", "slug", "icon", "emoji", "imageUrl"],
    });
    for (const s of unmappedShops) {
      const lower = s.category.trim().toLowerCase();
      const slug = slugifyCategoryName(s.category);
      const matches = l1Cats.filter(
        (c) =>
          c.name.trim().toLowerCase() === lower ||
          c.slug.trim().toLowerCase() === slug ||
          slugifyCategoryName(c.name) === slug
      );
      if (matches.length === 1) {
        const c = matches[0];
        result.set(s.id, [
          {
            id: c.id,
            name: c.name,
            slug: c.slug,
            icon: c.icon,
            emoji: c.emoji,
            imageUrl: c.imageUrl ?? null,
            isPrimary: true,
          },
        ]);
      } else {
        result.set(s.id, []);
      }
    }
  }

  return result;
}

/**
 * Safety check before removing L1 categories from a shop:
 * Checks whether any non-deleted, active products belong to subcategories under the removed L1 categories.
 * Throws a 409 ConflictError with exact counts & actionable details if removal is unsafe.
 * Never deletes products or images.
 */
export async function assertSafeCategoryRemoval(
  shopId: number,
  removedCategoryIds: number[],
  transaction?: Transaction
): Promise<void> {
  if (removedCategoryIds.length === 0) return;

  const removedL1Categories = await Category.findAll({
    where: { id: { [Op.in]: removedCategoryIds } },
    attributes: ["id", "name"],
    transaction,
  });

  const childSubcategories = await Category.findAll({
    where: {
      parentId: { [Op.in]: removedCategoryIds },
      level: 2,
    },
    attributes: ["id", "name", "parentId"],
    transaction,
  });

  const subcatsByParent = new Map<number, { ids: number[]; names: string[] }>();
  for (const sub of childSubcategories) {
    if (!sub.parentId) continue;
    const entry = subcatsByParent.get(sub.parentId) || { ids: [], names: [] };
    entry.ids.push(sub.id);
    entry.names.push(sub.name);
    subcatsByParent.set(sub.parentId, entry);
  }

  const blockedCategories: Array<{
    categoryId: number;
    categoryName: string;
    productCount: number;
  }> = [];

  for (const parentCat of removedL1Categories) {
    const subInfo = subcatsByParent.get(parentCat.id);
    const orConditions: any[] = [{ categoryId: parentCat.id }];

    if (subInfo && subInfo.ids.length > 0) {
      orConditions.push({ categoryId: { [Op.in]: subInfo.ids } });
      // Also catch legacy products where categoryId was NULL but category string matched a child subcategory
      orConditions.push({
        categoryId: null,
        category: { [Op.in]: subInfo.names },
      });
    }

    const activeProductCount = await Product.count({
      where: {
        shopId,
        isAvailable: true,
        [Op.or]: orConditions,
      },
      transaction,
    });

    if (activeProductCount > 0) {
      blockedCategories.push({
        categoryId: parentCat.id,
        categoryName: parentCat.name,
        productCount: activeProductCount,
      });
    }
  }

  if (blockedCategories.length > 0) {
    const summaryParts = blockedCategories.map(
      (b) => `"${b.categoryName}" (${b.productCount} active product${b.productCount === 1 ? "" : "s"})`
    );
    const totalAffected = blockedCategories.reduce((sum, b) => sum + b.productCount, 0);

    throw new ConflictError(
      `Cannot remove ${summaryParts.join(", ")} because ${totalAffected} active product${totalAffected === 1 ? "" : "s"} still belong to ${blockedCategories.length === 1 ? "it" : "them"}. Please reassign or deactivate those products before removing the category.`,
      {
        code: "CATEGORY_HAS_DEPENDENT_PRODUCTS",
        totalAffectedProducts: totalAffected,
        blockedCategories,
      }
    );
  }
}

/**
 * Syncs `shop_categories` inside an existing transaction (caller must hold FOR UPDATE lock on Shop row).
 */
export async function syncShopCategoriesInTransaction(
  shopId: number,
  selection: ValidatedShopCategorySelection,
  transaction: Transaction
): Promise<ShopCategorySummary[]> {
  // Replace shop_categories rows atomically
  await ShopCategory.destroy({
    where: { shopId },
    transaction,
  });

  await ShopCategory.bulkCreate(
    selection.categoryIds.map((catId) => ({
      shopId,
      categoryId: catId,
      isPrimary: catId === selection.primaryCategoryId,
    })),
    { transaction }
  );

  // Return formatted summaries sorted with primary first
  return selection.categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      emoji: c.emoji,
      imageUrl: c.imageUrl ?? null,
      isPrimary: c.id === selection.primaryCategoryId,
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

export function attachShopCategoriesMeta<T extends Record<string, any>>(
  shopObj: T,
  categories: ShopCategorySummary[]
): T & {
  categories: ShopCategorySummary[];
  categoryIds: number[];
  primaryCategoryId: number | null;
} {
  const sorted = [...categories].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const primary = sorted.find((c) => c.isPrimary) || sorted[0] || null;
  return {
    ...shopObj,
    categories: sorted,
    categoryIds: sorted.map((c) => c.id),
    primaryCategoryId: primary ? primary.id : null,
  };
}
