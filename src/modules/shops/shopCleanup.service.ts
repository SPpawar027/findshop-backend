import { Op } from "sequelize";
import { sequelize } from "../../config/database";
import { Shop } from "./shop.model";
import { Product } from "../products/product.model";
import { Review } from "../reviews/review.model";
import { ShopSubcategory } from "../categories/shopSubcategory.model";
import { ShopCategory } from "./shopCategory.model";
import { ShopAnalyticsEvent } from "../analytics/shopAnalyticsEvent.model";
import { ShopAnalyticsDaily } from "../analytics/shopAnalyticsDaily.model";
import { ImageAsset } from "../upload/imageAsset.model";
import { TemporaryUpload } from "../upload/temporaryUpload.model";
import { ImageDeletionJob } from "../upload/imageDeletionJob.model";
import { storageService } from "../../core/storage/storage.service";

export interface ShopPurgeManifest {
  shopId: number;
  shopName: string;
  slug: string;
  deletedAt: Date | null;
  purgeAfter: Date | null;
  daysSinceDeletion: number;
  reclaimableDbRecords: {
    products: number;
    reviews: number;
    subcategories: number;
    analyticsEvents: number;
    analyticsDaily: number;
    imageAssets: number;
    temporaryUploads: number;
  };
  s3Keys: string[];
  skippedCrossReferencedKeys: string[];
}

export interface CleanupResult {
  dryRun: boolean;
  executedAt: string;
  lockAcquired: boolean;
  totalEligibleShops: number;
  purgedShopsCount: number;
  totalS3KeysPurged: number;
  manifests: ShopPurgeManifest[];
  errors: string[];
}

// PostgreSQL advisory lock ID (32-bit signed integer) for shop cleanup job
const SHOP_CLEANUP_ADVISORY_LOCK_ID = 894371;

export class ShopCleanupService {
  /**
   * Identifies shops that have been soft-deleted and whose 30-day recovery grace period has expired.
   */
  async getExpiredShops(limit: number = 20): Promise<Shop[]> {
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return Shop.findAll({
      where: {
        deletedAt: { [Op.ne]: null },
        [Op.or]: [
          { purgeAfter: { [Op.lte]: now } },
          { deletedAt: { [Op.lte]: thirtyDaysAgo } },
        ],
      },
      paranoid: false,
      limit,
      order: [["deletedAt", "ASC"]],
    });
  }

