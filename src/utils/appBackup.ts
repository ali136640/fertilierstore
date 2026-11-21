import { StoreProduct, CustomerOrder, UserAccount, WorkshopStoreSettings } from '../types/storefront';
import { WorkshopAppState } from '../types/vermicompost';
import {
  DEFAULT_STORE_SETTINGS,
  loadStoreSettings,
  loadProductOverrides,
  loadCustomerOrders,
  loadUserAccounts,
  restoreDomainCachesFromBackup,
  sanitizeStoreSettings,
} from './storeStorage';
import { loadWorkshopData, normalizeWorkshopState } from './storage';

const APP_BACKUPS_VAULT_KEY = 'safari_full_app_backups_v1';
const IDB_NAME = 'safari_app_backups_idb_v1';
const IDB_STORE = 'backups';
const IDB_RECORD_KEY = 'latest_3_snapshots';
const MAX_STORED_BACKUPS = 3;
export const BACKUP_FILE_FORMAT = 'safari-biotech-backup';

export interface FullAppBackupSnapshot {
  format?: string;
  id: string;
  version: number;
  createdAtIso: string;
  createdAtFa: string;
  label: string;
  summary: {
    workshopName: string;
    pwaAppName: string;
    hasLogo: boolean;
    productOverridesCount: number;
    ordersCount: number;
    usersCount: number;
    batchCode: string;
  };
  data: {
    settings: WorkshopStoreSettings;
    productOverrides: Record<string, Partial<StoreProduct>>;
    orders: CustomerOrder[];
    users: UserAccount[];
    workshopState: WorkshopAppState;
  };
}

function openBackupsIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeBackupsToIdb(list: FullAppBackupSnapshot[]): Promise<void> {
  const db = await openBackupsIdb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(list.slice(0, MAX_STORED_BACKUPS), IDB_RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore IDB write error
  } finally {
    db.close();
  }
}

