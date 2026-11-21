import { StoreProduct, VoiceClip } from '../types/storefront';
import { GoldenTipItem } from '../data/agriculturalGoldenTips';
import { parseJsonResponseSafe } from './safeFetchJson';
import { formatDeviceDateTime } from './deviceTime';
import { resolveApiUrl } from './apiBase';

const IDB_NAME = 'safari_biotech_voice_cache_v1';
const IDB_STORE = 'clips';
const VOICE_INDEX_CACHE_KEY = 'safari_voice_clip_index_v1';
const VOICE_INDEX_TTL_MS = 10 * 60 * 1000; // 10 minutes metadata index cache

export type VoiceClipIndexEntry = {
  kind: 'product' | 'tip' | 'weather';
  targetId: string;
  scriptText: string;
  updatedAt: string;
  telegramFileId?: string;
  source?: 'telegram' | 'cloud' | 'local';
};

export const VOICE_CLIP_UPDATED_EVENT = 'safari_voice_clip_updated';

export async function saveVoiceClipToTelegramDb(
  clip: VoiceClip,
  skipMasterPin = false
): Promise<{ ok: boolean; telegramFileId?: string; deduplicated?: boolean; error?: string }> {
  try {
    const resp = await fetch(resolveApiUrl('/api/telegram/db/voice-clip'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clip, skipMasterPin }),
    });
    const parsed = await parseJsonResponseSafe<{
      ok?: boolean;
      telegramFileId?: string;
      deduplicated?: boolean;
      error?: string;
    }>(resp, 'خطا در ذخیره فایل صوتی در تلگرام');
    return {
      ok: Boolean(parsed.ok && parsed.data?.ok),
      telegramFileId: parsed.data?.telegramFileId,
      deduplicated: parsed.data?.deduplicated,
      error: parsed.data?.error || parsed.errorMessage,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'خطا در ارتباط با سرویس تلگرام' };
  }
}

