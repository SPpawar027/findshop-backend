import { Op, fn, col, literal } from "sequelize";
import { sequelize } from "../../config/database";
import { Category } from "./category.model";
import { ShopSubcategory } from "./shopSubcategory.model";
import { Shop } from "../shops/shop.model";
import { Product } from "../products/product.model";
import { DEFAULT_PRIMARY_CATEGORIES } from "./category.defaults";
import { NotFoundError, BadRequestError, ConflictError } from "../../core/errors/AppError";
import { getEffectiveShopL1Categories } from "../shops/shopCategory.helper";

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  description?: string;
  parentId?: number | null;
  level?: number;
  icon?: string;
  emoji?: string;
  imageUrl?: string | null;
  orderIndex?: number;
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string;
  parentId?: number | null;
  level?: number;
  icon?: string;
  emoji?: string;
  imageUrl?: string | null;
  orderIndex?: number;
  isActive?: boolean;
}

export interface ListCategoriesQuery {
  level?: number;
  parentId?: number | null;
  search?: string;
  isActive?: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class CategoryService {
  /**
   * Auto-seed standard 5 Primary Categories + Subcategories if table is empty
   */
  async ensureDefaultCategories(): Promise<{ seeded: boolean; count: number }> {
    try {
      // Ensure table exists in database
      await Category.sync();

      const existingCount = await Category.count();
      if (existingCount > 0) {
        return { seeded: false, count: existingCount };
      }

      console.log("🌱 Seeding standard FindShopEasily MVP categories...");
      let totalCreated = 0;

      for (const catData of DEFAULT_PRIMARY_CATEGORIES) {
        // Create L1 Department
        const [parent] = await Category.findOrCreate({
          where: { slug: catData.slug },
          defaults: {
            name: catData.name,
            slug: catData.slug,
            description: catData.description,
            level: 1,
            parentId: null,
            icon: catData.icon,
            emoji: catData.emoji,
            orderIndex: catData.orderIndex,
            isActive: true,
          },
        });
        totalCreated++;

        // Create L2 Subcategories
        for (const sub of catData.subcategories) {
          await Category.findOrCreate({
            where: { slug: sub.slug },
            defaults: {
              name: sub.name,
              slug: sub.slug,
              description: sub.description,
              level: 2,
              parentId: parent.id,
              icon: sub.icon,
              emoji: sub.emoji,
              orderIndex: sub.orderIndex,
              isActive: true,
            },
          });
          totalCreated++;
        }
      }

      console.log(`✅ Successfully seeded ${totalCreated} categories across 5 primary sectors.`);
      return { seeded: true, count: totalCreated };
    } catch (error) {
      console.error("⚠️ Failed to ensure default categories:", error);
      return { seeded: false, count: 0 };
    }
  }

  /**
   * Returns complete nested tree of active L1 sectors with their L2 subcategories
   */
  async getTree() {
    return Category.findAll({
      where: {
        parentId: null,
        level: 1,
        isActive: true,
      },
      order: [
        ["orderIndex", "ASC"],
        [{ model: Category, as: "subcategories" }, "orderIndex", "ASC"],
      ],
      include: [
        {
          model: Category,
          as: "subcategories",
          where: { isActive: true },
          required: false,
        },
      ],
    });
  }

  /**
   * List categories with optional filters
   */
  async findAll(query: ListCategoriesQuery = {}) {
    const where: any = {};

    if (query.level !== undefined) {
      where.level = Number(query.level);
    }

    if (query.parentId !== undefined) {
      where.parentId = query.parentId === null ? null : Number(query.parentId);
    }

    if (query.isActive !== undefined) {
      where.isActive = Boolean(query.isActive);
    }

    if (query.search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${query.search}%` } },
        { description: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    return Category.findAll({
      where,
      order: [
        ["level", "ASC"],
        ["orderIndex", "ASC"],
        ["name", "ASC"],
      ],
      include: [
        {
          model: Category,
          as: "parent",
          attributes: ["id", "name", "slug", "emoji"],
          required: false,
        },
        {
          model: Category,
          as: "subcategories",
          attributes: ["id", "name", "slug", "emoji", "isActive", "orderIndex"],
          required: false,
        },
      ],
    });
  }

  /**
   * Get single category by ID
   */
  async findById(id: number) {
    const category = await Category.findByPk(id, {
      include: [
        {
          model: Category,
          as: "parent",
          required: false,
        },
        {
          model: Category,
          as: "subcategories",
          required: false,
        },
      ],
    });

    if (!category) {
      throw new NotFoundError(`Category with ID ${id} not found`);
    }

    return category;
  }

  /**
   * Get single category by Slug
   */
  async findBySlug(slug: string) {
    const category = await Category.findOne({
      where: { slug },
      include: [
        {
          model: Category,
          as: "parent",
          required: false,
        },
        {
          model: Category,
          as: "subcategories",
          required: false,
        },
      ],
    });

    if (!category) {
      throw new NotFoundError(`Category with slug '${slug}' not found`);
    }

    return category;
  }

  /**
   * Get subcategories for a given parent ID
   */
  async findSubcategories(parentId: number) {
    // Verify parent exists
    const parent = await Category.findByPk(parentId);
    if (!parent) {
      throw new NotFoundError(`Parent category with ID ${parentId} not found`);
    }

    return Category.findAll({
      where: {
        parentId,
        isActive: true,
      },
      order: [["orderIndex", "ASC"], ["name", "ASC"]],
    });
  }

  /**
   * Create a new category
   */
  async create(data: CreateCategoryInput) {
    const slug = data.slug ? slugify(data.slug) : slugify(data.name);

    // Verify slug uniqueness
    const existing = await Category.findOne({ where: { slug } });
    if (existing) {
      throw new BadRequestError(`Category with slug '${slug}' already exists`);
    }

    let level = data.level;
    if (!level) {
      level = data.parentId ? 2 : 1;
    }

    if (data.parentId) {
      const parent = await Category.findByPk(data.parentId);
      if (!parent) {
        throw new BadRequestError(`Parent category with ID ${data.parentId} does not exist`);
      }
    }

    return Category.create({
      name: data.name.trim(),
      slug,
      description: data.description?.trim() || null,
      parentId: data.parentId || null,
      level,
      icon: data.icon || "shopping-bag",
      emoji: data.emoji || (level === 1 ? "🛒" : "📦"),
      imageUrl: data.imageUrl || null,
      orderIndex: data.orderIndex ?? 0,
      isActive: data.isActive ?? true,
    });
  }

  /**
   * Update category
   */
  async update(id: number, data: UpdateCategoryInput) {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new NotFoundError(`Category with ID ${id} not found`);
    }

    let slug = category.slug;
    if (data.slug && data.slug !== category.slug) {
      slug = slugify(data.slug);
      const existing = await Category.findOne({ where: { slug, id: { [Op.ne]: id } } });
      if (existing) {
        throw new BadRequestError(`Category with slug '${slug}' already exists`);
      }
    }

    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === id) {
        throw new BadRequestError("Category cannot be its own parent");
      }
      const parent = await Category.findByPk(data.parentId);
      if (!parent) {
        throw new BadRequestError(`Parent category with ID ${data.parentId} does not exist`);
      }
    }

    await category.update({
      name: data.name !== undefined ? data.name.trim() : category.name,
      slug,
      description: data.description !== undefined ? data.description : category.description,
      parentId: data.parentId !== undefined ? data.parentId : category.parentId,
      level: data.level !== undefined ? data.level : category.level,
      icon: data.icon !== undefined ? data.icon : category.icon,
      emoji: data.emoji !== undefined ? data.emoji : category.emoji,
      imageUrl: data.imageUrl !== undefined ? data.imageUrl : category.imageUrl,
      orderIndex: data.orderIndex !== undefined ? data.orderIndex : category.orderIndex,
      isActive: data.isActive !== undefined ? data.isActive : category.isActive,
    });

    return this.findById(id);
  }

  /**
   * Delete category
   */
  async delete(id: number) {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new NotFoundError(`Category with ID ${id} not found`);
    }

    await category.destroy();
    return { success: true, message: `Category '${category.name}' deleted successfully` };
  }

  /**
   * Reorder L1 Categories (Super Admin Global Sorting)
   */
  async reorderCategories(items: Array<{ id: number; orderIndex: number }>) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError("Items array must be provided with at least one element");
    }

    // Verify all IDs are valid and unique
    const idSet = new Set<number>();
    for (const item of items) {
      if (!item.id || typeof item.orderIndex !== "number") {
        throw new BadRequestError("Each item must have a valid id and numeric orderIndex");
      }
      if (idSet.has(item.id)) {
        throw new BadRequestError(`Duplicate category ID ${item.id} detected in reorder payload`);
      }
      idSet.add(item.id);
    }

    const categories = await Category.findAll({
      where: { id: Array.from(idSet) },
    });

    if (categories.length !== idSet.size) {
      throw new BadRequestError("One or more category IDs in the reorder list do not exist");
    }

    // Transactional atomic sequence update
    await sequelize.transaction(async (t) => {
      for (const item of items) {
        await Category.update(
          { orderIndex: Math.max(0, Math.floor(item.orderIndex)) },
          { where: { id: item.id }, transaction: t }
        );
      }
    });

    return this.getTree();
  }

  /**
   * Reorder Subcategories under a Parent Category (Super Admin Global Sorting)
   */
  async reorderSubcategories(parentId: number, items: Array<{ id: number; orderIndex: number }>) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError("Items array must be provided with at least one element");
    }

    const parent = await Category.findByPk(parentId);
    if (!parent) {
      throw new NotFoundError(`Parent category with ID ${parentId} not found`);
    }

    const idSet = new Set<number>();
    for (const item of items) {
      if (!item.id || typeof item.orderIndex !== "number") {
        throw new BadRequestError("Each item must have a valid id and numeric orderIndex");
      }
      if (idSet.has(item.id)) {
        throw new BadRequestError(`Duplicate subcategory ID ${item.id} detected in reorder payload`);
      }
      idSet.add(item.id);
    }

    const subcategories = await Category.findAll({
      where: {
        id: Array.from(idSet),
        parentId,
      },
    });

    if (subcategories.length !== idSet.size) {
      throw new BadRequestError(
        `All subcategories must belong to parent category ID ${parentId}`
      );
    }

    await sequelize.transaction(async (t) => {
      for (const item of items) {
        await Category.update(
          { orderIndex: Math.max(0, Math.floor(item.orderIndex)) },
          { where: { id: item.id, parentId }, transaction: t }
        );
      }
    });

    return this.findSubcategories(parentId);
  }

  /**
   * Get Shop-Specific Subcategories across ALL of the shop's selected L1 main categories (1..3).
   * - Single batched query for L2 subcategories, shop_subcategories settings, and per-subcategory product counts (zero N+1).
   * - Preserves existing shop visibility and sortOrder.
   * - Unconfigured subcategories (e.g. new shops or newly added global subcategories) default to
   *   isVisible = false so they are selectable in Shop Admin without unexpectedly appearing on storefronts.
   * - Supports `onlyWithProducts` and `onlyVisible` for customer storefront navigation.
   */
  async getShopSubcategories(
    shopId: number,
    options: { parentId?: number; onlyWithProducts?: boolean; onlyVisible?: boolean } | number = {}
  ) {
    const opts = typeof options === "number" ? { parentId: options } : options || {};
    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with ID ${shopId} not found`);
    }

    // 1. Read the shop's selected L1 main categories (with legacy transition fallback)
    const shopL1Categories = await getEffectiveShopL1Categories(shop);
    const parentRankMap = new Map<number, number>();
    const parentPrimaryMap = new Map<number, boolean>();
    shopL1Categories.forEach((c, idx) => {
      parentRankMap.set(c.id, idx);
      parentPrimaryMap.set(c.id, c.isPrimary);
    });

    let targetParentIds = shopL1Categories.map((c) => c.id);

    if (opts.parentId !== undefined && !isNaN(Number(opts.parentId))) {
      const requestedParentId = Number(opts.parentId);
      if (targetParentIds.length === 0 || targetParentIds.includes(requestedParentId)) {
        targetParentIds = [requestedParentId];
      } else {
        // Requested parent category is not assigned to this shop
        return [];
      }
    }

    if (targetParentIds.length === 0) {
      return [];
    }

    // 2. Single parallel batch: L2 subcategories + shop_subcategories + aggregated product counts
    const [allSubcategories, shopConfigs, productCountsRaw, legacyNameCountsRaw] = await Promise.all([
      Category.findAll({
        where: {
          level: 2,
          isActive: true,
          parentId: { [Op.in]: targetParentIds },
        },
        include: [
          {
            model: Category,
            as: "parent",
            attributes: ["id", "name", "slug", "emoji", "icon"],
            required: false,
          },
        ],
        order: [
          ["orderIndex", "ASC"],
          ["name", "ASC"],
          ["id", "ASC"],
        ],
      }),
      ShopSubcategory.findAll({
        where: { shopId },
      }),
      Product.findAll({
        where: {
          shopId,
          categoryId: { [Op.ne]: null },
        },
        attributes: [
          "categoryId",
          [fn("COUNT", col("id")), "totalCount"],
          [
            fn("SUM", literal('CASE WHEN "isAvailable" = true THEN 1 ELSE 0 END')),
            "activeCount",
          ],
        ],
        group: ["categoryId"],
        raw: true,
      }) as unknown as Promise<Array<{ categoryId: number; totalCount: string | number; activeCount: string | number }>>,
      // Catch any legacy products whose categoryId is NULL
      Product.findAll({
        where: {
          shopId,
          categoryId: null,
        },
        attributes: [
          "category",
          [fn("COUNT", col("id")), "totalCount"],
          [
            fn("SUM", literal('CASE WHEN "isAvailable" = true THEN 1 ELSE 0 END')),
            "activeCount",
          ],
        ],
        group: ["category"],
        raw: true,
      }) as unknown as Promise<Array<{ category: string; totalCount: string | number; activeCount: string | number }>>,
    ]);

    const configMap = new Map<number, ShopSubcategory>();
    let maxShopSortOrder = 0;
    shopConfigs.forEach((c) => {
      configMap.set(c.subcategoryId, c);
      if (c.sortOrder > maxShopSortOrder) {
        maxShopSortOrder = c.sortOrder;
      }
    });

    const countByCatId = new Map<number, { total: number; active: number }>();
    for (const row of productCountsRaw) {
      countByCatId.set(Number(row.categoryId), {
        total: Number(row.totalCount || 0),
        active: Number(row.activeCount || 0),
      });
    }

    const legacyCountByName = new Map<string, { total: number; active: number }>();
    for (const row of legacyNameCountsRaw) {
      if (row.category) {
        legacyCountByName.set(row.category.trim().toLowerCase(), {
          total: Number(row.totalCount || 0),
          active: Number(row.activeCount || 0),
        });
      }
    }

    const hasAnyShopConfig = shopConfigs.length > 0;

    // 3. Merge global L2 subcategories with shop-specific visibility, order & product counts
    const merged = allSubcategories.map((subcat) => {
      const cfg = configMap.get(subcat.id);
      const idCounts = countByCatId.get(subcat.id) || { total: 0, active: 0 };
      const nameCounts = legacyCountByName.get(subcat.name.trim().toLowerCase()) || { total: 0, active: 0 };
      const productCount = idCounts.total + nameCounts.total;
      const activeProductCount = idCounts.active + nameCounts.active;

      const parentRank = subcat.parentId !== null ? (parentRankMap.get(subcat.parentId) ?? 99) : 99;
      const defaultSort = hasAnyShopConfig
        ? maxShopSortOrder + 1 + parentRank * 1000 + (subcat.orderIndex || 0)
        : parentRank * 1000 + (subcat.orderIndex || 0);

      // New shops & newly added global subcategories are selectable (isVisible: false) until explicitly enabled.
      // Pre-migration safety: if a legacy shop has ZERO shop_subcategories rows yet AND already has active products
      // in this subcategory, treat it as visible so existing live storefronts never go blank before backfill runs.
      const isVisible = cfg
        ? Boolean(cfg.isVisible)
        : !hasAnyShopConfig && activeProductCount > 0;

      return {
        id: subcat.id,
        name: subcat.name,
        slug: subcat.slug,
        description: subcat.description,
        parentId: subcat.parentId,
        parentName: subcat.parent?.name || "General",
        parentEmoji: subcat.parent?.emoji || "🛒",
        parentIsPrimary: subcat.parentId !== null ? Boolean(parentPrimaryMap.get(subcat.parentId)) : false,
        emoji: subcat.emoji,
        icon: subcat.icon,
        imageUrl: subcat.imageUrl,
        globalOrderIndex: subcat.orderIndex,
        sortOrder: cfg ? cfg.sortOrder : defaultSort,
        isVisible,
        isCustomized: Boolean(cfg),
        productCount,
        activeProductCount,
      };
    });

    // 4. Deterministic sorting: custom sortOrder ASC, parent rank ASC, global order ASC, name ASC, id ASC
    const sorted = merged.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      const rankA = a.parentId !== null ? (parentRankMap.get(a.parentId) ?? 99) : 99;
      const rankB = b.parentId !== null ? (parentRankMap.get(b.parentId) ?? 99) : 99;
      if (rankA !== rankB) return rankA - rankB;
      if (a.globalOrderIndex !== b.globalOrderIndex) return a.globalOrderIndex - b.globalOrderIndex;
      const nameCmp = a.name.localeCompare(b.name);
      if (nameCmp !== 0) return nameCmp;
      return a.id - b.id;
    });

    if (opts.onlyWithProducts) {
      return sorted.filter((s) => s.isVisible && s.activeProductCount > 0);
    }

    if (opts.onlyVisible) {
      return sorted.filter((s) => s.isVisible);
    }

    return sorted;
  }

  /**
   * Helper to check active dependent products before disabling a subcategory for a shop.
   */
  private async assertSafeSubcategoryDeactivation(
    shopId: number,
    subcat: Category
  ): Promise<void> {
    const activeProductCount = await Product.count({
      where: {
        shopId,
        isAvailable: true,
        [Op.or]: [
          { categoryId: subcat.id },
          {
            categoryId: null,
            category: { [Op.iLike]: subcat.name.trim() },
          },
        ],
      },
    });

    if (activeProductCount > 0) {
      throw new ConflictError(
        `Cannot disable subcategory "${subcat.name}" because ${activeProductCount} active product${activeProductCount === 1 ? "" : "s"} belong to it. Please reassign or deactivate those products first.`,
        {
          code: "SUBCATEGORY_HAS_DEPENDENT_PRODUCTS",
          subcategoryId: subcat.id,
          subcategoryName: subcat.name,
          productCount: activeProductCount,
        }
      );
    }
  }

  /**
   * Update Shop Subcategory Visibility (enable/disable for shop)
   */
  async updateShopSubcategoryVisibility(shopId: number, subcategoryId: number, isVisible: boolean) {
    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with ID ${shopId} not found`);
    }

    const subcat = await Category.findOne({ where: { id: subcategoryId, level: 2 } });
    if (!subcat) {
      throw new NotFoundError(`Subcategory with ID ${subcategoryId} not found`);
    }

    if (isVisible && !subcat.isActive) {
      throw new BadRequestError(`Subcategory "${subcat.name}" is globally inactive and cannot be enabled`);
    }

    // Enforce that the subcategory belongs to one of the shop's selected L1 main categories
    const shopCategories = await getEffectiveShopL1Categories(shop);
    const allowedParentIds = new Set(shopCategories.map((c) => c.id));
    if (allowedParentIds.size > 0 && (!subcat.parentId || !allowedParentIds.has(subcat.parentId))) {
      throw new BadRequestError(
        `Subcategory "${subcat.name}" does not belong to any of your shop's selected main categories.`
      );
    }

    // Safety check: block disabling a subcategory that still has active products
    if (!isVisible) {
      await this.assertSafeSubcategoryDeactivation(shopId, subcat);
    }

    const existing = await ShopSubcategory.findOne({
      where: { shopId, subcategoryId },
    });

    if (existing) {
      await existing.update({ isVisible });
      return existing;
    }

    // Place newly enabled subcategory at the end of existing custom order without overwriting previous order
    const maxSortRow = await ShopSubcategory.findOne({
      where: { shopId },
      order: [["sortOrder", "DESC"]],
      attributes: ["sortOrder"],
    });
    const nextSortOrder = maxSortRow ? maxSortRow.sortOrder + 1 : subcat.orderIndex;

    return ShopSubcategory.create({
      shopId,
      subcategoryId,
      sortOrder: nextSortOrder,
      isVisible,
    });
  }

  /**
   * Reorder Shop Subcategories (Shop-Specific Custom Display Order)
   */
  async reorderShopSubcategories(
    shopId: number,
    items: Array<{ subcategoryId: number; sortOrder: number; isVisible?: boolean }>
  ) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError("Items array must be provided with at least one element");
    }

    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with ID ${shopId} not found`);
    }

    const idSet = new Set<number>();
    for (const item of items) {
      if (!item.subcategoryId || typeof item.sortOrder !== "number") {
        throw new BadRequestError("Each item must have a valid subcategoryId and numeric sortOrder");
      }
      if (idSet.has(item.subcategoryId)) {
        throw new BadRequestError(
          `Duplicate subcategoryId ${item.subcategoryId} in shop reorder payload`
        );
      }
      idSet.add(item.subcategoryId);
    }

    const validSubcats = await Category.findAll({
      where: {
        id: Array.from(idSet),
        level: 2,
      },
      attributes: ["id", "name", "parentId", "isActive"],
    });

    if (validSubcats.length !== idSet.size) {
      throw new BadRequestError("One or more subcategory IDs are invalid or not L2 subcategories");
    }

    const shopCategories = await getEffectiveShopL1Categories(shop);
    const allowedParentIds = new Set(shopCategories.map((c) => c.id));
    const subcatMap = new Map<number, Category>();

    for (const sc of validSubcats) {
      subcatMap.set(sc.id, sc);
      if (allowedParentIds.size > 0 && (!sc.parentId || !allowedParentIds.has(sc.parentId))) {
        throw new BadRequestError(
          `Subcategory "${sc.name}" does not belong to any of this shop's selected main categories.`
        );
      }
    }

    // Check safe deactivation for any item explicitly disabling visibility
    for (const item of items) {
      if (item.isVisible === false) {
        const sc = subcatMap.get(item.subcategoryId);
        if (sc) {
          await this.assertSafeSubcategoryDeactivation(shopId, sc);
        }
      }
    }

    await sequelize.transaction(async (t) => {
      for (const item of items) {
        const existing = await ShopSubcategory.findOne({
          where: { shopId, subcategoryId: item.subcategoryId },
          transaction: t,
        });

        const sortOrder = Math.max(0, Math.floor(item.sortOrder));
        const isVisible =
          item.isVisible !== undefined
            ? item.isVisible
            : existing
              ? existing.isVisible
              : false;

        if (existing) {
          await existing.update({ sortOrder, isVisible }, { transaction: t });
        } else {
          await ShopSubcategory.create(
            {
              shopId,
              subcategoryId: item.subcategoryId,
              sortOrder,
              isVisible,
            },
            { transaction: t }
          );
        }
      }
    });

    return this.getShopSubcategories(shopId);
  }

  /**
   * Reset Shop-Specific Subcategories Order to Global Default
   * Preserves enabled/disabled visibility so active products are never orphaned or hidden!
   */
  async resetShopSubcategories(shopId: number) {
    const existingRows = await ShopSubcategory.findAll({
      where: { shopId },
      include: [
        {
          model: Category,
          as: "subcategory",
          attributes: ["id", "orderIndex"],
          required: false,
        },
      ],
    });

    await sequelize.transaction(async (t) => {
      for (const row of existingRows) {
        await row.update(
          { sortOrder: row.subcategory?.orderIndex ?? 0 },
          { transaction: t }
        );
      }
    });

    return this.getShopSubcategories(shopId);
  }
}

export const categoryService = new CategoryService();
