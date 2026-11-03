import { Op, literal } from "sequelize";
import { sequelize } from "../../config/database";
import { Product } from "./product.model";
import { Shop } from "../shops/shop.model";
import { Category } from "../categories/category.model";
import { NotFoundError, BadRequestError } from "../../core/errors/AppError";
import { storageService } from "../../core/storage/storage.service";
import { uploadService } from "../upload/upload.service";
import { ImageDeletionJob } from "../upload/imageDeletionJob.model";

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
      order: [
        ["sortOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
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
    const include = [
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
    ];

    let product = await Product.findByPk(id, { include });
    if (!product) {
      // Wishlist & history protection: check soft-deleted products
      product = await Product.findByPk(id, { include, paranoid: false });
    }

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
      order: [
        ["sortOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    });
  }

  async create(data: CreateProductInput): Promise<Product> {
    if (data.images && data.images.length > 3) {
      throw new BadRequestError("A product can have a maximum of 3 images");
    }

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

    // Default position at end of subcategory product sequence
    const maxSortProduct = await Product.findOne({
      where: {
        shopId: data.shopId,
        ...(categoryId ? { categoryId } : {}),
      },
      order: [["sortOrder", "DESC"]],
      attributes: ["sortOrder"],
    });
    const defaultSortOrder = maxSortProduct ? (maxSortProduct.sortOrder || 0) + 1 : 1;

    const product = await Product.create({
      ...data,
      category: categoryName || "General",
      categoryId,
      sortOrder: defaultSortOrder,
      stockQuantity: data.stockQuantity ?? 0,
      images: data.images ?? [],
      isAvailable: data.isAvailable ?? true,
    });

    // Check if any image is in a temporary folder and promote to permanent product folder
    if (data.images && data.images.length > 0) {
      const finalImages: string[] = [];
      let imagesMoved = false;

      for (let i = 0; i < data.images.length; i++) {
        const imgKey = data.images[i];
        if (imgKey && (imgKey.includes("temp/uploads/") || imgKey.includes("/products/temp/"))) {
          try {
            const imageId = `${Date.now()}_${i + 1}`;
            const permanentKey = `products/${data.shopId}/${product.id}/${imageId}.webp`;
            await uploadService.promoteUpload({
              tempKeyOrId: imgKey,
              targetPermanentKey: permanentKey,
              entityType: "product",
              entityId: product.id,
              shopId: data.shopId,
              imageRole: "product_gallery",
            });
            finalImages.push(permanentKey);
            imagesMoved = true;
          } catch (moveErr) {
            console.error(`Failed to promote temp image [${imgKey}] to permanent location:`, moveErr);
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

    if (data.images && data.images.length > 3) {
      throw new BadRequestError("A product can have a maximum of 3 images");
    }

    const previousImages = Array.isArray(product.images) ? [...product.images] : [];
    const updateData = { ...data };

    // Prevent regular product updates from resetting or corrupting sortOrder
    delete (updateData as any).sortOrder;

    if (updateData.categoryId && !updateData.category) {
      const cat = await Category.findByPk(updateData.categoryId);
      if (cat) updateData.category = cat.name;
    } else if (updateData.category && !updateData.categoryId) {
      const cat = await Category.findOne({
        where: { name: { [Op.iLike]: updateData.category.trim() } },
      });
      if (cat) updateData.categoryId = cat.id;
    }

    // If subcategory actually changed, place product at the end of the new subcategory sequence
    if (updateData.categoryId && updateData.categoryId !== product.categoryId) {
      const maxSortProduct = await Product.findOne({
        where: { shopId: product.shopId, categoryId: updateData.categoryId },
        order: [["sortOrder", "DESC"]],
        attributes: ["sortOrder"],
      });
      (updateData as any).sortOrder = maxSortProduct ? (maxSortProduct.sortOrder || 0) + 1 : 1;
    }

    if (updateData.images && updateData.images.length > 0) {
      const finalImages: string[] = [];
      let imagesMoved = false;

      for (let i = 0; i < updateData.images.length; i++) {
        const imgKey = updateData.images[i];
        if (imgKey && (imgKey.includes("temp/uploads/") || imgKey.includes("/products/temp/"))) {
          try {
            const imageId = `${Date.now()}_${i + 1}`;
            const permanentKey = `products/${product.shopId}/${product.id}/${imageId}.webp`;
            await uploadService.promoteUpload({
              tempKeyOrId: imgKey,
              targetPermanentKey: permanentKey,
              entityType: "product",
              entityId: product.id,
              shopId: product.shopId,
              imageRole: "product_gallery",
            });
            finalImages.push(permanentKey);
            imagesMoved = true;
          } catch (moveErr) {
            console.error(`Failed to promote temp image [${imgKey}] to permanent location:`, moveErr);
            finalImages.push(imgKey);
          }
        } else {
          finalImages.push(imgKey);
        }
      }

      updateData.images = finalImages;
    }

    await product.update(updateData);

    // After successful update: identify any removed images and queue safe background deletion
    if (updateData.images) {
      const updatedKeys = new Set(updateData.images.map((k) => storageService.extractKeyFromUrl(k)));
      for (const oldKey of previousImages) {
        const cleanOld = storageService.extractKeyFromUrl(oldKey);
        if (cleanOld && !updatedKeys.has(cleanOld) && cleanOld.startsWith("products/")) {
          ImageDeletionJob.create({
            objectKey: cleanOld,
            entityType: "product",
            entityId: product.id,
            status: "pending",
          })
            .then((job) => {
              void uploadService.executeDeletionJob(job.id);
            })
            .catch((err) => {
              console.error("Failed to queue deletion job for removed product image:", err);
            });
        }
      }
    }

    return product;
  }

  async delete(id: number): Promise<void> {
    const product = await Product.findByPk(id);
    if (!product) {
      throw new NotFoundError(`Product with id ${id} not found`);
    }

    // Soft-delete using Sequelize paranoid pattern (sets deletedAt timestamp).
    // IMPORTANT: Product images are intentionally NOT deleted from S3 so that
    // existing customer wishlists and saved product histories continue to display seamlessly!
    await product.destroy();
  }

  /**
   * Reorder products within a specific shop and subcategory
   * Validates product ownership and subcategory association atomically in transaction.
   */
  async reorderProducts(
    shopId: number,
    categoryId: number,
    items: Array<{ id: number; sortOrder: number }>
  ): Promise<Product[]> {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError("Items array must be provided with at least one element");
    }

    const targetCategory = await Category.findByPk(categoryId);
    if (!targetCategory) {
      throw new NotFoundError(`Subcategory with ID ${categoryId} not found`);
    }
    if (targetCategory.level === 1) {
      throw new BadRequestError("Products must be arranged under a specific L2 child subcategory, not an entire L1 department");
    }

    const idSet = new Set<number>();
    for (const item of items) {
      if (!item.id || typeof item.sortOrder !== "number") {
        throw new BadRequestError("Each item must have a valid id and numeric sortOrder");
      }
      if (idSet.has(item.id)) {
        throw new BadRequestError(`Duplicate product ID ${item.id} detected in reorder payload`);
      }
      idSet.add(item.id);
    }

    const products = await Product.findAll({
      where: {
        id: Array.from(idSet),
        shopId,
        [Op.or]: [
          { categoryId },
          { category: { [Op.iLike]: targetCategory.name.trim() } },
        ],
      },
      attributes: ["id", "shopId", "categoryId", "category", "sortOrder"],
    });

    if (products.length !== idSet.size) {
      throw new BadRequestError(
        `All products must belong to shop ID ${shopId} and subcategory "${targetCategory.name}" (ID ${categoryId})`
      );
    }

    await sequelize.transaction(async (t) => {
      for (const item of items) {
        await Product.update(
          {
            sortOrder: Math.max(0, Math.floor(item.sortOrder)),
            categoryId, // Ensure categoryId is explicitly linked
          },
          { where: { id: item.id, shopId }, transaction: t }
        );
      }
    });

    return Product.findAll({
      where: {
        shopId,
        [Op.or]: [
          { categoryId },
          { category: { [Op.iLike]: targetCategory.name.trim() } },
        ],
      },
      include: [
        {
          model: Category,
          as: "categoryRef",
          attributes: ["id", "name", "slug", "icon", "emoji", "level", "parentId"],
          required: false,
        },
      ],
      order: [
        ["sortOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    });
  }
}

export const productService = new ProductService();

