import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Express, Request, Response } from 'express';
import { getStoreProducts } from '../src/data/storefrontProducts';
import { COMPREHENSIVE_PLANT_PROFILES } from '../src/data/plantProfiles';
import { AGRICULTURAL_GOLDEN_TIPS, TIP_CATEGORIES } from '../src/data/agriculturalGoldenTips';
import { CONSULTANT_FAQ_ITEMS } from '../src/data/consultantFaq';
import { getCurrentPersianDate } from '../src/data/vermicompostData';
import type { CartItem, CustomerOrder, PackageOption, StoreProduct, WorkshopStoreSettings } from '../src/types/storefront';

export type TelegramTransportMode = 'polling' | 'webhook';

export interface TelegramBotPersistedConfig {
  botToken: string;
  botId?: number;
  botUsername?: string;
  botFirstName?: string;
  webAppUrl: string;
  mode: TelegramTransportMode;
  adminChatId: string;
  storageChatId?: string;
  enabled: boolean;
  webhookSecret: string;
  updatedAt?: string;
}

export interface TelegramSyncedSnapshot {
  settings: Partial<WorkshopStoreSettings>;
  productOverrides: Record<string, Partial<StoreProduct>>;
  orders: CustomerOrder[];
  vermiPricePerKg?: number;
  updatedAt: string;
}

export interface TelegramBotPublicStatus {
  hasToken: boolean;
  tokenMasked: string;
  enabled: boolean;
  isRunning: boolean;
  botVerified: boolean;
  conflictActive: boolean;
  conflictMessage: string | null;
  effectiveMode: 'polling' | 'webhook' | 'standby';
  mode: TelegramTransportMode;
  botId?: number;
  botUsername?: string;
  botFirstName?: string;
  botLink?: string;
  miniAppUrl?: string;
  webAppUrl: string;
  isWebAppUrlHttps: boolean;
  adminChatId: string;
  storageChatId: string;
  syncedProductsCount: number;
  syncedOrdersCount: number;
  knownUsersCount: number;
  lastError: string | null;
  lastUpdateAt: string | null;
}

export interface TelegramBotServerDeps {
  getAgriculturalWeather: (province: string, city: string) => Promise<any>;
  getConsultantReply: (question: string, context?: { city?: string; province?: string }) => Promise<string>;
  getProductVoiceClip?: (product: StoreProduct) => Promise<{
    buffer?: Buffer;
    mimeType?: string;
    scriptText: string;
  } | null>;
  getMediaBufferByFileId?: (fileId: string) => Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string;
  } | null>;
  onBotOrderCreated?: (order: CustomerOrder, telegramUserId?: number) => Promise<void> | void;
  onWebAppUrlConfigured?: (webAppUrl: string) => void;
  onPaymentReceiptReceived?: (receipt: {
    chatId: number;
    phoneNumber?: string;
    fullName?: string;
    username?: string;
    kind: 'photo' | 'document' | 'text';
    contentSummary: string;
  }) => CustomerOrder | null | void;
  onClientSyncState?: (input: {
    settings?: Partial<WorkshopStoreSettings>;
    productOverrides?: Record<string, Partial<StoreProduct>>;
    orders?: CustomerOrder[];
  }) => Promise<void> | void;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'telegram-bot-config.json');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'telegram-bot-state.json');
const PHONES_FILE = path.join(DATA_DIR, 'telegram-bot-phones.json');
const CARTS_FILE = path.join(DATA_DIR, 'telegram-bot-carts.json');
const PRODUCT_IMAGES_DIR = path.resolve(process.cwd(), 'src/assets/images');

const DEFAULT_PRODUCT_IMAGE_BY_ID: Record<string, string> = {
  'prod-vermicompost-grade-a': 'vermicompost_grade_a_1794572561601.jpg',
  'prod-traditional-compost': 'traditional_compost_1794572562702.jpg',
  'prod-worm-tea-liquid': 'worm_tea_liquid_1794572563137.jpg',
  'prod-zeolite-sugar-mesh': 'zeolite_sugar_mesh_1794572563027.jpg',
  'prod-coffee-substrate': 'coffee_substrate_1794572564729.jpg',
  'prod-live-earthworms': 'live_earthworms_1794572563487.jpg',
};

const DEFAULT_PRODUCT_IMAGE_BY_CATEGORY: Record<string, string> = {
  vermicompost: 'vermicompost_grade_a_1794572561601.jpg',
  compost: 'traditional_compost_1794572562702.jpg',
  liquid: 'worm_tea_liquid_1794572563137.jpg',
  mineral: 'zeolite_sugar_mesh_1794572563027.jpg',
  substrate: 'coffee_substrate_1794572564729.jpg',
  starter: 'live_earthworms_1794572563487.jpg',
};

interface BotCartEntry {
  productId: string;
  packageId: string;
  quantity: number;
}

interface BotCheckoutDraft {
  fullName?: string;
  phoneNumber?: string;
  province?: string;
  city?: string;
  deliveryAddress?: string;
  deliveryMethod?: CustomerOrder['deliveryMethod'];
  orderNotes?: string;
}

export interface TelegramVerifiedPhoneRecord {
  phoneNumber: string;
  fullName?: string;
  username?: string;
  updatedAt: string;
}

