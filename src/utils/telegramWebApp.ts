import type { CustomerOrder, StoreProduct, WorkshopStoreSettings } from '../types/storefront';
import { resolveApiUrl } from './apiBase';

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  phone_number?: string;
}

export interface TelegramContactEvent {
  status?: 'sent' | 'cancelled';
  response?: string;
  responseUnsafe?: {
    contact?: {
      phone_number?: string;
      first_name?: string;
      last_name?: string;
      user_id?: number;
    };
  };
}

export interface TelegramWebAppInstance {
  initData: string;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  colorScheme?: 'light' | 'dark';
  isExpanded?: boolean;
  isFullscreen?: boolean;
  viewportHeight?: number;
  viewportStableHeight?: number;
  version?: string;
  isVersionAtLeast?: (version: string) => boolean;
  ready: () => void;
  expand: () => void;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  requestContact?: (callback?: (sent: boolean, event?: TelegramContactEvent) => void) => void;
  onEvent?: (eventType: string, callback: (eventData?: any) => void) => void;
  offEvent?: (eventType: string, callback: (eventData?: any) => void) => void;
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
  };
}

const TELEGRAM_PHONE_CACHE_KEY = 'safari_telegram_verified_phone_v1';

interface CachedTelegramPhone {
  userId?: number;
  phoneNumber: string;
  fullName?: string;
  username?: string;
  updatedAt: string;
}

export interface VerifiedTelegramUserEntry {
  telegramUserId: string;
  phoneNumber: string;
  fullName: string;
  username: string;
  updatedAt: string;
}

export function normalizeTelegramIranPhone(raw: unknown): string {
  const converted = String(raw ?? '')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[\s\-().]/g, '')
    .trim();
  if (!converted) return '';
  if (/^\+989\d{9}$/.test(converted)) return `0${converted.slice(3)}`;
  if (/^00989\d{9}$/.test(converted)) return `0${converted.slice(4)}`;
  if (/^989\d{9}$/.test(converted)) return `0${converted.slice(2)}`;
  if (/^9\d{9}$/.test(converted)) return `0${converted}`;
  return converted;
}

function readTelegramUrlParams(): {
  phoneNumber: string;
  userId?: number;
  username?: string;
  fullName?: string;
} {
  if (typeof window === 'undefined') {
    return { phoneNumber: '' };
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const phoneNumber = normalizeTelegramIranPhone(params.get('tg_phone'));
    const uidRaw = (params.get('tg_uid') || '').trim();
    const userId = /^\d{4,20}$/.test(uidRaw) ? Number(uidRaw) : undefined;
    const username = (params.get('tg_username') || '').trim() || undefined;
    const fullName = (params.get('tg_name') || '').trim() || undefined;
    return {
      phoneNumber: phoneNumber.length >= 10 ? phoneNumber : '',
      userId,
      username,
      fullName,
    };
  } catch {
    return { phoneNumber: '' };
  }
}

function readCachedTelegramRecord(): CachedTelegramPhone | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TELEGRAM_PHONE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedTelegramPhone;
  } catch {
    return null;
  }
}

export function getTelegramWebApp(): TelegramWebAppInstance | null {
  if (typeof window === 'undefined') return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebAppInstance } }).Telegram?.WebApp;
  return tg && typeof tg.ready === 'function' ? tg : null;
}

export function isInsideTelegramWebApp(): boolean {
  const tg = getTelegramWebApp();
  if (tg && (tg.initData || tg.initDataUnsafe?.user)) return true;
  const urlInfo = readTelegramUrlParams();
  if (urlInfo.phoneNumber || urlInfo.userId) return true;
  const cached = readCachedTelegramRecord();
  return Boolean(cached?.userId || cached?.phoneNumber);
}