async function fetchVoiceClipFromTelegramDb(clipId: string): Promise<VoiceClip | null> {
  try {
    const resp = await fetch(resolveApiUrl(`/api/telegram/db/voice-clip/${encodeURIComponent(clipId)}`));
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    if (data?.ok && data?.clip && data.clip.audioBase64) {
      return data.clip as VoiceClip;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchVoiceIndexFromTelegramDb(): Promise<Record<string, VoiceClipIndexEntry>> {
  try {
    const resp = await fetch(resolveApiUrl('/api/telegram/db/voice-index'));
    if (!resp.ok) return {};
    const data = await resp.json().catch(() => null);
    if (data?.ok && data?.entries && typeof data.entries === 'object') {
      return data.entries as Record<string, VoiceClipIndexEntry>;
    }
    return {};
  } catch {
    return {};
  }
}

export function buildProductVoiceClipId(productId: string): string {
  return `prod_${productId}`.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
}

export function buildTipVoiceClipId(tipId: string): string {
  return `tip_${tipId}`.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
}

export function buildWeatherVoiceClipId(cityOrDefault = 'general'): string {
  const safe = (cityOrDefault || 'general')
    .replace(/[\u0600-\u06FF\s]+/g, (m) => {
      // Deterministic lightweight ASCII slug for Persian city names + general key
      let hash = 0;
      for (let i = 0; i < m.length; i++) {
        hash = (hash * 31 + m.charCodeAt(i)) >>> 0;
      }
      return `c${hash.toString(36)}`;
    })
    .replace(/[^a-zA-Z0-9_\-]/g, '_');
  return `weather_${safe || 'general'}`.slice(0, 128);
}

/**
 * Generates a 100% product-specific, natural conversational Persian introduction script
 * tailored strictly to this product's own category, description, highlights, and specifications.
 */
export function buildProductSpecificVoiceScript(prod: StoreProduct): string {
  if (prod.voiceIntroText && prod.voiceIntroText.trim().length >= 20) {
    return prod.voiceIntroText.trim();
  }

  const cleanHighlight1 = (prod.highlights?.[0] || '')
    .replace(/pH/gi, 'میزان اسیدیته')
    .replace(/EC/gi, 'شوری خاک')
    .replace(/%/g, ' درصد')
    .trim();
  const cleanHighlight2 = (prod.highlights?.[1] || '')
    .replace(/pH/gi, 'میزان اسیدیته')
    .replace(/EC/gi, 'شوری خاک')
    .replace(/%/g, ' درصد')
    .trim();
  const cleanDesc = (prod.description || prod.tagline || '')
    .replace(/pH/gi, 'میزان اسیدیته')
    .replace(/EC/gi, 'شوری')
    .replace(/dS\/m/gi, 'دسی‌زیمنس بر متر')
    .replace(/C\/N/gi, 'نسبت کربن به ازت')
    .replace(/%/g, ' درصد')
    .trim();

  const availablePkgs = prod.packagingOptions
    .filter((p) => !p.isOutOfStock)
    .slice(0, 2)
    .map((p) => p.weightOrVolume)
    .join(' و ');

  const catSpecificTip: Record<string, string> = {
    vermicompost:
      'این ورمی‌کمپوست خالص را می‌توانید به صورت مستقیم در چالکود پای درخت یا مخلوط با خاک گلدان استفاده کنید تا جذب ریشه به حداکثر برسد.',
    compost:
      'به دلیل پاستوریزه شدن در دمای بالا، این کمپوست بدون بذر علف هرز بوده و برای اصلاح بافت خاک‌های رسی و شنی در فصل آماده‌سازی زمین فوق‌العاده است.',
    liquid:
      'این عصاره مایع صددرصد محلول است و می‌توانید بدون نگرانی از گرفتگی نازل‌ها، در آبیاری قطره‌ای یا محلول‌پاشی برگی به کار ببرید.',
    mineral:
      'زئولیت شکری با جذب نمک و سدیم اضافی آب و خاک، ریشه را از سوختگی نجات داده و ماندگاری رطوبت پای گیاه را افزایش می‌دهد.',
    substrate:
      'این بستر سبک و بافرشده با تهویه عالی، انتخاب ایده‌آلی برای گیاهان حساس آپارتمانی، ارکیده، بلوبری و سالن‌های پرورش قارچ است.',
    starter:
      'این کرم‌های خاکی زنده به همراه بستر مادری غنی و کوکون فراوان با بسته‌بندی هوادهی‌شده به صورت زنده به سراسر کشور ارسال می‌شوند.',
  };

  const closingGuidance =
    catSpecificTip[prod.category] ||
    (cleanDesc ? cleanDesc.split('۔')[0].split('.')[0] + '.' : 'هم‌اکنون با تضمین کیفیت مستقیم از کارگاه مهندس صفری قابل سفارش است.');

  const parts = [
    `سلام و درود خدمت شما همراه گرامی فروشگاه مهندس صفری.`,
    `معرفی محصول «${prod.name}» از دسته ${prod.categoryLabel}.`,
    cleanDesc ? `${cleanDesc.slice(0, 220)}.` : '',
    cleanHighlight1
      ? `از ویژگی‌های شاخص این محصول می‌توان به ${cleanHighlight1}${cleanHighlight2 ? ' و ' + cleanHighlight2 : ''} اشاره کرد.`
      : '',
    closingGuidance,
    availablePkgs ? `این محصول هم‌اکنون در بسته‌بندی‌های ${availablePkgs} آماده ثبت سفارش است.` : '',
  ].filter(Boolean);

  return parts.join(' ');
}

export function buildTipVoiceScript(tip: GoldenTipItem): string {
  const stepsText = tip.steps.slice(0, 3).join(' سپس ');
  return [
    `نکته طلایی ${tip.categoryLabel}: ${tip.title}.`,
    tip.summary,
    `ترفند تخصصی کارگاه مهندس صفری: ${tip.goldenTrick}`,
    stepsText ? `مراحل اجرا: ${stepsText}` : '',
    `نکته احتیاطی مهم: ${tip.commonMistake}`,
  ]
    .filter(Boolean)
    .join(' ');
}

function openClipsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function getLocalCachedVoiceClip(clipId: string): Promise<VoiceClip | null> {
  try {
    const db = await openClipsDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(clipId);
      req.onsuccess = () => resolve((req.result as VoiceClip) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getAllLocalCachedVoiceClips(): Promise<VoiceClip[]> {
  try {
    const db = await openClipsDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result) ? (req.result as VoiceClip[]) : [];
        resolve(list.filter((c) => Boolean(c && c.id && c.audioBase64)));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function setLocalCachedVoiceClip(clip: VoiceClip): Promise<void> {
  try {
    const db = await openClipsDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(clip);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore storage quota failures
  }
}

export function normalizeCleanBase64(raw: string): string {
  return String(raw || '')
    .replace(/^data:[^;]+;base64,/i, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .trim();
}

/**
 * Fetches a pre-generated Base64 voice clip strictly from local IndexedDB device cache first.
 * Only downloads from Telegram Cloud DB if the clip has NEVER been opened/cached on this device,
 * or if a newer expectedUpdatedAt timestamp explicitly differs from the cached copy.
 */
export async function resolvePreGeneratedVoiceClip(
  clipId: string,
  expectedUpdatedAt?: string
): Promise<VoiceClip | null> {
  const local = await getLocalCachedVoiceClip(clipId);
  if (local && local.audioBase64) {
    const hasExplicitNewerVersion =
      Boolean(expectedUpdatedAt) &&
      Boolean(local.updatedAt) &&
      local.updatedAt !== expectedUpdatedAt;
    if (!hasExplicitNewerVersion) {
      return local;
    }
  }

  // Primary Cloud Source: Telegram Cloud DB (no daily read quota limits!)
  try {
    const tgClip = await fetchVoiceClipFromTelegramDb(clipId);
    if (tgClip && tgClip.audioBase64) {
      await setLocalCachedVoiceClip(tgClip);
      upsertLocalVoiceClipIndexEntry(tgClip);
      return tgClip;
    }
  } catch {
    // fall through
  }

  if (local && local.audioBase64) {
    return local;
  }
  return null;
}

/**
 * Generates (via AI TTS) or uploads a compact audio clip and persists it permanently in Telegram Cloud DB + IndexedDB
 */
export async function generateAndPersistVoiceClip(params: {
  clipId: string;
  kind: 'product' | 'tip' | 'weather';
  targetId: string;
  productName: string;
  categoryLabel?: string;
  tagline?: string;
  description?: string;
  highlights?: string[];
  specs?: { label: string; value: string }[];
  priceSummary?: string;
  customScriptText: string;
}): Promise<VoiceClip> {
  const resp = await fetch(resolveApiUrl('/api/ai/product-voice'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: params.targetId,
      productName: params.productName,
      categoryLabel: params.categoryLabel,
      tagline: params.tagline,
      description: params.description,
      highlights: params.highlights,
      specs: params.specs,
      priceSummary: params.priceSummary,
      customScriptText: params.customScriptText,
      mode: params.kind,
    }),
  });
  const parsed = await parseJsonResponseSafe<{
    audioBase64?: string;
    mimeType?: string;
    scriptText?: string;
    error?: string;
    code?: string;
    retryable?: boolean;
    retryAfterSec?: number;
  }>(
    resp,
    'سرویس تولید صدای هوش مصنوعی موقتاً شلوغ است یا در دسترس نیست؛ می‌توانید از گزینه «آپلود فایل صوتی MP3» استفاده کنید.'
  );
  const data = parsed.data;
  const audioBase64 = data?.audioBase64;
  if (!parsed.ok || !audioBase64) {
    const errObj = new Error(
      parsed.errorMessage ||
        'تولید فایل صوتی ابری موقتاً ممکن نشد؛ چند لحظه دیگر تلاش کنید یا فایل صوتی آپلود کنید.'
    ) as Error & { code?: string; retryable?: boolean; retryAfterSec?: number; httpStatus?: number };
    errObj.code = data?.code;
    errObj.retryable = data?.retryable ?? (resp.status === 429 || resp.status === 503 || resp.status === 502);
    errObj.retryAfterSec = data?.retryAfterSec;
    errObj.httpStatus = resp.status;
    throw errObj;
  }

  const cleanAudioBase64 = normalizeCleanBase64(audioBase64);
  if (!cleanAudioBase64 || cleanAudioBase64.length > 890000) {
    throw new Error('حجم کد صوتی تولیدشده بیش از سقف مجاز پایگاه داده است؛ لطفاً متن معرفی را کوتاه‌تر کنید.');
  }

  const nowStr = formatDeviceDateTime(new Date());
  const clip: VoiceClip = {
    id: params.clipId,
    kind: params.kind,
    targetId: params.targetId,
    scriptText: typeof data?.scriptText === 'string' && data.scriptText.trim() ? data.scriptText.trim() : params.customScriptText,
    audioBase64: cleanAudioBase64,
    mimeType: data?.mimeType || 'audio/mpeg',
    updatedAt: nowStr,
    updatedAtMs: Date.now(),
  };

  await setLocalCachedVoiceClip(clip);
  upsertLocalVoiceClipIndexEntry(clip);
  await saveVoiceClipToTelegramDb(clip, false).catch(() => null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VOICE_CLIP_UPDATED_EVENT, { detail: { clipId: clip.id, kind: clip.kind, targetId: clip.targetId } }));
  }
  return clip;
}

export async function saveUploadedVoiceClip(params: {
  clipId: string;
  kind: 'product' | 'tip' | 'weather';
  targetId: string;
  scriptText: string;
  audioBase64: string;
  mimeType: string;
}): Promise<VoiceClip> {
  const cleanAudioBase64 = normalizeCleanBase64(params.audioBase64);
  if (!cleanAudioBase64 || cleanAudioBase64.length > 880000) {
    throw new Error('حجم فایل صوتی نباید بیش از ۶۵۰ کیلوبایت باشد (لطفاً فایل MP3 فشرده‌تر انتخاب کنید).');
  }
  const nowStr = formatDeviceDateTime(new Date());
  const clip: VoiceClip = {
    id: params.clipId,
    kind: params.kind,
    targetId: params.targetId,
    scriptText: params.scriptText,
    audioBase64: cleanAudioBase64,
    mimeType: params.mimeType || 'audio/mpeg',
    updatedAt: nowStr,
    updatedAtMs: Date.now(),
  };
  await setLocalCachedVoiceClip(clip);
  upsertLocalVoiceClipIndexEntry(clip);
  await saveVoiceClipToTelegramDb(clip, false).catch(() => null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VOICE_CLIP_UPDATED_EVENT, { detail: { clipId: clip.id, kind: clip.kind, targetId: clip.targetId } }));
  }
  return clip;
}

function readCachedVoiceIndex(): { fetchedAtMs: number; entries: Record<string, VoiceClipIndexEntry> } | null {
  try {
    const raw = localStorage.getItem(VOICE_INDEX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.entries && typeof parsed.entries === 'object') {
      return {
        fetchedAtMs: Number(parsed.fetchedAtMs || 0),
        entries: parsed.entries as Record<string, VoiceClipIndexEntry>,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeCachedVoiceIndex(entries: Record<string, VoiceClipIndexEntry>, fetchedAtMs = Date.now()) {
  try {
    localStorage.setItem(VOICE_INDEX_CACHE_KEY, JSON.stringify({ fetchedAtMs, entries }));
  } catch {
    // ignore
  }
}

export function upsertLocalVoiceClipIndexEntry(clip: Pick<VoiceClip, 'id' | 'kind' | 'targetId' | 'scriptText' | 'updatedAt'>) {
  const cached = readCachedVoiceIndex();
  const next: Record<string, VoiceClipIndexEntry> = {
    ...(cached?.entries || {}),
    [clip.id]: {
      kind: clip.kind,
      targetId: clip.targetId,
      scriptText: clip.scriptText || '',
      updatedAt: clip.updatedAt || '',
    },
  };
  writeCachedVoiceIndex(next, cached?.fetchedAtMs || Date.now());
}

export function readLocalReadyVoiceClipIndex(): Record<string, VoiceClipIndexEntry> {
  return readCachedVoiceIndex()?.entries || {};
}

export function writeVoiceClipIndexFromBootstrap(entries: Record<string, VoiceClipIndexEntry>): void {
  if (!entries || typeof entries !== 'object') return;
  const cached = readCachedVoiceIndex();
  const merged = { ...(cached?.entries || {}), ...entries };
  writeCachedVoiceIndex(merged, Date.now());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VOICE_CLIP_UPDATED_EVENT, { detail: { source: 'telegram-bootstrap' } }));
  }
}

export async function fetchReadyVoiceClipIndex(forceRefresh = false): Promise<Record<string, VoiceClipIndexEntry>> {
  const cached = readCachedVoiceIndex();
  const isFresh = cached && Date.now() - cached.fetchedAtMs < VOICE_INDEX_TTL_MS;

  if (!forceRefresh && isFresh) {
    return cached.entries;
  }

  let merged: Record<string, VoiceClipIndexEntry> = { ...(cached?.entries || {}) };

  // Sole Cloud Index: Telegram Cloud DB (fast & unlimited)
  const tgEntries = await fetchVoiceIndexFromTelegramDb();
  if (Object.keys(tgEntries).length > 0) {
    merged = { ...merged, ...tgEntries };
  }

  if (Object.keys(merged).length > 0) {
    writeCachedVoiceIndex(merged, Date.now());
  }
  return merged;
}

export function base64AudioToBlobUrl(audioBase64: string, mimeType = 'audio/mpeg'): string {
  const clean = normalizeCleanBase64(audioBase64);
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

function normalizeAudioFileExtension(mimeType = 'audio/mpeg'): string {
  const mime = String(mimeType || 'audio/mpeg').toLowerCase();
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  return 'mp3';
}

function stripInvisibleAndNormalizeText(raw: string): string {
  return String(raw || '')
    // Replace ZWNJ/ZWJ/NBSP with space so compound Persian words remain separated cleanly
    .replace(/[\u200C\u200D\u00A0]+/g, ' ')
    // Strip control chars, bidi controls, zero-width spaces, variation selectors, and Arabic diacritics
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B\u200E\u200F\u2028-\u202F\u2060-\u206F\uFE00-\uFE0F\uFEFF\u064B-\u065F\u0670]/g, '')
    // Normalize Arabic forms to standard Persian letters
    .replace(/\u0643/g, '\u06A9') // ك -> ک
    .replace(/\u064A/g, '\u06CC') // ي -> ی
    .replace(/\u0649/g, '\u06CC') // ى -> ی
    .replace(/\u06C0/g, '\u0647'); // ۀ -> ه
}

function truncateByCodepointsAndUtf8Bytes(input: string, maxChars: number, maxBytes: number): string {
  let chars = 0;
  let bytes = 0;
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) || 0;
    const chBytes = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (chars + 1 > maxChars || bytes + chBytes > maxBytes) {
      break;
    }
    out += ch;
    chars += 1;
    bytes += chBytes;
  }
  return out;
}

