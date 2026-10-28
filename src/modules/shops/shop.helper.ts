/**
 * Shop Helpers for Shop Detail API
 * 
 * Contains computational utilities for:
 * 1. Geospatial Haversine distance calculations
 * 2. Operating hours & real-time open status determination
 * 3. Weekly schedule formatting
 * 4. Realistic rating breakdown curves
 * 5. Category-aware storefront amenities
 */

export interface DayScheduleItem {
  day: string;
  hours: string;
  isToday: boolean;
  openTime?: string;
  closeTime?: string;
  isClosed?: boolean;
}

export interface ShopOpenStatusResult {
  isOpen: boolean;
  statusLabel: string;
  detailsLabel: string;
  badgeVariant: "open" | "closed";
}

export interface RatingDistributionItem {
  stars: number;
  count: number;
  percentage: number;
}

export interface RatingSummaryResult {
  averageRating: number;
  totalReviews: number;
  distribution: RatingDistributionItem[];
}

export interface ShopAmenityItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

const DAYS_OF_WEEK = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DISPLAY_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Calculates Haversine distance between two coordinates in kilometers.
 * Formula: 2 * R * asin(sqrt(sin^2(dLat/2) + cos(lat1) * cos(lat2) * sin^2(dLon/2)))
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in kilometers
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Converts "HH:mm" (24h) to "hh:mm A" (12h).
 */
export function formatTo12Hour(timeStr: string): string {
  if (!timeStr) return "";
  if (timeStr.includes("AM") || timeStr.includes("PM")) {
    return timeStr;
  }

  const parts = timeStr.trim().split(":");
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || "00";

  if (isNaN(hours)) return timeStr;

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // '0' should be '12'

  const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;
  return `${formattedHours}:${minutes} ${ampm}`;
}

/**
 * Converts a time string (e.g. "09:30" or "09:30 AM") to minutes since midnight for easy comparison.
 */
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return -1;
  const clean = timeStr.trim().toUpperCase();

  if (clean.includes("AM") || clean.includes("PM")) {
    const isPM = clean.includes("PM");
    const withoutSuffix = clean.replace(/[AP]M/, "").trim();
    const [hStr, mStr] = withoutSuffix.split(":");
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr || "0", 10);
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return h * 60 + m;
  }

  const [hStr, mStr] = clean.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  return h * 60 + m;
}

/**
 * Computes dynamic real-time open status based on current IST time and shop opening hours.
 */
export function calculateShopOpenStatus(
  openingHours: Record<string, any> | null,
  isMasterOpen: boolean = true
): ShopOpenStatusResult {
  if (!isMasterOpen) {
    return {
      isOpen: false,
      statusLabel: "Closed",
      detailsLabel: "Temporarily Closed",
      badgeVariant: "closed",
    };
  }

  if (!openingHours || typeof openingHours !== "object" || Object.keys(openingHours).length === 0) {
    return {
      isOpen: true,
      statusLabel: "Open Now",
      detailsLabel: "Closes 09:30 PM",
      badgeVariant: "open",
    };
  }

  // Use Indian Standard Time (IST - Asia/Kolkata) as benchmark timezone
  const now = new Date();
  const istDateString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istDate = new Date(istDateString);

  const dayIndex = istDate.getDay(); // 0 is Sunday
  const todayKey = DAYS_OF_WEEK[dayIndex];
  const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();

  const todaySchedule = openingHours[todayKey];

  if (!todaySchedule || todaySchedule.closed) {
    return {
      isOpen: false,
      statusLabel: "Closed",
      detailsLabel: "Closed Today",
      badgeVariant: "closed",
    };
  }

  const openTimeStr = todaySchedule.open || "09:30";
  const closeTimeStr = todaySchedule.close || "21:30";

  const openMinutes = timeToMinutes(openTimeStr);
  const closeMinutes = timeToMinutes(closeTimeStr);

  const formattedClose = formatTo12Hour(closeTimeStr);
  const formattedOpen = formatTo12Hour(openTimeStr);

  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    return {
      isOpen: true,
      statusLabel: "Open Now",
      detailsLabel: `Closes at ${formattedClose}`,
      badgeVariant: "open",
    };
  } else if (currentMinutes < openMinutes) {
    return {
      isOpen: false,
      statusLabel: "Closed",
      detailsLabel: `Opens today at ${formattedOpen}`,
      badgeVariant: "closed",
    };
  } else {
    // Already closed for today - find tomorrow's schedule
    const tomorrowKey = DAYS_OF_WEEK[(dayIndex + 1) % 7];
    const tomorrowSchedule = openingHours[tomorrowKey];
    if (tomorrowSchedule && !tomorrowSchedule.closed) {
      const tomorrowOpenFormatted = formatTo12Hour(tomorrowSchedule.open || "09:30");
      return {
        isOpen: false,
        statusLabel: "Closed",
        detailsLabel: `Opens tomorrow at ${tomorrowOpenFormatted}`,
        badgeVariant: "closed",
      };
    }
    return {
      isOpen: false,
      statusLabel: "Closed",
      detailsLabel: "Closed for the day",
      badgeVariant: "closed",
    };
  }
}

/**
 * Builds standard 7-day weekly schedule array (Monday through Sunday).
 */
