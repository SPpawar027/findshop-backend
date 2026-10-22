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

export class Product extends Model<
  InferAttributes<Product, { omit: "shop" }>,
  InferCreationAttributes<Product, { omit: "shop" }>
> {
  declare id: CreationOptional<number>;
  declare shopId: ForeignKey<Shop["id"]>;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare category: string;
  declare price: number;
  declare discountPrice: number | null;
  declare stockQuantity: CreationOptional<number>;
  declare sku: string | null;
  declare images: CreationOptional<string[]>;
  declare isAvailable: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare shop?: NonAttribute<Shop>;
}

Product.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    shopId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "shops",
        key: "id",
      },
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(220),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue("price");
        return val ? Number(val) : 0;
      },
    },
    discountPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        const val = this.getDataValue("discountPrice");
        return val !== null && val !== undefined ? Number(val) : null;
      },
    },
    stockQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    sku: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    images: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "products",
    timestamps: true,
  }
);