export function getTelegramCustomerProfile(): {
  id: number;
  fullName: string;
  username?: string;
  phoneNumber?: string;
} | null {
  const tg = getTelegramWebApp();
  const u = tg?.initDataUnsafe?.user;
  const urlInfo = readTelegramUrlParams();
  const cached = readCachedTelegramRecord();

  if (u && typeof u.id === 'number') {
    const fullName =
      [u.first_name, u.last_name].filter(Boolean).join(' ').trim() ||
      urlInfo.fullName ||
      u.username ||
      'کاربر تلگرام';
    const rawPhone = u.phone_number || urlInfo.phoneNumber || '';
    const normalizedPhone = normalizeTelegramIranPhone(rawPhone);
    return {
      id: u.id,
      fullName,
      username: u.username || urlInfo.username,
      phoneNumber: normalizedPhone.length >= 10 ? normalizedPhone : undefined,
    };
  }

  const fallbackId = urlInfo.userId ?? cached?.userId;
  if (typeof fallbackId === 'number' && fallbackId > 0) {
    return {
      id: fallbackId,
      fullName: urlInfo.fullName || cached?.fullName || urlInfo.username || cached?.username || 'کاربر تلگرام',
      username: urlInfo.username || cached?.username,
      phoneNumber: urlInfo.phoneNumber || (cached?.phoneNumber && cached.phoneNumber.length >= 10 ? cached.phoneNumber : undefined),
    };
  }

  return null;
}

export function getCachedTelegramPhone(): string {
  if (typeof window === 'undefined') return '';
  const profile = getTelegramCustomerProfile();
  if (profile?.phoneNumber) return profile.phoneNumber;

  const urlInfo = readTelegramUrlParams();
  if (urlInfo.phoneNumber) return urlInfo.phoneNumber;

  const parsed = readCachedTelegramRecord();
  if (!parsed?.phoneNumber) return '';
  if (profile?.id && parsed.userId && parsed.userId !== profile.id) {
    return '';
  }
  return normalizeTelegramIranPhone(parsed.phoneNumber);
}

export function setCachedTelegramPhone(
  rawPhone: string,
  userId?: number,
  fullName?: string,
  username?: string
): string {
  const normalized = normalizeTelegramIranPhone(rawPhone);
  if (typeof window === 'undefined' || normalized.length < 10) return '';
  const profile = getTelegramCustomerProfile();
  const resolvedId = userId ?? profile?.id;
  try {
    const existing = readCachedTelegramRecord();
    const payload: CachedTelegramPhone = {
      userId: resolvedId ?? existing?.userId,
      phoneNumber: normalized,
      fullName: fullName || profile?.fullName || existing?.fullName,
      username: username || profile?.username || existing?.username,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(TELEGRAM_PHONE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
  return normalized;
}

export async function syncTelegramPhoneToServer(
  rawPhone: string,
  fullName?: string,
  username?: string
): Promise<string> {
  const normalized = setCachedTelegramPhone(rawPhone, undefined, fullName, username);
  if (!normalized || !isInsideTelegramWebApp()) return normalized;

  const tg = getTelegramWebApp();
  const profile = getTelegramCustomerProfile();
  try {
    await fetch(resolveApiUrl('/api/telegram/save-webapp-phone'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: tg?.initData || '',
        telegramUserId: profile?.id,
        phoneNumber: normalized,
        fullName: fullName || profile?.fullName || '',
        username: username || profile?.username || '',
      }),
    });
  } catch {
    // non-fatal background save
  }
  return normalized;
}

export async function resolveTelegramUserPhoneFromServer(): Promise<{
  phoneNumber: string;
  fullName: string;
  username?: string;
  telegramUserId?: string;
}> {
  const profile = getTelegramCustomerProfile();
  const cached = getCachedTelegramPhone();
  if (!isInsideTelegramWebApp()) {
    return {
      phoneNumber: cached,
      fullName: profile?.fullName || '',
      username: profile?.username,
      telegramUserId: profile?.id ? String(profile.id) : undefined,
    };
  }

  const tg = getTelegramWebApp();
  try {
    const resp = await fetch(resolveApiUrl('/api/telegram/webapp-phone'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: tg?.initData || '',
        telegramUserId: profile?.id,
      }),
    });
    if (resp.ok) {
      const json = (await resp.json().catch(() => null)) as {
        ok?: boolean;
        phoneNumber?: string;
        fullName?: string;
        username?: string;
        telegramUserId?: string;
      } | null;
      const serverPhone = normalizeTelegramIranPhone(json?.phoneNumber);
      if (serverPhone.length >= 10) {
        setCachedTelegramPhone(
          serverPhone,
          profile?.id ?? (json?.telegramUserId ? Number(json.telegramUserId) : undefined),
          json?.fullName || profile?.fullName,
          json?.username || profile?.username
        );
        return {
          phoneNumber: serverPhone,
          fullName: json?.fullName || profile?.fullName || '',
          username: json?.username || profile?.username,
          telegramUserId: json?.telegramUserId || (profile?.id ? String(profile.id) : undefined),
        };
      }
    }
  } catch {
    // fallback to local cache below
  }

  return {
    phoneNumber: cached,
    fullName: profile?.fullName || '',
    username: profile?.username,
    telegramUserId: profile?.id ? String(profile.id) : undefined,
  };
}

