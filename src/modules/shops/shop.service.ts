import { Op, literal } from "sequelize";
import { Shop } from "./shop.model";
import { User } from "../users/user.model";
import { Product } from "../products/product.model";
import { NotFoundError } from "../../core/errors/AppError";

export interface ListShopsQuery {
  category?: string;
  city?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface NearbyShopsQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
}

export interface CreateShopInput {
  ownerId: number;
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
  openingHours?: Record<string, unknown> | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
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

    const { count, rows } = await Shop.findAndCountAll({
      where,
      limit,
      offset,
      order: [["rating", "DESC"], ["createdAt", "DESC"]],
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

  async findById(id: number): Promise<Shop> {
    const shop = await Shop.findByPk(id, {
      include: [
        {
          model: User,
          as: "owner",
          attributes: ["id", "name", "email", "phone", "role"],
        },
        {
          model: Product,
          as: "products",
          attributes: [
            "id",
            "name",
            "slug",
            "description",
            "price",
            "discountPrice",
            "images",
            "category",
            "isAvailable",
            "stockQuantity",
            "sku",
          ],
        },
      ],
    });
    if (!shop) {
      throw new NotFoundError(`Shop with id ${id} not found`);
    }
    return shop;
  }

  async findBySlug(slug: string): Promise<Shop> {
    const shop = await Shop.findOne({
      where: { slug },
      include: [
        {
          model: User,
          as: "owner",
          attributes: ["id", "name", "email", "phone", "role"],
        },
        {
          model: Product,
          as: "products",
          attributes: [
            "id",
            "name",
            "slug",
            "description",
            "price",
            "discountPrice",
            "images",
            "category",
            "isAvailable",
            "stockQuantity",
            "sku",
          ],
        },
      ],
    });
    if (!shop) {
      throw new NotFoundError(`Shop with slug '${slug}' not found`);
    }
    return shop;
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
    const shop = await Shop.create({
      ...data,
      rating: 0,
      reviewCount: 0,
      isVerified: false,
      isOpen: true,
    });
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

