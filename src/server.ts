import { createApp } from "./app";
import { sequelize } from "./database";
import { env } from "./config/env";

async function startServer(): Promise<void> {
  try {
    // Verify database connection and models
    await sequelize.authenticate();
    console.log("PostgreSQL connection established successfully.");

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      console.log(`FindShopEasily Backend running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await sequelize.close();
        console.log("Database connection closed. Exiting process.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    console.error("Unable to start backend:", error);
    process.exitCode = 1;
  }
}

void startServer();