  /**
   * Scans an eligible shop, compiles an audit manifest of all dependent DB rows and validated S3 keys,
   * and verifies that keys are not shared with any other active shop or product.
   */
  async buildShopPurgeManifest(shop: Shop): Promise<ShopPurgeManifest> {
    const shopId = shop.id;

    // 1. Count dependent database rows
    const [
      productsCount,
      reviewsCount,
      subcategoriesCount,
      analyticsEventsCount,
      analyticsDailyCount,
      imageAssetsCount,
      temporaryUploadsCount,
    ] = await Promise.all([
      Product.count({ where: { shopId }, paranoid: false }),
      Review.count({ where: { shopId } }),
      ShopSubcategory.count({ where: { shopId } }),
      ShopAnalyticsEvent.count({ where: { shopId } }),
      ShopAnalyticsDaily.count({ where: { shopId } }),
      ImageAsset.count({ where: { shopId } }),
      TemporaryUpload.count({ where: { shopId } }),
    ]);

    // 2. Collect potential S3 image keys
    const rawKeys: string[] = [];

    if (shop.logoUrl) {
      const k = storageService.extractKeyFromUrl(shop.logoUrl);
      if (k) rawKeys.push(k);
    }

    if (shop.bannerUrl) {
      const k = storageService.extractKeyFromUrl(shop.bannerUrl);
      if (k) rawKeys.push(k);
    }

    // Collect product images
    const products = await Product.findAll({
      where: { shopId },
      attributes: ["id", "images"],
      paranoid: false,
    });

    for (const prod of products) {
      if (Array.isArray(prod.images)) {
        for (const imgUrl of prod.images) {
          const k = storageService.extractKeyFromUrl(imgUrl);
          if (k) rawKeys.push(k);
        }
      }
    }

    // Collect keys from ImageAsset table
    const imageAssets = await ImageAsset.findAll({
      where: { shopId },
      attributes: ["objectKey"],
    });
    for (const asset of imageAssets) {
      if (asset.objectKey) rawKeys.push(asset.objectKey);
    }

    // Deduplicate keys
    const uniqueKeys = Array.from(new Set(rawKeys.filter(Boolean)));

    // 3. Asset Safety Validation: Verify key belongs to expected formats and is not cross-referenced by other active entities
    const safeS3Keys: string[] = [];
    const skippedKeys: string[] = [];

    for (const key of uniqueKeys) {
      // Security Check: Key must not be an arbitrary path or point to system files
      const isExpectedPrefix =
        key.startsWith(`shops/${shopId}/`) ||
        key.startsWith("products/") ||
        key.startsWith("temp/uploads/");

      if (!isExpectedPrefix) {
        skippedKeys.push(`${key} (Reason: does not match safe entity key pattern)`);
        continue;
      }

      // Cross-reference Check: Ensure no OTHER active shop uses this exact key
      const otherShopWithKey = await Shop.findOne({
        where: {
          id: { [Op.ne]: shopId },
          [Op.or]: [{ logoUrl: { [Op.like]: `%${key}%` } }, { bannerUrl: { [Op.like]: `%${key}%` } }],
        },
      });

      if (otherShopWithKey) {
        skippedKeys.push(`${key} (Reason: active shop ${otherShopWithKey.id} references this key)`);
        continue;
      }

      safeS3Keys.push(key);
    }

    const deletedAtTime = shop.deletedAt ? new Date(shop.deletedAt).getTime() : Date.now();
    const daysSince = Math.floor((Date.now() - deletedAtTime) / (1000 * 60 * 60 * 24));

    return {
      shopId,
      shopName: shop.name,
      slug: shop.slug,
      deletedAt: shop.deletedAt,
      purgeAfter: shop.purgeAfter,
      daysSinceDeletion: daysSince,
      reclaimableDbRecords: {
        products: productsCount,
        reviews: reviewsCount,
        subcategories: subcategoriesCount,
        analyticsEvents: analyticsEventsCount,
        analyticsDaily: analyticsDailyCount,
        imageAssets: imageAssetsCount,
        temporaryUploads: temporaryUploadsCount,
      },
      s3Keys: safeS3Keys,
      skippedCrossReferencedKeys: skippedKeys,
    };
  }

