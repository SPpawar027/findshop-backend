import { Op } from "sequelize";
import { sequelize } from "../../config/database";
import { Category } from "./category.model";
import { ShopSubcategory } from "./shopSubcategory.model";
import { Shop } from "../shops/shop.model";
import { DEFAULT_PRIMARY_CATEGORIES } from "./category.defaults";
import { NotFoundError, BadRequestError } from "../../core/errors/AppError";

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
   * Get Shop-Specific Subcategories
   * Merges global active subcategories with shop-specific ordering & visibility.
   */
  async getShopSubcategories(shopId: number, parentId?: number) {
    const shop = await Shop.findByPk(shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with ID ${shopId} not found`);
    }

    const categoryWhere: any = {
      level: 2,
      isActive: true,
    };
    if (parentId) {
      categoryWhere.parentId = parentId;
    }

    const [allSubcategories, shopConfigs] = await Promise.all([
      Category.findAll({
        where: categoryWhere,
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
        ],
      }),
      ShopSubcategory.findAll({
        where: { shopId },
      }),
    ]);

    const configMap = new Map<number, ShopSubcategory>();
    let maxShopSortOrder = 0;
    shopConfigs.forEach((c) => {
      configMap.set(c.subcategoryId, c);
      if (c.sortOrder > maxShopSortOrder) {
        maxShopSortOrder = c.sortOrder;
      }
    });

    // Merge global subcategories with shop custom order & visibility
    const merged = allSubcategories.map((subcat) => {
      const cfg = configMap.get(subcat.id);
      // If shop has custom configs, place unconfigured new subcategories after them
      const defaultSort =
        shopConfigs.length > 0
          ? maxShopSortOrder + 1 + (subcat.orderIndex || 0)
          : (subcat.orderIndex || 0);

      return {
        id: subcat.id,
        name: subcat.name,
        slug: subcat.slug,
        description: subcat.description,
        parentId: subcat.parentId,
        parentName: subcat.parent?.name || "General",
        parentEmoji: subcat.parent?.emoji || "🛒",
        emoji: subcat.emoji,
        icon: subcat.icon,
        imageUrl: subcat.imageUrl,
        globalOrderIndex: subcat.orderIndex,
        sortOrder: cfg ? cfg.sortOrder : defaultSort,
        isVisible: cfg ? cfg.isVisible : true,
        isCustomized: Boolean(cfg),
      };
    });

    // Sort by shop's custom sortOrder ASC, then fallback to name ASC
    return merged.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Update Shop Subcategory Visibility (enable/disable for shop)
   */
  async updateShopSubcategoryVisibility(shopId: number, subcategoryId: number, isVisible: boolean) {
    const subcat = await Category.findOne({ where: { id: subcategoryId, level: 2 } });
    if (!subcat) {
      throw new NotFoundError(`Subcategory with ID ${subcategoryId} not found`);
    }

    const existing = await ShopSubcategory.findOne({
      where: { shopId, subcategoryId },
    });

    if (existing) {
      await existing.update({ isVisible });
      return existing;
    }

    return ShopSubcategory.create({
      shopId,
      subcategoryId,
      sortOrder: subcat.orderIndex,
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
      attributes: ["id"],
    });

    if (validSubcats.length !== idSet.size) {
      throw new BadRequestError("One or more subcategory IDs are invalid or not L2 subcategories");
    }

    await sequelize.transaction(async (t) => {
      for (const item of items) {
        const existing = await ShopSubcategory.findOne({
          where: { shopId, subcategoryId: item.subcategoryId },
          transaction: t,
        });

        const sortOrder = Math.max(0, Math.floor(item.sortOrder));
        const isVisible = item.isVisible !== undefined ? item.isVisible : existing ? existing.isVisible : true;

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
   */
  async resetShopSubcategories(shopId: number) {
    await ShopSubcategory.destroy({
      where: { shopId },
    });
    return this.getShopSubcategories(shopId);
  }
}

export const categoryService = new CategoryService();
