import { Op } from "sequelize";
import { Category } from "./category.model";
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
}

export const categoryService = new CategoryService();
