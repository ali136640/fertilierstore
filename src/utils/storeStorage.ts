import {
  CustomerOrder,
  StoreProduct,
  UserAccount,
  OrderStatus,
  WorkshopStoreSettings,
  PendingCloudSyncFlags,
} from '../types/storefront';
import {
  loadWorkshopData,
  saveWorkshopData,
  normalizeWorkshopState,
} from './storage';
import {
  buildClientTelegramFileStamp,
  formatClientBackupDateTimeLabel,
} from './deviceTime';
import { writeVoiceClipIndexFromBootstrap, VoiceClipIndexEntry } from './voiceClipStorage';
import { WorkshopAppState } from '../types/vermicompost';
import {
  resolveApiUrl,
  normalizeBaseUrl,
  isStaticHostingEnvironment,
  resolveGithubOwnerRepoFromLocation,
  getApiBaseUrl,
} from './apiBase';

const USERS_STORAGE_KEY = 'safari_store_users_v3';
const CURRENT_USER_KEY = 'safari_store_current_user_v3';
const ORDERS_STORAGE_KEY = 'safari_store_orders_v3';
const ORDERS_SEEDED_KEY = 'safari_orders_seeded_v3';
const PRODUCTS_OVERRIDE_KEY = 'safari_store_products_override_v3';
const SETTINGS_STORAGE_KEY = 'safari_store_settings_v3';
const LAST_SYNC_TIMESTAMP_KEY = 'safari_store_last_sync_ts_v3';
const PENDING_CLOUD_SYNC_KEY = 'safari_pending_cloud_sync_v1';
const LEGACY_SAMPLE_ORDER_NUMBER = 'ORD-1403-1082';

export const DEFAULT_STORE_SETTINGS: WorkshopStoreSettings = {
  workshopName: 'گروه تولیدی و زیست فناوری مهندس صفری',
  appTagline: 'سامانه جامع فروشگاه و کارگاه زیست‌فناوری',
  appLogoDataUrl: '',
  pwaAppName: 'ورمیکمپوست صفری',
  pwaAppIconDataUrl: '',
  useLogoAsInvoiceSeal: false,
  enableInvoiceSeal: true,
  invoiceSealMode: 'text_stamp',
  invoiceSealImageDataUrl: '',
  invoiceSealTitle: 'گروه تولیدی و زیست‌فناوری مهندس صفری',
  invoiceSealSubtitle: 'مهر معتبر تایید فروش و بارگیری',
  invoiceSealCode: 'پروانه جهاد کشاورزی · ISIRI 13724',
  invoiceSealColor: '#065f46',
  trustBadgeMode: 'app_logo',
  trustBadgeImageDataUrl: '',
  trustBadgeTitle: 'نشان اعتبار و اصالت فروشگاه',
  managerFullName: 'مهندس علی وفایی / مهندس صفری',
  managerTitle: 'مدیریت کل مجموعه، نظارت کیفی و فروش',
  managerPhone: '۰۹۱۲۰۰۰۰۰۰۳',
  managerEmail: 'vafaii.ali@gmail.com',
  managerLicenseCode: 'جهاد کشاورزی · ISIRI 13724',
  managerProvince: 'تهران',
  managerCity: 'فیروزکوه',
  managerProvinceCity: 'تهران / فیروزکوه',
  managerAddress: '',
  managerBioNote: 'تضمین اصالت، آنالیز آزمایشگاهی و ارسال مستقیم از کارگاه',
  supportPhone: '۰۹۱۲۰۰۰۰۰۰۳',
  salesAdvisorName: 'مهندس اصغری',
  agronomistName: 'مهندس صفری',
  agronomistPhone: '۰۹۱۲۰۰۰۰۰۰۳',
  agronomistTitle: 'مشاور ارشد باغبانی و تغذیه خاک',
  workshopAddress: 'کیلومتر ۲۵ جاده صنعتی، مجتمع زیست‌فناوری و تولیدی صفری',
  workingHours: 'شنبه تا پنجشنبه، ۸:۰۰ تا ۱۸:۰۰',
  adminUsername: 'Vafaii',
  adminPassword: '1366A14953',
  minOrderNotice: 'امکان ارسال مستقیم از کارگاه با باربری بین‌شهری و وانت اختصاصی به سراسر کشور',
  storeHeroBadgeText: 'تولید استاندارد ISIRI · ارسال مستقیم از کارگاه',
  paymentCardNumber: '',
  paymentIban: '',
  paymentCardHolder: '',
  paymentBankName: '',
  paymentTermsNotice: 'پس از ثبت سفارش یکپارچه، پیش‌فاکتور فروش صادر و توسط مسئول کارگاه جهت هماهنگی ساعت بارگیری با شما تماس گرفته می‌شود.',
  invoiceFooterNote: 'شماره استاندارد ملی ISIRI 13724 · پروانه بهره‌برداری جهاد کشاورزی · تضمین کیفیت ۱۰۰٪',
  shippingSmallFee: 180000,
  shippingMediumBaseFee: 450000,
  shippingTonFee: 1500000,
  freeShippingThresholdToman: 0,
  enableCalculator: true,
  showStockCountToCustomers: true,
  coreAppVersion: '2.5.0',
  coreUpdateSummary: '',
  githubPagesEnabled: false,
  githubOwner: '',
  githubRepo: '',
  githubBranch: 'main',
  githubCustomDomain: '',
  githubApiBaseUrl: '',
  telegramWebAppUrl: '',
  lastSyncedAt: new Date().toLocaleDateString('fa-IR'),
  autoRealtimeSync: true,
};

export const DEFAULT_ADMIN_USER: UserAccount = {
  id: 'usr-admin-vafaii',
  username: 'Vafaii',
  phoneNumber: '09120000003',
  password: '1366A14953',
  fullName: 'مدیریت کارگاه و فروشگاه (مهندس وفایی / صفری)',
  role: 'admin',
  province: 'تهران',
  city: 'تهران',
  address: 'کیلومتر ۲۵ جاده صنعتی، مجتمع زیست‌فناوری صفری',
  createdAt: '۱۴۰۳/۰۱/۰۱',
};

export const INITIAL_ORDERS: CustomerOrder[] = [];

function filterOutLegacySampleOrders(orders: CustomerOrder[]): {
  cleaned: CustomerOrder[];
  hadLegacy: boolean;
} {
  let hadLegacy = false;
  const cleaned = orders.filter((o) => {
    const isLegacy =
      o.orderNumber === LEGACY_SAMPLE_ORDER_NUMBER ||
      (o.customerName === 'حاج رضا کریمی' && o.phoneNumber === '09123456789');
    if (isLegacy) hadLegacy = true;
    return !isLegacy;
  });
  return { cleaned, hadLegacy };
}

// =========================================================================
// UNIFIED CLOUD DB SYNC STATUS & MONOTONIC WRITE ENGINE
// Single Source of Truth: Telegram Cloud DB (localStorage acts solely as fast offline cache)
// =========================================================================

