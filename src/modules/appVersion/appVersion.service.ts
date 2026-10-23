import { AppVersionConfig, UpdatePolicyType } from "./appVersion.model";

export interface UpdateCheckResult {
  hasUpdate: boolean;
  updateType: UpdatePolicyType;
  clientVersion: string;
  currentVersion: string;
  minimumVersion: string;
  title: string;
  message: string;
  releaseNotes: string[];
  storeUrl: string;
  isMaintenance: boolean;
  maintenanceMessage?: string | null;
  enabled: boolean;
}

// Compare semantic version numbers (e.g., "1.2.3" vs "1.3.0")
// Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
export function compareSemver(v1: string, v2: string): number {
  const cleanV1 = (v1 || "0.0.0").replace(/^v/i, "").trim();
  const cleanV2 = (v2 || "0.0.0").replace(/^v/i, "").trim();

  const parts1 = cleanV1.split(".").map((p) => parseInt(p, 10) || 0);
  const parts2 = cleanV2.split(".").map((p) => parseInt(p, 10) || 0);

  const length = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < length; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

const DEFAULT_CONFIGS: Record<string, Partial<AppVersionConfig>> = {
  android: {
    id: "android",
    platform: "android",
    currentVersion: "1.0.1",
    minimumVersion: "1.0.0",
    updateType: "normal",
    title: "Exciting New Features Are Here!",
    message: "FindShopEasily has been updated with real-time distance calculations, faster product search, and exclusive store deals.",
    releaseNotes: JSON.stringify([
      "Nearby stores discovery sorted by live walking distance",
      "Instant store calling and GPS directions",
      "Diwali festival discounts and walk-in sales",
      "Smooth performance optimizations",
    ]),
    storeUrl: "https://play.google.com/store/apps/details?id=com.findshopeasily",
    isMaintenance: false,
    enabled: true,
  },
  ios: {
    id: "ios",
    platform: "ios",
    currentVersion: "1.0.1",
    minimumVersion: "1.0.0",
    updateType: "normal",
    title: "Exciting New Features Are Here!",
    message: "A fresh update for FindShopEasily is ready on the App Store.",
    releaseNotes: JSON.stringify([
      "Enhanced local store discovery",
      "Store reviews and photo galleries",
      "Stability improvements",
    ]),
    storeUrl: "https://apps.apple.com/app/id6470000000",
    isMaintenance: false,
    enabled: true,
  },
};

export class AppVersionService {
  /**
   * Ensures default config row exists in database
   */
  async getOrCreateConfig(platform: string): Promise<AppVersionConfig> {
    const normPlatform = (platform || "android").toLowerCase();
    try {
      let config = await AppVersionConfig.findByPk(normPlatform);
      if (!config) {
        const defaults = DEFAULT_CONFIGS[normPlatform] || DEFAULT_CONFIGS.android;
        config = await AppVersionConfig.create(defaults as any);
      }
      return config;
    } catch (err) {
      // Auto-sync table if not yet present in PostgreSQL schema
      await AppVersionConfig.sync();
      let config = await AppVersionConfig.findByPk(normPlatform);
      if (!config) {
        const defaults = DEFAULT_CONFIGS[normPlatform] || DEFAULT_CONFIGS.android;
        config = await AppVersionConfig.create(defaults as any);
      }
      return config;
    }
  }

  /**
   * Evaluates if client version requires Force, Normal, or Just Update
   */
  async checkUpdate(
    platform: string = "android",
    clientVersion: string = "1.0.0"
  ): Promise<UpdateCheckResult> {
    const config = await this.getOrCreateConfig(platform);

    let parsedNotes: string[] = [];
    try {
      parsedNotes = JSON.parse(config.releaseNotes);
      if (!Array.isArray(parsedNotes)) {
        parsedNotes = [config.releaseNotes];
      }
    } catch {
      parsedNotes = config.releaseNotes ? config.releaseNotes.split("\n").filter(Boolean) : [];
    }

    // 1. Maintenance Mode Check
    if (config.isMaintenance) {
      return {
        hasUpdate: true,
        updateType: "force",
        clientVersion,
        currentVersion: config.currentVersion,
        minimumVersion: config.minimumVersion,
        title: "System Maintenance Underway",
        message: config.maintenanceMessage || "FindShopEasily is currently undergoing scheduled maintenance. Please check back shortly.",
        releaseNotes: [],
        storeUrl: config.storeUrl,
        isMaintenance: true,
        maintenanceMessage: config.maintenanceMessage,
        enabled: config.enabled,
      };
    }

    // 2. Disabled check
    if (!config.enabled) {
      return {
        hasUpdate: false,
        updateType: "none",
        clientVersion,
        currentVersion: config.currentVersion,
        minimumVersion: config.minimumVersion,
        title: config.title,
        message: config.message,
        releaseNotes: parsedNotes,
        storeUrl: config.storeUrl,
        isMaintenance: false,
        enabled: false,
      };
    }

    // Compare client version against minimumVersion and currentVersion
    const cmpMinimum = compareSemver(clientVersion, config.minimumVersion);
    const cmpCurrent = compareSemver(clientVersion, config.currentVersion);

    // Case A: Below Minimum Version -> FORCE UPDATE (Mandatory, non-dismissible)
    if (cmpMinimum < 0 || config.updateType === "force") {
      return {
        hasUpdate: true,
        updateType: "force",
        clientVersion,
        currentVersion: config.currentVersion,
        minimumVersion: config.minimumVersion,
        title: config.title || "Critical Update Required",
        message: config.message || "Your current app version is no longer supported. Please update to continue using FindShopEasily.",
        releaseNotes: parsedNotes,
        storeUrl: config.storeUrl,
        isMaintenance: false,
        enabled: true,
      };
    }

    // Case B: Below Current Version -> Check updateType setting
    if (cmpCurrent < 0) {
      const effectiveType: UpdatePolicyType =
        config.updateType === "none" ? "normal" : config.updateType;

      return {
        hasUpdate: true,
        updateType: effectiveType, // 'normal' or 'just_update'
        clientVersion,
        currentVersion: config.currentVersion,
        minimumVersion: config.minimumVersion,
        title: config.title,
        message: config.message,
        releaseNotes: parsedNotes,
        storeUrl: config.storeUrl,
        isMaintenance: false,
        enabled: true,
      };
    }

    // Case C: Explicit 'just_update' or 'normal' override for all users (e.g., feature announcement)
    if (config.updateType === "just_update") {
      return {
        hasUpdate: true,
        updateType: "just_update",
        clientVersion,
        currentVersion: config.currentVersion,
        minimumVersion: config.minimumVersion,
        title: config.title,
        message: config.message,
        releaseNotes: parsedNotes,
        storeUrl: config.storeUrl,
        isMaintenance: false,
        enabled: true,
      };
    }

    // Case D: App is up to date
    return {
      hasUpdate: false,
      updateType: "none",
      clientVersion,
      currentVersion: config.currentVersion,
      minimumVersion: config.minimumVersion,
      title: config.title,
      message: config.message,
      releaseNotes: parsedNotes,
      storeUrl: config.storeUrl,
      isMaintenance: false,
      enabled: true,
    };
  }

  async getAll(): Promise<AppVersionConfig[]> {
    const android = await this.getOrCreateConfig("android");
    const ios = await this.getOrCreateConfig("ios");
    return [android, ios];
  }

  async updateConfig(
    platform: string,
    data: Partial<AppVersionConfig>
  ): Promise<AppVersionConfig> {
    const config = await this.getOrCreateConfig(platform);
    
    // Ensure releaseNotes is serialized string if array passed
    let releaseNotesValue = data.releaseNotes;
    if (Array.isArray(releaseNotesValue)) {
      releaseNotesValue = JSON.stringify(releaseNotesValue);
    }

    await config.update({
      ...data,
      releaseNotes: releaseNotesValue !== undefined ? releaseNotesValue : config.releaseNotes,
    });

    return config;
  }
}

export const appVersionService = new AppVersionService();
