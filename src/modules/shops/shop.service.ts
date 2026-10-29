import { Op, literal } from "sequelize";
import bcrypt from "bcryptjs";
import { Shop } from "./shop.model";
import { User } from "../users/user.model";
import { Product } from "../products/product.model";
import { NotFoundError } from "../../core/errors/AppError";
import { emailService } from "../../core/mail/email.service";
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
  city?: string;
  search?: string;
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export interface NearbyShopsQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
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
  category: string;
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
}

export interface ShopDetailResponse {
  id: number;
  ownerId: number;
  name: string;
  slug: string;
  description: string | null;
  category: string;
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
  async findAll(query: ListShopsQuery = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit || 20)));
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.category) {
      where.category = query.category;
    }

    if (query.city) {
      where.city = { [Op.iLike]: `%${query.city}%` };
    }

    if (query.search) {
      where[Op.or as unknown as string] = [
        { name: { [Op.iLike]: `%${query.search}%` } },
        { description: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    let attributes: any = undefined;
    let order: any = [["rating", "DESC"], ["createdAt", "DESC"]];

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
        where[Op.and as unknown as string] = literal(`
          (6371 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(${lat})) * cos(radians(latitude)) *
              cos(radians(longitude) - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(latitude))
            ))
          )) <= ${radius}
        `);
      }

      order = literal(`"distanceKm" ASC`);
    }

    const { count, rows } = await Shop.findAndCountAll({
      where,
      attributes,
      limit,
      offset,
      order,
    });

    return {
      shops: rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
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

    const [filteredProducts, allShopProducts] = await Promise.all([
      Product.findAll({
        where: productWhere,
        order: [["createdAt", "DESC"]],
        limit: productsLimit,
        offset: productsOffset,
      }),
      Product.findAll({
        where: { shopId: shop.id },
        attributes: ["category"],
      }),
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

    const shopJson = shop.toJSON();

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

  async findNearby({ latitude, longitude, radiusKm = 10, limit = 20 }: NearbyShopsQuery) {
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

    const shops = await Shop.findAll({
      attributes: {
        include: [[distanceLiteral, "distanceKm"]],
      },
      where: literal(`
        (6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(${Number(latitude)})) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(${Number(longitude)})) +
            sin(radians(${Number(latitude)})) * sin(radians(latitude))
          ))
        )) <= ${Number(radiusKm)}
      `),
      order: literal(`"distanceKm" ASC`),
      limit: Math.min(50, limit),
    });

    return shops;
  }

  async create(data: CreateShopInput): Promise<Shop> {
    const targetEmail = (data.ownerEmail || data.email || "").toLowerCase().trim();
    const targetName = (data.ownerName || data.name || "Merchant Partner").trim();
    const targetPhone = (data.ownerPhone || data.phone || "").trim() || null;

    let ownerId = data.ownerId;
    let tempPasswordGenerated: string | null = null;
    let isNewUserCreated = false;

    if (targetEmail) {
      let user = await User.findOne({ where: { email: targetEmail } });

      if (!user) {
        tempPasswordGenerated = generateSecureTempPassword();
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(tempPasswordGenerated, salt);

        user = await User.create({
          name: targetName,
          email: targetEmail,
          passwordHash,
          phone: targetPhone,
          role: "shop_admin",
          isActive: true,
        });
        isNewUserCreated = true;
      } else if (user.role === "customer") {
        // Upgrade customer to shop_admin so they can access merchant admin console
        await user.update({ role: "shop_admin" });
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
      ...rawShopAttributes
    } = data;

    const shop = await Shop.create({
      ...rawShopAttributes,
      ownerId,
      phone: rawShopAttributes.phone || targetPhone,
      email: rawShopAttributes.email || targetEmail || null,
      rating: 0,
      reviewCount: 0,
      isVerified: false,
      isOpen: true,
    });

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

      (shop as any).merchantCredentials = {
        email: targetEmail,
        tempPassword: tempPasswordGenerated,
        isNewUser: isNewUserCreated,
      };
    }

    return shop;
  }

  async update(id: number, data: Partial<CreateShopInput> & { isOpen?: boolean; isVerified?: boolean }): Promise<Shop> {
    const shop = await Shop.findByPk(id);
    if (!shop) {
      throw new NotFoundError(`Shop with id ${id} not found`);
    }

    await shop.update(data);
    return shop;
  }

  async delete(id: number): Promise<void> {
    const shop = await Shop.findByPk(id);
    if (!shop) {
      throw new NotFoundError(`Shop with id ${id} not found`);
    }

    await shop.destroy();
  }
}

export const shopService = new ShopService();