export type CloudSyncStatus = 'connecting' | 'synced' | 'syncing' | 'error' | 'offline';

export interface CloudSyncState {
  status: CloudSyncStatus;
  projectId: string;
  databaseId: string;
  lastSyncedAt: string | null;
  lastSyncedMs: number;
  errorMessage?: string;
  activeListeners: number;
  pendingDomains?: PendingCloudSyncFlags;
}

export const DB_SYNC_EVENT = 'safari_biotech_db_synced';
export const SYNC_STATUS_EVENT = 'safari_biotech_cloud_sync_status';
export const WORKSHOP_SYNC_EVENT = 'safari_biotech_workshop_synced';

export function getPendingCloudSyncState(): PendingCloudSyncFlags {
  try {
    const raw = localStorage.getItem(PENDING_CLOUD_SYNC_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        settings: Boolean(parsed?.settings),
        products: Boolean(parsed?.products),
        workshop: Boolean(parsed?.workshop),
        lastModifiedFa: parsed?.lastModifiedFa,
      };
    }
  } catch {
    // ignore
  }
  return { settings: false, products: false, workshop: false };
}

export function hasAnyPendingCloudSync(): boolean {
  const p = getPendingCloudSyncState();
  return p.settings || p.products || p.workshop;
}

let currentSyncState: CloudSyncState = {
  status: 'connecting',
  projectId: 'Telegram Cloud DB',
  databaseId: 'telegram-bot-master',
  lastSyncedAt: getLastSyncTimestamp(),
  lastSyncedMs: 0,
  activeListeners: 0,
  pendingDomains: { settings: false, products: false, workshop: false },
};

// Monotonic write timestamps prevent stale in-flight snapshots from reverting new manager edits
const lastLocalWriteMs: Record<'settings' | 'products' | 'orders' | 'users' | 'workshop', number> = {
  settings: 0,
  products: 0,
  orders: 0,
  users: 0,
  workshop: 0,
};

// Serial write queues prevent out-of-order commits during rapid edits
const writeQueues: Record<'settings' | 'products' | 'orders' | 'users' | 'workshop', Promise<void>> = {
  settings: Promise.resolve(),
  products: Promise.resolve(),
  orders: Promise.resolve(),
  users: Promise.resolve(),
  workshop: Promise.resolve(),
};

function nextMonotonicMs(domain: keyof typeof lastLocalWriteMs): number {
  const ts = Math.max(Date.now(), lastLocalWriteMs[domain] + 1);
  lastLocalWriteMs[domain] = ts;
  return ts;
}

function enqueueWrite(
  domain: keyof typeof writeQueues,
  task: () => Promise<void>
): Promise<void> {
  const next = writeQueues[domain].then(task, task);
  writeQueues[domain] = next.catch(() => {});
  return next;
}

function updateSyncState(patch: Partial<CloudSyncState>) {
  currentSyncState = {
    ...currentSyncState,
    ...patch,
    pendingDomains: patch.pendingDomains ?? getPendingCloudSyncState(),
  };
  if (patch.status === 'synced') {
    const nowTime =
      new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) +
      ' - ' +
      new Date().toLocaleDateString('fa-IR');
    currentSyncState.lastSyncedAt = patch.lastSyncedAt || nowTime;
    currentSyncState.lastSyncedMs = Date.now();
    currentSyncState.errorMessage = undefined;
    try {
      localStorage.setItem(LAST_SYNC_TIMESTAMP_KEY, currentSyncState.lastSyncedAt);
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: currentSyncState }));
  }
}

export function markPendingCloudSync(
  _domain: 'settings' | 'products' | 'workshop'
): PendingCloudSyncFlags {
  return { settings: false, products: false, workshop: false };
}

export function clearPendingCloudSync(): PendingCloudSyncFlags {
  const cleared: PendingCloudSyncFlags = { settings: false, products: false, workshop: false };
  try {
    localStorage.setItem(PENDING_CLOUD_SYNC_KEY, JSON.stringify(cleared));
  } catch {
    // ignore
  }
  updateSyncState({ pendingDomains: cleared });
  return cleared;
}

export function getCloudSyncState(): CloudSyncState {
  return currentSyncState;
}

function notifyDbUpdated(source: string = 'local') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DB_SYNC_EVENT, { detail: { timestamp: Date.now(), source } }));
  }
}

function notifyWorkshopUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKSHOP_SYNC_EVENT, { detail: { timestamp: Date.now() } }));
  }
}

export function getLastSyncTimestamp(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_TIMESTAMP_KEY);
  } catch {
    return null;
  }
}

// =========================================================================
// UNIFIED REALTIME TELEGRAM CLOUD DATABASE INITIALIZATION & SSE STREAM
// =========================================================================

let telegramSseSource: EventSource | null = null;
let networkListenersBound = false;
let telegramPollTimer: ReturnType<typeof setInterval> | null = null;
let telegramFocusBound = false;
let lastTelegramDbVersionMs = 0;
let telegramCloudOnline = false;

const NETWORK_OFFLINE_MSG =
  'ارتباط با اینترنت موقتاً برقرار نشد؛ برنامه با حافظه کش محلی در حال اجرا است.';

function mergeOrdersUnion(
  localOrders: CustomerOrder[],
  remoteOrders: CustomerOrder[],
  deletedOrderNumbers: string[] = []
): CustomerOrder[] {
  const deletedSet = new Set(deletedOrderNumbers || []);
  const byNum = new Map<string, CustomerOrder>();
  for (const o of localOrders) {
    if (!o?.orderNumber || deletedSet.has(o.orderNumber)) continue;
    byNum.set(o.orderNumber, o);
  }
  for (const o of remoteOrders) {
    if (!o?.orderNumber || deletedSet.has(o.orderNumber)) continue;
    const existing = byNum.get(o.orderNumber);
    if (!existing || Number(o.updatedAtMs || 0) >= Number(existing.updatedAtMs || 0)) {
      byNum.set(o.orderNumber, o);
    }
  }
  return filterOutLegacySampleOrders(Array.from(byNum.values())).cleaned.sort(
    (a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0)
  );
}

