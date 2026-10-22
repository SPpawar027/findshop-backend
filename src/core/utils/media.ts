/**
 * Utility to resolve relative storage keys (e.g. shops/1/logo/abc.webp)
 * to absolute URLs using the configured CDN or S3 endpoint.
 */

export function getFullMediaUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;

  // If already an absolute URL (e.g. placeholder, external URL), return as-is
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  const baseCdnUrl = (process.env.MEDIA_CDN_URL || "").replace(/\/+$/, "");
  const cleanPath = pathOrUrl.replace(/^\/+/, "");

  if (!baseCdnUrl) {
    // Fallback if no CDN or S3 bucket is configured yet
    return `/${cleanPath}`;
  }

  return `${baseCdnUrl}/${cleanPath}`;
}

export function formatMediaUrls<T extends Record<string, any>>(entity: T): T {
  if (!entity) return entity;
  const json = typeof entity.toJSON === "function" ? entity.toJSON() : { ...entity };

  // Format shop media
  if ("bannerUrl" in json) {
    json.bannerUrl = getFullMediaUrl(json.bannerUrl);
  }
  if ("logoUrl" in json) {
    json.logoUrl = getFullMediaUrl(json.logoUrl);
  }

  // Format product media
  if ("images" in json && Array.isArray(json.images)) {
    json.images = json.images.map((img: string) => getFullMediaUrl(img));
  }

  return json as T;
}
