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

export class ShopAnalyticsDaily extends Model<
  InferAttributes<ShopAnalyticsDaily>,
  InferCreationAttributes<ShopAnalyticsDaily>
> {
  declare id: CreationOptional<number>;
  declare shopId: ForeignKey<Shop["id"]>;
  declare analyticsDate: string; // YYYY-MM-DD
  declare totalViews: CreationOptional<number>;
  declare uniqueVisitors: CreationOptional<number>;
  declare directionsClicks: CreationOptional<number>;
  declare callClicks: CreationOptional<number>;
  declare productViews: CreationOptional<number>;
  declare wishlistAdds: CreationOptional<number>;
  declare offerViews: CreationOptional<number>;
  declare offerRedemptions: CreationOptional<number>;
  declare metadata: CreationOptional<Record<string, unknown> | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ShopAnalyticsDaily.init(
  {
    id: {
      type: DataTypes.INTEGER,
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
    analyticsDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "analytics_date",
    },
    totalViews: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "total_views",
    },
    uniqueVisitors: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "unique_visitors",
    },
    directionsClicks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "directions_clicks",
    },
    callClicks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "call_clicks",
    },
    productViews: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "product_views",
    },
    wishlistAdds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "wishlist_adds",
    },
    offerViews: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "offer_views",
    },
    offerRedemptions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "offer_redemptions",
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
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
  },
  {
    sequelize,
    tableName: "shop_analytics_daily",
    modelName: "ShopAnalyticsDaily",
    timestamps: true,
    underscored: true,
  }
);