function mergeUsersUnion(localUsers: UserAccount[], remoteUsers: UserAccount[]): UserAccount[] {
  const byKey = new Map<string, UserAccount>();
  const keyOf = (u: UserAccount) =>
    normalizeDigits(u.phoneNumber || '') || u.username?.toLowerCase() || u.id;
  for (const u of localUsers) {
    const k = keyOf(u);
    if (k) byKey.set(k, u);
  }
  for (const u of remoteUsers) {
    const k = keyOf(u);
    if (!k) continue;
    const prev = byKey.get(k);
    if (!prev || Number(u.updatedAtMs || 0) >= Number(prev.updatedAtMs || 0)) {
      byKey.set(k, {
        ...prev,
        ...u,
        telegramLinked: u.telegramLinked || prev?.telegramLinked,
        telegramUserId: u.telegramUserId || prev?.telegramUserId,
        telegramUsername: u.telegramUsername || prev?.telegramUsername,
        telegramFullName: u.telegramFullName || prev?.telegramFullName,
      });
    }
  }
  const list = Array.from(byKey.values());
  const settings = loadStoreSettings();
  const hasAdmin = list.some((u) => u.role === 'admin');
  const normalized = hasAdmin ? list : [DEFAULT_ADMIN_USER, ...list];
  const adminIdx = normalized.findIndex((u) => u.role === 'admin');
  if (adminIdx >= 0) {
    normalized[adminIdx] = {
      ...normalized[adminIdx],
      username: settings.adminUsername || 'Vafaii',
      password: settings.adminPassword || '1366A14953',
    };
  }
  return normalized;
}

async function hydrateFromPublicGithubLiveDb(
  forceFull = false
): Promise<{
  ok: boolean;
  hasData?: boolean;
  changed?: boolean;
  dbVersionMs?: number;
}> {
  const currentSettings = loadStoreSettings();
  const locRepo = resolveGithubOwnerRepoFromLocation();
  const owner = currentSettings.githubOwner || locRepo?.owner || 'ali136640';
  const repo = currentSettings.githubRepo || locRepo?.repo || 'fertilierstore';

  const candidates = [
    `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/gh-pages/live-db.json?_t=${Date.now()}`,
    `./live-db.json?_t=${Date.now()}`,
  ];

  for (const feedUrl of candidates) {
    try {
      const resp = await fetch(feedUrl, { cache: 'no-store' });
      if (!resp.ok) continue;
      const data = (await resp.json().catch(() => null)) as {
        ok?: boolean;
        hasData?: boolean;
        dbVersionMs?: number;
        vermiPricePerKg?: number;
        settings?: Partial<WorkshopStoreSettings>;
        productOverrides?: Record<string, Partial<StoreProduct>>;
        voiceIndex?: Record<string, VoiceClipIndexEntry>;
      } | null;
      if (!data || !data.ok) continue;

      const remoteVer = Number(data.dbVersionMs || 0);
      if (!forceFull && remoteVer > 0 && remoteVer <= lastTelegramDbVersionMs) {
        updateSyncState({ status: 'synced' });
        return { ok: true, hasData: Boolean(data.hasData), changed: false, dbVersionMs: remoteVer };
      }

      if (remoteVer > 0) {
        lastTelegramDbVersionMs = remoteVer;
      }

      if (data.settings && Object.keys(data.settings).length > 0) {
        const merged = sanitizeStoreSettings({
          ...DEFAULT_STORE_SETTINGS,
          ...currentSettings,
          ...data.settings,
          adminPassword: currentSettings.adminPassword || DEFAULT_STORE_SETTINGS.adminPassword,
        });
        writeLocalStorageSafe(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      }

      if (data.productOverrides && typeof data.productOverrides === 'object') {
        writeLocalStorageSafe(PRODUCTS_OVERRIDE_KEY, JSON.stringify(data.productOverrides));
      }

      if (typeof data.vermiPricePerKg === 'number' && data.vermiPricePerKg > 0) {
        const ws = loadWorkshopData();
        if (ws.config.sellingPricePerKg !== data.vermiPricePerKg) {
          saveWorkshopData({
            ...ws,
            config: {
              ...ws.config,
              sellingPricePerKg: data.vermiPricePerKg,
            },
          });
          notifyWorkshopUpdated();
        }
      }

      if (data.voiceIndex && typeof data.voiceIndex === 'object') {
        writeVoiceClipIndexFromBootstrap(data.voiceIndex);
      }

      telegramCloudOnline = true;
      updateSyncState({ status: 'synced', errorMessage: undefined });
      notifyDbUpdated('github-live-db');
      return { ok: true, hasData: Boolean(data.hasData), changed: true, dbVersionMs: remoteVer };
    } catch {
      // try next candidate
    }
  }
  return { ok: false };
}

export async function syncFromTelegramCloudDb(
  forceFull = false,
  options?: { fresh?: boolean }
): Promise<{
  ok: boolean;
  hasData?: boolean;
  changed?: boolean;
  dbVersionMs?: number;
}> {
  if (isStaticHostingEnvironment() && !getApiBaseUrl()) {
    return hydrateFromPublicGithubLiveDb(forceFull);
  }

  try {
    const since = forceFull ? 0 : lastTelegramDbVersionMs;
    const freshParam = options?.fresh ? '&fresh=1' : '';
    const resp = await fetch(
      resolveApiUrl(`/api/telegram/db/bootstrap?since=${since}${freshParam}&_t=${Date.now()}`),
      {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store',
          Pragma: 'no-cache',
        },
      }
    );
    const contentType = String(resp.headers.get('content-type') || '').toLowerCase();
    if (!resp.ok || !contentType.includes('application/json')) {
      if (isStaticHostingEnvironment()) {
        return hydrateFromPublicGithubLiveDb(forceFull);
      }
      return { ok: false };
    }
    const data = (await resp.json().catch(() => null)) as {
      ok?: boolean;
      unchanged?: boolean;
      hasData?: boolean;
      dbVersionMs?: number;
      settings?: Partial<WorkshopStoreSettings>;
      productOverrides?: Record<string, Partial<StoreProduct>>;
      orders?: CustomerOrder[];
      deletedOrderNumbers?: string[];
      users?: UserAccount[];
      workshop?: WorkshopAppState | null;
      voiceIndex?: Record<string, VoiceClipIndexEntry>;
    } | null;

    if (!data || !data.ok) {
      if (isStaticHostingEnvironment()) {
        return hydrateFromPublicGithubLiveDb(forceFull);
      }
      return { ok: false };
    }

    telegramCloudOnline = true;
    const dbVersionMs = Number(data.dbVersionMs || 0);
    if (data.unchanged) {
      if (data.hasData) {
        updateSyncState({ status: 'synced' });
      }
      return { ok: true, hasData: Boolean(data.hasData), changed: false, dbVersionMs };
    }

    lastTelegramDbVersionMs = dbVersionMs;

    if (!data.hasData) {
      const localOrders = loadCustomerOrders();
      const localOverrides = loadProductOverrides();
      const localSettings = loadStoreSettings();
      const hasMeaningfulLocal =
        Object.keys(localOverrides).length > 0 ||
        localOrders.length > 0 ||
        Boolean(localSettings.appLogoDataUrl) ||
        Boolean(localSettings.pwaAppIconDataUrl);
      if (hasMeaningfulLocal) {
        await fetch(resolveApiUrl('/api/telegram/db/state'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: localSettings,
            productOverrides: localOverrides,
            orders: localOrders,
            users: loadUserAccounts(),
            workshop: loadWorkshopData(),
            pushNow: false,
          }),
        }).catch(() => null);
      }
      return { ok: true, hasData: false, changed: false, dbVersionMs };
    }

    if (data.settings && Object.keys(data.settings).length > 0) {
      const remoteMs = Number(data.settings.updatedAtMs || 0);
      if (!(lastLocalWriteMs.settings > 0 && remoteMs > 0 && remoteMs < lastLocalWriteMs.settings)) {
        const current = loadStoreSettings();
        const merged = sanitizeStoreSettings({
          ...DEFAULT_STORE_SETTINGS,
          ...current,
          ...data.settings,
          adminPassword: data.settings.adminPassword || current.adminPassword || DEFAULT_STORE_SETTINGS.adminPassword,
        });
        writeLocalStorageSafe(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
        syncAdminCredentialsInLocalUsers(merged);
      }
    }

    if (data.productOverrides && typeof data.productOverrides === 'object') {
      writeLocalStorageSafe(PRODUCTS_OVERRIDE_KEY, JSON.stringify(data.productOverrides));
    }

    if (Array.isArray(data.orders)) {
      const mergedOrders = mergeOrdersUnion(
        loadCustomerOrders(),
        data.orders,
        data.deletedOrderNumbers || []
      );
      localStorage.setItem(ORDERS_SEEDED_KEY, 'true');
      writeLocalStorageSafe(ORDERS_STORAGE_KEY, JSON.stringify(mergedOrders));
    }

    if (Array.isArray(data.users) && data.users.length > 0) {
      const mergedUsers = mergeUsersUnion(loadUserAccounts(), data.users);
      writeLocalStorageSafe(USERS_STORAGE_KEY, JSON.stringify(mergedUsers));
    }

    if (data.workshop && typeof data.workshop === 'object') {
      const normalizedWorkshop = normalizeWorkshopState(data.workshop);
      saveWorkshopData(normalizedWorkshop);
      notifyWorkshopUpdated();
    }

    if (data.voiceIndex && typeof data.voiceIndex === 'object') {
      writeVoiceClipIndexFromBootstrap(data.voiceIndex);
    }

    clearPendingCloudSync();
    updateSyncState({ status: 'synced' });
    notifyDbUpdated('telegram-cloud-db');
    return { ok: true, hasData: true, changed: true, dbVersionMs };
  } catch {
    if (isStaticHostingEnvironment()) {
      return hydrateFromPublicGithubLiveDb(forceFull);
    }
    telegramCloudOnline = false;
    updateSyncState({
      status: 'offline',
      errorMessage:
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'اتصال اینترنت برقرار نیست؛ در حال نمایش کاتالوگ و صفحات ذخیره‌شده.'
          : 'ارتباط لحظه‌ای با سرور برقرار نشد؛ نسخه آفلاین فعال است.',
    });
    return { ok: false };
  }
}