export function buildPersianVoiceDownloadName(
  kind: 'product' | 'tip' | 'weather',
  persianTitle?: string | null
): string {
  const cleanTitle = stripInvisibleAndNormalizeText(persianTitle || '')
    .replace(/[\\/:*?"<>|()[\]{}+.,،؛!؟]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (kind === 'product') {
    return cleanTitle ? `معرفی-صوتی-${cleanTitle}` : 'معرفی-صوتی-محصول';
  }
  if (kind === 'tip') {
    return cleanTitle ? `نکته-طلایی-${cleanTitle}` : 'نکته-طلایی-باغبانی';
  }
  return cleanTitle || 'گزارش-هواشناسی-کشاورزی';
}

export function sanitizeDownloadFileSegment(
  rawName: string,
  fallback = 'صوت-کارگاه-صفری',
  maxLength = 72
): string {
  const cleanFallback =
    stripInvisibleAndNormalizeText(fallback)
      .replace(/[^\u0621-\u064A\u0660-\u0669\u067E\u0686\u0698\u06A9\u06AF\u06CC\u06F0-\u06F9a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[.\-_]+|[.\-_]+$/g, '') || 'safari-audio';

  const sanitized = stripInvisibleAndNormalizeText(rawName || '')
    // Whitelist strictly safe Persian/Arabic base letters, digits, ASCII alphanumerics, '-', '_'
    .replace(/[^\u0621-\u064A\u0660-\u0669\u067E\u0686\u0698\u06A9\u06AF\u06CC\u06F0-\u06F9a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/_+/g, '_')
    .replace(/^[.\-_]+|[.\-_]+$/g, '');

  let bounded = truncateByCodepointsAndUtf8Bytes(sanitized, maxLength, 140)
    .replace(/^[.\-_]+|[.\-_]+$/g, '');

  if (!bounded || bounded === '.' || bounded === '..') {
    bounded = cleanFallback;
  }

  // Avoid Windows/DOS reserved filenames rejected by File System Access API
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(bounded)) {
    bounded = `clip-${bounded}`;
  }

  return bounded || 'safari-audio';
}

export function getAudioExtensionFromMime(mimeType = 'audio/mpeg'): string {
  return normalizeAudioFileExtension(mimeType);
}

export function base64AudioToBlob(
  audioBase64: string,
  mimeType = 'audio/mpeg'
): { blob: Blob; mime: string; ext: string } {
  const mime = mimeType || 'audio/mpeg';
  const clean = normalizeCleanBase64(audioBase64);
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mime });
  return { blob, mime, ext: getAudioExtensionFromMime(mime) };
}

