import { Op } from "sequelize";
import { Product } from "./product.model";
import { Shop } from "../shops/shop.model";
import { NotFoundError } from "../../core/errors/AppError";
import { storageService } from "../../core/storage/storage.service";

export interface ListProductsQuery {
  shopId?: number;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  isAvailable?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateProductInput {
  shopId: number;
  name: string;
  slug: string;
  description?: string | null;
  category: string;
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

    if (query.category) {
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

    const { count, rows } = await Product.findAndCountAll({
      where,
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
      order: [["createdAt", "DESC"]],
    });
  }

  async create(data: CreateProductInput): Promise<Product> {
    const product = await Product.create({
      ...data,
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

