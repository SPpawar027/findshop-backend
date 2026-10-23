import { sequelize } from "../config/database";
import { User } from "../modules/users/user.model";
import { Shop } from "../modules/shops/shop.model";
import { Product } from "../modules/products/product.model";
import { LegalDocument } from "../modules/legal/legal.model";
import { AppVersionConfig } from "../modules/appVersion/appVersion.model";
import { setupAssociations } from "./associations";

// Initialize associations
setupAssociations();

export { sequelize, User, Shop, Product, LegalDocument, AppVersionConfig };
