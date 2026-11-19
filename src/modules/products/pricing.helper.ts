import { BadRequestError } from "../../core/errors/AppError";

export interface ResolvedProductPricing {
  sellingPrice: number;
  mrpPrice: number | null;
  hasDiscount: boolean;
  discountAmount: number;
  discountPercentage: number;
}

/**
 * SQL expression for the effective selling price of a Product row.
 * Evaluates to `discountPrice` ONLY when it is a valid discount (0 < discountPrice < price);
 * otherwise falls back to `price` (MRP).
 */
export const EFFECTIVE_SELLING_PRICE_SQL = `CASE WHEN "Product"."discountPrice" IS NOT NULL AND "Product"."discountPrice" > 0 AND "Product"."discountPrice" < "Product"."price" THEN "Product"."discountPrice" ELSE "Product"."price" END`;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Resolves canonical display pricing from DB columns (`price` = MRP, `discountPrice` = Selling Price).
 * Defensively ignores invalid or legacy corrupted rows where `discountPrice >= price` or `<= 0`.
 */
export function resolveProductPricing(
  rawPrice: number | string | null | undefined,
  rawDiscountPrice: number | string | null | undefined
): ResolvedProductPricing {
  const mrp = Number(rawPrice);
  const safeMrp = Number.isFinite(mrp) && mrp > 0 ? round2(mrp) : 0;

  const parsedDiscount =
    rawDiscountPrice !== null && rawDiscountPrice !== undefined && rawDiscountPrice !== ""
      ? Number(rawDiscountPrice)
      : null;

  const hasValidDiscount =
    parsedDiscount !== null &&
    Number.isFinite(parsedDiscount) &&
    parsedDiscount > 0 &&
    safeMrp > 0 &&
    parsedDiscount < safeMrp;

  if (hasValidDiscount) {
    const sellingPrice = round2(parsedDiscount);
    const discountAmount = round2(safeMrp - sellingPrice);
    const discountPercentage = Math.round((discountAmount / safeMrp) * 100);
    return {
      sellingPrice,
      mrpPrice: safeMrp,
      hasDiscount: true,
      discountAmount,
      discountPercentage,
    };
  }

  return {
    sellingPrice: safeMrp,
    mrpPrice: null,
    hasDiscount: false,
    discountAmount: 0,
    discountPercentage: 0,
  };
}

/**
 * Authoritative server-side pricing validation and normalization for Product create & update.
 *
 * Canonical contract:
 * - `price` = MRP / Original Price (strictly > 0).
 * - `discountPrice` = Optional Selling / Offer Price (strictly > 0 and < price, or `null` when sold at MRP).
 * - If `discountPrice` equals `price`, or is empty / 0, it is normalized to `null` (no discount).
 * - If `discountPrice` > `price` or < 0, throws 400 BadRequestError.
 */
export function normalizeAndValidateProductPricing(
  input: {
    price?: number | string | null;
    discountPrice?: number | string | null;
  },
  existing?: {
    price: number;
    discountPrice: number | null;
  }
): { price?: number; discountPrice?: number | null } {
  const isPriceProvided = input.price !== undefined;
  const isDiscountProvided = input.discountPrice !== undefined;

  if (!existing && !isPriceProvided) {
    throw new BadRequestError("MRP price is required and must be greater than 0");
  }

  let effectivePrice: number;
  if (isPriceProvided) {
    const parsed = Number(input.price);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestError("MRP price must be a valid number greater than 0");
    }
    effectivePrice = round2(parsed);
  } else {
    effectivePrice = round2(Number(existing?.price ?? 0));
  }

  let normalizedDiscount: number | null | undefined = undefined;

  if (isDiscountProvided) {
    if (
      input.discountPrice === null ||
      input.discountPrice === "" ||
      Number(input.discountPrice) === 0
    ) {
      normalizedDiscount = null;
    } else {
      const parsedDiscount = Number(input.discountPrice);
      if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
        throw new BadRequestError("Selling/discount price must be a valid non-negative number");
      }
      const roundedDiscount = round2(parsedDiscount);
      if (roundedDiscount > effectivePrice) {
        throw new BadRequestError(
          `Selling price (₹${roundedDiscount}) cannot be greater than MRP price (₹${effectivePrice})`
        );
      }
      // Selling at MRP means no discount -> store cleanly as null
      normalizedDiscount = roundedDiscount === effectivePrice ? null : roundedDiscount;
    }
  } else if (existing && isPriceProvided && existing.discountPrice !== null) {
    // Price (MRP) updated while discountPrice was omitted: re-check against existing discountPrice
    const existingDiscount = round2(Number(existing.discountPrice));
    if (existingDiscount > effectivePrice) {
      throw new BadRequestError(
        `Updated MRP price (₹${effectivePrice}) cannot be lower than existing selling price (₹${existingDiscount}). Update selling price together.`
      );
    }
    if (existingDiscount === effectivePrice) {
      normalizedDiscount = null;
    }
  }

  const result: { price?: number; discountPrice?: number | null } = {};
  if (isPriceProvided) {
    result.price = effectivePrice;
  }
  if (normalizedDiscount !== undefined) {
    result.discountPrice = normalizedDiscount;
  }
  return result;
}