function normalizeIranPhoneNumber(raw: unknown): string {
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

interface ChatSessionState {
  awaiting?:
    | 'consultant'
    | 'order_search'
    | 'weather_city'
    | 'payment_receipt'
    | 'product_search'
    | 'checkout_name'
    | 'checkout_phone'
    | 'checkout_city'
    | 'checkout_address'
    | 'checkout_notes'
    | null;
  lastProvince?: string;
  lastCity?: string;
  checkoutDraft?: BotCheckoutDraft;
}

function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatToman(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `${n.toLocaleString('fa-IR')} تومان`;
}

function maskToken(token: string): string {
  const trimmed = (token || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= 12) return '********';
  return `${trimmed.slice(0, 6)}••••••${trimmed.slice(-5)}`;
}

function isDeadLegacyAiStudioUrl(urlStr: unknown): boolean {
  return /^https?:\/\/fertilierstore\.ai\.studio(?:[/?#:]|$)/i.test(String(urlStr || '').trim());
}

function sanitizeHttpsUrl(urlStr: unknown): string {
  const trimmed = String(urlStr || '').trim().replace(/\/+$/, '');
  if (!trimmed || isDeadLegacyAiStudioUrl(trimmed)) return '';
  return isHttpsUrl(trimmed) ? trimmed : '';
}

function isHttpsUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function appendQueryParams(baseUrl: string, params: Record<string, string>): string {
  try {
    const u = new URL(baseUrl);
    for (const [k, v] of Object.entries(params)) {
      if (v) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return baseUrl;
  }
}

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // ignore fs errors
  }
}

function formatOrderStatusFa(status: string): string {
  switch (status) {
    case 'registered':
      return '🟡 ثبت اولیه (در انتظار بررسی کارگاه)';
    case 'confirmed':
      return '🔵 تایید و صدور پیش‌فاکتور فروش';
    case 'processing':
      return '🟣 در حال آماده‌سازی و بارگیری';
    case 'shipped':
      return '🚚 تحویل باربری / در مسیر ارسال';
    case 'delivered':
      return '🟢 تحویل نهایی به خریدار';
    case 'cancelled':
      return '🔴 لغو شده';
    default:
      return status || 'در حال پیگیری';
  }
}

function formatDeliveryMethodFa(method?: string): string {
  switch (method) {
    case 'freight_terminal':
      return 'باربری مجاز بین‌شهری';
    case 'truck_dedicated':
      return 'وانت نیسان / خاور دربستی';
    case 'pickup_factory':
      return 'تحویل حضوری درب کارگاه';
    case 'courier':
      return 'پیک و پست پیشتاز';
    default:
      return method || 'باربری هماهنگ‌شده';
  }
}

function stripUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean as Partial<T>;
}

function mergeCatalogProducts(snapshot: TelegramSyncedSnapshot): StoreProduct[] {
  const vermiPrice =
    typeof snapshot.vermiPricePerKg === 'number' && snapshot.vermiPricePerKg > 0
      ? snapshot.vermiPricePerKg
      : 24000;
  const base = getStoreProducts(vermiPrice);
  const overrides = snapshot.productOverrides || {};
  const result: StoreProduct[] = [];
  const baseIds = new Set<string>();

  for (const p of base) {
    baseIds.add(p.id);
    const ov = overrides[p.id];
    if (ov?.isDeleted) continue;
    const cleanOv = ov ? stripUndefinedFields(ov) : undefined;
    const merged: StoreProduct = cleanOv ? ({ ...p, ...cleanOv } as StoreProduct) : p;
    if (!merged.isDisabled) {
      result.push(merged);
    }
  }

  for (const [id, ov] of Object.entries(overrides)) {
    if (!baseIds.has(id) && ov && !ov.isDeleted && !ov.isDisabled) {
      result.push({
        id,
        name: ov.name || 'محصول کارگاه',
        category: ov.category || 'vermicompost',
        categoryLabel: ov.categoryLabel || 'محصولات کارگاه',
        tagline: ov.tagline || '',
        description: ov.description || '',
        highlights: Array.isArray(ov.highlights) ? ov.highlights : [],
        specs: Array.isArray(ov.specs) ? ov.specs : [],
        packagingOptions: Array.isArray(ov.packagingOptions) ? ov.packagingOptions : [],
        rating: ov.rating ?? 4.9,
        reviewCount: ov.reviewCount ?? 1,
        deliveryTimeDays: ov.deliveryTimeDays || '۱ الی ۳ روز کاری',
        colorScheme: ov.colorScheme || 'emerald',
        inStock: ov.inStock ?? true,
        stockQuantity: ov.stockQuantity ?? 50,
        stockUnit: ov.stockUnit || 'کیسه',
        ...ov,
      });
    }
  }

  return result;
}

class TelegramStoreBotService {
  private config: TelegramBotPersistedConfig;
  private snapshot: TelegramSyncedSnapshot;
  private deps: TelegramBotServerDeps;
  private isPollingRunning = false;
  private pollingAbortController: AbortController | null = null;
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private pollingGen = 0;
  private pollInFlight = false;
  private consecutive409 = 0;
  private updateOffset = 0;
  private botVerified = false;
  private conflictActive = false;
  private conflictMessage: string | null = null;
  private lastError: string | null = null;
  private lastUpdateAt: string | null = null;
  private knownChatIds = new Set<number>();
  private chatSessions = new Map<number, ChatSessionState>();
  private userPhones: Record<string, TelegramVerifiedPhoneRecord> = {};
  private botCarts: Record<string, BotCartEntry[]> = {};

  constructor(deps: TelegramBotServerDeps) {
    this.deps = deps;
    this.config = this.loadConfig();
    this.snapshot = this.loadSnapshot();
    this.userPhones = this.loadUserPhones();
    this.botCarts = this.loadBotCarts();
  }

  private loadConfig(): TelegramBotPersistedConfig {
    let loaded: Partial<TelegramBotPersistedConfig> = {};
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        loaded = JSON.parse(raw) || {};
      }
    } catch {
      // ignore corrupted file
    }

    const envToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const envAdminChat = (process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
    const envAppUrl = (process.env.APP_URL || '').trim();

    return {
      botToken: (loaded.botToken || envToken || '').trim(),
      botId: loaded.botId,
      botUsername: loaded.botUsername,
      botFirstName: loaded.botFirstName,
      webAppUrl: (loaded.webAppUrl || envAppUrl || '').trim(),
      mode: loaded.mode === 'webhook' ? 'webhook' : 'polling',
      adminChatId: (loaded.adminChatId || envAdminChat || '').trim(),
      storageChatId: (loaded.storageChatId || '').trim(),
      enabled: typeof loaded.enabled === 'boolean' ? loaded.enabled : Boolean(loaded.botToken || envToken),
      webhookSecret: loaded.webhookSecret || crypto.randomBytes(16).toString('hex'),
      updatedAt: loaded.updatedAt,
    };
  }

  private saveConfig(): void {
    ensureDataDir();
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf8');
    } catch {
      // ignore write failure
    }
  }

  private loadSnapshot(): TelegramSyncedSnapshot {
    try {
      if (fs.existsSync(SNAPSHOT_FILE)) {
        const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            settings: parsed.settings || {},
            productOverrides: parsed.productOverrides || {},
            orders: Array.isArray(parsed.orders) ? parsed.orders : [],
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      settings: {},
      productOverrides: {},
      orders: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private saveSnapshot(): void {
    ensureDataDir();
    try {
      fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(this.snapshot, null, 2), 'utf8');
    } catch {
      // ignore
    }
  }

  private loadUserPhones(): Record<string, TelegramVerifiedPhoneRecord> {
    try {
      if (fs.existsSync(PHONES_FILE)) {
        const raw = fs.readFileSync(PHONES_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, TelegramVerifiedPhoneRecord>;
        }
      }
    } catch {
      // ignore
    }
    return {};
  }

  private saveUserPhones(): void {
    ensureDataDir();
    try {
      fs.writeFileSync(PHONES_FILE, JSON.stringify(this.userPhones, null, 2), 'utf8');
    } catch {
      // ignore
    }
  }

  private loadBotCarts(): Record<string, BotCartEntry[]> {
    try {
      if (fs.existsSync(CARTS_FILE)) {
        const raw = fs.readFileSync(CARTS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, BotCartEntry[]>;
        }
      }
    } catch {
      // ignore
    }
    return {};
  }

  private saveBotCarts(): void {
    ensureDataDir();
    try {
      fs.writeFileSync(CARTS_FILE, JSON.stringify(this.botCarts, null, 2), 'utf8');
    } catch {
      // ignore
    }
  }

  private getChatCart(chatId: number): BotCartEntry[] {
    return this.botCarts[String(chatId)] || [];
  }

  private getChatCartItemCount(chatId: number): number {
    return this.getChatCart(chatId).reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
  }

  private addToChatCart(chatId: number, productId: string, packageId: string, quantity = 1): void {
    const key = String(chatId);
    const list = [...(this.botCarts[key] || [])];
    const idx = list.findIndex((x) => x.productId === productId && x.packageId === packageId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], quantity: list[idx].quantity + Math.max(1, quantity) };
    } else {
      list.push({ productId, packageId, quantity: Math.max(1, quantity) });
    }
    this.botCarts[key] = list;
    this.saveBotCarts();
  }

  private updateChatCartIndexQty(chatId: number, idx: number, delta: number): void {
    const key = String(chatId);
    const list = [...(this.botCarts[key] || [])];
    if (idx < 0 || idx >= list.length) return;
    const nextQty = (list[idx].quantity || 1) + delta;
    if (nextQty <= 0) {
      list.splice(idx, 1);
    } else {
      list[idx] = { ...list[idx], quantity: nextQty };
    }
    this.botCarts[key] = list;
    this.saveBotCarts();
  }

  private clearChatCart(chatId: number): void {
    delete this.botCarts[String(chatId)];
    this.saveBotCarts();
  }

  private resolveChatCartSummary(chatId: number): {
    items: CartItem[];
    totalWeightKg: number;
    subtotalToman: number;
    discountToman: number;
    shippingEstimateToman: number;
    freeShippingApplied: boolean;
    finalPayableToman: number;
  } {
    const entries = this.getChatCart(chatId);
    const catalog = mergeCatalogProducts(this.snapshot);
    const items: CartItem[] = [];
    let subtotalToman = 0;
    let totalWeightKg = 0;
    let discountToman = 0;

    for (const entry of entries) {
      const prod = catalog.find((p) => p.id === entry.productId);
      if (!prod || !prod.inStock) continue;
      const pkg = (prod.packagingOptions || []).find((o) => o.id === entry.packageId);
      if (!pkg || pkg.isOutOfStock) continue;
      const qty = Math.max(1, Number(entry.quantity) || 1);
      const lineTotal = pkg.priceToman * qty;
      const pkgDiscount =
        pkg.originalPriceToman && pkg.originalPriceToman > pkg.priceToman
          ? (pkg.originalPriceToman - pkg.priceToman) * qty
          : (pkg.discountToman || 0) * qty;
      subtotalToman += lineTotal;
      discountToman += pkgDiscount;
      totalWeightKg += (pkg.nominalWeightKg || 0) * qty;
      items.push({
        id: `${prod.id}-${pkg.id}`,
        product: { ...prod, imageUrl: prod.imageUrl?.startsWith('data:') ? '' : prod.imageUrl },
        selectedPackage: pkg,
        quantity: qty,
        unitPrice: pkg.priceToman,
        totalPrice: lineTotal,
      });
    }

    const s = this.snapshot.settings;
    const smallFee = Number(s.shippingSmallFee) >= 0 ? Number(s.shippingSmallFee) : 180000;
    const mediumBaseFee = Number(s.shippingMediumBaseFee) >= 0 ? Number(s.shippingMediumBaseFee) : 450000;
    const tonFee = Number(s.shippingTonFee) >= 0 ? Number(s.shippingTonFee) : 1500000;
    const freeThreshold = Number(s.freeShippingThresholdToman) || 0;

    const freeShippingApplied = freeThreshold > 0 && subtotalToman >= freeThreshold;
    const shippingEstimateToman = freeShippingApplied
      ? 0
      : totalWeightKg === 0
      ? 0
      : totalWeightKg <= 40
      ? smallFee
      : totalWeightKg <= 300
      ? mediumBaseFee + Math.round(totalWeightKg * 2800)
      : Math.round((totalWeightKg / 1000) * tonFee);

    return {
      items,
      totalWeightKg: Math.round(totalWeightKg * 10) / 10,
      subtotalToman,
      discountToman,
      shippingEstimateToman,
      freeShippingApplied,
      finalPayableToman: subtotalToman + shippingEstimateToman,
    };
  }

  private setVerifiedUserPhone(
    telegramUserId: number | string,
    rawPhone: string,
    meta?: { fullName?: string; username?: string }
  ): string {
    const normalized = normalizeIranPhoneNumber(rawPhone);
    if (!normalized) return '';
    const key = String(telegramUserId);
    this.userPhones[key] = {
      phoneNumber: normalized,
      fullName: meta?.fullName || this.userPhones[key]?.fullName,
      username: meta?.username || this.userPhones[key]?.username,
      updatedAt: new Date().toISOString(),
    };
    this.saveUserPhones();
    return normalized;
  }

  private getWorkshopName(): string {
    return (
      this.snapshot.settings.workshopName?.trim() ||
      'گروه تولیدی و زیست‌فناوری مهندس صفری'
    );
  }

  private getEffectiveWebAppUrl(): string {
    const fromSettings = sanitizeHttpsUrl(this.snapshot.settings?.telegramWebAppUrl);
    if (fromSettings) return fromSettings;
    const fromConfig = sanitizeHttpsUrl(this.config.webAppUrl);
    if (fromConfig) return fromConfig;
    return sanitizeHttpsUrl(process.env.APP_URL);
  }

  private async tgCall<T = any>(
    method: string,
    body?: Record<string, unknown>,
    tokenOverride?: string,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; result?: T; description?: string; error_code?: number }> {
    const token = (tokenOverride ?? this.config.botToken).trim();
    if (!token) {
      return { ok: false, description: 'توکن ربات تلگرام تنظیم نشده است.' };
    }
    const url = `https://api.telegram.org/bot${token}/${method}`;
    const resp = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: signal || AbortSignal.timeout(32000),
    });
    const json = (await resp.json().catch(() => null)) as any;
    if (!json || typeof json !== 'object') {
      return { ok: false, description: `پاسخ نامعتبر از سرور تلگرام (HTTP ${resp.status})` };
    }
    return json;
  }

  private async isPublicWebhookReachable(baseUrl: string): Promise<boolean> {
    if (!isHttpsUrl(baseUrl)) return false;
    try {
      const probeUrl = `${baseUrl.replace(/\/+$/, '')}/api/app-version`;
      const resp = await fetch(probeUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(4000),
      });
      if ([301, 302, 303, 307, 308, 401, 403].includes(resp.status)) {
        return false;
      }
      const ct = String(resp.headers.get('content-type') || '').toLowerCase();
      return resp.ok && ct.includes('application/json');
    } catch {
      return false;
    }
  }

  public getStatus(): TelegramBotPublicStatus {
    const products = mergeCatalogProducts(this.snapshot);
    const webAppUrl = this.getEffectiveWebAppUrl();
    const botUsername = this.config.botUsername;
    const isRunning =
      this.config.enabled &&
      Boolean(this.config.botToken) &&
      (this.botVerified || this.config.mode === 'webhook' || this.isPollingRunning);
    const effectiveMode: 'polling' | 'webhook' | 'standby' =
      this.config.mode === 'polling' && this.conflictActive ? 'standby' : this.config.mode;

    return {
      hasToken: Boolean(this.config.botToken),
      tokenMasked: maskToken(this.config.botToken),
      enabled: this.config.enabled,
      isRunning,
      botVerified: this.botVerified,
      conflictActive: this.conflictActive,
      conflictMessage: this.conflictMessage,
      effectiveMode,
      mode: this.config.mode,
      botId: this.config.botId,
      botUsername,
      botFirstName: this.config.botFirstName,
      botLink: botUsername ? `https://t.me/${botUsername}` : undefined,
      miniAppUrl: botUsername ? `https://t.me/${botUsername}` : undefined,
      webAppUrl,
      isWebAppUrlHttps: isHttpsUrl(webAppUrl),
      adminChatId: this.config.adminChatId,
      storageChatId: this.config.storageChatId || '',
      syncedProductsCount: products.length,
      syncedOrdersCount: this.snapshot.orders.length,
      knownUsersCount: this.knownChatIds.size,
      lastError: this.lastError,
      lastUpdateAt: this.lastUpdateAt,
    };
  }

  public getBotToken(): string {
    return (this.config.botToken || '').trim();
  }

  public getAdminChatId(): string {
    return (this.config.adminChatId || '').trim();
  }

  public getStorageChatId(): string {
    return (this.config.storageChatId || '').trim();
  }

  public getUserPhonesCopy(): Record<string, TelegramVerifiedPhoneRecord> {
    return { ...this.userPhones };
  }

  public mergeUserPhones(incoming: Record<string, TelegramVerifiedPhoneRecord>): void {
    let changed = false;
    for (const [uid, rec] of Object.entries(incoming || {})) {
      if (!rec || !rec.phoneNumber) continue;
      const existing = this.userPhones[uid];
      if (!existing || (rec.updatedAt && (!existing.updatedAt || rec.updatedAt > existing.updatedAt))) {
        this.userPhones[uid] = rec;
        changed = true;
      }
    }
    if (changed) {
      this.saveUserPhones();
    }
  }

  public syncStoreSnapshot(input: {
    settings?: Partial<WorkshopStoreSettings>;
    productOverrides?: Record<string, Partial<StoreProduct>>;
    orders?: CustomerOrder[];
    vermiPricePerKg?: number;
  }): TelegramBotPublicStatus {
    const prevEffectiveUrl = this.getEffectiveWebAppUrl();
    if (input.settings && typeof input.settings === 'object') {
      // Strip sensitive admin credentials before saving snapshot
      const { adminPassword: _pw, ...safeSettings } = input.settings;
      const incomingWebUrl = sanitizeHttpsUrl(safeSettings.telegramWebAppUrl);
      this.snapshot.settings = {
        ...safeSettings,
        ...(incomingWebUrl ? { telegramWebAppUrl: incomingWebUrl } : {}),
      };
      if (incomingWebUrl && incomingWebUrl !== this.config.webAppUrl) {
        this.config.webAppUrl = incomingWebUrl;
        this.saveConfig();
      }
    }
    if (input.productOverrides && typeof input.productOverrides === 'object') {
      this.snapshot.productOverrides = input.productOverrides;
    }
    if (Array.isArray(input.orders)) {
      this.snapshot.orders = input.orders.slice(0, 300);
    }
    if (typeof input.vermiPricePerKg === 'number' && input.vermiPricePerKg > 0) {
      this.snapshot.vermiPricePerKg = input.vermiPricePerKg;
    }
    this.snapshot.updatedAt = new Date().toISOString();
    this.saveSnapshot();

    const nextEffectiveUrl = this.getEffectiveWebAppUrl();
    if (nextEffectiveUrl && nextEffectiveUrl !== prevEffectiveUrl && this.config.botToken) {
      void this.syncAllMenuButtons(nextEffectiveUrl);
    }
    return this.getStatus();
  }

  private async syncAllMenuButtons(webAppUrl: string): Promise<void> {
    if (!isHttpsUrl(webAppUrl) || !this.config.botToken) return;
    try {
      await this.tgCall('setChatMenuButton', {
        menu_button: {
          type: 'web_app',
          text: 'فروشگاه',
          web_app: { url: webAppUrl },
        },
      });
      for (const uid of Object.keys(this.userPhones)) {
        const numId = Number(uid);
        if (Number.isFinite(numId) && numId > 0) {
          await this.syncUserChatMenuButton(numId);
        }
      }
    } catch {
      // non-fatal menu refresh
    }
  }

  public upsertOrderInSnapshot(order: CustomerOrder): void {
    const existingIdx = this.snapshot.orders.findIndex((o) => o.orderNumber === order.orderNumber);
    if (existingIdx >= 0) {
      this.snapshot.orders[existingIdx] = order;
    } else {
      this.snapshot.orders.unshift(order);
    }
    this.snapshot.orders = this.snapshot.orders.slice(0, 300);
    this.snapshot.updatedAt = new Date().toISOString();
    this.saveSnapshot();
  }

  public async configureAndStart(params: {
    botToken?: string;
    webAppUrl?: string;
    mode?: TelegramTransportMode;
    adminChatId?: string;
    storageChatId?: string;
    enabled?: boolean;
  }): Promise<{ ok: boolean; status: TelegramBotPublicStatus; message: string }> {
    const incomingToken = typeof params.botToken === 'string' ? params.botToken.trim() : '';
    const nextToken = incomingToken || this.config.botToken;

    if (!nextToken) {
      return {
        ok: false,
        status: this.getStatus(),
        message: 'لطفاً توکن ربات دریافت‌شده از BotFather را وارد کنید.',
      };
    }

    // Verify token cleanly against Telegram servers
    const meRes = await this.tgCall<{ id: number; username?: string; first_name?: string }>('getMe', undefined, nextToken);
    if (!meRes.ok || !meRes.result) {
      const errDesc = meRes.description || 'توکن ربات نامعتبر است یا ارتباط با سرور تلگرام برقرار نشد.';
      this.botVerified = false;
      this.conflictActive = false;
      this.conflictMessage = null;
      this.lastError = errDesc;
      return {
        ok: false,
        status: this.getStatus(),
        message: `خطا در تایید توکن ربات تلگرام: ${errDesc}`,
      };
    }

    this.botVerified = true;
    this.conflictActive = false;
    this.conflictMessage = null;
    this.config.botToken = nextToken;
    this.config.botId = meRes.result.id;
    this.config.botUsername = meRes.result.username || '';
    this.config.botFirstName = meRes.result.first_name || 'فروشگاه کارگاه صفری';

    if (typeof params.webAppUrl === 'string' && params.webAppUrl.trim()) {
      const cleanUrl = sanitizeHttpsUrl(params.webAppUrl) || params.webAppUrl.trim().replace(/\/+$/, '');
      if (!isDeadLegacyAiStudioUrl(cleanUrl)) {
        this.config.webAppUrl = cleanUrl;
        if (isHttpsUrl(cleanUrl)) {
          this.snapshot.settings = {
            ...this.snapshot.settings,
            telegramWebAppUrl: cleanUrl,
          };
          this.saveSnapshot();
          this.deps.onWebAppUrlConfigured?.(cleanUrl);
        }
      }
    }
    if (params.mode === 'webhook' || params.mode === 'polling') {
      this.config.mode = params.mode;
    }
    if (typeof params.adminChatId === 'string') {
      this.config.adminChatId = params.adminChatId.trim();
    }
    if (typeof params.storageChatId === 'string') {
      this.config.storageChatId = params.storageChatId.trim();
    }
    this.config.enabled = params.enabled !== false;
    this.config.updatedAt = new Date().toISOString();
    if (!this.config.webhookSecret) {
      this.config.webhookSecret = crypto.randomBytes(16).toString('hex');
    }
    this.lastError = null;
    this.saveConfig();

    // Register commands, description & Telegram Menu Button WebApp automatically
    await this.registerBotMetadataWithTelegram();

    if (!this.config.enabled) {
      await this.stopBot(false);
      return {
        ok: true,
        status: this.getStatus(),
        message: `اطلاعات ربات @${this.config.botUsername} ذخیره شد (وضعیت: متوقف).`,
      };
    }

    if (this.config.mode === 'webhook') {
      const webAppUrl = this.getEffectiveWebAppUrl();
      const reachable = await this.isPublicWebhookReachable(webAppUrl);
      if (!isHttpsUrl(webAppUrl) || !reachable) {
        this.config.mode = 'polling';
        this.saveConfig();
        await this.startPolling();
        return {
          ok: true,
          status: this.getStatus(),
          message: !isHttpsUrl(webAppUrl)
            ? `ربات @${this.config.botUsername} با حالت Long-Polling متصل شد (برای حالت Webhook آدرس HTTPS الزامی است).`
            : `نشانی فعلی پشت لایه احراز هویت پیش‌نمایش است؛ ربات @${this.config.botUsername} به‌طور خودکار در حالت Long-Polling فعال و متصل شد ✓`,
        };
      }
      this.stopPollingLoop();
      const webhookUrl = `${webAppUrl}/api/telegram/webhook/${this.config.webhookSecret}`;
      const whRes = await this.tgCall('setWebhook', {
        url: webhookUrl,
        secret_token: this.config.webhookSecret,
        allowed_updates: ['message', 'callback_query'],
      });
      if (!whRes.ok) {
        this.lastError = whRes.description || 'ثبت Webhook ناموفق بود';
        return {
          ok: false,
          status: this.getStatus(),
          message: `خطا در ثبت Webhook: ${this.lastError}`,
        };
      }
      return {
        ok: true,
        status: this.getStatus(),
        message: `ربات @${this.config.botUsername} و وب‌اپ فروشگاه با موفقیت روی سرور تلگرام راه‌اندازی شدند ✓`,
      };
    }

    // Polling mode
    await this.startPolling();
    return {
      ok: true,
      status: this.getStatus(),
      message: `ربات @${this.config.botUsername} با موفقیت به تلگرام متصل و فعال شد ✓`,
    };
  }

  private async registerBotMetadataWithTelegram(): Promise<void> {
    const workshopName = this.getWorkshopName();
    const commands = [
      { command: 'start', description: 'شروع و منوی اصلی فروشگاه + باز کردن وب‌اپ' },
      { command: 'shop', description: 'لیست کامل محصولات، عکس، صوت و قیمت روز' },
      { command: 'cart', description: 'سبد خرید من و ثبت سفارش مستقیم در تلگرام' },
      { command: 'search', description: 'جستجوی سریع محصول در کاتالوگ فروشگاه' },
      { command: 'payment', description: 'شماره کارت و شبا جهت واریز و ارسال رسید پرداخت' },
      { command: 'calculator', description: 'محاسبه‌گر هوشمند دوز کود و برنامه تغذیه' },
      { command: 'tips', description: 'نکات طلایی باغبانی و کشاورزی' },
      { command: 'weather', description: 'هواشناسی کشاورزی و زمان طلایی سمپاشی' },
      { command: 'orders', description: 'پیگیری وضعیت سفارش و پیش‌فاکتور' },
      { command: 'consultant', description: 'مشاوره تخصصی آنلاین با مهندس صفری' },
      { command: 'contact', description: 'نشانی کارگاه و شماره‌های تماس پشتیبانی' },
      { command: 'phone', description: 'تایید خودکار شماره موبایل برای خرید سریع' },
      { command: 'myid', description: 'دریافت شناسه عددی تلگرام شما (Chat ID)' },
    ];

    try {
      await this.tgCall('setMyCommands', { commands });
      await this.tgCall('setMyCommands', { commands, language_code: 'fa' });
      await this.tgCall('setMyShortDescription', {
        short_description: `${workshopName} | فروشگاه مستقیم محصولات و مینی‌اپ باغبانی`.slice(0, 120),
      });
      await this.tgCall('setMyDescription', {
        description: `فروشگاه آنلاین ${workshopName}\n\n🛒 خرید مستقیم ورمیکمپوست، کمپوست، ورمی‌تی و زئولیت\n🧮 محاسبه‌گر دوز مصرف گیاهان\n🌦 هواشناسی کشاورزی و سمپاشی\n🤖 مشاور هوشمند ۲۴ ساعته`,
      });

      const webAppUrl = this.getEffectiveWebAppUrl();
      if (isHttpsUrl(webAppUrl)) {
        await this.tgCall('setChatMenuButton', {
          menu_button: {
            type: 'web_app',
            text: 'فروشگاه',
            web_app: { url: webAppUrl },
          },
        });
        for (const uid of Object.keys(this.userPhones)) {
          const numId = Number(uid);
          if (Number.isFinite(numId) && numId > 0) {
            await this.syncUserChatMenuButton(numId);
          }
        }
      }
    } catch {
      // Non-fatal metadata update
    }
  }

  public async autoStartIfConfigured(): Promise<void> {
    if (!this.config.botToken || !this.config.enabled) return;
    try {
      const meRes = await this.tgCall<{ id: number; username?: string; first_name?: string }>('getMe');
      if (meRes.ok && meRes.result) {
        this.botVerified = true;
        this.conflictActive = false;
        this.conflictMessage = null;
        this.lastError = null;
        this.config.botId = meRes.result.id;
        this.config.botUsername = meRes.result.username || this.config.botUsername;
        this.config.botFirstName = meRes.result.first_name || this.config.botFirstName;
        this.saveConfig();
        await this.registerBotMetadataWithTelegram();
      } else {
        this.botVerified = false;
        this.lastError = meRes.description || 'خطا در تایید توکن ربات';
        return;
      }

      if (this.config.mode === 'webhook') {
        const webAppUrl = this.getEffectiveWebAppUrl();
        const reachable = await this.isPublicWebhookReachable(webAppUrl);
        if (reachable) {
          const webhookUrl = `${webAppUrl}/api/telegram/webhook/${this.config.webhookSecret}`;
          await this.tgCall('setWebhook', {
            url: webhookUrl,
            secret_token: this.config.webhookSecret,
            allowed_updates: ['message', 'callback_query'],
          });
          return;
        }
        // Fallback smoothly to Long-Polling on Preview/cookie-gated environments
        this.config.mode = 'polling';
        this.saveConfig();
      }

      // Brief startup grace period so a terminating server process releases its getUpdates socket cleanly
      await this.startPolling(1200);
    } catch (err: any) {
      if (!this.botVerified) {
        this.lastError = err?.message || 'خطا در اتصال خودکار ربات';
      }
    }
  }

  public async claimPolling(): Promise<{ ok: boolean; status: TelegramBotPublicStatus; message: string }> {
    if (!this.config.botToken) {
      return {
        ok: false,
        status: this.getStatus(),
        message: 'توکن ربات تنظیم نشده است.',
      };
    }
    this.config.enabled = true;
    this.config.mode = 'polling';
    this.consecutive409 = 0;
    this.conflictActive = false;
    this.conflictMessage = null;
    this.lastError = null;
    this.saveConfig();

    try {
      await this.tgCall('deleteWebhook', { drop_pending_updates: false });
    } catch {
      // ignore webhook deletion error
    }

    await this.startPolling(50);
    await new Promise((r) => setTimeout(r, 250));
    return {
      ok: true,
      status: this.getStatus(),
      message: `دریافت پیام‌های ورودی ربات @${this.config.botUsername || 'تلگرام'} روی همین محیط فعال شد ✓`,
    };
  }

  private stopPollingLoop(): void {
    this.pollingGen += 1;
    this.isPollingRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.pollingAbortController) {
      try {
        this.pollingAbortController.abort();
      } catch {
        // ignore
      }
      this.pollingAbortController = null;
    }
  }

  public async stopBot(clearEnabledFlag = true): Promise<TelegramBotPublicStatus> {
    this.stopPollingLoop();
    if (clearEnabledFlag) {
      this.config.enabled = false;
      this.saveConfig();
    }
    if (this.config.botToken && this.config.mode === 'webhook') {
      try {
        await this.tgCall('deleteWebhook', { drop_pending_updates: false });
      } catch {
        // ignore
      }
    }
    return this.getStatus();
  }

  private async startPolling(initialDelayMs = 150): Promise<void> {
    this.stopPollingLoop();
    if (!this.config.botToken || !this.config.enabled) return;

    const myGen = ++this.pollingGen;
    this.consecutive409 = 0;

    // Only call deleteWebhook if an active webhook URL actually exists
    try {
      const whInfo = await this.tgCall<{ url?: string }>('getWebhookInfo');
      if (myGen !== this.pollingGen) return;
      if (whInfo.ok && whInfo.result?.url) {
        await this.tgCall('deleteWebhook', { drop_pending_updates: false });
        if (myGen !== this.pollingGen) return;
      }
    } catch {
      // ignore non-fatal check
    }

    this.isPollingRunning = true;
    this.scheduleNextPoll(initialDelayMs, myGen);
  }

  private scheduleNextPoll(delayMs: number, gen: number): void {
    if (
      gen !== this.pollingGen ||
      !this.isPollingRunning ||
      !this.config.enabled ||
      this.config.mode !== 'polling'
    ) {
      return;
    }
    if (this.pollingTimer) clearTimeout(this.pollingTimer);
    this.pollingTimer = setTimeout(() => {
      void this.pollOnce(gen);
    }, delayMs);
  }

  private async pollOnce(gen: number): Promise<void> {
    if (
      gen !== this.pollingGen ||
      !this.isPollingRunning ||
      !this.config.enabled ||
      this.config.mode !== 'polling'
    ) {
      return;
    }
    if (this.pollInFlight) {
      this.scheduleNextPoll(500, gen);
      return;
    }

    this.pollInFlight = true;
    const ctrl = new AbortController();
    this.pollingAbortController = ctrl;

    try {
      const res = await this.tgCall<any[]>(
        'getUpdates',
        {
          offset: this.updateOffset,
          timeout: 22,
          allowed_updates: ['message', 'callback_query'],
        },
        undefined,
        ctrl.signal
      );

      if (gen !== this.pollingGen) return;

      if (!res.ok) {
        const desc = res.description || 'خطا در دریافت پیام‌های ربات';
        if (res.error_code === 409) {
          this.botVerified = true;
          this.lastError = null;
          this.consecutive409 += 1;
          if (this.consecutive409 <= 2) {
            this.conflictActive = false;
            this.conflictMessage = null;
            const waitMs = this.consecutive409 === 1 ? 4500 : 8000;
            this.scheduleNextPoll(waitMs, gen);
            return;
          }
          // Another active environment (Dev vs Preview) currently holds the single Telegram getUpdates slot.
          // Outbound notifications, payment alerts, and Telegram Cloud DB remain 100% live and operational.
          this.conflictActive = true;
          this.conflictMessage =
            'یک محیط هم‌زمان دیگر (Dev یا نسخه منتشرشده) در حال دریافت پیام‌های ورودی ربات است. ارسال اعلان سفارش‌ها و دیتابیس ابری تلگرام در این محیط کاملاً متصل و فعال است.';
          const backoffSchedule = [15000, 25000, 40000];
          const idx = Math.min(this.consecutive409 - 3, backoffSchedule.length - 1);
          this.scheduleNextPoll(backoffSchedule[idx], gen);
          return;
        }
        if (res.error_code === 401 || res.error_code === 404) {
          this.botVerified = false;
          this.conflictActive = false;
          this.conflictMessage = null;
          this.lastError = desc;
        } else if (!this.botVerified) {
          this.lastError = desc;
        }
        this.scheduleNextPoll(5500, gen);
        return;
      }

      this.botVerified = true;
      this.consecutive409 = 0;
      this.conflictActive = false;
      this.conflictMessage = null;
      this.lastError = null;
      const updates = Array.isArray(res.result) ? res.result : [];
      for (const upd of updates) {
        if (gen !== this.pollingGen) return;
        if (typeof upd.update_id === 'number' && upd.update_id >= this.updateOffset) {
          this.updateOffset = upd.update_id + 1;
        }
        await this.handleUpdate(upd);
      }
      this.scheduleNextPoll(150, gen);
    } catch (err: any) {
      if (gen !== this.pollingGen) return;
      if (err?.name !== 'AbortError' && !this.botVerified) {
        this.lastError = err?.message || 'خطا در ارتباط با تلگرام';
      }
      this.scheduleNextPoll(3500, gen);
    } finally {
      if (this.pollingAbortController === ctrl) {
        this.pollingAbortController = null;
      }
      this.pollInFlight = false;
    }
  }

  private buildWebAppUrlForChat(
    tab?: string,
    extraParams?: Record<string, string>,
    chatId?: number | string
  ): string | null {
    const base = this.getEffectiveWebAppUrl();
    if (!isHttpsUrl(base)) return null;
    const query: Record<string, string> = { ...(extraParams || {}) };
    if (tab) query.tab = tab;

    // When Bot Mini App points to static GitHub Pages, attach live non-dead backend API URL
    try {
      const parsedBase = new URL(base);
      const isStaticHost =
        parsedBase.hostname.endsWith('.github.io') ||
        parsedBase.hostname.endsWith('.pages.dev') ||
        parsedBase.hostname.endsWith('.netlify.app') ||
        parsedBase.hostname.endsWith('.vercel.app');
      if (isStaticHost && !query.api) {
        const backendUrl =
          sanitizeHttpsUrl(this.snapshot.settings?.githubApiBaseUrl) || sanitizeHttpsUrl(process.env.APP_URL);
        if (backendUrl && backendUrl !== base) {
          query.api = backendUrl;
        }
      }
    } catch {
      // ignore URL check
    }

    if (chatId !== undefined && chatId !== null) {
      const uid = String(chatId).trim();
      const phoneRec = this.userPhones[uid];
      if (phoneRec?.phoneNumber) {
        query.tg_phone = phoneRec.phoneNumber;
        query.tg_uid = uid;
        if (phoneRec.username) query.tg_username = phoneRec.username;
        if (phoneRec.fullName) query.tg_name = phoneRec.fullName;
      }
    }
    return Object.keys(query).length > 0 ? appendQueryParams(base, query) : base;
  }

  private async syncUserChatMenuButton(chatId: number): Promise<void> {
    const url = this.buildWebAppUrlForChat(undefined, undefined, chatId);
    if (!url) return;
    try {
      await this.tgCall('setChatMenuButton', {
        chat_id: chatId,
        menu_button: {
          type: 'web_app',
          text: 'فروشگاه',
          web_app: { url },
        },
      });
    } catch {
      // non-fatal per-chat menu update
    }
  }

  private webAppButton(
    text: string,
    tab?: string,
    extraParams?: Record<string, string>,
    chatId?: number | string
  ) {
    const targetUrl = this.buildWebAppUrlForChat(tab, extraParams, chatId);
    if (!targetUrl) return null;
    return {
      text,
      web_app: { url: targetUrl },
    };
  }

  private buildMainMenuKeyboard(chatId?: number) {
    const rows: any[][] = [];
    const launchBtn = this.webAppButton('🌐 باز کردن نسخه کامل فروشگاه (وب‌اپ)', undefined, undefined, chatId);
    if (launchBtn) {
      rows.push([launchBtn]);
    }
    const cartCount = chatId ? this.getChatCartItemCount(chatId) : 0;
    rows.push([
      { text: '🛍 محصولات و قیمت روز', callback_data: 'cb:shop' },
      {
        text: cartCount > 0 ? `🧺 سبد خرید (${cartCount})` : '🧺 سبد خرید من',
        callback_data: 'cb:bot_cart',
      },
    ]);
    rows.push([
      { text: '🔍 جستجوی محصول', callback_data: 'cb:search' },
      { text: '🧮 محاسبه دوز کود', callback_data: 'cb:calc' },
    ]);
    rows.push([
      { text: '🌿 نکات طلایی باغبانی', callback_data: 'cb:tips' },
      { text: '🌦 هواشناسی کشاورزی', callback_data: 'cb:weather' },
    ]);
    rows.push([
      { text: '🤖 مشاوره هوشمند باغبانی', callback_data: 'cb:consultant' },
      { text: '📦 پیگیری سفارش', callback_data: 'cb:orders' },
    ]);
    rows.push([
      { text: '💳 شماره کارت و شبا (ارسال رسید واریز)', callback_data: 'cb:payment' },
    ]);
    const footerRow: any[] = [{ text: '📞 تماس و نشانی کارگاه', callback_data: 'cb:contact' }];
    if (chatId && !this.userPhones[String(chatId)]) {
      footerRow.unshift({ text: '📱 تایید شماره برای خرید سریع', callback_data: 'cb:ask_phone' });
    }
    rows.push(footerRow);
    return { inline_keyboard: rows };
  }

  private async sendMessage(chatId: number | string, htmlText: string, replyMarkup?: unknown): Promise<boolean> {
    const res = await this.tgCall('sendMessage', {
      chat_id: chatId,
      text: htmlText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
    return Boolean(res.ok);
  }

  private async tgUploadMultipart(params: {
    method: 'sendPhoto' | 'sendAudio' | 'sendVoice' | 'sendDocument';
    fieldName: 'photo' | 'audio' | 'voice' | 'document';
    chatId: number | string;
    buffer: Buffer;
    mimeType: string;
    filename: string;
    caption?: string;
    extraFields?: Record<string, string>;
    replyMarkup?: unknown;
  }): Promise<{ ok: boolean; description?: string }> {
    const token = (this.config.botToken || '').trim();
    if (!token) return { ok: false, description: 'توکن ربات تنظیم نشده است.' };

    try {
      const form = new FormData();
      form.append('chat_id', String(params.chatId));
      if (params.caption) {
        form.append('caption', params.caption.slice(0, 1000));
        form.append('parse_mode', 'HTML');
      }
      if (params.extraFields) {
        for (const [k, v] of Object.entries(params.extraFields)) {
          if (v !== undefined && v !== null) {
            form.append(k, String(v));
          }
        }
      }
      if (params.replyMarkup) {
        form.append('reply_markup', JSON.stringify(params.replyMarkup));
      }
      const blob = new Blob([new Uint8Array(params.buffer)], {
        type: params.mimeType || 'application/octet-stream',
      });
      form.append(params.fieldName, blob, params.filename);

      const resp = await fetch(`https://api.telegram.org/bot${token}/${params.method}`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(45000),
      });
      const json = (await resp.json().catch(() => null)) as any;
      return { ok: Boolean(json?.ok), description: json?.description };
    } catch (err: any) {
      return { ok: false, description: err?.message || 'خطا در ارسال فایل به تلگرام' };
    }
  }

  private async resolveProductPhotoForBot(p: StoreProduct): Promise<
    | { kind: 'url'; url: string }
    | { kind: 'buffer'; buffer: Buffer; mimeType: string; filename: string }
    | null
  > {
    const imgUrl = String(p.imageUrl || '').trim();

    // 1. Stored media file in Telegram Cloud DB (/api/telegram/db/media/<fileId>)
    if (imgUrl.startsWith('/api/telegram/db/media/') && this.deps.getMediaBufferByFileId) {
      const fileId = decodeURIComponent(imgUrl.slice('/api/telegram/db/media/'.length)).trim();
      if (fileId) {
        const fetched = await this.deps.getMediaBufferByFileId(fileId).catch(() => null);
        if (fetched && fetched.buffer.length > 0) {
          return {
            kind: 'buffer',
            buffer: fetched.buffer,
            mimeType: fetched.mimeType || 'image/jpeg',
            filename: fetched.filename || `${p.id}.jpg`,
          };
        }
      }
    }

    // 2. Embedded Data URL image uploaded from Admin Panel
    const dataMatch = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/is.exec(imgUrl);
    if (dataMatch) {
      const mimeType = dataMatch[1].toLowerCase();
      const buffer = Buffer.from(dataMatch[2].replace(/\s+/g, ''), 'base64');
      if (buffer.length > 0) {
        const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
        return { kind: 'buffer', buffer, mimeType, filename: `${p.id}.${ext}` };
      }
    }

    // 3. External HTTPS URL
    if (/^https:\/\//i.test(imgUrl)) {
      return { kind: 'url', url: imgUrl };
    }

    // 4. Local bundled high-res default product photograph on disk
    const fallbackFile =
      DEFAULT_PRODUCT_IMAGE_BY_ID[p.id] ||
      DEFAULT_PRODUCT_IMAGE_BY_CATEGORY[p.category] ||
      'vermicompost_grade_a_1794572561601.jpg';
    try {
      const fullPath = path.join(PRODUCT_IMAGES_DIR, fallbackFile);
      if (fs.existsSync(fullPath)) {
        const buffer = fs.readFileSync(fullPath);
        if (buffer.length > 0) {
          return { kind: 'buffer', buffer, mimeType: 'image/jpeg', filename: fallbackFile };
        }
      }
    } catch {
      // ignore local image read errors
    }
    return null;
  }

  private async safeDeleteMessage(chatId: number, messageId?: number): Promise<void> {
    if (!messageId) return;
    try {
      await this.tgCall('deleteMessage', { chat_id: chatId, message_id: messageId });
    } catch {
      // ignore delete rejection for old messages
    }
  }

  private async editOrSendMessage(
    chatId: number,
    messageId: number | undefined,
    htmlText: string,
    replyMarkup?: unknown
  ): Promise<void> {
    if (messageId) {
      const editRes = await this.tgCall('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      });
      if (editRes.ok) return;
      // If navigating away from a photo/audio message, deleteMessage + sendMessage keeps thread clean
      await this.safeDeleteMessage(chatId, messageId);
    }
    await this.sendMessage(chatId, htmlText, replyMarkup);
  }

  public async sendTestAdminMessage(): Promise<{ ok: boolean; message: string }> {
    if (!this.config.botToken) {
      return { ok: false, message: 'ابتدا توکن ربات تلگرام را متصل کنید.' };
    }
    const adminId = this.config.adminChatId.trim();
    if (!adminId) {
      return { ok: false, message: 'شناسه عددی تلگرام مدیر (Admin Chat ID) وارد نشده است.' };
    }
    const sent = await this.sendMessage(
      adminId,
      `✅ <b>تست اتصال ربات فروشگاه با موفقیت انجام شد</b>\n\n` +
        `🏢 مجموعه: <b>${escapeHtml(this.getWorkshopName())}</b>\n` +
        `🤖 ربات: @${escapeHtml(this.config.botUsername || '')}\n` +
        `📦 سفارش‌های جدید مشتریان و پیام‌های پیگیری از این پس فوراً به این چت ارسال می‌شوند.`
    );
    return sent
      ? { ok: true, message: 'پیام تست با موفقیت به تلگرام مدیر ارسال شد ✓' }
      : { ok: false, message: 'ارسال پیام تست ناموفق بود. مطمئن شوید مدیر قبلاً داخل ربات /start را زده باشد و Chat ID صحیح باشد.' };
  }

  public async notifyNewOrder(order: CustomerOrder, telegramUserId?: number): Promise<void> {
    this.upsertOrderInSnapshot(order);
    if (!this.config.botToken) return;

    const itemsSummary = (order.items || [])
      .slice(0, 8)
      .map(
        (it, idx) =>
          `${idx + 1}. ${escapeHtml(it.product?.name || 'محصول')} — ${escapeHtml(it.selectedPackage?.weightOrVolume || '')} × <b>${it.quantity}</b> (${formatToman(it.totalPrice)})`
      )
      .join('\n');

    const adminId = this.config.adminChatId.trim();
    if (adminId) {
      const openOrdersBtn = this.webAppButton('📦 مشاهده در وب‌اپ فروشگاه', 'orders');
      const adminText =
        `🛒 <b>سفارش جدید ثبت شد!</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🔖 کد سفارش: <code>${escapeHtml(order.orderNumber)}</code>\n` +
        `👤 نام خریدار: <b>${escapeHtml(order.customerName)}</b>\n` +
        `📱 تماس: <code>${escapeHtml(order.phoneNumber)}</code>\n` +
        `📍 مقصد: ${escapeHtml(order.province)} / ${escapeHtml(order.city)}\n` +
        `📬 نشانی: ${escapeHtml(order.deliveryAddress)}\n` +
        `🚚 روش ارسال: ${escapeHtml(formatDeliveryMethodFa(order.deliveryMethod))}\n\n` +
        `📋 <b>اقلام سفارش:</b>\n${itemsSummary || '-'}\n\n` +
        `⚖️ وزن کل: <b>${Math.round(order.totalWeightKg || 0).toLocaleString('fa-IR')} کیلوگرم</b>\n` +
        `🚚 هزینه حمل و باربری (قیمت تخمینی): <b>${formatToman(order.shippingEstimateToman || 0)}</b>\n` +
        `💳 جمع نهایی سفارش: <b>${formatToman(order.finalPayableToman || 0)}</b>\n` +
        (order.orderNotes ? `📝 یادداشت خریدار: ${escapeHtml(order.orderNotes)}\n` : '');

      await this.sendMessage(
        adminId,
        adminText,
        openOrdersBtn ? { inline_keyboard: [[openOrdersBtn]] } : undefined
      );
    }

    if (telegramUserId) {
      const openOrdersBtn = this.webAppButton('📄 مشاهده رسید و پیش‌فاکتور در وب‌اپ', 'orders');
      const customerMsg =
        `✅ <b>سفارش شما با موفقیت ثبت شد!</b>\n\n` +
        `🔖 کد پیگیری سفارش: <code>${escapeHtml(order.orderNumber)}</code>\n` +
        `📦 اقلام: ${order.items?.length || 0} قلم · وزن کل ${Math.round(order.totalWeightKg || 0).toLocaleString('fa-IR')} کیلوگرم\n` +
        `🚚 هزینه حمل و باربری (قیمت تخمینی): ${formatToman(order.shippingEstimateToman || 0)}\n` +
        `💳 مبلغ کل: <b>${formatToman(order.finalPayableToman || 0)}</b>\n\n` +
        `همکاران ما در ${escapeHtml(this.getWorkshopName())} سفارش شما را بررسی و هماهنگی ارسال را انجام می‌دهند.`;
      await this.sendMessage(
        telegramUserId,
        customerMsg,
        openOrdersBtn ? { inline_keyboard: [[openOrdersBtn]] } : undefined
      );
    }
  }

  public async handleUpdate(update: any): Promise<void> {
    if (!update || typeof update !== 'object') return;
    this.lastUpdateAt = new Date().toISOString();

    try {
      if (update.callback_query) {
        const cq = update.callback_query;
        const chatId = cq.message?.chat?.id;
        const messageId = cq.message?.message_id;
        const data = String(cq.data || '');
        if (cq.id) {
          void this.tgCall('answerCallbackQuery', { callback_query_id: cq.id });
        }
        if (chatId) {
          this.knownChatIds.add(chatId);
          await this.handleCallback(chatId, messageId, data);
        }
        return;
      }

      if (update.message) {
        const msg = update.message;
        const chatId: number | undefined = msg.chat?.id;
        if (!chatId) return;
        this.knownChatIds.add(chatId);
        const firstName = String(msg.from?.first_name || 'همراه گرامی');
        const fullName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ').trim();

        if (msg.contact && msg.contact.phone_number) {
          const contactOwnerId = msg.contact.user_id || msg.from?.id || chatId;
          if (!msg.from?.id || Number(contactOwnerId) === Number(msg.from.id)) {
            const savedPhone = this.setVerifiedUserPhone(contactOwnerId, msg.contact.phone_number, {
              fullName: fullName || undefined,
              username: msg.from?.username,
            });
            if (savedPhone) {
              await this.syncUserChatMenuButton(chatId);
              const sess = this.getSession(chatId);
              if (sess.awaiting === 'checkout_phone') {
                sess.checkoutDraft = { ...(sess.checkoutDraft || {}), phoneNumber: savedPhone };
                sess.awaiting = 'checkout_city';
                await this.sendMessage(
                  chatId,
                  `✅ شماره همراه <code>${escapeHtml(savedPhone)}</code> برای سفارش ثبت شد.`,
                  { remove_keyboard: true }
                );
                await this.promptCheckoutCity(chatId);
                return;
              }
              await this.sendMessage(
                chatId,
                `✅ شماره موبایل <code>${escapeHtml(savedPhone)}</code> با موفقیت شناسایی و به حساب فروشگاه شما متصل شد.\n\n` +
                  `از این پس هنگام خرید داخل ربات یا باز کردن «فروشگاه»، شماره شما به‌صورت پیش‌فرض تکمیل می‌شود.`,
                { remove_keyboard: true }
              );
              await this.sendWelcome(chatId, firstName);
              return;
            }
          }
        }

        const text = String(msg.text || '').trim();
        const caption = String(msg.caption || '').trim();
        const username = msg.from?.username ? String(msg.from.username) : undefined;

        if (Array.isArray(msg.photo) && msg.photo.length > 0) {
          const bestPhoto = msg.photo[msg.photo.length - 1];
          if (bestPhoto?.file_id) {
            await this.handlePaymentReceiptSubmission({
              chatId,
              firstName,
              fullName,
              username,
              kind: 'photo',
              fileId: String(bestPhoto.file_id),
              captionOrText: caption,
            });
            return;
          }
        }

        if (msg.document?.file_id) {
          await this.handlePaymentReceiptSubmission({
            chatId,
            firstName,
            fullName,
            username,
            kind: 'document',
            fileId: String(msg.document.file_id),
            fileName: msg.document.file_name ? String(msg.document.file_name) : undefined,
            captionOrText: caption,
          });
          return;
        }

        await this.handleTextMessage(chatId, text, firstName, { fullName, username });
      }
    } catch (err: any) {
      this.lastError = err?.message || 'خطا در پردازش پیام ربات';
    }
  }

  private getSession(chatId: number): ChatSessionState {
    let s = this.chatSessions.get(chatId);
    if (!s) {
      s = {};
      this.chatSessions.set(chatId, s);
    }
    return s;
  }

  private async handleTextMessage(
    chatId: number,
    text: string,
    firstName: string,
    senderMeta?: { fullName?: string; username?: string }
  ): Promise<void> {
    const session = this.getSession(chatId);

    if (text.startsWith('/start') || text.startsWith('/menu')) {
      session.awaiting = null;
      await this.sendWelcome(chatId, firstName);
      return;
    }

    if (text === '/myid') {
      session.awaiting = null;
      await this.sendMessage(
        chatId,
        `🆔 <b>شناسه عددی تلگرام شما (Chat ID):</b>\n\n<code>${chatId}</code>\n\n` +
          `مدیر گرامی می‌توانید این عدد را در پنل مدیریت ← تب <b>ربات تلگرام و مینی‌اپ</b> وارد کنید تا تمام سفارش‌های جدید مستقیماً به تلگرام شما ارسال شوند.`
      );
      return;
    }

    if (text === '/shop') {
      session.awaiting = null;
      await this.showCatalogMenu(chatId);
      return;
    }

    if (text === '/cart') {
      session.awaiting = null;
      await this.showBotCart(chatId);
      return;
    }

    if (text.startsWith('/search')) {
      const q = text.replace(/^\/search\s*/i, '').trim();
      if (q) {
        session.awaiting = null;
        await this.showProductSearchResults(chatId, q);
      } else {
        session.awaiting = 'product_search';
        await this.showSearchPrompt(chatId);
      }
      return;
    }

    if (text === '/payment') {
      await this.showPaymentInfo(chatId);
      return;
    }

    if (text === '/calculator') {
      session.awaiting = null;
      await this.showCalculatorMenu(chatId);
      return;
    }

    if (text === '/tips') {
      session.awaiting = null;
      await this.showTipsCategories(chatId);
      return;
    }

    if (text.startsWith('/weather')) {
      session.awaiting = null;
      const cityArg = text.replace(/^\/weather\s*/i, '').trim();
      if (cityArg) {
        await this.sendWeatherForCity(chatId, cityArg);
      } else {
        await this.showWeatherMenu(chatId);
      }
      return;
    }

    if (text === '/orders') {
      session.awaiting = 'order_search';
      await this.showOrdersPrompt(chatId);
      return;
    }

    if (text === '/consultant') {
      session.awaiting = 'consultant';
      await this.showConsultantPrompt(chatId);
      return;
    }

    if (text === '/contact') {
      session.awaiting = null;
      await this.showContactInfo(chatId);
      return;
    }

    if (text === '/phone') {
      session.awaiting = null;
      await this.sendPhoneRequestKeyboard(chatId);
      return;
    }

    if (text === 'بازگشت به منوی اصلی 🔙' || text === 'انصراف از ثبت سفارش ❌') {
      session.awaiting = null;
      await this.sendMessage(chatId, 'به منوی اصلی بازگشتید ✓', { remove_keyboard: true });
      await this.sendWelcome(chatId, firstName);
      return;
    }

    // Conversational inputs based on user context
    if (session.awaiting === 'checkout_name' && text) {
      session.checkoutDraft = { ...(session.checkoutDraft || {}), fullName: text };
      await this.promptCheckoutPhone(chatId);
      return;
    }

    if (session.awaiting === 'checkout_phone' && text) {
      const normalizedPhone = normalizeIranPhoneNumber(text);
      if (normalizedPhone.length < 10) {
        await this.sendMessage(
          chatId,
          '⚠️ شماره همراه واردشده معتبر نیست. لطفاً شماره ۱۱ رقمی صحیح (مثل <code>09123456789</code>) یا دکمه «ارسال شماره من» را انتخاب کنید.'
        );
        return;
      }
      this.setVerifiedUserPhone(chatId, normalizedPhone, {
        fullName: session.checkoutDraft?.fullName || senderMeta?.fullName,
        username: senderMeta?.username,
      });
      session.checkoutDraft = { ...(session.checkoutDraft || {}), phoneNumber: normalizedPhone };
      await this.sendMessage(chatId, `✓ شماره <code>${escapeHtml(normalizedPhone)}</code> ثبت شد.`, { remove_keyboard: true });
      await this.promptCheckoutCity(chatId);
      return;
    }

    if (session.awaiting === 'checkout_city' && text) {
      const parts = text.split(/[-–/،,]/).map((s) => s.trim()).filter(Boolean);
      const province = parts.length >= 2 ? parts[0] : parts[0];
      const city = parts.length >= 2 ? parts.slice(1).join(' ') : parts[0];
      session.checkoutDraft = { ...(session.checkoutDraft || {}), province, city };
      await this.promptCheckoutAddress(chatId);
      return;
    }

    if (session.awaiting === 'checkout_address' && text) {
      session.checkoutDraft = { ...(session.checkoutDraft || {}), deliveryAddress: text };
      await this.promptCheckoutDeliveryMethod(chatId);
      return;
    }

    if (session.awaiting === 'checkout_notes' && text) {
      const cleanNote = text === 'ندارم' || text === '-' ? '' : text;
      session.checkoutDraft = { ...(session.checkoutDraft || {}), orderNotes: cleanNote };
      session.awaiting = null;
      await this.showCheckoutConfirmSummary(chatId);
      return;
    }

    if (session.awaiting === 'product_search' && text) {
      session.awaiting = null;
      await this.showProductSearchResults(chatId, text);
      return;
    }

    if (session.awaiting === 'payment_receipt' && text) {
      await this.handlePaymentReceiptSubmission({
        chatId,
        firstName,
        fullName: senderMeta?.fullName,
        username: senderMeta?.username,
        kind: 'text',
        captionOrText: text,
      });
      return;
    }

    if (session.awaiting === 'weather_city' && text) {
      session.awaiting = null;
      await this.sendWeatherForCity(chatId, text);
      return;
    }

    if (session.awaiting === 'order_search' && text) {
      await this.lookupOrdersByQuery(chatId, text);
      return;
    }

    if (session.awaiting === 'consultant' && text) {
      await this.replyWithConsultant(chatId, text);
      return;
    }

    // Smart auto-detection for free text even without command
    if (/^ORD-/i.test(text) || /^09\d{9}$/.test(text.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)))) {
      await this.lookupOrdersByQuery(chatId, text);
      return;
    }

    if (text.length >= 4) {
      await this.replyWithConsultant(chatId, text);
      return;
    }

    await this.sendWelcome(chatId, firstName);
  }

  private async handleCallback(chatId: number, messageId: number | undefined, data: string): Promise<void> {
    const session = this.getSession(chatId);

    if (data === 'cb:home') {
      session.awaiting = null;
      await this.editOrSendMessage(chatId, messageId, this.buildWelcomeText('همراه گرامی'), this.buildMainMenuKeyboard(chatId));
      return;
    }

    if (data === 'cb:shop') {
      session.awaiting = null;
      await this.showCatalogMenu(chatId, messageId, 'all');
      return;
    }

    if (data.startsWith('cb:shop_cat:')) {
      session.awaiting = null;
      const cat = data.slice('cb:shop_cat:'.length);
      await this.showCatalogMenu(chatId, messageId, cat);
      return;
    }

    if (data === 'cb:search') {
      session.awaiting = 'product_search';
      await this.showSearchPrompt(chatId, messageId);
      return;
    }

    if (data.startsWith('cb:prod:')) {
      const prodId = data.slice('cb:prod:'.length);
      await this.showProductDetail(chatId, messageId, prodId);
      return;
    }

    if (data.startsWith('cb:prod_voice:')) {
      const prodId = data.slice('cb:prod_voice:'.length);
      await this.handleProductVoiceIntro(chatId, prodId);
      return;
    }

    if (data.startsWith('cb:cart_add:')) {
      const rest = data.slice('cb:cart_add:'.length);
      const lastColon = rest.lastIndexOf(':');
      if (lastColon > 0) {
        const prodId = rest.slice(0, lastColon);
        const pkgIdx = Number(rest.slice(lastColon + 1));
        await this.handleAddCartCallback(chatId, prodId, pkgIdx);
      }
      return;
    }

    if (data === 'cb:bot_cart') {
      session.awaiting = null;
      await this.showBotCart(chatId, messageId);
      return;
    }

    if (data.startsWith('cb:cart_inc:')) {
      const idx = Number(data.slice('cb:cart_inc:'.length));
      this.updateChatCartIndexQty(chatId, idx, 1);
      await this.showBotCart(chatId, messageId);
      return;
    }

    if (data.startsWith('cb:cart_dec:')) {
      const idx = Number(data.slice('cb:cart_dec:'.length));
      this.updateChatCartIndexQty(chatId, idx, -1);
      await this.showBotCart(chatId, messageId);
      return;
    }

    if (data.startsWith('cb:cart_del:')) {
      const idx = Number(data.slice('cb:cart_del:'.length));
      this.updateChatCartIndexQty(chatId, idx, -99999);
      await this.showBotCart(chatId, messageId);
      return;
    }

    if (data === 'cb:cart_clear') {
      this.clearChatCart(chatId);
      await this.showBotCart(chatId, messageId);
      return;
    }

    if (data === 'cb:checkout_start') {
      await this.startBotCheckout(chatId, messageId);
      return;
    }

    if (data.startsWith('cb:chk_use_name:')) {
      const nm = decodeURIComponent(data.slice('cb:chk_use_name:'.length)).trim();
      if (nm) {
        session.checkoutDraft = { ...(session.checkoutDraft || {}), fullName: nm };
        await this.promptCheckoutPhone(chatId, messageId);
      }
      return;
    }

    if (data === 'cb:chk_use_saved_phone') {
      const saved = this.userPhones[String(chatId)]?.phoneNumber;
      if (saved) {
        session.checkoutDraft = { ...(session.checkoutDraft || {}), phoneNumber: saved };
        await this.promptCheckoutCity(chatId, messageId);
      } else {
        await this.promptCheckoutPhone(chatId, messageId);
      }
      return;
    }

    if (data.startsWith('cb:chk_city:')) {
      const rawCity = data.slice('cb:chk_city:'.length);
      const [prov, city] = rawCity.split('|');
      session.checkoutDraft = {
        ...(session.checkoutDraft || {}),
        province: prov || rawCity,
        city: city || prov || rawCity,
      };
      await this.promptCheckoutAddress(chatId, messageId);
      return;
    }

    if (data.startsWith('cb:chk_deliv:')) {
      const method = data.slice('cb:chk_deliv:'.length) as CustomerOrder['deliveryMethod'];
      session.checkoutDraft = { ...(session.checkoutDraft || {}), deliveryMethod: method };
      await this.promptCheckoutNotes(chatId, messageId);
      return;
    }

    if (data === 'cb:chk_skip_notes') {
      session.checkoutDraft = { ...(session.checkoutDraft || {}), orderNotes: '' };
      session.awaiting = null;
      await this.showCheckoutConfirmSummary(chatId, messageId);
      return;
    }

    if (data === 'cb:chk_confirm') {
      await this.finalizeBotOrder(chatId, messageId);
      return;
    }

    if (data === 'cb:calc') {
      session.awaiting = null;
      await this.showCalculatorMenu(chatId, messageId);
      return;
    }

    if (data.startsWith('cb:calc_cat:')) {
      const cat = data.slice('cb:calc_cat:'.length);
      await this.showCalculatorPlantsByCategory(chatId, messageId, cat);
      return;
    }

    if (data.startsWith('cb:calc_plant:')) {
      const plantId = data.slice('cb:calc_plant:'.length);
      await this.showCalculatorPlantDose(chatId, messageId, plantId);
      return;
    }

    if (data.startsWith('cb:calc_qty:')) {
      const parts = data.slice('cb:calc_qty:'.length).split(':');
      const plantId = parts[0];
      const unitsCount = Math.max(1, Number(parts[1]) || 10);
      await this.showCalculatorPlantDose(chatId, messageId, plantId, unitsCount);
      return;
    }

    if (data.startsWith('cb:calc_cart:')) {
      const parts = data.slice('cb:calc_cart:'.length).split(':');
      const plantId = parts[0];
      const unitsCount = Math.max(1, Number(parts[1]) || 10);
      await this.addCalculatedPlantPackToBotCart(chatId, plantId, unitsCount);
      return;
    }

    if (data === 'cb:tips') {
      session.awaiting = null;
      await this.showTipsCategories(chatId, messageId);
      return;
    }

    if (data.startsWith('cb:tip_cat:')) {
      const cat = data.slice('cb:tip_cat:'.length);
      await this.showTipsList(chatId, messageId, cat);
      return;
    }

    if (data.startsWith('cb:tip:')) {
      const tipId = data.slice('cb:tip:'.length);
      await this.showTipDetail(chatId, messageId, tipId);
      return;
    }

    if (data === 'cb:weather') {
      session.awaiting = 'weather_city';
      await this.showWeatherMenu(chatId, messageId);
      return;
    }

    if (data.startsWith('cb:weather_city:')) {
      session.awaiting = null;
      const city = data.slice('cb:weather_city:'.length);
      await this.sendWeatherForCity(chatId, city, messageId);
      return;
    }

    if (data === 'cb:orders') {
      session.awaiting = 'order_search';
      await this.showOrdersPrompt(chatId, messageId);
      return;
    }

    if (data === 'cb:orders_my_phone') {
      const savedPhone = this.userPhones[String(chatId)]?.phoneNumber;
      if (savedPhone) {
        await this.lookupOrdersByQuery(chatId, savedPhone);
      } else {
        await this.showOrdersPrompt(chatId, messageId);
      }
      return;
    }

    if (data === 'cb:consultant') {
      session.awaiting = 'consultant';
      await this.showConsultantPrompt(chatId, messageId);
      return;
    }

    if (data.startsWith('cb:faq:')) {
      const faqId = data.slice('cb:faq:'.length);
      const item = CONSULTANT_FAQ_ITEMS.find((f) => f.id === faqId);
      if (item) {
        const backMarkup = {
          inline_keyboard: [
            ...(this.webAppButton('💬 گفتگوی کامل در وب‌اپ', 'tips')
              ? [[this.webAppButton('💬 گفتگوی کامل در وب‌اپ', 'tips')!]]
              : []),
            [{ text: '🔙 بازگشت به سوالات پرتکرار', callback_data: 'cb:consultant' }],
          ],
        };
        await this.editOrSendMessage(
          chatId,
          messageId,
          `❓ <b>${escapeHtml(item.question)}</b>\n\n` +
            `🌿 <b>پاسخ تخصصی مهندس صفری:</b>\n${escapeHtml(item.advisorAnswer)}\n\n` +
            `📊 <b>مقدار مصرف:</b> ${escapeHtml(item.dosageHighlight)}\n` +
            `⚠️ <b>نکته احتیاطی:</b> ${escapeHtml(item.cautionNote)}\n` +
            `🛒 <b>محصول پیشنهادی:</b> ${escapeHtml(item.recommendedProductName)}`,
          backMarkup
        );
      }
      return;
    }

    if (data === 'cb:payment') {
      await this.showPaymentInfo(chatId, messageId);
      return;
    }

    if (data === 'cb:send_receipt') {
      session.awaiting = 'payment_receipt';
      await this.sendMessage(
        chatId,
        `📤 <b>ارسال رسید واریز وجه</b>\n\n` +
          `لطفاً هم‌اکنون <b>عکس فیش واریزی</b>، <b>فایل PDF رسید</b> یا <b>شماره پیگیری / متن تراکنش بانکی</b> را همینجا در چت ارسال کنید تا مستقیماً به مدیریت تحویل داده شود:`,
        { inline_keyboard: [[{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]] }
      );
      return;
    }

    if (data === 'cb:contact') {
      session.awaiting = null;
      await this.showContactInfo(chatId, messageId);
      return;
    }

    if (data === 'cb:ask_phone') {
      session.awaiting = null;
      await this.sendPhoneRequestKeyboard(chatId);
      return;
    }
  }

  private buildWelcomeText(firstName: string): string {
    const s = this.snapshot.settings;
    const workshop = this.getWorkshopName();
    const tagline = s.appTagline || 'فروشگاه آنلاین و سامانه تخصصی تغذیه زیست‌فناوری';
    const address = s.workshopAddress ? `\n📍 ${escapeHtml(s.workshopAddress)}` : '';
    const phone = s.supportPhone ? `\n📞 پشتیبانی: <code>${escapeHtml(s.supportPhone)}</code>` : '';
    const webNotice = isHttpsUrl(this.getEffectiveWebAppUrl())
      ? '\n✨ <b>برای خرید مستقیم و دسترسی کامل به سبد خرید، فاکتور قابل چاپ و پخش صوتی محصولات، دکمه زیر را لمس کنید:</b>'
      : '\n📌 از منوی زیر تمام محصولات، قیمت‌ها، محاسبه دوز، هواشناسی و نکات طلایی را مشاهده کنید:';

    return (
      `سلام <b>${escapeHtml(firstName)}</b> عزیز 🌱\n` +
      `به ربات فروشگاه <b>${escapeHtml(workshop)}</b> خوش آمدید!\n` +
      `<i>${escapeHtml(tagline)}</i>` +
      `${address}${phone}\n` +
      `${webNotice}`
    );
  }

  private async sendWelcome(chatId: number, firstName: string): Promise<void> {
    if (this.userPhones[String(chatId)]) {
      void this.syncUserChatMenuButton(chatId);
    }
    await this.sendMessage(chatId, this.buildWelcomeText(firstName), this.buildMainMenuKeyboard(chatId));
  }

  private async sendPhoneRequestKeyboard(chatId: number): Promise<void> {
    await this.sendMessage(
      chatId,
      `📱 <b>اتصال سریع شماره موبایل تلگرام به فروشگاه</b>\n\n` +
        `برای اینکه هنگام ورود و ثبت‌نام در وب‌اپ شماره موبایل شما به‌صورت پیش‌فرض و خودکار تکمیل شود، دکمه پایین صفحه را لمس کنید:`,
      {
        keyboard: [
          [{ text: '📱 ارسال و تایید شماره موبایل من', request_contact: true }],
          [{ text: 'بازگشت به منوی اصلی 🔙' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      }
    );
  }

  private async showCatalogMenu(chatId: number, messageId?: number, categoryFilter = 'all'): Promise<void> {
    const allProducts = mergeCatalogProducts(this.snapshot);
    const categories = [
      { id: 'all', label: 'همه' },
      { id: 'vermicompost', label: 'ورمیکمپوست' },
      { id: 'compost', label: 'کمپوست' },
      { id: 'liquid', label: 'ورمی‌تی مایع' },
      { id: 'mineral', label: 'زئولیت و معدنی' },
      { id: 'substrate', label: 'بستر کشت' },
      { id: 'starter', label: 'کرم زنده' },
    ].filter((c) => c.id === 'all' || allProducts.some((p) => p.category === c.id));

    const products =
      categoryFilter === 'all'
        ? allProducts
        : allProducts.filter((p) => p.category === categoryFilter);

    const lines = products.slice(0, 12).map((p, idx) => {
      const minPkg = [...(p.packagingOptions || [])]
        .filter((o) => !o.isOutOfStock)
        .sort((a, b) => a.priceToman - b.priceToman)[0];
      const stockBadge = p.inStock ? '✅ موجود' : '⏳ ناموجود';
      const priceStr = minPkg ? `از <b>${formatToman(minPkg.priceToman)}</b> (${escapeHtml(minPkg.weightOrVolume)})` : '';
      return `${idx + 1}. <b>${escapeHtml(p.name)}</b>\n   ${stockBadge}${priceStr ? ` · ${priceStr}` : ''}`;
    });

    const buttons: any[][] = [];
    // Category filter rows (3 per row)
    for (let i = 0; i < categories.length; i += 3) {
      buttons.push(
        categories.slice(i, i + 3).map((c) => ({
          text: `${categoryFilter === c.id ? '● ' : ''}${c.label}`,
          callback_data: c.id === 'all' ? 'cb:shop' : `cb:shop_cat:${c.id}`,
        }))
      );
    }

    for (const p of products.slice(0, 12)) {
      const drawerBtn = this.webAppButton(
        `${p.inStock ? '🟢' : '🔴'} ${p.name.slice(0, 26)} · کشوی خرید`,
        'catalog',
        { product: p.id, quickbuy: '1' },
        chatId
      );
      if (drawerBtn) {
        buttons.push([
          drawerBtn,
          {
            text: '📸 عکس و صوت در چت',
            callback_data: `cb:prod:${p.id}`,
          },
        ]);
      } else {
        buttons.push([
          {
            text: `${p.inStock ? '🟢' : '🔴'} ${p.name.slice(0, 38)} · عکس و خرید`,
            callback_data: `cb:prod:${p.id}`,
          },
        ]);
      }
    }

    const cartCount = this.getChatCartItemCount(chatId);
    buttons.push([
      { text: '🔍 جستجوی محصول', callback_data: 'cb:search' },
      { text: cartCount > 0 ? `🧺 سبد خرید (${cartCount})` : '🧺 سبد خرید', callback_data: 'cb:bot_cart' },
    ]);
    const webShopBtn = this.webAppButton('🌐 باز کردن فروشگاه در وب‌اپ', 'catalog', undefined, chatId);
    if (webShopBtn) buttons.push([webShopBtn]);
    buttons.push([{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]);

    await this.editOrSendMessage(
      chatId,
      messageId,
      `🛍 <b>کاتالوگ محصولات و قیمت روز (${products.length} محصول)</b>\n\n` +
        `${lines.length > 0 ? lines.join('\n\n') : 'محصولی در این دسته یافت نشد.'}\n\n` +
        `👇 روی هر محصول بزنید تا <b>تصویر محصول</b>، <b>معرفی صوتی</b>، <b>بسته‌بندی‌ها</b> و <b>افزودن به سبد خرید</b> نمایش داده شود:`,
      { inline_keyboard: buttons }
    );
  }

  private async showSearchPrompt(chatId: number, messageId?: number): Promise<void> {
    await this.editOrSendMessage(
      chatId,
      messageId,
      `🔍 <b>جستجوی سریع در محصولات کارگاه</b>\n\n` +
        `نام محصول یا نیاز خود را همینجا بنویسید و ارسال کنید\n(مثال: <code>ورمیکمپوست</code>، <code>زئولیت</code>، <code>قهوه</code>، <code>ورمی‌تی</code>):`,
      {
        inline_keyboard: [
          [{ text: '🛍 مشاهده همه محصولات', callback_data: 'cb:shop' }],
          [{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }],
        ],
      }
    );
  }

  private async showProductSearchResults(chatId: number, query: string): Promise<void> {
    const q = query.trim().toLowerCase();
    const products = mergeCatalogProducts(this.snapshot).filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.categoryLabel.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );

    if (products.length === 0) {
      await this.sendMessage(
        chatId,
        `🔍 محصولی با عبارت «<b>${escapeHtml(query)}</b>» یافت نشد.\nمی‌توانید عبارت دیگری جستجو کنید یا فهرست کامل محصولات را ببینید:`,
        {
          inline_keyboard: [
            [{ text: '🛍 همه محصولات', callback_data: 'cb:shop' }],
            [{ text: '🔍 جستجوی مجدد', callback_data: 'cb:search' }],
            [{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }],
          ],
        }
      );
      return;
    }

    const buttons: any[][] = products.slice(0, 10).map((p) => {
      const drawerBtn = this.webAppButton(
        `${p.inStock ? '🟢' : '🔴'} ${p.name.slice(0, 26)} · کشوی خرید`,
        'catalog',
        { product: p.id, quickbuy: '1' },
        chatId
      );
      if (drawerBtn) {
        return [drawerBtn, { text: '📸 عکس و صوت', callback_data: `cb:prod:${p.id}` }];
      }
      return [{ text: `${p.inStock ? '🟢' : '🔴'} ${p.name.slice(0, 40)}`, callback_data: `cb:prod:${p.id}` }];
    });
    buttons.push([
      { text: '🛍 همه محصولات', callback_data: 'cb:shop' },
      { text: '🏠 منوی اصلی', callback_data: 'cb:home' },
    ]);

    await this.sendMessage(
      chatId,
      `🔍 <b>نتیجه جستجو برای «${escapeHtml(query)}» (${products.length} مورد):</b>`,
      { inline_keyboard: buttons }
    );
  }

  private async showProductDetail(chatId: number, messageId: number | undefined, prodId: string): Promise<void> {
    const products = mergeCatalogProducts(this.snapshot);
    const p = products.find((item) => item.id === prodId);
    if (!p) {
      await this.showCatalogMenu(chatId, messageId);
      return;
    }

    const pkgs = p.packagingOptions || [];
    const pkgLines = pkgs.map((pkg) => {
      const disc = pkg.discountPercent && pkg.discountPercent > 0 ? ` (${pkg.discountPercent}٪ تخفیف)` : '';
      const stock = pkg.isOutOfStock ? ' ❌ ناموجود' : '';
      return `• <b>${escapeHtml(pkg.title || pkg.weightOrVolume)}</b>: ${formatToman(pkg.priceToman)}${disc}${stock}`;
    });

    const specLines = (p.specs || []).slice(0, 4).map((sp) => `▫️ ${escapeHtml(sp.label)}: <b>${escapeHtml(sp.value)}</b>`);
    const descPreview = String(p.description || p.tagline || '').slice(0, 220);
    const fullText =
      `📦 <b>${escapeHtml(p.name)}</b>\n` +
      `🏷 ${escapeHtml(p.categoryLabel)} · ${p.inStock ? '✅ موجود در انبار' : '⏳ ناموجود'} · 🚚 ${escapeHtml(p.deliveryTimeDays)}\n\n` +
      `📝 ${escapeHtml(descPreview)}\n\n` +
      (specLines.length > 0 ? `🔬 <b>مشخصات فنی:</b>\n${specLines.join('\n')}\n\n` : '') +
      `💰 <b>بسته‌بندی‌ها و قیمت مستقیم کارگاه:</b>\n${pkgLines.join('\n') || 'تماس با پشتیبانی'}`;

    const rows: any[][] = [];
    const prodDrawerBtn = this.webAppButton(
      '🛍 نمایش کشویی + صوت + خرید سریع (درون تلگرام)',
      'catalog',
      { product: p.id, quickbuy: '1' },
      chatId
    );
    if (prodDrawerBtn) {
      rows.push([prodDrawerBtn]);
    }
    if (p.inStock) {
      pkgs.forEach((pkg, idx) => {
        if (!pkg.isOutOfStock) {
          rows.push([
            {
              text: `🛒 افزودن ${pkg.title || pkg.weightOrVolume} (${formatToman(pkg.priceToman)})`,
              callback_data: `cb:cart_add:${p.id}:${idx}`,
            },
          ]);
        }
      });
    }
    rows.push([{ text: '🔊 شنیدن معرفی صوتی محصول', callback_data: `cb:prod_voice:${p.id}` }]);
    const cartCount = this.getChatCartItemCount(chatId);
    rows.push([
      {
        text: cartCount > 0 ? `🧺 مشاهده سبد خرید (${cartCount})` : '🧺 سبد خرید من',
        callback_data: 'cb:bot_cart',
      },
      { text: '🔙 لیست محصولات', callback_data: 'cb:shop' },
    ]);
    rows.push([{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]);

    const markup = { inline_keyboard: rows };
    const photoMedia = await this.resolveProductPhotoForBot(p);

    if (photoMedia) {
      await this.safeDeleteMessage(chatId, messageId);
      const caption = fullText.slice(0, 990);
      if (photoMedia.kind === 'buffer') {
        const upRes = await this.tgUploadMultipart({
          method: 'sendPhoto',
          fieldName: 'photo',
          chatId,
          buffer: photoMedia.buffer,
          mimeType: photoMedia.mimeType,
          filename: photoMedia.filename,
          caption,
          replyMarkup: markup,
        });
        if (upRes.ok) return;
      } else {
        const photoRes = await this.tgCall('sendPhoto', {
          chat_id: chatId,
          photo: photoMedia.url,
          caption,
          parse_mode: 'HTML',
          reply_markup: markup,
        });
        if (photoRes.ok) return;
      }
    }

    await this.editOrSendMessage(chatId, messageId, fullText, markup);
  }

  private async handleProductVoiceIntro(chatId: number, prodId: string): Promise<void> {
    const products = mergeCatalogProducts(this.snapshot);
    const p = products.find((item) => item.id === prodId);
    if (!p) {
      await this.showCatalogMenu(chatId);
      return;
    }

    void this.tgCall('sendChatAction', { chat_id: chatId, action: 'upload_voice' }).catch(() => {});

    const clip = this.deps.getProductVoiceClip
      ? await this.deps.getProductVoiceClip(p).catch(() => null)
      : null;

    const fallbackScript =
      (p.voiceIntroText && p.voiceIntroText.trim().length > 15 ? p.voiceIntroText.trim() : '') ||
      `سلام و درود خدمت همراه گرامی ${this.getWorkshopName()}. معرفی محصول «${p.name}» از دسته ${p.categoryLabel}. ${p.description || p.tagline}`;

    const scriptText = (clip?.scriptText || fallbackScript).trim();
    const firstAvailIdx = (p.packagingOptions || []).findIndex((o) => !o.isOutOfStock);
    const actionRows: any[][] = [];
    if (p.inStock && firstAvailIdx >= 0) {
      const pkg = p.packagingOptions[firstAvailIdx];
      actionRows.push([
        {
          text: `🛒 افزودن ${pkg.weightOrVolume} به سبد (${formatToman(pkg.priceToman)})`,
          callback_data: `cb:cart_add:${p.id}:${firstAvailIdx}`,
        },
      ]);
    }
    actionRows.push([
      { text: '📦 جزئیات و تصویر محصول', callback_data: `cb:prod:${p.id}` },
      { text: '🧺 سبد خرید', callback_data: 'cb:bot_cart' },
    ]);

    if (clip?.buffer && clip.buffer.length > 0) {
      const mime = clip.mimeType || 'audio/mpeg';
      const isOgg = mime.includes('ogg');
      const ext = isOgg ? 'ogg' : mime.includes('wav') ? 'wav' : 'mp3';
      const sent = await this.tgUploadMultipart({
        method: isOgg ? 'sendVoice' : 'sendAudio',
        fieldName: isOgg ? 'voice' : 'audio',
        chatId,
        buffer: clip.buffer,
        mimeType: mime,
        filename: `${p.id}.${ext}`,
        caption: `🎙️ <b>معرفی صوتی: ${escapeHtml(p.name)}</b>\n\n${escapeHtml(scriptText.slice(0, 750))}`,
        extraFields: isOgg
          ? undefined
          : {
              title: p.name.slice(0, 64),
              performer: this.getWorkshopName().slice(0, 64),
            },
        replyMarkup: { inline_keyboard: actionRows },
      });
      if (sent.ok) return;
    }

    await this.sendMessage(
      chatId,
      `🎙️ <b>متن معرفی تخصصی محصول «${escapeHtml(p.name)}»:</b>\n\n${escapeHtml(scriptText)}`,
      { inline_keyboard: actionRows }
    );
  }

  private async handleAddCartCallback(chatId: number, prodId: string, pkgIdx: number): Promise<void> {
    const products = mergeCatalogProducts(this.snapshot);
    const prod = products.find((p) => p.id === prodId);
    if (!prod || !prod.inStock) {
      await this.sendMessage(chatId, '⏳ این محصول در حال حاضر در انبار موجود نیست.');
      return;
    }
    const pkg = (prod.packagingOptions || [])[pkgIdx];
    if (!pkg || pkg.isOutOfStock) {
      await this.sendMessage(chatId, '⏳ بسته‌بندی انتخاب‌شده در حال حاضر ناموجود است.');
      return;
    }

    this.addToChatCart(chatId, prod.id, pkg.id, 1);
    const summary = this.resolveChatCartSummary(chatId);
    const totalCount = this.getChatCartItemCount(chatId);

    await this.sendMessage(
      chatId,
      `✅ <b>به سبد خرید تلگرام اضافه شد!</b>\n\n` +
        `📦 محصول: <b>${escapeHtml(prod.name)}</b>\n` +
        `⚖️ بسته: <b>${escapeHtml(pkg.title || pkg.weightOrVolume)}</b> (${formatToman(pkg.priceToman)})\n\n` +
        `🧺 جمع کل سبد فعلی: <b>${totalCount} عدد</b> · قابل پرداخت: <b>${formatToman(summary.finalPayableToman)}</b>`,
      {
        inline_keyboard: [
          [
            { text: '➕ ۱ عدد دیگر اضافه کن', callback_data: `cb:cart_add:${prod.id}:${pkgIdx}` },
            { text: '🧺 مشاهده سبد و ثبت سفارش', callback_data: 'cb:bot_cart' },
          ],
          [
            { text: '🛍 خرید محصولات دیگر', callback_data: 'cb:shop' },
            { text: '🏠 منوی اصلی', callback_data: 'cb:home' },
          ],
        ],
      }
    );
  }

  private async showBotCart(chatId: number, messageId?: number): Promise<void> {
    const summary = this.resolveChatCartSummary(chatId);
    if (summary.items.length === 0) {
      await this.editOrSendMessage(
        chatId,
        messageId,
        `🧺 <b>سبد خرید شما در ربات خالی است</b>\n\n` +
          `می‌توانید مستقیم از کاتالوگ محصولات، بسته‌بندی دلخواه خود را به سبد اضافه کنید و سفارش خود را ثبت نمایید:`,
        {
          inline_keyboard: [
            [{ text: '🛍 مشاهده محصولات و قیمت روز', callback_data: 'cb:shop' }],
            [{ text: '🧮 محاسبه‌گر دوز کود', callback_data: 'cb:calc' }],
            [{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }],
          ],
        }
      );
      return;
    }

    const lines = summary.items.map((it, idx) => {
      return (
        `${idx + 1}. <b>${escapeHtml(it.product.name)}</b>\n` +
        `   بسته: ${escapeHtml(it.selectedPackage.title || it.selectedPackage.weightOrVolume)} × <b>${it.quantity}</b> = <b>${formatToman(it.totalPrice)}</b>`
      );
    });

    const weightStr =
      summary.totalWeightKg >= 1000
        ? `${(summary.totalWeightKg / 1000).toFixed(2)} تن (${summary.totalWeightKg} کیلوگرم)`
        : `${summary.totalWeightKg} کیلوگرم`;

    const shippingStr = summary.freeShippingApplied
      ? 'رایگان ✓'
      : formatToman(summary.shippingEstimateToman);

    const text =
      `🧺 <b>سبد خرید شما (${summary.items.length} ردیف)</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `${lines.join('\n\n')}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⚖️ مجموع وزن بار: <b>${weightStr}</b>\n` +
      (summary.discountToman > 0 ? `🎁 سود تخفیف بسته‌بندی: <b>${formatToman(summary.discountToman)}</b>\n` : '') +
      `🚚 هزینه حمل و باربری (قیمت تخمینی): <b>${shippingStr}</b>\n` +
      `💳 <b>مبلغ کل قابل پرداخت: ${formatToman(summary.finalPayableToman)}</b>`;

    const rows: any[][] = [];
    summary.items.forEach((it, idx) => {
      const shortName = `${it.product.name.slice(0, 18)} (${it.selectedPackage.weightOrVolume})`;
      rows.push([
        { text: '➖', callback_data: `cb:cart_dec:${idx}` },
        { text: `${it.quantity}× ${shortName}`, callback_data: `cb:prod:${it.product.id}` },
        { text: '➕', callback_data: `cb:cart_inc:${idx}` },
        { text: '🗑', callback_data: `cb:cart_del:${idx}` },
      ]);
    });

    rows.push([{ text: '✅ تکمیل خرید و ثبت نهایی سفارش در ربات', callback_data: 'cb:checkout_start' }]);
    rows.push([
      { text: '🛍 افزودن کالای دیگر', callback_data: 'cb:shop' },
      { text: '🧹 خالی کردن سبد', callback_data: 'cb:cart_clear' },
    ]);
    rows.push([{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]);

    await this.editOrSendMessage(chatId, messageId, text, { inline_keyboard: rows });
  }

  private async startBotCheckout(chatId: number, messageId?: number): Promise<void> {
    const summary = this.resolveChatCartSummary(chatId);
    if (summary.items.length === 0) {
      await this.showBotCart(chatId, messageId);
      return;
    }

    const session = this.getSession(chatId);
    const verified = this.userPhones[String(chatId)];
    session.checkoutDraft = {
      fullName: verified?.fullName || session.checkoutDraft?.fullName,
      phoneNumber: verified?.phoneNumber || session.checkoutDraft?.phoneNumber,
    };
    session.awaiting = 'checkout_name';

    const rows: any[][] = [];
    if (verified?.fullName) {
      rows.push([
        {
          text: `✅ استفاده از نام: ${verified.fullName}`,
          callback_data: `cb:chk_use_name:${encodeURIComponent(verified.fullName.slice(0, 40))}`,
        },
      ]);
    }
    rows.push([{ text: '🔙 بازگشت به سبد خرید', callback_data: 'cb:bot_cart' }]);

    await this.editOrSendMessage(
      chatId,
      messageId,
      `📝 <b>ثبت نهایی سفارش (مرحله ۱ از ۵)</b>\n\n` +
        `لطفاً <b>نام و نام خانوادگی خریدار / تحویل‌گیرنده</b> را تایپ و ارسال کنید:`,
      { inline_keyboard: rows }
    );
  }

  private async promptCheckoutPhone(chatId: number, messageId?: number): Promise<void> {
    const session = this.getSession(chatId);
    session.awaiting = 'checkout_phone';
    const saved = this.userPhones[String(chatId)]?.phoneNumber;

    if (saved) {
      await this.editOrSendMessage(
        chatId,
        messageId,
        `📱 <b>شماره همراه هماهنگی باربری (مرحله ۲ از ۵)</b>\n\n` +
          `شماره تاییدشده شما: <code>${escapeHtml(saved)}</code>\n` +
          `می‌توانید از همین شماره استفاده کنید یا شماره جدیدی را تایپ نمایید:`,
        {
          inline_keyboard: [
            [{ text: `✅ استفاده از ${saved}`, callback_data: 'cb:chk_use_saved_phone' }],
            [{ text: '🔙 بازگشت به سبد خرید', callback_data: 'cb:bot_cart' }],
          ],
        }
      );
      return;
    }

    await this.sendMessage(
      chatId,
      `📱 <b>شماره همراه هماهنگی باربری (مرحله ۲ از ۵)</b>\n\n` +
        `لطفاً شماره موبایل خود را تایپ کنید (مثال: <code>09123456789</code>) یا دکمه پایین را لمس کنید:`,
      {
        keyboard: [
          [{ text: '📱 ارسال خودکار شماره موبایل من', request_contact: true }],
          [{ text: 'انصراف از ثبت سفارش ❌' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      }
    );
  }

  private async promptCheckoutCity(chatId: number, messageId?: number): Promise<void> {
    const session = this.getSession(chatId);
    session.awaiting = 'checkout_city';
    const presets = [
      'تهران|تهران',
      'البرز|کرج',
      'فارس|شیراز',
      'اصفهان|اصفهان',
      'خراسان رضوی|مشهد',
      'کرمان|رفسنجان',
      'گیلان|رشت',
      'مازندران|ساری',
      'آذربایجان شرقی|تبریز',
    ];
    const rows: any[][] = [];
    for (let i = 0; i < presets.length; i += 3) {
      rows.push(
        presets.slice(i, i + 3).map((item) => {
          const [, city] = item.split('|');
          return { text: `📍 ${city}`, callback_data: `cb:chk_city:${item}` };
        })
      );
    }
    rows.push([{ text: '🔙 بازگشت به سبد خرید', callback_data: 'cb:bot_cart' }]);

    await this.editOrSendMessage(
      chatId,
      messageId,
      `📍 <b>استان و شهر مقصد ارسال (مرحله ۳ از ۵)</b>\n\n` +
        `یکی از شهرهای زیر را انتخاب کنید یا <b>نام استان و شهر خودتان</b> را تایپ کنید (مثال: <code>همدان - تویسرکان</code>):`,
      { inline_keyboard: rows }
    );
  }

  private async promptCheckoutAddress(chatId: number, messageId?: number): Promise<void> {
    const session = this.getSession(chatId);
    session.awaiting = 'checkout_address';
    await this.editOrSendMessage(
      chatId,
      messageId,
      `📬 <b>نشانی دقیق تخلیه بار (مرحله ۴ از ۵)</b>\n\n` +
        `لطفاً نشانی دقیق باغ، گلخانه، زمین یا منزل خود را بنویسید و ارسال کنید:`,
      { inline_keyboard: [[{ text: '🔙 بازگشت به سبد خرید', callback_data: 'cb:bot_cart' }]] }
    );
  }

  private async promptCheckoutDeliveryMethod(chatId: number, messageId?: number): Promise<void> {
    const session = this.getSession(chatId);
    session.awaiting = null;
    await this.editOrSendMessage(
      chatId,
      messageId,
      `🚚 <b>انتخاب روش ارسال بار (مرحله ۵ از ۵)</b>\n\nروش حمل‌ونقل مورد نظر خود را انتخاب کنید:`,
      {
        inline_keyboard: [
          [{ text: '🚛 باربری معتبر بین‌شهری', callback_data: 'cb:chk_deliv:freight_terminal' }],
          [{ text: '🛻 وانت نیسان / خاور دربستی مستقیم', callback_data: 'cb:chk_deliv:truck_dedicated' }],
          [{ text: '🏭 تحویل حضوری درب کارگاه', callback_data: 'cb:chk_deliv:pickup_factory' }],
          [{ text: '📦 پیک و پست پیشتاز (احجام کم)', callback_data: 'cb:chk_deliv:courier' }],
        ],
      }
    );
  }

  private async promptCheckoutNotes(chatId: number, messageId?: number): Promise<void> {
    const session = this.getSession(chatId);
    session.awaiting = 'checkout_notes';
    await this.editOrSendMessage(
      chatId,
      messageId,
      `📝 <b>توضیحات یا یادداشت تکمیلی (اختیاری)</b>\n\n` +
        `اگر ساعتی برای تماس یا نکته‌ای برای راننده باربری دارید بنویسید؛ در غیر این صورت دکمه «رد شدن» را بزنید:`,
      {
        inline_keyboard: [
          [{ text: '⏭ ندارم / مشاهده جمع‌بندی نهایی', callback_data: 'cb:chk_skip_notes' }],
        ],
      }
    );
  }

  private async showCheckoutConfirmSummary(chatId: number, messageId?: number): Promise<void> {
    const session = this.getSession(chatId);
    const draft = session.checkoutDraft || {};
    const summary = this.resolveChatCartSummary(chatId);
    if (summary.items.length === 0) {
      await this.showBotCart(chatId, messageId);
      return;
    }

    const itemsText = summary.items
      .map(
        (it, idx) =>
          `${idx + 1}. ${escapeHtml(it.product.name)} (${escapeHtml(it.selectedPackage.weightOrVolume)}) × <b>${it.quantity}</b> = ${formatToman(it.totalPrice)}`
      )
      .join('\n');

    await this.editOrSendMessage(
      chatId,
      messageId,
      `📋 <b>تایید نهایی پیش‌فاکتور سفارش</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 نام خریدار: <b>${escapeHtml(draft.fullName || 'مشتری تلگرام')}</b>\n` +
        `📱 موبایل: <code>${escapeHtml(draft.phoneNumber || '-')}</code>\n` +
        `📍 مقصد: <b>${escapeHtml(draft.province || '')} - ${escapeHtml(draft.city || '')}</b>\n` +
        `📬 نشانی: ${escapeHtml(draft.deliveryAddress || '-')}\n` +
        `🚚 ارسال: <b>${escapeHtml(formatDeliveryMethodFa(draft.deliveryMethod))}</b>\n\n` +
        `🛒 <b>اقلام:</b>\n${itemsText}\n\n` +
        `⚖️ وزن کل: <b>${summary.totalWeightKg} کیلوگرم</b>\n` +
        `🚚 هزینه حمل و باربری (قیمت تخمینی): <b>${summary.freeShippingApplied ? 'رایگان ✓' : formatToman(summary.shippingEstimateToman)}</b>\n` +
        `💳 <b>جمع نهایی قابل پرداخت: ${formatToman(summary.finalPayableToman)}</b>`,
      {
        inline_keyboard: [
          [{ text: '✅ تایید و ثبت قطعی سفارش', callback_data: 'cb:chk_confirm' }],
          [
            { text: '✏️ ویرایش سبد', callback_data: 'cb:bot_cart' },
            { text: '🏠 انصراف / منوی اصلی', callback_data: 'cb:home' },
          ],
        ],
      }
    );
  }

  private async finalizeBotOrder(chatId: number, messageId?: number): Promise<void> {
    const session = this.getSession(chatId);
    const draft = session.checkoutDraft || {};
    const summary = this.resolveChatCartSummary(chatId);
    if (summary.items.length === 0) {
      await this.showBotCart(chatId, messageId);
      return;
    }

    const todayCompact = getCurrentPersianDate().replace(/\//g, '');
    const todayDisplay = new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const order: CustomerOrder = {
      orderNumber: `ORD-${todayCompact}-${Math.floor(1000 + Math.random() * 9000)}`,
      orderDate: todayDisplay,
      customerName: (draft.fullName || 'مشتری تلگرام').trim(),
      phoneNumber: normalizeIranPhoneNumber(draft.phoneNumber || '') || '09000000000',
      province: (draft.province || 'تهران').trim(),
      city: (draft.city || 'تهران').trim(),
      deliveryAddress: (draft.deliveryAddress || 'هماهنگی تلفنی').trim(),
      farmingType: 'orchard',
      deliveryMethod: draft.deliveryMethod || 'freight_terminal',
      items: summary.items,
      totalWeightKg: summary.totalWeightKg,
      subtotalToman: summary.subtotalToman,
      discountToman: summary.discountToman,
      shippingEstimateToman: summary.shippingEstimateToman,
      finalPayableToman: summary.finalPayableToman,
      orderNotes: (draft.orderNotes || 'ثبت مستقیم از طریق ربات تلگرام').trim(),
      status: 'registered',
      updatedAt: todayDisplay,
      updatedAtMs: Date.now(),
    };

    if (this.deps.onBotOrderCreated) {
      await this.deps.onBotOrderCreated(order, chatId);
    } else {
      this.upsertOrderInSnapshot(order);
    }

    this.clearChatCart(chatId);
    session.checkoutDraft = undefined;
    session.awaiting = null;

    // Notify workshop admin & customer immediately
    await this.notifyNewOrder(order, chatId);

    await this.editOrSendMessage(
      chatId,
      messageId,
      `🎉 <b>سفارش شما با موفقیت در سیستم کارگاه ثبت شد!</b>\n\n` +
        `🔖 کد پیگیری سفارش: <code>${escapeHtml(order.orderNumber)}</code>\n` +
        `💳 مبلغ قابل پرداخت: <b>${formatToman(order.finalPayableToman)}</b>\n\n` +
        `برای تکمیل واریز و ارسال تصویر فیش پرداختی، دکمه زیر را لمس کنید:`,
      {
        inline_keyboard: [
          [{ text: '💳 مشاهده شماره کارت و شبا + ارسال رسید', callback_data: 'cb:payment' }],
          [{ text: '📦 پیگیری وضعیت سفارش', callback_data: 'cb:orders' }],
          [{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }],
        ],
      }
    );
  }

  private async showCalculatorMenu(chatId: number, messageId?: number): Promise<void> {
    const webBtn = this.webAppButton('🧮 باز کردن محاسبه‌گر پیشرفته متراژ و سبد خودکار (وب‌اپ)', 'calculator', undefined, chatId);
    const rows: any[][] = [];
    if (webBtn) rows.push([webBtn]);
    rows.push([
      { text: '🌳 باغات و درختان میوه', callback_data: 'cb:calc_cat:orchard' },
      { text: '🪴 گیاهان آپارتمانی', callback_data: 'cb:calc_cat:houseplants' },
    ]);
    rows.push([
      { text: '🍅 گلخانه و صیفی‌جات', callback_data: 'cb:calc_cat:greenhouse' },
      { text: '🌾 زراعت و غلات', callback_data: 'cb:calc_cat:farming' },
    ]);
    rows.push([{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]);

    await this.editOrSendMessage(
      chatId,
      messageId,
      `🧮 <b>محاسبه‌گر علمی دوز مصرف کودهای کارگاه صفری</b>\n\n` +
        `در حال حاضر <b>${COMPREHENSIVE_PLANT_PROFILES.length} پروفیل گیاهی تخصصی</b> در سامانه ثبت شده است.\n` +
        `گروه گیاه خود را انتخاب کنید تا دوز علمی و پکیج خرید مستقیم کارگاه برایتان محاسبه شود:`,
      { inline_keyboard: rows }
    );
  }

  private async showCalculatorPlantsByCategory(chatId: number, messageId: number | undefined, cat: string): Promise<void> {
    const plants = COMPREHENSIVE_PLANT_PROFILES.filter((p) => p.category === cat).slice(0, 14);
    const rows: any[][] = plants.map((pl) => [
      { text: `🌱 ${pl.name}`, callback_data: `cb:calc_plant:${pl.id}` },
    ]);
    rows.push([
      { text: '🔙 دسته‌بندی گیاهان', callback_data: 'cb:calc' },
      { text: '🏠 منوی اصلی', callback_data: 'cb:home' },
    ]);
    await this.editOrSendMessage(
      chatId,
      messageId,
      `🌱 <b>انتخاب گیاه جهت مشاهده برنامه کودی و خرید مستقیم پکیج:</b>`,
      { inline_keyboard: rows }
    );
  }

  private computeBotCalculatorRecommendation(plantId: string, unitsCount: number): {
    plantName: string;
    unitLabel: string;
    totalVermiKg: number;
    recommendedProd?: StoreProduct;
    recommendedPkg?: PackageOption;
    pkgCount: number;
    estimatedCostToman: number;
  } | null {
    const pl = COMPREHENSIVE_PLANT_PROFILES.find((p) => p.id === plantId);
    if (!pl) return null;
    const d = pl.scientificDose;
    const perUnitVermi = d.vermiKgPerUnit || (pl.category === 'houseplants' ? 0.3 : 4);
    const totalVermiKg = Math.round(perUnitVermi * unitsCount * 10) / 10;

    const catalog = mergeCatalogProducts(this.snapshot);
    const prod =
      catalog.find((p) => p.id === 'prod-vermicompost-grade-a' && p.inStock) ||
      catalog.find((p) => p.category === 'vermicompost' && p.inStock) ||
      catalog[0];
    if (!prod) {
      return {
        plantName: pl.name,
        unitLabel: d.unitLabel,
        totalVermiKg,
        pkgCount: 0,
        estimatedCostToman: 0,
      };
    }

    const availPkgs = (prod.packagingOptions || []).filter((o) => !o.isOutOfStock);
    const opts = availPkgs.length > 0 ? availPkgs : prod.packagingOptions || [];
    const selectedPkg =
      (totalVermiKg >= 950 ? opts.find((o) => o.nominalWeightKg >= 900) : undefined) ||
      (totalVermiKg >= 90 ? opts.find((o) => o.nominalWeightKg === 50) : undefined) ||
      opts.find((o) => o.nominalWeightKg === 25) ||
      opts[0];

    const pkgWeight = selectedPkg?.nominalWeightKg || 25;
    const pkgCount = selectedPkg ? Math.max(1, Math.ceil(totalVermiKg / pkgWeight)) : 0;
    const estimatedCostToman = selectedPkg ? pkgCount * selectedPkg.priceToman : 0;

    return {
      plantName: pl.name,
      unitLabel: d.unitLabel,
      totalVermiKg,
      recommendedProd: prod,
      recommendedPkg: selectedPkg,
      pkgCount,
      estimatedCostToman,
    };
  }

  private async showCalculatorPlantDose(
    chatId: number,
    messageId: number | undefined,
    plantId: string,
    unitsCount?: number
  ): Promise<void> {
    const pl = COMPREHENSIVE_PLANT_PROFILES.find((p) => p.id === plantId);
    if (!pl) {
      await this.showCalculatorMenu(chatId, messageId);
      return;
    }
    const d = pl.scientificDose;
    const doseLines: string[] = [];
    if (d.vermiKgPerUnit) doseLines.push(`🪱 ورمیکمپوست درجه ۱: <b>${d.vermiKgPerUnit} کیلوگرم</b> به ازای هر ${escapeHtml(d.unitLabel)}`);
    if (d.compostKgPerUnit) doseLines.push(`🍂 کمپوست سنتی غنی‌شده: <b>${d.compostKgPerUnit} کیلوگرم</b> به ازای هر ${escapeHtml(d.unitLabel)}`);
    if (d.zeoliteKgPerUnit) doseLines.push(`🪨 زئولیت کشاورزی شکری: <b>${d.zeoliteKgPerUnit} کیلوگرم</b> به ازای هر ${escapeHtml(d.unitLabel)}`);
    if (d.liquidTeaLiterPerUnit) doseLines.push(`💧 عصاره ورمی‌تی مایع: <b>${d.liquidTeaLiterPerUnit} لیتر</b> به ازای هر ${escapeHtml(d.unitLabel)}`);
    if (d.substrateKgPerUnit) doseLines.push(`🪴 بستر کشت تفاله قهوه: <b>${d.substrateKgPerUnit} کیلوگرم</b> به ازای هر ${escapeHtml(d.unitLabel)}`);

    const chosenCount = unitsCount || (pl.category === 'houseplants' ? 10 : 20);
    const rec = this.computeBotCalculatorRecommendation(plantId, chosenCount);
    const recBlock =
      rec && rec.recommendedProd && rec.recommendedPkg
        ? `\n\n🧮 <b>محاسبه برای ${chosenCount.toLocaleString('fa-IR')} ${escapeHtml(rec.unitLabel)}:</b>\n` +
          `⚖️ نیاز کل ورمیکمپوست: <b>${rec.totalVermiKg.toLocaleString('fa-IR')} کیلوگرم</b>\n` +
          `📦 پیشنهاد خرید: <b>${rec.pkgCount} × ${escapeHtml(rec.recommendedPkg.title || rec.recommendedPkg.weightOrVolume)}</b> ${escapeHtml(rec.recommendedProd.name)}\n` +
          `💰 برآورد مبلغ: <b>${formatToman(rec.estimatedCostToman)}</b>`
        : '';

    const presets = pl.category === 'houseplants' ? [5, 10, 25, 50] : [10, 25, 50, 100];
    const rows: any[][] = [];
    rows.push(
      presets.map((cnt) => ({
        text: `${cnt === chosenCount ? '● ' : ''}${cnt.toLocaleString('fa-IR')} ${d.unitLabel.slice(0, 12)}`,
        callback_data: `cb:calc_qty:${pl.id}:${cnt}`,
      }))
    );
    if (rec && rec.recommendedProd && rec.recommendedPkg && rec.pkgCount > 0) {
      rows.push([
        {
          text: `🛒 افزودن ${rec.pkgCount} بسته پیشنهادی به سبد (${formatToman(rec.estimatedCostToman)})`,
          callback_data: `cb:calc_cart:${pl.id}:${chosenCount}`,
        },
      ]);
    }
    const webBtn = this.webAppButton('🧮 محاسبه‌گر پیشرفته متراژ در وب‌اپ', 'calculator', undefined, chatId);
    if (webBtn) rows.push([webBtn]);
    rows.push([
      { text: '🔙 برگشت به لیست گیاهان', callback_data: `cb:calc_cat:${pl.category}` },
      { text: '🏠 منوی اصلی', callback_data: 'cb:home' },
    ]);

    await this.editOrSendMessage(
      chatId,
      messageId,
      `🌿 <b>برنامه تغذیه علمی: ${escapeHtml(pl.name)}</b>\n` +
        `🏷 گروه: ${escapeHtml(pl.categoryLabel)}\n\n` +
        `📊 <b>مقدار مصرف استاندارد:</b>\n${doseLines.join('\n')}\n\n` +
        `🗓 <b>بهترین زمان مصرف:</b> ${escapeHtml(d.bestMonthsFa)}\n` +
        `📋 <b>روش اجرا:</b> ${escapeHtml(d.instructions)}` +
        recBlock,
      { inline_keyboard: rows }
    );
  }

  private async addCalculatedPlantPackToBotCart(chatId: number, plantId: string, unitsCount: number): Promise<void> {
    const rec = this.computeBotCalculatorRecommendation(plantId, unitsCount);
    if (!rec || !rec.recommendedProd || !rec.recommendedPkg || rec.pkgCount <= 0) {
      await this.sendMessage(chatId, '⚠️ محصول پیشنهادی در حال حاضر در انبار موجود نیست.');
      return;
    }
    this.addToChatCart(chatId, rec.recommendedProd.id, rec.recommendedPkg.id, rec.pkgCount);
    await this.sendMessage(
      chatId,
      `✅ <b>پکیج تغذیه ${escapeHtml(rec.plantName)} (${unitsCount} ${escapeHtml(rec.unitLabel)}) به سبد اضافه شد!</b>\n\n` +
        `📦 ${rec.pkgCount} × ${escapeHtml(rec.recommendedPkg.title || rec.recommendedPkg.weightOrVolume)} (${escapeHtml(rec.recommendedProd.name)})\n` +
        `💰 جمع: <b>${formatToman(rec.estimatedCostToman)}</b>`,
      {
        inline_keyboard: [
          [{ text: '🧺 مشاهده سبد خرید و ثبت نهایی سفارش', callback_data: 'cb:bot_cart' }],
          [{ text: '🛍 ادامه خرید', callback_data: 'cb:shop' }],
        ],
      }
    );
  }

  private async showTipsCategories(chatId: number, messageId?: number): Promise<void> {
    const cats = TIP_CATEGORIES.filter((c) => c.id !== 'all');
    const rows: any[][] = [];
    const webBtn = this.webAppButton('🔊 مشاهده نکات طلایی با پخش صوتی در وب‌اپ', 'tips');
    if (webBtn) rows.push([webBtn]);
    for (const c of cats) {
      rows.push([{ text: `${c.icon} ${c.label}`, callback_data: `cb:tip_cat:${c.id}` }]);
    }
    rows.push([{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]);

    await this.editOrSendMessage(
      chatId,
      messageId,
      `🌿 <b>گنجینه نکات طلایی کشاورزی و باغبانی (${AGRICULTURAL_GOLDEN_TIPS.length} ترفند کاربردی)</b>\n\nدسته‌بندی مورد نظر را انتخاب کنید:`,
      { inline_keyboard: rows }
    );
  }

  private async showTipsList(chatId: number, messageId: number | undefined, category: string): Promise<void> {
    const tips = AGRICULTURAL_GOLDEN_TIPS.filter((t) => t.category === category).slice(0, 12);
    const rows: any[][] = tips.map((t) => [
      { text: `${t.icon} ${t.title.slice(0, 42)}`, callback_data: `cb:tip:${t.id}` },
    ]);
    rows.push([
      { text: '🔙 دسته‌بندی نکات', callback_data: 'cb:tips' },
      { text: '🏠 منوی اصلی', callback_data: 'cb:home' },
    ]);
    await this.editOrSendMessage(
      chatId,
      messageId,
      `✨ <b>فهرست نکات تخصصی:</b> روی هر نکته بزنید تا ترفند طلایی و مراحل اجرا نمایش داده شود:`,
      { inline_keyboard: rows }
    );
  }

  private async showTipDetail(chatId: number, messageId: number | undefined, tipId: string): Promise<void> {
    const tip = AGRICULTURAL_GOLDEN_TIPS.find((t) => t.id === tipId);
    if (!tip) {
      await this.showTipsCategories(chatId, messageId);
      return;
    }
    const stepsText = (tip.steps || []).map((st, idx) => `${idx + 1}. ${escapeHtml(st)}`).join('\n');
    const rows: any[][] = [];
    const webBtn = this.webAppButton('🔊 گوش دادن و مطالعه کامل در وب‌اپ', 'tips');
    if (webBtn) rows.push([webBtn]);
    rows.push([
      { text: '🔙 لیست نکات', callback_data: `cb:tip_cat:${tip.category}` },
      { text: '🏠 منوی اصلی', callback_data: 'cb:home' },
    ]);

    await this.editOrSendMessage(
      chatId,
      messageId,
      `${tip.icon} <b>${escapeHtml(tip.title)}</b>\n` +
        `🏷 ${escapeHtml(tip.categoryLabel)} · 🗓 فصل مناسب: ${escapeHtml(tip.bestSeason)}\n\n` +
        `📌 ${escapeHtml(tip.summary)}\n\n` +
        `💎 <b>ترفند طلایی کارگاه صفری:</b>\n${escapeHtml(tip.goldenTrick)}\n\n` +
        `✅ <b>مراحل اجرا:</b>\n${stepsText}\n\n` +
        `⚠️ <b>اشتباه رایج:</b> ${escapeHtml(tip.commonMistake)}\n` +
        `🛒 <b>محصول پیشنهادی:</b> ${escapeHtml(tip.recommendedProductLabel)}`,
      { inline_keyboard: rows }
    );
  }

  private async showWeatherMenu(chatId: number, messageId?: number): Promise<void> {
    const defaultCity = this.snapshot.settings.managerCity || 'تهران';
    const quickCities = Array.from(
      new Set([defaultCity, 'تهران', 'کرج', 'شیراز', 'اصفهان', 'رفسنجان', 'مشهد', 'رشت', 'ساری', 'تبریز', 'اهواز', 'همدان'])
    ).slice(0, 12);

    const rows: any[][] = [];
    const webBtn = this.webAppButton('🌦 نمودار ۷ روزه و هشدارهای باغبانی در وب‌اپ', 'weather');
    if (webBtn) rows.push([webBtn]);

    for (let i = 0; i < quickCities.length; i += 3) {
      rows.push(
        quickCities.slice(i, i + 3).map((c) => ({
          text: `📍 ${c}`,
          callback_data: `cb:weather_city:${c}`,
        }))
      );
    }
    rows.push([{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]);

    await this.editOrSendMessage(
      chatId,
      messageId,
      `🌦 <b>سامانه زنده هواشناسی کشاورزی و زمان طلایی سمپاشی</b>\n\n` +
        `یکی از شهرهای زیر را انتخاب کنید یا <b>نام شهر خودتان را همینجا تایپ و ارسال کنید</b> (مثال: <code>تویسرکان</code> یا <code>کرمان</code>):`,
      { inline_keyboard: rows }
    );
  }

  private async sendWeatherForCity(chatId: number, city: string, messageId?: number): Promise<void> {
    const province = this.snapshot.settings.managerProvince || city;
    try {
      const payload = await this.deps.getAgriculturalWeather(province, city);
      const cur = payload.current || {};
      const advisories = Array.isArray(payload.advisories) ? payload.advisories.slice(0, 3) : [];
      const advLines = advisories
        .map((a: any) => `• <b>${escapeHtml(a.title)}</b>\n  ${escapeHtml(a.detail)}`)
        .join('\n\n');

      const rows: any[][] = [];
      const webBtn = this.webAppButton('🌦 پیش‌بینی ۷ روزه و رطوبت خاک در وب‌اپ', 'weather');
      if (webBtn) rows.push([webBtn]);
      rows.push([
        { text: '🔄 شهر دیگر', callback_data: 'cb:weather' },
        { text: '🏠 منوی اصلی', callback_data: 'cb:home' },
      ]);

      const soilLine =
        typeof cur.soilTemp === 'number'
          ? `\n🌱 دمای سطح خاک: <b>${Math.round(cur.soilTemp)}°C</b>`
          : '';

      await this.editOrSendMessage(
        chatId,
        messageId,
        `🌦 <b>گزارش هواشناسی کشاورزی: ${escapeHtml(payload.location?.city || city)}</b>\n\n` +
          `☁️ وضعیت: <b>${escapeHtml(cur.conditionLabel || '')}</b>\n` +
          `🌡 دما: <b>${cur.temperature}°C</b> (احساس: ${cur.apparentTemperature}°C)\n` +
          `💧 رطوبت هوا: <b>${cur.humidity}٪</b> | 💨 باد: <b>${cur.windSpeed} km/h</b>\n` +
          `🌧 احتمال بارش: <b>${cur.precipitationProbability}٪</b>` +
          `${soilLine}\n\n` +
          `🌿 <b>توصیه‌های تخصصی امروز:</b>\n${advLines}`,
        { inline_keyboard: rows }
      );
    } catch {
      await this.sendMessage(
        chatId,
        `⚠️ دریافت اطلاعات هواشناسی شهر «${escapeHtml(city)}» موقتاً با تاخیر روبه‌رو شد. لطفاً دوباره نام شهر را وارد کنید یا از تب هواشناسی در وب‌اپ استفاده نمایید.`,
        { inline_keyboard: [[{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]] }
      );
    }
  }

  private async showOrdersPrompt(chatId: number, messageId?: number): Promise<void> {
    const verifiedPhone = this.userPhones[String(chatId)]?.phoneNumber;
    const rows: any[][] = [];
    if (verifiedPhone) {
      rows.push([{ text: `📦 مشاهده سفارش‌های شماره ${verifiedPhone}`, callback_data: 'cb:orders_my_phone' }]);
    }
    const webBtn = this.webAppButton('📦 مشاهده سابقه سفارشات و چاپ پیش‌فاکتور در وب‌اپ', 'orders', undefined, chatId);
    if (webBtn) rows.push([webBtn]);
    rows.push([{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]);

    await this.editOrSendMessage(
      chatId,
      messageId,
      `📦 <b>پیگیری آنلاین سفارش و وضعیت باربری</b>\n\n` +
        (verifiedPhone
          ? `می‌توانید با لمس دکمه زیر سفارش‌های شماره <code>${escapeHtml(verifiedPhone)}</code> را ببینید یا <b>کد سفارش</b> دیگری را تایپ و ارسال کنید:`
          : `لطفاً <b>کد سفارش</b> (مثال: <code>ORD-1404...</code>) یا <b>شماره موبایل ثبت‌شده</b> خود را همینجا ارسال کنید تا آخرین وضعیت و کد رهگیری نمایش داده شود:`),
      { inline_keyboard: rows }
    );
  }

  private async lookupOrdersByQuery(chatId: number, rawQuery: string): Promise<void> {
    const norm = rawQuery
      .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48))
      .trim()
      .toLowerCase();

    const matched = this.snapshot.orders.filter((o) => {
      const num = (o.orderNumber || '').toLowerCase();
      const phone = (o.phoneNumber || '')
        .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48))
        .toLowerCase();
      return (norm.length >= 4 && num.includes(norm)) || (norm.length >= 7 && phone.includes(norm));
    });

    const rows: any[][] = [];
    const webBtn = this.webAppButton('📦 نمایش کارت سه‌بعدی و چاپ فاکتور در وب‌اپ', 'orders');
    if (webBtn) rows.push([webBtn]);
    rows.push([{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]);

    if (matched.length === 0) {
      await this.sendMessage(
        chatId,
        `🔍 سفارشی با مشخصات «<code>${escapeHtml(rawQuery)}</code>» در داده‌های همگام‌شده یافت نشد.\n` +
          `اگر سفارش خود را به‌تازگی ثبت کرده‌اید، از داخل <b>وب‌اپ فروشگاه ← تب سفارشات</b> به‌صورت زنده قابل مشاهده است.`,
        { inline_keyboard: rows }
      );
      return;
    }

    const blocks = matched.slice(0, 3).map((ord) => {
      const trackLine = ord.trackingNumber ? `\n🚛 کد رهگیری باربری: <code>${escapeHtml(ord.trackingNumber)}</code>` : '';
      return (
        `🔖 کد: <code>${escapeHtml(ord.orderNumber)}</code>\n` +
        `👤 خریدار: ${escapeHtml(ord.customerName)} (${escapeHtml(ord.city)})\n` +
        `📊 وضعیت: <b>${formatOrderStatusFa(ord.status)}</b>\n` +
        `⚖️ وزن: ${Math.round(ord.totalWeightKg || 0).toLocaleString('fa-IR')} کیلوگرم · 💳 مبلغ: ${formatToman(ord.finalPayableToman || 0)}` +
        trackLine
      );
    });

    await this.sendMessage(
      chatId,
      `📦 <b>نتیجه پیگیری سفارش (${matched.length} مورد):</b>\n\n${blocks.join('\n\n━━━━━━━━━━\n\n')}`,
      { inline_keyboard: rows }
    );
  }

  private async showConsultantPrompt(chatId: number, messageId?: number): Promise<void> {
    const faqButtons: any[][] = CONSULTANT_FAQ_ITEMS.slice(0, 5).map((f) => [
      { text: `❓ ${f.question.slice(0, 44)}`, callback_data: `cb:faq:${f.id}` },
    ]);
    const webBtn = this.webAppButton('💬 پنل کامل مشاور هوشمند در وب‌اپ', 'tips');
    if (webBtn) faqButtons.unshift([webBtn]);
    faqButtons.push([{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]);

    await this.editOrSendMessage(
      chatId,
      messageId,
      `🤖 <b>مشاور هوشمند تخصصی باغبانی (مهندس صفری)</b>\n\n` +
        `همین الان <b>سوال کشاورزی یا کودی خود را تایپ و ارسال کنید</b> (مثلاً درباره درخت پسته، زردی برگ گیاه آپارتمانی، زمان چالکود یا دوز ورمی‌تی) یا یکی از سوالات پرتکرار زیر را انتخاب نمایید:`,
      { inline_keyboard: faqButtons }
    );
  }

  private async replyWithConsultant(chatId: number, question: string): Promise<void> {
    const s = this.snapshot.settings;
    const reply = await this.deps.getConsultantReply(question, {
      province: s.managerProvince,
      city: s.managerCity,
    });
    const rows: any[][] = [];
    const webBtn = this.webAppButton('🛒 مشاهده محصولات پیشنهادی در وب‌اپ', 'catalog');
    if (webBtn) rows.push([webBtn]);
    rows.push([
      { text: '❓ سوالات پرتکرار', callback_data: 'cb:consultant' },
      { text: '🏠 منوی اصلی', callback_data: 'cb:home' },
    ]);

    await this.sendMessage(
      chatId,
      `🌿 <b>پاسخ تخصصی مهندس صفری:</b>\n\n${escapeHtml(reply.slice(0, 3400))}`,
      { inline_keyboard: rows }
    );
  }

  private async showContactInfo(chatId: number, messageId?: number): Promise<void> {
    const s = this.snapshot.settings;
    const rows: any[][] = [];
    const webBtn = this.webAppButton('فروشگاه', 'profile', undefined, chatId);
    if (webBtn) rows.push([webBtn]);
    rows.push([{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]);

    await this.editOrSendMessage(
      chatId,
      messageId,
      `📞 <b>اطلاعات تماس و پشتیبانی ${escapeHtml(this.getWorkshopName())}</b>\n\n` +
        `👤 کارشناس تغذیه: <b>${escapeHtml(s.agronomistName || 'مهندس صفری')}</b> (${escapeHtml(s.agronomistTitle || 'متخصص خاک‌شناسی و تغذیه زیستی')})\n` +
        `☎️ تلفن مشاوره و فروش: <code>${escapeHtml(s.agronomistPhone || s.supportPhone || '09120000003')}</code>\n` +
        (s.supportPhone ? `📱 پشتیبانی پیگیری سفارش: <code>${escapeHtml(s.supportPhone)}</code>\n` : '') +
        (s.workshopAddress ? `📍 نشانی کارگاه: ${escapeHtml(s.workshopAddress)}\n` : '') +
        (s.workingHours ? `🕒 ساعات پاسخگویی: ${escapeHtml(s.workingHours)}\n` : ''),
      { inline_keyboard: rows }
    );
  }

  private async showPaymentInfo(chatId: number, messageId?: number): Promise<void> {
    const s = this.snapshot.settings;
    const session = this.getSession(chatId);
    session.awaiting = 'payment_receipt';

    const rawCard = String(s.paymentCardNumber || '')
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      .trim();
    const copyableCardDigits = rawCard.replace(/[^0-9]/g, '');
    const cardDisplay = copyableCardDigits || rawCard;

    const rawIban = String(s.paymentIban || '')
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      .replace(/\s+/g, '')
      .toUpperCase();
    const holder = String(s.paymentCardHolder || '').trim();
    const bankName = String(s.paymentBankName || '').trim();
    const hasPaymentAccount = Boolean(cardDisplay || rawIban);

    const lines: string[] = [
      `💳 <b>اطلاعات شماره کارت و شبا جهت واریز وجه (${escapeHtml(this.getWorkshopName())})</b>`,
      '',
    ];

    if (hasPaymentAccount) {
      if (bankName) lines.push(`🏦 بانک: <b>${escapeHtml(bankName)}</b>`);
      if (holder) lines.push(`👤 به نام: <b>${escapeHtml(holder)}</b>`);
      if (cardDisplay) {
        lines.push(`💳 شماره کارت (برای کپی لمس کنید):\n<code>${escapeHtml(cardDisplay)}</code>`);
      }
      if (rawIban) {
        lines.push(`🔢 شماره شبا (برای کپی لمس کنید):\n<code>${escapeHtml(rawIban)}</code>`);
      }
      if (s.paymentTermsNotice) {
        lines.push(`\n🛡️ <i>${escapeHtml(s.paymentTermsNotice)}</i>`);
      }
      lines.push(
        `\n━━━━━━━━━━━━━━━━━━\n` +
          `📤 <b>ارسال رسید پرداخت:</b>\n` +
          `پس از انجام واریز، <b>عکس فیش واریزی</b>، <b>فایل رسید</b> یا <b>شماره پیگیری / متن تراکنش</b> را <u>همین الان در همین چت ارسال کنید</u> تا بلافاصله برای مدیریت ثبت و بررسی شود.`
      );
    } else {
      lines.push(
        `⏳ شماره کارت و شبا هنوز در تنظیمات مدیریت وارد نشده است.\n` +
          `لطفاً برای دریافت شماره حساب با واحد فروش تماس بگیرید:\n` +
          `📞 <code>${escapeHtml(s.supportPhone || s.agronomistPhone || '09120000003')}</code>\n\n` +
          `📤 اگر واریز را انجام داده‌اید، همینجا عکس یا متن رسید پرداخت خود را ارسال کنید تا مستقیم به مدیر تحویل داده شود.`
      );
    }

    const rows: any[][] = [];
    rows.push([{ text: '📤 همینجا رسید واریز می‌فرستم', callback_data: 'cb:send_receipt' }]);
    const ordersBtn = this.webAppButton('📦 مشاهده سفارش‌های من در فروشگاه', 'orders', undefined, chatId);
    if (ordersBtn) rows.push([ordersBtn]);
    rows.push([{ text: '🏠 منوی اصلی', callback_data: 'cb:home' }]);

    await this.editOrSendMessage(chatId, messageId, lines.join('\n'), { inline_keyboard: rows });
  }

  private async handlePaymentReceiptSubmission(params: {
    chatId: number;
    firstName: string;
    fullName?: string;
    username?: string;
    kind: 'photo' | 'document' | 'text';
    fileId?: string;
    fileName?: string;
    captionOrText?: string;
  }): Promise<void> {
    const session = this.getSession(params.chatId);
    session.awaiting = null;

    const phoneRec = this.userPhones[String(params.chatId)];
    const customerPhone = phoneRec?.phoneNumber || '';
    const displayName =
      params.fullName || phoneRec?.fullName || params.firstName || 'مشتری تلگرام';
    const resolvedUsername = params.username || phoneRec?.username;
    const tehranTime = new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date());

    const normPhone = normalizeIranPhoneNumber(customerPhone);
    const matchingOrder = this.snapshot.orders.find((o) => {
      if (o.status === 'cancelled') return false;
      if (normPhone && normalizeIranPhoneNumber(o.phoneNumber) === normPhone) return true;
      if (!normPhone && displayName && o.customerName?.trim() === displayName.trim()) return true;
      return false;
    });

    const summaryForDb =
      `💳 رسید پرداخت از ربات تلگرام (${tehranTime})` +
      (params.kind === 'photo'
        ? ' [تصویر فیش]'
        : params.kind === 'document'
        ? ` [فایل: ${params.fileName || 'رسید'}]`
        : '') +
      (params.captionOrText ? `: ${params.captionOrText.slice(0, 180)}` : '');

    let attachedOrder: CustomerOrder | null = matchingOrder || null;
    if (this.deps.onPaymentReceiptReceived) {
      const hookOrder = this.deps.onPaymentReceiptReceived({
        chatId: params.chatId,
        phoneNumber: customerPhone || undefined,
        fullName: displayName,
        username: resolvedUsername,
        kind: params.kind,
        contentSummary: summaryForDb,
      });
      if (hookOrder) attachedOrder = hookOrder;
    }

    const adminId = (this.config.adminChatId || '').trim();
    if (adminId) {
      const orderLine = attachedOrder
        ? `\n🔖 مرتبط با سفارش: <code>${escapeHtml(attachedOrder.orderNumber)}</code> (${formatToman(attachedOrder.finalPayableToman || 0)})`
        : '';
      const adminText =
        `💳 <b>رسید واریز جدید از مشتری دریافت شد!</b>\n\n` +
        `👤 نام مشتری: <b>${escapeHtml(displayName)}</b>` +
        (resolvedUsername ? ` (@${escapeHtml(resolvedUsername)})` : '') +
        `\n📱 موبایل: ${customerPhone ? `<code>${escapeHtml(customerPhone)}</code>` : 'ثبت‌نشده'}` +
        `\n🆔 شناسه چت تلگرام: <code>${params.chatId}</code>` +
        orderLine +
        `\n🕒 زمان ثبت: ${escapeHtml(tehranTime)}` +
        (params.captionOrText ? `\n📝 توضیح / شماره پیگیری مشتری:\n<code>${escapeHtml(params.captionOrText)}</code>` : '');

      if (params.kind === 'photo' && params.fileId) {
        await this.tgCall('sendPhoto', {
          chat_id: adminId,
          photo: params.fileId,
          caption: adminText.slice(0, 1000),
          parse_mode: 'HTML',
        });
      } else if (params.kind === 'document' && params.fileId) {
        await this.tgCall('sendDocument', {
          chat_id: adminId,
          document: params.fileId,
          caption: adminText.slice(0, 1000),
          parse_mode: 'HTML',
        });
      } else {
        await this.sendMessage(adminId, adminText);
      }
    }

    const replyRows: any[][] = [];
    const shopBtn = this.webAppButton('فروشگاه', 'orders', undefined, params.chatId);
    if (shopBtn) replyRows.push([shopBtn]);
    replyRows.push([
      { text: '💳 مشاهده دوباره شماره کارت و شبا', callback_data: 'cb:payment' },
      { text: '🏠 منوی اصلی', callback_data: 'cb:home' },
    ]);

    await this.sendMessage(
      params.chatId,
      `✅ <b>رسید پرداخت شما با موفقیت ثبت و برای مدیریت ارسال شد!</b>\n\n` +
        (attachedOrder
          ? `🔖 سفارش مرتبط: <code>${escapeHtml(attachedOrder.orderNumber)}</code>\n`
          : '') +
        `همکاران ما در <b>${escapeHtml(this.getWorkshopName())}</b> پس از بررسی واریز، تایید و زمان بارگیری را با شما هماهنگ خواهند کرد 🙏`,
      { inline_keyboard: replyRows }
    );
  }

  public verifyWebAppInitData(initDataRaw: string): {
    valid: boolean;
    user?: { id: number; first_name?: string; last_name?: string; username?: string };
    error?: string;
  } {
    if (!this.config.botToken) {
      return { valid: false, error: 'توکن ربات در سرور تنظیم نشده است.' };
    }
    try {
      const params = new URLSearchParams(initDataRaw);
      const hash = params.get('hash');
      if (!hash) {
        return { valid: false, error: 'امضای امنیتی Telegram initData یافت نشد.' };
      }
      params.delete('hash');
      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');

      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(this.config.botToken).digest();
      const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      if (computedHash !== hash) {
        return { valid: false, error: 'عدم تطابق امضای امنیتی تلگرام.' };
      }
      const userRaw = params.get('user');
      const parsedUser = userRaw ? JSON.parse(userRaw) : undefined;
      return { valid: true, user: parsedUser };
    } catch {
      return { valid: false, error: 'خطا در بررسی داده تلگرام.' };
    }
  }

  public registerRoutes(app: Express): void {
    app.get('/api/telegram/status', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.json({ status: this.getStatus() });
    });

    app.post('/api/telegram/configure', async (req: Request, res: Response) => {
      try {
        const body = req.body || {};
        const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
        const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
          .split(',')[0]
          .trim();
        const inferredOrigin =
          forwardedHost && !forwardedHost.startsWith('127.0.0.1') && !forwardedHost.startsWith('localhost')
            ? `${forwardedProto || 'https'}://${forwardedHost}`
            : '';

        const result = await this.configureAndStart({
          botToken: typeof body.botToken === 'string' ? body.botToken : undefined,
          webAppUrl:
            typeof body.webAppUrl === 'string' && body.webAppUrl.trim()
              ? body.webAppUrl.trim()
              : inferredOrigin || undefined,
          mode: body.mode === 'webhook' ? 'webhook' : body.mode === 'polling' ? 'polling' : undefined,
          adminChatId: typeof body.adminChatId === 'string' ? body.adminChatId : undefined,
          storageChatId: typeof body.storageChatId === 'string' ? body.storageChatId : undefined,
          enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
        });
        res.status(result.ok ? 200 : 400).json(result);
      } catch (err: any) {
        res.status(500).json({
          ok: false,
          status: this.getStatus(),
          message: err?.message || 'خطا در پیکربندی ربات تلگرام',
        });
      }
    });

    app.post('/api/telegram/claim-polling', async (_req: Request, res: Response) => {
      try {
        const result = await this.claimPolling();
        res.status(result.ok ? 200 : 400).json(result);
      } catch (err: any) {
        res.status(500).json({
          ok: false,
          status: this.getStatus(),
          message: err?.message || 'خطا در انتقال دریافت پیام‌ها به این محیط',
        });
      }
    });

    app.post('/api/telegram/sync-state', async (req: Request, res: Response) => {
      try {
        const { settings, productOverrides, orders } = req.body || {};
        if (this.deps.onClientSyncState) {
          await this.deps.onClientSyncState({ settings, productOverrides, orders });
        } else {
          this.syncStoreSnapshot({ settings, productOverrides, orders });
        }
        res.json({ ok: true, status: this.getStatus() });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'خطا در همگام‌سازی ربات' });
      }
    });

    app.post('/api/telegram/notify-order', async (req: Request, res: Response) => {
      try {
        const { order, telegramUserId } = req.body || {};
        if (!order || !order.orderNumber) {
          res.status(400).json({ ok: false, error: 'اطلاعات سفارش نامعتبر است.' });
          return;
        }
        await this.notifyNewOrder(order as CustomerOrder, typeof telegramUserId === 'number' ? telegramUserId : undefined);
        res.json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'خطا در ارسال اعلان سفارش تلگرام' });
      }
    });

    app.post('/api/telegram/test-admin-message', async (_req: Request, res: Response) => {
      const result = await this.sendTestAdminMessage();
      res.status(result.ok ? 200 : 400).json(result);
    });

    app.post('/api/telegram/stop', async (_req: Request, res: Response) => {
      const status = await this.stopBot(true);
      res.json({ ok: true, status, message: 'ربات تلگرام موقتاً متوقف شد.' });
    });

    app.post('/api/telegram/verify-webapp', (req: Request, res: Response) => {
      const { initData } = req.body || {};
      if (!initData || typeof initData !== 'string') {
        res.status(400).json({ valid: false, error: 'initData الزامی است.' });
        return;
      }
      res.json(this.verifyWebAppInitData(initData));
    });

    app.get('/api/telegram/verified-phones', (_req: Request, res: Response) => {
      const phones = Object.entries(this.userPhones).map(([telegramUserId, rec]) => ({
        telegramUserId,
        phoneNumber: rec.phoneNumber,
        fullName: rec.fullName || '',
        username: rec.username || '',
        updatedAt: rec.updatedAt,
      }));
      res.json({ ok: true, phones });
    });

    app.post('/api/telegram/webapp-phone', (req: Request, res: Response) => {
      const { initData, telegramUserId } = req.body || {};
      let resolvedUserId: string | null = null;

      if (typeof initData === 'string' && initData.trim()) {
        const verified = this.verifyWebAppInitData(initData.trim());
        if (verified.valid && verified.user?.id) {
          resolvedUserId = String(verified.user.id);
        } else if (typeof telegramUserId === 'number' || typeof telegramUserId === 'string') {
          const candidate = String(telegramUserId).trim();
          if (/^\d{4,20}$/.test(candidate)) {
            resolvedUserId = candidate;
          }
        }
      } else if (typeof telegramUserId === 'number' || typeof telegramUserId === 'string') {
        const candidate = String(telegramUserId).trim();
        if (/^\d{4,20}$/.test(candidate)) {
          resolvedUserId = candidate;
        }
      }

      if (!resolvedUserId) {
        res.json({ ok: true, phoneNumber: '', fullName: '', username: '', telegramUserId: '' });
        return;
      }

      const record = this.userPhones[resolvedUserId];
      res.json({
        ok: true,
        phoneNumber: record?.phoneNumber || '',
        fullName: record?.fullName || '',
        username: record?.username || '',
        telegramUserId: record ? resolvedUserId : '',
      });
    });

    app.post('/api/telegram/save-webapp-phone', (req: Request, res: Response) => {
      const { initData, telegramUserId, phoneNumber, fullName, username } = req.body || {};
      let resolvedUserId: string | null = null;
      let resolvedFullName = typeof fullName === 'string' ? fullName.trim() : '';
      let resolvedUsername = typeof username === 'string' ? username.trim() : '';

      if (typeof initData === 'string' && initData.trim()) {
        const verified = this.verifyWebAppInitData(initData.trim());
        if (verified.valid && verified.user?.id) {
          resolvedUserId = String(verified.user.id);
          resolvedFullName =
            resolvedFullName ||
            [verified.user.first_name, verified.user.last_name].filter(Boolean).join(' ').trim();
          resolvedUsername = resolvedUsername || verified.user.username || '';
        }
      }
      if (!resolvedUserId && (typeof telegramUserId === 'number' || typeof telegramUserId === 'string')) {
        const candidate = String(telegramUserId).trim();
        if (/^\d{4,20}$/.test(candidate)) {
          resolvedUserId = candidate;
        }
      }

      if (!resolvedUserId) {
        res.status(400).json({ ok: false, error: 'شناسه معتبر تلگرام برای ذخیره شماره یافت نشد.' });
        return;
      }

      const normalized = this.setVerifiedUserPhone(resolvedUserId, String(phoneNumber || ''), {
        fullName: resolvedFullName || undefined,
        username: resolvedUsername || undefined,
      });

      if (!normalized || normalized.length < 10) {
        res.status(400).json({ ok: false, error: 'شماره موبایل نامعتبر است.' });
        return;
      }

      const numericChatId = Number(resolvedUserId);
      if (Number.isFinite(numericChatId) && numericChatId > 0) {
        void this.syncUserChatMenuButton(numericChatId);
      }

      res.json({ ok: true, phoneNumber: normalized });
    });

    app.post('/api/telegram/webhook/:secret', async (req: Request, res: Response) => {
      const secretParam = req.params.secret;
      const secretHeader = String(req.headers['x-telegram-bot-api-secret-token'] || '');
      if (secretParam !== this.config.webhookSecret || (secretHeader && secretHeader !== this.config.webhookSecret)) {
        res.status(403).json({ ok: false });
        return;
      }
      res.status(200).json({ ok: true });
      await this.handleUpdate(req.body);
    });
  }
}

export function createTelegramStoreBotService(deps: TelegramBotServerDeps): TelegramStoreBotService {
  return new TelegramStoreBotService(deps);
}
