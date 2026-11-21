import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Express, Request, Response } from 'express';
import type {
  CustomerOrder,
  StoreProduct,
  UserAccount,
  VoiceClip,
  WorkshopStoreSettings,
} from '../src/types/storefront';

export interface TelegramVoiceClipRecord {
  id: string;
  kind: 'product' | 'tip' | 'weather';
  targetId: string;
  scriptText: string;
  mimeType: string;
  updatedAt: string;
  updatedAtMs: number;
  telegramFileId: string;
  telegramMessageId?: number;
  sha256: string;
  sizeBytes: number;
}

export interface TelegramMediaAssetRecord {
  sha256: string;
  telegramFileId: string;
  telegramMessageId?: number;
  mimeType: string;
  sizeBytes: number;
  filename: string;
  updatedAt: string;
}

export interface TelegramVerifiedPhoneExport {
  phoneNumber: string;
  fullName?: string;
  username?: string;
  updatedAt: string;
}

export interface TelegramCloudDbSnapshot {
  version: 1;
  dbVersionMs: number;
  updatedAt: string;
  lastTelegramSyncAt: string | null;
  pinnedMessageId: number | null;
  pinnedFileId: string | null;
  settings: Partial<WorkshopStoreSettings> & Record<string, any>;
  productOverrides: Record<string, Partial<StoreProduct>>;
  orders: CustomerOrder[];
  deletedOrderNumbers: string[];
  users: UserAccount[];
  workshop: Record<string, any> | null;
  voiceClips: Record<string, TelegramVoiceClipRecord>;
  mediaBySha: Record<string, TelegramMediaAssetRecord>;
  mediaByFileId: Record<string, TelegramMediaAssetRecord>;
  telegramPhones?: Record<string, TelegramVerifiedPhoneExport>;
}

export interface TelegramCloudDbStatus {
  hasBotConnection: boolean;
  hasTargetChat: boolean;
  targetChatId: string;
  storageChatId: string;
  adminChatId: string;
  hasData: boolean;
  dbVersionMs: number;
  updatedAt: string;
  lastTelegramSyncAt: string | null;
  pinnedMessageId: number | null;
  pinnedFileId: string | null;
  isBootstrappedFromTelegram: boolean;
  isSyncingToTelegram: boolean;
  lastSyncError: string | null;
  counts: {
    productOverrides: number;
    orders: number;
    users: number;
    voiceClips: number;
    mediaFiles: number;
  };
}

export interface TelegramDbHostDeps {
  getBotToken: () => string;
  getAdminChatId: () => string;
  getStorageChatId: () => string;
  getUserPhones: () => Record<string, TelegramVerifiedPhoneExport>;
  mergeUserPhones: (phones: Record<string, TelegramVerifiedPhoneExport>) => void;
  onSnapshotChanged?: (snap: {
    settings: Partial<WorkshopStoreSettings>;
    productOverrides: Record<string, Partial<StoreProduct>>;
    orders: CustomerOrder[];
    vermiPricePerKg?: number;
  }) => void;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CLOUD_DB_FILE = path.join(DATA_DIR, 'telegram-cloud-db.json');
const MEDIA_CACHE_DIR = path.join(DATA_DIR, 'telegram-media-cache');
const LEGACY_SAMPLE_ORDER_NUMBER = 'ORD-1403-1082';
const DB_BACKUP_FILE_PREFIX = 'safari-telegram-db';

function toAsciiDigits(str: string): string {
  return String(str || '')
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632 + 48));
}

function buildAppSyncedBackupTimeMeta(clientHint?: {
  clientFileStamp?: string;
  clientDateTimeLabel?: string;
}): { filename: string; dateStr: string } {
  const safeClientStamp = String(clientHint?.clientFileStamp || '')
    .replace(/[^0-9_-]/g, '')
    .slice(0, 24);
  const safeClientLabel = String(clientHint?.clientDateTimeLabel || '').trim().slice(0, 60);

  if (safeClientStamp && /^\d{8}-\d{6}$/.test(safeClientStamp)) {
    return {
      filename: `${DB_BACKUP_FILE_PREFIX}-${safeClientStamp}.json`,
      dateStr:
        safeClientLabel ||
        new Intl.DateTimeFormat('fa-IR', {
          timeZone: 'Asia/Tehran',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date()),
    };
  }

  const now = new Date();
  let fileStamp = '';
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const getPart = (t: string) => toAsciiDigits(parts.find((p) => p.type === t)?.value || '');
    const y = getPart('year').padStart(4, '0');
    const m = getPart('month').padStart(2, '0');
    const d = getPart('day').padStart(2, '0');
    const hh = getPart('hour').replace('24', '00').padStart(2, '0');
    const mm = getPart('minute').padStart(2, '0');
    const ss = getPart('second').padStart(2, '0');
    if (y.length === 4 && m && d) {
      fileStamp = `${y}${m}${d}-${hh}${mm}${ss}`;
    }
  } catch {
    // ignore
  }

  if (!fileStamp) {
    const tehranFallback = new Date(now.getTime() + 3.5 * 3600 * 1000);
    fileStamp = tehranFallback.toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/^(\d{8})(\d{6}).*/, '$1-$2');
  }

  const dateStr =
    safeClientLabel ||
    new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);

  return {
    filename: `${DB_BACKUP_FILE_PREFIX}-${fileStamp}.json`,
    dateStr,
  };
}

function ensureDirs(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(MEDIA_CACHE_DIR)) {
      fs.mkdirSync(MEDIA_CACHE_DIR, { recursive: true });
    }
  } catch {
    // ignore fs errors
  }
}

function normalizeDigits(str: unknown): string {
  return String(str ?? '')
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632 + 48))
    .trim();
}

