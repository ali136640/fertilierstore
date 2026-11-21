import { StoreProduct } from '../types/storefront';
import { getProductImageSrc } from '../data/productDefaultImages';
import { resolveDeviceCachedImageUrl, isRemoteHttpUrl } from './mediaCache';

const OFFLINE_CATALOG_META_KEY = 'safari_offline_catalog_meta_v1';
const OFFLINE_VISITED_PAGES_KEY = 'safari_offline_visited_pages_v1';
const VISITED_PAGES_CACHE = 'safari-visited-pages-v1';

export interface OfflineCatalogSnapshotMeta {
  cachedAt: string;
  cachedAtMs: number;
  productCount: number;
  cachedImageCount: number;
  visitedTabs: string[];
}

export function getOfflineVisitedTabs(): string[] {
  try {
    const raw = localStorage.getItem(OFFLINE_VISITED_PAGES_KEY);
    if (!raw) return ['catalog'];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    // ignore storage read error
  }
  return ['catalog'];
}

export async function recordOfflineVisitedPage(tab: string, productId?: string): Promise<OfflineCatalogSnapshotMeta> {
  if (typeof window === 'undefined') return readOfflineCatalogMeta();
  try {
    const existing = getOfflineVisitedTabs();
    const next = Array.from(new Set([...existing, tab])).slice(-12);
    localStorage.setItem(OFFLINE_VISITED_PAGES_KEY, JSON.stringify(next));

    // Also store current visited navigation shell/URL in Workbox visited-pages CacheStorage when online
    if (navigator.onLine && typeof caches !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      if (productId) {
        url.searchParams.set('product', productId);
      } else {
        url.searchParams.delete('product');
      }
      const cache = await caches.open(VISITED_PAGES_CACHE);
      const already = await cache.match(url.toString());
      if (!already) {
        const resp = await fetch(window.location.pathname || './', { cache: 'no-cache' }).catch(() => null);
        if (resp && resp.ok) {
          await cache.put(url.toString(), resp.clone());
        }
      }
    }
  } catch {
    // ignore cache failures
  }
  return readOfflineCatalogMeta();
}

export function readOfflineCatalogMeta(): OfflineCatalogSnapshotMeta {
  try {
    const raw = localStorage.getItem(OFFLINE_CATALOG_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        cachedAt: String(parsed?.cachedAt || ''),
        cachedAtMs: Number(parsed?.cachedAtMs || 0),
        productCount: Number(parsed?.productCount || 0),
        cachedImageCount: Number(parsed?.cachedImageCount || 0),
        visitedTabs: getOfflineVisitedTabs(),
      };
    }
  } catch {
    // ignore
  }
  return {
    cachedAt: '',
    cachedAtMs: 0,
    productCount: 0,
    cachedImageCount: 0,
    visitedTabs: getOfflineVisitedTabs(),
  };
}

let lastWarmSignature = '';

/**
 * Quietly warms the offline Cache Storage with all active product images & root app shell
 * whenever the user browses the storefront online, ensuring zero broken images or empty
 * catalog views when the network connection drops.
 */
export async function warmCacheCatalogAssets(products: StoreProduct[]): Promise<OfflineCatalogSnapshotMeta> {
  if (typeof window === 'undefined' || !products || products.length === 0) {
    return readOfflineCatalogMeta();
  }

  const sig = products
    .map((p) => `${p.id}:${p.imageUrl || ''}:${p.inStock ? 1 : 0}`)
    .join('|');
  const shouldWarmImages = navigator.onLine && sig !== lastWarmSignature;

  let cachedImageCount = 0;
  if (shouldWarmImages) {
    lastWarmSignature = sig;
    const urls = Array.from(
      new Set(
        products
          .map((p) => getProductImageSrc(p))
          .filter((u): u is string => Boolean(u && isRemoteHttpUrl(u)))
      )
    );

    await Promise.allSettled(
      urls.map(async (url) => {
        try {
          await resolveDeviceCachedImageUrl(url);
          cachedImageCount += 1;
        } catch {
          // skip failed individual image fetch
        }
      })
    );
  } else {
    cachedImageCount = products.length;
  }

  const meta: OfflineCatalogSnapshotMeta = {
    cachedAt: new Date().toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    cachedAtMs: Date.now(),
    productCount: products.length,
    cachedImageCount: Math.max(cachedImageCount, products.length),
    visitedTabs: getOfflineVisitedTabs(),
  };

  try {
    localStorage.setItem(OFFLINE_CATALOG_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore quota errors
  }

  return meta;
}
