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
import type { Product } from "../products/product.model";

export class Category extends Model<
  InferAttributes<Category, { omit: "parent" | "subcategories" | "products" }>,
  InferCreationAttributes<Category, { omit: "parent" | "subcategories" | "products" }>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare parentId: ForeignKey<Category["id"]> | null;
  declare level: CreationOptional<number>;
  declare icon: string | null;
  declare emoji: string | null;
  declare orderIndex: CreationOptional<number>;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare parent?: NonAttribute<Category | null>;
  declare subcategories?: NonAttribute<Category[]>;
  declare products?: NonAttribute<Product[]>;
}

Category.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "categories",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1, // 1 = L1 Department / Sector, 2 = L2 Product Category
    },
    icon: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "shopping-bag",
    },
    emoji: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "📦",
    },
    orderIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "categories",
    timestamps: true,
    indexes: [
      { fields: ["parentId"] },
      { fields: ["slug"], unique: true },
      { fields: ["level", "isActive"] },
      { fields: ["orderIndex"] },
    ],
  }
);
