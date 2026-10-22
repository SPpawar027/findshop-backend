import { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestError } from "../errors/AppError";

export type ImageEntityType = "shop-banner" | "shop-logo" | "product-image";

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

class StorageService {
  private client: S3Client | null = null;
  private bucket: string = "";

  private getClient(): S3Client {
    if (this.client) return this.client;

    const provider = process.env.STORAGE_PROVIDER || (process.env.NODE_ENV === "production" ? "r2" : "s3");

    if (provider === "r2") {
      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      this.bucket = process.env.R2_BUCKET || "findshop-media";

      if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error("Missing Cloudflare R2 environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
      }

      this.client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      // AWS S3
      const region = process.env.AWS_REGION || "ap-south-1";
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      this.bucket = process.env.AWS_S3_BUCKET || "findshop-dev-media";

      this.client = new S3Client({
        region,
        credentials:
          accessKeyId && secretAccessKey
            ? { accessKeyId, secretAccessKey }
            : undefined, // Uses EC2 IAM role if credentials not explicitly set in env
      });
    }

    return this.client;
  }

  /**
   * Generates a clean, hierarchical storage key:
   * - shops/{shopId}/banner/{timestamp}_{cleanedFileName}
   * - shops/{shopId}/logo/{timestamp}_{cleanedFileName}
   * - shops/{shopId}/products/{productId}/{timestamp}_{cleanedFileName}
   */
  generateKey(params: PresignedUrlRequest): string {
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
   * to upload binary image directly to S3 or Cloudflare R2.
   */
  async getPresignedUploadUrl(params: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    const s3 = this.getClient();
    const storageKey = this.generateKey(params);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: params.contentType,
    });

    // Valid for 10 minutes
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

    const cdnBase = (process.env.MEDIA_CDN_URL || "").replace(/\/+$/, "");
    const publicUrl = cdnBase ? `${cdnBase}/${storageKey}` : `/${storageKey}`;

    return {
      uploadUrl,
      storageKey,
      publicUrl,
    };
  }

  /**
   * Moves an object within the storage bucket (e.g. from temp to permanent folder)
   */
  async moveObject(sourceKey: string, destinationKey: string): Promise<string> {
    const s3 = this.getClient();
    const cleanSource = sourceKey.replace(/^\/+/, "");
    const cleanDest = destinationKey.replace(/^\/+/, "");

    // S3 CopySource requires bucket/key
    const copySource = `${this.bucket}/${encodeURI(cleanSource)}`;

    await s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: copySource,
        Key: cleanDest,
      })
    );

    // Delete the source temp object
    await s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: cleanSource,
      })
    );

    return cleanDest;
  }
}

export const storageService = new StorageService();
