import { resolveApiUrl } from './apiBase';

const IMAGE_CACHE_NAME = 'safari-product-images-v1';
const OPENED_PRODUCTS_STORAGE_KEY = 'safari_device_opened_products_v1';
const SITE_PRELOAD_VERSION_KEY = 'safari_site_preloaded_version_v1';

const resolvedBlobUrlMap = new Map<string, string>();
const inFlightImageFetches = new Map<string, Promise<string>>();

export function isRemoteHttpUrl(url?: string | null): boolean {
  return Boolean(url && (/^https?:\/\//i.test(url.trim()) || url.trim().startsWith('/api/telegram/db/media/')));
}

export function getOpenedProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem(OPENED_PRODUCTS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === 'string'));
    }
  } catch {
    // ignore storage errors
  }
  return new Set();
}

export function isProductOpenedBefore(productId: string): boolean {
  return getOpenedProductIds().has(productId);
}

export function markProductOpened(productId: string): void {
  if (!productId) return;
  try {
    const current = getOpenedProductIds();
    if (current.has(productId)) return;
    current.add(productId);
    localStorage.setItem(OPENED_PRODUCTS_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore storage quota errors
  }
}

export function hasDeviceCompletedInitialPreload(coreVersion: string): boolean {
  try {
    return localStorage.getItem(SITE_PRELOAD_VERSION_KEY) === coreVersion;
  } catch {
    return false;
  }
}

export function markDeviceCompletedInitialPreload(coreVersion: string): void {
  try {
    localStorage.setItem(SITE_PRELOAD_VERSION_KEY, coreVersion);
  } catch {
    // ignore
  }
}

/**
 * Resolves a remote product image strictly from the device's Cache Storage if previously cached,
 * or fetches & persists it once on first open so subsequent app opens incur zero online image traffic.
 * Local bundled assets (/assets/..., /pwa-...) and data URIs bypass fetch completely.
 */
export async function resolveDeviceCachedImageUrl(url: string): Promise<string> {
  const cleanUrl = (url || '').trim();
  if (!cleanUrl || !isRemoteHttpUrl(cleanUrl)) {
    return cleanUrl;
  }

  const targetUrl = resolveApiUrl(cleanUrl);

  const existingBlob = resolvedBlobUrlMap.get(targetUrl);
  if (existingBlob) {
    return existingBlob;
  }

  const pending = inFlightImageFetches.get(targetUrl);
  if (pending) {
    return pending;
  }

  const task = (async (): Promise<string> => {
    try {
      if (typeof caches !== 'undefined') {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const cachedResp = await cache.match(targetUrl);
        if (cachedResp) {
          const blob = await cachedResp.blob();
          const blobUrl = URL.createObjectURL(blob);
          resolvedBlobUrlMap.set(targetUrl, blobUrl);
          return blobUrl;
        }

        // Not cached on this device yet: fetch once and store permanently in Cache Storage
        const networkResp = await fetch(targetUrl, { mode: 'cors' });
        if (networkResp.ok) {
          await cache.put(targetUrl, networkResp.clone());
          const blob = await networkResp.blob();
          const blobUrl = URL.createObjectURL(blob);
          resolvedBlobUrlMap.set(targetUrl, blobUrl);
          return blobUrl;
        }
      }
    } catch {
      // Fall back to direct URL if CORS/Cache API blocks cloning
    } finally {
      inFlightImageFetches.delete(targetUrl);
    }
    return targetUrl;
  })();

  inFlightImageFetches.set(targetUrl, task);
  return task;
}
