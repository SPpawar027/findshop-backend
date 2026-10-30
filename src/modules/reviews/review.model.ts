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
import type { Shop } from "../shops/shop.model";
import type { Product } from "../products/product.model";

export type ReviewTargetType = "SHOP" | "PRODUCT";
export type ReviewStatus = "PUBLISHED" | "HIDDEN";

export class Review extends Model<
  InferAttributes<Review, { omit: "user" | "shop" | "product" | "reportedByShop" }>,
  InferCreationAttributes<Review, { omit: "user" | "shop" | "product" | "reportedByShop" }>
> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<User["id"]>;
  declare shopId: ForeignKey<Shop["id"]>;
  declare productId: ForeignKey<Product["id"]> | null;
  declare targetType: CreationOptional<ReviewTargetType>;
  declare rating: number; // 1 to 5
  declare title: string | null;
  declare comment: string;
  declare authorName: string | null;
  declare merchantReply: string | null;
  declare merchantRepliedAt: Date | null;
  declare isReported: CreationOptional<boolean>;
  declare reportReason: string | null;
  declare reportedByShopId: ForeignKey<Shop["id"]> | null;
  declare reportedAt: Date | null;
  declare status: CreationOptional<ReviewStatus>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare user?: NonAttribute<User>;
  declare shop?: NonAttribute<Shop>;
  declare product?: NonAttribute<Product>;
  declare reportedByShop?: NonAttribute<Shop>;
}

Review.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    shopId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "shops",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "products",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    targetType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "SHOP",
    },
    rating: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    authorName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    merchantReply: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    merchantRepliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isReported: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    reportReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reportedByShopId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "shops",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    reportedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PUBLISHED",
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
    tableName: "reviews",
    timestamps: true,
  }
);
