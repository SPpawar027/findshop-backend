import { Op, literal } from "sequelize";
import bcrypt from "bcryptjs";
import { sequelize } from "../../config/database";
import { Shop } from "./shop.model";
import { ShopCategory } from "./shopCategory.model";
import { Category } from "../categories/category.model";
import { User } from "../users/user.model";
import { Product } from "../products/product.model";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../core/errors/AppError";
import type { AuthenticatedUser } from "../../core/middlewares/auth.middleware";
import { emailService } from "../../core/mail/email.service";
import { uploadService } from "../upload/upload.service";
import { storageService } from "../../core/storage/storage.service";
import {
  ShopCategorySummary,
  validateShopCategorySelection,
  resolveLegacyCategoryName,
  getEffectiveShopL1Categories,
  batchFetchShopCategoriesMap,
  assertSafeCategoryRemoval,
  syncShopCategoriesInTransaction,
  attachShopCategoriesMeta,
  slugifyCategoryName,
} from "./shopCategory.helper";
import {
  calculateHaversineDistance,
  formatDistance,
  calculateShopOpenStatus,
  buildWeeklySchedule,
  generateRatingSummary,
  getStandardShopAmenities,
  ShopOpenStatusResult,
  DayScheduleItem,
  ShopAmenityItem,
  RatingSummaryResult,
} from "./shop.helper";

export interface ListShopsQuery {
  category?: string;
  categoryId?: number;
  city?: string;
  search?: string;
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sortBy?: string;
  status?: string;
  activeOnly?: boolean | string;
  excludeSuspended?: boolean | string;
}

export interface NearbyShopsQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
  category?: string;
  categoryId?: number;
}

function generateSecureTempPassword(): string {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const alphanum = "abcdefghjkmnpqrstuvwxyz23456789";
  let randomStr = "";
  for (let i = 0; i < 4; i++) {
    randomStr += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  for (let i = 0; i < 4; i++) {
    randomStr += alphanum.charAt(Math.floor(Math.random() * alphanum.length));
  }
  return `Shop@${randomStr}`;
}

export interface CreateShopInput {
  ownerId?: number;
  name: string;
  slug: string;
  description?: string | null;
  category?: string;
  categoryIds?: number[];
  primaryCategoryId?: number;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  email?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  openingHours?: Record<string, unknown> | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
}

export interface ShopDetailQuery {
  lat?: number;
  lng?: number;
  category?: string;
  productSearch?: string;
  availableOnly?: boolean;
  productsLimit?: number;
  productsPage?: number;
  allowSuspended?: boolean;
}

export interface ShopDetailResponse {
  id: number;
  ownerId: number;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  categories: ShopCategorySummary[];
  categoryIds: number[];
  primaryCategoryId: number | null;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  isOpen: boolean;
  openingHours: Record<string, unknown> | null;
  bannerUrl: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Enriched dynamic properties
  distanceKm?: number;
  distanceFormatted?: string;
  galleryImages: string[];
  openStatus: ShopOpenStatusResult;
  weeklySchedule: DayScheduleItem[];
  amenities: ShopAmenityItem[];
  paymentMethods: string[];
  actionLinks: {
    directionsUrl: string;
    phoneCallUri: string | null;
    shareUrl: string;
  };
  ratingSummary: RatingSummaryResult;

  // Associations & catalog summary
  owner?: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    role: string;
  };
  products: any[];
  productCategories: string[];
  totalProductsCount: number;
}

