import { Op, literal } from "sequelize";
import { sequelize } from "../../config/database";
import { Product } from "./product.model";
import { Shop } from "../shops/shop.model";
import { ShopCategory } from "../shops/shopCategory.model";
import { Category } from "../categories/category.model";
import { ShopSubcategory } from "../categories/shopSubcategory.model";
import { NotFoundError, BadRequestError } from "../../core/errors/AppError";
import { storageService } from "../../core/storage/storage.service";
import { uploadService } from "../upload/upload.service";
import { ImageDeletionJob } from "../upload/imageDeletionJob.model";
import { getEffectiveShopL1Categories, slugifyCategoryName } from "../shops/shopCategory.helper";
import {
  EFFECTIVE_SELLING_PRICE_SQL,
  normalizeAndValidateProductPricing,
} from "./pricing.helper";

export interface ListProductsQuery {
  shopId?: number;
  category?: string;
  categoryId?: number;
  subcategoryId?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  isAvailable?: boolean;
  allowSuspended?: boolean;
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sortBy?: string;
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
  /**
   * Authoritative server-side subcategory validation for Product create & update:
   * - One product belongs to exactly one active L2 subcategory (`categoryId`).
   * - Its parent L1 category must be one of the shop's selected main categories.
   * - The subcategory must be enabled (`isVisible = true`) for this shop when creating
   *   or moving a product to a new subcategory.
   * - Derives the `category` string strictly from the database Category row (never trusts client string).
   */
  private async validateProductSubcategoryForShop(
    shop: Shop,
    rawCategoryId: number | null | undefined,
    rawLegacyCategoryName: string | undefined,
    requireEnabledForShop: boolean
  ): Promise<{ categoryId: number; categoryName: string }> {
    const shopL1Categories = await getEffectiveShopL1Categories(shop);
    const allowedParentIds = shopL1Categories.map((c) => c.id);

    let resolvedCategory: Category | null = null;

    if (rawCategoryId !== undefined && rawCategoryId !== null && !isNaN(Number(rawCategoryId))) {
      const catId = Number(rawCategoryId);
      resolvedCategory = await Category.findByPk(catId);
      if (!resolvedCategory) {
        throw new BadRequestError(`Subcategory with ID ${catId} does not exist`);
      }
    } else if (rawLegacyCategoryName && rawLegacyCategoryName.trim()) {
      // Transition fallback if a legacy caller omits categoryId: resolve strictly within shop's L1 categories
      const cleanName = rawLegacyCategoryName.trim();
      const whereSub: any = {
        level: 2,
        isActive: true,
        name: { [Op.iLike]: cleanName },
      };
      if (allowedParentIds.length > 0) {
        whereSub.parentId = { [Op.in]: allowedParentIds };
      }
      const matches = await Category.findAll({ where: whereSub });
      if (matches.length === 1) {
        resolvedCategory = matches[0];
      } else if (matches.length > 1) {
        throw new BadRequestError(
          `Subcategory name "${cleanName}" is ambiguous across multiple categories. Please pass an explicit categoryId.`
        );
      } else {
        throw new BadRequestError(
          `Subcategory "${cleanName}" does not match any active subcategory under your shop's selected categories.`
        );
      }
    } else {
      throw new BadRequestError("A valid subcategory (categoryId) is required for every product");
    }

    if (!resolvedCategory.isActive) {
      throw new BadRequestError(
        `Subcategory "${resolvedCategory.name}" is inactive and cannot be assigned to products`
      );
    }

    if (resolvedCategory.level !== 2 || !resolvedCategory.parentId) {
      throw new BadRequestError(
        `Category "${resolvedCategory.name}" is a main category. Products must belong to a specific L2 subcategory.`
      );
    }

    if (allowedParentIds.length > 0 && !allowedParentIds.includes(resolvedCategory.parentId)) {
      const allowedNames = shopL1Categories.map((c) => c.name).join(", ");
      throw new BadRequestError(
        `Subcategory "${resolvedCategory.name}" does not belong to your store's selected main categories (${allowedNames}).`
      );
    }

    if (requireEnabledForShop) {
      const [shopSubCfg, anyShopSubConfigCount, hasNormalizedShopCategories] = await Promise.all([
        ShopSubcategory.findOne({
          where: { shopId: shop.id, subcategoryId: resolvedCategory.id },
        }),
        ShopSubcategory.count({ where: { shopId: shop.id } }),
        ShopCategory.count({ where: { shopId: shop.id } }).catch(() => 0),
      ]);

      const isExplicitlyDisabled = shopSubCfg ? !shopSubCfg.isVisible : false;
      const isUnconfiguredWhenRequired =
        !shopSubCfg && (anyShopSubConfigCount > 0 || hasNormalizedShopCategories > 0);

      if (isExplicitlyDisabled || isUnconfiguredWhenRequired) {
        throw new BadRequestError(
          `Subcategory "${resolvedCategory.name}" is currently disabled for your shop. Enable it in Categories before adding products to it.`
        );
      }
    }

    return {
      categoryId: resolvedCategory.id,
      categoryName: resolvedCategory.name,
    };
  }

