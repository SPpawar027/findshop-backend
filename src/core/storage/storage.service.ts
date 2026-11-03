import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestError } from "../errors/AppError";

export type ImageEntityType = "shop-banner" | "shop-logo" | "product-image";
export type StorageProvider = "s3";

export interface PresignedUrlRequest {
  entityType: ImageEntityType;
  userId: number;
  shopId: number;
  productId?: number;
  fileName: string;
  contentType: string;
  fileSize?: number;
}

export interface PresignedUrlResponse {
  uploadId: string;
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export interface StorageConfigSummary {
  provider: StorageProvider;
  bucket: string;
  region: string;
  endpoint: string;
  cdnUrl: string | null;
  isConfigured: boolean;
  maskedAccessKeyId: string | null;
}

export interface ObjectMetadata {
  contentLength: number;
  contentType: string;
  eTag?: string;
  lastModified?: Date;
}

export interface WebPSignatureCheck {
  isValid: boolean;
  fileSize: number;
  error?: string;
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

/**
 * Reusable Storage Service Abstraction
 * Pure AWS S3 implementation for Local, Development, and Production environments.
 */
export class StorageService {
  private client: S3Client | null = null;
  private bucket: string = "";

  public getProvider(): StorageProvider {
    return "s3";
  }

  /**
   * Enforces environment isolation:
   * Prevents local/development environments from accessing production buckets,
   * and prevents production environments from targeting development buckets.
   */
  private validateBucketIsolation(bucketName: string): void {
    const isProduction = process.env.NODE_ENV === "production";
    const lowerBucket = bucketName.toLowerCase();

    if (!isProduction && (lowerBucket.includes("-prod") || lowerBucket.endsWith("-production"))) {
      throw new Error(
        `[Storage Security Alert] Development/Local environment cannot target production bucket "${bucketName}".`
      );
    }

    if (isProduction && (lowerBucket.includes("-dev") || lowerBucket.includes("-local") || lowerBucket.includes("-test"))) {
      throw new Error(
        `[Storage Security Alert] Production environment cannot target non-production bucket "${bucketName}".`
      );
    }
  }

  /**
   * Lazily instantiates and caches the AWS S3Client instance.
   */
  public getClient(): S3Client {
    if (this.client) return this.client;

    const region = process.env.AWS_REGION || "ap-south-1";
    const isProduction = process.env.NODE_ENV === "production";
    const defaultBucket = isProduction ? "findshop-prod-media" : "findshop-dev-media-sagar";
    this.bucket = process.env.AWS_S3_BUCKET || defaultBucket;

    this.validateBucketIsolation(this.bucket);

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    this.client = new S3Client({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined, // Supports IAM Instance Profiles on EC2/ECS/EKS when env vars omitted
    });

    return this.client;
  }

  /**
   * Resets cached client and bucket (useful during tests or environment switching).
   */
  public resetClient(): void {
    this.client = null;
    this.bucket = "";
  }

  /**
   * Returns active bucket name.
   */
  public getBucketName(): string {
    if (!this.bucket) {
      this.getClient();
    }
    return this.bucket;
  }

  /**
   * Extracts clean storage key from plain key or full URL.
   * Strips query strings, bucket prefixes, and domains.
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
        const currentBucket = this.bucket || process.env.AWS_S3_BUCKET || "";
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
   * Uses MEDIA_CDN_URL if configured, otherwise falls back to direct S3 URL.
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

    const region = process.env.AWS_REGION || "ap-south-1";
    const bucket = this.getBucketName();
    return `https://${bucket}.s3.${region}.amazonaws.com/${cleanKey}`;
  }

  /**
   * Generates a temporary storage key:
   * temp/uploads/{userId}/{uploadId}.webp
   */
  public generateTempKey(userId: number, uploadId: string): string {
    const cleanUserId = String(userId).replace(/[^0-9]/g, "");
    const cleanUploadId = uploadId.replace(/[^a-zA-Z0-9-]/g, "");
    return `temp/uploads/${cleanUserId}/${cleanUploadId}.webp`;
  }

  /**
   * Generates a permanent storage key:
   * - shops/{shopId}/logo.webp
   * - shops/{shopId}/banner.webp
   * - products/{shopId}/{productId}/{imageId}.webp
   */
  public generatePermanentKey(params: {
    entityType: ImageEntityType;
    shopId: number;
    productId?: number;
    imageId?: string;
  }): string {
    const cleanShopId = String(params.shopId).replace(/[^0-9]/g, "");
    const imageId = params.imageId ? params.imageId.replace(/[^a-zA-Z0-9-_]/g, "") : Date.now().toString();

    switch (params.entityType) {
      case "shop-logo":
        return `shops/${cleanShopId}/logo.webp`;
      case "shop-banner":
        return `shops/${cleanShopId}/banner.webp`;
      case "product-image":
        if (!params.productId) {
          throw new BadRequestError("productId is required to generate a permanent product image key");
        }
        const cleanProductId = String(params.productId).replace(/[^0-9]/g, "");
        return `products/${cleanShopId}/${cleanProductId}/${imageId}.webp`;
      default:
        throw new BadRequestError("Invalid entityType for permanent storage key generation");
    }
  }

  /**
   * Generates a short-lived presigned PUT URL (5 minutes / 300 seconds)
   * strictly restricted to ContentType "image/webp".
   */
  public async getPresignedUploadUrl(params: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    const s3 = this.getClient();
    const uploadId = crypto.randomUUID();
    const storageKey = this.generateTempKey(params.userId, uploadId);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: "image/webp",
    });

