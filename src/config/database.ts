import "dotenv/config";
import { Sequelize } from "sequelize";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from .env");
}

// Localhost connections (plain TCP) skip SSL; any remote host (RDS, Neon, etc.) uses SSL.
const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
const isNeon = databaseUrl.includes("neon.tech");

export const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 60000, // 60s timeout for acquiring a connection (prevents premature failures during Neon cold starts)
    idle: isNeon ? 300000 : 10000, // 5 mins for Neon to prevent constant teardown of pooled connections
  },
  dialectOptions: isLocal
    ? {
      connectTimeout: 5000,
    }
    : {
      connectTimeout: 30000, // 30s connection timeout for cold start resiliency
      keepAlive: true,
      keepAliveInitialDelay: 10000,
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
});