  async findAll(query: ListProductsQuery = {}) {
    const page = Math.max(1, Math.floor(Number(query.page || 1)));
    const defaultLimit = query.shopId ? 12 : 20;
    const limit = Math.min(50, Math.max(1, Math.floor(Number(query.limit || defaultLimit))));
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    const andConditions: any[] = [];

    if (query.shopId) {
      where.shopId = Number(query.shopId);
    }

    const effectiveCatId = query.subcategoryId ?? query.categoryId;

    if (effectiveCatId !== undefined && !isNaN(Number(effectiveCatId)) && Number(effectiveCatId) > 0) {
      const catId = Number(effectiveCatId);
      const targetCat = await Category.findByPk(catId);
      if (targetCat && targetCat.level === 1) {
        // If it's an L1 department, include all active child subcategories
        const children = await Category.findAll({
          where: { parentId: catId },
          attributes: ["id", "name"],
        });
        const allIds = [catId, ...children.map((c) => c.id)];
        const childNames = children.map((c) => c.name);
        andConditions.push({
          [Op.or]: [
            { categoryId: { [Op.in]: allIds } },
            ...(childNames.length > 0 ? [{ categoryId: null, category: { [Op.in]: childNames } }] : []),
          ],
        });
      } else if (targetCat) {
        andConditions.push({
          [Op.or]: [
            { categoryId: catId },
            { categoryId: null, category: { [Op.iLike]: targetCat.name.trim() } },
          ],
        });
      } else {
        where.categoryId = catId;
      }
    } else if (query.category && query.category.trim() && query.category.trim().toLowerCase() !== "all") {
      const cleanCat = query.category.trim();
      const slugCat = slugifyCategoryName(cleanCat);
      const matchedCat = await Category.findOne({
        where: {
          [Op.or]: [
            { name: { [Op.iLike]: cleanCat } },
            { slug: { [Op.iLike]: slugCat } },
          ],
        },
        attributes: ["id", "name", "level"],
      });

      if (matchedCat && matchedCat.level === 1) {
        // Expanding L1 main category name to all its L2 subcategories so customer search
        // finds products across all selected categories!
        const children = await Category.findAll({
          where: { parentId: matchedCat.id },
          attributes: ["id", "name"],
        });
        const allIds = [matchedCat.id, ...children.map((c) => c.id)];
        const childNames = [matchedCat.name, ...children.map((c) => c.name)];
        andConditions.push({
          [Op.or]: [
            { categoryId: { [Op.in]: allIds } },
            { category: { [Op.in]: childNames } },
          ],
        });
      } else if (matchedCat && matchedCat.level === 2) {
        andConditions.push({
          [Op.or]: [
            { categoryId: matchedCat.id },
            { category: { [Op.iLike]: matchedCat.name } },
          ],
        });
      } else {
        where.category = { [Op.iLike]: cleanCat };
      }
    }

    if (query.isAvailable !== undefined) {
      where.isAvailable = query.isAvailable;
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      if (query.minPrice !== undefined && query.minPrice !== ("" as unknown as number)) {
        const minVal = Number(query.minPrice);
        if (Number.isFinite(minVal) && minVal >= 0) {
          andConditions.push(literal(`(${EFFECTIVE_SELLING_PRICE_SQL}) >= ${minVal}`));
        }
      }
      if (query.maxPrice !== undefined && query.maxPrice !== ("" as unknown as number)) {
        const maxVal = Number(query.maxPrice);
        if (Number.isFinite(maxVal) && maxVal >= 0) {
          andConditions.push(literal(`(${EFFECTIVE_SELLING_PRICE_SQL}) <= ${maxVal}`));
        }
      }
    }

    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      andConditions.push({
        [Op.or]: [
          { name: { [Op.iLike]: s } },
          { description: { [Op.iLike]: s } },
          { category: { [Op.iLike]: s } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where[Op.and as unknown as string] = andConditions;
    }

    const shopWhere: Record<string, unknown> = {};
    if (!query.shopId || !query.allowSuspended) {
      // Public consumer queries: Exclude products from suspended or unverified stores
      if (!query.shopId) {
        shopWhere.isOpen = true;
        shopWhere.isVerified = true;
      }
    }

    const shopInclude: any = {
      model: Shop,
      as: "shop",
      required: !query.shopId,
      where: Object.keys(shopWhere).length > 0 ? shopWhere : undefined,
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

    let distanceLiteral: any = null;

    if (hasLocation) {
      const lat = Number(query.lat);
      const lng = Number(query.lng);
      distanceLiteral = literal(`
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
        const radiusCondition = literal(`
          (6371 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(${lat})) * cos(radians("shop"."latitude")) *
              cos(radians("shop"."longitude") - radians(${lng})) +
              sin(radians(${lat})) * sin(radians("shop"."latitude"))
            ))
          )) <= ${radius}
        `);
        if (shopInclude.where) {
          shopInclude.where = {
            [Op.and]: [shopInclude.where, radiusCondition],
          };
        } else {
          shopInclude.where = radiusCondition;
        }
      }
    }

    const categoryInclude = {
      model: Category,
      as: "categoryRef",
      attributes: ["id", "name", "slug", "icon", "emoji", "level", "parentId"],
      required: false,
    };

    // Deterministic ordering with id ASC tie-breaker so pagination never duplicates or skips items
    let order: any = [
      ["sortOrder", "ASC"],
      ["createdAt", "DESC"],
      ["id", "ASC"],
    ];

    const sortOption = (query.sortBy || "").toLowerCase().trim();
    if (sortOption === "price_asc" || sortOption === "price-asc") {
      order = [[literal(`(${EFFECTIVE_SELLING_PRICE_SQL})`), "ASC"], ["createdAt", "DESC"], ["id", "ASC"]];
    } else if (sortOption === "price_desc" || sortOption === "price-desc") {
      order = [[literal(`(${EFFECTIVE_SELLING_PRICE_SQL})`), "DESC"], ["createdAt", "DESC"], ["id", "ASC"]];
    } else if (sortOption === "newest") {
      order = [["createdAt", "DESC"], ["id", "ASC"]];
    } else if (hasLocation && !query.shopId) {
      // Proximity-first ranking: when user location is provided for marketplace discovery
      order = [
        [distanceLiteral, "ASC"],
        ["sortOrder", "ASC"],
        ["createdAt", "DESC"],
        ["id", "ASC"],
      ];
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [shopInclude, categoryInclude],
      limit,
      offset,
      order,
    });

    const totalPages = Math.ceil(count / limit);

    return {
      products: rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async findById(id: number, allowSuspended: boolean = false): Promise<Product> {
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

    if (!allowSuspended && product.shop && (!product.shop.isOpen || !product.shop.isVerified)) {
      throw new NotFoundError("This product is currently unavailable because the retailer store is inactive or suspended.");
    }

    return product;
  }

  async findBySlug(slug: string, allowSuspended: boolean = false): Promise<Product> {
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

    if (!allowSuspended && product.shop && (!product.shop.isOpen || !product.shop.isVerified)) {
      throw new NotFoundError("This product is currently unavailable because the retailer store is inactive or suspended.");
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
    const cleanImages = (data.images || []).filter(
      (img) =>
        typeof img === "string" &&
        img.trim() &&
        !img.includes("photo-1542838132-92c53300491e") &&
        !img.includes("default-product")
    );
    data.images = cleanImages;

    if (data.images && data.images.length > 3) {
      throw new BadRequestError("A product can have a maximum of 3 images");
    }

    const validatedPricing = normalizeAndValidateProductPricing({
      price: data.price,
      discountPrice: data.discountPrice,
    });

    const shop = await Shop.findByPk(data.shopId);
    if (!shop) {
      throw new NotFoundError(`Shop with ID ${data.shopId} not found`);
    }

    // Authoritative server-side subcategory validation:
    // - Must be an active L2 subcategory
    // - Parent must be one of the shop's selected L1 main categories
    // - Subcategory must be enabled for this shop
    // - Derives category name strictly from DB (never trusts client string)
    const validatedSub = await this.validateProductSubcategoryForShop(
      shop,
      data.categoryId,
      data.category,
      true
    );
    const categoryId = validatedSub.categoryId;
    const categoryName = validatedSub.categoryName;

    // Default position at end of subcategory product sequence
    const maxSortProduct = await Product.findOne({
      where: {
        shopId: data.shopId,
        categoryId,
      },
      order: [["sortOrder", "DESC"]],
      attributes: ["sortOrder"],
    });
    const defaultSortOrder = maxSortProduct ? (maxSortProduct.sortOrder || 0) + 1 : 1;

    const product = await Product.create({
      ...data,
      price: validatedPricing.price!,
      discountPrice: validatedPricing.discountPrice ?? null,
      category: categoryName,
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

    if (data.images) {
      data.images = data.images.filter(
        (img) =>
          typeof img === "string" &&
          img.trim() &&
          !img.includes("photo-1542838132-92c53300491e") &&
          !img.includes("default-product")
      );
    }

    if (data.images && data.images.length > 3) {
      throw new BadRequestError("A product can have a maximum of 3 images");
    }

    const previousImages = Array.isArray(product.images) ? [...product.images] : [];
    const updateData = { ...data };

    // Prevent regular product updates from resetting or corrupting sortOrder
    delete (updateData as any).sortOrder;

    if (updateData.price !== undefined || updateData.discountPrice !== undefined) {
      const validatedPricing = normalizeAndValidateProductPricing(
        {
          price: updateData.price,
          discountPrice: updateData.discountPrice,
        },
        {
          price: Number(product.price),
          discountPrice:
            product.discountPrice !== null && product.discountPrice !== undefined
              ? Number(product.discountPrice)
              : null,
        }
      );
      if (validatedPricing.price !== undefined) {
        updateData.price = validatedPricing.price;
      }
      if (validatedPricing.discountPrice !== undefined) {
        updateData.discountPrice = validatedPricing.discountPrice;
      }
    }

    const isCategoryUpdateRequested =
      updateData.categoryId !== undefined || updateData.category !== undefined;

    if (isCategoryUpdateRequested) {
      const shop = await Shop.findByPk(product.shopId);
      if (!shop) {
        throw new NotFoundError(`Shop with ID ${product.shopId} not found`);
      }

      const incomingCategoryId = updateData.categoryId;
      const isChangingCategory =
        incomingCategoryId !== undefined
          ? Number(incomingCategoryId) !== product.categoryId
          : Boolean(
              updateData.category &&
                updateData.category.trim().toLowerCase() !== (product.category || "").trim().toLowerCase()
            );

      const validatedSub = await this.validateProductSubcategoryForShop(
        shop,
        incomingCategoryId !== undefined ? incomingCategoryId : product.categoryId,
        incomingCategoryId !== undefined ? undefined : updateData.category,
        isChangingCategory
      );

      updateData.categoryId = validatedSub.categoryId;
      updateData.category = validatedSub.categoryName;
    }

    // If subcategory actually changed, place product at the end of the destination subcategory sequence
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