async function postOrderToTelegramDb(params: {
  action: 'upsert' | 'delete';
  order?: CustomerOrder;
  orderNumber?: string;
}): Promise<boolean> {
  try {
    const resp = await fetch(resolveApiUrl('/api/telegram/db/order'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await resp.json().catch(() => null);
    if (data?.ok) {
      telegramCloudOnline = true;
      if (typeof data.dbVersionMs === 'number') {
        lastTelegramDbVersionMs = Math.max(lastTelegramDbVersionMs, data.dbVersionMs);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function postUserToTelegramDb(user: UserAccount): Promise<boolean> {
  try {
    const resp = await fetch(resolveApiUrl('/api/telegram/db/user'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    });
    const data = await resp.json().catch(() => null);
    if (data?.ok) {
      telegramCloudOnline = true;
      if (typeof data.dbVersionMs === 'number') {
        lastTelegramDbVersionMs = Math.max(lastTelegramDbVersionMs, data.dbVersionMs);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function postStateToTelegramDb(input: {
  settings?: WorkshopStoreSettings;
  productOverrides?: Record<string, Partial<StoreProduct>>;
  orders?: CustomerOrder[];
  users?: UserAccount[];
  workshop?: WorkshopAppState;
  pushNow?: boolean;
}): Promise<{
  ok: boolean;
  dbVersionMs?: number;
  settings?: WorkshopStoreSettings;
  productOverrides?: Record<string, Partial<StoreProduct>>;
  error?: string;
}> {
  try {
    const now = new Date();
    const resp = await fetch(resolveApiUrl('/api/telegram/db/state'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        clientFileStamp: buildClientTelegramFileStamp(now),
        clientDateTimeLabel: formatClientBackupDateTimeLabel(now),
      }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'خطا در همگام‌سازی با پایگاه داده تلگرام' };
    }
    telegramCloudOnline = true;
    if (typeof data.dbVersionMs === 'number') {
      lastTelegramDbVersionMs = Math.max(lastTelegramDbVersionMs, data.dbVersionMs);
    }
    if (data.settings && Object.keys(data.settings).length > 0 && input.settings) {
      const merged = sanitizeStoreSettings({
        ...DEFAULT_STORE_SETTINGS,
        ...input.settings,
        ...data.settings,
      });
      writeLocalStorageSafe(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
    }
    if (data.productOverrides && input.productOverrides) {
      writeLocalStorageSafe(PRODUCTS_OVERRIDE_KEY, JSON.stringify(data.productOverrides));
    }
    return {
      ok: true,
      dbVersionMs: data.dbVersionMs,
      settings: data.settings,
      productOverrides: data.productOverrides,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'خطا در ارتباط با سرور تلگرام' };
  }
}

export function startUnifiedCloudSync(): () => void {
  // Tear down any previous SSE / poll subscriptions cleanly before re-attaching
  stopUnifiedCloudSync();

  const staticWithoutDirectApi = isStaticHostingEnvironment() && !getApiBaseUrl();

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    updateSyncState({
      status: 'offline',
      errorMessage: NETWORK_OFFLINE_MSG,
    });
  } else {
    updateSyncState({ status: telegramCloudOnline ? 'synced' : 'connecting', errorMessage: undefined });
  }

  // Initial immediate hydration (Telegram Cloud DB or GitHub Pages live-db.json feed)
  void syncFromTelegramCloudDb(true);

  if (typeof window !== 'undefined') {
    if (!staticWithoutDirectApi && typeof EventSource !== 'undefined') {
      try {
        const es = new EventSource(resolveApiUrl('/api/telegram/db/events'));
        telegramSseSource = es;

        es.addEventListener('connected', (ev: MessageEvent) => {
          telegramCloudOnline = true;
          updateSyncState({ status: 'synced', activeListeners: 1, errorMessage: undefined });
          try {
            const payload = JSON.parse(String(ev.data || '{}'));
            const remoteVersion = Number(payload?.dbVersionMs || 0);
            if (remoteVersion > lastTelegramDbVersionMs) {
              void syncFromTelegramCloudDb(false, { fresh: true });
            }
          } catch {
            void syncFromTelegramCloudDb(false);
          }
        });

        es.addEventListener('db_update', (ev: MessageEvent) => {
          try {
            const payload = JSON.parse(String(ev.data || '{}'));
            const remoteVersion = Number(payload?.dbVersionMs || 0);
            if (remoteVersion > lastTelegramDbVersionMs) {
              void syncFromTelegramCloudDb(false);
            }
          } catch {
            void syncFromTelegramCloudDb(false);
          }
        });

        es.onerror = () => {
          updateSyncState({ activeListeners: 0 });
        };
      } catch {
        // Fallback safety poll covers environments without EventSource
      }
    }

    const pollIntervalMs = staticWithoutDirectApi ? 12000 : 5000;
    telegramPollTimer = setInterval(() => {
      if (navigator.onLine !== false) {
        void syncFromTelegramCloudDb(false);
      }
    }, pollIntervalMs);

    if (!telegramFocusBound) {
      telegramFocusBound = true;
      const triggerResumeSync = () => {
        if (navigator.onLine !== false) {
          void syncFromTelegramCloudDb(false, { fresh: true });
        }
      };
      window.addEventListener('focus', triggerResumeSync);
      window.addEventListener('pageshow', triggerResumeSync);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          triggerResumeSync();
        }
      });
      try {
        (window as any).Telegram?.WebApp?.onEvent?.('activated', triggerResumeSync);
      } catch {
        // ignore if outside Telegram WebApp
      }
    }

    if (!networkListenersBound) {
      networkListenersBound = true;
      window.addEventListener('offline', () => {
        stopUnifiedCloudSync();
        updateSyncState({
          status: 'offline',
          errorMessage: 'اتصال اینترنت برقرار نیست؛ برنامه در حالت آفلاین با کش محلی فعال است.',
        });
      });
      window.addEventListener('online', () => {
        startUnifiedCloudSync();
      });
    }
  }

  return stopUnifiedCloudSync;
}

export function stopUnifiedCloudSync(): void {
  if (telegramSseSource) {
    try {
      telegramSseSource.close();
    } catch {
      // ignore
    }
    telegramSseSource = null;
  }
  if (telegramPollTimer) {
    clearInterval(telegramPollTimer);
    telegramPollTimer = null;
  }
  updateSyncState({ activeListeners: 0 });
}

/**
 * Full Cloud Sync Exclusively via Telegram Cloud Database (Real-Time, Unlimited)
 */
export async function syncAllToCloudDb(): Promise<{ ok: boolean; error?: string }> {
  updateSyncState({ status: 'syncing', errorMessage: undefined });

  const settings = loadStoreSettings();
  const overrides = loadProductOverrides();
  const orders = loadCustomerOrders();
  const users = loadUserAccounts();
  const workshop = loadWorkshopData();

  const tgRes = await postStateToTelegramDb({
    settings,
    productOverrides: overrides,
    orders,
    users,
    workshop,
    pushNow: true,
  });

  if (tgRes.ok) {
    clearPendingCloudSync();
    updateSyncState({ status: 'synced', errorMessage: undefined });
    notifyDbUpdated('telegram-cloud-manual-sync');
    return { ok: true };
  }

  const errMsg = tgRes.error || 'خطا در همگام‌سازی با پایگاه داده تلگرام';
  updateSyncState({ status: 'error', errorMessage: errMsg });
  return { ok: false, error: errMsg };
}

// Push workshop formulation state directly to Telegram Cloud DB + live SSE broadcast
export async function syncWorkshopStateToCloud(state: WorkshopAppState): Promise<void> {
  nextMonotonicMs('workshop');
  updateSyncState({ status: 'syncing' });
  const tgRes = await postStateToTelegramDb({ workshop: state, pushNow: false });
  if (tgRes.ok) {
    updateSyncState({ status: 'synced', errorMessage: undefined });
  } else {
    updateSyncState({
      status: 'error',
      errorMessage: tgRes.error || 'خطا در همگام‌سازی اطلاعات کارگاه با تلگرام',
    });
  }
}

// =========================================================================
// SETTINGS PERSISTENCE (TELEGRAM-CLOUD-AUTHORITATIVE)
// =========================================================================

function syncAdminCredentialsInLocalUsers(settings: WorkshopStoreSettings) {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const adminIndex = parsed.findIndex((u: UserAccount) => u.role === 'admin');
        if (adminIndex >= 0) {
          parsed[adminIndex].username = settings.adminUsername || 'Vafaii';
          parsed[adminIndex].password = settings.adminPassword || '1366A14953';
          if (settings.managerFullName) {
            parsed[adminIndex].fullName = settings.managerFullName;
          }
          if (settings.managerPhone) {
            parsed[adminIndex].phoneNumber = normalizeDigits(settings.managerPhone) || parsed[adminIndex].phoneNumber;
          }
          if (settings.managerAddress || settings.workshopAddress) {
            parsed[adminIndex].address = settings.managerAddress || settings.workshopAddress;
          }
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(parsed));
        }
      }
    }

    // Keep currently signed-in admin session profile details updated without logging them out
    const rawCurrent = localStorage.getItem(CURRENT_USER_KEY);
    if (rawCurrent) {
      const curr = JSON.parse(rawCurrent) as UserAccount;
      if (curr?.role === 'admin') {
        const updatedCurr: UserAccount = {
          ...curr,
          username: settings.adminUsername || curr.username,
          password: settings.adminPassword || curr.password,
          fullName: settings.managerFullName || curr.fullName,
          phoneNumber: settings.managerPhone ? normalizeDigits(settings.managerPhone) : curr.phoneNumber,
          address: settings.managerAddress || settings.workshopAddress || curr.address,
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedCurr));
      }
    }
  } catch {
    // ignore
  }
}

function cleanLegacyTermsInText(val?: string): string | undefined {
  if (typeof val !== 'string') return val;
  return val
    .replace(/پیش[\u200c\s]*فاکتور\s*رسمی/g, 'پیش‌فاکتور فروش')
    .replace(/مهر\s*رسمی/g, 'مهر معتبر')
    .replace(/لوگوی\s*رسمی/g, 'لوگوی اصلی')
    .replace(/کارخانه‌ای/g, 'کارگاهی')
    .replace(/درب\s*کارخانه/g, 'درب کارگاه')
    .replace(/از\s*کارخانه/g, 'از کارگاه')
    .replace(/کل\s*کارخانه/g, 'کل مجموعه')
    .replace(/کارخانه/g, 'کارگاه')
    .replace(/\s*رسمی\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeStoreSettings(input: WorkshopStoreSettings): WorkshopStoreSettings {
  return {
    ...input,
    workshopName: cleanLegacyTermsInText(input.workshopName) || DEFAULT_STORE_SETTINGS.workshopName,
    appTagline: cleanLegacyTermsInText(input.appTagline),
    invoiceSealTitle: cleanLegacyTermsInText(input.invoiceSealTitle),
    invoiceSealSubtitle: cleanLegacyTermsInText(input.invoiceSealSubtitle),
    trustBadgeTitle: cleanLegacyTermsInText(input.trustBadgeTitle),
    managerTitle: cleanLegacyTermsInText(input.managerTitle),
    managerBioNote: cleanLegacyTermsInText(input.managerBioNote),
    minOrderNotice: cleanLegacyTermsInText(input.minOrderNotice) || DEFAULT_STORE_SETTINGS.minOrderNotice,
    storeHeroBadgeText: cleanLegacyTermsInText(input.storeHeroBadgeText),
    paymentCardNumber: normalizeDigits(String(input.paymentCardNumber || '')).trim(),
    paymentIban: normalizeDigits(String(input.paymentIban || '')).toUpperCase().trim(),
    paymentCardHolder: cleanLegacyTermsInText(input.paymentCardHolder) || '',
    paymentBankName: cleanLegacyTermsInText(input.paymentBankName) || '',
    paymentTermsNotice: cleanLegacyTermsInText(input.paymentTermsNotice),
    invoiceFooterNote: cleanLegacyTermsInText(input.invoiceFooterNote),
    githubPagesEnabled: Boolean(input.githubPagesEnabled),
    githubOwner: String(input.githubOwner || '').trim().replace(/[^a-zA-Z0-9._-]/g, ''),
    githubRepo: String(input.githubRepo || '').trim().replace(/[^a-zA-Z0-9._-]/g, ''),
    githubBranch: String(input.githubBranch || 'main').trim().replace(/[^a-zA-Z0-9._/-]/g, '') || 'main',
    githubCustomDomain: String(input.githubCustomDomain || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, ''),
    githubApiBaseUrl: normalizeBaseUrl(input.githubApiBaseUrl),
    telegramWebAppUrl: normalizeBaseUrl(input.telegramWebAppUrl),
  };
}

function writeLocalStorageSafe(key: string, serialized: string): void {
  try {
    localStorage.setItem(key, serialized);
  } catch (err) {
    // If localStorage is near capacity due to backup vault copies, trim local vault copy (IndexedDB retains full history) and retry
    try {
      const vaultRaw = localStorage.getItem('safari_full_app_backups_v1');
      if (vaultRaw) {
        localStorage.removeItem('safari_full_app_backups_v1');
        localStorage.setItem(key, serialized);
        return;
      }
    } catch {
      // fall through
    }
    throw err;
  }
}

export function loadStoreSettings(): WorkshopStoreSettings {
  const locRepo = resolveGithubOwnerRepoFromLocation();
  const autoGhDefaults: Partial<WorkshopStoreSettings> = locRepo
    ? {
        githubPagesEnabled: true,
        githubOwner: locRepo.owner,
        githubRepo: locRepo.repo,
      }
    : {};

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const { databaseFilePath: _removed, ...clean } = parsed;
      return sanitizeStoreSettings({
        ...DEFAULT_STORE_SETTINGS,
        ...clean,
        githubPagesEnabled: Boolean(clean.githubPagesEnabled ?? autoGhDefaults.githubPagesEnabled),
        githubOwner: clean.githubOwner || autoGhDefaults.githubOwner || '',
        githubRepo: clean.githubRepo || autoGhDefaults.githubRepo || '',
      });
    }
  } catch (err) {
    console.warn('Error loading store settings:', err);
  }
  return sanitizeStoreSettings({
    ...DEFAULT_STORE_SETTINGS,
    ...autoGhDefaults,
  });
}

export async function saveStoreSettings(
  settings: Partial<WorkshopStoreSettings>,
  options?: { syncNow?: boolean }
): Promise<{ ok: boolean; settings: WorkshopStoreSettings; error?: string }> {
  const current = loadStoreSettings();
  const ts = nextMonotonicMs('settings');
  const nowStr =
    new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false }) +
    ' - ' +
    new Date().toLocaleDateString('fa-IR');

  const updated: WorkshopStoreSettings = sanitizeStoreSettings({
    ...current,
    ...settings,
    lastSyncedAt: nowStr,
    updatedAt: new Date().toISOString(),
    updatedAtMs: ts,
  });

  try {
    writeLocalStorageSafe(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    syncAdminCredentialsInLocalUsers(updated);
    notifyDbUpdated('local-settings');
  } catch (err) {
    console.error('Error caching settings locally:', err);
  }

  // Real-time push immediately to Telegram Cloud DB + live SSE broadcast to all devices
  updateSyncState({ status: 'syncing' });
  let pushOk = false;
  let pushError: string | undefined;

  await enqueueWrite('settings', async () => {
    const res = await postStateToTelegramDb({ settings: updated, pushNow: Boolean(options?.syncNow) });
    pushOk = res.ok;
    pushError = res.error;
    if (res.ok) {
      updateSyncState({ status: 'synced', lastSyncedAt: nowStr, errorMessage: undefined });
    } else {
      updateSyncState({ status: 'error', errorMessage: res.error || 'خطا در همگام‌سازی تنظیمات با تلگرام' });
    }
  });

  return { ok: pushOk, settings: loadStoreSettings(), error: pushError };
}