function normalizeIranPhone(raw: unknown): string {
  const digits = normalizeDigits(raw).replace(/[\s\-().]/g, '');
  if (!digits) return '';
  if (/^\+989\d{9}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^00989\d{9}$/.test(digits)) return `0${digits.slice(4)}`;
  if (/^989\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return digits;
}

function isDeadLegacyAiStudioUrl(raw: unknown): boolean {
  return /^https?:\/\/fertilierstore\.ai\.studio(?:[/?#:]|$)/i.test(String(raw || '').trim());
}

function sanitizeSettingsUrls(settings: Record<string, any>): Record<string, any> {
  const next = { ...(settings || {}) };
  const envAppUrl = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (isDeadLegacyAiStudioUrl(next.githubApiBaseUrl)) {
    next.githubApiBaseUrl = envAppUrl && !isDeadLegacyAiStudioUrl(envAppUrl) ? envAppUrl : '';
  } else if (!next.githubApiBaseUrl && envAppUrl && !isDeadLegacyAiStudioUrl(envAppUrl)) {
    next.githubApiBaseUrl = envAppUrl;
  }
  if (isDeadLegacyAiStudioUrl(next.telegramWebAppUrl)) {
    next.telegramWebAppUrl = '';
  }
  if (isDeadLegacyAiStudioUrl(next.githubCustomDomain) || /fertilierstore\.ai\.studio/i.test(String(next.githubCustomDomain || ''))) {
    next.githubCustomDomain = '';
  }
  return next;
}

function cleanBase64String(raw: unknown): string {
  return String(raw ?? '')
    .replace(/^data:[^;]+;base64,/i, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .trim();
}

function parseDataUrl(raw: unknown): { mimeType: string; buffer: Buffer } | null {
  const s = String(raw ?? '').trim();
  const match = /^data:([^;,]+);base64,(.+)$/is.exec(s);
  if (!match) return null;
  const mimeType = match[1].trim().toLowerCase() || 'application/octet-stream';
  const cleanB64 = match[2].replace(/\s+/g, '');
  if (!cleanB64) return null;
  const buffer = Buffer.from(cleanB64, 'base64');
  if (buffer.length === 0) return null;
  return { mimeType, buffer };
}

function extFromMime(mimeType: string): string {
  const m = String(mimeType || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('svg')) return 'svg';
  if (m.includes('wav')) return 'wav';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('json')) return 'json';
  return 'bin';
}

function safeCacheKey(rawKey: string): string {
  return String(rawKey || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140);
}

function filterLegacyOrders(orders: CustomerOrder[]): CustomerOrder[] {
  return orders.filter(
    (o) =>
      o &&
      o.orderNumber &&
      o.orderNumber !== LEGACY_SAMPLE_ORDER_NUMBER &&
      !(o.customerName === 'حاج رضا کریمی' && o.phoneNumber === '09123456789')
  );
}

export class TelegramCloudDatabaseService {
  private deps: TelegramDbHostDeps;
  private snapshot: TelegramCloudDbSnapshot;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private activePushPromise: Promise<{ ok: boolean; error?: string; pinnedMessageId?: number | null }> | null = null;
  private pendingPushRequested = false;
  private isBootstrappedFromTelegram = false;
  private lastSyncError: string | null = null;
  private lastClientClockHint: { clientFileStamp?: string; clientDateTimeLabel?: string } = {};
  private sseClients = new Set<Response>();
  private sseHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pinnedWatcherTimer: ReturnType<typeof setInterval> | null = null;
  private lastPinnedCheckAtMs = 0;
  private activePinnedCheckPromise: Promise<boolean> | null = null;

  constructor(deps: TelegramDbHostDeps) {
    this.deps = deps;
    this.snapshot = this.loadSnapshotFromDisk();
  }

  private ensureSseHeartbeat(): void {
    if (this.sseHeartbeatTimer) return;
    this.sseHeartbeatTimer = setInterval(() => {
      if (this.sseClients.size === 0) {
        if (this.sseHeartbeatTimer) {
          clearInterval(this.sseHeartbeatTimer);
          this.sseHeartbeatTimer = null;
        }
        return;
      }
      for (const clientRes of Array.from(this.sseClients)) {
        try {
          clientRes.write(`: ping ${Date.now()}\n\n`);
        } catch {
          this.sseClients.delete(clientRes);
        }
      }
    }, 20000);
  }

  public broadcastSseUpdate(domains: string[]): void {
    if (this.sseClients.size === 0) return;
    const payload = JSON.stringify({
      type: 'db_update',
      dbVersionMs: this.snapshot.dbVersionMs,
      domains,
      updatedAt: this.snapshot.updatedAt,
    });
    const frame = `event: db_update\ndata: ${payload}\n\n`;
    for (const clientRes of Array.from(this.sseClients)) {
      try {
        clientRes.write(frame);
      } catch {
        this.sseClients.delete(clientRes);
      }
    }
  }

  public closeSseClients(): void {
    if (this.sseHeartbeatTimer) {
      clearInterval(this.sseHeartbeatTimer);
      this.sseHeartbeatTimer = null;
    }
    if (this.pinnedWatcherTimer) {
      clearInterval(this.pinnedWatcherTimer);
      this.pinnedWatcherTimer = null;
    }
    for (const clientRes of Array.from(this.sseClients)) {
      try {
        clientRes.end();
      } catch {
        // ignore
      }
    }
    this.sseClients.clear();
  }

  private createEmptySnapshot(): TelegramCloudDbSnapshot {
    return {
      version: 1,
      dbVersionMs: 0,
      updatedAt: new Date(0).toISOString(),
      lastTelegramSyncAt: null,
      pinnedMessageId: null,
      pinnedFileId: null,
      settings: {},
      productOverrides: {},
      orders: [],
      deletedOrderNumbers: [],
      users: [],
      workshop: null,
      voiceClips: {},
      mediaBySha: {},
      mediaByFileId: {},
    };
  }

  private loadSnapshotFromDisk(): TelegramCloudDbSnapshot {
    try {
      if (fs.existsSync(CLOUD_DB_FILE)) {
        const raw = fs.readFileSync(CLOUD_DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return this.normalizeSnapshot(parsed);
        }
      }
    } catch {
      // fall through to seed/empty
    }

    // Seed non-destructively from existing telegram-bot-state.json if present (no dbVersionMs bump unless it actually has real edits)
    const empty = this.createEmptySnapshot();
    try {
      const botStatePath = path.join(DATA_DIR, 'telegram-bot-state.json');
      if (fs.existsSync(botStatePath)) {
        const parsed = JSON.parse(fs.readFileSync(botStatePath, 'utf8'));
        if (parsed && typeof parsed === 'object') {
          const orders = Array.isArray(parsed.orders) ? filterLegacyOrders(parsed.orders) : [];
          const hasMeaningfulSettings = parsed.settings && Object.keys(parsed.settings).length > 0;
          const hasOverrides = parsed.productOverrides && Object.keys(parsed.productOverrides).length > 0;
          if (hasMeaningfulSettings || hasOverrides || orders.length > 0) {
            empty.settings = parsed.settings || {};
            empty.productOverrides = parsed.productOverrides || {};
            empty.orders = orders;
            empty.updatedAt = parsed.updatedAt || new Date().toISOString();
            empty.dbVersionMs = Date.parse(empty.updatedAt) || Date.now();
          }
        }
      }
    } catch {
      // ignore seed failure
    }
    return empty;
  }

  private normalizeSnapshot(raw: any): TelegramCloudDbSnapshot {
    const base = this.createEmptySnapshot();
    return {
      ...base,
      version: 1,
      dbVersionMs: Number(raw?.dbVersionMs || 0),
      updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
      lastTelegramSyncAt: typeof raw?.lastTelegramSyncAt === 'string' ? raw.lastTelegramSyncAt : null,
      pinnedMessageId: typeof raw?.pinnedMessageId === 'number' ? raw.pinnedMessageId : null,
      pinnedFileId: typeof raw?.pinnedFileId === 'string' ? raw.pinnedFileId : null,
      settings: sanitizeSettingsUrls(raw?.settings && typeof raw.settings === 'object' ? raw.settings : {}),
      productOverrides:
        raw?.productOverrides && typeof raw.productOverrides === 'object' && !Array.isArray(raw.productOverrides)
          ? raw.productOverrides
          : {},
      orders: Array.isArray(raw?.orders) ? filterLegacyOrders(raw.orders) : [],
      deletedOrderNumbers: Array.isArray(raw?.deletedOrderNumbers)
        ? raw.deletedOrderNumbers.filter((x: unknown): x is string => typeof x === 'string').slice(-300)
        : [],
      users: Array.isArray(raw?.users) ? raw.users : [],
      workshop: raw?.workshop && typeof raw.workshop === 'object' ? raw.workshop : null,
      voiceClips: raw?.voiceClips && typeof raw.voiceClips === 'object' ? raw.voiceClips : {},
      mediaBySha: raw?.mediaBySha && typeof raw.mediaBySha === 'object' ? raw.mediaBySha : {},
      mediaByFileId: raw?.mediaByFileId && typeof raw.mediaByFileId === 'object' ? raw.mediaByFileId : {},
      telegramPhones:
        raw?.telegramPhones && typeof raw.telegramPhones === 'object' ? raw.telegramPhones : undefined,
    };
  }

  private saveSnapshotToDisk(): void {
    ensureDirs();
    try {
      fs.writeFileSync(CLOUD_DB_FILE, JSON.stringify(this.snapshot), 'utf8');
    } catch (err) {
      console.error('Failed writing telegram-cloud-db.json:', err);
    }
  }

  private bumpDbVersion(): number {
    const next = Math.max(Date.now(), this.snapshot.dbVersionMs + 1);
    this.snapshot.dbVersionMs = next;
    this.snapshot.updatedAt = new Date().toISOString();
    return next;
  }

  private resolveWorkshopVermiPricePerKg(): number {
    const rawPrice = Number(this.snapshot.workshop?.config?.sellingPricePerKg || 0);
    return Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 24000;
  }

  private notifyHostSnapshot(): void {
    if (this.deps.onSnapshotChanged) {
      this.deps.onSnapshotChanged({
        settings: this.snapshot.settings,
        productOverrides: this.snapshot.productOverrides,
        orders: this.snapshot.orders,
        vermiPricePerKg: this.resolveWorkshopVermiPricePerKg(),
      });
    }
  }

  private getTargetChatId(): string {
    const storageId = (this.deps.getStorageChatId() || '').trim();
    if (storageId) return storageId;
    return (this.deps.getAdminChatId() || '').trim();
  }

  private getCachePaths(cacheKey: string): { binPath: string; metaPath: string } {
    const safe = safeCacheKey(cacheKey);
    return {
      binPath: path.join(MEDIA_CACHE_DIR, `${safe}.bin`),
      metaPath: path.join(MEDIA_CACHE_DIR, `${safe}.meta.json`),
    };
  }

  private writeMediaCache(cacheKeys: string[], buffer: Buffer, mimeType: string, filename: string): void {
    ensureDirs();
    for (const key of cacheKeys) {
      if (!key) continue;
      try {
        const { binPath, metaPath } = this.getCachePaths(key);
        fs.writeFileSync(binPath, buffer);
        fs.writeFileSync(metaPath, JSON.stringify({ mimeType, filename }), 'utf8');
      } catch {
        // ignore disk cache write failure
      }
    }
  }

  private readMediaCache(cacheKey: string): { buffer: Buffer; mimeType: string; filename: string } | null {
    try {
      const { binPath, metaPath } = this.getCachePaths(cacheKey);
      if (!fs.existsSync(binPath)) return null;
      const buffer = fs.readFileSync(binPath);
      if (buffer.length === 0) return null;
      let mimeType = 'application/octet-stream';
      let filename = cacheKey;
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (meta?.mimeType) mimeType = String(meta.mimeType);
        if (meta?.filename) filename = String(meta.filename);
      }
      return { buffer, mimeType, filename };
    } catch {
      return null;
    }
  }

  private async tgApiJson<T = any>(
    method: string,
    body?: Record<string, unknown>,
    retries = 2
  ): Promise<{ ok: boolean; result?: T; description?: string; error_code?: number; parameters?: { retry_after?: number } }> {
    const token = (this.deps.getBotToken() || '').trim();
    if (!token) {
      return { ok: false, description: 'توکن ربات تلگرام تنظیم نشده است.' };
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
          method: body ? 'POST' : 'GET',
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(45000),
        });
        const json = (await resp.json().catch(() => null)) as any;
        if (json && !json.ok && json.error_code === 429 && attempt < retries) {
          const waitSec = Number(json.parameters?.retry_after || 2);
          await new Promise((r) => setTimeout(r, Math.min(waitSec, 15) * 1000 + 300));
          continue;
        }
        return json || { ok: false, description: `HTTP ${resp.status}` };
      } catch (err: any) {
        if (attempt >= retries) {
          return { ok: false, description: err?.message || 'خطا در ارتباط با سرور تلگرام' };
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    return { ok: false, description: 'خطای ناشناخته تلگرام' };
  }

  private async tgUploadDocument(params: {
    chatId: string;
    buffer: Buffer;
    filename: string;
    mimeType: string;
    caption?: string;
    retries?: number;
  }): Promise<{ ok: boolean; fileId?: string; messageId?: number; description?: string }> {
    const token = (this.deps.getBotToken() || '').trim();
    if (!token) {
      return { ok: false, description: 'توکن ربات تلگرام تنظیم نشده است.' };
    }
    const maxRetries = params.retries ?? 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const form = new FormData();
        form.append('chat_id', params.chatId);
        form.append('disable_notification', 'true');
        if (params.caption) {
          form.append('caption', params.caption.slice(0, 950));
        }
        const blob = new Blob([new Uint8Array(params.buffer)], {
          type: params.mimeType || 'application/octet-stream',
        });
        form.append('document', blob, params.filename);

        const resp = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(60000),
        });
        const json = (await resp.json().catch(() => null)) as any;

        if (json && !json.ok && json.error_code === 429 && attempt < maxRetries) {
          const waitSec = Number(json.parameters?.retry_after || 3);
          await new Promise((r) => setTimeout(r, Math.min(waitSec, 20) * 1000 + 350));
          continue;
        }

        if (!json?.ok || !json?.result) {
          return {
            ok: false,
            description: json?.description || `آپلود فایل در تلگرام ناموفق بود (HTTP ${resp.status})`,
          };
        }

        const msg = json.result;
        const fileId: string | undefined =
          msg.document?.file_id ||
          msg.audio?.file_id ||
          msg.voice?.file_id ||
          (Array.isArray(msg.photo) && msg.photo.length > 0 ? msg.photo[msg.photo.length - 1]?.file_id : undefined);

        if (!fileId) {
          return { ok: false, description: 'شناسه فایل (file_id) از تلگرام دریافت نشد.' };
        }

        return {
          ok: true,
          fileId,
          messageId: typeof msg.message_id === 'number' ? msg.message_id : undefined,
        };
      } catch (err: any) {
        if (attempt >= maxRetries) {
          return { ok: false, description: err?.message || 'خطا در ارسال فایل به تلگرام' };
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    return { ok: false, description: 'آپلود به تلگرام ناموفق بود.' };
  }

  public async getMediaBufferByFileId(fileId: string): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
    if (!fileId) return null;
    return this.downloadTelegramFile(fileId);
  }

  private async downloadTelegramFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
    const cached = this.readMediaCache(fileId);
    if (cached) {
      return cached;
    }

    const token = (this.deps.getBotToken() || '').trim();
    if (!token || !fileId) return null;

    const infoRes = await this.tgApiJson<{ file_id: string; file_path?: string }>('getFile', {
      file_id: fileId,
    });
    const filePath = infoRes.result?.file_path;
    if (!infoRes.ok || !filePath) {
      return null;
    }

    const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const fileResp = await fetch(fileUrl, { signal: AbortSignal.timeout(45000) });
    if (!fileResp.ok) {
      return null;
    }
    const arrBuf = await fileResp.arrayBuffer();
    const buffer = Buffer.from(arrBuf);
    if (buffer.length === 0) return null;

    const knownMeta = this.snapshot.mediaByFileId[fileId];
    const ext = path.extname(filePath).toLowerCase();
    const guessedMime =
      knownMeta?.mimeType ||
      (ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
        ? 'image/webp'
        : ext === '.wav'
        ? 'audio/wav'
        : ext === '.ogg'
        ? 'audio/ogg'
        : ext === '.mp3'
        ? 'audio/mpeg'
        : ext === '.json'
        ? 'application/json'
        : 'application/octet-stream');
    const filename = knownMeta?.filename || path.basename(filePath) || `${fileId}.bin`;

    this.writeMediaCache([fileId, knownMeta?.sha256 || ''], buffer, guessedMime, filename);
    return { buffer, mimeType: guessedMime, filename };
  }

  private async ensureBinaryStoredOnTelegram(params: {
    buffer: Buffer;
    mimeType: string;
    filename: string;
    caption: string;
  }): Promise<TelegramMediaAssetRecord | null> {
    const sha256 = crypto.createHash('sha256').update(params.buffer).digest('hex');
    const existing = this.snapshot.mediaBySha[sha256];
    if (existing && existing.telegramFileId) {
      this.writeMediaCache([sha256, existing.telegramFileId], params.buffer, existing.mimeType, existing.filename);
      return existing;
    }

    const targetChatId = this.getTargetChatId();
    const token = (this.deps.getBotToken() || '').trim();
    if (!token || !targetChatId) {
      return null;
    }

    const uploaded = await this.tgUploadDocument({
      chatId: targetChatId,
      buffer: params.buffer,
      filename: params.filename,
      mimeType: params.mimeType,
      caption: params.caption,
    });
    if (!uploaded.ok || !uploaded.fileId) {
      return null;
    }

    const record: TelegramMediaAssetRecord = {
      sha256,
      telegramFileId: uploaded.fileId,
      telegramMessageId: uploaded.messageId,
      mimeType: params.mimeType,
      sizeBytes: params.buffer.length,
      filename: params.filename,
      updatedAt: new Date().toISOString(),
    };
    this.snapshot.mediaBySha[sha256] = record;
    this.snapshot.mediaByFileId[uploaded.fileId] = record;
    this.writeMediaCache([sha256, uploaded.fileId], params.buffer, params.mimeType, params.filename);
    return record;
  }

  private async offloadEmbeddedDataUrl(
    val: unknown,
    nameHint: string,
    caption: string
  ): Promise<string | undefined> {
    if (typeof val !== 'string') return val as undefined;
    const trimmed = val.trim();
    if (!trimmed.startsWith('data:') || trimmed.length < 6000) {
      return trimmed;
    }
    const parsed = parseDataUrl(trimmed);
    if (!parsed) return trimmed;
    const ext = extFromMime(parsed.mimeType);
    const filename = `${nameHint.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}.${ext}`;
    const stored = await this.ensureBinaryStoredOnTelegram({
      buffer: parsed.buffer,
      mimeType: parsed.mimeType,
      filename,
      caption,
    });
    if (stored?.telegramFileId) {
      return `/api/telegram/db/media/${stored.telegramFileId}`;
    }
    return trimmed;
  }

  private async offloadAllLargeMediaInSettingsAndProducts(
    settings: Partial<WorkshopStoreSettings> & Record<string, any>,
    productOverrides: Record<string, Partial<StoreProduct>>
  ): Promise<{
    cleanedSettings: Partial<WorkshopStoreSettings> & Record<string, any>;
    cleanedOverrides: Record<string, Partial<StoreProduct>>;
    uploadedCount: number;
  }> {
    let uploadedCount = 0;
    const cleanedSettings: Record<string, any> = { ...(settings || {}) };
    const imageFields = [
      'appLogoDataUrl',
      'pwaAppIconDataUrl',
      'invoiceSealImageDataUrl',
      'trustBadgeImageDataUrl',
    ];
    for (const field of imageFields) {
      const val = cleanedSettings[field];
      if (typeof val === 'string' && val.startsWith('data:') && val.length >= 6000) {
        const nextUrl = await this.offloadEmbeddedDataUrl(val, `setting_${field}`, `🖼️ تصویر تنظیمات: ${field}`);
        if (nextUrl && nextUrl !== val) {
          uploadedCount += 1;
        }
        cleanedSettings[field] = nextUrl;
      }
    }

    const cleanedOverrides: Record<string, Partial<StoreProduct>> = {};
    for (const [pid, ov] of Object.entries(productOverrides || {})) {
      if (!ov || typeof ov !== 'object') continue;
      const nextOv = { ...ov };
      if (typeof nextOv.imageUrl === 'string' && nextOv.imageUrl.startsWith('data:') && nextOv.imageUrl.length >= 6000) {
        const nextUrl = await this.offloadEmbeddedDataUrl(
          nextOv.imageUrl,
          `prod_${pid}`,
          `🖼️ تصویر محصول: ${nextOv.name || pid}`
        );
        if (nextUrl && nextUrl !== nextOv.imageUrl) {
          uploadedCount += 1;
        }
        nextOv.imageUrl = nextUrl;
      }
      cleanedOverrides[pid] = nextOv;
    }

    return { cleanedSettings, cleanedOverrides, uploadedCount };
  }

  public getStatus(): TelegramCloudDbStatus {
    const token = (this.deps.getBotToken() || '').trim();
    const adminChatId = (this.deps.getAdminChatId() || '').trim();
    const storageChatId = (this.deps.getStorageChatId() || '').trim();
    const targetChatId = this.getTargetChatId();

    return {
      hasBotConnection: Boolean(token),
      hasTargetChat: Boolean(token && targetChatId),
      targetChatId,
      storageChatId,
      adminChatId,
      hasData: this.snapshot.dbVersionMs > 0,
      dbVersionMs: this.snapshot.dbVersionMs,
      updatedAt: this.snapshot.updatedAt,
      lastTelegramSyncAt: this.snapshot.lastTelegramSyncAt,
      pinnedMessageId: this.snapshot.pinnedMessageId,
      pinnedFileId: this.snapshot.pinnedFileId,
      isBootstrappedFromTelegram: this.isBootstrappedFromTelegram,
      isSyncingToTelegram: Boolean(this.activePushPromise),
      lastSyncError: this.lastSyncError,
      counts: {
        productOverrides: Object.keys(this.snapshot.productOverrides || {}).length,
        orders: (this.snapshot.orders || []).length,
        users: (this.snapshot.users || []).length,
        voiceClips: Object.keys(this.snapshot.voiceClips || {}).length,
        mediaFiles: Object.keys(this.snapshot.mediaBySha || {}).length,
      },
    };
  }

  public async bootstrapFromTelegramPinnedMessage(
    explicitFileId?: string,
    forceRestore = false
  ): Promise<{ ok: boolean; restored: boolean; message: string; status: TelegramCloudDbStatus }> {
    const token = (this.deps.getBotToken() || '').trim();
    const targetChatId = this.getTargetChatId();
    if (!token || !targetChatId) {
      return {
        ok: false,
        restored: false,
        message: 'ربات تلگرام یا شناسه تلگرام مدیر (Admin Chat ID) تنظیم نشده است.',
        status: this.getStatus(),
      };
    }

    try {
      let fileIdToDownload = explicitFileId?.trim() || '';
      let pinnedMessageId: number | null = this.snapshot.pinnedMessageId;

      if (!fileIdToDownload) {
        const chatRes = await this.tgApiJson<any>('getChat', { chat_id: targetChatId });
        if (!chatRes.ok || !chatRes.result) {
          return {
            ok: false,
            restored: false,
            message: chatRes.description || 'خواندن پیام پین‌شده از تلگرام ناموفق بود.',
            status: this.getStatus(),
          };
        }
        const pinned = chatRes.result.pinned_message;
        const doc = pinned?.document;
        if (!doc?.file_id) {
          return {
            ok: true,
            restored: false,
            message: 'هنوز نسخه پین‌شده پایگاه داده در چت تلگرام مدیر ثبت نشده است.',
            status: this.getStatus(),
          };
        }
        const fname = String(doc.file_name || '');
        if (!fname.startsWith('safari-telegram-db')) {
          return {
            ok: true,
            restored: false,
            message: 'آخرین پیام پین‌شده مربوط به فایل پایگاه داده فروشگاه نیست.',
            status: this.getStatus(),
          };
        }
        fileIdToDownload = doc.file_id;
        pinnedMessageId = typeof pinned.message_id === 'number' ? pinned.message_id : pinnedMessageId;
      }

      const downloaded = await this.downloadTelegramFile(fileIdToDownload);
      if (!downloaded) {
        return {
          ok: false,
          restored: false,
          message: 'دانلود فایل پایگاه داده از سرور تلگرام انجام نشد.',
          status: this.getStatus(),
        };
      }

      const parsed = JSON.parse(downloaded.buffer.toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Number(parsed.version) !== 1) {
        return {
          ok: false,
          restored: false,
          message: 'ساختار فایل بازیابی‌شده از تلگرام معتبر نیست.',
          status: this.getStatus(),
        };
      }

      const remoteVersionMs = Number(parsed.dbVersionMs || 0);
      if (!forceRestore && this.snapshot.dbVersionMs > 0 && remoteVersionMs <= this.snapshot.dbVersionMs) {
        this.isBootstrappedFromTelegram = true;
        return {
          ok: true,
          restored: false,
          message: 'نسخه محلی سرور به‌روزتر یا هم‌تراز با پیام پین‌شده تلگرام است.',
          status: this.getStatus(),
        };
      }

      const restoredSnap = this.normalizeSnapshot(parsed);
      restoredSnap.pinnedMessageId = pinnedMessageId ?? restoredSnap.pinnedMessageId;
      restoredSnap.pinnedFileId = fileIdToDownload;
      this.snapshot = restoredSnap;

      if (restoredSnap.telegramPhones) {
        this.deps.mergeUserPhones(restoredSnap.telegramPhones);
      }

      this.saveSnapshotToDisk();
      this.notifyHostSnapshot();
      this.broadcastSseUpdate(['all']);
      this.isBootstrappedFromTelegram = true;
      this.lastSyncError = null;

      return {
        ok: true,
        restored: true,
        message: 'کل پایگاه داده با موفقیت از پیام پین‌شده تلگرام بازیابی شد ✓',
        status: this.getStatus(),
      };
    } catch (err: any) {
      const msg = err?.message || 'خطا در بازیابی پایگاه داده از تلگرام';
      this.lastSyncError = msg;
      return {
        ok: false,
        restored: false,
        message: msg,
        status: this.getStatus(),
      };
    }
  }

  /**
   * Lightweight cross-instance check (e.g. Shared App URL vs Dev URL):
   * Checks Telegram's pinned_message file_id (1 small getChat call, throttled)
   * and ONLY downloads/restores if Telegram has a newer pinned snapshot than local memory.
   */
  public async syncLatestFromTelegramPinnedIfStale(minIntervalMs = 10000): Promise<boolean> {
    const token = (this.deps.getBotToken() || '').trim();
    const targetChatId = this.getTargetChatId();
    if (!token || !targetChatId) return false;

    // Never pull over a local write currently pushing to Telegram
    if (this.activePushPromise || this.pushTimer) return false;

    const now = Date.now();
    if (this.lastPinnedCheckAtMs > 0 && now - this.lastPinnedCheckAtMs < minIntervalMs) {
      return false;
    }

    if (this.activePinnedCheckPromise) {
      return this.activePinnedCheckPromise;
    }

    this.lastPinnedCheckAtMs = now;
    this.activePinnedCheckPromise = (async () => {
      try {
        const chatRes = await this.tgApiJson<any>('getChat', { chat_id: targetChatId }, 0);
        if (!chatRes.ok || !chatRes.result) return false;

        const pinned = chatRes.result.pinned_message;
        const doc = pinned?.document;
        const fname = String(doc?.file_name || '');
        const remoteFileId = String(doc?.file_id || '').trim();
        if (!remoteFileId || !fname.startsWith('safari-telegram-db')) {
          return false;
        }
        if (this.snapshot.pinnedFileId && remoteFileId === this.snapshot.pinnedFileId) {
          this.isBootstrappedFromTelegram = true;
          return false;
        }
        const res = await this.bootstrapFromTelegramPinnedMessage(remoteFileId, false);
        return Boolean(res.restored);
      } catch {
        return false;
      } finally {
        this.activePinnedCheckPromise = null;
      }
    })();

    return this.activePinnedCheckPromise;
  }

  public startPinnedWatcher(): void {
    if (this.pinnedWatcherTimer) return;
    this.pinnedWatcherTimer = setInterval(() => {
      void this.syncLatestFromTelegramPinnedIfStale(18000);
    }, 20000);
    if (typeof this.pinnedWatcherTimer.unref === 'function') {
      this.pinnedWatcherTimer.unref();
    }
  }

  public scheduleTelegramMasterPush(delayMs = 1500): void {
    const token = (this.deps.getBotToken() || '').trim();
    const targetChatId = this.getTargetChatId();
    if (!token || !targetChatId) return;

    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
    }
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.pushMasterSnapshotToTelegram(false);
    }, delayMs);
  }

  public async pushMasterSnapshotToTelegram(
    forceImmediate = false,
    clientClockHint?: { clientFileStamp?: string; clientDateTimeLabel?: string }
  ): Promise<{ ok: boolean; error?: string; pinnedMessageId?: number | null; filename?: string }> {
    if (clientClockHint?.clientFileStamp || clientClockHint?.clientDateTimeLabel) {
      this.lastClientClockHint = clientClockHint;
    }
    const token = (this.deps.getBotToken() || '').trim();
    const targetChatId = this.getTargetChatId();
    if (!token || !targetChatId) {
      return { ok: false, error: 'توکن ربات یا شناسه چت تلگرام مدیر تنظیم نشده است.' };
    }

    if (this.pushTimer && forceImmediate) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }

    if (this.activePushPromise) {
      this.pendingPushRequested = true;
      return this.activePushPromise;
    }

    this.activePushPromise = (async () => {
      try {
        // Ensure any remaining embedded large images in snapshot are offloaded cleanly first
        const { cleanedSettings, cleanedOverrides } = await this.offloadAllLargeMediaInSettingsAndProducts(
          this.snapshot.settings,
          this.snapshot.productOverrides
        );
        this.snapshot.settings = cleanedSettings;
        this.snapshot.productOverrides = cleanedOverrides;
        this.snapshot.telegramPhones = this.deps.getUserPhones();

        const payloadToUpload: TelegramCloudDbSnapshot = {
          ...this.snapshot,
          lastTelegramSyncAt: new Date().toISOString(),
        };

        const jsonBuffer = Buffer.from(JSON.stringify(payloadToUpload), 'utf8');
        const { filename: syncedFilename, dateStr } = buildAppSyncedBackupTimeMeta(
          clientClockHint || this.lastClientClockHint
        );
        const caption =
          `🗄️ نسخه کامل پایگاه داده فروشگاه مهندس صفری\n` +
          `📁 فایل: ${syncedFilename}\n` +
          `🕒 زمان همگام‌سازی: ${dateStr}\n` +
          `🛍 محصولات ویرایش‌شده: ${Object.keys(payloadToUpload.productOverrides).length} | 📦 سفارش‌ها: ${payloadToUpload.orders.length}\n` +
          `👥 کاربران: ${payloadToUpload.users.length} | 🎙️ فایل‌های صوتی: ${Object.keys(payloadToUpload.voiceClips).length}\n` +
          `🖼️ فایل‌های تصویری/رسانه: ${Object.keys(payloadToUpload.mediaBySha).length}`;

        const uploaded = await this.tgUploadDocument({
          chatId: targetChatId,
          buffer: jsonBuffer,
          filename: syncedFilename,
          mimeType: 'application/json',
          caption,
        });

        if (!uploaded.ok || !uploaded.fileId) {
          this.lastSyncError = uploaded.description || 'ارسال نسخه کامل به تلگرام ناموفق بود.';
          return { ok: false, error: this.lastSyncError };
        }

        if (uploaded.messageId) {
          await this.tgApiJson('pinChatMessage', {
            chat_id: targetChatId,
            message_id: uploaded.messageId,
            disable_notification: true,
          });
          this.snapshot.pinnedMessageId = uploaded.messageId;
        }
        this.snapshot.pinnedFileId = uploaded.fileId;
        this.snapshot.lastTelegramSyncAt = payloadToUpload.lastTelegramSyncAt;
        this.lastSyncError = null;
        this.saveSnapshotToDisk();
        this.notifyHostSnapshot();
        this.broadcastSseUpdate(['meta']);

        return { ok: true, pinnedMessageId: this.snapshot.pinnedMessageId, filename: syncedFilename };
      } catch (err: any) {
        this.lastSyncError = err?.message || 'خطا در ثبت نسخه پایگاه داده در تلگرام';
        return { ok: false, error: this.lastSyncError || undefined };
      } finally {
        this.activePushPromise = null;
        if (this.pendingPushRequested) {
          this.pendingPushRequested = false;
          this.scheduleTelegramMasterPush(1000);
        }
      }
    })();

    return this.activePushPromise;
  }

  public getBootstrapPayload(sinceVersionMs = 0) {
    if (sinceVersionMs > 0 && sinceVersionMs >= this.snapshot.dbVersionMs) {
      return {
        ok: true,
        unchanged: true,
        hasData: this.snapshot.dbVersionMs > 0,
        dbVersionMs: this.snapshot.dbVersionMs,
        lastTelegramSyncAt: this.snapshot.lastTelegramSyncAt,
      };
    }

    return {
      ok: true,
      unchanged: false,
      hasData: this.snapshot.dbVersionMs > 0,
      dbVersionMs: this.snapshot.dbVersionMs,
      updatedAt: this.snapshot.updatedAt,
      lastTelegramSyncAt: this.snapshot.lastTelegramSyncAt,
      pinnedMessageId: this.snapshot.pinnedMessageId,
      settings: this.snapshot.settings,
      productOverrides: this.snapshot.productOverrides,
      orders: this.snapshot.orders,
      deletedOrderNumbers: this.snapshot.deletedOrderNumbers,
      users: this.snapshot.users,
      workshop: this.snapshot.workshop,
      voiceIndex: this.getVoiceIndex(),
    };
  }

  public getStoreBotSnapshot(): {
    settings: Partial<WorkshopStoreSettings>;
    productOverrides: Record<string, Partial<StoreProduct>>;
    orders: CustomerOrder[];
    vermiPricePerKg?: number;
  } {
    return {
      settings: this.snapshot.settings,
      productOverrides: this.snapshot.productOverrides,
      orders: this.snapshot.orders,
      vermiPricePerKg: this.resolveWorkshopVermiPricePerKg(),
    };
  }

  public attachPaymentReceiptToLatestOrder(params: {
    phoneNumber?: string;
    customerName?: string;
    receiptSummary: string;
  }): CustomerOrder | null {
    const normPhone = normalizeDigits(params.phoneNumber || '');
    const cleanName = String(params.customerName || '').trim();
    if (!normPhone && !cleanName) return null;

    const matchIndex = this.snapshot.orders.findIndex((o) => {
      if (o.status === 'cancelled') return false;
      const oPhone = normalizeDigits(o.phoneNumber || '');
      if (normPhone && normPhone.length >= 9 && oPhone === normPhone) return true;
      if (!normPhone && cleanName && o.customerName?.trim() === cleanName) return true;
      return false;
    });

    if (matchIndex < 0) return null;

    const existing = this.snapshot.orders[matchIndex];
    const prevNotes = (existing.adminNotes || '').trim();
    const combinedNotes = prevNotes
      ? `${prevNotes}\n${params.receiptSummary}`
      : params.receiptSummary;

    const updatedOrder: CustomerOrder = {
      ...existing,
      adminNotes: combinedNotes,
      updatedAt: new Date().toLocaleDateString('fa-IR'),
      updatedAtMs: Math.max(Date.now(), Number(existing.updatedAtMs || 0) + 1),
    };
    this.snapshot.orders[matchIndex] = updatedOrder;

    this.bumpDbVersion();
    this.saveSnapshotToDisk();
    this.notifyHostSnapshot();
    this.broadcastSseUpdate(['orders']);
    this.scheduleTelegramMasterPush(700);
    return updatedOrder;
  }

  public getVoiceIndex(): Record<
    string,
    {
      kind: 'product' | 'tip' | 'weather';
      targetId: string;
      scriptText: string;
      updatedAt: string;
      telegramFileId: string;
      source: 'telegram';
    }
  > {
    const index: Record<string, any> = {};
    for (const [clipId, rec] of Object.entries(this.snapshot.voiceClips || {})) {
      if (!rec) continue;
      index[clipId] = {
        kind: rec.kind,
        targetId: rec.targetId,
        scriptText: rec.scriptText || '',
        updatedAt: rec.updatedAt || '',
        telegramFileId: rec.telegramFileId,
        source: 'telegram',
      };
    }
    return index;
  }

  public saveOrderMutation(params: {
    action: 'upsert' | 'delete';
    order?: CustomerOrder;
    orderNumber?: string;
  }): { ok: boolean; dbVersionMs: number } {
    if (params.action === 'delete') {
      const targetNum = String(params.orderNumber || params.order?.orderNumber || '').trim();
      if (targetNum) {
        this.snapshot.orders = this.snapshot.orders.filter((o) => o.orderNumber !== targetNum);
        if (!this.snapshot.deletedOrderNumbers.includes(targetNum)) {
          this.snapshot.deletedOrderNumbers = [...this.snapshot.deletedOrderNumbers, targetNum].slice(-300);
        }
      }
    } else if (params.order && params.order.orderNumber) {
      const ord = params.order;
      if (
        ord.orderNumber === LEGACY_SAMPLE_ORDER_NUMBER ||
        (ord.customerName === 'حاج رضا کریمی' && ord.phoneNumber === '09123456789')
      ) {
        return { ok: true, dbVersionMs: this.snapshot.dbVersionMs };
      }
      this.snapshot.deletedOrderNumbers = this.snapshot.deletedOrderNumbers.filter(
        (num) => num !== ord.orderNumber
      );
      const idx = this.snapshot.orders.findIndex((o) => o.orderNumber === ord.orderNumber);
      if (idx >= 0) {
        const existingMs = Number(this.snapshot.orders[idx].updatedAtMs || 0);
        const incomingMs = Number(ord.updatedAtMs || Date.now());
        if (incomingMs >= existingMs) {
          this.snapshot.orders[idx] = { ...this.snapshot.orders[idx], ...ord };
        }
      } else {
        this.snapshot.orders.unshift(ord);
      }
    }

    const dbVersionMs = this.bumpDbVersion();
    this.saveSnapshotToDisk();
    this.notifyHostSnapshot();
    this.broadcastSseUpdate(['orders']);
    this.scheduleTelegramMasterPush(700);
    return { ok: true, dbVersionMs };
  }

  public saveUserMutation(user: UserAccount): { ok: boolean; dbVersionMs: number; user: UserAccount } {
    const normPhone = normalizeDigits(user.phoneNumber);
    const stamped: UserAccount = {
      ...user,
      phoneNumber: normPhone || user.phoneNumber,
      updatedAtMs: user.updatedAtMs || Date.now(),
    };

    const idx = this.snapshot.users.findIndex(
      (u) =>
        (normPhone && normalizeDigits(u.phoneNumber) === normPhone) ||
        (stamped.username && u.username && u.username.toLowerCase() === stamped.username.toLowerCase()) ||
        (stamped.id && u.id === stamped.id)
    );

    if (idx >= 0) {
      const prev = this.snapshot.users[idx];
      this.snapshot.users[idx] = {
        ...prev,
        ...stamped,
        telegramLinked: stamped.telegramLinked || prev.telegramLinked,
        telegramUserId: stamped.telegramUserId || prev.telegramUserId,
        telegramUsername: stamped.telegramUsername || prev.telegramUsername,
        telegramFullName: stamped.telegramFullName || prev.telegramFullName,
      };
    } else {
      this.snapshot.users.push(stamped);
    }

    const dbVersionMs = this.bumpDbVersion();
    this.saveSnapshotToDisk();
    this.broadcastSseUpdate(['users']);
    this.scheduleTelegramMasterPush(800);
    return { ok: true, dbVersionMs, user: stamped };
  }

  public upsertCustomerFromTelegramOrder(params: {
    fullName?: string;
    phoneNumber?: string;
    province?: string;
    city?: string;
    deliveryAddress?: string;
    telegramUserId?: number | string;
    telegramUsername?: string;
    telegramFullName?: string;
  }): UserAccount {
    const normPhone = normalizeIranPhone(params.phoneNumber);
    const tgUid = params.telegramUserId ? String(params.telegramUserId).trim() : '';
    const existing = this.snapshot.users.find(
      (u) =>
        (normPhone && normalizeIranPhone(u.phoneNumber) === normPhone) ||
        (tgUid && u.telegramUserId && String(u.telegramUserId) === tgUid)
    );

    const todayFa = new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    if (existing) {
      const updatedUser: UserAccount = {
        ...existing,
        phoneNumber: existing.phoneNumber || normPhone,
        fullName: existing.fullName || params.fullName?.trim() || params.telegramFullName?.trim() || 'مشتری تلگرام',
        province: existing.province?.trim() ? existing.province : params.province?.trim() || 'تهران',
        city: existing.city?.trim() ? existing.city : params.city?.trim() || 'تهران',
        address: existing.address?.trim() ? existing.address : params.deliveryAddress?.trim() || '',
        telegramLinked: true,
        telegramUserId: existing.telegramUserId || tgUid || undefined,
        telegramUsername: existing.telegramUsername || params.telegramUsername || undefined,
        telegramFullName: existing.telegramFullName || params.telegramFullName || undefined,
        updatedAtMs: Date.now(),
      };
      const res = this.saveUserMutation(updatedUser);
      return res.user;
    }

    const safePhone = normPhone || `tg${tgUid || Date.now()}`;
    const generatedPassword = safePhone.length >= 6 ? safePhone.slice(-6) : '123456';
    const cleanName = (params.fullName || params.telegramFullName || 'مشتری تلگرام').trim();

    const newCustomer: UserAccount = {
      id: `usr-tg-${tgUid || Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`,
      username: params.telegramUsername || (tgUid ? `tg_${tgUid}` : undefined),
      phoneNumber: safePhone,
      password: generatedPassword,
      fullName: cleanName,
      role: 'customer',
      province: (params.province || 'تهران').trim(),
      city: (params.city || 'تهران').trim(),
      address: (params.deliveryAddress || '').trim(),
      farmingType: 'orchard',
      telegramLinked: true,
      telegramUserId: tgUid || undefined,
      telegramUsername: params.telegramUsername || undefined,
      telegramFullName: params.telegramFullName || cleanName,
      createdAt: todayFa,
      updatedAtMs: Date.now(),
    };
    const res = this.saveUserMutation(newCustomer);
    return res.user;
  }

  public setWebAppUrlInSettings(webAppUrl: string): void {
    const trimmed = String(webAppUrl || '').trim().replace(/\/+$/, '');
    if (!trimmed || isDeadLegacyAiStudioUrl(trimmed)) return;
    if (this.snapshot.settings.telegramWebAppUrl === trimmed) return;
    this.snapshot.settings = sanitizeSettingsUrls({
      ...this.snapshot.settings,
      telegramWebAppUrl: trimmed,
      updatedAtMs: Date.now(),
      updatedAt: new Date().toISOString(),
    });
    this.bumpDbVersion();
    this.saveSnapshotToDisk();
    this.broadcastSseUpdate(['settings']);
    this.scheduleTelegramMasterPush(1000);
  }

  private mergeOrdersArray(incoming: CustomerOrder[]): CustomerOrder[] {
    const deletedSet = new Set(this.snapshot.deletedOrderNumbers || []);
    const byNum = new Map<string, CustomerOrder>();

    for (const o of filterLegacyOrders(this.snapshot.orders || [])) {
      if (!deletedSet.has(o.orderNumber)) {
        byNum.set(o.orderNumber, o);
      }
    }
    for (const o of filterLegacyOrders(incoming || [])) {
      if (!o?.orderNumber || deletedSet.has(o.orderNumber)) continue;
      const existing = byNum.get(o.orderNumber);
      if (!existing || (o.updatedAtMs || 0) >= (existing.updatedAtMs || 0)) {
        byNum.set(o.orderNumber, o);
      }
    }

    return Array.from(byNum.values()).sort(
      (a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0)
    );
  }

  private mergeUsersArray(incoming: UserAccount[]): UserAccount[] {
    const byKey = new Map<string, UserAccount>();
    const keyOf = (u: UserAccount) =>
      normalizeDigits(u.phoneNumber) || u.username?.toLowerCase() || u.id;

    for (const u of this.snapshot.users || []) {
      const k = keyOf(u);
      if (k) byKey.set(k, u);
    }
    for (const u of incoming || []) {
      const k = keyOf(u);
      if (!k) continue;
      const prev = byKey.get(k);
      if (!prev || (u.updatedAtMs || 0) >= (prev.updatedAtMs || 0)) {
        byKey.set(k, {
          ...prev,
          ...u,
          phoneNumber: normalizeDigits(u.phoneNumber) || u.phoneNumber,
          telegramLinked: u.telegramLinked || prev?.telegramLinked,
          telegramUserId: u.telegramUserId || prev?.telegramUserId,
          telegramUsername: u.telegramUsername || prev?.telegramUsername,
          telegramFullName: u.telegramFullName || prev?.telegramFullName,
        });
      }
    }
    return Array.from(byKey.values());
  }

  public async saveStateMutation(input: {
    settings?: Partial<WorkshopStoreSettings> & Record<string, any>;
    productOverrides?: Record<string, Partial<StoreProduct>>;
    orders?: CustomerOrder[];
    users?: UserAccount[];
    workshop?: Record<string, any> | null;
    pushNow?: boolean;
    clientFileStamp?: string;
    clientDateTimeLabel?: string;
  }): Promise<{
    ok: boolean;
    dbVersionMs: number;
    uploadedMediaCount: number;
    settings: Partial<WorkshopStoreSettings> & Record<string, any>;
    productOverrides: Record<string, Partial<StoreProduct>>;
    telegramSync?: { ok: boolean; error?: string; pinnedMessageId?: number | null; filename?: string };
  }> {
    if (input.clientFileStamp || input.clientDateTimeLabel) {
      this.lastClientClockHint = {
        clientFileStamp: input.clientFileStamp,
        clientDateTimeLabel: input.clientDateTimeLabel,
      };
    }
    let uploadedMediaCount = 0;
    const changedDomains: string[] = [];

    if (input.settings || input.productOverrides) {
      const { cleanedSettings, cleanedOverrides, uploadedCount } =
        await this.offloadAllLargeMediaInSettingsAndProducts(
          input.settings || this.snapshot.settings,
          input.productOverrides || this.snapshot.productOverrides
        );
      uploadedMediaCount += uploadedCount;

      if (input.settings && typeof input.settings === 'object') {
        this.snapshot.settings = sanitizeSettingsUrls({
          ...this.snapshot.settings,
          ...cleanedSettings,
        });
        changedDomains.push('settings');
      }
      if (input.productOverrides && typeof input.productOverrides === 'object') {
        this.snapshot.productOverrides = cleanedOverrides;
        changedDomains.push('products');
      }
    }

    if (Array.isArray(input.orders)) {
      this.snapshot.orders = this.mergeOrdersArray(input.orders);
      changedDomains.push('orders');
    }
    if (Array.isArray(input.users)) {
      this.snapshot.users = this.mergeUsersArray(input.users);
      changedDomains.push('users');
    }
    if (input.workshop && typeof input.workshop === 'object') {
      this.snapshot.workshop = input.workshop;
      changedDomains.push('workshop');
    }

    const dbVersionMs = this.bumpDbVersion();
    this.saveSnapshotToDisk();
    this.notifyHostSnapshot();
    this.broadcastSseUpdate(changedDomains.length > 0 ? changedDomains : ['state']);

    let telegramSync: { ok: boolean; error?: string; pinnedMessageId?: number | null; filename?: string } | undefined;
    if (input.pushNow) {
      telegramSync = await this.pushMasterSnapshotToTelegram(true, this.lastClientClockHint);
    } else {
      this.scheduleTelegramMasterPush(450);
    }

    return {
      ok: true,
      dbVersionMs,
      uploadedMediaCount,
      settings: this.snapshot.settings,
      productOverrides: this.snapshot.productOverrides,
      telegramSync,
    };
  }

  public async saveVoiceClipMutation(params: {
    clip: VoiceClip;
    skipMasterPin?: boolean;
  }): Promise<{ ok: boolean; deduplicated?: boolean; telegramFileId?: string; error?: string }> {
    const clip = params.clip;
    if (!clip || !clip.id || !clip.audioBase64) {
      return { ok: false, error: 'اطلاعات فایل صوتی ناقص است.' };
    }

    const cleanB64 = cleanBase64String(clip.audioBase64);
    const buffer = Buffer.from(cleanB64, 'base64');
    if (buffer.length === 0) {
      return { ok: false, error: 'محتوای فایل صوتی خالی است.' };
    }

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const mimeType = clip.mimeType || 'audio/mpeg';
    const ext = extFromMime(mimeType);
    const filename = `${clip.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}.${ext}`;

    const existing = this.snapshot.voiceClips[clip.id];
    if (existing && existing.sha256 === sha256 && existing.telegramFileId) {
      // Only refresh script/timestamp metadata without duplicating Telegram upload
      this.snapshot.voiceClips[clip.id] = {
        ...existing,
        scriptText: clip.scriptText || existing.scriptText,
        updatedAt: clip.updatedAt || existing.updatedAt,
        updatedAtMs: clip.updatedAtMs || Date.now(),
      };
      this.writeMediaCache([sha256, existing.telegramFileId], buffer, mimeType, filename);
      this.bumpDbVersion();
      this.saveSnapshotToDisk();
      if (!params.skipMasterPin) {
        this.scheduleTelegramMasterPush(1800);
      }
      return { ok: true, deduplicated: true, telegramFileId: existing.telegramFileId };
    }

    const kindFa = clip.kind === 'product' ? 'محصول' : clip.kind === 'tip' ? 'نکته طلایی' : 'هواشناسی';
    const stored = await this.ensureBinaryStoredOnTelegram({
      buffer,
      mimeType,
      filename,
      caption: `🎙️ فایل صوتی ${kindFa} | شناسه: ${clip.targetId}\n${(clip.scriptText || '').slice(0, 140)}`,
    });

    if (!stored || !stored.telegramFileId) {
      // Cache locally even if Telegram bot/chat wasn't reachable yet
      const localKey = `local_voice_${sha256}`;
      this.writeMediaCache([sha256, localKey], buffer, mimeType, filename);
      this.snapshot.voiceClips[clip.id] = {
        id: clip.id,
        kind: clip.kind,
        targetId: clip.targetId,
        scriptText: clip.scriptText || '',
        mimeType,
        updatedAt: clip.updatedAt || new Date().toLocaleString('fa-IR'),
        updatedAtMs: clip.updatedAtMs || Date.now(),
        telegramFileId: '',
        sha256,
        sizeBytes: buffer.length,
      };
      this.bumpDbVersion();
      this.saveSnapshotToDisk();
      return {
        ok: false,
        error: 'ربات تلگرام یا چت مدیر متصل نیست؛ صوت موقتاً در حافظه سرور ذخیره شد.',
      };
    }

    this.snapshot.voiceClips[clip.id] = {
      id: clip.id,
      kind: clip.kind,
      targetId: clip.targetId,
      scriptText: clip.scriptText || '',
      mimeType,
      updatedAt: clip.updatedAt || new Date().toLocaleString('fa-IR'),
      updatedAtMs: clip.updatedAtMs || Date.now(),
      telegramFileId: stored.telegramFileId,
      telegramMessageId: stored.telegramMessageId,
      sha256,
      sizeBytes: buffer.length,
    };

    this.bumpDbVersion();
    this.saveSnapshotToDisk();
    this.broadcastSseUpdate(['voice']);
    if (!params.skipMasterPin) {
      this.scheduleTelegramMasterPush(1500);
    }

    return { ok: true, deduplicated: false, telegramFileId: stored.telegramFileId };
  }

  public async resolveVoiceClip(clipId: string): Promise<VoiceClip | null> {
    const rec = this.snapshot.voiceClips[clipId];
    if (!rec) return null;

    let cached = rec.sha256 ? this.readMediaCache(rec.sha256) : null;
    if (!cached && rec.telegramFileId) {
      cached = await this.downloadTelegramFile(rec.telegramFileId);
    }
    if (!cached || cached.buffer.length === 0) {
      return null;
    }

    return {
      id: rec.id,
      kind: rec.kind,
      targetId: rec.targetId,
      scriptText: rec.scriptText || '',
      audioBase64: cached.buffer.toString('base64'),
      mimeType: rec.mimeType || cached.mimeType || 'audio/mpeg',
      updatedAt: rec.updatedAt || '',
      updatedAtMs: rec.updatedAtMs || Date.now(),
    };
  }

  public registerRoutes(app: Express): void {
    app.get('/api/telegram/db/events', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof (res as any).flushHeaders === 'function') {
        (res as any).flushHeaders();
      }
      this.sseClients.add(res);
      this.ensureSseHeartbeat();
      res.write(
        `event: connected\ndata: ${JSON.stringify({
          dbVersionMs: this.snapshot.dbVersionMs,
          updatedAt: this.snapshot.updatedAt,
        })}\n\n`
      );
      req.on('close', () => {
        this.sseClients.delete(res);
      });
    });

    app.get('/api/telegram/db/status', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json({ ok: true, status: this.getStatus() });
    });

    app.get('/api/telegram/db/version', async (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      await this.syncLatestFromTelegramPinnedIfStale(10000);
      res.json({
        ok: true,
        hasData: this.snapshot.dbVersionMs > 0,
        dbVersionMs: this.snapshot.dbVersionMs,
        updatedAt: this.snapshot.updatedAt,
        lastTelegramSyncAt: this.snapshot.lastTelegramSyncAt,
      });
    });

    app.get('/api/telegram/db/bootstrap', async (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      const since = Number(req.query.since || 0) || 0;
      if (since === 0 || req.query.fresh === '1') {
        await this.syncLatestFromTelegramPinnedIfStale(10000);
      }
      res.json(this.getBootstrapPayload(since));
    });

    app.get('/api/telegram/db/voice-index', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.json({ ok: true, entries: this.getVoiceIndex() });
    });

    app.get('/api/telegram/db/voice-clip/:clipId', async (req: Request, res: Response) => {
      try {
        const clipId = decodeURIComponent(String(req.params.clipId || '')).trim();
        if (!clipId) {
          res.status(400).json({ ok: false, error: 'شناسه صوت نامعتبر است.' });
          return;
        }
        const clip = await this.resolveVoiceClip(clipId);
        if (!clip) {
          res.status(404).json({ ok: false, error: 'فایل صوتی در پایگاه داده تلگرام یافت نشد.' });
          return;
        }
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json({ ok: true, clip });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'خطا در دریافت فایل صوتی از تلگرام' });
      }
    });

    app.post('/api/telegram/db/voice-clip', async (req: Request, res: Response) => {
      try {
        const { clip, skipMasterPin } = req.body || {};
        const result = await this.saveVoiceClipMutation({
          clip,
          skipMasterPin: Boolean(skipMasterPin),
        });
        res.status(result.ok ? 200 : 400).json(result);
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'خطا در ذخیره صوت در تلگرام' });
      }
    });

    app.get('/api/telegram/db/media/:fileId', async (req: Request, res: Response) => {
      try {
        const fileId = decodeURIComponent(String(req.params.fileId || '')).trim();
        if (!fileId) {
          res.status(400).send('Invalid file id');
          return;
        }
        const fileData = await this.downloadTelegramFile(fileId);
        if (!fileData) {
          res.status(404).json({ ok: false, error: 'فایل در تلگرام یافت نشد.' });
          return;
        }
        res.setHeader('Content-Type', fileData.mimeType || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Length', String(fileData.buffer.length));
        res.send(fileData.buffer);
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'خطا در بارگذاری فایل از تلگرام' });
      }
    });

    app.post('/api/telegram/db/order', (req: Request, res: Response) => {
      try {
        const { action, order, orderNumber } = req.body || {};
        const act: 'upsert' | 'delete' = action === 'delete' ? 'delete' : 'upsert';
        const result = this.saveOrderMutation({ action: act, order, orderNumber });
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'خطا در ذخیره سفارش در پایگاه داده تلگرام' });
      }
    });

    app.post('/api/telegram/db/user', (req: Request, res: Response) => {
      try {
        const { user } = req.body || {};
        if (!user || !user.phoneNumber) {
          res.status(400).json({ ok: false, error: 'اطلاعات کاربر نامعتبر است.' });
          return;
        }
        const result = this.saveUserMutation(user as UserAccount);
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'خطا در ذخیره کاربر در پایگاه داده تلگرام' });
      }
    });

    app.post('/api/telegram/db/state', async (req: Request, res: Response) => {
      try {
        const {
          settings,
          productOverrides,
          orders,
          users,
          workshop,
          pushNow,
          clientFileStamp,
          clientDateTimeLabel,
        } = req.body || {};
        const result = await this.saveStateMutation({
          settings,
          productOverrides,
          orders,
          users,
          workshop,
          pushNow: Boolean(pushNow),
          clientFileStamp: typeof clientFileStamp === 'string' ? clientFileStamp : undefined,
          clientDateTimeLabel: typeof clientDateTimeLabel === 'string' ? clientDateTimeLabel : undefined,
        });
        res.json({ ...result, status: this.getStatus() });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'خطا در همگام‌سازی کامل با پایگاه داده تلگرام' });
      }
    });

    app.post('/api/telegram/db/pin-master', async (req: Request, res: Response) => {
      try {
        const { clientFileStamp, clientDateTimeLabel } = req.body || {};
        const result = await this.pushMasterSnapshotToTelegram(true, {
          clientFileStamp: typeof clientFileStamp === 'string' ? clientFileStamp : undefined,
          clientDateTimeLabel: typeof clientDateTimeLabel === 'string' ? clientDateTimeLabel : undefined,
        });
        res.status(result.ok ? 200 : 400).json({
          ...result,
          status: this.getStatus(),
        });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'خطا در ارسال فایل جامع به تلگرام مدیر' });
      }
    });

    app.post('/api/telegram/db/restore-from-telegram', async (req: Request, res: Response) => {
      try {
        const explicitFileId = typeof req.body?.fileId === 'string' ? req.body.fileId : undefined;
        const result = await this.bootstrapFromTelegramPinnedMessage(explicitFileId, true);
        res.status(result.ok ? 200 : 400).json({
          ...result,
          bootstrap: result.restored ? this.getBootstrapPayload(0) : undefined,
        });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'خطا در بازیابی از پیام پین‌شده تلگرام' });
      }
    });
  }
}

export function createTelegramCloudDbService(deps: TelegramDbHostDeps): TelegramCloudDatabaseService {
  return new TelegramCloudDatabaseService(deps);
}
