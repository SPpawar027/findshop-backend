import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestError } from "../errors/AppError";

export type ImageEntityType = "shop-banner" | "shop-logo" | "product-image";
export type StorageProvider = "s3" | "r2";

export interface PresignedUrlRequest {
  entityType: ImageEntityType;
  shopId: number;
  productId?: number;
  fileName: string;
  contentType: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
}

export interface StorageConfigSummary {
  provider: StorageProvider;
  bucket: string;
  region: string;
  endpoint?: string;
  cdnUrl: string | null;
  isConfigured: boolean;
  maskedAccessKeyId: string | null;
}

/**
 * Masks sensitive access keys (e.g. AKIAIOSFODNN7EXAMPLE -> AKIA...MPLE)
 * Secret keys are NEVER stored or returned.
 */
function maskKey(key?: string | null): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "********";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

class StorageService {
  private client: S3Client | null = null;
  private bucket: string = "";

  /**
   * Resolves active storage provider based on environment variables:
   * 1. Explicit `STORAGE_PROVIDER` ("s3" | "r2")
   * 2. Fallback based on `NODE_ENV`:
   *    - "production" -> "r2" (Cloudflare R2 with zero egress fees)
   *    - "development" / "local" / default -> "s3" (AWS S3)
   */
  public getProvider(): StorageProvider {
    const raw = (process.env.STORAGE_PROVIDER || "").toLowerCase().trim();
    if (raw === "r2" || raw === "cloudflare") {
      return "r2";
    }
    if (raw === "s3" || raw === "aws") {
      return "s3";
    }
    return process.env.NODE_ENV === "production" ? "r2" : "s3";
  }

  /**
   * Lazily instantiates and caches the S3Client instance.
   * Both AWS S3 and Cloudflare R2 utilize the standard S3 API protocol.
   */
  public getClient(): S3Client {
    if (this.client) return this.client;

    const provider = this.getProvider();

    if (provider === "r2") {
      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      this.bucket = process.env.R2_BUCKET || "findshop-prod-media";

      if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error(
          "Missing Cloudflare R2 environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY are required for R2 storage"
        );
      }

      this.client = new S3Client({
        region: "auto", // Cloudflare R2 requires region: "auto"
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      // AWS S3 for local development and development environments
      const region = process.env.AWS_REGION || "ap-south-1";
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      this.bucket = process.env.AWS_S3_BUCKET || "findshop-dev-media-sagar";

      this.client = new S3Client({
        region,
        credentials:
          accessKeyId && secretAccessKey
            ? { accessKeyId, secretAccessKey }
            : undefined, // Allows IAM Instance Profiles on EC2/ECS when env vars are omitted
      });
    }

    return this.client;
  }

  /**
   * Resets cached S3 client and bucket.
   * Useful when switching environments or executing test suites.
   */
  public resetClient(): void {
    this.client = null;
    this.bucket = "";
  }

  /**
   * Extracts clean storage key from a plain key or full URL.
   * Handles:
   * - Plain keys: "shops/1/logo/123.webp" -> "shops/1/logo/123.webp"
   * - Relative paths: "/shops/1/logo/123.webp" -> "shops/1/logo/123.webp"
   * - CDN URLs: "https://media.findshopeasily.com/shops/1/logo/123.webp" -> "shops/1/logo/123.webp"
   * - S3 URLs: "https://bucket.s3.ap-south-1.amazonaws.com/shops/1/logo/123.webp" -> "shops/1/logo/123.webp"
   * - R2 URLs: "https://pub-xyz.r2.dev/shops/1/logo/123.webp" -> "shops/1/logo/123.webp"
   * - Presigned / query URLs: strips query strings (?X-Amz-...) and hash fragments
   */
  public extractKeyFromUrl(keyOrUrl: string): string {
    if (!keyOrUrl || typeof keyOrUrl !== "string") {
      return "";
    }

    let clean = keyOrUrl.trim();
    // Strip query parameters and hash fragments
    clean = clean.split("?")[0].split("#")[0];

    // If it's a full HTTP/HTTPS URL
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      try {
        const url = new URL(clean);
        let pathname = decodeURIComponent(url.pathname);
        pathname = pathname.replace(/^\/+/, "");

        // Path-style S3 URL: https://s3.region.amazonaws.com/bucket/key
        const currentBucket = this.bucket || process.env.AWS_S3_BUCKET || process.env.R2_BUCKET || "";
        if (currentBucket && pathname.startsWith(`${currentBucket}/`)) {
          pathname = pathname.slice(currentBucket.length + 1);
        }

        return pathname;
      } catch {
        clean = clean.replace(/^https?:\/\/[^\/]+\//, "");
      }
    }

    return decodeURIComponent(clean.replace(/^\/+/, ""));
  }

  /**
   * Resolves canonical public image URL for a given storage key.
   * Uses MEDIA_CDN_URL if configured, otherwise falls back to provider default URL.
   */
  public getPublicUrl(keyOrUrl: string): string {
    if (!keyOrUrl) return "";
    if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
      return keyOrUrl;
    }

    const cleanKey = this.extractKeyFromUrl(keyOrUrl);
    const cdnBase = (process.env.MEDIA_CDN_URL || "").replace(/\/+$/, "");

    if (cdnBase) {
      return `${cdnBase}/${cleanKey}`;
    }

    const provider = this.getProvider();
    if (provider === "r2") {
      const accountId = process.env.R2_ACCOUNT_ID;
      const bucket = process.env.R2_BUCKET || "findshop-prod-media";
      if (accountId) {
        return `https://${bucket}.${accountId}.r2.cloudflarestorage.com/${cleanKey}`;
      }
      return `/${cleanKey}`;
    } else {
      const region = process.env.AWS_REGION || "ap-south-1";
      const bucket = process.env.AWS_S3_BUCKET || "findshop-dev-media-sagar";
      return `https://${bucket}.s3.${region}.amazonaws.com/${cleanKey}`;
    }
  }