// =========================================================================
// USERS & AUTHENTICATION
// =========================================================================

export function loadUserAccounts(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const settings = loadStoreSettings();
        const adminIndex = parsed.findIndex((u) => u.role === 'admin');
        if (adminIndex >= 0) {
          parsed[adminIndex].username = settings.adminUsername || 'Vafaii';
          parsed[adminIndex].password = settings.adminPassword || '1366A14953';
        } else {
          parsed.push(DEFAULT_ADMIN_USER);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error loading users:', err);
  }
  const defaultList = [DEFAULT_ADMIN_USER];
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaultList));
  return defaultList;
}

export async function saveUserAccount(user: UserAccount): Promise<{ ok: boolean; error?: string }> {
  const ts = nextMonotonicMs('users');
  const stampedUser: UserAccount = { ...user, updatedAtMs: ts };

  try {
    const users = loadUserAccounts();
    const existingIndex = users.findIndex(
      (u) =>
        normalizeDigits(u.phoneNumber) === normalizeDigits(stampedUser.phoneNumber) ||
        (stampedUser.username && u.username === stampedUser.username)
    );
    if (existingIndex >= 0) {
      users[existingIndex] = { ...users[existingIndex], ...stampedUser };
    } else {
      users.push(stampedUser);
    }
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    notifyDbUpdated('local-users');
  } catch (err) {
    console.error('Error saving user locally:', err);
  }

  updateSyncState({ status: 'syncing' });
  const tgOk = await postUserToTelegramDb(stampedUser);
  if (tgOk) {
    updateSyncState({ status: 'synced' });
  }
  return { ok: true };
}

