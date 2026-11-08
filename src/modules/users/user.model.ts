import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
} from "sequelize";
import { sequelize } from "../../config/database";
import type { Shop } from "../shops/shop.model";

export type UserRole = "super_admin" | "shop_admin" | "customer";
export type AuthProvider = "local" | "google";

export class User extends Model<
  InferAttributes<User, { omit: "shops" }>,
  InferCreationAttributes<User, { omit: "shops" }>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare email: string;
  declare passwordHash: string | null;
  declare phone: string | null;
  declare role: CreationOptional<UserRole>;
  declare isActive: CreationOptional<boolean>;
  declare searchRadiusKm: CreationOptional<number>;
  declare googleId: CreationOptional<string | null>;
  declare avatarUrl: CreationOptional<string | null>;
  declare authProvider: CreationOptional<AuthProvider>;
  declare isEmailVerified: CreationOptional<boolean>;
  declare emailVerificationOtp: CreationOptional<string | null>;
  declare emailVerificationOtpExpires: CreationOptional<Date | null>;
  declare passwordResetOtp: CreationOptional<string | null>;
  declare passwordResetOtpExpires: CreationOptional<Date | null>;
  declare resetPasswordToken: string | null;
  declare resetPasswordExpires: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare shops?: NonAttribute<Shop[]>;
}

User.init(
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
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM("super_admin", "shop_admin", "customer"),
      allowNull: false,
      defaultValue: "customer",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    searchRadiusKm: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      validate: {
        min: 1,
        max: 80,
      },
    },
    googleId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    avatarUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    authProvider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "local",
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    emailVerificationOtp: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    emailVerificationOtpExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    passwordResetOtp: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    passwordResetOtpExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    resetPasswordToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
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
    tableName: "users",
    timestamps: true,
  }
);
