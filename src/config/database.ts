import "dotenv/config";
import { Sequelize } from "sequelize";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from .env");
}

const isLocal = !databaseUrl.includes("rds.amazonaws.com") && databaseUrl.includes("localhost");

export const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  dialectOptions: isLocal
    ? {}
    : {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
});