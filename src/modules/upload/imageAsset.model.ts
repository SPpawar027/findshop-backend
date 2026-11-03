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

export type ImageAssetRole = "logo" | "banner" | "product_gallery";
export type ImageAssetStatus = "active" | "archived" | "deleted";

export class ImageAsset extends Model<
  InferAttributes<ImageAsset>,
  InferCreationAttributes<ImageAsset>
> {
  declare id: CreationOptional<number>;
  declare entityType: "shop" | "product";
  declare entityId: number;
  declare shopId: ForeignKey<Shop["id"]>;
  declare objectKey: string;
  declare mimeType: CreationOptional<string>;
  declare fileSize: CreationOptional<number>;
  declare imageRole: ImageAssetRole;
  declare sortOrder: CreationOptional<number>;
  declare status: CreationOptional<ImageAssetStatus>;
  declare createdByUserId: ForeignKey<User["id"]> | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ImageAsset.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    entityType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "entity_type",
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "entity_id",
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
    objectKey: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
      field: "object_key",
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
    imageRole: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "image_role",
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "active",
      field: "status",
    },
    createdByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "created_by_user_id",
      references: {
        model: "users",
        key: "id",
      },
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
    tableName: "image_assets",
    timestamps: true,
    underscored: true,
  }
);