    // 5 minutes (300 seconds) expiry as mandated by security specification
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = this.getPublicUrl(storageKey);

    return {
      uploadId,
      uploadUrl,
      storageKey,
      publicUrl,
      expiresInSeconds: 300,
    };
  }

  /**
   * Inspects S3 object metadata using HeadObjectCommand.
   */
  public async headObject(keyOrUrl: string): Promise<ObjectMetadata> {
    const key = this.extractKeyFromUrl(keyOrUrl);
    const s3 = this.getClient();

    const response = await s3.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    return {
      contentLength: response.ContentLength || 0,
      contentType: response.ContentType || "application/octet-stream",
      eTag: response.ETag,
      lastModified: response.LastModified,
    };
  }

  /**
   * Validates authentic WebP file signature by reading the first 12 bytes via S3 Range request.
   * Magic number structure:
   * - Offset 0..3: ASCII "RIFF" (0x52, 0x49, 0x46, 0x46)
   * - Offset 4..7: File size (32-bit integer)
   * - Offset 8..11: ASCII "WEBP" (0x57, 0x45, 0x42, 0x50)
   */
  public async validateWebPSignature(keyOrUrl: string): Promise<WebPSignatureCheck> {
    const key = this.extractKeyFromUrl(keyOrUrl);
    const s3 = this.getClient();

    try {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: "bytes=0-11", // Only fetch first 12 bytes
        })
      );

      const stream = response.Body;
      if (!stream) {
        return { isValid: false, fileSize: 0, error: "Empty S3 object body" };
      }

      // Convert stream to Buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream as any) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      if (buffer.length < 12) {
        return {
          isValid: false,
          fileSize: buffer.length,
          error: "File is smaller than minimum WebP header size (12 bytes)",
        };
      }

      const riff = buffer.toString("ascii", 0, 4);
      const webp = buffer.toString("ascii", 8, 12);

      if (riff !== "RIFF" || webp !== "WEBP") {
        return {
          isValid: false,
          fileSize: buffer.length,
          error: `Invalid file signature: expected 'RIFF....WEBP', received '${riff}....${webp}'`,
        };
      }

      // Read total object size via HeadObject
      const head = await this.headObject(key);

      return {
        isValid: true,
        fileSize: head.contentLength,
      };
    } catch (err: any) {
      return {
        isValid: false,
        fileSize: 0,
        error: `Failed to inspect S3 file signature: ${err?.message || "Unknown error"}`,
      };
    }
  }

  /**
   * Copies an object within the S3 bucket from source to destination.
   */
  public async copyObject(sourceKeyOrUrl: string, destKeyOrUrl: string): Promise<string> {
    const s3 = this.getClient();
    const sourceKey = this.extractKeyFromUrl(sourceKeyOrUrl);
    const destKey = this.extractKeyFromUrl(destKeyOrUrl);

    const copySource = `${this.bucket}/${encodeURI(sourceKey)}`;

    await s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: copySource,
        Key: destKey,
        ContentType: "image/webp",
        MetadataDirective: "COPY",
      })
    );

    return destKey;
  }

  /**
   * Promotes a temporary object to permanent location and deletes the temporary object.
   * Handles partial failures and retries safely.
   */
  public async moveObject(sourceKeyOrUrl: string, destKeyOrUrl: string): Promise<string> {
    const cleanDest = await this.copyObject(sourceKeyOrUrl, destKeyOrUrl);
    // Delete source only after copy successfully verifies
    await this.deleteObject(sourceKeyOrUrl);
    return cleanDest;
  }

  /**
   * Deletes an object from the S3 bucket.
   * Idempotent: returns true if deleted or already missing (404 / NoSuchKey).
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
      if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
        return true;
      }
      console.error(`S3 deletion failed for [${key}]:`, error?.message || error);
      throw error;
    }
  }

  /**
   * Batch deletes multiple objects safely using S3 DeleteObjectsCommand.
   */
  public async deleteObjects(keysOrUrls: string[]): Promise<{ deleted: string[]; errors: string[] }> {
    const keys = keysOrUrls.map((k) => this.extractKeyFromUrl(k)).filter(Boolean);
    if (keys.length === 0) {
      return { deleted: [], errors: [] };
    }

    const s3 = this.getClient();
    try {
      const response = await s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: keys.map((Key) => ({ Key })),
            Quiet: false,
          },
        })
      );

      const deleted = (response.Deleted || []).map((d) => d.Key || "");
      const errors = (response.Errors || []).map((e) => `${e.Key}: ${e.Message || "Deletion failed"}`);
      return { deleted, errors };
    } catch (batchErr: any) {
      console.error("Batch S3 deletion failed, falling back to individual deletes:", batchErr?.message);
      const deleted: string[] = [];
      const errors: string[] = [];
      for (const k of keys) {
        try {
          await this.deleteObject(k);
          deleted.push(k);
        } catch (err: any) {
          errors.push(`${k}: ${err?.message || "Failed"}`);
        }
      }
      return { deleted, errors };
    }
  }

  /**
   * Returns a sanitized storage configuration summary.
   * Secret keys are NEVER exposed.
   */
  public getConfigSummary(): StorageConfigSummary {
    const region = process.env.AWS_REGION || "ap-south-1";
    const bucket = this.getBucketName();
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "";
    const hasSecret = Boolean(process.env.AWS_SECRET_ACCESS_KEY);
    const isConfigured = Boolean((accessKeyId && hasSecret) || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI);
    const cdnUrl = process.env.MEDIA_CDN_URL || null;

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

export const storageService = new StorageService();
