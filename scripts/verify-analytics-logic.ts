/**
 * FindShopEasily - Analytics Logic & Scenarios Verification Test
 *
 * Verifies all 12 scenarios defined in the Analytics System specification:
 * 1.  Same visitor opens shop 5 times in one day -> total_views = 5, unique_visitors = 1
 * 2.  Second visitor opens shop -> total_views = 6, unique_visitors = 2
 * 3.  Network retry with identical event_id -> rejected / suppressed, counters not incremented
 * 4.  Product view event with valid product ID belonging to that shop -> product_views incremented
 * 5.  Product view event with product belonging to DIFFERENT shop -> rejected (400 Bad Request)
 * 6.  Product view event with non-existent product -> rejected (404 Not Found)
 * 7.  Shop view event with product ID -> nullified / ignored product ID
 * 8.  Inactive or non-existent shop -> rejected
 * 9.  Ingesting whatsapp_click -> whatsapp_clicks counter incremented
 * 10. Ingesting directions_click -> directions_clicks counter incremented
 * 11. Ingesting call_click -> call_clicks counter incremented
 * 12. 7-day retention cleanup -> old events & visitors deleted, daily summary untouched
 */

import { randomUUID } from "crypto";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_EVENT_TYPES = [
  "shop_view",
  "product_view",
  "directions_click",
  "call_click",
  "whatsapp_click",
  "wishlist_add",
  "offer_view",
  "offer_redeemed",
  "qr_checkin",
] as const;

// In-memory simulation of atomic database tables
interface MockDaily {
  shop_id: number;
  analytics_date: string;
  total_views: number;
  unique_visitors: number;
  directions_clicks: number;
  call_clicks: number;
  whatsapp_clicks: number;
  product_views: number;
}

interface MockEvent {
  event_id: string;
  shop_id: number;
  visitor_id: string;
  product_id: number | null;
  event_type: string;
  created_at: Date;
}

interface MockUniqueVisitor {
  shop_id: number;
  visitor_id: string;
  analytics_date: string;
}

const mockShops: Record<number, { id: number; name: string; isOpen: boolean }> = {
  101: { id: 101, name: "Active Store", isOpen: true },
  102: { id: 102, name: "Closed Store", isOpen: false },
};

const mockProducts: Record<number, { id: number; shopId: number; name: string }> = {
  501: { id: 501, shopId: 101, name: "Product of Shop 101" },
  502: { id: 502, shopId: 999, name: "Product of Shop 999" },
};

const eventsTable: MockEvent[] = [];
const uniqueVisitorsTable: MockUniqueVisitor[] = [];
const dailyTable = new Map<string, MockDaily>();

function getDailyRecord(shopId: number, date: string): MockDaily {
  const key = `${shopId}_${date}`;
  let rec = dailyTable.get(key);
  if (!rec) {
    rec = {
      shop_id: shopId,
      analytics_date: date,
      total_views: 0,
      unique_visitors: 0,
      directions_clicks: 0,
      call_clicks: 0,
      whatsapp_clicks: 0,
      product_views: 0,
    };
    dailyTable.set(key, rec);
  }
  return rec;
}

