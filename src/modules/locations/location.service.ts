export interface ReverseGeocodeResult {
  latitude: number;
  longitude: number;
  locality: string;
  city: string;
  state: string;
  pincode?: string;
  formattedAddress: string;
  source: "bigdatacloud" | "nominatim" | "centroid" | "cache";
}

export interface PlaceSearchResult {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

const PREDEFINED_INDIAN_HUBS = [
  { name: "Rau", district: "Indore", state: "Madhya Pradesh", lat: 22.6284, lng: 75.8080 },
  { name: "Indore", district: "Indore", state: "Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
  { name: "Mhow", district: "Indore", state: "Madhya Pradesh", lat: 22.5539, lng: 75.7600 },
  { name: "Ujjain", district: "Ujjain", state: "Madhya Pradesh", lat: 23.1765, lng: 75.7885 },
  { name: "Dewas", district: "Dewas", state: "Madhya Pradesh", lat: 22.9676, lng: 76.0534 },
  { name: "Bhopal", district: "Bhopal", state: "Madhya Pradesh", lat: 23.2599, lng: 77.4126 },
  { name: "Betul", district: "Betul", state: "Madhya Pradesh", lat: 21.9014, lng: 77.9015 },
  { name: "Hoshangabad", district: "Narmadapuram", state: "Madhya Pradesh", lat: 22.7519, lng: 77.7289 },
  { name: "Jabalpur", district: "Jabalpur", state: "Madhya Pradesh", lat: 23.1815, lng: 79.9864 },
  { name: "Gwalior", district: "Gwalior", state: "Madhya Pradesh", lat: 26.2183, lng: 78.1828 },
  { name: "Sagar", district: "Sagar", state: "Madhya Pradesh", lat: 23.8388, lng: 78.7378 },
  { name: "Nagpur", district: "Nagpur", state: "Maharashtra", lat: 21.1458, lng: 79.0882 },
  { name: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { name: "Mumbai", district: "Mumbai City", state: "Maharashtra", lat: 19.0760, lng: 72.8777 },
  { name: "Pune", district: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { name: "Delhi", district: "New Delhi", state: "Delhi NCR", lat: 28.6139, lng: 77.2090 },
  { name: "Hyderabad", district: "Hyderabad", state: "Telangana", lat: 17.3850, lng: 78.4867 },
  { name: "Chennai", district: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", district: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
  { name: "Ahmedabad", district: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
  { name: "Jaipur", district: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  { name: "Lucknow", district: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  { name: "Chandigarh", district: "Chandigarh", state: "Punjab", lat: 30.7333, lng: 76.7794 },
];

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class LocationService {
  private reverseCache = new Map<string, { result: ReverseGeocodeResult; expiresAt: number }>();
  private searchCache = new Map<string, { result: PlaceSearchResult[]; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Multi-provider reverse geocoding:
   * 1. Cache hit (~1ms)
   * 2. BigDataCloud client API (Fast, Free, CORS-friendly)
   * 3. OpenStreetMap Nominatim API (with server-side User-Agent & 3.5s timeout)
   * 4. Predefined Indian city centroid fallback (0 downtime guarantee)
   */
  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
    const now = Date.now();

    const cached = this.reverseCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return { ...cached.result, source: "cache" };
    }

    // Provider 1: BigDataCloud Reverse Geocoding Client API
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
      const res = await fetch(bdcUrl, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const localityInfo = (data.localityInfo as Record<string, unknown>) || {};
        const adminArray = Array.isArray(localityInfo.administrative)
          ? (localityInfo.administrative as Array<Record<string, unknown>>)
          : [];

        // Extract district or division
        const districtObj = adminArray.find((item) =>
          typeof item.name === "string" &&
          (item.name.toLowerCase().includes("district") || item.name.toLowerCase().includes("division"))
        );
        const districtName = districtObj && typeof districtObj.name === "string"
          ? districtObj.name.replace(/district/gi, "").trim()
          : "";

        const city =
          (data.city as string) ||
          districtName ||
          (data.principalSubdivision as string) ||
          "Indore";

        const locality =
          (data.locality as string) ||
          (data.city as string) ||
          districtName ||
          "Nearby Area";

        const state = (data.principalSubdivision as string) || "Madhya Pradesh";
        const pincode = typeof data.postcode === "string" && data.postcode ? data.postcode : undefined;
        const formattedAddress = `${locality}, ${city}, ${state}`;

        const result: ReverseGeocodeResult = {
          latitude: lat,
          longitude: lng,
          locality,
          city,
          state,
          pincode,
          formattedAddress,
          source: "bigdatacloud",
        };

        this.reverseCache.set(cacheKey, { result, expiresAt: now + this.CACHE_TTL_MS });
        return result;
      }
    } catch (err) {
      console.warn("[LocationService] BigDataCloud reverse geocode failed or timed out:", err);
    }

    // Provider 2: OpenStreetMap Nominatim with server-side User-Agent
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const res = await fetch(osmUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "FindShopEasily-Server/1.0 (contact@findshopeasily.com)",
          "Accept-Language": "en",
        },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const addr = (data.address as Record<string, unknown>) || {};

        const locality =
          (addr.suburb as string) ||
          (addr.neighbourhood as string) ||
          (addr.residential as string) ||
          (addr.commercial as string) ||
          (addr.road as string) ||
          "Nearby Area";

        const city =
          (addr.city as string) ||
          (addr.town as string) ||
          (addr.village as string) ||
          (addr.county as string) ||
          "Indore";

        const state = (addr.state as string) || "Madhya Pradesh";
        const pincode = typeof addr.postcode === "string" ? addr.postcode : undefined;
        const formattedAddress = `${locality}, ${city}, ${state}`;

        const result: ReverseGeocodeResult = {
          latitude: lat,
          longitude: lng,
          locality,
          city,
          state,
          pincode,
          formattedAddress,
          source: "nominatim",
        };

        this.reverseCache.set(cacheKey, { result, expiresAt: now + this.CACHE_TTL_MS });
        return result;
      }
    } catch (err) {
      console.warn("[LocationService] Nominatim reverse geocode failed or timed out:", err);
    }

    // Provider 3: Predefined Indian city centroid fallback
    let closestHub = PREDEFINED_INDIAN_HUBS[0];
    let minDistance = Infinity;

    for (const hub of PREDEFINED_INDIAN_HUBS) {
      const dist = haversineDistanceKm(lat, lng, hub.lat, hub.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestHub = hub;
      }
    }

    const locality = minDistance <= 30 ? closestHub.name : `${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E`;
    const city = closestHub.name;
    const state = closestHub.state;
    const formattedAddress = `${locality}, ${city}, ${state}`;

    const fallbackResult: ReverseGeocodeResult = {
      latitude: lat,
      longitude: lng,
      locality,
      city,
      state,
      formattedAddress,
      source: "centroid",
    };

    return fallbackResult;
  }

  /**
   * Search places by text query with server-side caching and compliant User-Agent
   */
  async searchPlaces(query: string): Promise<PlaceSearchResult[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (cleanQuery.length < 2) return [];

    const now = Date.now();
    const cached = this.searchCache.get(cleanQuery);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    // Try OSM Nominatim Search with server User-Agent
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        cleanQuery
      )}&countrycodes=in&limit=8&addressdetails=1`;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "FindShopEasily-Server/1.0 (contact@findshopeasily.com)",
          "Accept-Language": "en",
        },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as PlaceSearchResult[];
        if (Array.isArray(data) && data.length > 0) {
          this.searchCache.set(cleanQuery, { result: data, expiresAt: now + this.CACHE_TTL_MS });
          return data;
        }
      }
    } catch (err) {
      console.warn("[LocationService] Nominatim place search error:", err);
    }

    // Fallback: match predefined Indian hubs
    const matched = PREDEFINED_INDIAN_HUBS.filter(
      (hub) =>
        hub.name.toLowerCase().includes(cleanQuery) ||
        hub.district.toLowerCase().includes(cleanQuery) ||
        hub.state.toLowerCase().includes(cleanQuery)
    ).map((hub, idx) => ({
      place_id: 990000 + idx,
      display_name: `${hub.name}, ${hub.district}, ${hub.state}, India`,
      lat: String(hub.lat),
      lon: String(hub.lng),
      name: hub.name,
    }));

    return matched;
  }
}

export const locationService = new LocationService();