export function supportsDirectoryPicker(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  );
}

function buildStrictAsciiFallbackFileName(rawBase: string, ext: string): string {
  let hash = 0;
  for (let i = 0; i < rawBase.length; i++) {
    hash = (hash * 31 + rawBase.charCodeAt(i)) >>> 0;
  }
  const asciiPart = stripInvisibleAndNormalizeText(rawBase)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 32);
  const suffix = hash.toString(36) || Date.now().toString(36);
  const base = asciiPart ? `safari-${asciiPart}-${suffix}` : `safari-voice-${suffix}`;
  return `${base}.${ext}`;
}

export async function writeVoiceClipToDirectoryHandle(
  rootDirHandle: FileSystemDirectoryHandle,
  clip: { audioBase64: string; mimeType?: string },
  fileBaseName: string,
  optionalSubfolders: string[] = []
): Promise<string> {
  const { blob, ext } = base64AudioToBlob(clip.audioBase64, clip.mimeType || 'audio/mpeg');
  const safeBase = sanitizeDownloadFileSegment(fileBaseName, 'safari-voice', 72);
  let safeFileName = `${safeBase}.${ext}`;

  // Ensure readwrite permission is active if handle came from earlier selection
  const permHandle = rootDirHandle as FileSystemDirectoryHandle & {
    queryPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  };
  if (typeof permHandle.queryPermission === 'function') {
    const state = await permHandle.queryPermission({ mode: 'readwrite' });
    if (state !== 'granted' && typeof permHandle.requestPermission === 'function') {
      await permHandle.requestPermission({ mode: 'readwrite' });
    }
  }

  let targetDir = rootDirHandle;
  for (const folder of optionalSubfolders) {
    const safeFolder = sanitizeDownloadFileSegment(folder, '', 48);
    if (safeFolder && safeFolder !== 'safari-audio') {
      try {
        targetDir = await targetDir.getDirectoryHandle(safeFolder, { create: true });
      } catch {
        // Fallback to rootDirHandle if OS/browser rejects nested subfolder creation
        targetDir = rootDirHandle;
        break;
      }
    }
  }

  let fileHandle: FileSystemFileHandle;
  try {
    fileHandle = await targetDir.getFileHandle(safeFileName, { create: true });
  } catch (err) {
    // If Chromium/OS still rejects any character in the Persian filename, retry with a guaranteed safe ASCII filename
    const fallbackName = buildStrictAsciiFallbackFileName(fileBaseName, ext);
    try {
      fileHandle = await targetDir.getFileHandle(fallbackName, { create: true });
      safeFileName = fallbackName;
    } catch {
      fileHandle = await rootDirHandle.getFileHandle(fallbackName, { create: true });
      safeFileName = fallbackName;
      void err;
    }
  }

  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return safeFileName;
}

export function downloadVoiceClipAudio(
  clip: { audioBase64: string; mimeType?: string },
  fileBaseName: string,
  optionalFolderPrefix?: string
): string {
  const { mime, ext } = base64AudioToBlob(clip.audioBase64, clip.mimeType || 'audio/mpeg');
  const safeBase = sanitizeDownloadFileSegment(fileBaseName, 'صوت-کارگاه-صفری', 72);
  const prefix = optionalFolderPrefix
    ? sanitizeDownloadFileSegment(optionalFolderPrefix, '', 36)
    : '';
  const finalBase = prefix && prefix !== 'safari-audio' ? `${prefix}-${safeBase}` : safeBase;
  const fullFileName = `${finalBase}.${ext}`;
  const url = base64AudioToBlobUrl(clip.audioBase64, mime);
  const a = document.createElement('a');
  a.href = url;
  a.download = fullFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return fullFileName;
}
