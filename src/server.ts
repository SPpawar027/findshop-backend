import { createApp } from "./app";
import { sequelize } from "./database";
import { env } from "./config/env";
import { categoryService } from "./modules/categories/category.service";

async function startServer(): Promise<void> {
  try {
    const isLocal = env.DATABASE_URL.includes("localhost") || env.DATABASE_URL.includes("127.0.0.1");
    const isNeon = env.DATABASE_URL.includes("neon.tech");
    const dbLabel = isLocal ? "Local PostgreSQL (localhost)" : isNeon ? "Neon Postgres (Cloud Dev)" : "AWS RDS Cloud Database";
    console.log(`\n========================================`);
    console.log(` FindShopEasily Backend Starting...`);
    console.log(` Environment : [${env.NODE_ENV}]`);
    console.log(` Database Target: ${dbLabel}`);
    console.log(`========================================\n`);

    console.log("Connecting to PostgreSQL...");
    // Verify database connection with automatic retry for serverless wake-up
    const maxRetries = 5;
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        await sequelize.authenticate();
        console.log("✅ PostgreSQL connection established successfully.");
        break;
      } catch (dbErr) {
        attempt += 1;
        if (attempt >= maxRetries) {
          throw dbErr;
        }
        console.warn(`⚠️ PostgreSQL connection attempt ${attempt}/${maxRetries} failed: ${(dbErr as Error).message}. Retrying in 2.5s (waking serverless compute)...`);
        await new Promise((res) => setTimeout(res, 2500));
      }
    }

    // Ensure User searchRadiusKm preference column exists in database
    await sequelize
      .query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "searchRadiusKm" INTEGER DEFAULT 10;`)
      .catch((err) => console.warn("Notice: users.searchRadiusKm column check:", (err as Error).message));

    // Ensure Category table and standard MVP 5-sector categories are seeded
    await categoryService.ensureDefaultCategories();

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 FindShopEasily Backend running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
      console.log(`📡 Health Check URL: http://localhost:${env.PORT}/api/health\n`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await sequelize.close();
        console.log("Database connection closed. Exiting process.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    console.error("\n❌ Unable to start backend server!");
    console.error("Error Details:", error);
    process.exitCode = 1;
  }
}

void startServer();