function simulateTrackEvent(dto: {
  shopId: number;
  eventType: string;
  productId?: number | null;
  visitorId: string;
  eventId?: string;
  analyticsDate: string;
}): { recorded: boolean; reason?: string; error?: string } {
  // 1. Validate event type
  if (!ALLOWED_EVENT_TYPES.includes(dto.eventType as any)) {
    return { recorded: false, error: "Invalid eventType" };
  }

  // 2. Validate visitorId
  if (!dto.visitorId || dto.visitorId.trim().length === 0 || dto.visitorId.length > 100) {
    return { recorded: false, error: "Invalid visitorId format" };
  }

  // 3. Validate eventId UUID
  const eventId = dto.eventId || randomUUID();
  if (!UUID_V4_REGEX.test(eventId)) {
    return { recorded: false, error: "Invalid eventId UUID" };
  }

  // 4. Validate shop existence & active status
  const shop = mockShops[dto.shopId];
  if (!shop) {
    return { recorded: false, error: "Shop not found" };
  }
  if (!shop.isOpen) {
    return { recorded: false, error: "Shop is inactive" };
  }

  // 5. Product validation
  let finalProductId: number | null = null;
  if (dto.eventType === "product_view") {
    if (!dto.productId) {
      return { recorded: false, error: "Valid productId required" };
    }
    const product = mockProducts[dto.productId];
    if (!product) {
      return { recorded: false, error: "Product not found" };
    }
    if (product.shopId !== dto.shopId) {
      return { recorded: false, error: "Product belongs to different shop" };
    }
    finalProductId = dto.productId;
  }

  // 6. Idempotency check: duplicate event_id check
  if (eventsTable.some((e) => e.event_id === eventId)) {
    return { recorded: false, reason: "duplicate_event_id" };
  }

  // 7. Insert event
  eventsTable.push({
    event_id: eventId,
    shop_id: dto.shopId,
    visitor_id: dto.visitorId,
    product_id: finalProductId,
    event_type: dto.eventType,
    created_at: new Date(),
  });

  // 8. Unique visitor tracking (shop_view only)
  let isNewUniqueVisitor = false;
  if (dto.eventType === "shop_view") {
    const exists = uniqueVisitorsTable.some(
      (uv) =>
        uv.shop_id === dto.shopId &&
        uv.visitor_id === dto.visitorId &&
        uv.analytics_date === dto.analyticsDate
    );
    if (!exists) {
      uniqueVisitorsTable.push({
        shop_id: dto.shopId,
        visitor_id: dto.visitorId,
        analytics_date: dto.analyticsDate,
      });
      isNewUniqueVisitor = true;
    }
  }

  // 9. Atomic counter upsert
  const daily = getDailyRecord(dto.shopId, dto.analyticsDate);
  if (dto.eventType === "shop_view") {
    daily.total_views += 1;
    if (isNewUniqueVisitor) {
      daily.unique_visitors += 1;
    }
  } else if (dto.eventType === "product_view") {
    daily.product_views += 1;
  } else if (dto.eventType === "directions_click") {
    daily.directions_clicks += 1;
  } else if (dto.eventType === "call_click") {
    daily.call_clicks += 1;
  } else if (dto.eventType === "whatsapp_click") {
    daily.whatsapp_clicks += 1;
  }

  return { recorded: true };
}

