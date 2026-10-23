import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "../../config/database";

export class LegalDocument extends Model<
  InferAttributes<LegalDocument>,
  InferCreationAttributes<LegalDocument>
> {
  declare id: string; // 'privacy-policy' | 'terms-and-conditions'
  declare title: string;
  declare content: string;
  declare version: CreationOptional<string>;
  declare lastUpdatedBy: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

LegalDocument.init(
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    version: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "1.0.0",
    },
    lastUpdatedBy: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "Super Admin",
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
    tableName: "legal_documents",
    timestamps: true,
  }
);
