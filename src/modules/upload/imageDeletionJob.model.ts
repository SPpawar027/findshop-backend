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

export type DeletionJobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";
export type DeletionEntityType = "shop" | "product";

export class ImageDeletionJob extends Model<
  InferAttributes<ImageDeletionJob>,
  InferCreationAttributes<ImageDeletionJob>
> {
  declare id: CreationOptional<number>;
  declare objectKey: string;
  declare entityType: DeletionEntityType;
  declare entityId: number;
  declare requestedByUserId: ForeignKey<User["id"]> | null;
  declare status: CreationOptional<DeletionJobStatus>;
  declare retryCount: CreationOptional<number>;
  declare errorMessage: CreationOptional<string | null>;
  declare requestedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ImageDeletionJob.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    objectKey: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: "object_key",
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
    requestedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "requested_by_user_id",
      references: {
        model: "users",
        key: "id",
      },
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "pending",
      field: "status",
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "retry_count",
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "error_message",
    },
    requestedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: "requested_at",
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "deleted_at",
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
    tableName: "image_deletion_jobs",
    timestamps: true,
    underscored: true,
  }
);
