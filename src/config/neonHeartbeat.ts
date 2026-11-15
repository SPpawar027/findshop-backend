import { sequelize } from "./database";

/**
 * Neon Serverless PostgreSQL Keep-Alive Heartbeat
 *
 * Neon Free Tier automatically suspends compute endpoints after 5 minutes of inactivity (scale-to-zero).
 * Waking up a suspended instance causes a 3-10 second cold start delay or DNS/network timeouts.
 *
 * This service runs a lightweight query (`SELECT 1;`) every 4 minutes while the development
 * backend is running, keeping Neon compute warm and responsive for instant query responses.
 *
 * Safety features:
 * 1. Automatic Inactivity Pause: If no HTTP requests or database activity occur for 45 minutes,
 *    the heartbeat pauses automatically to prevent burning through monthly free tier compute hours.
 * 2. Auto-Resume: Any incoming HTTP request automatically wakes up and resumes the heartbeat.
 * 3. Graceful Exit: Automatically stops when the server process shuts down.
 */
class NeonHeartbeatService {
  private timer: NodeJS.Timeout | null = null;
  private lastActivity: number = Date.now();
  private isEnabled: boolean = false;
  private isPaused: boolean = false;
  private readonly PING_INTERVAL_MS = 240 * 1000; // 4 minutes (Neon sleep threshold is 5 mins)
  private readonly INACTIVITY_THRESHOLD_MS = 45 * 60 * 1000; // 45 minutes

  /**
   * Initializes the heartbeat.
   * STRICT GUARD: NEVER runs in production (strictly restricted to development and local environments).
   */
  public init(databaseUrl: string, nodeEnv: string = process.env.NODE_ENV || "development"): void {
    // 1. Strict production block: Never run keep-alive heartbeat in production
    const isProd = nodeEnv === "production" || process.env.NODE_ENV === "production";
    if (isProd) {
      this.isEnabled = false;
      return;
    }

    // 2. Only active when using Neon Serverless Postgres in local/dev
    const isNeon = databaseUrl.includes("neon.tech");
    if (!isNeon) {
      this.isEnabled = false;
      return;
    }

    this.isEnabled = true;
    console.log(`💓 [Neon Heartbeat] Enabled for [${nodeEnv}] (Auto-ping every 4m to prevent cold starts while dev server is active).`);

    this.timer = setInterval(() => {
      void this.ping();
    }, this.PING_INTERVAL_MS);

    // Unref so this timer never prevents Node from exiting if needed
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public recordActivity(): void {
    if (!this.isEnabled) return;
    this.lastActivity = Date.now();
    if (this.isPaused) {
      this.isPaused = false;
      console.log("💓 [Neon Heartbeat] Real user activity detected! Resumed keep-alive ping.");
    }
  }

  public getStatus(): { isEnabled: boolean; isPaused: boolean; idleSeconds: number } {
    return {
      isEnabled: this.isEnabled,
      isPaused: this.isPaused,
      idleSeconds: Math.round((Date.now() - this.lastActivity) / 1000),
    };
  }

  private async ping(): Promise<void> {
    if (!this.isEnabled || this.isPaused) return;

    // Check if developer has been away from the machine for > 45 minutes
    const idleTime = Date.now() - this.lastActivity;
    if (idleTime > this.INACTIVITY_THRESHOLD_MS) {
      this.isPaused = true;
      console.log("💤 [Neon Heartbeat] Dev server idle for 45m. Paused keep-alive to conserve Neon free tier compute hours.");
      return;
    }

    try {
      await sequelize.query("SELECT 1;");
    } catch (err) {
      console.warn("⚠️ [Neon Heartbeat] Keep-alive ping failed:", (err as Error).message);
    }
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isEnabled = false;
  }
}

export const neonHeartbeat = new NeonHeartbeatService();