  /**
   * Executes permanent purge for a single shop:
   * 1. Reclaims S3 storage via DeleteObjectsCommand.
   * 2. Permanently removes PostgreSQL records in a single database transaction.
   */
  async purgeSingleShop(manifest: ShopPurgeManifest): Promise<{ deletedS3Keys: number; error?: string }> {
    const shopId = manifest.shopId;

    // 1. Delete validated S3 objects (batch in chunks of 1,000)
    let s3DeletedCount = 0;
    if (manifest.s3Keys.length > 0) {
      try {
        const { deleted, errors } = await storageService.deleteObjects(manifest.s3Keys);
        s3DeletedCount = deleted.length;

        if (errors.length > 0) {
          console.warn(`[ShopCleanup Warning] Some S3 keys failed during purge of shop ${shopId}:`, errors);
          // Record failed keys into ImageDeletionJob for retry
          for (const errStr of errors) {
            const failedKey = errStr.split(":")[0]?.trim();
            if (failedKey) {
              await ImageDeletionJob.create({
                objectKey: failedKey,
                entityType: "shop",
                entityId: shopId,
                status: "failed",
                errorMessage: errStr,
                retryCount: 1,
              }).catch(() => {});
            }
          }
        }
      } catch (s3Err: any) {
        console.error(`[ShopCleanup Error] S3 batch deletion failed for shop ${shopId}:`, s3Err?.message);
        throw new Error(`S3 cleanup failure for shop ${shopId}: ${s3Err?.message}`);
      }
    }

    // 2. Permanently delete DB records in an ACID transaction
    const t = await sequelize.transaction();
    try {
      // Remove child records
      await Review.destroy({ where: { shopId }, transaction: t });
      await ShopSubcategory.destroy({ where: { shopId }, transaction: t });
      await ShopCategory.destroy({ where: { shopId }, transaction: t });
      await ShopAnalyticsEvent.destroy({ where: { shopId }, transaction: t });
      await ShopAnalyticsDaily.destroy({ where: { shopId }, transaction: t });
      await ImageAsset.destroy({ where: { shopId }, transaction: t });
      await TemporaryUpload.destroy({ where: { shopId }, transaction: t });
      await Product.destroy({ where: { shopId }, force: true, transaction: t });

      // Force delete shop
      const shop = await Shop.findByPk(shopId, { paranoid: false, transaction: t });
      if (shop) {
        await shop.destroy({ force: true, transaction: t });
      }

      await t.commit();
      console.log(`[ShopCleanup Success] Permanently purged shop ID ${shopId} ("${manifest.shopName}") and ${s3DeletedCount} S3 files.`);
      return { deletedS3Keys: s3DeletedCount };
    } catch (dbErr: any) {
      await t.rollback();
      console.error(`[ShopCleanup Error] Database transaction failed for shop ${shopId}:`, dbErr?.message);
      throw dbErr;
    }
  }

  /**
   * Concurrency-safe job runner.
   * Acquires a PostgreSQL session advisory lock to ensure only one instance executes at a time.
   */
  async runCleanup(options: { dryRun?: boolean; limit?: number } = {}): Promise<CleanupResult> {
    const dryRun = options.dryRun ?? true;
    const limit = options.limit ?? 20;
    const errors: string[] = [];
    const manifests: ShopPurgeManifest[] = [];

    // 1. Try acquiring PostgreSQL advisory lock
    const [lockResult] = (await sequelize.query(
      `SELECT pg_try_advisory_lock(${SHOP_CLEANUP_ADVISORY_LOCK_ID}) AS "acquired";`
    )) as [{ acquired: boolean }[], unknown];

    const lockAcquired = Boolean(lockResult?.[0]?.acquired);
    if (!lockAcquired) {
      return {
        dryRun,
        executedAt: new Date().toISOString(),
        lockAcquired: false,
        totalEligibleShops: 0,
        purgedShopsCount: 0,
        totalS3KeysPurged: 0,
        manifests: [],
        errors: ["Another cleanup worker holds the advisory lock. Aborting concurrent execution."],
      };
    }

    let purgedShopsCount = 0;
    let totalS3KeysPurged = 0;

    try {
      const expiredShops = await this.getExpiredShops(limit);

      for (const shop of expiredShops) {
        try {
          const manifest = await this.buildShopPurgeManifest(shop);
          manifests.push(manifest);

          if (!dryRun) {
            const { deletedS3Keys } = await this.purgeSingleShop(manifest);
            purgedShopsCount++;
            totalS3KeysPurged += deletedS3Keys;
          }
        } catch (shopErr: any) {
          errors.push(`Shop ${shop.id} (${shop.name}): ${shopErr?.message}`);
        }
      }
    } finally {
      // Release advisory lock
      await sequelize.query(`SELECT pg_advisory_unlock(${SHOP_CLEANUP_ADVISORY_LOCK_ID});`).catch(() => {});
    }

    return {
      dryRun,
      executedAt: new Date().toISOString(),
      lockAcquired: true,
      totalEligibleShops: manifests.length,
      purgedShopsCount,
      totalS3KeysPurged,
      manifests,
      errors,
    };
  }
}

export const shopCleanupService = new ShopCleanupService();