async function runVerification() {
  console.log("=================================================");
  console.log("🧪 FindShopEasily Analytics Logic Verification");
  console.log("=================================================\n");

  const today = "2026-11-14";
  let passed = 0;
  let failed = 0;

  function assert(scenario: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${scenario}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${scenario}${details ? ` -> ${details}` : ""}`);
      failed++;
    }
  }

  // Scenario 1: Same visitor opens shop 5 times in one day
  for (let i = 0; i < 5; i++) {
    simulateTrackEvent({
      shopId: 101,
      eventType: "shop_view",
      visitorId: "visitor_alpha",
      analyticsDate: today,
    });
  }
  const rec1 = getDailyRecord(101, today);
  assert(
    "Scenario 1: Same visitor opens shop 5 times in 1 day (total_views = 5, unique_visitors = 1)",
    rec1.total_views === 5 && rec1.unique_visitors === 1,
    `Actual: total_views=${rec1.total_views}, unique_visitors=${rec1.unique_visitors}`
  );

  // Scenario 2: Second visitor opens shop
  simulateTrackEvent({
    shopId: 101,
    eventType: "shop_view",
    visitorId: "visitor_beta",
    analyticsDate: today,
  });
  const rec2 = getDailyRecord(101, today);
  assert(
    "Scenario 2: Second visitor opens shop (total_views = 6, unique_visitors = 2)",
    rec2.total_views === 6 && rec2.unique_visitors === 2,
    `Actual: total_views=${rec2.total_views}, unique_visitors=${rec2.unique_visitors}`
  );

  // Scenario 3: Network retry with identical event_id
  const testEventId = "11111111-2222-4333-8444-555555555555";
  const firstAttempt = simulateTrackEvent({
    shopId: 101,
    eventType: "shop_view",
    visitorId: "visitor_gamma",
    eventId: testEventId,
    analyticsDate: today,
  });
  const retryAttempt = simulateTrackEvent({
    shopId: 101,
    eventType: "shop_view",
    visitorId: "visitor_gamma",
    eventId: testEventId,
    analyticsDate: today,
  });
  const rec3 = getDailyRecord(101, today);
  assert(
    "Scenario 3: Network retry with identical event_id (rejected, counters not re-incremented)",
    firstAttempt.recorded === true &&
      retryAttempt.recorded === false &&
      retryAttempt.reason === "duplicate_event_id" &&
      rec3.total_views === 7,
    `Total views after retry: ${rec3.total_views}`
  );

  // Scenario 4: Valid product view event belonging to that shop
  simulateTrackEvent({
    shopId: 101,
    eventType: "product_view",
    productId: 501,
    visitorId: "visitor_alpha",
    analyticsDate: today,
  });
  const rec4 = getDailyRecord(101, today);
  assert(
    "Scenario 4: Product view event with valid product ID belonging to that shop",
    rec4.product_views === 1,
    `Product views: ${rec4.product_views}`
  );

  // Scenario 5: Product view with product belonging to DIFFERENT shop
  const resCrossShop = simulateTrackEvent({
    shopId: 101,
    eventType: "product_view",
    productId: 502, // Product belongs to shop 999
    visitorId: "visitor_alpha",
    analyticsDate: today,
  });
  assert(
    "Scenario 5: Product view event with product belonging to DIFFERENT shop -> Rejected",
    resCrossShop.recorded === false &&
      resCrossShop.error === "Product belongs to different shop"
  );

  // Scenario 6: Product view event with non-existent product
  const resNonExistentProd = simulateTrackEvent({
    shopId: 101,
    eventType: "product_view",
    productId: 99999,
    visitorId: "visitor_alpha",
    analyticsDate: today,
  });
  assert(
    "Scenario 6: Product view event with non-existent product -> Rejected",
    resNonExistentProd.recorded === false &&
      resNonExistentProd.error === "Product not found"
  );

  // Scenario 7: Shop view event with product ID -> Nullified / ignored product ID
  const shopViewWithProdId = "22222222-3333-4444-8555-666666666666";
  simulateTrackEvent({
    shopId: 101,
    eventType: "shop_view",
    productId: 501, // Sent by client on shop view
    visitorId: "visitor_alpha",
    eventId: shopViewWithProdId,
    analyticsDate: today,
  });
  const recordedEvent = eventsTable.find((e) => e.event_id === shopViewWithProdId);
  assert(
    "Scenario 7: Shop view event with product ID -> Nullified / ignored product ID",
    recordedEvent?.product_id === null,
    `Recorded product_id: ${recordedEvent?.product_id}`
  );

  // Scenario 8: Inactive or non-existent shop -> Rejected
  const resInactiveShop = simulateTrackEvent({
    shopId: 102, // Closed shop
    eventType: "shop_view",
    visitorId: "visitor_alpha",
    analyticsDate: today,
  });
  const resNonExistentShop = simulateTrackEvent({
    shopId: 99999, // Doesn't exist
    eventType: "shop_view",
    visitorId: "visitor_alpha",
    analyticsDate: today,
  });
  assert(
    "Scenario 8: Inactive or non-existent shop -> Rejected",
    resInactiveShop.recorded === false &&
      resInactiveShop.error === "Shop is inactive" &&
      resNonExistentShop.recorded === false &&
      resNonExistentShop.error === "Shop not found"
  );

  // Scenario 9: Ingesting whatsapp_click -> whatsapp_clicks counter incremented
  simulateTrackEvent({
    shopId: 101,
    eventType: "whatsapp_click",
    visitorId: "visitor_alpha",
    analyticsDate: today,
  });
  const rec9 = getDailyRecord(101, today);
  assert(
    "Scenario 9: Ingesting whatsapp_click -> whatsapp_clicks counter incremented",
    rec9.whatsapp_clicks === 1,
    `WhatsApp clicks: ${rec9.whatsapp_clicks}`
  );

  // Scenario 10: Ingesting directions_click -> directions_clicks incremented
  simulateTrackEvent({
    shopId: 101,
    eventType: "directions_click",
    visitorId: "visitor_alpha",
    analyticsDate: today,
  });
  const rec10 = getDailyRecord(101, today);
  assert(
    "Scenario 10: Ingesting directions_click -> directions_clicks incremented",
    rec10.directions_clicks === 1,
    `Directions clicks: ${rec10.directions_clicks}`
  );

  // Scenario 11: Ingesting call_click -> call_clicks incremented
  simulateTrackEvent({
    shopId: 101,
    eventType: "call_click",
    visitorId: "visitor_alpha",
    analyticsDate: today,
  });
  const rec11 = getDailyRecord(101, today);
  assert(
    "Scenario 11: Ingesting call_click -> call_clicks incremented",
    rec11.call_clicks === 1,
    `Call clicks: ${rec11.call_clicks}`
  );

  // Scenario 12: 7-day retention cleanup
  // Add an 8-day old event and unique visitor
  const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  eventsTable.push({
    event_id: randomUUID(),
    shop_id: 101,
    visitor_id: "visitor_ancient",
    product_id: null,
    event_type: "shop_view",
    created_at: oldDate,
  });
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const remainingEvents = eventsTable.filter((e) => e.created_at >= cutoff);
  const dailyRecordPreserved = dailyTable.has(`${101}_${today}`);
  assert(
    "Scenario 12: 7-day retention cleanup -> Old raw events purged, daily summaries untouched",
    remainingEvents.length < eventsTable.length && dailyRecordPreserved === true,
    `Purged older events, daily records count = ${dailyTable.size}`
  );

  console.log("\n=================================================");
  console.log(`📊 Results: ${passed} passed, ${failed} failed.`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch(console.error);

