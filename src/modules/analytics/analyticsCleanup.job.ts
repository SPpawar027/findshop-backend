import { analyticsService } from "./analytics.service";

/**
 * 7-Day Analytics Retention Scheduler.
 * Runs in the background to automatically purge raw events and daily unique visitor
 * logs older than 7 days, preventing database bloat while keeping all aggregated
 * shop_analytics_daily records intact permanently.
 */
export async function runAnalyticsRetentionCleanup(retentionDays = 7): Promise<void> {
  try {
    const result = await analyticsService.purgeOldAnalyticsData(retentionDays);
    console.log(
      `🧹 [Analytics Retention] Purged ${result.deletedEvents} raw events and ${result.deletedUniqueVisitors} unique visitor records older than ${result.retentionDays} days (cutoff: ${result.cutoffDate.toISOString()}).`
    );
  } catch (error) {
    console.error("❌ [Analytics Retention] Failed to run retention cleanup:", error);
  }
}

/**
 * Starts a 24-hour interval background scheduler for analytics retention cleanup.
 */
export function startAnalyticsCleanupScheduler(): NodeJS.Timeout {
  // Run once shortly after startup (after 30 seconds)
  setTimeout(() => {
    runAnalyticsRetentionCleanup(7).catch(() => {});
  }, 30 * 1000).unref();

  // Schedule recurring 24-hour cleanup
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const timer = setInterval(() => {
    runAnalyticsRetentionCleanup(7).catch(() => {});
  }, TWENTY_FOUR_HOURS_MS);

  timer.unref();
  return timer;
}

