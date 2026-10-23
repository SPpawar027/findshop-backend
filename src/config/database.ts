import "dotenv/config";
import { Sequelize } from "sequelize";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from .env");
}

const isLocal = !databaseUrl.includes("rds.amazonaws.com") && databaseUrl.includes("localhost");

export const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 10000,
    idle: 10000,
  },
  dialectOptions: isLocal
    ? {
        connectTimeout: 5000,
      }
    : {
        connectTimeout: 5000,
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
});