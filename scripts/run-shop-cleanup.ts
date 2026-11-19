import dotenv from "dotenv";
import path from "path";

// Load appropriate environment file
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import { shopCleanupService } from "../src/modules/shops/shopCleanup.service";
import { sequelize } from "../src/config/database";

async function main() {
  const args = process.argv.slice(2);
  const isForce = args.includes("--force") || args.includes("--execute");
  const isDryRun = !isForce || args.includes("--dry-run");

  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 20;

  console.log("================================================================================");
  console.log("             FINDSHOEASILY — SHOP & ASSET CLEANUP PURGE RUNNER                  ");
  console.log("================================================================================");
  console.log(` Mode:              ${isDryRun ? "DRY-RUN (Safe mode: scan and report only)" : "LIVE PURGE (Permanent deletion!)"}`);
  console.log(` Batch Limit:       ${limit} shops`);
  console.log(` Timestamp:         ${new Date().toISOString()}`);
  console.log(` Database:          ${process.env.DB_NAME || "PostgreSQL"}`);
  console.log("================================================================================\n");

  try {
    await sequelize.authenticate();
    console.log(" Connected to database successfully.\n");

    const result = await shopCleanupService.runCleanup({ dryRun: isDryRun, limit });

    if (!result.lockAcquired) {
      console.warn(" [LOCKED] Another cleanup worker is already running. Advisory lock not acquired. Exiting safely.");
      process.exit(0);
    }

    console.log(`Found ${result.totalEligibleShops} shop(s) eligible for permanent purge.\n`);

    if (result.manifests.length === 0) {
      console.log(" No expired shops pending purge. Everything is clean!\n");
      process.exit(0);
    }

    for (const manifest of result.manifests) {
      console.log(`--- Shop ID ${manifest.shopId}: "${manifest.shopName}" (${manifest.slug}) ---`);
      console.log(`    Deleted At:             ${manifest.deletedAt}`);
      console.log(`    Purge After:            ${manifest.purgeAfter}`);
      console.log(`    Days in Soft-Delete:    ${manifest.daysSinceDeletion} days`);
      console.log(`    Dependent Records:`);
      console.log(`      - Products:           ${manifest.reclaimableDbRecords.products}`);
      console.log(`      - Reviews:            ${manifest.reclaimableDbRecords.reviews}`);
      console.log(`      - Subcategories:      ${manifest.reclaimableDbRecords.subcategories}`);
      console.log(`      - Analytics Events:   ${manifest.reclaimableDbRecords.analyticsEvents}`);
      console.log(`      - Analytics Daily:    ${manifest.reclaimableDbRecords.analyticsDaily}`);
      console.log(`      - Image Assets:       ${manifest.reclaimableDbRecords.imageAssets}`);
      console.log(`    Validated S3 Keys (${manifest.s3Keys.length}):`);
      manifest.s3Keys.forEach((k) => console.log(`      • ${k}`));
      if (manifest.skippedCrossReferencedKeys.length > 0) {
        console.log(`    Protected Keys (${manifest.skippedCrossReferencedKeys.length} skipped):`);
        manifest.skippedCrossReferencedKeys.forEach((k) => console.log(`      ⚠ ${k}`));
      }
      console.log("");
    }

    if (isDryRun) {
      console.log("================================================================================");
      console.log(" DRY RUN COMPLETE: 0 database rows deleted, 0 S3 files deleted.");
      console.log(" To permanently purge these expired shops, re-run with: --force");
      console.log("================================================================================");
    } else {
      console.log("================================================================================");
      console.log(` PURGE COMPLETED:`);
      console.log(`   - Shops permanently deleted:  ${result.purgedShopsCount}`);
      console.log(`   - S3 objects deleted:         ${result.totalS3KeysPurged}`);
      if (result.errors.length > 0) {
        console.log(`   - Errors encountered:       ${result.errors.length}`);
        result.errors.forEach((e) => console.error(`     ❌ ${e}`));
      }
      console.log("================================================================================");
    }
  } catch (err: any) {
    console.error(" Fatal error during cleanup runner:", err?.message || err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main();
}
