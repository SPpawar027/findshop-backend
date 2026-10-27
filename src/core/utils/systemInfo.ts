import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { sequelize } from "../../config/database";

export interface DeploymentInfo {
  commit: string;
  commitMessage: string;
  branch: string;
  commitDate: string | null;
  commitAuthor: string | null;
  buildTime: string;
}

let cachedBuildInfo: DeploymentInfo | null = null;

export function getDeploymentInfo(): DeploymentInfo {
  if (cachedBuildInfo) {
    return cachedBuildInfo;
  }

  // 1. Try reading static generated build-info.json (fastest & works in production containers)
  const candidatePaths = [
    path.join(__dirname, "../../build-info.json"),
    path.join(__dirname, "../build-info.json"),
    path.join(process.cwd(), "dist", "build-info.json"),
    path.join(process.cwd(), "src", "build-info.json"),
    path.join(process.cwd(), "build-info.json"),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, "utf-8");
        cachedBuildInfo = JSON.parse(raw);
        return cachedBuildInfo!;
      } catch {
        // Fall through
      }
    }
  }

  // 2. Fallback: Query Git live (works in local dev & when .git directory is present)
  try {
    const commit = execSync("git rev-parse --short HEAD", {
      stdio: ["pipe", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      stdio: ["pipe", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const commitMessage = execSync("git log -1 --pretty=format:%s", {
      stdio: ["pipe", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const commitDate = execSync("git log -1 --pretty=format:%cI", {
      stdio: ["pipe", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const commitAuthor = execSync("git log -1 --pretty=format:%an", {
      stdio: ["pipe", "pipe", "ignore"],
    })
      .toString()
      .trim();

    return {
      commit,
      commitMessage,
      branch,
      commitDate,
      commitAuthor,
      buildTime: new Date().toISOString(),
    };
  } catch {
    return {
      commit: "unknown",
      commitMessage: "Git metadata unavailable",
      branch: "unknown",
      commitDate: null,
      commitAuthor: null,
      buildTime: new Date().toISOString(),
    };
  }
}

export function formatUptime(uptimeSeconds: number): string {
  const days = Math.floor(uptimeSeconds / (3600 * 24));
  const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export async function getSystemHealthAndInfo() {
  const deployment = getDeploymentInfo();
  const uptimeSeconds = Math.floor(process.uptime());
  const mem = process.memoryUsage();

  let dbStatus = "disconnected";
  let dbLatencyMs: number | null = null;
  try {
    const start = Date.now();
    await sequelize.authenticate();
    dbLatencyMs = Date.now() - start;
    dbStatus = "connected";
  } catch (err: any) {
    dbStatus = `error: ${err?.message || "unknown"}`;
  }

  return {
    success: true,
    service: "FindShopEasily Backend API",
    status: dbStatus === "connected" ? "healthy" : "degraded",
    environment: process.env.NODE_ENV || "development",
    serverTime: new Date().toISOString(),
    deployment,
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      dialect: "postgresql",
    },
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      processId: process.pid,
      uptimeSeconds,
      uptimeHuman: formatUptime(uptimeSeconds),
      memoryUsageMB: {
        rss: +(mem.rss / 1024 / 1024).toFixed(1),
        heapUsed: +(mem.heapUsed / 1024 / 1024).toFixed(1),
        heapTotal: +(mem.heapTotal / 1024 / 1024).toFixed(1),
      },
    },
  };
}
