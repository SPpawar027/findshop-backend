import * as Sentry from "@sentry/node";
import "dotenv/config";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || "development",
        // Tracing: Prod me 20% requests trace karega (quota bachane ke liye)
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    });
    console.log("🛡️ Sentry Error Monitoring initialized.");
} else {
    console.log("ℹ️ Sentry DSN not provided. Error tracking disabled.");
}

export { Sentry };