async function readBackupsFromIdb(): Promise<FullAppBackupSnapshot[]> {
  const db = await openBackupsIdb();
  if (!db) return [];
  try {
    return await new Promise<FullAppBackupSnapshot[]>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_RECORD_KEY);
      req.onsuccess = () => {
        const val = req.result;
        resolve(Array.isArray(val) ? val.slice(0, MAX_STORED_BACKUPS) : []);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export function listLocalAppBackups(): FullAppBackupSnapshot[] {
  try {
    const raw = localStorage.getItem(APP_BACKUPS_VAULT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_STORED_BACKUPS);
  } catch {
    return [];
  }
}

export async function listLocalAppBackupsAsync(): Promise<FullAppBackupSnapshot[]> {
  const lsList = listLocalAppBackups();
  const idbList = await readBackupsFromIdb();
  if (idbList.length >= lsList.length && idbList.length > 0) {
    return idbList.slice(0, MAX_STORED_BACKUPS);
  }
  if (lsList.length > 0 && idbList.length === 0) {
    void writeBackupsToIdb(lsList);
  }
  return lsList;
}

function saveBackupListToStorage(list: FullAppBackupSnapshot[]): {
  ok: boolean;
  saved: FullAppBackupSnapshot[];
  error?: string;
} {
  const trimmed = list.slice(0, MAX_STORED_BACKUPS);
  // Persist full 3 snapshots durably in IndexedDB (handles base64 images cleanly without 5MB localStorage limit)
  void writeBackupsToIdb(trimmed);

  try {
    localStorage.setItem(APP_BACKUPS_VAULT_KEY, JSON.stringify(trimmed));
    return { ok: true, saved: trimmed };
  } catch {
    // If localStorage quota is tight, mirror as many recent items as fit in localStorage while keeping all 3 in IndexedDB
    for (let limit = trimmed.length - 1; limit >= 1; limit--) {
      try {
        const smaller = trimmed.slice(0, limit);
        localStorage.setItem(APP_BACKUPS_VAULT_KEY, JSON.stringify(smaller));
        return {
          ok: true,
          saved: trimmed,
        };
      } catch {
        // try fewer
      }
    }
    try {
      localStorage.removeItem(APP_BACKUPS_VAULT_KEY);
    } catch {
      // ignore
    }
    return {
      ok: true,
      saved: trimmed,
    };
  }
}

function buildNormalizedSnapshot(raw: any): FullAppBackupSnapshot {
  const dataSource = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const rawSettings = dataSource?.settings;
  const rawWorkshop = dataSource?.workshopState || dataSource?.workshop;

  if (!rawSettings || typeof rawSettings !== 'object') {
    throw new Error('بخش تنظیمات برنامه در فایل پشتیبان یافت نشد.');
  }

  const normalizedSettings = sanitizeStoreSettings({
    ...DEFAULT_STORE_SETTINGS,
    ...rawSettings,
  });

  const normalizedWorkshop = normalizeWorkshopState(rawWorkshop || loadWorkshopData());

  const safeOverrides: Record<string, Partial<StoreProduct>> =
    dataSource?.productOverrides &&
    typeof dataSource.productOverrides === 'object' &&
    !Array.isArray(dataSource.productOverrides)
      ? dataSource.productOverrides
      : {};

  const safeOrders: CustomerOrder[] = Array.isArray(dataSource?.orders) ? dataSource.orders : [];
  const safeUsers: UserAccount[] = Array.isArray(dataSource?.users) ? dataSource.users : [];

  const now = new Date();
  const createdAtIso =
    typeof raw?.createdAtIso === 'string' && raw.createdAtIso.trim()
      ? raw.createdAtIso
      : now.toISOString();
  const createdAtFa =
    typeof raw?.createdAtFa === 'string' && raw.createdAtFa.trim()
      ? raw.createdAtFa
      : now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false }) +
        ' - ' +
        now.toLocaleDateString('fa-IR');

  return {
    format: BACKUP_FILE_FORMAT,
    id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id.trim() : `BKP-${now.getTime()}`,
    version: typeof raw?.version === 'number' && raw.version > 0 ? raw.version : 2,
    createdAtIso,
    createdAtFa,
    label:
      typeof raw?.label === 'string' && raw.label.trim()
        ? raw.label.trim()
        : `بک‌آپ کامل سامانه (${createdAtFa})`,
    summary: {
      workshopName:
        raw?.summary?.workshopName || normalizedSettings.workshopName || 'گروه مهندس صفری',
      pwaAppName:
        raw?.summary?.pwaAppName ||
        normalizedSettings.pwaAppName ||
        normalizedSettings.workshopName ||
        'ورمیکمپوست صفری',
      hasLogo: Boolean(
        normalizedSettings.appLogoDataUrl || normalizedSettings.pwaAppIconDataUrl
      ),
      productOverridesCount: Object.keys(safeOverrides).length,
      ordersCount: safeOrders.length,
      usersCount: safeUsers.length,
      batchCode: normalizedWorkshop?.config?.batchCode || 'BATCH-01',
    },
    data: {
      settings: normalizedSettings,
      productOverrides: safeOverrides,
      orders: safeOrders,
      users: safeUsers,
      workshopState: normalizedWorkshop,
    },
  };
}