export async function fetchVerifiedTelegramUsersFromServer(): Promise<VerifiedTelegramUserEntry[]> {
  try {
    const resp = await fetch(resolveApiUrl('/api/telegram/verified-phones'));
    if (!resp.ok) return [];
    const json = (await resp.json().catch(() => null)) as {
      ok?: boolean;
      phones?: VerifiedTelegramUserEntry[];
    } | null;
    return Array.isArray(json?.phones) ? json!.phones : [];
  } catch {
    return [];
  }
}

export function canRequestTelegramMiniAppContact(): boolean {
  const tg = getTelegramWebApp();
  return Boolean(tg && isInsideTelegramWebApp() && typeof tg.requestContact === 'function');
}

export async function requestTelegramMiniAppContact(): Promise<string | null> {
  const tg = getTelegramWebApp();
  if (!tg || !isInsideTelegramWebApp() || typeof tg.requestContact !== 'function') {
    const cached = getCachedTelegramPhone();
    return cached || null;
  }

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (phone: string | null) => {
      if (settled) return;
      settled = true;
      resolve(phone);
    };

    const timeoutId = setTimeout(() => {
      const cached = getCachedTelegramPhone();
      finish(cached || null);
    }, 15000);

    try {
      tg.requestContact?.(async (sent, event) => {
        clearTimeout(timeoutId);
        if (!sent) {
          finish(null);
          return;
        }

        const directRaw = event?.responseUnsafe?.contact?.phone_number || '';
        const directNormalized = normalizeTelegramIranPhone(directRaw);
        if (directNormalized.length >= 10) {
          const contactName = [
            event?.responseUnsafe?.contact?.first_name,
            event?.responseUnsafe?.contact?.last_name,
          ]
            .filter(Boolean)
            .join(' ')
            .trim();
          await syncTelegramPhoneToServer(directNormalized, contactName || undefined);
          finish(directNormalized);
          return;
        }

        // Wait briefly for Telegram server webhook/polling to receive msg.contact from user
        for (const delay of [350, 650, 1000]) {
          await new Promise((r) => setTimeout(r, delay));
          const resolved = await resolveTelegramUserPhoneFromServer();
          if (resolved.phoneNumber.length >= 10) {
            finish(resolved.phoneNumber);
            return;
          }
        }
        finish(null);
      });
    } catch {
      clearTimeout(timeoutId);
      finish(null);
    }
  });
}

export type StorefrontLaunchTarget = {
  tab?: 'catalog' | 'calculator' | 'tips' | 'weather' | 'cart' | 'orders' | 'profile';
  productId?: string;
  quickBuy?: boolean;
};

export function resolveTelegramOrUrlLaunchTarget(): StorefrontLaunchTarget {
  if (typeof window === 'undefined') return {};
  const result: StorefrontLaunchTarget = {};
  const validTabs = new Set(['catalog', 'calculator', 'tips', 'weather', 'cart', 'orders', 'profile']);

  try {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') || '';
    if (validTabs.has(tabParam)) {
      result.tab = tabParam as StorefrontLaunchTarget['tab'];
    }
    const prodParam = params.get('product') || '';
    if (prodParam) {
      result.productId = prodParam;
    }
    if (params.get('quickbuy') === '1' || params.get('drawer') === '1') {
      result.quickBuy = true;
    }

    const startParam = getTelegramWebApp()?.initDataUnsafe?.start_param || '';
    if (startParam.startsWith('tab_')) {
      const candidate = startParam.slice(4);
      if (validTabs.has(candidate)) {
        result.tab = candidate as StorefrontLaunchTarget['tab'];
      }
    } else if (startParam.startsWith('prod_')) {
      result.tab = 'catalog';
      result.productId = startParam.slice(5);
    } else if (startParam.startsWith('buy_')) {
      result.tab = 'catalog';
      result.productId = startParam.slice(4);
      result.quickBuy = true;
    }
  } catch {
    // ignore URL parse errors
  }

  return result;
}

