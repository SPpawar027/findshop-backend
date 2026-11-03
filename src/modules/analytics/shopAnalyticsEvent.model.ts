import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../../config/database";
import type { Shop } from "../shops/shop.model";
import type { User } from "../users/user.model";
import type { Product } from "../products/product.model";

export type AnalyticsEventType =
  | "shop_view"
  | "product_view"
  | "directions_click"
  | "call_click"
  | "wishlist_add"
  | "offer_view"
  | "offer_redeemed"
  | "qr_checkin";

export type AnalyticsPlatform = "mobile" | "website" | "other";

export class ShopAnalyticsEvent extends Model<
  InferAttributes<ShopAnalyticsEvent>,
  InferCreationAttributes<ShopAnalyticsEvent>
> {
  declare id: CreationOptional<number>;
  declare shopId: ForeignKey<Shop["id"]>;
  declare userId: ForeignKey<User["id"]> | null;
  declare visitorId: string;
  declare productId: ForeignKey<Product["id"]> | null;
  declare eventType: AnalyticsEventType;
  declare platform: AnalyticsPlatform;
  declare metadata: CreationOptional<Record<string, unknown> | null>;
  declare createdAt: CreationOptional<Date>;
}

ShopAnalyticsEvent.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    shopId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "shop_id",
      references: {
        model: "shops",
        key: "id",
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "user_id",
      references: {
        model: "users",
        key: "id",
      },
    },
    visitorId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "visitor_id",
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "product_id",
      references: {
        model: "products",
        key: "id",
      },
    },
    eventType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "event_type",
    },
    platform: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "website",
      field: "platform",
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: "metadata",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    sequelize,
    tableName: "shop_analytics_events",
    modelName: "ShopAnalyticsEvent",
    timestamps: false,
  }
);

