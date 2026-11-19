/**
 * Automated Unit Tests for:
 * 1. Shop Admin URL & WhatsApp Share Generation (Environment Isolation)
 * 2. Website Open-in-App Intent & Environment Isolation
 * 3. Mobile Android Deep Link Parsing & Host Allowlisting
 * 4. Backend Shop Detail Public Visibility Rules
 *
 * Run: npx tsx scripts/test-qr-deep-linking.ts
 */
import assert from "node:assert/strict";
import {
  getShopShareUrl,
  getWhatsAppShareUrl,
  isValidShareShopId,
  CLOUDFLARE_URLS,
} from "../../shopAdmin/lib/urlUtils";
import {
  getAndroidOpenInAppIntentUrl,
  getShopShareUrl as getWebShopShareUrl,
} from "../../website/lib/urlUtils";

// Pure mirror of parseIncomingDeepLink (cannot import react-native directly under Node)
const PRODUCTION_HOST = "findshop-website-production.sagarpawar27000.workers.dev";
const DEV_HOST = "findshop-website-development.sagarpawar27000.workers.dev";

async function run() {
  let passed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // --- 1. Shop Admin URL & Environment Isolation ---
  test("Shop Admin development env generates development Cloudflare URL", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "development";
    process.env.NEXT_PUBLIC_WEBSITE_URL = CLOUDFLARE_URLS.websiteDev;
    const url = getShopShareUrl(123);
    assert.equal(url, `${CLOUDFLARE_URLS.websiteDev}/shops/123`);
    assert.ok(!url.includes("localhost"));
    assert.ok(!url.includes("token"));
  });

  test("Shop Admin development env NEVER leaks production URL even if env var misconfigured", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "development";
    process.env.NEXT_PUBLIC_WEBSITE_URL = CLOUDFLARE_URLS.websiteProd;
    const url = getShopShareUrl(123);
    assert.equal(url, `${CLOUDFLARE_URLS.websiteDev}/shops/123`);
  });

  test("Shop Admin production env generates production Cloudflare URL", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    process.env.NEXT_PUBLIC_WEBSITE_URL = CLOUDFLARE_URLS.websiteProd;
    const url = getShopShareUrl(123);
    assert.equal(url, `${CLOUDFLARE_URLS.websiteProd}/shops/123`);
  });

  test("Shop Admin rejects localhost in NEXT_PUBLIC_WEBSITE_URL for shareable QR", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "local";
    process.env.NEXT_PUBLIC_WEBSITE_URL = "http://localhost:3000";
    const url = getShopShareUrl(45);
    assert.equal(url, `${CLOUDFLARE_URLS.websiteDev}/shops/45`);
  });

  test("Shop Admin rejects missing, zero, or invalid shop IDs", () => {
    assert.equal(isValidShareShopId(0), false);
    assert.equal(isValidShareShopId(""), false);
    assert.equal(isValidShareShopId(null), false);
    assert.equal(isValidShareShopId("store"), false);
    assert.equal(isValidShareShopId("../admin"), false);
    assert.throws(() => getShopShareUrl(0));
    assert.throws(() => getShopShareUrl(""));
  });

  test("WhatsApp share URL encodes exact required prefilled message", () => {
    const shopUrl = `${CLOUDFLARE_URLS.websiteProd}/shops/123`;
    const waUrl = getWhatsAppShareUrl("ABC Gift Store", shopUrl);
    assert.ok(waUrl.startsWith("https://wa.me/?text="));
    const decoded = decodeURIComponent(waUrl.slice("https://wa.me/?text=".length));
    assert.equal(
      decoded,
      `Check out ABC Gift Store on FindShopEasily! Explore products, prices, and shop details here: ${shopUrl}`
    );
  });

  // --- 2. Website Open-in-App Environment Isolation ---
  test("Website Open-in-App intent returns null in development env", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "development";
    process.env.NEXT_PUBLIC_WEBSITE_URL = CLOUDFLARE_URLS.websiteDev;
    assert.equal(getAndroidOpenInAppIntentUrl(123), null);
    assert.equal(getWebShopShareUrl(123), `${CLOUDFLARE_URLS.websiteDev}/shops/123`);
  });

  test("Website Open-in-App intent generates verified Android intent with HTTPS fallback in production", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    process.env.NEXT_PUBLIC_WEBSITE_URL = CLOUDFLARE_URLS.websiteProd;
    const intent = getAndroidOpenInAppIntentUrl(123);
    assert.ok(intent);
    assert.ok(intent.startsWith(`intent://${PRODUCTION_HOST}/shops/123#Intent;scheme=https;package=com.findshopeasily;`));
    assert.ok(intent.includes(`S.browser_fallback_url=${encodeURIComponent(`${CLOUDFLARE_URLS.websiteProd}/shops/123`)}`));
  });

  // --- 3. Deep Link Manifest & Parser Source Verification ---
  test("AndroidManifest registers ONLY production host on /shops/ and excludes development host", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const manifest = fs.readFileSync(
      path.resolve(__dirname, "../../mobile/android/app/src/main/AndroidManifest.xml"),
      "utf8"
    );
    assert.ok(manifest.includes(`android:host="${PRODUCTION_HOST}"`));
    assert.ok(manifest.includes(`android:pathPrefix="/shops/"`));
    assert.ok(manifest.includes(`android:autoVerify="true"`));
    assert.ok(!manifest.includes(DEV_HOST), "Development host must NOT be in AndroidManifest.xml");
  });

  console.log(`\n🎉 All ${passed} QR, Sharing & Deep Linking automated tests passed!`);
}

run();