export function normalizeDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632 + 48))
    .trim();
}

export function authenticateUser(identifier: string, password: string): UserAccount | null {
  const cleanId = normalizeDigits(identifier.trim());
  const cleanPass = normalizeDigits(password.trim());
  const rawId = identifier.trim();
  const rawPass = password.trim();
  const settings = loadStoreSettings();

  const storedAdminUser = settings.adminUsername || 'Vafaii';
  const storedAdminPass = normalizeDigits(settings.adminPassword || '1366A14953');

  const isAdminUsername =
    cleanId.toLowerCase() === storedAdminUser.toLowerCase() ||
    rawId.toLowerCase() === storedAdminUser.toLowerCase();
  const normManagerPhone = normalizeDigits(settings.managerPhone || '');
  const isAdminPhone =
    cleanId === DEFAULT_ADMIN_USER.phoneNumber ||
    rawId === DEFAULT_ADMIN_USER.phoneNumber ||
    (normManagerPhone.length >= 10 && cleanId === normManagerPhone);
  const isAdminPassword =
    cleanPass === storedAdminPass || rawPass === (settings.adminPassword || '1366A14953');

  if ((isAdminUsername || isAdminPhone) && isAdminPassword) {
    const adminAccount: UserAccount = {
      ...DEFAULT_ADMIN_USER,
      username: settings.adminUsername || 'Vafaii',
      password: settings.adminPassword || '1366A14953',
      fullName: settings.managerFullName || 'مدیریت کارگاه (مهندس وفایی / صفری)',
      phoneNumber: normManagerPhone || DEFAULT_ADMIN_USER.phoneNumber,
      address: settings.managerAddress || settings.workshopAddress || DEFAULT_ADMIN_USER.address,
    };
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(adminAccount));
    } catch (e) {
      console.warn('Could not store current user in localStorage:', e);
    }
    return adminAccount;
  }

  const users = loadUserAccounts();
  const found = users.find((u) => {
    const uPhoneNorm = normalizeDigits(u.phoneNumber);
    const matchPhone = uPhoneNorm === cleanId || u.phoneNumber.trim() === rawId;
    const matchUser =
      u.username &&
      (u.username.toLowerCase() === rawId.toLowerCase() ||
        u.username.toLowerCase() === cleanId.toLowerCase());
    const matchPass = normalizeDigits(u.password) === cleanPass || u.password === rawPass;
    return (matchPhone || matchUser) && matchPass;
  });

  if (found) {
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(found));
    } catch (e) {
      console.warn('Could not store customer in localStorage:', e);
    }
    return found;
  }

  return null;
}

