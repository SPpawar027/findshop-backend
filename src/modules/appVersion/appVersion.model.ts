import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "../../config/database";

export type UpdatePolicyType = "none" | "normal" | "force" | "just_update";

export class AppVersionConfig extends Model<
  InferAttributes<AppVersionConfig>,
  InferCreationAttributes<AppVersionConfig>
> {
  declare id: string; // 'android' | 'ios'
  declare platform: string;
  declare currentVersion: string;
  declare minimumVersion: string;
  declare updateType: UpdatePolicyType;
  declare title: string;
  declare message: string;
  declare releaseNotes: string; // JSON array or multiline string
  declare storeUrl: string;
  declare isMaintenance: CreationOptional<boolean>;
  declare maintenanceMessage: CreationOptional<string | null>;
  declare enabled: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

AppVersionConfig.init(
  {
    id: {
      type: DataTypes.STRING(32),
      primaryKey: true,
      allowNull: false,
    },
    platform: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "android",
    },
    currentVersion: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "1.0.0",
    },
    minimumVersion: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "1.0.0",
    },
    updateType: {
      type: DataTypes.ENUM("none", "normal", "force", "just_update"),
      allowNull: false,
      defaultValue: "none",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "New Version Available",
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "A new version of FindShopEasily is available with latest features and performance enhancements.",
    },
    releaseNotes: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: JSON.stringify([
        "Discover nearby local stores with real-time distance",
        "Faster product search and price comparison",
        "Bug fixes and speed enhancements",
      ]),
    },
    storeUrl: {
      type: DataTypes.STRING(512),
      allowNull: false,
      defaultValue: "https://play.google.com/store/apps/details?id=com.findshopeasily",
    },
    isMaintenance: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    maintenanceMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "FindShopEasily is temporarily undergoing scheduled maintenance. Please check back shortly.",
    },
    enabled: {
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
    tableName: "app_version_configs",
    timestamps: true,
  }
);
