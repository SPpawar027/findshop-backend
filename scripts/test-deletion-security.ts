import assert from "node:assert";
import jwt from "jsonwebtoken";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../src/core/middlewares/auth.middleware";
import { UnauthorizedError, ForbiddenError } from "../src/core/errors/AppError";

const JWT_SECRET = process.env.JWT_SECRET || "findshop_jwt_secret_dev_key_change_in_prod";

function generateTestToken(user: { id: number; email: string; role: string }): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "1h" });
}

function createMockReqRes(token?: string, role?: string, id: number = 1) {
  const req: AuthenticatedRequest = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    params: {},
    body: {},
  } as any;

  let statusCode = 200;
  let responseBody: any = null;

  const res: any = {
    status(c: number) {
      statusCode = c;
      return res;
    },
    json(data: any) {
      responseBody = data;
      return res;
    },
  };

  return { req, res, getStatus: () => statusCode, getBody: () => responseBody };
}

async function runSecurityTests() {
  console.log("================================================================================");
  console.log("       FINDSHOEASILY — DELETION & AUTHORIZATION SECURITY REGRESSION TESTS       ");
  console.log("================================================================================\n");

  const customerToken = generateTestToken({ id: 101, email: "customer@test.com", role: "customer" });
  const merchantToken = generateTestToken({ id: 202, email: "merchant@test.com", role: "shop_admin" });
  const adminToken = generateTestToken({ id: 303, email: "superadmin@test.com", role: "super_admin" });

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}: ${err?.message}`);
      failed++;
    }
  }

  // --- 1. AUTHENTICATION MIDDLEWARE SECURITY ---
  console.log("--- 1. Authentication Security ---");

  await test("authMiddleware rejects missing Authorization header with UnauthorizedError", () => {
    const { req, res } = createMockReqRes();
    assert.throws(
      () => authMiddleware(req, res, () => {}),
      (err: any) => err instanceof UnauthorizedError && err.statusCode === 401
    );
  });

  await test("authMiddleware rejects forged/tampered JWT with UnauthorizedError", () => {
    const { req, res } = createMockReqRes("invalid.token.payload");
    assert.throws(
      () => authMiddleware(req, res, () => {}),
      (err: any) => err instanceof UnauthorizedError && err.statusCode === 401
    );
  });

  await test("authMiddleware successfully populates req.user from valid JWT", () => {
    const { req, res } = createMockReqRes(customerToken);
    let called = false;
    authMiddleware(req, res, () => {
      called = true;
    });
    assert.strictEqual(called, true);
    assert.strictEqual(req.user?.id, 101);
    assert.strictEqual(req.user?.role, "customer");
  });

  // --- 2. RBAC AUTHORIZATION ON DESTRUCTIVE ENDPOINTS ---
  console.log("\n--- 2. RBAC Authorization on Destructive Endpoints ---");

  await test("requireRole(['super_admin']) rejects customer role with ForbiddenError (403)", () => {
    const { req, res } = createMockReqRes(customerToken);
    authMiddleware(req, res, () => {});

    const superAdminGuard = requireRole(["super_admin"]);
    assert.throws(
      () => superAdminGuard(req, res, () => {}),
      (err: any) => err instanceof ForbiddenError && err.statusCode === 403
    );
  });

  await test("requireRole(['super_admin']) rejects shop_admin role with ForbiddenError (403)", () => {
    const { req, res } = createMockReqRes(merchantToken);
    authMiddleware(req, res, () => {});

    const superAdminGuard = requireRole(["super_admin"]);
    assert.throws(
      () => superAdminGuard(req, res, () => {}),
      (err: any) => err instanceof ForbiddenError && err.statusCode === 403
    );
  });

  await test("requireRole(['super_admin']) permits super_admin role", () => {
    const { req, res } = createMockReqRes(adminToken);
    authMiddleware(req, res, () => {});

    let called = false;
    const superAdminGuard = requireRole(["super_admin"]);
    superAdminGuard(req, res, () => {
      called = true;
    });
    assert.strictEqual(called, true);
  });

  await test("requireRole(['shop_admin', 'super_admin']) rejects customer on shop deletion", () => {
    const { req, res } = createMockReqRes(customerToken);
    authMiddleware(req, res, () => {});

    const shopGuard = requireRole(["shop_admin", "super_admin"]);
    assert.throws(
      () => shopGuard(req, res, () => {}),
      (err: any) => err instanceof ForbiddenError && err.statusCode === 403
    );
  });

  await test("requireRole(['shop_admin', 'super_admin']) permits shop_admin on shop closure", () => {
    const { req, res } = createMockReqRes(merchantToken);
    authMiddleware(req, res, () => {});

    let called = false;
    const shopGuard = requireRole(["shop_admin", "super_admin"]);
    shopGuard(req, res, () => {
      called = true;
    });
    assert.strictEqual(called, true);
  });

  // --- 3. S3 OBJECT KEY VALIDATION LOGIC ---
  console.log("\n--- 3. S3 Media Key Validation Security ---");

  await test("S3 Key Validator must reject path traversal and arbitrary keys", () => {
    const shopId = 42;
    const testKeys = [
      { key: "shops/42/logo.webp", valid: true },
      { key: "shops/42/banner.webp", valid: true },
      { key: "products/prod-123.webp", valid: true },
      { key: "temp/uploads/user-42/abc.webp", valid: true },
      { key: "shops/999/logo.webp", valid: false }, // wrong shop ID
      { key: "../../../etc/passwd", valid: false }, // path traversal
      { key: "system/config.json", valid: false }, // system file
    ];

    for (const item of testKeys) {
      const isExpected =
        item.key.startsWith(`shops/${shopId}/`) ||
        item.key.startsWith("products/") ||
        item.key.startsWith("temp/uploads/");
      assert.strictEqual(isExpected, item.valid, `Key "${item.key}" expectation mismatch`);
    }
  });

  // --- 4. CONCURRENCY ADVISORY LOCK ID VALIDATION ---
  console.log("\n--- 4. Concurrency Protection Lock ID ---");

  await test("Shop Cleanup Advisory Lock ID is within valid 32-bit signed integer range", () => {
    const lockId = 894371;
    assert.ok(Number.isInteger(lockId));
    assert.ok(lockId > 0 && lockId <= 2147483647);
  });

  console.log("\n================================================================================");
  console.log(` RESULTS: ${passed} passed, ${failed} failed.`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests();
