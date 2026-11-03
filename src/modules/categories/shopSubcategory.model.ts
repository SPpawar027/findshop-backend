import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  NonAttribute,
} from "sequelize";
import { sequelize } from "../../config/database";
import type { Shop } from "../shops/shop.model";
import type { Category } from "./category.model";

export class ShopSubcategory extends Model<
  InferAttributes<ShopSubcategory, { omit: "shop" | "subcategory" }>,
  InferCreationAttributes<ShopSubcategory, { omit: "shop" | "subcategory" }>
> {
  declare id: CreationOptional<number>;
  declare shopId: ForeignKey<Shop["id"]>;
  declare subcategoryId: ForeignKey<Category["id"]>;
  declare sortOrder: CreationOptional<number>;
  declare isVisible: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare shop?: NonAttribute<Shop>;
  declare subcategory?: NonAttribute<Category>;
}

ShopSubcategory.init(
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
    subcategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "subcategory_id",
      references: {
        model: "categories",
        key: "id",
      },
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },
    isVisible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_visible",
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
    tableName: "shop_subcategories",
    modelName: "ShopSubcategory",
    timestamps: true,
    underscored: true,
  }
);

