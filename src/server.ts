import { createApp } from "./app";
import { sequelize } from "./database";
import { env } from "./config/env";
import { categoryService } from "./modules/categories/category.service";
import { startAnalyticsCleanupScheduler } from "./modules/analytics/analyticsCleanup.job";
import { neonHeartbeat } from "./config/neonHeartbeat";

async function startServer(): Promise<void> {
  try {
    const isLocal = env.DATABASE_URL.includes("localhost") || env.DATABASE_URL.includes("127.0.0.1");
    const isNeon = env.DATABASE_URL.includes("neon.tech");
    const dbLabel = isLocal ? "Local PostgreSQL (localhost)" : isNeon ? "Neon Postgres (Cloud Dev Serverless)" : "AWS RDS Cloud Database";
    console.log(`\n========================================`);
    console.log(` FindShopEasily Backend Starting...`);
    console.log(` Environment : [${env.NODE_ENV}]`);
    console.log(` Database Target: ${dbLabel}`);
    console.log(`========================================\n`);

    console.log("Connecting to PostgreSQL...");
    // Verify database connection with resilient retry for serverless cold start wake-up
    const maxRetries = 10;
    const retryDelays = [2000, 2500, 3000, 3500, 4000, 4500, 5000, 5000, 5000, 5000];
    let attempt = 0;
    const startConnectTime = Date.now();

    while (attempt < maxRetries) {
      try {
        await sequelize.authenticate();
        const elapsed = Date.now() - startConnectTime;
        console.log(`✅ PostgreSQL connection established successfully (${elapsed}ms).`);
        break;
      } catch (dbErr) {
        attempt += 1;
        if (attempt >= maxRetries) {
          throw dbErr;
        }
        const delay = retryDelays[attempt - 1] || 4000;
        const msg = (dbErr as Error).message;
        if (isNeon) {
          console.warn(`⏳ [Neon Serverless] Compute instance is waking up (attempt ${attempt}/${maxRetries}): ${msg}. Retrying in ${(delay / 1000).toFixed(1)}s...`);
        } else {
          console.warn(`⚠️ Database connection attempt ${attempt}/${maxRetries} failed: ${msg}. Retrying in ${(delay / 1000).toFixed(1)}s...`);
        }
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    // Start Neon keep-alive heartbeat in development/local to prevent 5-minute auto-sleep while working (NEVER in production)
    if (env.NODE_ENV !== "production") {
      neonHeartbeat.init(env.DATABASE_URL, env.NODE_ENV);
    }

    // Ensure User searchRadiusKm preference column exists in database
    await sequelize
      .query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "searchRadiusKm" INTEGER DEFAULT 10;`)
      .catch((err) => console.warn("Notice: users.searchRadiusKm column check:", (err as Error).message));

    // Ensure Category table and standard MVP 5-sector categories are seeded
    await categoryService.ensureDefaultCategories();

    // Start 7-day retention cleanup scheduler
    startAnalyticsCleanupScheduler();

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 FindShopEasily Backend running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
      console.log(`📡 Health Check URL: http://localhost:${env.PORT}/api/health\n`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      neonHeartbeat.stop();
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