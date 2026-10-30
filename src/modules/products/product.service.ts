import { Op, literal } from "sequelize";
import { Product } from "./product.model";
import { Shop } from "../shops/shop.model";
import { Category } from "../categories/category.model";
import { NotFoundError } from "../../core/errors/AppError";
import { storageService } from "../../core/storage/storage.service";

export interface ListProductsQuery {
  shopId?: number;
  category?: string;
  categoryId?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  isAvailable?: boolean;
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export interface CreateProductInput {
  shopId: number;
  name: string;
  slug: string;
  description?: string | null;
  category: string;
  categoryId?: number | null;
  price: number;
  discountPrice?: number | null;
  stockQuantity?: number;
  sku?: string | null;
  images?: string[];
  isAvailable?: boolean;
}

export class ProductService {
  async findAll(query: ListProductsQuery = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit || 20)));
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.shopId) {
      where.shopId = Number(query.shopId);
    }

    if (query.categoryId) {
      const catId = Number(query.categoryId);
      const targetCat = await Category.findByPk(catId);
      if (targetCat && targetCat.level === 1) {
        // If it's an L1 department, include all child categories
        const children = await Category.findAll({
          where: { parentId: catId },
          attributes: ["id"],
        });
        const allIds = [catId, ...children.map((c) => c.id)];
        where.categoryId = { [Op.in]: allIds };
      } else {
        where.categoryId = catId;
      }
    } else if (query.category) {
      where.category = query.category;
    }

    if (query.isAvailable !== undefined) {
      where.isAvailable = query.isAvailable;
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceFilter: Record<string, unknown> = {};
      if (query.minPrice !== undefined) priceFilter[Op.gte as unknown as string] = Number(query.minPrice);
      if (query.maxPrice !== undefined) priceFilter[Op.lte as unknown as string] = Number(query.maxPrice);
      where.price = priceFilter;
    }

    if (query.search) {
      where[Op.or as unknown as string] = [
        { name: { [Op.iLike]: `%${query.search}%` } },
        { description: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    const shopInclude: any = {
      model: Shop,
      as: "shop",
      attributes: [
        "id",
        "name",
        "slug",
        "category",
        "address",
        "city",
        "latitude",
        "longitude",
        "rating",
        "reviewCount",
        "isVerified",
        "isOpen",
        "bannerUrl",
        "logoUrl",
      ],
    };

    const hasLocation =
      query.lat !== undefined &&
      query.lng !== undefined &&
      !isNaN(Number(query.lat)) &&
      !isNaN(Number(query.lng));

    if (hasLocation) {
      const lat = Number(query.lat);
      const lng = Number(query.lng);
      const distanceLiteral = literal(`
        (6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(${lat})) * cos(radians("shop"."latitude")) *
            cos(radians("shop"."longitude") - radians(${lng})) +
            sin(radians(${lat})) * sin(radians("shop"."latitude"))
          ))
        ))
      `);
      shopInclude.attributes.push([distanceLiteral, "distanceKm"]);

      if (query.radiusKm && !isNaN(Number(query.radiusKm))) {
        const radius = Number(query.radiusKm);
        shopInclude.where = literal(`
          (6371 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(${lat})) * cos(radians("shop"."latitude")) *
              cos(radians("shop"."longitude") - radians(${lng})) +
              sin(radians(${lat})) * sin(radians("shop"."latitude"))
            ))
          )) <= ${radius}
        `);
      }
    }

    const categoryInclude = {
      model: Category,
      as: "categoryRef",
      attributes: ["id", "name", "slug", "icon", "emoji", "level", "parentId"],
      required: false,
    };

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [shopInclude, categoryInclude],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      products: rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async findById(id: number): Promise<Product> {
    const product = await Product.findByPk(id, {
      include: [
        {
          model: Shop,
          as: "shop",
          attributes: [
            "id",
            "ownerId",
            "name",
            "slug",
            "category",
            "address",
            "city",
            "state",
            "postalCode",
            "latitude",
            "longitude",
            "phone",
            "email",
            "rating",
            "reviewCount",
            "isVerified",
            "isOpen",
            "openingHours",
            "bannerUrl",
            "logoUrl",
          ],
        },
        {
          model: Category,
          as: "categoryRef",
          attributes: ["id", "name", "slug", "icon", "emoji", "level", "parentId"],
          required: false,
        },
      ],
    });
    if (!product) {
      throw new NotFoundError(`Product with id ${id} not found`);
    }
    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await Product.findOne({
      where: { slug },
      include: [
        {
          model: Shop,
          as: "shop",
          attributes: [
            "id",
            "ownerId",
            "name",
            "slug",
            "category",
            "address",
            "city",
            "state",
            "postalCode",
            "latitude",
            "longitude",
            "phone",
            "email",
            "rating",
            "reviewCount",
            "isVerified",
            "isOpen",
            "openingHours",
            "bannerUrl",
            "logoUrl",
          ],
        },
        {
          model: Category,
          as: "categoryRef",
          attributes: ["id", "name", "slug", "icon", "emoji", "level", "parentId"],
          required: false,
        },
      ],
    });
    if (!product) {
      throw new NotFoundError(`Product with slug '${slug}' not found`);
    }
    return product;
  }

  async findByShopId(shopId: number, isAvailableOnly: boolean = false): Promise<Product[]> {
    const where: Record<string, unknown> = { shopId };
    if (isAvailableOnly) {
      where.isAvailable = true;
    }
    return Product.findAll({
      where,
      include: [
        {
          model: Category,
          as: "categoryRef",
          attributes: ["id", "name", "slug", "icon", "emoji", "level", "parentId"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  async create(data: CreateProductInput): Promise<Product> {
    let categoryName = data.category;
    let categoryId = data.categoryId ?? null;

    if (categoryId && !categoryName) {
      const cat = await Category.findByPk(categoryId);
      if (cat) categoryName = cat.name;
    } else if (categoryName && !categoryId) {
      const cat = await Category.findOne({
        where: { name: { [Op.iLike]: categoryName.trim() } },
      });
      if (cat) categoryId = cat.id;
    }

    const product = await Product.create({
      ...data,
      category: categoryName || "General",
      categoryId,
      stockQuantity: data.stockQuantity ?? 0,
      images: data.images ?? [],
      isAvailable: data.isAvailable ?? true,
    });

    // Check if any image is in a temporary folder and promote to permanent product folder
    if (data.images && data.images.length > 0) {
      const finalImages: string[] = [];
      let imagesMoved = false;

      for (const imgKey of data.images) {
        if (imgKey && imgKey.includes("/products/temp/")) {
          try {
            const filename = imgKey.split("/").pop() || "product.webp";
            const permanentKey = `shops/${data.shopId}/products/${product.id}/${filename}`;
            await storageService.moveObject(imgKey, permanentKey);
            finalImages.push(permanentKey);
            imagesMoved = true;
          } catch (moveErr) {
            console.error(`Failed to move temp image [${imgKey}] to permanent location:`, moveErr);
            finalImages.push(imgKey);
          }
        } else {
          finalImages.push(imgKey);
        }
      }

      if (imagesMoved) {
        await product.update({ images: finalImages });
      }
    }

    return product;
  }

  async update(id: number, data: Partial<CreateProductInput>): Promise<Product> {
    const product = await Product.findByPk(id);
    if (!product) {
      throw new NotFoundError(`Product with id ${id} not found`);
    }

    const updateData = { ...data };

    if (updateData.categoryId && !updateData.category) {
      const cat = await Category.findByPk(updateData.categoryId);
      if (cat) updateData.category = cat.name;
    } else if (updateData.category && !updateData.categoryId) {
      const cat = await Category.findOne({
        where: { name: { [Op.iLike]: updateData.category.trim() } },
      });
      if (cat) updateData.categoryId = cat.id;
    }

    if (updateData.images && updateData.images.length > 0) {
      const finalImages: string[] = [];
      let imagesMoved = false;

      for (const imgKey of updateData.images) {
        if (imgKey && imgKey.includes("/products/temp/")) {
          try {
            const filename = imgKey.split("/").pop() || "product.webp";
            const permanentKey = `shops/${product.shopId}/products/${product.id}/${filename}`;
            await storageService.moveObject(imgKey, permanentKey);
            finalImages.push(permanentKey);
            imagesMoved = true;
          } catch (moveErr) {
            console.error(`Failed to move temp image [${imgKey}] to permanent location:`, moveErr);
            finalImages.push(imgKey);
          }
        } else {
          finalImages.push(imgKey);
        }
      }

      if (imagesMoved) {
        updateData.images = finalImages;
      }
    }

    await product.update(updateData);
    return product;
  }

  async delete(id: number): Promise<void> {
    const product = await Product.findByPk(id);
    if (!product) {
      throw new NotFoundError(`Product with id ${id} not found`);
    }

    await product.destroy();
  }
}

export const productService = new ProductService();

