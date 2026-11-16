import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables with hierarchy:
// 1. .env.{NODE_ENV}.local
// 2. .env.{NODE_ENV}
// 3. .env.local
// 4. .env
const nodeEnv = process.env.NODE_ENV || "development";
const envCandidates = [
  path.resolve(process.cwd(), `.env.${nodeEnv}.local`),
  path.resolve(process.cwd(), `.env.${nodeEnv}`),
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
];

for (const envFile of envCandidates) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 4000),
  DATABASE_URL: process.env.DATABASE_URL as string,
  isDev: (process.env.NODE_ENV || "development") === "development",
  isProd: process.env.NODE_ENV === "production",
};