export function getCurrentUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Error loading current user:', err);
  }
  return null;
}

export function setCurrentUser(user: UserAccount | null): void {
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
    notifyDbUpdated('session');
  } catch (err) {
    console.error('Error setting current user:', err);
  }
}

// =========================================================================
// CUSTOMER ORDERS (TELEGRAM-CLOUD-AUTHORITATIVE)
// =========================================================================

export function loadCustomerOrders(): CustomerOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const { cleaned, hadLegacy } = filterOutLegacySampleOrders(parsed);
        if (hadLegacy) {
          localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(cleaned));
        }
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('Error loading orders:', err);
  }
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(INITIAL_ORDERS));
  return INITIAL_ORDERS;
}

export async function saveCustomerOrder(order: CustomerOrder): Promise<{ ok: boolean; error?: string }> {
  const ts = nextMonotonicMs('orders');
  const stampedOrder: CustomerOrder = {
    ...order,
    updatedAt: order.updatedAt || new Date().toLocaleDateString('fa-IR'),
    updatedAtMs: ts,
  };

  try {
    localStorage.setItem(ORDERS_SEEDED_KEY, 'true');
    const orders = loadCustomerOrders();
    orders.unshift(stampedOrder);
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    notifyDbUpdated('local-orders');
  } catch (err) {
    console.error('Error saving order locally:', err);
  }

  updateSyncState({ status: 'syncing' });
  const tgOk = await postOrderToTelegramDb({ action: 'upsert', order: stampedOrder });
  if (tgOk) {
    updateSyncState({ status: 'synced' });
  }
  return { ok: true };
}

export async function updateOrderStatus(
  orderNumber: string,
  status: OrderStatus,
  adminNotes?: string,
  trackingNumber?: string
): Promise<{ ok: boolean; error?: string }> {
  const ts = nextMonotonicMs('orders');
  let targetOrder: CustomerOrder | null = null;

  try {
    const orders = loadCustomerOrders();
    const index = orders.findIndex((o) => o.orderNumber === orderNumber);
    if (index >= 0) {
      orders[index] = {
        ...orders[index],
        status,
        adminNotes: adminNotes !== undefined ? adminNotes : orders[index].adminNotes,
        trackingNumber: trackingNumber !== undefined ? trackingNumber : orders[index].trackingNumber,
        updatedAt: new Date().toLocaleDateString('fa-IR'),
        updatedAtMs: ts,
      };
      targetOrder = orders[index];
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
      notifyDbUpdated('local-orders');
    }
  } catch (err) {
    console.error('Error updating order locally:', err);
  }

  if (!targetOrder) {
    return { ok: false, error: 'سفارش مورد نظر یافت نشد.' };
  }

  updateSyncState({ status: 'syncing' });
  const tgOk = await postOrderToTelegramDb({ action: 'upsert', order: targetOrder });
  if (tgOk) {
    updateSyncState({ status: 'synced' });
  }
  return { ok: true };
}

export async function deleteCustomerOrder(
  orderNumber: string
): Promise<{ ok: boolean; error?: string }> {
  nextMonotonicMs('orders');

  try {
    localStorage.setItem(ORDERS_SEEDED_KEY, 'true');
    const orders = loadCustomerOrders().filter((o) => o.orderNumber !== orderNumber);
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    notifyDbUpdated('local-orders');
  } catch (err) {
    console.error('Error deleting order locally:', err);
  }

  updateSyncState({ status: 'syncing' });
  const tgOk = await postOrderToTelegramDb({ action: 'delete', orderNumber });
  if (tgOk) {
    updateSyncState({ status: 'synced' });
  }
  return { ok: true };
}

// =========================================================================
// PRODUCT OVERRIDES & INVENTORY REAL-TIME PERSISTENCE (TELEGRAM-AUTHORITATIVE)
// =========================================================================