export class ShopService {
  /**
   * Resolves shop IDs matching a main category filter (by ID, name, or slug)
   * using the normalized `shop_categories` table, with safe fallback if the
   * migration hasn't been executed yet.
   */
  private async resolveShopIdsForCategoryFilter(
    categoryId?: number,
    category?: string
  ): Promise<{ matchedCategoryIds: number[]; matchedShopIds: number[]; matchedCategoryNames: string[] }> {
    const matchedCategoryIds = new Set<number>();
    const matchedCategoryNames = new Set<string>();

    if (categoryId && Number.isInteger(Number(categoryId)) && Number(categoryId) > 0) {
      const cat = await Category.findByPk(Number(categoryId), {
        attributes: ["id", "name", "level", "parentId"],
      });
      if (cat) {
        // If someone passes an L2 subcategory ID to shop discovery, resolve its parent L1 category
        const targetId = cat.level === 2 && cat.parentId ? cat.parentId : cat.id;
        matchedCategoryIds.add(targetId);
        matchedCategoryNames.add(cat.name);
        if (targetId !== cat.id) {
          const parent = await Category.findByPk(targetId, { attributes: ["id", "name"] });
          if (parent) matchedCategoryNames.add(parent.name);
        }
      } else {
        matchedCategoryIds.add(Number(categoryId));
      }
    }

    if (category && category.trim() && category.trim().toLowerCase() !== "all") {
      const clean = category.trim();
      const slug = slugifyCategoryName(clean);
      const cats = await Category.findAll({
        where: {
          level: 1,
          [Op.or]: [
            { name: { [Op.iLike]: clean } },
            { slug: { [Op.iLike]: slug } },
            { name: { [Op.iLike]: `%${clean}%` } },
          ],
        },
        attributes: ["id", "name"],
      });
      for (const c of cats) {
        matchedCategoryIds.add(c.id);
        matchedCategoryNames.add(c.name);
      }
      matchedCategoryNames.add(clean);
    }

    const catIdList = Array.from(matchedCategoryIds);
    let matchedShopIds: number[] = [];

    if (catIdList.length > 0) {
      try {
        const scRows = await ShopCategory.findAll({
          where: { categoryId: { [Op.in]: catIdList } },
          attributes: ["shopId"],
        });
        matchedShopIds = Array.from(new Set(scRows.map((r) => r.shopId)));
      } catch (err: any) {
        if (err?.parent?.code === "42P01" || String(err?.message || "").includes("shop_categories")) {
          matchedShopIds = [];
        } else {
          throw err;
        }
      }
    }

    return {
      matchedCategoryIds: catIdList,
      matchedShopIds,
      matchedCategoryNames: Array.from(matchedCategoryNames),
    };
  }

