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
import type { User } from "../users/user.model";
import type { Product } from "../products/product.model";

export class Shop extends Model<
  InferAttributes<Shop, { omit: "owner" | "products" }>,
  InferCreationAttributes<Shop, { omit: "owner" | "products" }>
> {
  declare id: CreationOptional<number>;
  declare ownerId: ForeignKey<User["id"]>;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare category: string;
  declare address: string;
  declare city: string;
  declare state: string;
  declare postalCode: string;
  declare latitude: number;
  declare longitude: number;
  declare phone: string | null;
  declare email: string | null;
  declare rating: CreationOptional<number>;
  declare reviewCount: CreationOptional<number>;
  declare isVerified: CreationOptional<boolean>;
  declare isOpen: CreationOptional<boolean>;
  declare openingHours: Record<string, unknown> | null;
  declare bannerUrl: string | null;
  declare logoUrl: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare owner?: NonAttribute<User>;
  declare products?: NonAttribute<Product[]>;
}

Shop.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
      get() {
        const val = this.getDataValue("latitude");
        return val ? Number(val) : 0;
      },
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
      get() {
        const val = this.getDataValue("longitude");
        return val ? Number(val) : 0;
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        const val = this.getDataValue("rating");
        return val ? Number(val) : 0;
      },
    },
    reviewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isOpen: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    openingHours: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    bannerUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    logoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
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
    tableName: "shops",
    timestamps: true,
  }
);
