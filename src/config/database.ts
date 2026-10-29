import "dotenv/config";
import { Sequelize } from "sequelize";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from .env");
}

// Localhost connections (plain TCP) skip SSL; any remote host (RDS, Neon, etc.) uses SSL.
const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");

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