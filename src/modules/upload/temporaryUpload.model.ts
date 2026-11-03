import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../../config/database";
import type { User } from "../users/user.model";
import type { Shop } from "../shops/shop.model";
import type { Product } from "../products/product.model";

export type TemporaryUploadStatus =
  | "pending"
  | "uploaded"
  | "attached"
  | "expired"
  | "failed"
  | "deletion_pending"
  | "deleted";

export type IntendedUsage = "shop_logo" | "shop_banner" | "product_image";

export class TemporaryUpload extends Model<
  InferAttributes<TemporaryUpload>,
  InferCreationAttributes<TemporaryUpload>
> {
  declare id: string; // UUID
  declare userId: ForeignKey<User["id"]>;
  declare shopId: ForeignKey<Shop["id"]> | null;
  declare productId: ForeignKey<Product["id"]> | null;
  declare objectKey: string;
  declare originalName: string | null;
  declare mimeType: CreationOptional<string>;
  declare fileSize: CreationOptional<number>;
  declare uploadStatus: CreationOptional<TemporaryUploadStatus>;
  declare intendedUsage: IntendedUsage;
  declare expiresAt: Date;
  declare attachedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

TemporaryUpload.init(
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
      references: {
        model: "users",
        key: "id",
      },
    },
    shopId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "shop_id",
      references: {
        model: "shops",
        key: "id",
      },
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
    objectKey: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
      field: "object_key",
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "original_name",
    },
    mimeType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "image/webp",
      field: "mime_type",
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      field: "file_size",
      get() {
        const val = this.getDataValue("fileSize");
        return val ? Number(val) : 0;
      },
    },
    uploadStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "pending",
      field: "upload_status",
    },
    intendedUsage: {
      type: DataTypes.STRING(30),
      allowNull: false,
      field: "intended_usage",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },
    attachedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "attached_at",
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
  },
  {
    sequelize,
    tableName: "temporary_uploads",
    timestamps: true,
    underscored: true,
  }
);