export function buildWeeklySchedule(
  openingHours: Record<string, any> | null
): DayScheduleItem[] {
  const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const currentDayIndex = istDate.getDay();
  const currentDayKey = DAYS_OF_WEEK[currentDayIndex];

  return DISPLAY_DAYS.map((displayDay) => {
    const key = displayDay.toLowerCase();
    const isToday = key === currentDayKey;

    if (!openingHours || !openingHours[key]) {
      return {
        day: displayDay,
        hours: "09:30 AM - 09:30 PM",
        isToday,
        openTime: "09:30 AM",
        closeTime: "09:30 PM",
        isClosed: false,
      };
    }

    const conf = openingHours[key];
    if (conf.closed) {
      return {
        day: displayDay,
        hours: "Closed",
        isToday,
        isClosed: true,
      };
    }

    const openTime = formatTo12Hour(conf.open || "09:30");
    const closeTime = formatTo12Hour(conf.close || "21:30");

    return {
      day: displayDay,
      hours: `${openTime} - ${closeTime}`,
      isToday,
      openTime,
      closeTime,
      isClosed: false,
    };
  });
}

/**
 * Generates rating summary distribution breakdown based on store rating and review count.
 */
export function generateRatingSummary(
  rating: number,
  reviewCount: number
): RatingSummaryResult {
  const numRating = Number(rating) || 0;
  const numReviews = Number(reviewCount) || 0;

  if (numReviews === 0) {
    return {
      averageRating: numRating,
      totalReviews: 0,
      distribution: [
        { stars: 5, count: 0, percentage: 0 },
        { stars: 4, count: 0, percentage: 0 },
        { stars: 3, count: 0, percentage: 0 },
        { stars: 2, count: 0, percentage: 0 },
        { stars: 1, count: 0, percentage: 0 },
      ],
    };
  }

  // Realistic consumer distribution curves
  let p5 = 0.65;
  let p4 = 0.22;
  let p3 = 0.08;
  let p2 = 0.03;
  let p1 = 0.02;

  if (numRating >= 4.8) {
    p5 = 0.82; p4 = 0.13; p3 = 0.03; p2 = 0.01; p1 = 0.01;
  } else if (numRating >= 4.5) {
    p5 = 0.72; p4 = 0.18; p3 = 0.06; p2 = 0.02; p1 = 0.02;
  } else if (numRating >= 4.0) {
    p5 = 0.55; p4 = 0.28; p3 = 0.11; p2 = 0.04; p1 = 0.02;
  } else if (numRating >= 3.5) {
    p5 = 0.40; p4 = 0.30; p3 = 0.18; p2 = 0.08; p1 = 0.04;
  } else {
    p5 = 0.25; p4 = 0.25; p3 = 0.25; p2 = 0.15; p1 = 0.10;
  }

  const c5 = Math.round(numReviews * p5);
  const c4 = Math.round(numReviews * p4);
  const c3 = Math.round(numReviews * p3);
  const c2 = Math.round(numReviews * p2);
  const c1 = Math.max(0, numReviews - (c5 + c4 + c3 + c2));

  return {
    averageRating: Math.round(numRating * 10) / 10,
    totalReviews: numReviews,
    distribution: [
      { stars: 5, count: c5, percentage: Math.round((c5 / numReviews) * 100) },
      { stars: 4, count: c4, percentage: Math.round((c4 / numReviews) * 100) },
      { stars: 3, count: c3, percentage: Math.round((c3 / numReviews) * 100) },
      { stars: 2, count: c2, percentage: Math.round((c2 / numReviews) * 100) },
      { stars: 1, count: c1, percentage: Math.round((c1 / numReviews) * 100) },
    ],
  };
}

/**
 * Generates context-aware amenities based on shop category.
 */
export function getStandardShopAmenities(category: string): ShopAmenityItem[] {
  const commonAmenities: ShopAmenityItem[] = [
    {
      id: "upi_cards",
      icon: "payments",
      title: "UPI & Digital Payments",
      description: "GPay, PhonePe, Paytm, and all major Credit/Debit Cards accepted",
    },
    {
      id: "in_store_shopping",
      icon: "storefront",
      title: "In-Store Shopping",
      description: "Direct retail walk-in experience with physical catalog browsing",
    },
    {
      id: "doorstep_delivery",
      icon: "local_shipping",
      title: "Home Delivery",
      description: "Fast local delivery available within city limits",
    },
  ];

  const catLower = (category || "").toLowerCase();

  if (catLower.includes("fashion") || catLower.includes("ethnic") || catLower.includes("saree") || catLower.includes("wear")) {
    return [
      ...commonAmenities,
      {
        id: "fitting_room",
        icon: "checkroom",
        title: "Trail & Fitting Rooms",
        description: "Spacious private fitting areas with full-length mirror setup",
      },
      {
        id: "alteration",
        icon: "content_cut",
        title: "Alteration Services",
        description: "On-site master tailor available for sizing adjustments",
      },
    ];
  }

  if (catLower.includes("electronics") || catLower.includes("mobile")) {
    return [
      ...commonAmenities,
      {
        id: "warranty_support",
        icon: "verified_user",
        title: "Brand Warranty Support",
        description: "Official authorized bill & brand manufacturer warranty",
      },
      {
        id: "instant_setup",
        icon: "build",
        title: "Instant Setup & Glass Fitting",
        description: "Quick tempered glass mounting and phone data migration",
      },
    ];
  }

  if (catLower.includes("grocery") || catLower.includes("supermarket")) {
    return [
      ...commonAmenities,
      {
        id: "quality_checked",
        icon: "eco",
        title: "Fresh & Checked",
        description: "Daily freshness guarantee with unadulterated staples",
      },
      {
        id: "instant_billing",
        icon: "receipt_long",
        title: "Express Billing Counter",
        description: "Barcode scanning for ultra-fast checkout",
      },
    ];
  }

  return commonAmenities;
}