export function createLocalAppBackup(
  liveWorkshopState?: WorkshopAppState,
  customLabel?: string,
  currentListOverride?: FullAppBackupSnapshot[]
): {
  ok: boolean;
  backup: FullAppBackupSnapshot;
  backups: FullAppBackupSnapshot[];
  warning?: string;
} {
  const settings = loadStoreSettings();
  const productOverrides = loadProductOverrides();
  const orders = loadCustomerOrders();
  const users = loadUserAccounts();
  const workshopState = normalizeWorkshopState(liveWorkshopState || loadWorkshopData());

  const now = new Date();
  const createdAtFa =
    now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false }) +
    ' - ' +
    now.toLocaleDateString('fa-IR');

  const snapshot: FullAppBackupSnapshot = {
    format: BACKUP_FILE_FORMAT,
    id: `BKP-${now.getTime()}`,
    version: 2,
    createdAtIso: now.toISOString(),
    createdAtFa,
    label: (customLabel || `بک‌آپ کامل سامانه (${createdAtFa})`).trim(),
    summary: {
      workshopName: settings.workshopName || 'گروه مهندس صفری',
      pwaAppName: settings.pwaAppName || settings.workshopName || 'ورمیکمپوست صفری',
      hasLogo: Boolean(settings.appLogoDataUrl || settings.pwaAppIconDataUrl),
      productOverridesCount: Object.keys(productOverrides).length,
      ordersCount: orders.length,
      usersCount: users.length,
      batchCode: workshopState?.config?.batchCode || 'BATCH-01',
    },
    data: {
      settings,
      productOverrides,
      orders,
      users,
      workshopState,
    },
  };

  const existing = currentListOverride && currentListOverride.length > 0 ? currentListOverride : listLocalAppBackups();
  const nextList = [snapshot, ...existing.filter((item) => item.id !== snapshot.id)].slice(
    0,
    MAX_STORED_BACKUPS
  );
  const res = saveBackupListToStorage(nextList);

  return {
    ok: res.ok,
    backup: snapshot,
    backups: res.saved,
    warning: res.error,
  };
}

export function deleteLocalAppBackup(
  backupId: string,
  currentListOverride?: FullAppBackupSnapshot[]
): FullAppBackupSnapshot[] {
  const source = currentListOverride && currentListOverride.length > 0 ? currentListOverride : listLocalAppBackups();
  const filtered = source.filter((b) => b.id !== backupId);
  const res = saveBackupListToStorage(filtered);
  return res.saved;
}

export function restoreFullAppBackup(snapshot: FullAppBackupSnapshot): {
  ok: boolean;
  workshopState?: WorkshopAppState;
  settings?: WorkshopStoreSettings;
  error?: string;
} {
  try {
    const normalized = buildNormalizedSnapshot(snapshot);
    const restored = restoreDomainCachesFromBackup({
      settings: normalized.data.settings,
      productOverrides: normalized.data.productOverrides,
      orders: normalized.data.orders,
      users: normalized.data.users,
      workshop: normalized.data.workshopState,
    });
    return {
      ok: true,
      workshopState: restored.workshopState,
      settings: restored.settings,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'خطا در بازگردانی نسخه پشتیبان',
    };
  }
}

export function downloadBackupJsonFile(snapshot: FullAppBackupSnapshot): void {
  const normalized = buildNormalizedSnapshot(snapshot);
  const json = JSON.stringify(normalized, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const datePart = (normalized.createdAtIso || new Date().toISOString())
    .slice(0, 10)
    .replace(/[^0-9-]/g, '');
  const safeId = String(normalized.id || '0000')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(-6) || '0000';
  const a = document.createElement('a');
  a.href = url;
  a.download = `safari-biotech-backup-${datePart}-${safeId}.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function parseUploadedBackupJson(rawText: string): FullAppBackupSnapshot {
  const cleanedText = String(rawText || '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!cleanedText) {
    throw new Error('فایل انتخاب‌شده خالی است.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleanedText);
  } catch {
    throw new Error('فرمت فایل انتخاب‌شده JSON معتبر نیست و قابل خواندن نمی‌باشد.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('ساختار فایل پشتیبان معتبر نیست.');
  }

  const hasValidPayload =
    Boolean(parsed?.data?.settings) ||
    Boolean(parsed?.settings && (parsed?.workshopState || parsed?.workshop));

  if (!hasValidPayload) {
    throw new Error('فایل انتخاب‌شده یک بک‌آپ کامل معتبر سامانه مهندس صفری نیست.');
  }

  return buildNormalizedSnapshot(parsed);
}