  /**
   * Generates a clean, hierarchical storage key:
   * - shops/{shopId}/banner/{timestamp}_{cleanedFileName}
   * - shops/{shopId}/logo/{timestamp}_{cleanedFileName}
   * - shops/{shopId}/products/{productId}/{timestamp}_{cleanedFileName}
   */
  public generateKey(params: PresignedUrlRequest): string {
    const timestamp = Date.now();
    const cleanFileName = params.fileName.replace(/[^a-zA-Z0-9.-]/g, "_").toLowerCase();

    switch (params.entityType) {
      case "shop-banner":
        return `shops/${params.shopId}/banner/${timestamp}_${cleanFileName}`;
      case "shop-logo":
        return `shops/${params.shopId}/logo/${timestamp}_${cleanFileName}`;
      case "product-image":
        if (!params.productId) {
          return `shops/${params.shopId}/products/temp/${timestamp}_${cleanFileName}`;
        }
        return `shops/${params.shopId}/products/${params.productId}/${timestamp}_${cleanFileName}`;
      default:
        throw new BadRequestError("Invalid entityType for image upload");
    }
  }

  /**
   * Generates a Presigned PUT URL allowing clients (mobile app, shop admin)
   * to upload binary image directly to AWS S3 or Cloudflare R2.
   *
   * SigV4 presigned URLs are standard across both AWS S3 and Cloudflare R2.
   */
  public async getPresignedUploadUrl(params: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    const s3 = this.getClient();
    const storageKey = this.generateKey(params);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: params.contentType,
    });

    // Valid for 10 minutes (600 seconds)
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
    const publicUrl = this.getPublicUrl(storageKey);

    return {
      uploadUrl,
      storageKey,
      publicUrl,
    };
  }

  /**
   * Uploads a Buffer directly from the server.
   * Useful for internal batch tasks, system assets, or server-side optimizations.
   */
  public async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const s3 = this.getClient();
    const cleanKey = this.extractKeyFromUrl(key);

    await s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return this.getPublicUrl(cleanKey);
  }

  /**
   * Deletes an object from the storage bucket.
   * Accepts either a storage key or a full URL.
   * Deletion in S3/R2 is idempotent (deleting a missing key succeeds or returns 404).
   */
  public async deleteObject(keyOrUrl: string): Promise<boolean> {
    const key = this.extractKeyFromUrl(keyOrUrl);
    if (!key) {
      throw new BadRequestError("Missing or invalid storage key for deletion");
    }

    const s3 = this.getClient();
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch (error: any) {
      // If object already does not exist, consider idempotent success
      if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
        return true;
      }
      console.error(`Storage deletion failed for [${key}]:`, error?.message || error);
      throw error;
    }
  }

  /**
   * Batch deletes multiple objects safely.
   */
  public async deleteObjects(keysOrUrls: string[]): Promise<{ deleted: string[]; errors: string[] }> {
    const deleted: string[] = [];
    const errors: string[] = [];

    for (const item of keysOrUrls) {
      try {
        await this.deleteObject(item);
        deleted.push(this.extractKeyFromUrl(item));
      } catch (err: any) {
        errors.push(`${this.extractKeyFromUrl(item)}: ${err?.message || "Delete error"}`);
      }
    }

    return { deleted, errors };
  }

  /**
   * Moves an object within the storage bucket (e.g. from temp to permanent folder).
   * Works identically on AWS S3 and Cloudflare R2 using CopyObject + DeleteObject.
   */
  public async moveObject(sourceKey: string, destinationKey: string): Promise<string> {
    const s3 = this.getClient();
    const cleanSource = this.extractKeyFromUrl(sourceKey);
    const cleanDest = this.extractKeyFromUrl(destinationKey);

    // S3 & R2 CopySource requires bucket/key
    const copySource = `${this.bucket}/${encodeURI(cleanSource)}`;

    await s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: copySource,
        Key: cleanDest,
      })
    );

    // Delete the source temporary object
    await s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: cleanSource,
      })
    );

    return cleanDest;
  }

  /**
   * Returns a sanitized storage configuration summary.
   * Completely safe for health checks and status endpoints (secret keys are NEVER exposed).
   */
  public getConfigSummary(): StorageConfigSummary {
    const provider = this.getProvider();
    const cdnUrl = process.env.MEDIA_CDN_URL || null;

    if (provider === "r2") {
      const accountId = process.env.R2_ACCOUNT_ID || "";
      const bucket = process.env.R2_BUCKET || "findshop-prod-media";
      const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
      const hasSecret = Boolean(process.env.R2_SECRET_ACCESS_KEY);
      const isConfigured = Boolean(accountId && accessKeyId && hasSecret);

      return {
        provider: "r2",
        bucket,
        region: "auto",
        endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
        cdnUrl,
        isConfigured,
        maskedAccessKeyId: maskKey(accessKeyId),
      };
    } else {
      const region = process.env.AWS_REGION || "ap-south-1";
      const bucket = process.env.AWS_S3_BUCKET || "findshop-dev-media-sagar";
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "";
      const hasSecret = Boolean(process.env.AWS_SECRET_ACCESS_KEY);
      const isConfigured = Boolean((accessKeyId && hasSecret) || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI);

      return {
        provider: "s3",
        bucket,
        region,
        endpoint: `https://${bucket}.s3.${region}.amazonaws.com`,
        cdnUrl,
        isConfigured,
        maskedAccessKeyId: maskKey(accessKeyId),
      };
    }
  }
}

export const storageService = new StorageService();