  async findAll(query: ListShopsQuery = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    const andConditions: any[] = [];

    // Status filter: Public consumers only see open & verified shops.
    // SuperAdmin or admin consoles explicitly pass status="all" to see all shops including suspended.
    const statusParam = (query.status || "").toLowerCase().trim();
    const isActiveOnly =
      query.activeOnly === true ||
      query.activeOnly === "true" ||
      query.excludeSuspended === true ||
      query.excludeSuspended === "true" ||
      statusParam === "active";

    if (isActiveOnly) {
      where.isOpen = true;
      where.isVerified = true;
    } else if (statusParam === "suspended") {
      where.isOpen = false;
    } else if (statusParam === "pending" || statusParam === "pending_approval") {
      where.isVerified = false;
    } else if (statusParam !== "all") {
      // Safe default for website/mobile app: exclude suspended and unverified shops
      where.isOpen = true;
      where.isVerified = true;
    }

    // Multi-category discovery filter: matches ANY of a shop's 1..3 assigned categories
    // without causing duplicate shop rows or inflated totals.
    const hasCategoryFilter =
      (query.categoryId !== undefined && !isNaN(Number(query.categoryId))) ||
      (typeof query.category === "string" &&
        query.category.trim() !== "" &&
        query.category.trim().toLowerCase() !== "all");

    if (hasCategoryFilter) {
      const { matchedShopIds, matchedCategoryNames } = await this.resolveShopIdsForCategoryFilter(
        query.categoryId,
        query.category
      );

      const categoryOrConditions: any[] = [];
      if (matchedShopIds.length > 0) {
        categoryOrConditions.push({ id: { [Op.in]: matchedShopIds } });
      }
      // Backward compatibility for legacy shops not yet backfilled into shop_categories
      for (const catName of matchedCategoryNames) {
        categoryOrConditions.push({ category: { [Op.iLike]: catName } });
      }

      if (categoryOrConditions.length > 0) {
        andConditions.push({ [Op.or]: categoryOrConditions });
      } else {
        // Explicit non-matching categoryId/name => return empty set safely
        andConditions.push({ id: -1 });
      }
    }

    if (query.city) {
      where.city = { [Op.iLike]: `%${query.city}%` };
    }

    if (query.search && query.search.trim()) {
      const trimmedSearch = query.search.trim();
      const s = `%${trimmedSearch}%`;
      const searchOrConditions: any[] = [
        { name: { [Op.iLike]: s } },
        { description: { [Op.iLike]: s } },
        { category: { [Op.iLike]: s } },
        { city: { [Op.iLike]: s } },
      ];

      // Also match shops assigned to any L1 category whose name matches the search query
      try {
        const matchingCats = await Category.findAll({
          where: { level: 1, name: { [Op.iLike]: s } },
          attributes: ["id"],
        });
        if (matchingCats.length > 0) {
          const scRows = await ShopCategory.findAll({
            where: { categoryId: { [Op.in]: matchingCats.map((c) => c.id) } },
            attributes: ["shopId"],
          });
          const scShopIds = Array.from(new Set(scRows.map((r) => r.shopId)));
          if (scShopIds.length > 0) {
            searchOrConditions.push({ id: { [Op.in]: scShopIds } });
          }
        }
      } catch {
        // Safe fallback if shop_categories isn't migrated yet
      }

      andConditions.push({ [Op.or]: searchOrConditions });
    }

    let attributes: any = undefined;
    let order: any = [["rating", "DESC"], ["createdAt", "DESC"], ["id", "ASC"]];

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
            cos(radians(${lat})) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(latitude))
          ))
        ))
      `);
      attributes = {
        include: [[distanceLiteral, "distanceKm"]],
      };

      if (query.radiusKm && !isNaN(Number(query.radiusKm))) {
        const radius = Number(query.radiusKm);
        andConditions.push(
          literal(`
            (6371 * acos(
              least(1.0, greatest(-1.0,
                cos(radians(${lat})) * cos(radians(latitude)) *
                cos(radians(longitude) - radians(${lng})) +
                sin(radians(${lat})) * sin(radians(latitude))
              ))
            )) <= ${radius}
          `)
        );
      }

      const sortOption = (query.sortBy || "").toLowerCase().trim();
      if (sortOption === "rating") {
        order = [["rating", "DESC"], ["createdAt", "DESC"], ["id", "ASC"]];
      } else if (sortOption === "newest") {
        order = [["createdAt", "DESC"], ["id", "ASC"]];
      } else {
        // Default when location is present: Proximity-first ranking
        order = [[distanceLiteral, "ASC"], ["rating", "DESC"], ["id", "ASC"]];
      }
    } else {
      const sortOption = (query.sortBy || "").toLowerCase().trim();
      if (sortOption === "newest") {
        order = [["createdAt", "DESC"], ["id", "ASC"]];
      } else {
        order = [["rating", "DESC"], ["createdAt", "DESC"], ["id", "ASC"]];
      }
    }

    if (andConditions.length > 0) {
      where[Op.and as unknown as string] = andConditions;
    }

    const { count, rows } = await Shop.findAndCountAll({
      where,
      attributes,
      limit,
      offset,
      order,
    });

    const categoriesMap = await batchFetchShopCategoriesMap(rows);
    const enrichedShops = rows.map((row) =>
      attachShopCategoriesMeta(row.toJSON(), categoriesMap.get(row.id) || [])
    );

    const totalPages = Math.ceil(count / limit);

    return {
      shops: enrichedShops,
      meta: {
        page,
        limit,
        total: count,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async getDetail(identifier: string | number, query: ShopDetailQuery = {}): Promise<ShopDetailResponse> {
    const isNum =
      typeof identifier === "number" ||
      (!isNaN(Number(identifier)) && !isNaN(parseFloat(String(identifier))));

    let shop: Shop | null = null;

    const baseInclude = [
      {
        model: User,
        as: "owner",
        attributes: ["id", "name", "email", "phone", "role"],
      },
    ];

    if (isNum) {
      shop = await Shop.findByPk(Number(identifier), { include: baseInclude });
    } else {
      const raw = String(identifier).trim();
      shop = await Shop.findOne({ where: { slug: raw }, include: baseInclude });

      // Fallback: check if slug has "shop-" prefix stripped or as numeric id
      if (!shop && raw.startsWith("shop-")) {
        const stripped = raw.replace(/^shop-/, "");
        if (!isNaN(Number(stripped))) {
          shop = await Shop.findByPk(Number(stripped), { include: baseInclude });
        } else {
          shop = await Shop.findOne({ where: { slug: stripped }, include: baseInclude });
        }
      }
    }

    if (!shop) {
      throw new NotFoundError(`Shop '${identifier}' not found`);
    }
    // If shop is suspended or unverified, hide from public website/customer queries
    // if admin and subadmin then all this suspended and not verified not open should be allowed
    const userRole = (query as any).role;
    if (userRole === "customer") {
      if (!query.allowSuspended && (!shop.isOpen || !shop.isVerified)) {
        throw new NotFoundError(`This shop is currently inactive or suspended.`);
      }
    }

    // 1. Fetch filtered products for this shop and gather catalog categories
    const productWhere: Record<string, unknown> = {
      shopId: shop.id,
    };

    if (query.availableOnly) {
      productWhere.isAvailable = true;
    }

    if (query.category && query.category !== "ALL") {
      productWhere.category = query.category;
    }

    if (query.productSearch) {
      productWhere[Op.or as unknown as string] = [
        { name: { [Op.iLike]: `%${query.productSearch}%` } },
        { description: { [Op.iLike]: `%${query.productSearch}%` } },
      ];
    }

    const productsLimit = Math.min(100, Math.max(1, Number(query.productsLimit || 50)));
    const productsPage = Math.max(1, Number(query.productsPage || 1));
    const productsOffset = (productsPage - 1) * productsLimit;

    const [filteredProducts, allShopProducts, shopCategories] = await Promise.all([
      Product.findAll({
        where: productWhere,
        order: [["sortOrder", "ASC"], ["createdAt", "DESC"], ["id", "ASC"]],
        limit: productsLimit,
        offset: productsOffset,
      }),
      Product.findAll({
        where: { shopId: shop.id },
        attributes: ["category"],
      }),
      getEffectiveShopL1Categories(shop),
    ]);

    // Compute distinct product categories
    const categorySet = new Set<string>();
    allShopProducts.forEach((p) => {
      if (p.category) categorySet.add(p.category);
    });
    const productCategories = ["ALL", ...Array.from(categorySet).sort()];

    // 2. Geospatial distance calculation
    let distanceKm: number | undefined;
    let distanceFormatted: string | undefined;

    if (
      query.lat !== undefined &&
      query.lng !== undefined &&
      !isNaN(Number(query.lat)) &&
      !isNaN(Number(query.lng))
    ) {
      const userLat = Number(query.lat);
      const userLng = Number(query.lng);
      distanceKm = calculateHaversineDistance(
        userLat,
        userLng,
        Number(shop.latitude),
        Number(shop.longitude)
      );
      distanceFormatted = formatDistance(distanceKm);
    }

    // 3. Dynamic open status & weekly schedule
    const openStatus = calculateShopOpenStatus(shop.openingHours, shop.isOpen);
    const weeklySchedule = buildWeeklySchedule(shop.openingHours);

    // 4. Rating summary curve
    const ratingSummary = generateRatingSummary(shop.rating, shop.reviewCount);

    // 5. Storefront amenities & payment methods
    const amenities = getStandardShopAmenities(shop.category);
    const paymentMethods = ["UPI", "Cash", "Credit / Debit Cards", "Net Banking"];

    // 6. Action Links
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`;
    const phoneCallUri = shop.phone ? `tel:${shop.phone}` : null;
    const shareUrl = `https://findshopeasily.com/shop/${shop.slug}`;

    // 7. Gallery Images (banner + top product photos)
    const productImages = filteredProducts.flatMap((p) =>
      Array.isArray(p.images) ? p.images : []
    );
    const galleryImages = Array.from(
      new Set([shop.bannerUrl, ...productImages].filter(Boolean) as string[])
    );

    const shopJson = attachShopCategoriesMeta(shop.toJSON(), shopCategories);

    return {
      ...shopJson,
      distanceKm,
      distanceFormatted,
      openStatus,
      weeklySchedule,
      amenities,
      paymentMethods,
      actionLinks: {
        directionsUrl,
        phoneCallUri,
        shareUrl,
      },
      ratingSummary,
      galleryImages,
      owner: shop.owner
        ? {
          id: shop.owner.id,
          name: shop.owner.name,
          email: shop.owner.email,
          phone: shop.owner.phone,
          role: shop.owner.role,
        }
        : undefined,
      products: filteredProducts.map((p) => p.toJSON()),
      productCategories,
      totalProductsCount: allShopProducts.length,
    };
  }

  async findById(id: number, query: ShopDetailQuery = {}): Promise<ShopDetailResponse> {
    return this.getDetail(id, query);
  }

  async findBySlug(slug: string, query: ShopDetailQuery = {}): Promise<ShopDetailResponse> {
    return this.getDetail(slug, query);
  }

  async findNearby({ latitude, longitude, radiusKm = 10, limit = 20, category, categoryId }: NearbyShopsQuery) {
    // Haversine formula in kilometers: 6371 * acos(...)
    const distanceLiteral = literal(`
      (6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(${Number(latitude)})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(${Number(longitude)})) +
          sin(radians(${Number(latitude)})) * sin(radians(latitude))
        ))
      ))
    `);

    const andConditions: any[] = [
      { isOpen: true, isVerified: true },
      literal(`
        (6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(${Number(latitude)})) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(${Number(longitude)})) +
            sin(radians(${Number(latitude)})) * sin(radians(latitude))
          ))
        )) <= ${Number(radiusKm)}
      `),
    ];

    const hasCategoryFilter =
      (categoryId !== undefined && !isNaN(Number(categoryId))) ||
      (typeof category === "string" && category.trim() !== "" && category.trim().toLowerCase() !== "all");

    if (hasCategoryFilter) {
      const { matchedShopIds, matchedCategoryNames } = await this.resolveShopIdsForCategoryFilter(
        categoryId,
        category
      );
      const catOr: any[] = [];
      if (matchedShopIds.length > 0) catOr.push({ id: { [Op.in]: matchedShopIds } });
      for (const name of matchedCategoryNames) catOr.push({ category: { [Op.iLike]: name } });
      if (catOr.length > 0) {
        andConditions.push({ [Op.or]: catOr });
      } else {
        andConditions.push({ id: -1 });
      }
    }

    const shops = await Shop.findAll({
      attributes: {
        include: [[distanceLiteral, "distanceKm"]],
      },
      where: {
        [Op.and]: andConditions,
      },
      order: literal(`"distanceKm" ASC`),
      limit: Math.min(100, Number(limit || 20)),
    });

    const categoriesMap = await batchFetchShopCategoriesMap(shops);
    return shops.map((s) => attachShopCategoriesMeta(s.toJSON(), categoriesMap.get(s.id) || []));
  }

  async create(data: CreateShopInput): Promise<any> {
    const targetEmail = (data.ownerEmail || data.email || "").toLowerCase().trim();
    const targetName = (data.ownerName || data.name || "Merchant Partner").trim();
    const targetPhone = (data.ownerPhone || data.phone || "").trim() || null;

    let ownerId = data.ownerId;
    let tempPasswordGenerated: string | null = null;
    let isNewUserCreated = false;

    const { shop, assignedCategories } = await sequelize.transaction(async (t) => {
      // 1. Validate category selection upfront (supports categoryIds[] OR legacy category string)
      let validatedSelection = null;
      let resolvedCategoryName = (data.category || "").trim();

      if (data.categoryIds !== undefined) {
        validatedSelection = await validateShopCategorySelection(
          data.categoryIds,
          data.primaryCategoryId,
          t
        );
        resolvedCategoryName = validatedSelection.primaryCategory.name;
      } else if (resolvedCategoryName) {
        const legacyCat = await resolveLegacyCategoryName(resolvedCategoryName, t);
        if (legacyCat) {
          validatedSelection = {
            categoryIds: [legacyCat.id],
            primaryCategoryId: legacyCat.id,
            categories: [legacyCat],
            primaryCategory: legacyCat,
          };
          resolvedCategoryName = legacyCat.name;
        }
      } else {
        throw new BadRequestError("At least 1 main category must be selected (categoryIds)");
      }

      if (targetEmail) {
        let user = await User.findOne({ where: { email: targetEmail }, transaction: t });

        if (!user) {
          tempPasswordGenerated = generateSecureTempPassword();
          const salt = await bcrypt.genSalt(10);
          const passwordHash = await bcrypt.hash(tempPasswordGenerated, salt);

          user = await User.create(
            {
              name: targetName,
              email: targetEmail,
              passwordHash,
              phone: targetPhone,
              role: "shop_admin",
              isActive: true,
            },
            { transaction: t }
          );
          isNewUserCreated = true;
        } else if (user.role === "customer") {
          await user.update({ role: "shop_admin" }, { transaction: t });
        }

        ownerId = user.id;
      }

      if (!ownerId) {
        ownerId = 1;
      }

      const {
        ownerName: _on,
        ownerEmail: _oe,
        ownerPhone: _op,
        categoryIds: _cids,
        primaryCategoryId: _pcid,
        ...rawShopAttributes
      } = data;

      const createdShop = await Shop.create(
        {
          ...rawShopAttributes,
          category: resolvedCategoryName,
          ownerId,
          phone: rawShopAttributes.phone || targetPhone,
          email: rawShopAttributes.email || targetEmail || null,
          rating: 0,
          reviewCount: 0,
          isVerified: false,
          isOpen: true,
        },
        { transaction: t }
      );

      let syncedCats: ShopCategorySummary[] = [];
      if (validatedSelection) {
        syncedCats = await syncShopCategoriesInTransaction(createdShop.id, validatedSelection, t);
      }

      return { shop: createdShop, assignedCategories: syncedCats };
    });

    const enriched = attachShopCategoriesMeta(shop.toJSON(), assignedCategories);

    if (tempPasswordGenerated && targetEmail) {
      // Async dispatch welcome email via Nodemailer
      emailService
        .sendMerchantWelcomeEmail({
          to: targetEmail,
          ownerName: targetName,
          shopName: shop.name,
          tempPassword: tempPasswordGenerated,
        })
        .catch((err) => {
          console.error(`[ShopService] Failed to send merchant welcome email to ${targetEmail}:`, err);
        });

      (enriched as any).merchantCredentials = {
        email: targetEmail,
        tempPassword: tempPasswordGenerated,
        isNewUser: isNewUserCreated,
      };
    }

    return enriched;
  }

  async update(
    id: number,
    data: Partial<CreateShopInput> & { isOpen?: boolean; isVerified?: boolean }
  ): Promise<any> {
    const existingPreCheck = await Shop.findByPk(id);
    if (!existingPreCheck) {
      throw new NotFoundError(`Shop with id ${id} not found`);
    }

    const updateData: Record<string, any> = { ...data };
    const hasCategoryIdsUpdate = data.categoryIds !== undefined;
    const hasPrimaryCategoryUpdate = data.primaryCategoryId !== undefined;
    const hasLegacyCategoryUpdate = !hasCategoryIdsUpdate && !hasPrimaryCategoryUpdate && data.category !== undefined;

    // Strip join-table fields before passing updateData to Shop.update
    delete updateData.categoryIds;
    delete updateData.primaryCategoryId;

    const oldLogoClean = existingPreCheck.logoUrl ? storageService.extractKeyFromUrl(existingPreCheck.logoUrl) : null;
    const oldBannerClean = existingPreCheck.bannerUrl ? storageService.extractKeyFromUrl(existingPreCheck.bannerUrl) : null;

    // Promote new logo if uploaded to temporary storage
    if (updateData.logoUrl !== undefined) {
      if (!updateData.logoUrl) {
        updateData.logoUrl = null as any;
      } else {
        const cleanLogoKey = storageService.extractKeyFromUrl(updateData.logoUrl);
        if (cleanLogoKey.includes("temp/uploads/") || cleanLogoKey.startsWith("temp/")) {
          try {
            const permanentLogoKey = `shops/${existingPreCheck.id}/logo.webp`;
            await uploadService.promoteUpload({
              tempKeyOrId: cleanLogoKey,
              targetPermanentKey: permanentLogoKey,
              entityType: "shop",
              entityId: existingPreCheck.id,
              shopId: existingPreCheck.id,
              imageRole: "logo",
            });
            updateData.logoUrl = permanentLogoKey;
          } catch (err: any) {
            console.error(`Failed to promote shop logo [${cleanLogoKey}]:`, err?.message);
          }
        } else {
          updateData.logoUrl = cleanLogoKey;
        }
      }
    }

    // Promote new banner if uploaded to temporary storage
    if (updateData.bannerUrl !== undefined) {
      if (!updateData.bannerUrl) {
        updateData.bannerUrl = null as any;
      } else {
        const cleanBannerKey = storageService.extractKeyFromUrl(updateData.bannerUrl);
        if (cleanBannerKey.includes("temp/uploads/") || cleanBannerKey.startsWith("temp/")) {
          try {
            const permanentBannerKey = `shops/${existingPreCheck.id}/banner.webp`;
            await uploadService.promoteUpload({
              tempKeyOrId: cleanBannerKey,
              targetPermanentKey: permanentBannerKey,
              entityType: "shop",
              entityId: existingPreCheck.id,
              shopId: existingPreCheck.id,
              imageRole: "banner",
            });
            updateData.bannerUrl = permanentBannerKey;
          } catch (err: any) {
            console.error(`Failed to promote shop banner [${cleanBannerKey}]:`, err?.message);
          }
        } else {
          updateData.bannerUrl = cleanBannerKey;
        }
      }
    }

    const { updatedShop, finalCategories } = await sequelize.transaction(async (t) => {
      // Acquire row-level lock on the shop to serialize concurrent category updates
      // and prevent race conditions that could bypass the 3-category limit or primary constraint.
      const shop = await Shop.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!shop) {
        throw new NotFoundError(`Shop with id ${id} not found`);
      }

      let syncedCategories: ShopCategorySummary[] | null = null;

      if (hasCategoryIdsUpdate || hasPrimaryCategoryUpdate) {
        const currentCategories = await getEffectiveShopL1Categories(shop, t);
        const currentCategoryIds = currentCategories.map((c) => c.id);

        const targetCategoryIds = hasCategoryIdsUpdate ? data.categoryIds : currentCategoryIds;
        const targetPrimaryId = hasPrimaryCategoryUpdate
          ? data.primaryCategoryId
          : currentCategories.find((c) => c.isPrimary)?.id;

        const selection = await validateShopCategorySelection(
          targetCategoryIds,
          // If the old primary was removed and caller didn't explicitly specify a new one, default to first selected
          targetPrimaryId && Array.isArray(targetCategoryIds) && targetCategoryIds.map(Number).includes(Number(targetPrimaryId))
            ? targetPrimaryId
            : undefined,
          t
        );

        const nextIdSet = new Set(selection.categoryIds);
        const removedCategoryIds = currentCategoryIds.filter((cid) => !nextIdSet.has(cid));

        // Block unsafe removal if dependent active products still exist under any removed category
        await assertSafeCategoryRemoval(shop.id, removedCategoryIds, t);

        syncedCategories = await syncShopCategoriesInTransaction(shop.id, selection, t);
        // Keep legacy shops.category synchronized with primary category
        updateData.category = selection.primaryCategory.name;
      } else if (hasLegacyCategoryUpdate && typeof data.category === "string" && data.category.trim()) {
        const currentCategories = await getEffectiveShopL1Categories(shop, t);
        const resolvedLegacy = await resolveLegacyCategoryName(data.category, t);
        if (resolvedLegacy) {
          const currentIds = currentCategories.map((c) => c.id);
          if (currentIds.length <= 1) {
            const removedIds = currentIds.filter((cid) => cid !== resolvedLegacy.id);
            await assertSafeCategoryRemoval(shop.id, removedIds, t);
            syncedCategories = await syncShopCategoriesInTransaction(
              shop.id,
              {
                categoryIds: [resolvedLegacy.id],
                primaryCategoryId: resolvedLegacy.id,
                categories: [resolvedLegacy],
                primaryCategory: resolvedLegacy,
              },
              t
            );
            updateData.category = resolvedLegacy.name;
          }
        }
      }

      if (Object.keys(updateData).length > 0) {
        await shop.update(updateData, { transaction: t });
      }

      if (!syncedCategories) {
        syncedCategories = await getEffectiveShopL1Categories(shop, t);
      }

      return { updatedShop: shop, finalCategories: syncedCategories };
    });

    // If logo was explicitly removed or changed to a different key, safely delete old key
    const newLogoClean = updateData.logoUrl ? storageService.extractKeyFromUrl(updateData.logoUrl) : null;
    if (
      oldLogoClean &&
      oldLogoClean.startsWith("shops/") &&
      updateData.logoUrl !== undefined &&
      oldLogoClean !== newLogoClean
    ) {
      if (oldLogoClean !== `shops/${updatedShop.id}/logo.webp`) {
        storageService.deleteObject(oldLogoClean).catch((delErr) => {
          console.warn(`[Storage Warning] Failed to delete replaced logo [${oldLogoClean}]:`, delErr?.message);
        });
      }
    }

    // If banner was explicitly removed or changed to a different key, safely delete old key
    const newBannerClean = updateData.bannerUrl ? storageService.extractKeyFromUrl(updateData.bannerUrl) : null;
    if (
      oldBannerClean &&
      oldBannerClean.startsWith("shops/") &&
      updateData.bannerUrl !== undefined &&
      oldBannerClean !== newBannerClean
    ) {
      if (oldBannerClean !== `shops/${updatedShop.id}/banner.webp`) {
        storageService.deleteObject(oldBannerClean).catch((delErr) => {
          console.warn(`[Storage Warning] Failed to delete replaced banner [${oldBannerClean}]:`, delErr?.message);
        });
      }
    }

    return attachShopCategoriesMeta(updatedShop.toJSON(), finalCategories);
  }

  /**
   * Safely soft-deletes a shop and schedules it for permanent purge after 30 days.
   * Only the shop's owner or a super_admin can trigger this operation.
   */
  async softDelete(
    id: number,
    user: AuthenticatedUser,
    reason?: string
  ): Promise<{ shop: Shop; purgeAfter: Date }> {
    const shop = await Shop.findByPk(id, { paranoid: false });
    if (!shop) {
      throw new NotFoundError(`Shop with id ${id} not found`);
    }

    if (shop.deletedAt) {
      throw new BadRequestError("Shop is already scheduled for deletion");
    }

    // RBAC & Ownership check
    if (user.role !== "super_admin" && shop.ownerId !== user.id) {
      throw new ForbiddenError("You do not have permission to delete this shop");
    }

    const deletionRequestedAt = new Date();
    const purgeAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30-day recovery grace period

    // 1. Update status fields and mark storefront closed
    await shop.update({
      isOpen: false,
      deletionRequestedAt,
      purgeAfter,
      deletionReason: reason ? reason.trim().slice(0, 500) : "Owner requested shop closure",
      deletedByUserId: user.id,
    });

    // 2. Soft-delete the shop record (Sequelize paranoid sets deletedAt)
    await shop.destroy();

    // 3. Soft-delete associated products so they immediately disappear from catalog and search
    await Product.destroy({ where: { shopId: id } });

    console.log(
      `[Shop Deletion Scheduled] Shop ID ${id} ("${shop.name}") soft-deleted by User ${user.id} (${user.role}). Purge date: ${purgeAfter.toISOString()}`
    );

    return { shop, purgeAfter };
  }

  /**
   * Restores a soft-deleted shop within its 30-day recovery grace period.
   */
  async restore(id: number, user: AuthenticatedUser): Promise<Shop> {
    const shop = await Shop.findByPk(id, { paranoid: false });
    if (!shop) {
      throw new NotFoundError(`Shop with id ${id} not found`);
    }

    if (!shop.deletedAt) {
      throw new BadRequestError("Shop is not currently deleted");
    }

    // RBAC & Ownership check
    if (user.role !== "super_admin" && shop.ownerId !== user.id) {
      throw new ForbiddenError("You do not have permission to restore this shop");
    }

    // Verify 30-day recovery window has not expired
    if (shop.purgeAfter && new Date() > new Date(shop.purgeAfter)) {
      throw new BadRequestError(
        "The 30-day recovery period has expired. This shop is undergoing permanent purge and cannot be restored."
      );
    }

    // 1. Restore shop record
    await shop.restore();

    // 2. Reset deletion tracking metadata and reopen shop
    await shop.update({
      isOpen: true,
      deletionRequestedAt: null,
      purgeAfter: null,
      deletionReason: null,
      deletedByUserId: null,
    });

    // 3. Restore all associated products
    await Product.restore({ where: { shopId: id } });

    console.log(
      `[Shop Restored] Shop ID ${id} ("${shop.name}") restored by User ${user.id} (${user.role}).`
    );

    return shop;
  }

  async delete(id: number, user?: AuthenticatedUser): Promise<void> {
    if (user) {
      await this.softDelete(id, user);
      return;
    }
    const shop = await Shop.findByPk(id);
    if (!shop) {
      throw new NotFoundError(`Shop with id ${id} not found`);
    }
    await shop.destroy();
  }
}

export const shopService = new ShopService();

