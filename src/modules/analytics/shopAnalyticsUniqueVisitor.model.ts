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

export class ShopAnalyticsUniqueVisitor extends Model<
  InferAttributes<ShopAnalyticsUniqueVisitor>,
  InferCreationAttributes<ShopAnalyticsUniqueVisitor>
> {
  declare id: CreationOptional<number>;
  declare shopId: ForeignKey<Shop["id"]>;
  declare visitorId: string;
  declare analyticsDate: string; // YYYY-MM-DD
  declare createdAt: CreationOptional<Date>;
}

ShopAnalyticsUniqueVisitor.init(
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
    visitorId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "visitor_id",
    },
    analyticsDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "analytics_date",
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
    tableName: "shop_analytics_unique_visitors",
    modelName: "ShopAnalyticsUniqueVisitor",
    timestamps: false,
  }
);