export function loadProductOverrides(): Record<string, Partial<StoreProduct>> {
  try {
    const raw = localStorage.getItem(PRODUCTS_OVERRIDE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Error loading product overrides:', err);
  }
  return {};
}

export async function saveProductOverrides(
  overrides: Record<string, Partial<StoreProduct>>,
  options?: { syncNow?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  nextMonotonicMs('products');
  try {
    localStorage.setItem(PRODUCTS_OVERRIDE_KEY, JSON.stringify(overrides));
    notifyDbUpdated('local-products');
  } catch (err) {
    console.error('Error saving product overrides locally:', err);
  }

  // Real-time instant push to Telegram Cloud DB + live SSE broadcast to all clients & Bot
  updateSyncState({ status: 'syncing' });
  let pushOk = false;
  let pushError: string | undefined;

  await enqueueWrite('products', async () => {
    const latestOverrides = loadProductOverrides();
    const tgRes = await postStateToTelegramDb({
      productOverrides: latestOverrides,
      pushNow: Boolean(options?.syncNow),
    });
    pushOk = tgRes.ok;
    pushError = tgRes.error;
  });

  if (pushOk) {
    updateSyncState({ status: 'synced', errorMessage: undefined });
    return { ok: true };
  }
  updateSyncState({ status: 'error', errorMessage: pushError });
  return { ok: false, error: pushError || 'خطا در همگام‌سازی تغییرات محصول با تلگرام' };
}

export function restoreDomainCachesFromBackup(params: {
  settings: WorkshopStoreSettings;
  productOverrides: Record<string, Partial<StoreProduct>>;
  orders: CustomerOrder[];
  users: UserAccount[];
  workshop: WorkshopAppState;
}): { workshopState: WorkshopAppState; settings: WorkshopStoreSettings } {
  const sTs = nextMonotonicMs('settings');
  nextMonotonicMs('products');
  nextMonotonicMs('orders');
  nextMonotonicMs('users');
  nextMonotonicMs('workshop');

  const mergedSettings: WorkshopStoreSettings = sanitizeStoreSettings({
    ...DEFAULT_STORE_SETTINGS,
    ...(params.settings || {}),
    updatedAt: new Date().toISOString(),
    updatedAtMs: sTs,
  });
  writeLocalStorageSafe(SETTINGS_STORAGE_KEY, JSON.stringify(mergedSettings));
  syncAdminCredentialsInLocalUsers(mergedSettings);

  const safeOverrides =
    params.productOverrides && typeof params.productOverrides === 'object' && !Array.isArray(params.productOverrides)
      ? params.productOverrides
      : {};
  writeLocalStorageSafe(PRODUCTS_OVERRIDE_KEY, JSON.stringify(safeOverrides));

  const safeOrders = Array.isArray(params.orders) ? params.orders : [];
  const { cleaned: cleanedOrders } = filterOutLegacySampleOrders(safeOrders);
  writeLocalStorageSafe(ORDERS_STORAGE_KEY, JSON.stringify(cleanedOrders));

  if (Array.isArray(params.users) && params.users.length > 0) {
    writeLocalStorageSafe(USERS_STORAGE_KEY, JSON.stringify(params.users));
  }
  const normalizedWorkshop = normalizeWorkshopState(params.workshop);
  saveWorkshopData(normalizedWorkshop);

  void postStateToTelegramDb({
    settings: mergedSettings,
    productOverrides: safeOverrides,
    orders: cleanedOrders,
    users: params.users,
    workshop: normalizedWorkshop,
    pushNow: true,
  });

  notifyDbUpdated('backup-restore');
  notifyWorkshopUpdated();
  return {
    workshopState: normalizedWorkshop,
    settings: mergedSettings,
  };
}

/**
 * Derive reference base unit price & discount percentage consistently across Admin & Customer views
 */
export function resolveProductBaseUnitPrice(product: StoreProduct): number {
  if (product.baseUnitPriceToman && product.baseUnitPriceToman > 0) {
    return product.baseUnitPriceToman;
  }
  const refPkg =
    product.packagingOptions.find((p) => p.isPopular && p.nominalWeightKg > 0) ||
    product.packagingOptions.find((p) => p.nominalWeightKg > 0);
  if (refPkg && refPkg.nominalWeightKg > 0 && refPkg.priceToman > 0) {
    return Math.round(refPkg.priceToman / refPkg.nominalWeightKg);
  }
  return 0;
}

export function mergeProductsWithOverrides(
  baseProducts: StoreProduct[],
  overrides: Record<string, Partial<StoreProduct>>,
  options?: { includeDisabled?: boolean }
): StoreProduct[] {
  const includeDisabled = options?.includeDisabled ?? false;
  const baseIds = new Set(baseProducts.map((p) => p.id));

  const mergedBase = baseProducts
    .map((prod) => {
      const override = overrides[prod.id];
      let combined = prod;
      if (override && typeof override === 'object') {
        const cleanOverride: Record<string, any> = {};
        for (const [k, v] of Object.entries(override)) {
          if (v !== undefined) {
            cleanOverride[k] = v;
          }
        }
        combined = { ...prod, ...cleanOverride } as StoreProduct;
      }
      if (!combined.baseUnitPriceToman || combined.baseUnitPriceToman <= 0) {
        combined.baseUnitPriceToman = resolveProductBaseUnitPrice(combined);
      }
      if (!combined.baseUnitLabel) {
        combined.baseUnitLabel = combined.category === 'liquid' ? 'لیتر' : 'کیلوگرم';
      }
      return combined;
    })
    .filter((p) => !p.isDeleted && (includeDisabled || !p.isDisabled));

  const customProducts: StoreProduct[] = Object.entries(overrides)
    .filter(([id, ov]) => !baseIds.has(id) && ov && !ov.isDeleted && Boolean(ov.name))
    .map(([id, ov]) => {
      const pkgs = Array.isArray(ov.packagingOptions) ? ov.packagingOptions : [];
      const draft: StoreProduct = {
        id,
        name: ov.name || 'محصول جدید',
        category: ov.category || 'vermicompost',
        categoryLabel: ov.categoryLabel || 'محصولات کارگاه',
        tagline: ov.tagline || '',
        description: ov.description || '',
        highlights: Array.isArray(ov.highlights) ? ov.highlights : [],
        specs: Array.isArray(ov.specs) ? ov.specs : [],
        packagingOptions: pkgs,
        badge: ov.badge,
        rating: ov.rating || 4.9,
        reviewCount: ov.reviewCount || 1,
        deliveryTimeDays: ov.deliveryTimeDays || '۱ الی ۳ روز کاری',
        colorScheme: ov.colorScheme || 'emerald',
        imageUrl: ov.imageUrl,
        voiceIntroText: ov.voiceIntroText,
        voiceUpdatedAt: ov.voiceUpdatedAt,
        isDisabled: Boolean(ov.isDisabled),
        baseUnitPriceToman: ov.baseUnitPriceToman,
        baseUnitLabel: ov.baseUnitLabel || (ov.category === 'liquid' ? 'لیتر' : 'کیلوگرم'),
        inStock: ov.inStock ?? true,
        stockQuantity: ov.stockQuantity ?? 100,
        stockUnit: ov.stockUnit || 'کیسه',
        minOrderQuantity: ov.minOrderQuantity || 1,
        isCustomProduct: true,
      };
      if (!draft.baseUnitPriceToman || draft.baseUnitPriceToman <= 0) {
        draft.baseUnitPriceToman = resolveProductBaseUnitPrice(draft);
      }
      return draft;
    })
    .filter((p) => includeDisabled || !p.isDisabled);

  return [...mergedBase, ...customProducts];
}

