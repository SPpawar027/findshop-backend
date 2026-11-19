import assert from "node:assert/strict";
import {
  normalizeAndValidateProductPricing,
  resolveProductPricing,
} from "../src/modules/products/pricing.helper";

let passed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("Running Product Pricing Unit Tests...");

test("resolves sample row 450.00 / 124.00 correctly (72% OFF, Save 326)", () => {
  const res = resolveProductPricing(450.0, 124.0);
  assert.equal(res.sellingPrice, 124);
  assert.equal(res.mrpPrice, 450);
  assert.equal(res.hasDiscount, true);
  assert.equal(res.discountAmount, 326);
  assert.equal(res.discountPercentage, 72);
});

test("resolves sample row 150.00 / 135.00 correctly (10% OFF, Save 15)", () => {
  const res = resolveProductPricing(150.0, 135.0);
  assert.equal(res.sellingPrice, 135);
  assert.equal(res.mrpPrice, 150);
  assert.equal(res.hasDiscount, true);
  assert.equal(res.discountAmount, 15);
  assert.equal(res.discountPercentage, 10);
});

test("resolves sample row 2399.00 / 1098.00 correctly (54% OFF, Save 1301)", () => {
  const res = resolveProductPricing(2399.0, 1098.0);
  assert.equal(res.sellingPrice, 1098);
  assert.equal(res.mrpPrice, 2399);
  assert.equal(res.hasDiscount, true);
  assert.equal(res.discountAmount, 1301);
  assert.equal(res.discountPercentage, 54);
});

test("treats null discountPrice as no discount (sold at MRP)", () => {
  const res = resolveProductPricing(450, null);
  assert.equal(res.sellingPrice, 450);
  assert.equal(res.mrpPrice, null);
  assert.equal(res.hasDiscount, false);
  assert.equal(res.discountAmount, 0);
  assert.equal(res.discountPercentage, 0);
});

test("defensively ignores equal discountPrice === price (legacy dirty row)", () => {
  const res = resolveProductPricing(150, 150);
  assert.equal(res.sellingPrice, 150);
  assert.equal(res.mrpPrice, null);
  assert.equal(res.hasDiscount, false);
  assert.equal(res.discountAmount, 0);
  assert.equal(res.discountPercentage, 0);
});

test("defensively ignores inverted discountPrice > price (never shows negative savings)", () => {
  const res = resolveProductPricing(124, 450);
  assert.equal(res.sellingPrice, 124);
  assert.equal(res.mrpPrice, null);
  assert.equal(res.hasDiscount, false);
  assert.equal(res.discountAmount, 0);
  assert.equal(res.discountPercentage, 0);
});

test("normalizes valid create payload with discountPrice < price", () => {
  const res = normalizeAndValidateProductPricing({ price: 450, discountPrice: 124 });
  assert.deepEqual(res, { price: 450, discountPrice: 124 });
});

test("normalizes discountPrice === price to null on create", () => {
  const res = normalizeAndValidateProductPricing({ price: 150, discountPrice: 150 });
  assert.deepEqual(res, { price: 150, discountPrice: null });
});

test("normalizes discountPrice === 0 or empty string to null", () => {
  assert.deepEqual(
    normalizeAndValidateProductPricing({ price: 150, discountPrice: 0 }),
    { price: 150, discountPrice: null }
  );
  assert.deepEqual(
    normalizeAndValidateProductPricing({ price: 150, discountPrice: "" }),
    { price: 150, discountPrice: null }
  );
});

test("rejects discountPrice > price on create", () => {
  assert.throws(
    () => normalizeAndValidateProductPricing({ price: 150, discountPrice: 200 }),
    /cannot be greater than MRP/
  );
});

test("rejects negative discountPrice or non-positive MRP", () => {
  assert.throws(
    () => normalizeAndValidateProductPricing({ price: 0, discountPrice: null }),
    /greater than 0/
  );
  assert.throws(
    () => normalizeAndValidateProductPricing({ price: 150, discountPrice: -10 }),
    /non-negative/
  );
});

test("partial update: lowering MRP below existing discountPrice throws", () => {
  assert.throws(
    () =>
      normalizeAndValidateProductPricing(
        { price: 100 },
        { price: 150, discountPrice: 135 }
      ),
    /cannot be lower than existing selling price/
  );
});

test("partial update: lowering MRP to match existing discountPrice clears discountPrice to null", () => {
  const res = normalizeAndValidateProductPricing(
    { price: 135 },
    { price: 150, discountPrice: 135 }
  );
  assert.deepEqual(res, { price: 135, discountPrice: null });
});

test("partial update: updating only discountPrice validates against existing MRP", () => {
  assert.throws(
    () =>
      normalizeAndValidateProductPricing(
        { discountPrice: 200 },
        { price: 150, discountPrice: 135 }
      ),
    /cannot be greater than MRP/
  );
  const res = normalizeAndValidateProductPricing(
    { discountPrice: 120 },
    { price: 150, discountPrice: 135 }
  );
  assert.deepEqual(res, { discountPrice: 120 });
});

console.log(`\nAll ${passed} product pricing tests passed!`);