export function buildProductDrawerWebAppUrl(
  baseUrl: string,
  productId: string,
  options?: { quickBuy?: boolean; apiBaseUrl?: string }
): string {
  try {
    const u = new URL(baseUrl);
    u.searchParams.set('tab', 'catalog');
    u.searchParams.set('product', productId);
    if (options?.quickBuy) {
      u.searchParams.set('quickbuy', '1');
    }
    if (options?.apiBaseUrl && /^https?:\/\//i.test(options.apiBaseUrl)) {
      u.searchParams.set('api', options.apiBaseUrl.replace(/\/+$/, ''));
    }
    return u.toString();
  } catch {
    return baseUrl;
  }
}

let tgViewportBound = false;

export function requestTelegramViewportExpand(allowFullscreen = true): void {
  const tg = getTelegramWebApp();
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    if (typeof tg.disableVerticalSwipes === 'function') {
      if (!tg.isVersionAtLeast || tg.isVersionAtLeast('7.7')) {
        tg.disableVerticalSwipes();
      }
    }
    if (
      allowFullscreen &&
      typeof tg.requestFullscreen === 'function' &&
      (!tg.isVersionAtLeast || tg.isVersionAtLeast('8.0')) &&
      !tg.isFullscreen
    ) {
      tg.requestFullscreen();
    }
  } catch {
    // ignore unsupported Telegram client method calls
  }
}

export function initTelegramMiniApp(): boolean {
  const tg = getTelegramWebApp();
  if (tg) {
    requestTelegramViewportExpand(true);

    // Retry expansion shortly after Telegram WebView finishes layout transitions
    for (const delay of [80, 280, 750]) {
      setTimeout(() => requestTelegramViewportExpand(false), delay);
    }

    if (!tgViewportBound && typeof tg.onEvent === 'function') {
      tgViewportBound = true;
      tg.onEvent('viewportChanged', () => {
        try {
          if (!tg.isExpanded) {
            tg.expand();
          }
        } catch {
          // ignore
        }
      });
    }
  }

  const urlInfo = readTelegramUrlParams();
  if (urlInfo.phoneNumber) {
    setCachedTelegramPhone(urlInfo.phoneNumber, urlInfo.userId, urlInfo.fullName, urlInfo.username);
  }
  return isInsideTelegramWebApp();
}

export function syncTelegramMiniAppTheme(isDark: boolean): void {
  const tg = getTelegramWebApp();
  if (!tg || !isInsideTelegramWebApp()) return;
  try {
    tg.setHeaderColor?.(isDark ? '#0c0a09' : '#065f46');
    tg.setBackgroundColor?.(isDark ? '#0c0a09' : '#f5f5f4');
  } catch {
    // ignore unsupported client versions
  }
}

export function triggerTelegramHaptic(kind: 'light' | 'medium' | 'success'): void {
  const tg = getTelegramWebApp();
  if (!tg?.HapticFeedback) return;
  try {
    if (kind === 'success') {
      tg.HapticFeedback.notificationOccurred?.('success');
    } else {
      tg.HapticFeedback.impactOccurred?.(kind);
    }
  } catch {
    // ignore
  }
}

export async function syncStoreSnapshotToTelegramServer(payload: {
  settings?: Partial<WorkshopStoreSettings>;
  productOverrides?: Record<string, Partial<StoreProduct>>;
  orders?: CustomerOrder[];
}): Promise<void> {
  try {
    await fetch(resolveApiUrl('/api/telegram/sync-state'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // non-fatal background sync
  }
}

export async function notifyServerTelegramNewOrder(order: CustomerOrder): Promise<void> {
  try {
    const tgProfile = getTelegramCustomerProfile();
    await fetch(resolveApiUrl('/api/telegram/notify-order'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order,
        telegramUserId: tgProfile?.id,
      }),
    });
  } catch {
    // non-fatal background notification
  }
}
