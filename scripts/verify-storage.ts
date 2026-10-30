import { storageService, type StorageConfigSummary } from "../src/core/storage/storage.service";
import assert from "assert";

async function runStorageVerification() {
  console.log("=================================================");
  console.log("   FindShopEasily Storage Verification Suite     ");
  console.log("   AWS S3 (Local/Dev) & Cloudflare R2 (Prod)     ");
  console.log("=================================================\n");

  const originalEnv = { ...process.env };

  try {
    // -------------------------------------------------------------
    // Test 1: Provider Resolution Based on Environment
    // -------------------------------------------------------------
    console.log("🧪 Test 1: Environment-Based Provider Resolution");

    process.env.STORAGE_PROVIDER = "s3";
    process.env.NODE_ENV = "development";
    storageService.resetClient();
    assert.strictEqual(storageService.getProvider(), "s3", "Explicit STORAGE_PROVIDER=s3 must resolve to s3");
    console.log("   ✔ Explicit STORAGE_PROVIDER=s3 resolved to 's3'");

    process.env.STORAGE_PROVIDER = "r2";
    process.env.NODE_ENV = "development";
    storageService.resetClient();
    assert.strictEqual(storageService.getProvider(), "r2", "Explicit STORAGE_PROVIDER=r2 must resolve to r2");
    console.log("   ✔ Explicit STORAGE_PROVIDER=r2 resolved to 'r2'");

    delete process.env.STORAGE_PROVIDER;
    process.env.NODE_ENV = "production";
    storageService.resetClient();
    assert.strictEqual(storageService.getProvider(), "r2", "Production environment must default to 'r2'");
    console.log("   ✔ NODE_ENV=production defaults to 'r2' when STORAGE_PROVIDER is omitted");

    process.env.NODE_ENV = "development";
    storageService.resetClient();
    assert.strictEqual(storageService.getProvider(), "s3", "Development environment must default to 's3'");
    console.log("   ✔ NODE_ENV=development defaults to 's3' when STORAGE_PROVIDER is omitted\n");

    // -------------------------------------------------------------
    // Test 2: URL Key Extraction (S3, R2, CDN, Plain)
    // -------------------------------------------------------------
    console.log("🧪 Test 2: Storage Key Extraction (Zero Path Leakage)");

    const testKeys = [
      {
        input: "shops/42/logo/173000000_shop_logo.webp",
        expected: "shops/42/logo/173000000_shop_logo.webp",
        label: "Plain storage key",
      },
      {
        input: "/shops/42/banner/173000000_shop_banner.webp",
        expected: "shops/42/banner/173000000_shop_banner.webp",
        label: "Relative path with leading slash",
      },
      {
        input: "https://media.findshopeasily.com/shops/42/products/101/173000000_photo.webp",
        expected: "shops/42/products/101/173000000_photo.webp",
        label: "Custom CDN domain URL",
      },
      {
        input: "https://findshop-dev-media-sagar.s3.ap-south-1.amazonaws.com/shops/42/logo/173000000_shop_logo.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA...",
        expected: "shops/42/logo/173000000_shop_logo.webp",
        label: "Presigned S3 URL with query parameters",
      },
      {
        input: "https://pub-mockhash80479ad04e8d356c80521ce20f.r2.dev/shops/42/banner/173000000_banner.webp#hash",
        expected: "shops/42/banner/173000000_banner.webp",
        label: "Cloudflare R2 dev URL with hash",
      },
    ];

    for (const tk of testKeys) {
      const extracted = storageService.extractKeyFromUrl(tk.input);
      assert.strictEqual(extracted, tk.expected, `Mismatch for ${tk.label}`);
      console.log(`   ✔ ${tk.label} -> "${extracted}"`);
    }
    console.log();

    // -------------------------------------------------------------
    // Test 3: AWS S3 Configuration & Presigned Upload URL Generation
    // -------------------------------------------------------------
    console.log("🧪 Test 3: AWS S3 Setup (Local & Development Environments)");

    // Use official AWS documentation test credentials or environment values
    const testAwsKeyId = originalEnv.AWS_ACCESS_KEY_ID || "AKIAIOSFODNN7EXAMPLE";
    const testAwsSecret = originalEnv.AWS_SECRET_ACCESS_KEY || "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

    process.env.STORAGE_PROVIDER = "s3";
    process.env.NODE_ENV = "development";
    process.env.AWS_REGION = originalEnv.AWS_REGION || "ap-south-1";
    process.env.AWS_S3_BUCKET = originalEnv.AWS_S3_BUCKET || "findshop-dev-media-sagar";
    process.env.AWS_ACCESS_KEY_ID = testAwsKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = testAwsSecret;
    process.env.MEDIA_CDN_URL = originalEnv.MEDIA_CDN_URL || "https://findshop-dev-media-sagar.s3.ap-south-1.amazonaws.com";
    storageService.resetClient();

    const s3Summary = storageService.getConfigSummary();
    assert.strictEqual(s3Summary.provider, "s3");
    assert.strictEqual(s3Summary.bucket, "findshop-dev-media-sagar");
    assert.strictEqual(s3Summary.region, "ap-south-1");
    assert.strictEqual(s3Summary.isConfigured, true);
    assert.ok(s3Summary.maskedAccessKeyId && s3Summary.maskedAccessKeyId.includes("..."), "Access key must be safely masked");
    console.log("   ✔ S3 Config Summary:", JSON.stringify(s3Summary, null, 2));

    // Generate S3 presigned upload URL
    const s3Presigned = await storageService.getPresignedUploadUrl({
      entityType: "product-image",
      shopId: 10,
      productId: 25,
      fileName: "organic_apples.jpg",
      contentType: "image/jpeg",
    });

    assert.ok(s3Presigned.uploadUrl.includes("X-Amz-Algorithm=AWS4-HMAC-SHA256"), "S3 upload URL must include AWS SigV4");
    assert.ok(s3Presigned.uploadUrl.includes("findshop-dev-media-sagar"), "Upload URL must target S3 bucket");
    assert.ok(s3Presigned.storageKey.startsWith("shops/10/products/25/"), "Storage key must follow hierarchy");
    assert.ok(s3Presigned.publicUrl.includes("shops/10/products/25/"), "Public URL must reflect storage key");
    console.log("   ✔ S3 Presigned URL generated successfully:");
    console.log("     - Key:", s3Presigned.storageKey);
    console.log("     - Public URL:", s3Presigned.publicUrl);
    console.log("     - Upload Host:", new URL(s3Presigned.uploadUrl).host);
    console.log();

    // -------------------------------------------------------------
    // Test 4: Cloudflare R2 Configuration & Presigned Upload URL Generation
    // -------------------------------------------------------------
    console.log("🧪 Test 4: Cloudflare R2 Setup (Production Environment)");

    const testR2AccountId = originalEnv.R2_ACCOUNT_ID || "demo_account_id_test_r2";
    const testR2AccessKey = originalEnv.R2_ACCESS_KEY_ID || "demo_r2_access_key_test";
    const testR2Secret = originalEnv.R2_SECRET_ACCESS_KEY || "demo_r2_secret_key_test_abcdef1234567890";

    process.env.STORAGE_PROVIDER = "r2";
    process.env.NODE_ENV = "production";
    process.env.R2_ACCOUNT_ID = testR2AccountId;
    process.env.R2_BUCKET = originalEnv.R2_BUCKET || "findshop-prod-media";
    process.env.R2_ACCESS_KEY_ID = testR2AccessKey;
    process.env.R2_SECRET_ACCESS_KEY = testR2Secret;
    process.env.MEDIA_CDN_URL = "https://media.findshopeasily.com";
    storageService.resetClient();

    const r2Summary = storageService.getConfigSummary();
    assert.strictEqual(r2Summary.provider, "r2");
    assert.strictEqual(r2Summary.bucket, "findshop-prod-media");
    assert.strictEqual(r2Summary.region, "auto", "Cloudflare R2 region must be 'auto'");
    assert.strictEqual(r2Summary.endpoint, `https://${testR2AccountId}.r2.cloudflarestorage.com`);
    assert.strictEqual(r2Summary.cdnUrl, "https://media.findshopeasily.com");
    assert.strictEqual(r2Summary.isConfigured, true);
    assert.ok(r2Summary.maskedAccessKeyId && r2Summary.maskedAccessKeyId.includes("..."), "R2 Access key must be safely masked");
    console.log("   ✔ Cloudflare R2 Config Summary:", JSON.stringify(r2Summary, null, 2));

    // Generate R2 presigned upload URL
    const r2Presigned = await storageService.getPresignedUploadUrl({
      entityType: "shop-banner",
      shopId: 88,
      fileName: "storefront_facade.png",
      contentType: "image/png",
    });

    assert.ok(r2Presigned.uploadUrl.includes("r2.cloudflarestorage.com"), "R2 upload URL must target Cloudflare R2 endpoint");
    assert.ok(r2Presigned.uploadUrl.includes("X-Amz-Algorithm=AWS4-HMAC-SHA256"), "R2 upload URL must use S3 SigV4");
    assert.ok(r2Presigned.storageKey.startsWith("shops/88/banner/"), "Storage key must follow hierarchy");
    assert.strictEqual(
      r2Presigned.publicUrl,
      `https://media.findshopeasily.com/${r2Presigned.storageKey}`,
      "Public URL must use custom production CDN domain"
    );
    console.log("   ✔ Cloudflare R2 Presigned URL generated successfully:");
    console.log("     - Key:", r2Presigned.storageKey);
    console.log("     - Public URL:", r2Presigned.publicUrl);
    console.log("     - Endpoint:", new URL(r2Presigned.uploadUrl).host);
    console.log();

    // -------------------------------------------------------------
    // Test 5: Credential Security Verification
    // -------------------------------------------------------------
    console.log("🧪 Test 5: Credential Security & Secret Protection");

    const s3SummaryStr = JSON.stringify(s3Summary);
    const r2SummaryStr = JSON.stringify(r2Summary);
    const s3PresignedStr = JSON.stringify(s3Presigned);
    const r2PresignedStr = JSON.stringify(r2Presigned);

    assert.ok(!s3SummaryStr.includes(testAwsSecret), "AWS secret access key must NEVER appear in config summary");
    assert.ok(!r2SummaryStr.includes(testR2Secret), "R2 secret access key must NEVER appear in config summary");
    assert.ok(!s3PresignedStr.includes(testAwsSecret), "AWS secret access key must NEVER appear in presigned URL response");
    assert.ok(!r2PresignedStr.includes(testR2Secret), "R2 secret access key must NEVER appear in presigned URL response");
    console.log("   ✔ Secret access keys are completely shielded from summaries and API responses.\n");

    // -------------------------------------------------------------
    // Test 6: Error Handling Verification
    // -------------------------------------------------------------
    console.log("🧪 Test 6: Error Handling (Missing Credentials & Invalid Inputs)");

    // Test missing R2 variables
    delete process.env.R2_SECRET_ACCESS_KEY;
    storageService.resetClient();
    try {
      storageService.getClient();
      assert.fail("Should have thrown error for missing R2 credentials");
    } catch (err: any) {
      assert.ok(err.message.includes("Missing Cloudflare R2 environment variables"));
      console.log("   ✔ Properly throws descriptive error on missing R2 credentials");
    }

    // Test invalid deletion key
    try {
      await storageService.deleteObject("");
      assert.fail("Should have thrown error for empty deletion key");
    } catch (err: any) {
      assert.ok(err.message.includes("Missing or invalid storage key"));
      console.log("   ✔ Properly rejects empty storage key on deletion");
    }

    console.log();
    console.log("=================================================");
    console.log("   🎉 All Storage Service Tests Passed 100%!     ");
    console.log("=================================================\n");
  } finally {
    // Restore original environment
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
    storageService.resetClient();
  }
}

runStorageVerification().catch((err) => {
  console.error("❌ Storage verification failed:", err);
  process.exit(1);
});
