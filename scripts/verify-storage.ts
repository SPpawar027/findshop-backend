import { storageService, type StorageConfigSummary } from "../src/core/storage/storage.service";
import assert from "assert";

async function runStorageVerification() {
  console.log("=================================================");
  console.log("   FindShopEasily Secure S3 Verification Suite   ");
  console.log("   AWS S3 (Local / Dev / Prod Multi-Tier)       ");
  console.log("=================================================\n");

  const originalEnv = { ...process.env };

  try {
    // -------------------------------------------------------------
    // Test 1: Provider Resolution (Pure AWS S3 across all envs)
    // -------------------------------------------------------------
    console.log("🧪 Test 1: Pure AWS S3 Provider Resolution");

    process.env.STORAGE_PROVIDER = "s3";
    process.env.NODE_ENV = "development";
    storageService.resetClient();
    assert.strictEqual(storageService.getProvider(), "s3", "Explicit STORAGE_PROVIDER=s3 must resolve to s3");
    console.log("   ✔ Explicit STORAGE_PROVIDER=s3 resolved to 's3'");

    process.env.NODE_ENV = "production";
    storageService.resetClient();
    assert.strictEqual(storageService.getProvider(), "s3", "Production environment must resolve to 's3'");
    console.log("   ✔ NODE_ENV=production resolves to 's3'");

    process.env.NODE_ENV = "development";
    delete process.env.STORAGE_PROVIDER;
    storageService.resetClient();
    assert.strictEqual(storageService.getProvider(), "s3", "Default environment resolves to 's3'");
    console.log("   ✔ Default environment resolves to 's3'\n");

    // -------------------------------------------------------------
    // Test 2: Environment Bucket Isolation Guard
    // -------------------------------------------------------------
    console.log("🧪 Test 2: Environment Bucket Isolation Guard");

    // Attempting to use a prod bucket in development must throw an error
    process.env.NODE_ENV = "development";
    process.env.AWS_S3_BUCKET = "findshop-prod-media";
    storageService.resetClient();
    assert.throws(
      () => {
        storageService.getClient();
      },
      /Development\/Local environment cannot target production bucket/,
      "Dev environment must block targeting a production bucket"
    );
    console.log("   ✔ Development environment successfully blocks targeting production bucket");

    // Attempting to use a dev bucket in production must throw an error
    process.env.NODE_ENV = "production";
    process.env.AWS_S3_BUCKET = "findshop-dev-media-sagar";
    storageService.resetClient();
    assert.throws(
      () => {
        storageService.getClient();
      },
      /Production environment cannot target non-production bucket/,
      "Production environment must block targeting a dev bucket"
    );
    console.log("   ✔ Production environment successfully blocks targeting development bucket\n");

    // Reset back to safe development bucket
    process.env.NODE_ENV = "development";
    process.env.AWS_S3_BUCKET = "findshop-dev-media-sagar";
    process.env.AWS_REGION = "ap-south-1";
    process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
    process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
    storageService.resetClient();

    // -------------------------------------------------------------
    // Test 3: S3 Hierarchical Storage Key Generation
    // -------------------------------------------------------------
    console.log("🧪 Test 3: S3 Hierarchical Key Generation");

    const tempKey = storageService.generateTempKey(42, "upload-uuid-1234");
    assert.strictEqual(tempKey, "temp/uploads/42/upload-uuid-1234.webp");
    console.log("   ✔ Temporary Key:", tempKey);

    const logoKey = storageService.generatePermanentKey({
      entityType: "shop-logo",
      shopId: 10,
    });
    assert.strictEqual(logoKey, "shops/10/logo.webp");
    console.log("   ✔ Shop Logo Key:", logoKey);

    const bannerKey = storageService.generatePermanentKey({
      entityType: "shop-banner",
      shopId: 10,
    });
    assert.strictEqual(bannerKey, "shops/10/banner.webp");
    console.log("   ✔ Shop Banner Key:", bannerKey);

    const productKey = storageService.generatePermanentKey({
      entityType: "product-image",
      shopId: 10,
      productId: 99,
      imageId: "img_001",
    });
    assert.strictEqual(productKey, "products/10/99/img_001.webp");
    console.log("   ✔ Product Image Key:", productKey, "\n");

    // -------------------------------------------------------------
    // Test 4: URL Key Extraction (Zero Path Leakage)
    // -------------------------------------------------------------
    console.log("🧪 Test 4: Storage Key Extraction");

    const testKeys = [
      {
        input: "shops/42/logo.webp",
        expected: "shops/42/logo.webp",
        label: "Plain storage key",
      },
      {
        input: "/shops/42/banner.webp",
        expected: "shops/42/banner.webp",
        label: "Relative path with leading slash",
      },
      {
        input: "https://media.findshopeasily.com/products/42/101/photo.webp",
        expected: "products/42/101/photo.webp",
        label: "Custom CDN domain URL",
      },
      {
        input: "https://findshop-dev-media-sagar.s3.ap-south-1.amazonaws.com/temp/uploads/5/uuid.webp",
        expected: "temp/uploads/5/uuid.webp",
        label: "Direct AWS S3 virtual-hosted URL",
      },
      {
        input: "https://s3.ap-south-1.amazonaws.com/findshop-dev-media-sagar/shops/42/logo.webp",
        expected: "shops/42/logo.webp",
        label: "Path-style AWS S3 URL with bucket segment",
      },
      {
        input: "https://media.findshopeasily.com/products/42/photo.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA...",
        expected: "products/42/photo.webp",
        label: "Presigned URL with query strings",
      },
    ];

    for (const testCase of testKeys) {
      const extracted = storageService.extractKeyFromUrl(testCase.input);
      assert.strictEqual(
        extracted,
        testCase.expected,
        `Key extraction failed for ${testCase.label}: expected "${testCase.expected}", got "${extracted}"`
      );
      console.log(`   ✔ ${testCase.label}: "${testCase.input.slice(0, 45)}..." -> "${extracted}"`);
    }
    console.log("");

    // -------------------------------------------------------------
    // Test 5: AWS S3 Presigned PUT URL Generation
    // -------------------------------------------------------------
    console.log("🧪 Test 5: AWS S3 Presigned PUT URL Generation");

    const presigned = await storageService.getPresignedUploadUrl({
      entityType: "product-image",
      userId: 7,
      shopId: 15,
      productId: 44,
      fileName: "camera.webp",
      contentType: "image/webp",
    });

    assert.ok(presigned.uploadUrl, "Presigned upload URL must not be empty");
    assert.strictEqual(presigned.expiresInSeconds, 300, "Presigned URL expiry must be 300s (5 minutes)");
    assert.ok(presigned.storageKey.startsWith("temp/uploads/7/"), "Object key must be inside temp/uploads/7/");
    assert.ok(presigned.uploadUrl.includes("X-Amz-Algorithm=AWS4-HMAC-SHA256"), "URL must use SigV4");
    assert.ok(presigned.uploadUrl.includes("X-Amz-Expires=300"), "URL must enforce 300s expiration");
    assert.ok(!presigned.uploadUrl.includes(process.env.AWS_SECRET_ACCESS_KEY!), "Secret key must NEVER appear in URL");

    console.log("   ✔ S3 Presigned Upload URL generated successfully:");
    console.log(`     • Key: ${presigned.storageKey}`);
    console.log(`     • Expiry: ${presigned.expiresInSeconds}s`);
    console.log(`     • Public URL: ${presigned.publicUrl}\n`);

    // -------------------------------------------------------------
    // Test 6: Sanitized Configuration Summary & Credential Masking
    // -------------------------------------------------------------
    console.log("🧪 Test 6: Masked Configuration Summary");

    const summary = storageService.getConfigSummary();
    assert.strictEqual(summary.provider, "s3");
    assert.strictEqual(summary.bucket, "findshop-dev-media-sagar");
    assert.strictEqual(summary.region, "ap-south-1");
    assert.strictEqual(summary.isConfigured, true);
    assert.ok(summary.maskedAccessKeyId && summary.maskedAccessKeyId.includes("..."), "Access key must be safely masked");
    assert.ok(!JSON.stringify(summary).includes(process.env.AWS_SECRET_ACCESS_KEY!), "Secret key must NEVER appear in config summary");

    console.log("   ✔ S3 Config Summary:", JSON.stringify(summary, null, 2));
    console.log("\n=================================================");
    console.log("   🎉 ALL STORAGE VERIFICATION TESTS PASSED!     ");
    console.log("=================================================\n");
  } finally {
    process.env = originalEnv;
    storageService.resetClient();
  }
}

runStorageVerification().catch((err) => {
  console.error("\n❌ Storage Verification Suite Failed:", err);
  process.exit(1);
});
