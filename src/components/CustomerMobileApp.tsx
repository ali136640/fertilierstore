import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Volume2,
  Square,
  Loader2,
  Send,
  Bot,
  Truck,
  Headphones,
  ShieldCheck,
  Award,
  PackageCheck,
  ArrowUp,
  Phone,
  MapPin,
  Clock,
  Smartphone,
  ChevronLeft,
  Mail,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Printer,
  FileText,
  X,
  Copy,
  Check,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { StoreProduct, PackageOption, CartItem, CustomerOrder, UserAccount, OrderStatus, WorkshopStoreSettings } from '../types/storefront';
import { getStoreProducts } from '../data/storefrontProducts';
import { getProductImageSrc } from '../data/productDefaultImages';
import {
  loadCustomerOrders,
  saveCustomerOrder,
  loadProductOverrides,
  loadStoreSettings,
  loadUserAccounts,
  setCurrentUser,
  saveUserAccount,
  normalizeDigits,
  mergeProductsWithOverrides,
  resolveProductBaseUnitPrice,
  syncFromTelegramCloudDb,
  DB_SYNC_EVENT
} from '../utils/storeStorage';
import { COMPREHENSIVE_PLANT_PROFILES, searchPlantProfiles } from '../data/plantProfiles';
import { IRAN_PROVINCES, resolveManagerProvinceCity } from '../data/iranCities';
import { getCurrentPersianDate } from '../data/vermicompostData';
import {
  AGRICULTURAL_GOLDEN_TIPS,
  TIP_CATEGORIES,
  SEASONAL_GOLDEN_CALENDAR,
  GoldenTipItem,
  TipCategory,
} from '../data/agriculturalGoldenTips';
import { AuthModal } from './AuthModal';
import { IranLocationSelector } from './IranLocationSelector';
import { StoreSealBadge } from './StoreSealBadge';
import { AgriculturalWeatherWidget } from './AgriculturalWeatherWidget';
import {
  buildProductVoiceClipId,
  buildTipVoiceClipId,
  buildProductSpecificVoiceScript,
  buildTipVoiceScript,
  resolvePreGeneratedVoiceClip,
  base64AudioToBlobUrl,
  readLocalReadyVoiceClipIndex,
  VOICE_CLIP_UPDATED_EVENT,
} from '../utils/voiceClipStorage';
import { resolveApiUrl, resolveAssetOrApiUrl, buildGithubPagesUrl, normalizeBaseUrl } from '../utils/apiBase';
import {
  resolveDeviceCachedImageUrl,
  markProductOpened,
  markDeviceCompletedInitialPreload,
} from '../utils/mediaCache';
import {
  CONSULTANT_FAQ_CATEGORIES,
  CONSULTANT_FAQ_ITEMS,
  ConsultantFaqCategory,
} from '../data/consultantFaq';
import { CORE_APP_VERSION } from '../config/coreAppManifest';
import { parseJsonResponseSafe } from '../utils/safeFetchJson';
import { formatDeviceDate, useDeviceClock } from '../utils/deviceTime';
import {
  resolveTelegramOrUrlLaunchTarget,
  getTelegramCustomerProfile,
  getCachedTelegramPhone,
  resolveTelegramUserPhoneFromServer,
  syncTelegramPhoneToServer,
  requestTelegramMiniAppContact,
  canRequestTelegramMiniAppContact,
  isInsideTelegramWebApp,
  triggerTelegramHaptic,
  notifyServerTelegramNewOrder,
} from '../utils/telegramWebApp';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  warmCacheCatalogAssets,
  recordOfflineVisitedPage,
  readOfflineCatalogMeta,
  OfflineCatalogSnapshotMeta,
} from '../utils/offlineCatalogCache';

function canonicalizePhoneNumber(raw?: string): string {
  const cleaned = normalizeDigits(String(raw || '')).replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+98')) {
    const rest = cleaned.slice(3).replace(/^0+/, '');
    return rest.startsWith('9') ? `0${rest}` : rest;
  }
  if (cleaned.startsWith('0098')) {
    const rest = cleaned.slice(4).replace(/^0+/, '');
    return rest.startsWith('9') ? `0${rest}` : rest;
  }
  if (cleaned.startsWith('98') && cleaned.length >= 12) {
    const rest = cleaned.slice(2).replace(/^0+/, '');
    return rest.startsWith('9') ? `0${rest}` : rest;
  }
  if (cleaned.startsWith('9') && cleaned.length === 10) {
    return `0${cleaned}`;
  }
  return cleaned.replace(/^\+/, '');
}

function computeShippingEstimate(
  totalWeightKg: number,
  subtotalToman: number,
  deliveryMethod: CustomerOrder['deliveryMethod'],
  settings: WorkshopStoreSettings
): { shippingEstimate: number; freeShippingApplied: boolean } {
  const smallFee = settings.shippingSmallFee ?? 180000;
  const mediumBaseFee = settings.shippingMediumBaseFee ?? 450000;
  const tonFee = settings.shippingTonFee ?? 1500000;
  const freeThreshold = settings.freeShippingThresholdToman ?? 0;

  if (totalWeightKg <= 0) {
    return { shippingEstimate: 0, freeShippingApplied: false };
  }
  if (deliveryMethod === 'pickup_factory') {
    return { shippingEstimate: 0, freeShippingApplied: false };
  }
  if (freeThreshold > 0 && subtotalToman >= freeThreshold) {
    return { shippingEstimate: 0, freeShippingApplied: true };
  }
  if (totalWeightKg < 100) {
    return { shippingEstimate: smallFee, freeShippingApplied: false };
  }
  if (totalWeightKg < 1000) {
    return { shippingEstimate: mediumBaseFee + Math.round(totalWeightKg * 200), freeShippingApplied: false };
  }
  const tons = totalWeightKg / 1000;
  return { shippingEstimate: Math.round(tonFee * Math.ceil(tons)), freeShippingApplied: false };
}

function formatDeliveryMethodFa(method?: CustomerOrder['deliveryMethod'] | string): string {
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

const ORDER_PIPELINE_STEPS: { status: Exclude<OrderStatus, 'cancelled'>; label: string; shortLabel: string }[] = [
  { status: 'registered', label: 'ثبت اولیه سفارش', shortLabel: 'ثبت سفارش' },
  { status: 'confirmed', label: 'تایید و صدور پیش‌فاکتور', shortLabel: 'صدور پیش‌فاکتور' },
  { status: 'processing', label: 'آماده‌سازی و بارگیری', shortLabel: 'بارگیری کارگاه' },
  { status: 'shipped', label: 'ارسال با باربری', shortLabel: 'ارسال باربری' },
  { status: 'delivered', label: 'تحویل نهایی خریدار', shortLabel: 'تحویل نهایی' },
];

function getOrderStageMeta(status: OrderStatus): {
  stepIndex: number;
  label: string;
  hint: string;
  badgeClass: string;
  surfaceAccent: string;
} {
  switch (status) {
    case 'registered':
      return {
        stepIndex: 0,
        label: 'در انتظار بررسی و تایید کارگاه',
        hint: 'سفارش شما ثبت شد و پیش‌فاکتور اولیه آماده بررسی کارشناسان فروش است.',
        badgeClass: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700',
        surfaceAccent: 'from-amber-500/15 via-transparent to-emerald-500/10',
      };
    case 'confirmed':
      return {
        stepIndex: 1,
        label: 'تایید و صدور پیش‌فاکتور فروش',
        hint: 'پیش‌فاکتور فروش با مهر کارگاه تایید شده و سفارش وارد صف بسته‌بندی می‌شود.',
        badgeClass: 'bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-300 border-sky-300 dark:border-sky-700',
        surfaceAccent: 'from-sky-500/15 via-transparent to-emerald-500/10',
      };
    case 'processing':
      return {
        stepIndex: 2,
        label: 'در حال آماده‌سازی و بارگیری کیسه‌ها',
        hint: 'اقلام سفارش شما در کارگاه مهندس صفری توزین، پلمپ و آماده تحویل به ناوگان حمل است.',
        badgeClass: 'bg-violet-100 dark:bg-violet-950/60 text-violet-900 dark:text-violet-300 border-violet-300 dark:border-violet-700',
        surfaceAccent: 'from-violet-500/15 via-transparent to-emerald-500/10',
      };
    case 'shipped':
      return {
        stepIndex: 3,
        label: 'ارسال‌شده (تحویل باربری / در مسیر)',
        hint: 'محموله از کارگاه خارج شده و از طریق باربری در مسیر مقصد شما قرار دارد.',
        badgeClass: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700',
        surfaceAccent: 'from-indigo-500/15 via-transparent to-emerald-500/10',
      };
    case 'delivered':
      return {
        stepIndex: 4,
        label: 'تحویل نهایی گردید ✓',
        hint: 'سفارش با موفقیت تحویل خریدار شد. پیش‌فاکتور و رسید قابل چاپ در دسترس است.',
        badgeClass: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
        surfaceAccent: 'from-emerald-500/20 via-transparent to-teal-500/10',
      };
    case 'cancelled':
      return {
        stepIndex: -1,
        label: 'لغو شده',
        hint: 'این سفارش لغو شده است. برای ثبت مجدد می‌توانید از سبد خرید اقدام کنید.',
        badgeClass: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700',
        surfaceAccent: 'from-rose-500/15 via-transparent to-stone-500/10',
      };
    default:
      return {
        stepIndex: 0,
        label: 'در حال پیگیری',
        hint: 'وضعیت سفارش توسط واحد فروش در حال پیگیری است.',
        badgeClass: 'bg-stone-100 text-stone-800 border-stone-300',
        surfaceAccent: 'from-stone-500/10 via-transparent to-emerald-500/10',
      };
  }
}

function CachedProductImage({
  product,
  className,
  onClick,
}: {
  product: StoreProduct;
  className?: string;
  onClick?: () => void;
}) {
  const rawSrc = getProductImageSrc(product);
  const [resolvedSrc, setResolvedSrc] = useState<string>(rawSrc);

  useEffect(() => {
    let active = true;
    setResolvedSrc(rawSrc);
    resolveDeviceCachedImageUrl(rawSrc).then((cachedUrl) => {
      if (active && cachedUrl) {
        setResolvedSrc(cachedUrl);
      }
    });
    return () => {
      active = false;
    };
  }, [rawSrc]);

  return (
    <img
      src={resolvedSrc}
      alt={product.name}
      referrerPolicy="no-referrer"
      onClick={onClick}
      className={className}
    />
  );
}

const CUSTOMER_CART_STORAGE_KEY = 'safari_customer_cart_v1';

interface CustomerMobileAppProps {
  currentVermiPricePerKg?: number;
  currentUser: UserAccount | null;
  onUserChange: (user: UserAccount | null) => void;
  onOpenAdminPanel?: () => void;
  onOpenInstallModal?: () => void;
  isMobilePreview?: boolean;
  onToggleMobilePreview?: () => void;
  isDark?: boolean;
  themeMode?: 'system' | 'light' | 'dark';
  onToggleTheme?: () => void;
  onChangeThemeMode?: (mode: 'system' | 'light' | 'dark') => void;
}

export function CustomerMobileApp({
  currentVermiPricePerKg = 24000,
  currentUser,
  onUserChange,
  onOpenAdminPanel,
  onOpenInstallModal,
  isMobilePreview = false,
  onToggleMobilePreview,
  isDark = false,
  themeMode = 'system',
  onToggleTheme,
  onChangeThemeMode,
}: CustomerMobileAppProps) {
  // Storefront navigation tab: 'catalog' | 'calculator' | 'tips' | 'weather' | 'cart' | 'orders' | 'profile'
  const [mobileTab, setMobileTab] = useState<'catalog' | 'calculator' | 'tips' | 'weather' | 'cart' | 'orders' | 'profile'>(
    () => resolveTelegramOrUrlLaunchTarget().tab || 'catalog'
  );
  const deviceClock = useDeviceClock(1000);
  const { isOnline } = useOnlineStatus();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [catalogSort, setCatalogSort] = useState<'default' | 'price_asc' | 'price_desc'>('default');
  const [copiedPaymentField, setCopiedPaymentField] = useState<'card' | 'iban' | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [guestOrderLookupInput, setGuestOrderLookupInput] = useState<string>('');
  const [guestOrderLookupQuery, setGuestOrderLookupQuery] = useState<string>('');
  const [offlineMeta, setOfflineMeta] = useState<OfflineCatalogSnapshotMeta>(() => readOfflineCatalogMeta());
  const [isRefreshingOfflineCache, setIsRefreshingOfflineCache] = useState<boolean>(false);

  // Golden Tips Page & Virtual Consultant Chat State
  const [tipCategory, setTipCategory] = useState<'all' | TipCategory>('all');
  const [tipSearchQuery, setTipSearchQuery] = useState<string>('');
  const [expandedTipId, setExpandedTipId] = useState<string | null>(AGRICULTURAL_GOLDEN_TIPS[0]?.id || null);

  interface ConsultantMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: string;
  }
  const [consultantMessages, setConsultantMessages] = useState<ConsultantMessage[]>([
    {
      id: 'welcome-safari',
      role: 'assistant',
      text: 'سلام و درود! من مهندس صفری هستم، مشاور تخصصی زیست‌فناوری، خاک‌شناسی و تغذیه باغ و گیاهان آپارتمانی. هر سوالی درباره میزان مصرف ورمیکمپوست، چالکود پاییزه، زمان سمپاشی، شوری خاک یا گیاهان آپارتمانی دارید بفرمایید تا بر اساس دیتای علمی کارگاه راهنمایی‌تان کنم.',
      timestamp: 'اکنون',
    },
  ]);
  const [consultantInput, setConsultantInput] = useState<string>('');
  const [isConsultantLoading, setIsConsultantLoading] = useState<boolean>(false);
  const [consultantError, setConsultantError] = useState<string | null>(null);
  const consultantSectionRef = useRef<HTMLDivElement | null>(null);
  const goldenTipsSectionRef = useRef<HTMLDivElement | null>(null);
  const consultantInputRef = useRef<HTMLInputElement | null>(null);
  const consultantChatEndRef = useRef<HTMLDivElement | null>(null);
  const [tipsSectionFocus, setTipsSectionFocus] = useState<'all' | 'consultant' | 'golden_tips'>('all');
  const [faqCategoryFilter, setFaqCategoryFilter] = useState<ConsultantFaqCategory>('all');
  const [selectedFaqId, setSelectedFaqId] = useState<string>(CONSULTANT_FAQ_ITEMS[0]?.id || '');

  const filteredFaqItems = useMemo(() => {
    if (faqCategoryFilter === 'all') return CONSULTANT_FAQ_ITEMS;
    return CONSULTANT_FAQ_ITEMS.filter((item) => item.category === faqCategoryFilter);
  }, [faqCategoryFilter]);

  const selectedFaqItem = useMemo(() => {
    return (
      filteredFaqItems.find((item) => item.id === selectedFaqId) ||
      filteredFaqItems[0] ||
      CONSULTANT_FAQ_ITEMS[0]
    );
  }, [filteredFaqItems, selectedFaqId]);

  useEffect(() => {
    if (filteredFaqItems.length > 0 && !filteredFaqItems.some((item) => item.id === selectedFaqId)) {
      setSelectedFaqId(filteredFaqItems[0].id);
    }
  }, [filteredFaqItems, selectedFaqId]);

  // Reactive store settings, products, and customer orders
  const [storeSettings, setStoreSettings] = useState<WorkshopStoreSettings>(() => loadStoreSettings());
  const [productOverrides, setProductOverrides] = useState<Record<string, Partial<StoreProduct>>>(() => loadProductOverrides());
  const [allOrders, setAllOrders] = useState<CustomerOrder[]>(() => loadCustomerOrders());

  useEffect(() => {
    markDeviceCompletedInitialPreload(storeSettings.coreAppVersion || CORE_APP_VERSION);
  }, [storeSettings.coreAppVersion]);

  const handleCopyPaymentField = (field: 'card' | 'iban', value: string) => {
    const cleaned = value.trim();
    if (!cleaned) return;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(cleaned).catch(() => {});
    }
    triggerTelegramHaptic('light');
    setCopiedPaymentField(field);
    setTimeout(() => setCopiedPaymentField((prev) => (prev === field ? null : prev)), 2200);
  };
  
  // Unified persistent Cart state (collects all chosen products into a single order)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore invalid cache
    }
    return [];
  });
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOMER_CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  // Modals & Sliding Product Drawer
  const [detailProduct, setDetailProduct] = useState<StoreProduct | null>(null);
  const [drawerQuickBuyOpen, setDrawerQuickBuyOpen] = useState<boolean>(false);
  const [drawerQuickQty, setDrawerQuickQty] = useState<number>(1);
  const [drawerQuickSubmitting, setDrawerQuickSubmitting] = useState<boolean>(false);
  const [drawerQuickError, setDrawerQuickError] = useState<string | null>(null);
  const [drawerQuickOrderResult, setDrawerQuickOrderResult] = useState<CustomerOrder | null>(null);
  const [drawerRequestingTgPhone, setDrawerRequestingTgPhone] = useState<boolean>(false);
  const drawerQuickFormRef = useRef<HTMLFormElement | null>(null);

  const openProductDrawer = (prod: StoreProduct, quickBuy = false) => {
    markProductOpened(prod.id);
    triggerTelegramHaptic('light');
    setDetailProduct(prod);
    setDrawerQuickQty(1);
    setDrawerQuickError(null);
    setDrawerQuickOrderResult(null);
    setDrawerQuickBuyOpen(quickBuy);
  };

  const closeProductDrawer = () => {
    setDetailProduct(null);
    setDrawerQuickBuyOpen(false);
    setDrawerQuickError(null);
  };

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [submittedOrder, setSubmittedOrder] = useState<CustomerOrder | null>(null);
  const [viewingOrderReceipt, setViewingOrderReceipt] = useState<CustomerOrder | null>(null);

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthInitialMode(mode);
    setIsAuthModalOpen(true);
  };

  // Listen for real-time DB sync events triggered when the manager updates products, stock, orders, or users
  useEffect(() => {
    const handleDbSync = () => {
      setStoreSettings(loadStoreSettings());
      setProductOverrides(loadProductOverrides());
      setAllOrders(loadCustomerOrders());
      if (!currentUser && isInsideTelegramWebApp()) {
        const tgProfile = getTelegramCustomerProfile();
        const tgCachedPhone = canonicalizePhoneNumber(getCachedTelegramPhone());
        const users = loadUserAccounts();
        const matched = users.find((u) => {
          if (u.role !== 'customer') return false;
          if (tgProfile?.id && u.telegramUserId === String(tgProfile.id)) return true;
          if (tgCachedPhone && canonicalizePhoneNumber(u.phoneNumber) === tgCachedPhone) return true;
          return false;
        });
        if (matched) {
          setCurrentUser(matched);
          onUserChange(matched);
        }
      }
    };
    window.addEventListener(DB_SYNC_EVENT, handleDbSync);
    return () => window.removeEventListener(DB_SYNC_EVENT, handleDbSync);
  }, [currentUser, onUserChange]);

  // Selected packaging per product (map of productId -> packageId)
  const [selectedPackageMap, setSelectedPackageMap] = useState<Record<string, string>>({});
  // Card quantity stepper state per product & 60% upgrade dismissal maps
  const [cardQtyMap, setCardQtyMap] = useState<Record<string, number>>({});
  const [dismissedCatalogUpgrade, setDismissedCatalogUpgrade] = useState<Record<string, string>>({});
  const [dismissedCartUpgrade, setDismissedCartUpgrade] = useState<Record<string, number>>({});

  // Product & Golden Tips Persian Male Intro Audio Player State
  const [activeVoiceProductId, setActiveVoiceProductId] = useState<string | null>(null);
  const [voiceLoadingProductId, setVoiceLoadingProductId] = useState<string | null>(null);
  const [voiceTranscriptMap, setVoiceTranscriptMap] = useState<Record<string, string>>({});
  const [voiceErrorMap, setVoiceErrorMap] = useState<Record<string, string>>({});
  const [activeTipVoiceId, setActiveTipVoiceId] = useState<string | null>(null);
  const [tipVoiceLoadingId, setTipVoiceLoadingId] = useState<string | null>(null);
  const [tipVoiceErrorMap, setTipVoiceErrorMap] = useState<Record<string, string>>({});
  const [readyVoiceClips, setReadyVoiceClips] = useState<
    Record<string, { kind: 'product' | 'tip' | 'weather'; targetId: string; scriptText: string; updatedAt: string }>
  >({});

  const voiceCacheRef = useRef<Map<string, { audioUrl: string; scriptText: string }>>(new Map());
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const refreshLocalVoiceIndex = () => {
      // Strictly read already-opened clips cached on this device (zero Firestore network reads at startup)
      setReadyVoiceClips(readLocalReadyVoiceClipIndex());
    };
    const cacheMap = voiceCacheRef.current;
    const handleVoiceClipUpdated = () => {
      cacheMap.forEach((entry) => {
        try {
          URL.revokeObjectURL(entry.audioUrl);
        } catch {
          // ignore
        }
      });
      cacheMap.clear();
      refreshLocalVoiceIndex();
    };
    refreshLocalVoiceIndex();
    window.addEventListener(VOICE_CLIP_UPDATED_EVENT, handleVoiceClipUpdated);

    return () => {
      window.removeEventListener(VOICE_CLIP_UPDATED_EVENT, handleVoiceClipUpdated);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      cacheMap.forEach((entry) => {
        try {
          URL.revokeObjectURL(entry.audioUrl);
        } catch {
          // ignore
        }
      });
      cacheMap.clear();
    };
  }, []);

  const stopActiveVoice = () => {
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      audioPlayerRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setActiveVoiceProductId(null);
    setActiveTipVoiceId(null);
  };

  const handleToggleProductVoice = async (prod: StoreProduct) => {
    if (activeVoiceProductId === prod.id) {
      stopActiveVoice();
      return;
    }
    markProductOpened(prod.id);
    stopActiveVoice();
    setVoiceErrorMap((prev) => {
      const next = { ...prev };
      delete next[prod.id];
      return next;
    });

    const specificScript = buildProductSpecificVoiceScript(prod);
    setVoiceTranscriptMap((prev) => ({ ...prev, [prod.id]: specificScript }));

    const clipId = buildProductVoiceClipId(prod.id);
    const expectedUpdatedAt = readyVoiceClips[clipId]?.updatedAt || prod.voiceUpdatedAt || '';
    const cacheKey = `prod:${prod.id}|${expectedUpdatedAt}|${specificScript}`;
    const cached = voiceCacheRef.current.get(cacheKey);

    const playAudioUrl = async (audioUrl: string, scriptText: string) => {
      if (scriptText) {
        setVoiceTranscriptMap((prev) => ({ ...prev, [prod.id]: scriptText }));
      }
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => {
        if (audioPlayerRef.current === audio) {
          audioPlayerRef.current = null;
          setActiveVoiceProductId(null);
        }
      };
      audio.onerror = () => {
        if (audioPlayerRef.current === audio) {
          audioPlayerRef.current = null;
          setActiveVoiceProductId(null);
        }
        setVoiceErrorMap((prev) => ({
          ...prev,
          [prod.id]: 'پخش صوت در مرورگر با خطا مواجه شد.',
        }));
      };
      setActiveVoiceProductId(prod.id);
      await audio.play();
    };

    if (cached) {
      try {
        await playAudioUrl(cached.audioUrl, cached.scriptText);
        return;
      } catch {
        // fallback below
      }
    }

    setVoiceLoadingProductId(prod.id);
    try {
      const preGenerated = await resolvePreGeneratedVoiceClip(clipId, expectedUpdatedAt || undefined);
      if (preGenerated && preGenerated.audioBase64) {
        const audioUrl = base64AudioToBlobUrl(
          preGenerated.audioBase64,
          preGenerated.mimeType || 'audio/mpeg'
        );
        const clipScript = preGenerated.scriptText?.trim() || specificScript;
        voiceCacheRef.current.set(cacheKey, { audioUrl, scriptText: clipScript });
        await playAudioUrl(audioUrl, clipScript);
        return;
      }

      // Playback-only in Customer Panel: never synthesize/generate voice on the customer side
      throw new Error('فایل صوتی معرفی این محصول هنوز توسط مدیر تولید و در پایگاه داده ثبت نشده است.');
    } catch (err) {
      setVoiceErrorMap((prev) => ({
        ...prev,
        [prod.id]: err instanceof Error ? err.message : 'خطا در دریافت فایل صوتی محصول از پایگاه داده',
      }));
    } finally {
      setVoiceLoadingProductId((prev) => (prev === prod.id ? null : prev));
    }
  };

  const handleToggleTipVoice = async (tip: GoldenTipItem) => {
    if (activeTipVoiceId === tip.id) {
      stopActiveVoice();
      return;
    }
    stopActiveVoice();
    setTipVoiceErrorMap((prev) => {
      const next = { ...prev };
      delete next[tip.id];
      return next;
    });

    const tipScript = buildTipVoiceScript(tip);
    const clipId = buildTipVoiceClipId(tip.id);
    const expectedUpdatedAt = readyVoiceClips[clipId]?.updatedAt || '';
    const cacheKey = `tip:${tip.id}|${expectedUpdatedAt}`;
    const cached = voiceCacheRef.current.get(cacheKey);

    const playTipUrl = async (audioUrl: string) => {
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => {
        if (audioPlayerRef.current === audio) {
          audioPlayerRef.current = null;
          setActiveTipVoiceId(null);
        }
      };
      audio.onerror = () => {
        if (audioPlayerRef.current === audio) {
          audioPlayerRef.current = null;
          setActiveTipVoiceId(null);
        }
        setTipVoiceErrorMap((prev) => ({
          ...prev,
          [tip.id]: 'پخش صوت با خطا مواجه شد.',
        }));
      };
      setActiveTipVoiceId(tip.id);
      await audio.play();
    };

    if (cached) {
      try {
        await playTipUrl(cached.audioUrl);
        return;
      } catch {
        // fallback below
      }
    }

    setTipVoiceLoadingId(tip.id);
    try {
      const preGenerated = await resolvePreGeneratedVoiceClip(clipId, expectedUpdatedAt || undefined);
      if (preGenerated && preGenerated.audioBase64) {
        const audioUrl = base64AudioToBlobUrl(
          preGenerated.audioBase64,
          preGenerated.mimeType || 'audio/mpeg'
        );
        voiceCacheRef.current.set(cacheKey, {
          audioUrl,
          scriptText: preGenerated.scriptText || tipScript,
        });
        await playTipUrl(audioUrl);
        return;
      }

      // Playback-only in Customer Panel: never synthesize/generate voice on the customer side
      throw new Error('فایل صوتی این نکته هنوز توسط مدیر تولید و در پایگاه داده ثبت نشده است.');
    } catch (err) {
      setTipVoiceErrorMap((prev) => ({
        ...prev,
        [tip.id]: err instanceof Error ? err.message : 'خطا در دریافت فایل صوتی نکته از پایگاه داده',
      }));
    } finally {
      setTipVoiceLoadingId((prev) => (prev === tip.id ? null : prev));
    }
  };

  // Checkout & Customer Location fields (never inherit Admin's workshop city such as Firoozkooh)
  const initialCustomerProvince =
    currentUser?.role === 'customer' && currentUser.province?.trim()
      ? currentUser.province.trim()
      : 'تهران';
  const initialCustomerCity =
    currentUser?.role === 'customer' && currentUser.city?.trim()
      ? currentUser.city.trim()
      : 'تهران';

  const [checkoutName, setCheckoutName] = useState(
    () =>
      currentUser?.role === 'customer'
        ? currentUser.fullName || ''
        : getTelegramCustomerProfile()?.fullName || ''
  );
  const [checkoutPhone, setCheckoutPhone] = useState(
    () =>
      currentUser?.role === 'customer'
        ? currentUser.phoneNumber || ''
        : getCachedTelegramPhone() || ''
  );
  const [checkoutProvince, setCheckoutProvince] = useState(initialCustomerProvince);
  const [checkoutCity, setCheckoutCity] = useState(initialCustomerCity);
  const [checkoutAddress, setCheckoutAddress] = useState(
    currentUser?.role === 'customer' ? currentUser.address || '' : ''
  );
  const [checkoutFarmingType, setCheckoutFarmingType] = useState<CustomerOrder['farmingType']>('orchard');
  const [checkoutDeliveryMethod, setCheckoutDeliveryMethod] = useState<CustomerOrder['deliveryMethod']>('freight_terminal');
  const [checkoutNotes, setCheckoutNotes] = useState('');

  // Resolve verified Telegram phone early on Mini App mount so Login/Register and Checkout prefill instantaneously,
  // and if customer is already logged in via Telegram, link their Telegram profile to Firestore automatically
  useEffect(() => {
    if (!isInsideTelegramWebApp()) return;
    let cancelled = false;
    const tgProfile = getTelegramCustomerProfile();

    if (currentUser?.role === 'customer') {
      const needsTelegramLink =
        !currentUser.telegramLinked ||
        (tgProfile?.id && currentUser.telegramUserId !== String(tgProfile.id)) ||
        (tgProfile?.username && currentUser.telegramUsername !== tgProfile.username);

      if (needsTelegramLink) {
        const updatedUser: UserAccount = {
          ...currentUser,
          telegramLinked: true,
          ...(tgProfile?.id ? { telegramUserId: String(tgProfile.id) } : {}),
          ...(tgProfile?.username ? { telegramUsername: tgProfile.username } : {}),
          ...(tgProfile?.fullName ? { telegramFullName: tgProfile.fullName } : {}),
        };
        setCurrentUser(updatedUser);
        onUserChange(updatedUser);
        void saveUserAccount(updatedUser);
      }
      if (currentUser.phoneNumber) {
        void syncTelegramPhoneToServer(currentUser.phoneNumber, currentUser.fullName, tgProfile?.username);
      }
      return;
    }

    void resolveTelegramUserPhoneFromServer().then((resolved) => {
      if (cancelled) return;
      const resolvedPhone = resolved.phoneNumber ? canonicalizePhoneNumber(resolved.phoneNumber) : '';
      if (resolved.phoneNumber) {
        setCheckoutPhone((prev) => (prev.trim() ? prev : resolved.phoneNumber));
      }
      if (resolved.fullName) {
        setCheckoutName((prev) => (prev.trim() ? prev : resolved.fullName));
      }

      // Auto-sign-in customer if they already registered/ordered via Telegram Bot using this Telegram ID or phone
      const users = loadUserAccounts();
      const matchedAccount = users.find((u) => {
        if (u.role !== 'customer') return false;
        if (tgProfile?.id && u.telegramUserId === String(tgProfile.id)) return true;
        if (resolvedPhone && canonicalizePhoneNumber(u.phoneNumber) === resolvedPhone) return true;
        return false;
      });
      if (matchedAccount) {
        setCurrentUser(matchedAccount);
        onUserChange(matchedAccount);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser, onUserChange]);

  // Auto-sync checkout & weather location strictly from registered CUSTOMER account (never Admin's Firoozkooh)
  useEffect(() => {
    if (!currentUser) return;
    setCheckoutError(null);
    if (currentUser.role === 'customer') {
      if (currentUser.fullName) setCheckoutName(currentUser.fullName);
      if (currentUser.phoneNumber) setCheckoutPhone(currentUser.phoneNumber);
      if (currentUser.province?.trim()) setCheckoutProvince(currentUser.province.trim());
      if (currentUser.city?.trim()) setCheckoutCity(currentUser.city.trim());
      if (currentUser.address?.trim()) setCheckoutAddress(currentUser.address.trim());
      if (
        currentUser.farmingType &&
        ['orchard', 'houseplants', 'greenhouse', 'farming', 'industrial'].includes(currentUser.farmingType)
      ) {
        setCheckoutFarmingType(currentUser.farmingType as CustomerOrder['farmingType']);
      }
    }
  }, [currentUser]);

  const adminResolvedLocation = useMemo(
    () => resolveManagerProvinceCity(storeSettings, currentUser),
    [storeSettings, currentUser]
  );

  const customerWeatherProvince = useMemo(() => {
    if (currentUser?.role === 'admin') {
      return adminResolvedLocation.province;
    }
    if (currentUser?.role === 'customer' && currentUser.province?.trim()) {
      return currentUser.province.trim();
    }
    return checkoutProvince || 'تهران';
  }, [currentUser, adminResolvedLocation.province, checkoutProvince]);

  const customerWeatherCity = useMemo(() => {
    if (currentUser?.role === 'admin') {
      return adminResolvedLocation.city;
    }
    if (currentUser?.role === 'customer' && currentUser.city?.trim()) {
      return currentUser.city.trim();
    }
    return checkoutCity || 'تهران';
  }, [currentUser, adminResolvedLocation.city, checkoutCity]);

  const openConsultantChat = () => {
    setMobileTab('tips');
    setTipsSectionFocus('consultant');
    setTimeout(() => {
      consultantSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      consultantInputRef.current?.focus();
    }, 120);
  };

  // Dynamic app branding & feature flags from Admin Settings
  const appLogoSrc = resolveAssetOrApiUrl(storeSettings.appLogoDataUrl, 'pwa-192x192.png');
  const activePublicSiteUrl =
    normalizeBaseUrl(storeSettings.telegramWebAppUrl) ||
    (storeSettings.githubPagesEnabled
      ? buildGithubPagesUrl({
          owner: storeSettings.githubOwner,
          repo: storeSettings.githubRepo,
          customDomain: storeSettings.githubCustomDomain,
        })
      : '') ||
    (typeof window !== 'undefined' && window.location.origin.startsWith('https://')
      ? window.location.origin
      : '');
  const calculatorEnabled = storeSettings.enableCalculator ?? true;
  const showStockCount = storeSettings.showStockCountToCustomers ?? true;

  useEffect(() => {
    if (!calculatorEnabled && mobileTab === 'calculator') {
      setMobileTab('catalog');
    }
  }, [calculatorEnabled, mobileTab]);

  // ===================== ADVANCED CALCULATOR STATE =====================
  const [calcPlantCategory, setCalcPlantCategory] = useState<string>('all');
  const [calcSearchQuery, setCalcSearchQuery] = useState<string>('');
  const [selectedPlantId, setSelectedPlantId] = useState<string>('tree-pistachio');
  // Keep raw string input so deleting digits yields "0" instead of snapping back to "1"
  const [calcUnitsInput, setCalcUnitsInput] = useState<string>('100');
  const [calcTreeAgeInput, setCalcTreeAgeInput] = useState<string>('5');
  const [calcStrategy, setCalcStrategy] = useState<'smart_auto' | 'combo' | 'vermi_only' | 'trio_houseplant'>('smart_auto');
  const [calcGrowthStage, setCalcGrowthStage] = useState<'young' | 'mature' | 'veteran'>('mature');
  const [calcSoilCondition, setCalcSoilCondition] = useState<'normal' | 'saline_heavy'>('normal');

  const calcUnitsCount = useMemo(() => {
    const cleaned = normalizeDigits(calcUnitsInput).replace(/[^\d]/g, '');
    if (!cleaned) return 0;
    const parsed = parseInt(cleaned, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [calcUnitsInput]);

  const handleCalcUnitsChange = (rawValue: string) => {
    const cleaned = normalizeDigits(rawValue).replace(/[^\d]/g, '');
    if (cleaned === '') {
      setCalcUnitsInput('0');
      return;
    }
    const stripped = cleaned.replace(/^0+(?=\d)/, '');
    setCalcUnitsInput(stripped || '0');
  };

  const calcTreeAgeYears = useMemo(() => {
    const cleaned = normalizeDigits(calcTreeAgeInput).replace(/[^\d]/g, '');
    if (!cleaned) return 0;
    const parsed = parseInt(cleaned, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.min(120, parsed) : 0;
  }, [calcTreeAgeInput]);

  const handleCalcTreeAgeChange = (rawValue: string) => {
    const cleaned = normalizeDigits(rawValue).replace(/[^\d]/g, '');
    if (cleaned === '') {
      setCalcTreeAgeInput('0');
      return;
    }
    const stripped = cleaned.replace(/^0+(?=\d)/, '');
    setCalcTreeAgeInput(stripped || '0');
  };

  // Matching plants from comprehensive library
  const matchedPlants = useMemo(() => {
    return searchPlantProfiles(calcSearchQuery, calcPlantCategory);
  }, [calcSearchQuery, calcPlantCategory]);

  // Keep selectedPlantId synced when category or search filters change
  useEffect(() => {
    if (matchedPlants.length > 0 && !matchedPlants.some(p => p.id === selectedPlantId)) {
      setSelectedPlantId(matchedPlants[0].id);
    }
  }, [matchedPlants, selectedPlantId]);

  // Currently selected plant
  const currentPlant = useMemo(() => {
    return COMPREHENSIVE_PLANT_PROFILES.find(p => p.id === selectedPlantId) || matchedPlants[0] || COMPREHENSIVE_PLANT_PROFILES[0];
  }, [selectedPlantId, matchedPlants]);

  // Auto-update recommended strategy when customer changes tree/plant selection
  useEffect(() => {
    setCalcStrategy('smart_auto');
  }, [currentPlant.id]);

  // Load products merged with any overrides & custom catalog items from admin panel
  const products = useMemo(() => {
    return mergeProductsWithOverrides(getStoreProducts(currentVermiPricePerKg), productOverrides);
  }, [currentVermiPricePerKg, productOverrides]);

  // Keep open product detail modal live-synced whenever product prices/stock update
  const activeDetailProduct = useMemo(() => {
    if (!detailProduct) return null;
    return products.find((p) => p.id === detailProduct.id) || detailProduct;
  }, [detailProduct, products]);

  // Warm PWA offline caches for products/images and record every visited tab/product view
  useEffect(() => {
    if (!isOnline || products.length === 0) return;
    let active = true;
    void warmCacheCatalogAssets(products).then((meta) => {
      if (active && meta) setOfflineMeta(meta);
    });
    return () => {
      active = false;
    };
  }, [products, isOnline]);

  useEffect(() => {
    let active = true;
    void recordOfflineVisitedPage(mobileTab, activeDetailProduct?.id).then((meta) => {
      if (active && meta) setOfflineMeta(meta);
    });
    return () => {
      active = false;
    };
  }, [mobileTab, activeDetailProduct?.id]);

  // Keep existing cart item prices & package metadata automatically aligned with latest catalog updates
  useEffect(() => {
    setCart((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((item) => {
        const latestProd = products.find((p) => p.id === item.product.id);
        if (!latestProd) return item;
        const latestPkg = latestProd.packagingOptions.find((pkg) => pkg.id === item.selectedPackage.id);
        if (!latestPkg) return item;
        const nextUnitPrice = latestPkg.priceToman;
        const nextTotalPrice = nextUnitPrice * item.quantity;
        if (
          item.unitPrice !== nextUnitPrice ||
          item.totalPrice !== nextTotalPrice ||
          item.selectedPackage.title !== latestPkg.title ||
          item.selectedPackage.weightOrVolume !== latestPkg.weightOrVolume ||
          item.selectedPackage.isOutOfStock !== latestPkg.isOutOfStock ||
          item.product.name !== latestProd.name ||
          item.product.inStock !== latestProd.inStock
        ) {
          changed = true;
          return {
            ...item,
            product: latestProd,
            selectedPackage: latestPkg,
            unitPrice: nextUnitPrice,
            totalPrice: nextTotalPrice,
          };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [products]);

  // Dynamic catalog category pills synchronized with admin product categories
  const catalogCategories = useMemo(() => {
    const catMap = new Map<string, string>();
    products.forEach((p) => {
      if (p.category && !catMap.has(p.category)) {
        catMap.set(p.category, p.categoryLabel || p.category);
      }
    });
    return [
      { id: 'all', label: 'همه محصولات' },
      ...Array.from(catMap.entries()).map(([id, label]) => ({ id, label })),
    ];
  }, [products]);

  // Load orders for current customer (or verified guest lookup match when opened outside Telegram)
  const customerOrders = useMemo(() => {
    if (currentUser) {
      if (currentUser.role === 'admin') {
        return allOrders;
      }
      const userCanonPhone = canonicalizePhoneNumber(currentUser.phoneNumber);
      return allOrders.filter(
        (o) =>
          o.customerId === currentUser.id ||
          (userCanonPhone.length >= 9 && canonicalizePhoneNumber(o.phoneNumber) === userCanonPhone)
      );
    }

    const q = guestOrderLookupQuery.trim();
    if (!q) return [];
    const canonQ = canonicalizePhoneNumber(q);
    const upperQ = q.toUpperCase();
    return allOrders.filter((o) => {
      if (canonQ.length >= 10 && canonicalizePhoneNumber(o.phoneNumber) === canonQ) {
        return true;
      }
      if (upperQ.length >= 6 && o.orderNumber.toUpperCase() === upperQ) {
        return true;
      }
      return false;
    });
  }, [currentUser, allOrders, submittedOrder, guestOrderLookupQuery]);

  const handleSendConsultantMessage = async (customText?: string) => {
    const textToSend = (customText ?? consultantInput).trim();
    if (!textToSend || isConsultantLoading) return;

    setConsultantError(null);
    if (!customText) setConsultantInput('');

    const userMsg: ConsultantMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: deviceClock.timeStr,
    };
    const nextHistory = [...consultantMessages, userMsg];
    setConsultantMessages(nextHistory);

    if (!isOnline) {
      const localPlant = COMPREHENSIVE_PLANT_PROFILES.find(
        (pl) => textToSend.includes(pl.name) || pl.name.includes(textToSend)
      );
      const localTip = AGRICULTURAL_GOLDEN_TIPS.find(
        (t) =>
          textToSend.includes(t.title.split(' ')[0]) ||
          t.title.includes(textToSend.slice(0, 6)) ||
          t.summary.includes(textToSend.slice(0, 6))
      );
      const offlineReply = [
        'در حال حاضر به اینترنت متصل نیستید؛ بر اساس دانش‌نامه آفلاین کارگاه مهندس صفری:',
        localPlant
          ? `🌱 گیاه ${localPlant.name}: ${localPlant.scientificDose.instructions} (بهترین زمان: ${localPlant.scientificDose.bestMonthsFa})`
          : null,
        localTip
          ? `💡 ${localTip.title}: ${localTip.goldenTrick}`
          : null,
        !localPlant && !localTip
          ? 'می‌توانید از منوی سوالات پرتکرار بالا یا بخش «نکات طلایی» و «محاسبه کود» کاملاً آفلاین استفاده کنید. به محض اتصال اینترنت، مشاور آنلاین پاسخ دقیق‌تر ارسال می‌کند.'
          : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      setConsultantMessages((prev) => [
        ...prev,
        {
          id: `a-off-${Date.now()}`,
          role: 'assistant',
          text: offlineReply,
          timestamp: deviceClock.timeStr,
        },
      ]);
      return;
    }

    setIsConsultantLoading(true);

    setTimeout(() => {
      consultantChatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);

    try {
      const catalogSummary = products
        .filter((p) => !p.isDisabled)
        .slice(0, 8)
        .map((p) => {
          const minPrice = p.packagingOptions?.[0]?.priceToman || 0;
          return `${p.name} (${p.categoryLabel}، از ${minPrice.toLocaleString('fa-IR')} تومان)`;
        })
        .join(' | ');

      const matchedTips = AGRICULTURAL_GOLDEN_TIPS.filter(
        (t) =>
          textToSend.includes(t.title.split(' ')[0]) ||
          t.goldenTrick.includes(textToSend.slice(0, 8)) ||
          t.category === 'soil_tricks'
      )
        .slice(0, 3)
        .map((t) => `${t.title}: ${t.goldenTrick}`)
        .join(' ؛ ');

      const matchedPlants = COMPREHENSIVE_PLANT_PROFILES.filter(
        (pl) => textToSend.includes(pl.name) || pl.name.includes(textToSend)
      )
        .slice(0, 3)
        .map((pl) => `${pl.name} (${pl.scientificDose.unitLabel})`)
        .join('، ');

      const resp = await fetch(resolveApiUrl('/api/ai/consultant-chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: nextHistory.slice(-8).map((m) => ({ role: m.role, text: m.text })),
          customerProfile: {
            fullName: currentUser?.role === 'customer' ? currentUser.fullName : undefined,
            province: customerWeatherProvince,
            city: customerWeatherCity,
            farmingType: checkoutFarmingType,
          },
          catalogSummary,
          plantKnowledgeSummary: [matchedPlants, matchedTips].filter(Boolean).join(' | '),
        }),
      });

      const parsed = await parseJsonResponseSafe<{ reply?: string; error?: string }>(
        resp,
        'خطا در دریافت پاسخ از مشاور هوشمند'
      );

      if (!parsed.ok || !parsed.data?.reply) {
        throw new Error(parsed.errorMessage || parsed.data?.error || 'دریافت پاسخ از مهندس صفری ناموفق بود.');
      }

      const aiMsg: ConsultantMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: parsed.data.reply,
        timestamp: deviceClock.timeStr,
      };
      setConsultantMessages((prev) => [...prev, aiMsg]);
      setTimeout(() => {
        consultantChatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    } catch (err) {
      setConsultantError(err instanceof Error ? err.message : 'خطای ارتباط با مشاور مجازی');
    } finally {
      setIsConsultantLoading(false);
    }
  };

  // Calculate cart totals (non-double-subtracting unit-price-based discounts + configurable shipping)
  const cartTotals = useMemo(() => {
    const totalItemsCount = cart.reduce((acc, it) => acc + it.quantity, 0);
    const totalWeightKg = cart.reduce((acc, it) => acc + (it.selectedPackage.nominalWeightKg * it.quantity), 0);
    const subtotalToman = cart.reduce((acc, it) => acc + it.totalPrice, 0);

    const originalSubtotalToman = cart.reduce((acc, it) => {
      const baseUnit = resolveProductBaseUnitPrice(it.product);
      const refFromUnit =
        baseUnit > 0 && it.selectedPackage.nominalWeightKg > 0
          ? Math.round(baseUnit * it.selectedPackage.nominalWeightKg)
          : 0;
      const origPerPkg = Math.max(
        it.unitPrice,
        it.selectedPackage.originalPriceToman || refFromUnit || (it.unitPrice + (it.selectedPackage.discountToman || 0))
      );
      return acc + origPerPkg * it.quantity;
    }, 0);

    const totalDiscountToman = Math.max(0, originalSubtotalToman - subtotalToman);

    // Shipping estimate (shared helper with Quick Buy Drawer)
    const { shippingEstimate, freeShippingApplied } = computeShippingEstimate(
      totalWeightKg,
      subtotalToman,
      checkoutDeliveryMethod,
      storeSettings
    );

    const finalPayableToman = Math.max(0, subtotalToman + shippingEstimate);

    return {
      totalItemsCount,
      totalWeightKg,
      originalSubtotalToman,
      subtotalToman,
      totalDiscountToman,
      shippingEstimate,
      freeShippingApplied,
      finalPayableToman,
    };
  }, [cart, checkoutDeliveryMethod, storeSettings]);

  // Handle packaging selection (prefer available packages when auto-picking default)
  const getSelectedPackage = (prod: StoreProduct): PackageOption => {
    const chosenId = selectedPackageMap[prod.id];
    if (chosenId) {
      const found = prod.packagingOptions.find(p => p.id === chosenId);
      if (found) return found;
    }
    const availPop = prod.packagingOptions.find(p => !p.isOutOfStock && p.isPopular);
    const firstAvail = prod.packagingOptions.find(p => !p.isOutOfStock);
    const pop = prod.packagingOptions.find(p => p.isPopular);
    return availPop || firstAvail || pop || prod.packagingOptions[0];
  };

  const handleSelectPackage = (productId: string, packageId: string) => {
    setSelectedPackageMap(prev => ({ ...prev, [productId]: packageId }));
  };

  // Smart 60% Next-Weight Tier Upgrade Helper
  const getNextPackageUpgradeSuggestion = (
    product: StoreProduct,
    currentPkg: PackageOption,
    quantity: number
  ) => {
    if (!currentPkg || currentPkg.nominalWeightKg <= 0 || quantity <= 0) return null;
    const availablePkgs = product.packagingOptions
      .filter((p) => !p.isOutOfStock && p.nominalWeightKg > 0)
      .sort((a, b) => a.nominalWeightKg - b.nominalWeightKg);
    const nextPkg = availablePkgs.find((p) => p.nominalWeightKg > currentPkg.nominalWeightKg);
    if (!nextPkg) return null;

    const requestedWeight = Math.round(quantity * currentPkg.nominalWeightKg * 100) / 100;
    if (requestedWeight < nextPkg.nominalWeightKg * 0.6) return null;

    const reachPercent = Math.round((requestedWeight / nextPkg.nominalWeightKg) * 100);
    const currentUnitCost = currentPkg.priceToman / currentPkg.nominalWeightKg;
    const nextUnitCost = nextPkg.priceToman / nextPkg.nominalWeightKg;
    const unitSavingToman = Math.max(0, Math.round(currentUnitCost - nextUnitCost));
    const unitSavingPercent =
      currentUnitCost > 0 && nextUnitCost < currentUnitCost
        ? Math.round(((currentUnitCost - nextUnitCost) / currentUnitCost) * 100)
        : 0;
    const suggestedNextQty =
      requestedWeight <= nextPkg.nominalWeightKg
        ? 1
        : Math.ceil(requestedWeight / nextPkg.nominalWeightKg);
    const upgradedWeight = Math.round(suggestedNextQty * nextPkg.nominalWeightKg * 100) / 100;
    const upgradedTotalPrice = suggestedNextQty * nextPkg.priceToman;
    const equivalentAtSmallRate = Math.round(upgradedWeight * currentUnitCost);
    const totalExtraProfitToman = Math.max(0, equivalentAtSmallRate - upgradedTotalPrice);

    return {
      nextPkg,
      requestedWeight,
      reachPercent,
      suggestedNextQty,
      upgradedWeight,
      upgradedTotalPrice,
      unitSavingToman,
      unitSavingPercent,
      totalExtraProfitToman,
    };
  };

  // Add to cart (guards both whole-product stock & per-package rate stock)
  const handleAddToCart = (product: StoreProduct, pkg?: PackageOption, qty = 1) => {
    if (!product.inStock || product.stockQuantity <= 0) {
      setCartNotice(`«${product.name}» در حال حاضر در انبار کارگاه ناموجود است.`);
      setTimeout(() => setCartNotice(null), 3000);
      return;
    }
    const chosenPackage = pkg || getSelectedPackage(product);
    if (chosenPackage.isOutOfStock) {
      setCartNotice(`نرخ و بسته «${chosenPackage.title || chosenPackage.weightOrVolume}» در حال حاضر ناموجود است.`);
      setTimeout(() => setCartNotice(null), 3000);
      return;
    }
    const cartItemId = `${product.id}-${chosenPackage.id}`;
    triggerTelegramHaptic('light');

    setCart(prev => {
      const existing = prev.find(it => it.id === cartItemId);
      if (existing) {
        return prev.map(it => it.id === cartItemId 
          ? { ...it, quantity: it.quantity + qty, totalPrice: (it.quantity + qty) * it.unitPrice }
          : it
        );
      } else {
        return [
          ...prev,
          {
            id: cartItemId,
            product,
            selectedPackage: chosenPackage,
            quantity: qty,
            unitPrice: chosenPackage.priceToman,
            totalPrice: chosenPackage.priceToman * qty,
          }
        ];
      }
    });

    setCartNotice(`«${chosenPackage.title}» (×${qty}) به سبد خرید اضافه شد`);
    setTimeout(() => setCartNotice(null), 2500);
  };

  // Upgrade an existing cart item from smaller package to next larger weight package
  const handleUpgradeCartItemPackage = (oldItemId: string, nextPkg: PackageOption, nextQty: number) => {
    setCart((prev) => {
      const oldItem = prev.find((it) => it.id === oldItemId);
      if (!oldItem) return prev;
      const newCartId = `${oldItem.product.id}-${nextPkg.id}`;
      const filtered = prev.filter((it) => it.id !== oldItemId);
      const existingTarget = filtered.find((it) => it.id === newCartId);
      if (existingTarget) {
        return filtered.map((it) =>
          it.id === newCartId
            ? {
                ...it,
                quantity: it.quantity + nextQty,
                totalPrice: (it.quantity + nextQty) * nextPkg.priceToman,
              }
            : it
        );
      }
      return [
        ...filtered,
        {
          id: newCartId,
          product: oldItem.product,
          selectedPackage: nextPkg,
          quantity: nextQty,
          unitPrice: nextPkg.priceToman,
          totalPrice: nextPkg.priceToman * nextQty,
        },
      ];
    });
    setCartNotice(`با سود بیشتر به «${nextPkg.title || nextPkg.weightOrVolume}» (×${nextQty}) ارتقاء یافت ✓`);
    setTimeout(() => setCartNotice(null), 3000);
  };

  // Cart quantity controls
  const handleUpdateCartQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(it => it.id !== itemId));
    } else {
      setCart(prev => prev.map(it => it.id === itemId 
        ? { ...it, quantity: newQty, totalPrice: newQty * it.unitPrice }
        : it
      ));
    }
  };

  // ===================== LIVE INVENTORY-AWARE SCIENTIFIC DOSAGE =====================
  const dosageResult = useMemo(() => {
    const dose = currentPlant.scientificDose;
    const isHouseplant = currentPlant.category === 'houseplants';
    const isGreenhouse = currentPlant.category === 'greenhouse';
    const isOrchard = currentPlant.category === 'orchard';

    // Tree-age-aware & stage multiplier
    const getOrchardAgeProfile = (age: number) => {
      if (age <= 0) return { mult: 0.35, label: 'کاشت نهال جدید (چاله‌نهال ۰ ساله)' };
      if (age === 1) return { mult: 0.45, label: 'نهال ۱ ساله (در حال استقرار ریشه)' };
      if (age === 2) return { mult: 0.55, label: 'نهال ۲ ساله' };
      if (age <= 4) return { mult: 0.75, label: `درخت جوان ${age.toLocaleString('fa-IR')} ساله (پیش‌باردهی)` };
      if (age <= 7) return { mult: 1.0, label: `درخت بالغ ${age.toLocaleString('fa-IR')} ساله (باردهی استاندارد)` };
      if (age <= 12) return { mult: 1.25, label: `درخت تنومند ${age.toLocaleString('fa-IR')} ساله (اوج باردهی)` };
      if (age <= 19) return { mult: 1.45, label: `درخت مسن ${age.toLocaleString('fa-IR')} ساله` };
      return { mult: 1.65, label: `درخت کهنسال ${age.toLocaleString('fa-IR')} ساله (تغذیه تقویتی سنگین)` };
    };

    const orchardAgeProfile = getOrchardAgeProfile(calcTreeAgeYears);

    const stageMultiplier = isOrchard
      ? orchardAgeProfile.mult
      : calcGrowthStage === 'young'
      ? isHouseplant ? 0.65 : 0.6
      : calcGrowthStage === 'veteran'
      ? isHouseplant ? 1.4 : 1.3
      : 1.0;

    // Salinity / heavy clay soil adjustment (boosts zeolite + organic buffer)
    const soilVermiFactor = calcSoilCondition === 'saline_heavy' ? 1.15 : 1.0;
    const soilZeoliteFactor = calcSoilCondition === 'saline_heavy' ? 1.5 : 1.0;

    // Live storefront inventory lookup (with category fallback for renamed/custom products)
    const findProd = (primaryId: string, fallbackCat: string) =>
      products.find(p => p.id === primaryId) ||
      products.find(p => p.category === fallbackCat && p.inStock && p.stockQuantity > 0) ||
      products.find(p => p.category === fallbackCat);

    const vermiProduct = findProd('prod-vermicompost-grade-a', 'vermicompost');
    const compostProduct = findProd('prod-traditional-compost', 'compost');
    const zeoliteProduct = findProd('prod-zeolite-sugar-mesh', 'mineral');
    const teaProduct = findProd('prod-worm-tea-liquid', 'liquid');
    const substrateProduct = findProd('prod-coffee-substrate', 'substrate');

    const isProdAvailable = (p?: StoreProduct) => Boolean(p && p.inStock && p.stockQuantity > 0);
    const vermiAvail = isProdAvailable(vermiProduct);
    const compostAvail = isProdAvailable(compostProduct);
    const zeoliteAvail = isProdAvailable(zeoliteProduct);
    const teaAvail = isProdAvailable(teaProduct);
    const substrateAvail = isProdAvailable(substrateProduct);

    // 1. Determine base scientific requirement per unit (kg / L)
    let perUnitVermiKg = 0;
    let perUnitCompostKg = 0;
    let perUnitZeoliteKg = 0;
    let perUnitLiquidL = 0;
    let perUnitSubstrateKg = 0;

    const effectiveStrategy =
      calcStrategy === 'smart_auto'
        ? isHouseplant
          ? 'trio_houseplant'
          : dose.comboStrategy === 'vermi_only'
          ? 'vermi_only'
          : 'combo'
        : calcStrategy;

    if (effectiveStrategy === 'vermi_only') {
      const pureMult = isHouseplant ? 1.2 : 1.45;
      perUnitVermiKg = (dose.vermiKgPerUnit || 5) * pureMult * stageMultiplier * soilVermiFactor;
      if (dose.zeoliteKgPerUnit || calcSoilCondition === 'saline_heavy') {
        perUnitZeoliteKg = (dose.zeoliteKgPerUnit || (isHouseplant ? 0.15 : 1.2)) * stageMultiplier * soilZeoliteFactor;
      }
      perUnitLiquidL = (dose.liquidTeaLiterPerUnit || 0) * stageMultiplier;
    } else if (effectiveStrategy === 'trio_houseplant' || (isHouseplant && effectiveStrategy === 'combo')) {
      perUnitVermiKg = (dose.vermiKgPerUnit || 0.25) * stageMultiplier * soilVermiFactor;
      perUnitSubstrateKg = (dose.substrateKgPerUnit || 0.5) * stageMultiplier;
      perUnitLiquidL = (dose.liquidTeaLiterPerUnit || 0.05) * stageMultiplier;
      if (calcSoilCondition === 'saline_heavy') {
        perUnitZeoliteKg = (dose.zeoliteKgPerUnit || 0.15) * stageMultiplier;
      }
    } else {
      perUnitVermiKg = (dose.vermiKgPerUnit || 4) * stageMultiplier * soilVermiFactor;
      perUnitCompostKg = (dose.compostKgPerUnit || (isGreenhouse ? 4 : 8)) * stageMultiplier;
      perUnitZeoliteKg = (dose.zeoliteKgPerUnit || 1.2) * stageMultiplier * soilZeoliteFactor;
      perUnitLiquidL = (dose.liquidTeaLiterPerUnit || 0.15) * stageMultiplier;
      if (dose.substrateKgPerUnit) {
        perUnitSubstrateKg = dose.substrateKgPerUnit * stageMultiplier;
      }
    }

    // 2. Smart Inventory-Aware Adaptation & Scientific Substitutions
    const adaptationNotes: string[] = [];

    if (perUnitCompostKg > 0 && !compostAvail) {
      if (vermiAvail) {
        const compensatedVermi = perUnitCompostKg * 0.42;
        perUnitVermiKg += compensatedVermi;
        if (zeoliteAvail) perUnitZeoliteKg += perUnitCompostKg * 0.12;
        adaptationNotes.push(
          'کود کمپوست سنتی در انبار ناموجود است؛ سهم ماده آلی آن با افزایش دوز ورمیکمپوست درجه ۱ (+۴۲٪ معادل) و زئولیت جایگزین شد.'
        );
      } else {
        adaptationNotes.push('کود کمپوست سنتی در حال حاضر ناموجود است.');
      }
      perUnitCompostKg = 0;
    }

    if (perUnitSubstrateKg > 0 && !substrateAvail) {
      if (vermiAvail || zeoliteAvail) {
        if (vermiAvail) perUnitVermiKg += perUnitSubstrateKg * 0.55;
        if (zeoliteAvail) perUnitZeoliteKg += perUnitSubstrateKg * 0.45;
        adaptationNotes.push(
          'بستر تفاله قهوه در انبار ناموجود است؛ فرمول تخلخل و تغذیه با ترکیب ورمیکمپوست + زئولیت شکری بازتنظیم شد.'
        );
      } else {
        adaptationNotes.push('بستر تخصصی تفاله قهوه در حال حاضر ناموجود است.');
      }
      perUnitSubstrateKg = 0;
    }

    if (perUnitZeoliteKg > 0 && !zeoliteAvail) {
      if (vermiAvail) {
        perUnitVermiKg += perUnitZeoliteKg * 0.25;
        adaptationNotes.push(
          'زئولیت شکری ناموجود است؛ جهت حفظ ظرفیت نگهداری رطوبت و تعدیل شوری، دوز ورمیکمپوست بافرشده افزایش یافت.'
        );
      } else {
        adaptationNotes.push('زئولیت کشاورزی در حال حاضر ناموجود است.');
      }
      perUnitZeoliteKg = 0;
    }

    if (perUnitVermiKg > 0 && !vermiAvail) {
      if (compostAvail || teaAvail) {
        if (compostAvail) perUnitCompostKg += perUnitVermiKg * 1.75;
        if (teaAvail) perUnitLiquidL += Math.max(0.15, perUnitVermiKg * 0.08);
        adaptationNotes.push(
          'ورمیکمپوست درجه ۱ موقتاً ناموجود است؛ برنامه تغذیه جایگزین با کمپوست سنتی غنی‌شده + ورمی‌تی مایع محاسبه شد.'
        );
      } else {
        adaptationNotes.push('ورمیکمپوست درجه ۱ در انبار کارگاه ناموجود است.');
      }
      perUnitVermiKg = 0;
    }

    if (perUnitLiquidL > 0 && !teaAvail) {
      if (vermiAvail) {
        perUnitVermiKg += perUnitLiquidL * 1.5;
        adaptationNotes.push(
          'عصاره ورمی‌تی مایع ناموجود است؛ مقدار جبرانی در فرم جامد ورمیکمپوست اعمال شد (می‌توانید بخش سطحی را با آب خیس‌خورده تهیه کنید).'
        );
      } else {
        adaptationNotes.push('عصاره ورمی‌تی مایع در حال حاضر ناموجود است.');
      }
      perUnitLiquidL = 0;
    }

    // 3. Total volumes for calcUnitsCount
    const totalVermiKg = Math.round(perUnitVermiKg * calcUnitsCount * 10) / 10;
    const totalCompostKg = Math.round(perUnitCompostKg * calcUnitsCount * 10) / 10;
    const totalZeoliteKg = Math.round(perUnitZeoliteKg * calcUnitsCount * 10) / 10;
    const totalLiquidLiters = Math.round(perUnitLiquidL * calcUnitsCount * 10) / 10;
    const totalSubstrateKg = Math.round(perUnitSubstrateKg * calcUnitsCount * 10) / 10;

    // 4. Select best matching storefront package & verify live stock quantity
    interface RecommendedPackLine {
      key: string;
      product: StoreProduct;
      selectedPkg: PackageOption;
      requiredUnits: number;
      orderableUnits: number;
      totalAmount: number;
      amountUnitLabel: string;
      perUnitDoseLabel: string;
      stockStatus: 'ok' | 'partial' | 'out';
      linePriceToman: number;
      formulaSharePercent: number;
    }

    const totalSolidKg = totalVermiKg + totalCompostKg + totalZeoliteKg + totalSubstrateKg;

    const pickPackage = (prod: StoreProduct, neededAmount: number, kind: 'vermi' | 'compost' | 'zeolite' | 'tea' | 'substrate'): { pkg: PackageOption; pkgSize: number; allRatesOut: boolean } => {
      const availOpts = prod.packagingOptions.filter(o => !o.isOutOfStock);
      const allRatesOut = availOpts.length === 0;
      const opts = availOpts.length > 0 ? availOpts : prod.packagingOptions;

      if (kind === 'vermi') {
        if (neededAmount >= 950) {
          const jumbo = opts.find(o => o.id === 'vermi-pkg-1ton-jumbo' || o.nominalWeightKg >= 900);
          if (jumbo) return { pkg: jumbo, pkgSize: jumbo.nominalWeightKg || 1000, allRatesOut };
        }
        if (neededAmount >= 90) {
          const p50 = opts.find(o => o.id === 'vermi-pkg-50kg' || o.nominalWeightKg === 50);
          if (p50) return { pkg: p50, pkgSize: p50.nominalWeightKg || 50, allRatesOut };
        }
        const p25 = opts.find(o => o.id === 'vermi-pkg-25kg' || o.nominalWeightKg === 25) || opts[0];
        return { pkg: p25, pkgSize: p25.nominalWeightKg || 25, allRatesOut };
      }
      if (kind === 'compost') {
        if (neededAmount >= 950) {
          const jumbo = opts.find(o => o.id === 'compost-pkg-1ton' || o.nominalWeightKg >= 900);
          if (jumbo) return { pkg: jumbo, pkgSize: jumbo.nominalWeightKg || 1000, allRatesOut };
        }
        const p30 = opts.find(o => o.id === 'compost-pkg-30kg') || opts[0];
        return { pkg: p30, pkgSize: p30.nominalWeightKg || 30, allRatesOut };
      }
      if (kind === 'zeolite') {
        if (neededAmount >= 950) {
          const jumbo = opts.find(o => o.id === 'zeo-pkg-1ton' || o.nominalWeightKg >= 900);
          if (jumbo) return { pkg: jumbo, pkgSize: jumbo.nominalWeightKg || 1000, allRatesOut };
        }
        if (neededAmount >= 90) {
          const p50 = opts.find(o => o.id === 'zeo-pkg-50kg' || o.nominalWeightKg === 50);
          if (p50) return { pkg: p50, pkgSize: p50.nominalWeightKg || 50, allRatesOut };
        }
        const p25 = opts.find(o => o.id === 'zeo-pkg-25kg') || opts[0];
        return { pkg: p25, pkgSize: p25.nominalWeightKg || 25, allRatesOut };
      }
      if (kind === 'tea') {
        if (neededAmount >= 18) {
          const p20 = opts.find(o => o.id === 'tea-pkg-20liter');
          if (p20) return { pkg: p20, pkgSize: 20, allRatesOut };
        }
        if (neededAmount >= 7) {
          const p10 = opts.find(o => o.id === 'tea-pkg-10liter');
          if (p10) return { pkg: p10, pkgSize: 10, allRatesOut };
        }
        const p4 = opts.find(o => o.id === 'tea-pkg-4liter') || opts[0];
        const liters = p4.id.includes('20') ? 20 : p4.id.includes('10') ? 10 : 4;
        return { pkg: p4, pkgSize: liters, allRatesOut };
      }
      const subPkg = opts[0];
      return { pkg: subPkg, pkgSize: subPkg.nominalWeightKg || 20, allRatesOut };
    };

    const formatPerUnit = (val: number, unit: 'kg' | 'L') => {
      if (val <= 0) return '۰';
      if (unit === 'kg') {
        return val < 1 ? `${Math.round(val * 1000)} گرم` : `${Math.round(val * 100) / 100} کیلوگرم`;
      }
      return val < 1 ? `${Math.round(val * 1000)} سی‌سی (ml)` : `${Math.round(val * 100) / 100} لیتر`;
    };

    const lines: RecommendedPackLine[] = [];

    const tryBuildLine = (
      key: 'vermi' | 'compost' | 'zeolite' | 'substrate' | 'tea',
      prod: StoreProduct | undefined,
      totalAmt: number,
      perUnitAmt: number,
      amtUnit: 'kg' | 'L'
    ) => {
      if (!prod || totalAmt <= 0 || calcUnitsCount <= 0) return;
      const { pkg, pkgSize, allRatesOut } = pickPackage(prod, totalAmt, key);
      const requiredUnits = Math.max(1, Math.ceil(totalAmt / pkgSize));
      const stdSize = key === 'compost' ? 30 : key === 'substrate' ? 20 : key === 'tea' ? 10 : 25;
      const maxUnitsByStock = prod.inStock && !allRatesOut
        ? Math.max(0, Math.floor((prod.stockQuantity * stdSize) / pkgSize))
        : 0;
      const orderableUnits = Math.min(requiredUnits, maxUnitsByStock);
      const stockStatus: 'ok' | 'partial' | 'out' =
        !prod.inStock || allRatesOut || maxUnitsByStock <= 0
          ? 'out'
          : requiredUnits <= maxUnitsByStock
          ? 'ok'
          : 'partial';

      lines.push({
        key,
        product: prod,
        selectedPkg: pkg,
        requiredUnits,
        orderableUnits,
        totalAmount: totalAmt,
        amountUnitLabel: amtUnit === 'kg' ? 'کیلوگرم' : 'لیتر',
        perUnitDoseLabel: formatPerUnit(perUnitAmt, amtUnit),
        stockStatus,
        linePriceToman: orderableUnits * pkg.priceToman,
        formulaSharePercent: amtUnit === 'kg' && totalSolidKg > 0 ? Math.round((totalAmt / totalSolidKg) * 100) : 0,
      });
    };

    tryBuildLine('vermi', vermiProduct, totalVermiKg, perUnitVermiKg, 'kg');
    tryBuildLine('compost', compostProduct, totalCompostKg, perUnitCompostKg, 'kg');
    tryBuildLine('zeolite', zeoliteProduct, totalZeoliteKg, perUnitZeoliteKg, 'kg');
    tryBuildLine('substrate', substrateProduct, totalSubstrateKg, perUnitSubstrateKg, 'kg');
    tryBuildLine('tea', teaProduct, totalLiquidLiters, perUnitLiquidL, 'L');

    // 5. Generate Customer-Specific Step-by-Step Application Protocol ("طریقه مصرف تخصصی")
    const applicationSteps: string[] = [];
    if (isOrchard) {
      if (calcTreeAgeYears <= 0) {
        applicationSteps.push(
          `۱. گودال کاشت نهال (سن ۰ سال): قبل از کاشت نهال، چاله‌ای به ابعاد ۵۰×۵۰ سانتی‌متر حفر کرده و کودهای این فرمول را با خاک رویی ته چاله مخلوط و لایه ۵ سانتی خاک تمیز روی آن بریزید تا ریشه مستقیماً با کود خام تماس نداشته باشد.`
        );
      } else {
        const trunkDistance =
          calcTreeAgeYears <= 2
            ? '۳۵ تا ۵۰ سانتی‌متری نهال'
            : calcTreeAgeYears <= 6
            ? '۶۵ تا ۹۵ سانتی‌متری تنه درخت'
            : '۱۰۰ تا ۱۴۰ سانتی‌متری سایه‌انداز تاج درخت';
        const holeCount =
          calcTreeAgeYears <= 2
            ? '۲ چاله'
            : calcTreeAgeYears <= 10
            ? '۳ تا ۴ چاله'
            : '۴ تا ۶ چاله';
        applicationSteps.push(
          `۱. آماده‌سازی چالکود متناسب با سن ${calcTreeAgeYears.toLocaleString('fa-IR')} سال: در محدوده سایه‌انداز تاج درخت (فاصله ${trunkDistance})، ${holeCount} به عمق ۳۰ تا ۴۵ سانتی‌متر حفر کنید.`
        );
      }
      applicationSteps.push(
        `۲. فرمول اختلاط در هر ${dose.unitLabel} (${orchardAgeProfile.label}): ${perUnitVermiKg > 0 ? `${formatPerUnit(perUnitVermiKg, 'kg')} ورمیکمپوست` : ''}${perUnitCompostKg > 0 ? ` + ${formatPerUnit(perUnitCompostKg, 'kg')} کمپوست سنتی` : ''}${perUnitZeoliteKg > 0 ? ` + ${formatPerUnit(perUnitZeoliteKg, 'kg')} زئولیت شکری` : ''} را با ۵۰٪ خاک برگشتی سطحی چاله مخلوط و با خاک روی آن را بپوشانید.`
      );
      if (perUnitLiquidL > 0) {
        const diluteWater = Math.max(10, Math.round(perUnitLiquidL * 60));
        applicationSteps.push(
          `۳. تغذیه مایع و آبیاری: پس از چالکود، آبیاری سنگین زمستانه انجام دهید. در شروع بیداری بهاره، ${formatPerUnit(perUnitLiquidL, 'L')} ورمی‌تی را در ${diluteWater.toLocaleString('fa-IR')} لیتر آب رقیق کرده و پای طوقه یا در تانک کود آبیاری قطره‌ای تزریق نمایید.`
        );
      }
    } else if (isHouseplant) {
      applicationSteps.push(
        `۱. دوز جایگذاری خاک در هر ${dose.unitLabel}: ${perUnitVermiKg > 0 ? `${formatPerUnit(perUnitVermiKg, 'kg')} ورمیکمپوست بدون بو` : ''}${perUnitSubstrateKg > 0 ? ` و ${formatPerUnit(perUnitSubstrateKg, 'kg')} بستر تفاله قهوه` : ''}${perUnitZeoliteKg > 0 ? ` همراه با ${formatPerUnit(perUnitZeoliteKg, 'kg')} زئولیت` : ''} را به صورت یکنواخت با سطح خاک گلدان (عمق ۳ سانتی‌متر بدون آسیب به ریشه) یا بستر تعویض گلدان ترکیب کنید.`
      );
      if (perUnitLiquidL > 0) {
        applicationSteps.push(
          `۲. محلول‌پاشی و آبیاری دوره‌ای: هر ۲۱ روز یک‌بار، ۱۰ تا ۱۵ سی‌سی عصاره ورمی‌تی را در ۱ لیتر آب بدون کلر (مانده ۲۴ ساعته) حل کرده و هم به صورت آبیاری و هم غبارپاشی زیر برگ‌ها مصرف کنید.`
        );
      }
      applicationSteps.push(
        `۳. احتیاط مهم: پس از کوددهی، بلافاصله گلدان را به مقدار متعادل آبیاری کنید تا اسید هیومیک و میکروارگانیسم‌های مفید در ناحیه ریشه فعال شوند.`
      );
    } else {
      applicationSteps.push(
        `۱. آماده‌سازی بستر به ازای هر ${dose.unitLabel}: ${perUnitVermiKg > 0 ? `${formatPerUnit(perUnitVermiKg, 'kg')} ورمیکمپوست` : ''}${perUnitCompostKg > 0 ? ` + ${formatPerUnit(perUnitCompostKg, 'kg')} کمپوست پاستوریزه` : ''}${perUnitSubstrateKg > 0 ? ` + ${formatPerUnit(perUnitSubstrateKg, 'kg')} بستر قهوه` : ''}${perUnitZeoliteKg > 0 ? ` + ${formatPerUnit(perUnitZeoliteKg, 'kg')} زئولیت` : ''} را قبل از کاشت یا در شیارهای بین ردیفی با خاک رویی مخلوط کنید.`
      );
      if (perUnitLiquidL > 0) {
        applicationSteps.push(
          `۲. تزریق در سیستم آبیاری / محلول‌پاشی: ${formatPerUnit(perUnitLiquidL, 'L')} عصاره ورمی‌تی در هر ${dose.unitLabel} را با نسبت ۱ به ۸۰ در آب رقیق کرده و در مراحل گل‌دهی و پر شدن میوه به صورت سرک تزریق کنید.`
        );
      }
    }

    if (calcSoilCondition === 'saline_heavy') {
      applicationSteps.push(
        '🛡️ اصلاح شوری/خاک سنگین: با توجه به انتخاب خاک شور یا رسی، زئولیت کلینوپتیلولیت سدیم اضافی آب آبیاری را تله‌اندازی کرده و مانع سوختگی حاشیه برگ‌ها می‌شود.'
      );
    }

    const totalPriceToman = lines.reduce((sum, l) => sum + l.linePriceToman, 0);
    const allOutOfStock = calcUnitsCount > 0 && lines.every(l => l.stockStatus === 'out');

    return {
      plantName: currentPlant.name,
      categoryLabel: currentPlant.categoryLabel,
      unitLabel: dose.unitLabel,
      instructions: dose.instructions,
      bestMonths: dose.bestMonthsFa,
      ageStageLabel: isOrchard ? orchardAgeProfile.label : undefined,
      isHouseplant,
      isGreenhouse,
      isOrchard,
      totalVermiKg,
      totalCompostKg,
      totalZeoliteKg,
      totalLiquidLiters,
      totalSubstrateKg,
      lines,
      adaptationNotes,
      applicationSteps,
      totalPriceToman,
      allOutOfStock,
    };
  }, [currentPlant, calcUnitsCount, calcTreeAgeYears, calcStrategy, calcGrowthStage, calcSoilCondition, products]);

  // 1-Click add available dosage pack to shopping cart (stock-safe)
  const handleAddCalculatedPackToCart = () => {
    if (calcUnitsCount <= 0) {
      setCartNotice('لطفاً ابتدا تعداد واحد یا متراژ را بزرگ‌تر از صفر وارد کنید.');
      setTimeout(() => setCartNotice(null), 3000);
      return;
    }

    let addedCount = 0;
    let skippedOutOfStock = 0;

    dosageResult.lines.forEach(line => {
      if (line.orderableUnits > 0 && line.product.inStock) {
        handleAddToCart(line.product, line.selectedPkg, line.orderableUnits);
        addedCount++;
      } else {
        skippedOutOfStock++;
      }
    });

    if (addedCount > 0) {
      setCartNotice(
        skippedOutOfStock > 0
          ? `${addedCount} قلم موجود به سبد اضافه شد (${skippedOutOfStock} قلم ناموجود لحاظ نشد).`
          : `پکیج تخصصی ${dosageResult.plantName} با موجودی تاییدشده به سبد اضافه شد.`
      );
      setTimeout(() => setCartNotice(null), 3500);
      setMobileTab('cart');
    } else {
      setCartNotice('اقلام این فرمول در حال حاضر در انبار موجود نیستند. لطفاً با مشاور کارگاه تماس بگیرید.');
      setTimeout(() => setCartNotice(null), 3500);
    }
  };

  // Submit single unified order with all collected cart items (Registered Customers Only)
  const handleFinalizeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (!currentUser) {
      setCheckoutError('ثبت نهایی سفارش فقط برای مشتریان ثبت‌نام‌شده امکان‌پذیر است. لطفاً ابتدا ثبت‌نام کنید یا وارد حساب خود شوید.');
      openAuthModal('register');
      return;
    }

    if (cart.length === 0) {
      setCheckoutError('سبد خرید شما خالی است. لطفاً ابتدا کالاهای مورد نیاز را به سبد خرید اضافه کنید.');
      return;
    }

    if (!checkoutName.trim() || !checkoutPhone.trim() || !checkoutAddress.trim()) {
      setCheckoutError('لطفاً نام خریدار، شماره تماس و آدرس دقیق تحویل را وارد فرمایید.');
      return;
    }

    const todayCompact = getCurrentPersianDate().replace(/\//g, '');
    const todayPersianDisplay = formatDeviceDate(new Date());

    const lightweightItems: CartItem[] = cart.map(it => ({
      ...it,
      product: {
        ...it.product,
        imageUrl: it.product.imageUrl?.startsWith('data:') ? '' : (it.product.imageUrl || ''),
      },
    }));

    const newOrder: CustomerOrder = {
      orderNumber: `ORD-${todayCompact}-${Math.floor(1000 + Math.random() * 9000)}`,
      orderDate: todayPersianDisplay,
      customerId: currentUser?.id,
      customerName: checkoutName.trim(),
      phoneNumber: normalizeDigits(checkoutPhone.trim()),
      province: checkoutProvince,
      city: checkoutCity.trim() || 'نامشخص',
      deliveryAddress: checkoutAddress.trim(),
      farmingType: checkoutFarmingType,
      deliveryMethod: checkoutDeliveryMethod,
      items: lightweightItems,
      totalWeightKg: cartTotals.totalWeightKg,
      subtotalToman: cartTotals.subtotalToman,
      discountToman: cartTotals.totalDiscountToman,
      shippingEstimateToman: cartTotals.shippingEstimate,
      finalPayableToman: cartTotals.finalPayableToman,
      orderNotes: checkoutNotes.trim(),
      status: 'registered',
      updatedAt: todayPersianDisplay,
    };

    await saveCustomerOrder(newOrder);
    triggerTelegramHaptic('success');
    void notifyServerTelegramNewOrder(newOrder);
    setSubmittedOrder(newOrder);
    setCart([]);
    setMobileTab('orders');
  };

  // In-Drawer 1-Step Quick Buy Submission (without leaving Telegram; auto-registers customer & syncs realtime)
  const handleDrawerQuickBuySubmit = async (e: React.FormEvent, prod: StoreProduct, chosenPkg: PackageOption) => {
    e.preventDefault();
    setDrawerQuickError(null);

    if (!prod.inStock || prod.stockQuantity <= 0 || chosenPkg.isOutOfStock) {
      setDrawerQuickError('متاسفانه این بسته‌بندی در حال حاضر ناموجود است.');
      return;
    }

    const qty = Math.max(1, Math.min(999, Math.round(drawerQuickQty)));
    const canonPhone = canonicalizePhoneNumber(checkoutPhone);
    if (!checkoutName.trim()) {
      setDrawerQuickError('لطفاً نام و نام خانوادگی خریدار را وارد کنید.');
      return;
    }
    if (canonPhone.length < 10) {
      setDrawerQuickError('لطفاً شماره موبایل معتبر (مثلاً ۰۹۱۲۳۴۵۶۷۸۹) وارد فرمایید.');
      return;
    }
    if (checkoutDeliveryMethod !== 'pickup_factory' && !checkoutAddress.trim()) {
      setDrawerQuickError('لطفاً آدرس تحویل کالا را وارد کنید.');
      return;
    }

    setDrawerQuickSubmitting(true);
    try {
      const todayCompact = getCurrentPersianDate().replace(/\//g, '');
      const todayPersianDisplay = formatDeviceDate(new Date());
      const tgProfile = getTelegramCustomerProfile();

      // Auto-register or link customer account cleanly in realtime so Admin & customer Orders stay synced
      let effectiveCustomerId = currentUser?.id;
      if (!currentUser) {
        const existingUsers = loadUserAccounts();
        const existingMatched = existingUsers.find(
          (u) =>
            u.role === 'customer' &&
            (canonicalizePhoneNumber(u.phoneNumber) === canonPhone ||
              (tgProfile?.id && u.telegramUserId === String(tgProfile.id)))
        );

        if (existingMatched) {
          const updatedExisting: UserAccount = {
            ...existingMatched,
            phoneNumber: canonPhone,
            fullName: existingMatched.fullName || checkoutName.trim(),
            province: checkoutProvince || existingMatched.province,
            city: checkoutCity.trim() || existingMatched.city,
            address: checkoutAddress.trim() || existingMatched.address,
            farmingType: checkoutFarmingType || existingMatched.farmingType,
            ...(tgProfile?.id
              ? {
                  telegramLinked: true,
                  telegramUserId: String(tgProfile.id),
                  telegramUsername: tgProfile.username || existingMatched.telegramUsername,
                  telegramFullName: tgProfile.fullName || existingMatched.telegramFullName,
                }
              : {}),
          };
          await saveUserAccount(updatedExisting);
          setCurrentUser(updatedExisting);
          onUserChange(updatedExisting);
          effectiveCustomerId = updatedExisting.id;
        } else {
          const autoRegisteredCustomer: UserAccount = {
            id: `usr-cust-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            username: tgProfile?.username || undefined,
            phoneNumber: canonPhone,
            password: `tg-${canonPhone.slice(-4) || '1234'}-${Math.floor(100 + Math.random() * 900)}`,
            fullName: checkoutName.trim(),
            role: 'customer',
            province: checkoutProvince,
            city: checkoutCity.trim() || 'نامشخص',
            address: checkoutAddress.trim() || 'تحویل حضوری درب کارگاه',
            farmingType: checkoutFarmingType,
            createdAt: todayPersianDisplay,
            ...(tgProfile?.id
              ? {
                  telegramLinked: true,
                  telegramUserId: String(tgProfile.id),
                  telegramUsername: tgProfile.username,
                  telegramFullName: tgProfile.fullName,
                }
              : {}),
          };
          await saveUserAccount(autoRegisteredCustomer);
          setCurrentUser(autoRegisteredCustomer);
          onUserChange(autoRegisteredCustomer);
          effectiveCustomerId = autoRegisteredCustomer.id;
        }
      }

      if (isInsideTelegramWebApp() && canonPhone) {
        void syncTelegramPhoneToServer(canonPhone, checkoutName.trim(), tgProfile?.username);
      }

      const subtotalToman = chosenPkg.priceToman * qty;
      const totalWeightKg = Math.round(chosenPkg.nominalWeightKg * qty * 100) / 100;
      const baseUnit = resolveProductBaseUnitPrice(prod);
      const refFromUnit =
        baseUnit > 0 && chosenPkg.nominalWeightKg > 0
          ? Math.round(baseUnit * chosenPkg.nominalWeightKg)
          : 0;
      const origPerPkg = Math.max(
        chosenPkg.priceToman,
        chosenPkg.originalPriceToman || refFromUnit || (chosenPkg.priceToman + (chosenPkg.discountToman || 0))
      );
      const discountToman = Math.max(0, origPerPkg * qty - subtotalToman);
      const { shippingEstimate } = computeShippingEstimate(
        totalWeightKg,
        subtotalToman,
        checkoutDeliveryMethod,
        storeSettings
      );
      const finalPayableToman = Math.max(0, subtotalToman + shippingEstimate);

      const quickItem: CartItem = {
        id: `${prod.id}-${chosenPkg.id}`,
        product: {
          ...prod,
          imageUrl: prod.imageUrl?.startsWith('data:') ? '' : (prod.imageUrl || ''),
        },
        selectedPackage: chosenPkg,
        quantity: qty,
        unitPrice: chosenPkg.priceToman,
        totalPrice: subtotalToman,
      };

      const newOrder: CustomerOrder = {
        orderNumber: `ORD-${todayCompact}-${Math.floor(1000 + Math.random() * 9000)}`,
        orderDate: todayPersianDisplay,
        customerId: effectiveCustomerId,
        customerName: checkoutName.trim(),
        phoneNumber: canonPhone,
        province: checkoutProvince,
        city: checkoutCity.trim() || 'نامشخص',
        deliveryAddress: checkoutAddress.trim() || 'تحویل حضوری درب کارگاه',
        farmingType: checkoutFarmingType,
        deliveryMethod: checkoutDeliveryMethod,
        items: [quickItem],
        totalWeightKg,
        subtotalToman,
        discountToman,
        shippingEstimateToman: shippingEstimate,
        finalPayableToman,
        orderNotes: checkoutNotes.trim() || 'ثبت شده از طریق خرید سریع داخل صفحه محصول',
        status: 'registered',
        updatedAt: todayPersianDisplay,
      };

      await saveCustomerOrder(newOrder);
      triggerTelegramHaptic('success');
      void notifyServerTelegramNewOrder(newOrder);
      setDrawerQuickOrderResult(newOrder);
      setSubmittedOrder(newOrder);
      setDrawerQuickBuyOpen(false);
    } catch (err) {
      setDrawerQuickError(err instanceof Error ? err.message : 'خطا در ثبت سریع سفارش');
    } finally {
      setDrawerQuickSubmitting(false);
    }
  };

  // Auto-open sliding product Drawer if launched from Telegram Bot inline button (?product=<id>&quickbuy=1)
  const launchProductAppliedRef = useRef(false);
  useEffect(() => {
    if (launchProductAppliedRef.current) return;
    const launchTarget = resolveTelegramOrUrlLaunchTarget();
    if (launchTarget.productId && products.length > 0) {
      const matched = products.find((p) => p.id === launchTarget.productId);
      if (matched) {
        launchProductAppliedRef.current = true;
        openProductDrawer(matched, Boolean(launchTarget.quickBuy));
      }
    }
  }, [products]);

  useEffect(() => {
    if (selectedCategory !== 'all' && !catalogCategories.some(c => c.id === selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [catalogCategories, selectedCategory]);

  // Filter & sort products for Catalog
  const filteredProducts = useMemo(() => {
    const getMinPrice = (p: StoreProduct) => {
      const prices = (p.packagingOptions || []).map((pk) => pk.priceToman).filter((v) => v > 0);
      return prices.length > 0 ? Math.min(...prices) : 0;
    };

    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (p.isDisabled) return false;
      if (inStockOnly && (!p.inStock || p.stockQuantity <= 0)) return false;
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.categoryLabel.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });

    if (catalogSort === 'price_asc') {
      return [...list].sort((a, b) => getMinPrice(a) - getMinPrice(b));
    }
    if (catalogSort === 'price_desc') {
      return [...list].sort((a, b) => getMinPrice(b) - getMinPrice(a));
    }
    return list;
  }, [products, selectedCategory, searchQuery, inStockOnly, catalogSort]);

  return (
    <div
      className={`w-full min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col font-sans pb-10 relative ${
        isMobilePreview ? 'max-w-md mx-auto shadow-2xl border-x border-stone-200 dark:border-stone-800' : ''
      }`}
      dir="rtl"
    >
      {/* Sticky Top Storefront Header + Integrated Top Navigation Bar */}
      <header className="sticky top-[var(--global-header-h,0px)] z-40 bg-emerald-800 text-white border-b border-emerald-950/50 no-print">
        <div className={`${isMobilePreview ? 'px-3 py-2' : 'max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2'} flex items-center justify-between gap-2`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={appLogoSrc}
              alt={storeSettings.workshopName}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-white/25 bg-white shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold leading-tight truncate">{storeSettings.workshopName}</h1>
              <p className="text-[10px] sm:text-[11px] text-emerald-200 truncate">
                {storeSettings.appTagline || 'فروشگاه آنلاین کارگاه و محاسبه‌گر تخصصی'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div
              className="hidden sm:flex px-2.5 py-1.5 rounded-lg bg-emerald-900/70 border border-emerald-600/40 text-amber-200 font-mono tabular-nums text-[10.5px] font-bold items-center gap-1 whitespace-nowrap shrink-0"
              title={`ساعت و تاریخ دستگاه شما: ${deviceClock.weekdayDateStr}`}
            >
              <span>🕒</span>
              <span>{deviceClock.timeStr}</span>
            </div>

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] rounded-xl bg-white/10 hover:bg-white/20 text-emerald-100 flex items-center justify-center text-xs transition-colors shrink-0"
                title={
                  themeMode === 'system'
                    ? `هماهنگ با دستگاه (${isDark ? 'تیره' : 'روشن'}) · تغییر دستی تم`
                    : isDark
                    ? 'تغییر به حالت روشن'
                    : 'تغییر به حالت تیره'
                }
              >
                <span>{isDark ? '☀️' : '🌙'}</span>
              </button>
            )}

            {onToggleMobilePreview && (
              <button
                type="button"
                onClick={onToggleMobilePreview}
                className="hidden md:inline-flex whitespace-nowrap shrink-0 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-emerald-100 rounded-xl text-[10.5px] font-semibold items-center gap-1 transition-colors"
                title={isMobilePreview ? 'بازگشت به نمای تمام‌صفحه وب‌سایت' : 'پیش‌نمایش قاب موبایل'}
              >
                <span>{isMobilePreview ? '💻' : '📱'}</span>
                <span>{isMobilePreview ? 'تمام‌صفحه' : 'نمای موبایل'}</span>
              </button>
            )}

            {currentUser?.role === 'admin' && onOpenAdminPanel && (
              <button
                onClick={onOpenAdminPanel}
                className="whitespace-nowrap shrink-0 min-h-[38px] px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-xl text-[10.5px] sm:text-[11px] transition-colors flex items-center gap-1"
                title="ورود به پنل مدیریت کارگاه و سفارشات"
              >
                <span>👑</span>
                <span>پنل مدیریت</span>
              </button>
            )}

            {currentUser ? (
              <button
                onClick={() => setMobileTab('profile')}
                className="min-h-[40px] sm:min-h-[36px] px-2.5 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-500/70 flex items-center gap-1.5 text-xs font-bold whitespace-nowrap shrink-0"
                title={currentUser.fullName}
              >
                <span>{currentUser.fullName.slice(0, 1)}</span>
                <span className="hidden sm:inline text-[11px] font-semibold max-w-[110px] truncate">{currentUser.fullName}</span>
              </button>
            ) : (
              <button
                onClick={() => openAuthModal('login')}
                className="min-h-[40px] sm:min-h-[36px] px-2.5 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
              >
                <span>👤</span>
                <span>ورود / عضویت</span>
              </button>
            )}

            <button
              onClick={() => setMobileTab('cart')}
              className="relative min-w-[42px] min-h-[40px] sm:min-w-[38px] sm:min-h-[36px] rounded-xl bg-emerald-900/75 hover:bg-emerald-900 border border-emerald-700/60 flex items-center justify-center text-white transition-colors shrink-0"
              title="سبد خرید"
            >
              <span>🛒</span>
              {cartTotals.totalItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-stone-950 font-bold text-[10px] min-w-[18px] h-[18px] px-1 rounded-md flex items-center justify-center font-mono tabular-nums">
                  {cartTotals.totalItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Integrated Single-Row Navigation Bar */}
        <nav
          aria-label="ناوبری اصلی فروشگاه"
          className="bg-emerald-900/80 border-t border-white/10"
        >
          <div
            className={`${
              isMobilePreview ? 'px-2 py-1' : 'max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1'
            } flex items-center justify-start sm:justify-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none`}
          >
            <button
              type="button"
              onClick={() => setMobileTab('catalog')}
              className={`whitespace-nowrap shrink-0 min-h-[36px] flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] sm:text-xs transition-colors ${
                mobileTab === 'catalog'
                  ? 'bg-white text-emerald-950 font-extrabold'
                  : 'text-emerald-100/90 hover:bg-white/10 hover:text-white font-semibold'
              }`}
            >
              <span>🌿</span>
              <span>محصولات</span>
            </button>

            {calculatorEnabled && (
              <button
                type="button"
                onClick={() => setMobileTab('calculator')}
                className={`whitespace-nowrap shrink-0 min-h-[36px] flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] sm:text-xs transition-colors ${
                  mobileTab === 'calculator'
                    ? 'bg-white text-emerald-950 font-extrabold'
                    : 'text-emerald-100/90 hover:bg-white/10 hover:text-white font-semibold'
                }`}
              >
                <span>🧮</span>
                <span>محاسبه کود</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileTab('tips')}
              className={`whitespace-nowrap shrink-0 min-h-[36px] flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] sm:text-xs transition-colors ${
                mobileTab === 'tips'
                  ? 'bg-white text-emerald-950 font-extrabold'
                  : 'text-emerald-100/90 hover:bg-white/10 hover:text-white font-semibold'
              }`}
            >
              <span>✨</span>
              <span>نکات طلایی</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('weather')}
              className={`whitespace-nowrap shrink-0 min-h-[36px] flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] sm:text-xs transition-colors ${
                mobileTab === 'weather'
                  ? 'bg-white text-emerald-950 font-extrabold'
                  : 'text-emerald-100/90 hover:bg-white/10 hover:text-white font-semibold'
              }`}
            >
              <span>🌤️</span>
              <span>هواشناسی</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('cart')}
              className={`whitespace-nowrap shrink-0 min-h-[36px] flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] sm:text-xs transition-colors ${
                mobileTab === 'cart'
                  ? 'bg-white text-emerald-950 font-extrabold'
                  : 'text-emerald-100/90 hover:bg-white/10 hover:text-white font-semibold'
              }`}
            >
              <span>🛒</span>
              <span>سبد خرید</span>
              {cartTotals.totalItemsCount > 0 && (
                <span className="bg-amber-400 text-stone-950 font-mono tabular-nums font-extrabold text-[10px] px-1.5 py-0.5 rounded">
                  {cartTotals.totalItemsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('orders')}
              className={`whitespace-nowrap shrink-0 min-h-[36px] flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] sm:text-xs transition-colors ${
                mobileTab === 'orders'
                  ? 'bg-white text-emerald-950 font-extrabold'
                  : 'text-emerald-100/90 hover:bg-white/10 hover:text-white font-semibold'
              }`}
            >
              <span>📦</span>
              <span>سفارشات</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('profile')}
              className={`whitespace-nowrap shrink-0 min-h-[36px] flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] sm:text-xs transition-colors ${
                mobileTab === 'profile'
                  ? 'bg-white text-emerald-950 font-extrabold'
                  : 'text-emerald-100/90 hover:bg-white/10 hover:text-white font-semibold'
              }`}
            >
              <span>👤</span>
              <span>{currentUser ? 'پروفایل' : 'ورود'}</span>
            </button>
          </div>
        </nav>

        {/* Live Cart Added Toast */}
        {cartNotice && (
          <div className="bg-amber-400 text-stone-900 text-xs py-1.5 px-4 text-center font-bold shadow-md animate-fade-in">
            ✓ {cartNotice}
          </div>
        )}
      </header>

      {/* Main View Area based on active tab */}
      <div className={`flex-1 w-full ${isMobilePreview ? 'px-3.5 py-3.5' : 'max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5'} space-y-5 ${viewingOrderReceipt ? 'no-print' : ''}`}>
        
        {/* ===================== TAB 1: CATALOG ===================== */}
        {mobileTab === 'catalog' && (
          <>
            {/* Factory Standard Promo Banner */}
            <div className={`bg-gradient-to-l from-emerald-900 via-stone-900 to-emerald-950 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-emerald-800/40 relative overflow-hidden ${isMobilePreview ? 'space-y-3' : 'flex flex-col lg:flex-row lg:items-center justify-between gap-4'}`}>
              <div className="relative z-10 space-y-2 flex-1 min-w-0">
                <div className="inline-block border-b border-amber-400/70 pb-1 text-[11px] font-bold text-amber-300">
                  {storeSettings.storeHeroBadgeText?.trim() || 'تولید استاندارد ISIRI · ارسال مستقیم از کارگاه'}
                </div>
                <h2 className="text-sm sm:text-base font-extrabold text-emerald-50 leading-snug">
                  ورمیکمپوست غنی‌شده، کمپوست سنتی و بیوکودها
                </h2>
                <p className="text-[11px] sm:text-xs text-stone-300 leading-relaxed max-w-3xl">
                  {storeSettings.minOrderNotice}
                </p>
              </div>
              <div className={`${isMobilePreview ? 'pt-3 border-t border-white/10' : 'pt-3 lg:pt-0 border-t lg:border-t-0 border-white/10 shrink-0'} flex flex-wrap items-center gap-2 relative z-10`}>
                {calculatorEnabled && (
                  <button
                    onClick={() => setMobileTab('calculator')}
                    className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <span>🧮</span>
                    <span>محاسبه‌گر کود</span>
                  </button>
                )}
                <button
                  onClick={() => setMobileTab('tips')}
                  className="px-3.5 py-2 bg-emerald-700/90 hover:bg-emerald-600 text-white border border-emerald-500/40 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <span>✨</span>
                  <span>نکات طلایی باغبانی</span>
                </button>
                <button
                  onClick={() => setMobileTab('weather')}
                  className="px-3.5 py-2 bg-sky-700/90 hover:bg-sky-600 text-white border border-sky-400/40 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <span>🌤️</span>
                  <span>هواشناسی آنلاین</span>
                </button>
                <a
                  href={`tel:${normalizeDigits(storeSettings.agronomistPhone || storeSettings.supportPhone).replace(/[^\d+]/g, '') || '09120000003'}`}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <span>📞</span>
                  <span>مشاوره</span>
                </a>
              </div>
            </div>

            {/* Search, In-Stock Filter, Sort & Category Strip */}
            <div className="bg-white dark:bg-stone-900 p-3 sm:p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-2.5">
              <div className={isMobilePreview ? 'space-y-2.5' : 'flex flex-col lg:flex-row lg:items-center justify-between gap-2.5'}>
                <div className={`relative ${isMobilePreview ? 'w-full' : 'w-full lg:w-80 shrink-0'}`}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجوی محصول (ورمیکمپوست، زئولیت، ورمی‌تی...)"
                    className="w-full min-h-[40px] pl-9 pr-9 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                  <span className="absolute right-3 top-3 text-stone-400 text-xs">🔍</span>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="پاک کردن جستجو"
                      className="absolute left-3 top-2.5 w-6 h-6 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 text-xs flex items-center justify-center"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Filter Strip */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none text-[11px] font-semibold flex-1">
                  {catalogCategories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl whitespace-nowrap shrink-0 transition-all ${
                        selectedCategory === cat.id
                          ? 'bg-emerald-800 text-white font-bold shadow-xs'
                          : 'bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort, In-Stock Switch & Result Count Toolbar */}
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setInStockOnly((v) => !v)}
                    className={`min-h-[34px] px-2.5 py-1 rounded-xl border font-bold transition-colors flex items-center gap-1.5 ${
                      inStockOnly
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-800 dark:text-emerald-300'
                        : 'bg-stone-50 dark:bg-stone-800/70 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-xs ${inStockOnly ? 'bg-emerald-600' : 'bg-stone-400'}`} />
                    <span>فقط کالاهای موجود</span>
                  </button>

                  <select
                    value={catalogSort}
                    onChange={(e) => setCatalogSort(e.target.value as 'default' | 'price_asc' | 'price_desc')}
                    aria-label="مرتب‌سازی محصولات"
                    className="min-h-[34px] px-2.5 py-1 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="default">مرتب‌سازی: پیشنهادی کارگاه</option>
                    <option value="price_asc">ارزان‌ترین بسته‌بندی</option>
                    <option value="price_desc">گران‌ترین / عمده</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 font-mono tabular-nums">
                  <span>{filteredProducts.length.toLocaleString('fa-IR')} محصول</span>
                  {!isOnline && (
                    <span className="text-amber-700 dark:text-amber-300 font-sans font-bold">
                      · آماده آفلاین
                    </span>
                  )}
                </div>
              </div>
            </div>

            {filteredProducts.length === 0 && (
              <div className="bg-white dark:bg-stone-900 rounded-2xl p-8 text-center border border-stone-200 dark:border-stone-800 space-y-2">
                <p className="text-xs font-bold text-stone-700 dark:text-stone-200">
                  محصولی با فیلترهای فعلی پیدا نشد.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                    setInStockOnly(false);
                    setCatalogSort('default');
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                >
                  نمایش همه محصولات
                </button>
              </div>
            )}

            {/* Products Responsive Grid (1-col Mobile, 2-col Tablet, 3-col Desktop) */}
            <div className={isMobilePreview ? 'space-y-3.5' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
              {filteredProducts.map(prod => {
                const currentPkg = getSelectedPackage(prod);
                const selectedCartQty = cart
                  .filter(it => it.product.id === prod.id)
                  .reduce((sum, it) => sum + it.quantity, 0);

                const baseUnitPrice = resolveProductBaseUnitPrice(prod);
                const baseUnitLabel = prod.baseUnitLabel || (prod.category === 'liquid' ? 'لیتر' : 'کیلوگرم');

                const computePkgPricing = (pkg: PackageOption) => {
                  const unitPriceActual =
                    pkg.nominalWeightKg > 0 ? Math.round(pkg.priceToman / pkg.nominalWeightKg) : 0;
                  const refOrig =
                    pkg.originalPriceToman && pkg.originalPriceToman > pkg.priceToman
                      ? pkg.originalPriceToman
                      : baseUnitPrice > 0 &&
                        pkg.nominalWeightKg > 0 &&
                        Math.round(baseUnitPrice * pkg.nominalWeightKg) > pkg.priceToman
                      ? Math.round(baseUnitPrice * pkg.nominalWeightKg)
                      : pkg.discountToman && pkg.discountToman > 0
                      ? pkg.priceToman + pkg.discountToman
                      : 0;
                  const discAmt = refOrig > pkg.priceToman ? refOrig - pkg.priceToman : (pkg.discountToman || 0);
                  const discPct =
                    pkg.discountPercent && pkg.discountPercent > 0
                      ? pkg.discountPercent
                      : refOrig > pkg.priceToman
                      ? Math.round(((refOrig - pkg.priceToman) / refOrig) * 1000) / 10
                      : 0;
                  return { unitPriceActual, refOrig, discAmt, discPct };
                };

                const activePricing = computePkgPricing(currentPkg);

                return (
                  <div
                    key={prod.id}
                    className={`group bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border transition-all duration-200 flex flex-col justify-between ${
                      selectedCartQty > 0
                        ? 'border-emerald-600 dark:border-emerald-600 ring-1 ring-emerald-500/25 shadow-md'
                        : 'border-stone-200 dark:border-stone-800 hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-lg'
                    }`}
                  >
                    <div>
                      {/* Clean 4:3 Editorial Product Photography (Max 1 Corner Badge) */}
                      <div className="relative w-full aspect-[4/3] bg-stone-100 dark:bg-stone-800 overflow-hidden border-b border-stone-100 dark:border-stone-800">
                        <CachedProductImage
                          product={prod}
                          onClick={() => openProductDrawer(prod, false)}
                          className="w-full h-full object-cover cursor-pointer group-hover:scale-[1.03] transition-transform duration-300"
                        />
                        {selectedCartQty > 0 ? (
                          <span className="absolute bottom-2.5 right-2.5 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-800/95 text-white font-mono tabular-nums shadow">
                            ✓ {selectedCartQty.toLocaleString('fa-IR')} در سبد
                          </span>
                        ) : activePricing.discPct > 0 && !currentPkg.isOutOfStock ? (
                          <span className="absolute bottom-2.5 left-2.5 text-[11px] font-black px-2 py-0.5 rounded-lg bg-rose-600 text-white font-mono tabular-nums shadow-sm">
                            {activePricing.discPct.toLocaleString('fa-IR')}٪ تخفیف
                          </span>
                        ) : null}
                      </div>

                      <div className="p-4 pb-0">
                        {/* Unboxed Architectural Metadata Line Above Title */}
                        <div className="flex items-center justify-between gap-2 text-[10.5px] text-stone-500 dark:text-stone-400 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            <span className="font-semibold text-stone-700 dark:text-stone-300">{prod.categoryLabel}</span>
                            <span>·</span>
                            {prod.inStock ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                                {showStockCount ? `موجود (${prod.stockQuantity.toLocaleString('fa-IR')} ${prod.stockUnit})` : 'موجود در انبار'}
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">ناموجود</span>
                            )}
                          </div>
                          {prod.badge && (
                            <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 shrink-0">
                              {prod.badge}
                            </span>
                          )}
                        </div>

                        {/* Product Name + Male Natural Persian Intro Button */}
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            onClick={() => openProductDrawer(prod, false)}
                            className="text-[13px] font-extrabold text-stone-900 dark:text-stone-100 leading-snug flex-1 cursor-pointer hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
                          >
                            {prod.name}
                          </h3>
                          <button
                            type="button"
                            onClick={() => handleToggleProductVoice(prod)}
                            disabled={voiceLoadingProductId === prod.id}
                            title="گوش دادن به معرفی محصول و نکات کاربردی با صدای آقا"
                            className={`shrink-0 px-2.5 py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition-all shadow-2xs ${
                              activeVoiceProductId === prod.id
                                ? 'bg-amber-400 border-amber-500 text-stone-950 ring-2 ring-amber-400/40 animate-pulse'
                                : voiceLoadingProductId === prod.id
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-700 dark:text-emerald-300 cursor-wait'
                                : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                            }`}
                          >
                            {voiceLoadingProductId === prod.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>در حال آماده...</span>
                              </>
                            ) : activeVoiceProductId === prod.id ? (
                              <>
                                <Square className="w-3 h-3 fill-current" />
                                <span>توقف معرفی</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>معرفی محصول</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Live Playback Transcript / Error Feedback */}
                        {voiceErrorMap[prod.id] && (
                          <div className="mt-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[10px] text-rose-700 dark:text-rose-300">
                            ⚠️ {voiceErrorMap[prod.id]}
                          </div>
                        )}
                        {activeVoiceProductId === prod.id && (voiceTranscriptMap[prod.id] || prod.voiceIntroText) && (
                          <div className="mt-2 p-2.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[10.5px] text-emerald-950 dark:text-emerald-200 leading-relaxed space-y-1">
                            <div className="font-bold flex items-center gap-1 text-emerald-800 dark:text-emerald-300">
                              <span>🎙️</span>
                              <span>در حال پخش معرفی محصول (مشاور فروشگاه):</span>
                            </div>
                            <p>{voiceTranscriptMap[prod.id] || prod.voiceIntroText}</p>
                          </div>
                        )}

                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1.5 leading-relaxed line-clamp-2">
                        {prod.tagline}
                      </p>

                      {baseUnitPrice > 0 && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 px-2 py-0.5 rounded-lg">
                          <span>نرخ مبنا هر {baseUnitLabel}:</span>
                          <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400">
                            {baseUnitPrice.toLocaleString('fa-IR')} تومان
                          </span>
                        </div>
                      )}

                      {/* Package Selector with Per-Rate Out-of-Stock Indicator */}
                      <div className="mt-3">
                        <label className="block text-[10px] font-bold text-stone-500 dark:text-stone-400 mb-1">
                          انتخاب بسته‌بندی / وزن:
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {prod.packagingOptions.map(pkg => {
                            const isSelected = currentPkg.id === pkg.id;
                            const pPricing = computePkgPricing(pkg);
                            const isPkgOut = Boolean(pkg.isOutOfStock);
                            return (
                              <button
                                key={pkg.id}
                                type="button"
                                onClick={() => handleSelectPackage(prod.id, pkg.id)}
                                className={`p-2 rounded-xl text-right border text-[11px] transition-all flex flex-col justify-between ${
                                  isPkgOut
                                    ? isSelected
                                      ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-900 dark:text-rose-200 opacity-90'
                                      : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-stone-500 dark:text-stone-400 opacity-80'
                                    : isSelected
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 text-emerald-900 dark:text-emerald-200 font-bold'
                                    : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1 w-full">
                                  <span className="leading-tight text-[10.5px]">
                                    {pkg.title || pkg.weightOrVolume}
                                  </span>
                                  {isPkgOut ? (
                                    <span className="text-[8.5px] bg-rose-600 text-white px-1.5 py-0.5 rounded-md font-bold shrink-0">
                                      ناموجود
                                    </span>
                                  ) : pPricing.discPct > 0 ? (
                                    <span className="text-[9px] bg-amber-400 text-stone-950 px-1.5 py-0.2 rounded-md font-bold font-mono shrink-0">
                                      {pPricing.discPct.toLocaleString('fa-IR')}٪
                                    </span>
                                  ) : pkg.badge ? (
                                    <span className="text-[8px] bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 px-1 py-0.2 rounded font-normal shrink-0">
                                      {pkg.badge}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-1 flex-wrap">
                                  <span
                                    className={`text-[10px] font-mono font-bold ${
                                      isPkgOut
                                        ? 'line-through text-rose-600 dark:text-rose-400'
                                        : 'text-emerald-800 dark:text-emerald-300'
                                    }`}
                                  >
                                    {pkg.priceToman.toLocaleString('fa-IR')} ت
                                  </span>
                                  {!isPkgOut && pPricing.refOrig > pkg.priceToman && (
                                    <span className="text-[9px] font-mono line-through text-stone-400">
                                      {pPricing.refOrig.toLocaleString('fa-IR')}
                                    </span>
                                  )}
                                </div>
                                {pPricing.unitPriceActual > 0 && (
                                  <div className="text-[8.5px] text-stone-400 font-mono mt-0.5">
                                    فی {baseUnitLabel}: {pPricing.unitPriceActual.toLocaleString('fa-IR')} ت
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      </div>
                    </div>

                    {/* Smart 60% Next-Weight Tier Profit Upgrade Prompt (Catalog Card) */}
                    {(() => {
                      const cardQty = cardQtyMap[prod.id] ?? 1;
                      const samePkgCartQty =
                        cart.find((it) => it.id === `${prod.id}-${currentPkg.id}`)?.quantity || 0;
                      const checkQty = Math.max(cardQty, samePkgCartQty);
                      const upgradeInfo =
                        prod.inStock && !currentPkg.isOutOfStock
                          ? getNextPackageUpgradeSuggestion(prod, currentPkg, checkQty)
                          : null;
                      const dismissKey = `${currentPkg.id}-${checkQty}`;
                      const showUpgradeBox =
                        Boolean(upgradeInfo) && dismissedCatalogUpgrade[prod.id] !== dismissKey;

                      return (
                        <div className="m-4 mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2.5">
                          {showUpgradeBox && upgradeInfo && (
                            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 space-y-2 text-[11px] animate-fade-in">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="font-extrabold text-amber-950 dark:text-amber-200 flex items-center gap-1">
                                  <span>💡</span>
                                  <span>پیشنهاد سود بیشتر ({upgradeInfo.reachPercent.toLocaleString('fa-IR')}٪ وزن بعدی!)</span>
                                </span>
                                {upgradeInfo.unitSavingPercent > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-700 text-white text-[9px] font-bold font-mono">
                                    {upgradeInfo.unitSavingPercent.toLocaleString('fa-IR')}٪ ارزان‌تر در هر {baseUnitLabel}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10.5px] text-amber-900 dark:text-amber-300 leading-relaxed">
                                درخواست شما به <strong>{upgradeInfo.requestedWeight.toLocaleString('fa-IR')} {baseUnitLabel}</strong> (معادل{' '}
                                <strong>{upgradeInfo.reachPercent.toLocaleString('fa-IR')}٪</strong> وزن بسته بزرگ‌تر{' '}
                                <strong>{upgradeInfo.nextPkg.weightOrVolume}</strong>) رسیده است. با انتخاب{' '}
                                <strong>
                                  {upgradeInfo.suggestedNextQty.toLocaleString('fa-IR')} × {upgradeInfo.nextPkg.title || upgradeInfo.nextPkg.weightOrVolume}
                                </strong>
                                {upgradeInfo.totalExtraProfitToman > 0
                                  ? `، تا ${upgradeInfo.totalExtraProfitToman.toLocaleString('fa-IR')} تومان سود بیشتری می‌برید!`
                                  : ' نرخ واحد به‌صرفه‌تری دریافت می‌کنید!'}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectPackage(prod.id, upgradeInfo.nextPkg.id);
                                    if (samePkgCartQty > 0) {
                                      handleUpgradeCartItemPackage(
                                        `${prod.id}-${currentPkg.id}`,
                                        upgradeInfo.nextPkg,
                                        upgradeInfo.suggestedNextQty
                                      );
                                    } else {
                                      handleAddToCart(prod, upgradeInfo.nextPkg, upgradeInfo.suggestedNextQty);
                                    }
                                    setCardQtyMap((prev) => ({ ...prev, [prod.id]: 1 }));
                                  }}
                                  className="py-1.5 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-[10.5px] font-bold shadow-xs transition-colors"
                                >
                                  ✓ انتخاب {upgradeInfo.nextPkg.weightOrVolume} (سود بیشتر)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDismissedCatalogUpgrade((prev) => ({ ...prev, [prod.id]: dismissKey }));
                                    if (cardQty > samePkgCartQty) {
                                      handleAddToCart(prod, currentPkg, cardQty);
                                      setCardQtyMap((prev) => ({ ...prev, [prod.id]: 1 }));
                                    }
                                  }}
                                  className="py-1.5 px-2.5 bg-white dark:bg-stone-800 hover:bg-stone-100 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-700 rounded-xl text-[10.5px] font-bold transition-colors"
                                >
                                  ادامه با همین {checkQty.toLocaleString('fa-IR')} عدد {currentPkg.weightOrVolume}
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="flex items-end justify-between gap-2 flex-wrap pt-1">
                            <div className="space-y-0.5">
                              {activePricing.refOrig > currentPkg.priceToman && !currentPkg.isOutOfStock && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-lg bg-rose-600 text-white font-mono">
                                    {activePricing.discPct.toLocaleString('fa-IR')}٪
                                  </span>
                                  <span className="text-[11px] line-through text-stone-400 font-mono">
                                    {activePricing.refOrig.toLocaleString('fa-IR')}
                                  </span>
                                </div>
                              )}
                              <div className="text-sm font-extrabold text-stone-900 dark:text-stone-100 font-mono flex items-baseline gap-1">
                                <span>{(currentPkg.priceToman * cardQty).toLocaleString('fa-IR')}</span>
                                <span className="text-[10.5px] font-sans font-bold text-stone-500">تومان</span>
                                {cardQty > 1 && (
                                  <span className="text-[9.5px] text-emerald-700 dark:text-emerald-400 font-sans mr-1">
                                    ({cardQty.toLocaleString('fa-IR')} عدد)
                                  </span>
                                )}
                              </div>
                              {activePricing.unitPriceActual > 0 && (
                                <div className="text-[9.5px] text-stone-500 dark:text-stone-400 font-mono">
                                  هر {baseUnitLabel}: {activePricing.unitPriceActual.toLocaleString('fa-IR')} ت
                                  {activePricing.discAmt > 0 && !currentPkg.isOutOfStock
                                    ? ` · سود ${activePricing.discAmt.toLocaleString('fa-IR')} ت`
                                    : ''}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Quantity Stepper on Card */}
                              {prod.inStock && !currentPkg.isOutOfStock && (
                                <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCardQtyMap((prev) => ({
                                        ...prev,
                                        [prod.id]: Math.max(1, (prev[prod.id] ?? 1) - 1),
                                      }))
                                    }
                                    className="w-6 h-6 rounded-lg bg-white dark:bg-stone-700 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center shadow-2xs"
                                    title="کاهش تعداد"
                                  >
                                    -
                                  </button>
                                  <span className="w-5 text-center font-mono text-[11px] font-bold">
                                    {cardQty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCardQtyMap((prev) => ({
                                        ...prev,
                                        [prod.id]: (prev[prod.id] ?? 1) + 1,
                                      }))
                                    }
                                    className="w-6 h-6 rounded-lg bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shadow-2xs"
                                    title="افزایش تعداد"
                                  >
                                    +
                                  </button>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => openProductDrawer(prod, false)}
                                className="min-h-[38px] px-2.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-[10.5px] font-semibold transition-colors"
                              >
                                مشخصات
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  handleAddToCart(prod, currentPkg, cardQty);
                                  setCardQtyMap((prev) => ({ ...prev, [prod.id]: 1 }));
                                }}
                                disabled={!prod.inStock || Boolean(currentPkg.isOutOfStock)}
                                className={`min-h-[38px] px-3.5 py-2 rounded-xl font-bold text-[11px] shadow-sm transition-all flex items-center gap-1 ${
                                  prod.inStock && !currentPkg.isOutOfStock
                                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                    : 'bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed'
                                }`}
                              >
                                <span>🛒</span>
                                <span>
                                  {!prod.inStock
                                    ? 'ناموجود'
                                    : currentPkg.isOutOfStock
                                    ? 'نرخ ناموجود'
                                    : selectedCartQty > 0
                                    ? 'افزودن بیشتر'
                                    : 'افزودن به سبد'}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Digikala-Style Comprehensive Storefront Footer */}
            <footer
              aria-label="اطلاعات، امکانات و تماس فروشگاه"
              className="mt-6 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden"
            >
              {/* Top Row: Brand Identity, Return-to-Top, and Direct Hotline */}
              <div className="p-4 sm:p-6 border-b border-stone-200 dark:border-stone-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={appLogoSrc}
                      alt={storeSettings.workshopName}
                      className="w-11 h-11 rounded-xl object-cover border border-stone-200 dark:border-stone-700 bg-white shrink-0 shadow-xs"
                    />
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-stone-100 truncate">
                        {storeSettings.workshopName}
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                        {storeSettings.appTagline || 'عرضه مستقیم کودهای ارگانیک، ورمیکمپوست، زئولیت معدنی و مشاوره تخصصی کشاورزی'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 hover:bg-stone-100 dark:bg-stone-800/70 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>بازگشت به بالا</span>
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Support & Working Hours Metadata Strip */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-800/50 px-3.5 py-2.5 rounded-xl border border-stone-200/70 dark:border-stone-800">
                  <a
                    href={`tel:${(storeSettings.supportPhone || '').replace(/[^0-9+]/g, '')}`}
                    className="inline-flex items-center gap-1.5 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span className="font-semibold">تلفن پشتیبانی:</span>
                    <span dir="ltr" className="font-mono tabular-nums font-bold text-stone-900 dark:text-stone-100">
                      {storeSettings.supportPhone}
                    </span>
                  </a>
                  <span className="hidden sm:inline text-stone-300 dark:text-stone-700">|</span>
                  <div className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>{storeSettings.workingHours || 'پاسخگویی و ارسال: شنبه تا پنج‌شنبه، ۸:۰۰ تا ۱۸:۰۰'}</span>
                  </div>
                  <span className="hidden sm:inline text-stone-300 dark:text-stone-700">|</span>
                  <div className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>عرضه مستقیم از انبار کارگاه (بدون واسطه)</span>
                  </div>
                </div>
              </div>

              {/* Trust & Capabilities Highlights Strip (Digikala Icons Bar) */}
              <div
                className={`px-4 sm:px-6 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-950/40 grid ${
                  isMobilePreview ? 'grid-cols-2 gap-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'
                }`}
              >
                <div className="flex flex-col items-center text-center gap-1.5 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="text-[11.5px] font-bold text-stone-800 dark:text-stone-100">ارسال به ۳۱ استان</div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    باربری، تیپاکس و تحویل حضوری
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openConsultantChat}
                  className="flex flex-col items-center text-center gap-1.5 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800 hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div className="text-[11.5px] font-bold text-stone-800 dark:text-stone-100">مشاوره مهندس صفری</div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold leading-relaxed">
                    گفتگوی آنلاین و تلفنی رایگان
                  </div>
                </button>

                <div className="flex flex-col items-center text-center gap-1.5 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="text-[11.5px] font-bold text-stone-800 dark:text-stone-100">ضمانت آنالیز آزمایشگاهی</div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    تضمین خلوص، PH و عاری از علف هرز
                  </div>
                </div>

                <div className="flex flex-col items-center text-center gap-1.5 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <div className="text-[11.5px] font-bold text-stone-800 dark:text-stone-100">پیش‌فاکتور فروش آنلاین</div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    صدور آنی فاکتور با مهر معتبر کارگاه
                  </div>
                </div>

                <div
                  className={`flex flex-col items-center text-center gap-1.5 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800 ${
                    isMobilePreview ? 'col-span-2' : 'col-span-2 sm:col-span-1'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                    <PackageCheck className="w-5 h-5" />
                  </div>
                  <div className="text-[11.5px] font-bold text-stone-800 dark:text-stone-100">خرده تا تناژ صنعتی</div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    از بسته‌بندی خانگی تا سفارش عمده باغ
                  </div>
                </div>
              </div>

              {/* Main 4-Column Storefront Directory, Contact & Trust Seal */}
              <div
                className={`p-4 sm:p-6 border-b border-stone-200 dark:border-stone-800 grid ${
                  isMobilePreview ? 'grid-cols-1 gap-6' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'
                }`}
              >
                {/* Col 1: Website Features & Smart Tools */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-stone-900 dark:text-stone-100 pb-1.5 border-b border-stone-100 dark:border-stone-800">
                    امکانات هوشمند فروشگاه
                  </h3>
                  <ul className="space-y-2 text-[11.5px]">
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('all');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 text-stone-400" />
                        <span>کاتالوگ محصولات و نرخ روز کارگاه</span>
                      </button>
                    </li>
                    {calculatorEnabled && (
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileTab('calculator');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 text-stone-400" />
                          <span>محاسبه‌گر تخصصی دوز مصرف کود</span>
                        </button>
                      </li>
                    )}
                    <li>
                      <button
                        type="button"
                        onClick={openConsultantChat}
                        className="text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 text-stone-400" />
                        <span>گفتگوی تخصصی آنلاین با مهندس صفری</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileTab('tips');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 text-stone-400" />
                        <span>نکات طلایی، سمپاشی و معرفی صوتی</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileTab('weather');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 text-stone-400" />
                        <span>هواشناسی کشاورزی و هشدار یخبندان</span>
                      </button>
                    </li>
                  </ul>
                </div>

                {/* Col 2: Customer Services & Order Flow */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-stone-900 dark:text-stone-100 pb-1.5 border-b border-stone-100 dark:border-stone-800">
                    خدمات مشتریان و خرید
                  </h3>
                  <ul className="space-y-2 text-[11.5px]">
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileTab('cart');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 text-stone-400" />
                        <span>
                          سبد خرید یکپارچه{' '}
                          {cartTotals.totalItemsCount > 0 ? `(${cartTotals.totalItemsCount} قلم)` : ''}
                        </span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileTab('orders');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 text-stone-400" />
                        <span>پیگیری سفارشات و مشاهده پیش‌فاکتور</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          if (currentUser) {
                            setMobileTab('profile');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          } else {
                            openAuthModal('login');
                          }
                        }}
                        className="text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 text-stone-400" />
                        <span>{currentUser ? 'پروفایل کاربری و نشانی ثبت‌شده' : 'ورود / عضویت و ثبت نشانی'}</span>
                      </button>
                    </li>
                    <li className="pt-1 text-[10.5px] text-stone-500 dark:text-stone-400 leading-relaxed bg-stone-50 dark:bg-stone-800/40 p-2.5 rounded-lg border border-stone-100 dark:border-stone-800">
                      <span className="font-bold text-stone-700 dark:text-stone-300 block mb-0.5">
                        شرایط ارسال و تسویه:
                      </span>
                      {storeSettings.paymentTermsNotice ||
                        'تسویه پیش‌فاکتور پیش از بارگیری؛ ارسال با باربری مجاز یا تحویل مستقیم درب کارگاه.'}
                    </li>
                  </ul>
                </div>

                {/* Col 3: Direct Contact & Address */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-stone-900 dark:text-stone-100 pb-1.5 border-b border-stone-100 dark:border-stone-800">
                    ارتباط مستقیم و نشانی کارگاه
                  </h3>
                  <div className="space-y-2.5 text-[11.5px] text-stone-600 dark:text-stone-300">
                    <div className="flex items-start gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10.5px] text-stone-500 dark:text-stone-400">
                          واحد فروش و پشتیبانی (مشاور: {storeSettings.salesAdvisorName || 'مهندس اصغری'}):
                        </div>
                        <a
                          href={`tel:${(storeSettings.supportPhone || '').replace(/[^0-9+]/g, '')}`}
                          dir="ltr"
                          className="font-mono tabular-nums font-bold text-stone-900 dark:text-stone-100 hover:text-emerald-700 dark:hover:text-emerald-400"
                        >
                          {storeSettings.supportPhone}
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Headphones className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10.5px] text-stone-500 dark:text-stone-400">
                          {storeSettings.agronomistName || 'مهندس صفری'} ({storeSettings.agronomistTitle || 'کارشناس ارشد'}):
                        </div>
                        <a
                          href={`tel:${(storeSettings.agronomistPhone || '').replace(/[^0-9+]/g, '')}`}
                          dir="ltr"
                          className="font-mono tabular-nums font-bold text-stone-900 dark:text-stone-100 hover:text-emerald-700 dark:hover:text-emerald-400"
                        >
                          {storeSettings.agronomistPhone}
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div className="leading-relaxed">
                        <span className="font-semibold text-stone-800 dark:text-stone-200">نشانی کارگاه: </span>
                        {storeSettings.managerAddress ||
                          storeSettings.workshopAddress ||
                          'استان تهران، شهرستان فیروزکوه، واحد تولید و فرآوری ورمیکمپوست'}
                      </div>
                    </div>

                    {storeSettings.managerEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        <a
                          href={`mailto:${storeSettings.managerEmail}`}
                          dir="ltr"
                          className="font-mono text-[11px] hover:text-emerald-700 dark:hover:text-emerald-400 break-all"
                        >
                          {storeSettings.managerEmail}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Col 4: Official Seal Badge & Instant App Install */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-stone-900 dark:text-stone-100 pb-1.5 border-b border-stone-100 dark:border-stone-800">
                    نشان اعتبار و نصب اپلیکیشن
                  </h3>
                  <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 flex flex-col items-center gap-3 text-center">
                    {(storeSettings.trustBadgeMode || 'app_logo') === 'invoice_seal' ? (
                      <StoreSealBadge settings={storeSettings} appLogoSrc={appLogoSrc} size="sm" />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-20 h-20 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-1.5 shadow-xs flex items-center justify-center overflow-hidden">
                          <img
                            src={
                              (storeSettings.trustBadgeMode || 'app_logo') === 'custom_image' &&
                              storeSettings.trustBadgeImageDataUrl
                                ? resolveAssetOrApiUrl(storeSettings.trustBadgeImageDataUrl, 'pwa-192x192.png')
                                : appLogoSrc
                            }
                            alt={storeSettings.trustBadgeTitle || 'نشان اعتبار و اصالت فروشگاه'}
                            className="w-full h-full object-contain rounded-xl"
                          />
                        </div>
                        <span className="text-[10.5px] font-bold text-stone-700 dark:text-stone-300">
                          {storeSettings.trustBadgeTitle || 'نشان اعتبار و اصالت فروشگاه'}
                        </span>
                      </div>
                    )}
                    <div className="w-full pt-2 border-t border-stone-200/80 dark:border-stone-700 space-y-2">
                      <div
                        dir="ltr"
                        className="text-[10.5px] font-mono text-stone-500 dark:text-stone-400 truncate select-all"
                      >
                        {activePublicSiteUrl}
                      </div>
                      {onOpenInstallModal && (
                        <button
                          type="button"
                          onClick={onOpenInstallModal}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors whitespace-nowrap"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>نصب فوری اپلیکیشن موبایل</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom About Workshop & Legal Copyright Strip */}
              <div className="px-4 sm:px-6 py-4 bg-stone-50/80 dark:bg-stone-950/60 space-y-2.5">
                <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                  <strong className="text-stone-800 dark:text-stone-200">{storeSettings.workshopName}:</strong>{' '}
                  {storeSettings.managerBioNote ||
                    storeSettings.invoiceFooterNote ||
                    'مرجع تخصصی تولید و عرضه مستقیم انواع ورمیکمپوست خالص، زئولیت معدنی، کود مایع ورمی‌تی و بستر کشت استاندارد با پشتیبانی فنی مهندس صفری و ارسال تضمینی به سراسر ایران.'}
                </p>
                <div className="pt-2.5 border-t border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                  <span>
                    تمامی حقوق مادی و معنوی این فروشگاه متعلق به{' '}
                    <strong className="text-stone-700 dark:text-stone-300">{storeSettings.workshopName}</strong> است.
                  </span>
                  <div className="flex items-center gap-3 font-mono tabular-nums" dir="ltr">
                    <span className="font-bold text-stone-700 dark:text-stone-300">© 2011-2026</span>
                    <span className="text-stone-300 dark:text-stone-700">|</span>
                    <span dir="rtl">{deviceClock.weekdayDateStr}</span>
                  </div>
                </div>
              </div>
            </footer>
          </>
        )}

        {/* ===================== TAB 2: ADVANCED FERTILIZER CALCULATOR ===================== */}
        {mobileTab === 'calculator' && (
          <div className={isMobilePreview ? 'space-y-4' : 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start'}>
            
            {/* Header Card */}
            <div className={`${isMobilePreview ? '' : 'lg:col-span-5'} bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-5 border border-stone-200 dark:border-stone-800 shadow-sm`}>
              <div className="flex items-center gap-2 mb-2 text-emerald-800 dark:text-emerald-400">
                <span className="text-2xl">🧮</span>
                <div>
                  <h2 className="text-xs font-bold">محاسبه‌گر تخصصی فرمول دوز و طریقه مصرف (متصل به انبار)</h2>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400">
                    پیشنهاد علمی مهندس صفری هماهنگ با موجودی لحظه‌ای فروشگاه
                  </p>
                </div>
              </div>

              {/* Plant Category Filter Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 mt-3 text-[10px] font-semibold">
                {[
                  { id: 'all', label: 'همه رسته‌ها' },
                  { id: 'orchard', label: 'باغات و میوه' },
                  { id: 'houseplants', label: 'گیاهان آپارتمانی' },
                  { id: 'greenhouse', label: 'گلخانه‌ها و صیفی' },
                  { id: 'farming', label: 'زراعت و زعفران' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCalcPlantCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all ${
                      calcPlantCategory === cat.id
                        ? 'bg-emerald-800 text-white font-bold'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Search input for any plant */}
              <div className="relative mt-2.5">
                <input
                  type="text"
                  value={calcSearchQuery}
                  onChange={(e) => setCalcSearchQuery(e.target.value)}
                  placeholder="جستجوی نام هر گیاه، درخت یا گل (مثال: زاموفیلیا، پسته، زعفران، سانسوریا...)"
                  className="w-full pl-8 pr-8 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
                <span className="absolute right-2.5 top-2.5 text-stone-400 text-xs">🔍</span>
                {calcSearchQuery && (
                  <button
                    onClick={() => setCalcSearchQuery('')}
                    className="absolute left-2.5 top-2.5 text-stone-400 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Select plant dropdown */}
              <div className="mt-3">
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                  انتخاب دقیق گیاه / درخت:
                </label>
                <select
                  value={currentPlant.id}
                  onChange={(e) => setSelectedPlantId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs font-semibold text-stone-900 dark:text-stone-100"
                >
                  {matchedPlants.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.categoryLabel})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Selected Tree / Plant Specifications Summary Box (Auto-updates immediately when plant changes) */}
              <div className="mt-3 rounded-xl p-3 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200">
                    🌱 مشخصات تخصصی: {currentPlant.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                    فصل بهینه: {currentPlant.scientificDose.bestMonthsFa}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-stone-700 dark:text-stone-300">
                  <span className="px-2 py-0.5 rounded bg-white/90 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-700">
                    واحد سنجش: {currentPlant.scientificDose.unitLabel}
                  </span>
                  {currentPlant.scientificDose.vermiKgPerUnit ? (
                    <span className="px-2 py-0.5 rounded bg-white/90 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-700">
                      دوز پایه ورمی: {currentPlant.scientificDose.vermiKgPerUnit} kg
                    </span>
                  ) : null}
                  {currentPlant.scientificDose.compostKgPerUnit ? (
                    <span className="px-2 py-0.5 rounded bg-white/90 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-700">
                      کمپوست: {currentPlant.scientificDose.compostKgPerUnit} kg
                    </span>
                  ) : null}
                  {currentPlant.scientificDose.zeoliteKgPerUnit ? (
                    <span className="px-2 py-0.5 rounded bg-white/90 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-700">
                      زئولیت: {currentPlant.scientificDose.zeoliteKgPerUnit} kg
                    </span>
                  ) : null}
                  {currentPlant.scientificDose.liquidTeaLiterPerUnit ? (
                    <span className="px-2 py-0.5 rounded bg-white/90 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-700">
                      ورمی‌تی: {currentPlant.scientificDose.liquidTeaLiterPerUnit} لیتر
                    </span>
                  ) : null}
                </div>
                <p className="text-[10.5px] text-emerald-950/90 dark:text-emerald-200/90 leading-relaxed">
                  {currentPlant.scientificDose.instructions}
                </p>
              </div>

              {/* Customer Field / Pot Profile Conditions (with Exact Tree Age for Orchards) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                {currentPlant.category === 'orchard' ? (
                  <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-stone-700 dark:text-stone-300">
                        سن دقیق درخت (سال):
                      </label>
                      <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400">
                        {dosageResult.ageStageLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        dir="ltr"
                        value={calcTreeAgeInput}
                        onChange={(e) => handleCalcTreeAgeChange(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs font-mono font-bold text-center"
                      />
                      <span className="text-[10px] text-stone-500 shrink-0 font-semibold">سال</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { age: 0, label: '۰ کاشت' },
                        { age: 1, label: '۱ نهال' },
                        { age: 3, label: '۳ جوان' },
                        { age: 5, label: '۵ بالغ' },
                        { age: 10, label: '۱۰ بارده' },
                        { age: 20, label: '۲۰ کهنسال' },
                      ].map((preset) => (
                        <button
                          key={preset.age}
                          type="button"
                          onClick={() => setCalcTreeAgeInput(String(preset.age))}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                            calcTreeAgeYears === preset.age
                              ? 'bg-emerald-800 text-white border-emerald-800 font-bold'
                              : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                      {currentPlant.category === 'houseplants' ? 'سایز گلدان / ریشه:' : 'شدت تغذیه و خاک:'}
                    </label>
                    <select
                      value={calcGrowthStage}
                      onChange={(e) => setCalcGrowthStage(e.target.value as any)}
                      className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-[11px] font-semibold"
                    >
                      <option value="young">
                        {currentPlant.category === 'houseplants' ? 'گلدان کوچک / قلمه (دوز ملایم)' : 'کشت سبک / خاک حاصلخیز'}
                      </option>
                      <option value="mature">
                        {currentPlant.category === 'houseplants' ? 'گلدان متوسط استاندارد' : 'کشت استاندارد تجاری'}
                      </option>
                      <option value="veteran">
                        {currentPlant.category === 'houseplants' ? 'گلدان بزرگ / درختچه آپارتمانی' : 'خاک فقیر / برداشت سنگین'}
                      </option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                    بافت خاک / شوری آب:
                  </label>
                  <select
                    value={calcSoilCondition}
                    onChange={(e) => setCalcSoilCondition(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-[11px] font-semibold"
                  >
                    <option value="normal">معمولی / شیرین و لومی</option>
                    <option value="saline_heavy">آب یا خاک شور / رسی سنگین</option>
                  </select>
                </div>
              </div>

              {/* Formulation Strategy Selector (Smart Inventory + Combo + Pure Vermi / Houseplant) */}
              <div className="mt-3">
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                  نوع پیشنهاد فرمولاسیون کودی:
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setCalcStrategy('smart_auto')}
                    className={`p-2 rounded-xl text-right border transition-all ${
                      calcStrategy === 'smart_auto'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    <div>✨ هوشمند انبار</div>
                    <div className="text-[9px] text-stone-500 mt-0.5">متناسب با موجودی</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCalcStrategy('combo')}
                    className={`p-2 rounded-xl text-right border transition-all ${
                      calcStrategy === 'combo'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    <div>🌿 پکیج ترکیبی</div>
                    <div className="text-[9px] text-stone-500 mt-0.5">ورمی + کمپوست + زئولیت</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCalcStrategy(currentPlant.category === 'houseplants' ? 'trio_houseplant' : 'vermi_only')}
                    className={`p-2 rounded-xl text-right border transition-all ${
                      calcStrategy === 'vermi_only' || calcStrategy === 'trio_houseplant'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    <div>{currentPlant.category === 'houseplants' ? '🪴 پکیج گلدان' : '⭐ ورمی خالص'}</div>
                    <div className="text-[9px] text-stone-500 mt-0.5">
                      {currentPlant.category === 'houseplants' ? 'ورمی+قهوه+تی' : 'تک‌محصول درجه ۱'}
                    </div>
                  </button>
                </div>
              </div>

              {/* Unit quantity input (defaults cleanly to 0 when cleared!) */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                    مقدار / تعداد ({currentPlant.scientificDose.unitLabel}):
                  </label>
                  {calcUnitsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setCalcUnitsInput('0')}
                      className="text-[10px] text-stone-400 hover:text-red-500 font-semibold"
                    >
                      صفر کردن (۰)
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={calcUnitsInput}
                    onChange={(e) => handleCalcUnitsChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-sm font-mono font-bold text-center focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                  <span className="text-xs text-stone-500 shrink-0 font-semibold">
                    {currentPlant.scientificDose.unitLabel}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[0, 5, 20, 50, 100, 500].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCalcUnitsInput(String(preset))}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono border transition-colors ${
                        calcUnitsCount === preset
                          ? 'bg-emerald-800 text-white border-emerald-800 font-bold'
                          : 'bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      {preset.toLocaleString('fa-IR')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scientific & Stock-Aware Recommendation Result Card */}
            <div className={`${isMobilePreview ? '' : 'lg:col-span-7'} bg-gradient-to-br from-emerald-950 via-stone-900 to-emerald-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-emerald-700/50 space-y-3.5`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-700/90 text-emerald-50">
                    فرمول اختصاصی برای {dosageResult.plantName}
                  </span>
                  {dosageResult.ageStageLabel && (
                    <span className="text-[10.5px] font-semibold text-amber-200">
                      · {dosageResult.ageStageLabel}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-emerald-300 font-mono">
                  زمان بهینه: {dosageResult.bestMonths}
                </span>
              </div>

              {/* Live Inventory Adaptation Notice if any item was out-of-stock and substituted */}
              {dosageResult.adaptationNotes.length > 0 && (
                <div className="bg-amber-500/15 border border-amber-400/40 rounded-xl p-2.5 text-[11px] text-amber-200 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <span>🔄</span>
                    <span>بهینه‌سازی خودکار بر اساس موجودی انبار:</span>
                  </div>
                  {dosageResult.adaptationNotes.map((note, idx) => (
                    <p key={idx} className="leading-relaxed text-amber-100/90">• {note}</p>
                  ))}
                </div>
              )}

              {calcUnitsCount <= 0 ? (
                <div className="bg-white/10 rounded-xl p-4 text-center text-xs text-stone-200 border border-white/10">
                  مقدار فعلی <strong>۰ (صفر)</strong> است. تعداد یا متراژ مورد نظر خود را در کادر بالا وارد کنید تا فرمول دوز، بسته‌بندی متناسب با موجودی انبار و طریقه مصرف محاسبه شود.
                </div>
              ) : (
                <>
                  {/* Matched In-Stock Storefront Products & Packages */}
                  <div className="space-y-2">
                    {dosageResult.lines.map(line => (
                      <div
                        key={line.key}
                        className={`rounded-xl p-3 border text-xs ${
                          line.stockStatus === 'out'
                            ? 'bg-red-950/40 border-red-700/50'
                            : line.stockStatus === 'partial'
                            ? 'bg-amber-950/30 border-amber-600/50'
                            : 'bg-white/10 border-white/15'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{line.product.name}</span>
                              {line.formulaSharePercent > 0 && (
                                <span className="text-[9px] bg-emerald-700/80 text-emerald-100 px-1.5 py-0.5 rounded font-mono">
                                  سهم {line.formulaSharePercent}٪
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-emerald-200 mt-0.5">
                              بسته‌بندی پیشنهادی: <strong>{line.selectedPkg.title || line.selectedPkg.weightOrVolume}</strong> · دوز هر واحد: <strong className="font-mono">{line.perUnitDoseLabel}</strong>
                            </div>
                          </div>

                          <div className="text-left shrink-0">
                            <div className="text-sm font-extrabold font-mono text-amber-300">
                              {line.requiredUnits.toLocaleString('fa-IR')} عدد
                            </div>
                            <div className="text-[9px] text-stone-300 font-mono">
                              جمع: {line.totalAmount.toLocaleString('fa-IR')} {line.amountUnitLabel}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                          {line.stockStatus === 'ok' ? (
                            <span className="text-emerald-300 font-semibold">
                              ✓ موجود در انبار{showStockCount ? ` (${line.product.stockQuantity} ${line.product.stockUnit})` : ''}
                            </span>
                          ) : line.stockStatus === 'partial' ? (
                            <span className="text-amber-300 font-semibold">
                              ⚠️ موجودی فعلی: {line.orderableUnits} بسته قابل تحویل فوری
                            </span>
                          ) : (
                            <span className="text-red-300 font-semibold">
                              ✕ در انبار ناموجود است
                            </span>
                          )}

                          {line.orderableUnits > 0 && (
                            <span className="font-mono font-bold text-stone-100">
                              {line.linePriceToman.toLocaleString('fa-IR')} تومان
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Step-by-Step Professional Application Instructions ("طریقه مصرف تخصصی") */}
                  <div className="bg-black/25 rounded-xl p-3 border border-white/10 space-y-2 text-[11px] text-stone-200">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span>📋</span>
                      <span>فرمول اجرا و طریقه مصرف حرفه‌ای ({dosageResult.plantName}):</span>
                    </div>
                    <div className="space-y-1.5 leading-relaxed">
                      {dosageResult.applicationSteps.map((step, i) => (
                        <p key={i} className="text-stone-100">{step}</p>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-white/10 text-[10px] text-emerald-200 leading-relaxed">
                      💡 <strong>توصیه تکمیلی مهندس صفری:</strong> {dosageResult.instructions}
                    </div>
                  </div>

                  {/* Total Estimate & 1-Click Action */}
                  {dosageResult.totalPriceToman > 0 && (
                    <div className="flex items-center justify-between px-1 text-xs">
                      <span className="text-stone-300">برآورد هزینه اقلام موجود پکیج:</span>
                      <span className="font-mono font-extrabold text-amber-300 text-sm">
                        {dosageResult.totalPriceToman.toLocaleString('fa-IR')} تومان
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleAddCalculatedPackToCart}
                    disabled={dosageResult.allOutOfStock}
                    className={`w-full py-2.5 font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 ${
                      dosageResult.allOutOfStock
                        ? 'bg-stone-600 text-stone-300 cursor-not-allowed'
                        : 'bg-amber-400 hover:bg-amber-300 text-stone-950'
                    }`}
                  >
                    <span>🛒</span>
                    <span>
                      {dosageResult.allOutOfStock
                        ? 'اقلام فرمول فعلاً در انبار ناموجود است'
                        : 'افزودن پکیج متناسب با موجودی انبار به سبد خرید'}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 2.5: GOLDEN GARDENING & FARMING TIPS ===================== */}
        {mobileTab === 'tips' && (
          <div className="space-y-4 pb-6 animate-fade-in">
            {/* Hero Banner */}
            <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-stone-900 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-emerald-700/40 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-amber-300 border-b border-amber-400/50 pb-0.5">
                  <span>✨</span>
                  <span>دانش‌نامه کاربردی مزرعه، باغ و آپارتمان</span>
                </span>
                <span className="text-[10.5px] text-emerald-200 font-semibold">
                  مشاور تخصصی: {storeSettings.agronomistName}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white leading-snug">
                مشاور هوشمند تخصصی و نکات طلایی باغبانی، سمپاشی و تغذیه زیستی
              </h2>
              <p className="text-[11px] sm:text-xs text-emerald-100/90 leading-relaxed">
                دسترسی سریع به پرسش‌وپاسخ تخصصی، بانک سوالات پرتکرار، تقویم چهارفصل تغذیه و {AGRICULTURAL_GOLDEN_TIPS.length.toLocaleString('fa-IR')} تکنیک اثبات‌شده برای افزایش باردهی و اصلاح خاک.
              </p>
            </div>

            {/* Sticky Floating Navigation Dock (2 Main Sections) */}
            <div className="sticky top-[92px] sm:top-[100px] z-20">
              <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl p-1.5 border border-emerald-200/90 dark:border-emerald-800/80 shadow-lg shadow-emerald-950/10 space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = tipsSectionFocus === 'consultant' ? 'all' : 'consultant';
                      setTipsSectionFocus(next);
                      setTimeout(() => {
                        consultantSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 40);
                    }}
                    className={`flex items-center justify-center gap-2 px-2.5 py-2.5 rounded-xl text-right transition-all border ${
                      tipsSectionFocus === 'consultant'
                        ? 'bg-gradient-to-l from-emerald-800 to-teal-800 text-white border-emerald-700 shadow-sm'
                        : tipsSectionFocus === 'all'
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-950 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800/70'
                        : 'bg-stone-50 dark:bg-stone-800/70 hover:bg-stone-100 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-amber-400 text-stone-950 flex items-center justify-center shrink-0 text-sm shadow-2xs">
                      🤖
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] sm:text-xs font-extrabold truncate">
                        مشاور هوشمند و سوالات پرتکرار
                      </div>
                      <div
                        className={`text-[9.5px] truncate ${
                          tipsSectionFocus === 'consultant'
                            ? 'text-emerald-100'
                            : 'text-stone-500 dark:text-stone-400'
                        }`}
                      >
                        پاسخ فوری و منوی کشویی تخصصی
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = tipsSectionFocus === 'golden_tips' ? 'all' : 'golden_tips';
                      setTipsSectionFocus(next);
                      setTimeout(() => {
                        goldenTipsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 40);
                    }}
                    className={`flex items-center justify-center gap-2 px-2.5 py-2.5 rounded-xl text-right transition-all border ${
                      tipsSectionFocus === 'golden_tips'
                        ? 'bg-gradient-to-l from-amber-600 to-emerald-800 text-white border-amber-500 shadow-sm'
                        : tipsSectionFocus === 'all'
                        ? 'bg-amber-50/80 dark:bg-amber-950/30 hover:bg-amber-100/80 text-stone-900 dark:text-amber-100 border-amber-200 dark:border-amber-800/70'
                        : 'bg-stone-50 dark:bg-stone-800/70 hover:bg-stone-100 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 text-sm shadow-2xs">
                      🌿
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] sm:text-xs font-extrabold truncate">
                        نکات طلایی و تقویم فصلی
                      </div>
                      <div
                        className={`text-[9.5px] truncate ${
                          tipsSectionFocus === 'golden_tips'
                            ? 'text-amber-100'
                            : 'text-stone-500 dark:text-stone-400'
                        }`}
                      >
                        {AGRICULTURAL_GOLDEN_TIPS.length.toLocaleString('fa-IR')} نکته باغبانی، سمپاشی و خاک
                      </div>
                    </div>
                  </button>
                </div>

                {tipsSectionFocus !== 'all' && (
                  <div className="flex items-center justify-between px-2 py-1 rounded-xl bg-stone-100/80 dark:bg-stone-800/70 text-[10px] text-stone-600 dark:text-stone-300">
                    <span>
                      نمای فعلی:{' '}
                      <strong className="text-emerald-800 dark:text-emerald-300">
                        {tipsSectionFocus === 'consultant'
                          ? 'بخش ۱ (مشاور هوشمند و سوالات پرتکرار)'
                          : 'بخش ۲ (نکات طلایی باغبانی و تقویم فصلی)'}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setTipsSectionFocus('all')}
                      className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                    >
                      نمایش همزمان هر دو بخش ⇅
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Section 1: Virtual Consultant Text Chat + Frequent Questions Dropdown */}
            {(tipsSectionFocus === 'all' || tipsSectionFocus === 'consultant') && (
            <div
              ref={consultantSectionRef}
              className="scroll-mt-36 bg-white dark:bg-stone-900 rounded-2xl border-2 border-emerald-500/40 dark:border-emerald-700/60 shadow-md overflow-hidden"
            >
              <div className="bg-gradient-to-l from-emerald-800 via-emerald-900 to-teal-950 text-white p-3.5 sm:p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center shadow-sm shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5 flex-wrap">
                      <span>گفتگو با مهندس صفری (مشاور مجازی باغبانی)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-400/20 border border-emerald-300/40 text-emerald-100">
                        پاسخ هوشمند تخصصی
                      </span>
                    </h3>
                    <p className="text-[10.5px] text-emerald-100/85 truncate mt-0.5">
                      پرسش‌وپاسخ آنلاین بر اساس بانک گیاهان کارگاه و شرایط شهر {customerWeatherCity}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConsultantMessages((prev) => prev.slice(0, 1))
                  }
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white shrink-0"
                >
                  شروع گفتگو جدید
                </button>
              </div>

              {/* Frequent Questions Dropdown + Professional Advisor Answer */}
              <div className="p-3.5 sm:p-4 bg-emerald-50/70 dark:bg-emerald-950/25 border-b border-emerald-200/80 dark:border-emerald-900/60 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-950 dark:text-emerald-200">
                    <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>منوی کشویی سوالات پرتکرار و پاسخ مشاور حرفه‌ای</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-stone-900 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    انتخاب سریع سوال تخصصی
                  </span>
                </div>

                {/* Category Filter + Dropdown Select */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                      موضوع تخصصی:
                    </label>
                    <select
                      value={faqCategoryFilter}
                      onChange={(e) => setFaqCategoryFilter(e.target.value as ConsultantFaqCategory)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    >
                      {CONSULTANT_FAQ_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-8">
                    <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                      انتخاب سوال پرتکرار از منوی کشویی ({filteredFaqItems.length.toLocaleString('fa-IR')} مورد):
                    </label>
                    <select
                      value={selectedFaqItem?.id || ''}
                      onChange={(e) => setSelectedFaqId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-emerald-400 dark:border-emerald-700 text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    >
                      {filteredFaqItems.map((faq) => (
                        <option key={faq.id} value={faq.id}>
                          [{faq.categoryLabel}] {faq.question}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Instant Professional Advisor Answer Card */}
                {selectedFaqItem && (
                  <div className="bg-white dark:bg-stone-900 rounded-2xl p-3.5 border border-emerald-200 dark:border-emerald-800/80 shadow-xs space-y-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="font-extrabold text-emerald-950 dark:text-emerald-200 leading-snug">
                        ❓ {selectedFaqItem.question}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 shrink-0">
                        {selectedFaqItem.categoryLabel}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700/80 space-y-1">
                      <div className="text-[10.5px] font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>پاسخ مشاور حرفه‌ای ({storeSettings.agronomistName || 'مهندس صفری'}):</span>
                      </div>
                      <p className="text-[11.5px] text-stone-700 dark:text-stone-200 leading-relaxed">
                        {selectedFaqItem.advisorAnswer}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70">
                        <div className="font-bold text-emerald-900 dark:text-emerald-300 text-[10px] mb-0.5">
                          📏 دوز و روش استاندارد مصرف:
                        </div>
                        <div className="text-stone-800 dark:text-stone-200 font-semibold leading-relaxed">
                          {selectedFaqItem.dosageHighlight}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70">
                        <div className="font-bold text-amber-900 dark:text-amber-300 text-[10px] mb-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>توصیه و هشدار ایمنی کارشناس:</span>
                        </div>
                        <div className="text-stone-800 dark:text-stone-200 leading-relaxed">
                          {selectedFaqItem.cautionNote}
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
                      {(() => {
                        const matchedProduct = products.find(
                          (p) => p.id === selectedFaqItem.recommendedProductId
                        );
                        return matchedProduct ? (
                          <button
                            type="button"
                            onClick={() => openProductDrawer(matchedProduct, false)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition-colors"
                          >
                            🛒 مشاهده محصول پیشنهادی: {matchedProduct.name}
                          </button>
                        ) : (
                          <span className="text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300">
                            🌿 محصول پیشنهادی: {selectedFaqItem.recommendedProductName}
                          </span>
                        );
                      })()}

                      <button
                        type="button"
                        disabled={isConsultantLoading}
                        onClick={() =>
                          handleSendConsultantMessage(
                            `در ادامه این سوال تخصصی («${selectedFaqItem.question}»)، برای شهر ${customerWeatherCity} چه برنامه تکمیلی پیشنهاد می‌کنید؟`
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/50 hover:bg-amber-200 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-[11px] font-bold transition-colors"
                      >
                        💬 دریافت برنامه اختصاصی شهر {customerWeatherCity}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Messages Viewport */}
              <div className="p-3.5 sm:p-4 space-y-3 max-h-80 overflow-y-auto bg-stone-50/70 dark:bg-stone-950/60">
                {consultantMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs ${
                        msg.role === 'user'
                          ? 'bg-emerald-700 text-white rounded-tr-sm'
                          : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 rounded-tl-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-80">
                        <span className="font-bold">
                          {msg.role === 'user' ? (currentUser?.role === 'customer' ? currentUser.fullName : 'شما') : '🌿 مهندس صفری (مشاور کارگاه)'}
                        </span>
                        <span className="font-mono">{msg.timestamp}</span>
                      </div>
                      <div className="whitespace-pre-line">{msg.text}</div>
                    </div>
                  </div>
                ))}

                {isConsultantLoading && (
                  <div className="flex justify-end">
                    <div className="bg-white dark:bg-stone-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-3.5 py-2 text-[11px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>مهندس صفری در حال تنظیم نسخه علمی پاسخ شما است...</span>
                    </div>
                  </div>
                )}

                {consultantError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300 font-bold">
                    ⚠️ {consultantError}
                  </div>
                )}
                <div ref={consultantChatEndRef} />
              </div>

              {/* Suggestion Chips + Input Form */}
              <div className="p-3 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 space-y-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {[
                    'برنامه کودی درخت پسته؟',
                    'خاک مناسب گیاهان آپارتمانی؟',
                    'اصول صحیح سمپاشی بدون گیاه‌سوزی؟',
                    'رفع شوری خاک و تقویت ریشه؟',
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={isConsultantLoading}
                      onClick={() => handleSendConsultantMessage(q)}
                      className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 text-[10.5px] font-semibold whitespace-nowrap shrink-0 transition-colors"
                    >
                      💡 {q}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSendConsultantMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={consultantInputRef}
                    type="text"
                    value={consultantInput}
                    onChange={(e) => setConsultantInput(e.target.value)}
                    placeholder="سوال باغبانی، کودی یا سمپاشی خود را از مهندس صفری بپرسید..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isConsultantLoading || !consultantInput.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>ارسال</span>
                  </button>
                </form>
              </div>
            </div>
            )}

            {/* Section 2: Seasonal Golden Calendar + Golden Tips Knowledge Base */}
            {(tipsSectionFocus === 'all' || tipsSectionFocus === 'golden_tips') && (
            <div ref={goldenTipsSectionRef} className="space-y-4 scroll-mt-36">
              {/* Sleek Section 2 Header */}
              <div className="bg-gradient-to-l from-amber-50 via-white to-emerald-50 dark:from-amber-950/30 dark:via-stone-900 dark:to-emerald-950/30 rounded-2xl p-3.5 sm:p-4 border border-amber-200/80 dark:border-amber-800/60 shadow-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center text-base shadow-xs shrink-0">
                    🌿
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-stone-100">
                      نکات طلایی باغبانی، سمپاشی و تقویم فصلی تغذیه
                    </h3>
                    <p className="text-[10.5px] text-stone-500 dark:text-stone-400">
                      {AGRICULTURAL_GOLDEN_TIPS.length.toLocaleString('fa-IR')} تکنیک کاربردی به همراه راهنمای صوتی و ارتباط با دوز مصرف
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTipsSectionFocus('consultant');
                    setTimeout(() => {
                      consultantSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 40);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-800/10 hover:bg-emerald-800/20 text-emerald-800 dark:text-emerald-300 text-[10.5px] font-bold border border-emerald-300/60 dark:border-emerald-800 transition-colors"
                >
                  🤖 رفتن به بخش مشاور هوشمند
                </button>
              </div>

            {/* Seasonal Golden Calendar Strip */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5 px-1">
                <span>🗓️</span>
                <span>تقویم طلایی تغذیه در فصول مختلف سال</span>
              </h3>
              <div className={isMobilePreview ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'}>
                {SEASONAL_GOLDEN_CALENDAR.map((seasonCard) => (
                  <div
                    key={seasonCard.season}
                    className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3 flex items-start gap-2.5"
                  >
                    <span className="text-xl shrink-0 mt-0.5">{seasonCard.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                          {seasonCard.season}
                        </span>
                        <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 tabular-nums">
                          {seasonCard.months}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-stone-800 dark:text-stone-200 mt-1">
                        🎯 {seasonCard.focus}
                      </div>
                      <p className="text-[10.5px] text-stone-600 dark:text-stone-400 mt-0.5 leading-relaxed">
                        {seasonCard.dosageNote}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Search & Category Filters */}
            <div className="space-y-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={tipSearchQuery}
                  onChange={(e) => setTipSearchQuery(e.target.value)}
                  placeholder="جستجو در نکات طلایی (مثلاً: چالکود، زاموفیلیا، شوری، گلخانه...)"
                  className="w-full pl-8 pr-9 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
                <span className="absolute right-3 top-2.5 text-stone-400 text-xs">🔍</span>
                {tipSearchQuery && (
                  <button
                    onClick={() => setTipSearchQuery('')}
                    className="absolute left-3 top-2.5 text-stone-400 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-semibold">
                {TIP_CATEGORIES.map((cat) => {
                  const catCount =
                    cat.id === 'all'
                      ? AGRICULTURAL_GOLDEN_TIPS.length
                      : AGRICULTURAL_GOLDEN_TIPS.filter((t) => t.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setTipCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1 ${
                        tipCategory === cat.id
                          ? 'bg-emerald-800 text-white font-bold shadow-sm'
                          : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:bg-stone-50'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                      <span
                        className={`text-[9.5px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                          tipCategory === cat.id
                            ? 'bg-emerald-950/60 text-amber-300'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                        }`}
                      >
                        {catCount.toLocaleString('fa-IR')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Golden Tips List */}
            <div className={isMobilePreview ? 'space-y-3' : 'grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start'}>
              {AGRICULTURAL_GOLDEN_TIPS.filter((tip) => {
                const matchCat = tipCategory === 'all' || tip.category === tipCategory;
                const q = tipSearchQuery.trim();
                const matchSearch =
                  !q ||
                  tip.title.includes(q) ||
                  tip.summary.includes(q) ||
                  tip.goldenTrick.includes(q) ||
                  tip.categoryLabel.includes(q);
                return matchCat && matchSearch;
              }).map((tip, tipIdx) => {
                const isExpanded = expandedTipId === tip.id;
                const matchedProd =
                  products.find((p) => p.id === tip.recommendedProductId) || products[0];
                const isTipPlaying = activeTipVoiceId === tip.id;
                const isTipLoading = tipVoiceLoadingId === tip.id;
                const hasPreGenTipVoice = Boolean(readyVoiceClips[buildTipVoiceClipId(tip.id)]);

                return (
                  <div
                    key={tip.id}
                    className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden transition-all"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedTipId(isExpanded ? null : tip.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedTipId(isExpanded ? null : tip.id);
                        }
                      }}
                      className="w-full p-4 text-right flex items-start justify-between gap-2.5 hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <span className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-lg shrink-0">
                          {tip.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-800 text-white">
                              #{(tipIdx + 1).toLocaleString('fa-IR')}
                            </span>
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                              ⭐ {tip.badge}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              · {tip.categoryLabel}
                            </span>
                          </div>
                          <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-snug">
                            {tip.title}
                          </h3>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                            {tip.summary}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleTipVoice(tip);
                          }}
                          disabled={isTipLoading}
                          title={hasPreGenTipVoice ? 'پخش فوری صوتی این نکته تخصصی' : 'گوش دادن به این نکته تخصصی'}
                          className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition-all ${
                            isTipPlaying
                              ? 'bg-amber-400 border-amber-500 text-stone-950 animate-pulse'
                              : isTipLoading
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-700 dark:text-emerald-300 cursor-wait'
                              : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                          }`}
                        >
                          {isTipLoading ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>در حال آماده...</span>
                            </>
                          ) : isTipPlaying ? (
                            <>
                              <Square className="w-3 h-3 fill-current" />
                              <span>توقف پخش</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>پخش صوتی</span>
                            </>
                          )}
                        </button>
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    {tipVoiceErrorMap[tip.id] && (
                      <div className="mx-4 mb-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[10px] text-rose-700 dark:text-rose-300">
                        ⚠️ {tipVoiceErrorMap[tip.id]}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-stone-100 dark:border-stone-800 space-y-3 text-xs animate-fade-in">
                        {/* Golden Trick Callout */}
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-100 leading-relaxed">
                          <div className="font-bold text-[11px] text-amber-800 dark:text-amber-300 mb-1 flex items-center gap-1">
                            <span>💡</span>
                            <span>ترفند طلایی و فرمول اجرا:</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">{tip.goldenTrick}</p>
                        </div>

                        {/* Execution Steps */}
                        <div className="space-y-1.5">
                          <div className="font-bold text-[11px] text-emerald-800 dark:text-emerald-400">
                            ✅ گام‌های عملی در باغ یا منزل:
                          </div>
                          <ul className="space-y-1.5 text-[11px] text-stone-700 dark:text-stone-300">
                            {tip.steps.map((step, i) => (
                              <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                                <span className="w-4 h-4 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Common Mistake Warning */}
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed">
                          <strong>⛔ اشتباه رایج که باید پرهیز کنید:</strong> {tip.commonMistake}
                        </div>

                        <div className="flex items-center justify-between text-[10.5px] text-stone-500 pt-1">
                          <span>🕒 بهترین زمان: <strong className="text-stone-800 dark:text-stone-200">{tip.bestSeason}</strong></span>
                        </div>

                        {/* Quick Action Links to Product or Calculator */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {matchedProd && (
                            <button
                              type="button"
                              onClick={() => openProductDrawer(matchedProd, false)}
                              className="py-2 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
                            >
                              <span>🌿</span>
                              <span className="truncate">{tip.recommendedProductLabel}</span>
                            </button>
                          )}
                          {calculatorEnabled && (
                            <button
                              type="button"
                              onClick={() => setMobileTab('calculator')}
                              className="py-2 px-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
                            >
                              <span>🧮</span>
                              <span>محاسبه دوز دقیق</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {AGRICULTURAL_GOLDEN_TIPS.filter((tip) => {
                const matchCat = tipCategory === 'all' || tip.category === tipCategory;
                const q = tipSearchQuery.trim();
                const matchSearch =
                  !q ||
                  tip.title.includes(q) ||
                  tip.summary.includes(q) ||
                  tip.goldenTrick.includes(q) ||
                  tip.categoryLabel.includes(q);
                return matchCat && matchSearch;
              }).length === 0 && (
                <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 text-center border border-stone-200 dark:border-stone-800 text-xs text-stone-500">
                  موردی با عبارت جستجو شده پیدا نشد. دسته‌بندی «همه نکات طلایی» را انتخاب کنید.
                </div>
              )}
            </div>
            </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2B: INDEPENDENT AGRICULTURAL WEATHER ===================== */}
        {mobileTab === 'weather' && (
          <div className="space-y-4 pb-6 animate-fade-in">
            <div className="bg-gradient-to-l from-sky-900 via-emerald-950 to-stone-900 text-white rounded-2xl p-4 shadow-md border border-sky-700/40 flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <h2 className="text-sm font-bold flex items-center gap-1.5">
                  <span>🌤️</span>
                  <span>سامانه مستقل هواشناسی کشاورزی و گزارش صوتی به روز</span>
                </h2>
                <p className="text-[11px] text-sky-100/90">
                  وضعیت لحظه‌ای آب‌وهوا، دما و رطوبت خاک، سرعت باد و توصیه‌های دقیق باغبانی مطابق شهر انتخابی شما و ساعت دقیق دستگاه.
                </p>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 font-mono text-xs text-amber-200 flex items-center gap-1.5">
                <span>🕒</span>
                <span>{deviceClock.timeWithSecStr}</span>
                <span className="font-sans text-[10.5px] text-sky-100">· {deviceClock.weekdayDateStr}</span>
              </div>
            </div>

            <AgriculturalWeatherWidget
              floating={false}
              hasBottomCartBar={cart.length > 0}
              isMobilePreview={isMobilePreview}
              defaultProvince={customerWeatherProvince}
              defaultCity={customerWeatherCity}
              locationSourceNote={
                currentUser?.role === 'admin'
                  ? `بر اساس استان و شهر استقرار مدیریت (${customerWeatherProvince} - ${customerWeatherCity})`
                  : currentUser?.role === 'customer' && currentUser.city?.trim()
                  ? `بر اساس نشانی ثبت‌شده شما (${customerWeatherProvince} - ${customerWeatherCity})`
                  : undefined
              }
              onStopOtherAudio={stopActiveVoice}
            />
          </div>
        )}

        {/* ===================== TAB 3: CART & CHECKOUT ===================== */}
        {mobileTab === 'cart' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <span>🛒</span>
                <span>سبد خرید یکپارچه ({cart.length} ردیف / {cartTotals.totalItemsCount} بسته)</span>
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileTab('catalog')}
                  className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  + افزودن کالای دیگر
                </button>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    خالی کردن سبد
                  </button>
                )}
              </div>
            </div>

            {cart.length > 0 && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200">
                ✓ تمامی محصولات انتخابی شما در همین سبد خرید جمع شده‌اند و به صورت <strong>یک سفارش واحد</strong> به تاریخ امروز ثبت می‌شوند.
              </div>
            )}

            {cart.length === 0 ? (
              <div className="bg-white dark:bg-stone-900 rounded-2xl p-8 text-center border border-stone-200 dark:border-stone-800">
                <span className="text-4xl block mb-2">🧺</span>
                <p className="text-xs font-bold text-stone-700 dark:text-stone-300">سبد خرید شما خالی است</p>
                <p className="text-[11px] text-stone-400 mt-1">محصولات مورد نیاز یا سهمیه محاسبه‌شده باغ را اضافه نمایید.</p>
                <button
                  onClick={() => setMobileTab('catalog')}
                  className="mt-4 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800"
                >
                  مشاهده کاتالوگ محصولات
                </button>
              </div>
            ) : (
              <div className={isMobilePreview ? 'space-y-4' : 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start'}>
                <div className={`${isMobilePreview ? '' : 'lg:col-span-7'} space-y-4`}>
                {/* Cart Items list with 60% Next-Weight Smart Upgrade Suggestion */}
                <div className="space-y-2.5">
                  {cart.map(item => {
                    const liveProd = products.find((p) => p.id === item.product.id) || item.product;
                    const unitLabel = liveProd.baseUnitLabel || (liveProd.category === 'liquid' ? 'لیتر' : 'کیلوگرم');
                    const cartUpgrade = getNextPackageUpgradeSuggestion(
                      liveProd,
                      item.selectedPackage,
                      item.quantity
                    );
                    const showCartUpgrade =
                      Boolean(cartUpgrade) && dismissedCartUpgrade[item.id] !== item.quantity;

                    return (
                      <div key={item.id} className="space-y-1.5">
                        <div className="bg-white dark:bg-stone-900 rounded-2xl p-3 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center justify-between gap-2.5">
                          <CachedProductImage
                            product={item.product}
                            className="w-12 h-9 rounded-lg object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                              {item.product.name}
                            </h4>
                            <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                              بسته: {item.selectedPackage.title || item.selectedPackage.weightOrVolume} · فی: {item.unitPrice.toLocaleString('fa-IR')} ت
                            </div>
                            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400 font-mono mt-1">
                              {item.totalPrice.toLocaleString('fa-IR')} تومان
                            </div>
                          </div>

                          {/* Quantity control */}
                          <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
                            <button
                              onClick={() => handleUpdateCartQty(item.id, item.quantity - 1)}
                              className="w-6 h-6 rounded-lg bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-200 flex items-center justify-center text-xs font-bold shadow-xs"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-mono font-bold">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateCartQty(item.id, item.quantity + 1)}
                              className="w-6 h-6 rounded-lg bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-200 flex items-center justify-center text-xs font-bold shadow-xs"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {showCartUpgrade && cartUpgrade && (
                          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 space-y-2 text-[11px] animate-fade-in">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-extrabold text-amber-950 dark:text-amber-200">
                                💡 پیشنهاد سود بیشتر ({cartUpgrade.reachPercent.toLocaleString('fa-IR')}٪ وزن {cartUpgrade.nextPkg.weightOrVolume})
                              </span>
                              {cartUpgrade.unitSavingPercent > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white text-[9.5px] font-bold font-mono">
                                  {cartUpgrade.unitSavingPercent.toLocaleString('fa-IR')}٪ سود در فی هر {unitLabel}
                                </span>
                              )}
                            </div>
                            <p className="text-[10.5px] text-amber-900 dark:text-amber-300 leading-relaxed">
                              جمع درخواست فعلی شما <strong>{cartUpgrade.requestedWeight.toLocaleString('fa-IR')} {unitLabel}</strong> شده که از ۶۰٪ وزن بسته بزرگ‌تر{' '}
                              <strong>{cartUpgrade.nextPkg.weightOrVolume}</strong> عبور کرده است. می‌توانید{' '}
                              <strong>
                                {cartUpgrade.suggestedNextQty.toLocaleString('fa-IR')} × {cartUpgrade.nextPkg.title || cartUpgrade.nextPkg.weightOrVolume}
                              </strong>{' '}
                              را انتخاب کنید
                              {cartUpgrade.totalExtraProfitToman > 0
                                ? ` (${cartUpgrade.totalExtraProfitToman.toLocaleString('fa-IR')} تومان سود بیشتر)`
                                : ' '}
                              یا با همین تعداد قبلی ادامه دهید.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpgradeCartItemPackage(
                                    item.id,
                                    cartUpgrade.nextPkg,
                                    cartUpgrade.suggestedNextQty
                                  )
                                }
                                className="py-1.5 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-[10.5px] font-bold shadow-xs"
                              >
                                ✓ تبدیل به {cartUpgrade.suggestedNextQty} × {cartUpgrade.nextPkg.weightOrVolume}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDismissedCartUpgrade((prev) => ({
                                    ...prev,
                                    [item.id]: item.quantity,
                                  }))
                                }
                                className="py-1.5 px-2.5 bg-white dark:bg-stone-800 hover:bg-stone-100 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 rounded-xl text-[10.5px] font-bold"
                              >
                                ادامه با همین {item.quantity.toLocaleString('fa-IR')} عدد {item.selectedPackage.weightOrVolume}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Weight & Price Summary */}
                <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl p-3.5 border border-emerald-200 dark:border-emerald-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-stone-600 dark:text-stone-300">
                    <span>مجموع وزن بار:</span>
                    <span className="font-mono font-bold">
                      {cartTotals.totalWeightKg > 1000 
                        ? `${(cartTotals.totalWeightKg / 1000).toFixed(2)} تن (${cartTotals.totalWeightKg} kg)`
                        : `${cartTotals.totalWeightKg} کیلوگرم`}
                    </span>
                  </div>
                  {cartTotals.totalDiscountToman > 0 ? (
                    <>
                      <div className="flex justify-between text-stone-500 dark:text-stone-400">
                        <span>مبلغ کل (بر مبنای نرخ واحد):</span>
                        <span className="font-mono line-through">
                          {cartTotals.originalSubtotalToman.toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                      <div className="flex justify-between text-amber-700 dark:text-amber-400 font-semibold">
                        <span>تخفیف و سود شما از نرخ بسته‌بندی:</span>
                        <span className="font-mono">- {cartTotals.totalDiscountToman.toLocaleString('fa-IR')} تومان</span>
                      </div>
                      <div className="flex justify-between text-stone-700 dark:text-stone-200 font-semibold">
                        <span>جمع اقلام پس از تخفیف:</span>
                        <span className="font-mono">{cartTotals.subtotalToman.toLocaleString('fa-IR')} تومان</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-stone-600 dark:text-stone-300">
                      <span>مبلغ اقلام:</span>
                      <span className="font-mono">{cartTotals.subtotalToman.toLocaleString('fa-IR')} تومان</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-600 dark:text-stone-300">
                    <span>هزینه حمل و باربری (قیمت تخمینی):</span>
                    <span className="font-mono tabular-nums">
                      {cartTotals.freeShippingApplied ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">رایگان ✓</span>
                      ) : (
                        `${cartTotals.shippingEstimate.toLocaleString('fa-IR')} تومان`
                      )}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    ⓘ هزینه حمل و باربری نمایش‌داده‌شده «قیمت تخمینی» بر اساس وزن تقریبی و مسیر است و کرایه قطعی طبق نرخ بارنامه روز محاسبه می‌گردد.
                  </p>
                  <div className="pt-2 border-t border-emerald-300 dark:border-emerald-800 flex justify-between text-emerald-900 dark:text-emerald-200 font-bold text-sm">
                    <span>مبلغ نهایی قابل پرداخت:</span>
                    <span className="font-mono">{cartTotals.finalPayableToman.toLocaleString('fa-IR')} تومان</span>
                  </div>
                </div>

                </div>

                {/* Checkout Delivery Form */}
                <form onSubmit={handleFinalizeOrder} className={`${isMobilePreview ? '' : 'lg:col-span-5'} bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-5 border border-stone-200 dark:border-stone-800 space-y-3`}>
                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1">
                    <span>🚚</span>
                    <span>مشخصات تحویل‌گیرنده و تخلیه بار</span>
                  </h3>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                      نام و نام خانوادگی خریدار
                    </label>
                    <input
                      type="text"
                      required
                      value={checkoutName}
                      onChange={(e) => setCheckoutName(e.target.value)}
                      placeholder="مثال: مهندس حسینی"
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                        شماره همراه (جهت هماهنگی باربری)
                      </label>
                      <input
                        type="tel"
                        required
                        value={checkoutPhone}
                        onChange={(e) => setCheckoutPhone(e.target.value)}
                        placeholder="۰۹..."
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs font-mono text-left"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                        حوزه فعالیت
                      </label>
                      <select
                        value={checkoutFarmingType}
                        onChange={(e) => setCheckoutFarmingType(e.target.value as any)}
                        className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs"
                      >
                        <option value="orchard">باغداری</option>
                        <option value="houseplants">گیاهان آپارتمانی</option>
                        <option value="greenhouse">گلخانه صیفی</option>
                        <option value="farming">زراعت و غلات</option>
                      </select>
                    </div>
                  </div>

                  {/* All 31 Provinces & Comprehensive Cities + Custom Typing */}
                  <IranLocationSelector
                    compact
                    province={checkoutProvince}
                    city={checkoutCity}
                    onProvinceChange={setCheckoutProvince}
                    onCityChange={setCheckoutCity}
                  />

                  <div>
                    <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                      روش حمل و ارسال بار
                    </label>
                    <select
                      value={checkoutDeliveryMethod}
                      onChange={(e) => setCheckoutDeliveryMethod(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs"
                    >
                      <option value="freight_terminal">ارسال با باربری معتبر بین‌شهری (تخلیه انبار باربری)</option>
                      <option value="truck_dedicated">ارسال با وانت نیسان / خاور دربستی مستقیم به باغ یا منزل</option>
                      <option value="pickup_factory">تحویل حضوری درب کارگاه (مهندس صفری)</option>
                      <option value="courier">پیک و پست پیشتاز (مخصوص نمونه و احجام کم)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                      آدرس دقیق تخلیه بار
                    </label>
                    <textarea
                      required
                      value={checkoutAddress}
                      onChange={(e) => setCheckoutAddress(e.target.value)}
                      rows={2}
                      placeholder="آدرس دقیق جاده، مزرعه، نام باغ یا منزل..."
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs"
                    />
                  </div>

                  {/* Registration-Only Order Submission Gate */}
                  {!currentUser && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 space-y-2.5 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-lg shrink-0">🔐</span>
                        <div>
                          <div className="font-bold text-amber-950 dark:text-amber-200">
                            ثبت سفارش فقط برای مشتریان عضو (ثبت‌نام‌شده) امکان‌پذیر است
                          </div>
                          <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                            سبد خرید شما محفوظ است. لطفاً ابتدا در چند ثانیه ثبت‌نام کنید یا وارد حساب خود شوید تا پیش‌فاکتور فروش صادر و سفارش ثبت شود.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => openAuthModal('register')}
                          className="py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-[11px] shadow-xs transition-colors"
                        >
                          📝 ثبت‌نام سریع مشتری
                        </button>
                        <button
                          type="button"
                          onClick={() => openAuthModal('login')}
                          className="py-2 px-3 bg-white dark:bg-stone-800 hover:bg-stone-100 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 font-bold rounded-xl text-[11px] transition-colors"
                        >
                          🔑 ورود به حساب
                        </button>
                      </div>
                    </div>
                  )}

                  {checkoutError && (
                    <div className="p-2.5 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800 text-[11px] font-bold text-red-700 dark:text-red-300">
                      ⚠️ {checkoutError}
                    </div>
                  )}

                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[10.5px] text-emerald-900 dark:text-emerald-200 leading-relaxed space-y-2">
                    <div>
                      🛡️ <strong>شرایط پرداخت:</strong> {storeSettings.paymentTermsNotice || 'پس از ثبت سفارش یکپارچه، پیش‌فاکتور فروش صادر و توسط مسئول کارگاه جهت هماهنگی ساعت بارگیری با شما تماس گرفته می‌شود.'}
                    </div>
                    {(storeSettings.paymentCardNumber || storeSettings.paymentIban) && (
                      <div className="pt-2 border-t border-emerald-200/80 dark:border-emerald-800/70 space-y-1 text-[10.5px]">
                        <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                          <span>💳</span>
                          <span>اطلاعات واریز مستقیم (ارسال تصویر رسید در ربات تلگرام یا واتساپ):</span>
                        </div>
                        {storeSettings.paymentCardNumber && (
                          <div className="flex items-center justify-between gap-2 bg-white/85 dark:bg-stone-900/75 px-2.5 py-1.5 rounded-xl border border-emerald-200/70 dark:border-emerald-800/60">
                            <span className="text-stone-600 dark:text-stone-300 shrink-0">شماره کارت:</span>
                            <div className="flex items-center gap-2 min-w-0">
                              <span dir="ltr" className="font-mono tabular-nums font-extrabold text-stone-900 dark:text-white select-all truncate">
                                {storeSettings.paymentCardNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyPaymentField('card', storeSettings.paymentCardNumber || '')}
                                className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                              >
                                {copiedPaymentField === 'card' ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>کپی شد</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>کپی</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                        {storeSettings.paymentIban && (
                          <div className="flex items-center justify-between gap-2 bg-white/85 dark:bg-stone-900/75 px-2.5 py-1.5 rounded-xl border border-emerald-200/70 dark:border-emerald-800/60">
                            <span className="text-stone-600 dark:text-stone-300 shrink-0">شماره شبا:</span>
                            <div className="flex items-center gap-2 min-w-0">
                              <span dir="ltr" className="font-mono tabular-nums font-bold text-stone-900 dark:text-white select-all truncate">
                                {storeSettings.paymentIban}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyPaymentField('iban', storeSettings.paymentIban || '')}
                                className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                              >
                                {copiedPaymentField === 'iban' ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>کپی شد</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>کپی</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                        {(storeSettings.paymentCardHolder || storeSettings.paymentBankName) && (
                          <div className="text-[10px] text-stone-600 dark:text-stone-300">
                            {storeSettings.paymentCardHolder && <span>به نام: <b>{storeSettings.paymentCardHolder}</b></span>}
                            {storeSettings.paymentCardHolder && storeSettings.paymentBankName && <span> · </span>}
                            {storeSettings.paymentBankName && <span>بانک: <b>{storeSettings.paymentBankName}</b></span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {currentUser ? (
                    <button
                      type="submit"
                      className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-lg shadow-rose-600/20 text-xs transition-all flex items-center justify-center gap-2"
                    >
                      <span>✓</span>
                      <span>تایید و ثبت نهایی سفارش ({cart.length.toLocaleString('fa-IR')} کالا در سبد)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutError('ثبت نهایی سفارش فقط برای مشتریان ثبت‌نام‌شده امکان‌پذیر است. لطفاً ابتدا ثبت‌نام یا ورود کنید.');
                        openAuthModal('register');
                      }}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-xl shadow-lg text-xs transition-all flex items-center justify-center gap-2"
                    >
                      <span>🔒</span>
                      <span>ثبت‌نام / ورود برای ثبت نهایی سفارش ({cart.length.toLocaleString('fa-IR')} کالا)</span>
                    </button>
                  )}
                </form>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 4: MY ORDERS (3D INVOICE-STAGE REDESIGN) ===================== */}
        {mobileTab === 'orders' && (
          <div className="space-y-5">
            {/* 3D Depth Header Summary Strip */}
            <div className="relative rounded-3xl bg-gradient-to-l from-emerald-950 via-emerald-900 to-stone-900 text-white p-5 sm:p-6 shadow-[0_18px_38px_-14px_rgba(6,78,59,0.45)] border border-emerald-700/40 overflow-hidden">
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-300">
                    <PackageCheck className="w-4 h-4" />
                    <span>پیگیری هوشمند وضعیت فاکتور و ارسال</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                    سفارشات و پیش‌فاکتورهای من {currentUser ? `— ${currentUser.fullName}` : ''}
                  </h2>
                  <p className="text-[11px] text-emerald-100/85 leading-relaxed">
                    وضعیت هر سفارش از لحظه ثبت تا تایید پیش‌فاکتور، بارگیری در کارگاه و تحویل باربری به‌صورت لحظه‌ای به‌روزرسانی می‌شود.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 px-4 py-2.5 text-center shadow-inner">
                    <div className="text-[10px] text-emerald-200">کل سفارشات</div>
                    <div className="text-lg font-extrabold font-mono tabular-nums text-white mt-0.5">
                      {customerOrders.length.toLocaleString('fa-IR')}
                    </div>
                  </div>
                  {!currentUser && (
                    <button
                      type="button"
                      onClick={() => openAuthModal('login')}
                      className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-extrabold shadow-lg transition-all"
                    >
                      ورود به حساب
                    </button>
                  )}
                </div>
              </div>
            </div>

            {submittedOrder && (
              <div className="rounded-3xl bg-gradient-to-l from-emerald-800 to-emerald-700 text-white p-5 shadow-[0_16px_32px_-12px_rgba(6,95,70,0.45)] border border-emerald-500/40 animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                    🎉
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold">سفارش تاریخ {submittedOrder.orderDate} با موفقیت ثبت شد</h3>
                    <p className="text-[11px] text-emerald-100 font-mono mt-0.5">
                      کد پیگیری: {submittedOrder.orderNumber}
                    </p>
                    <p className="text-[11px] text-emerald-50/90 mt-1.5 leading-relaxed">
                      تمامی اقلام سبد خرید در یک سفارش واحد ثبت گردید و در صف صدور پیش‌فاکتور کارگاه قرار گرفت.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingOrderReceipt(submittedOrder)}
                  className="px-4 py-2.5 rounded-xl bg-white text-emerald-950 font-extrabold text-xs shadow-md hover:bg-amber-300 transition-colors shrink-0 flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>مشاهده و چاپ پیش‌فاکتور</span>
                </button>
              </div>
            )}

            {!currentUser && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setGuestOrderLookupQuery(guestOrderLookupInput.trim());
                }}
                className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-xs space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-extrabold text-stone-900 dark:text-stone-100">
                      🔍 پیگیری فوری سفارش ثبت‌شده در ربات تلگرام یا وب‌اپ
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      اگر سفارش خود را مستقیماً در ربات تلگرام یا با خرید سریع ثبت کرده‌اید، شماره موبایل یا کد رهگیری (ORD-...) را وارد کنید:
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={guestOrderLookupInput}
                    onChange={(e) => setGuestOrderLookupInput(e.target.value)}
                    placeholder="09123456789 یا ORD-1404..."
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-xs text-left focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition-colors"
                  >
                    مشاهده وضعیت سفارش
                  </button>
                  {guestOrderLookupQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setGuestOrderLookupInput('');
                        setGuestOrderLookupQuery('');
                      }}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-bold shrink-0"
                    >
                      پاک کردن
                    </button>
                  )}
                </div>
              </form>
            )}

            {customerOrders.length > 0 && (
              <div className="bg-white dark:bg-stone-900 rounded-2xl p-3 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px] font-bold">
                  {(
                    [
                      { id: 'all', label: 'همه سفارش‌ها' },
                      { id: 'active', label: 'در جریان' },
                      { id: 'completed', label: 'تحویل‌شده / لغو' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setOrderStatusFilter(tab.id)}
                      className={`min-h-[34px] px-3 py-1 rounded-xl whitespace-nowrap shrink-0 transition-colors ${
                        orderStatusFilter === tab.id
                          ? 'bg-emerald-800 text-white'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="جستجو با کد سفارش یا نام محصول..."
                    className="w-full min-h-[36px] pl-8 pr-8 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-2 text-stone-400 text-xs">🔍</span>
                  {orderSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute left-2.5 top-2 text-stone-400 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {customerOrders.length === 0 ? (
              <div className="bg-white dark:bg-stone-900 rounded-3xl p-10 text-center border border-stone-200 dark:border-stone-800 shadow-[0_12px_28px_-14px_rgba(0,0,0,0.12)]">
                <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-3xl shadow-inner">
                  📋
                </div>
                <p className="text-sm font-extrabold text-stone-800 dark:text-stone-200">
                  {guestOrderLookupQuery && !currentUser
                    ? 'سفارشی با این شماره موبایل یا کد پیگیری یافت نشد'
                    : 'سفارشی در تاریخچه یافت نشد'}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                  {!currentUser
                    ? 'با وارد کردن شماره موبایل ثبت‌شده در ربات تلگرام (یا کد رهگیری ORD-...) یا ورود به حساب، تمامی سفارش‌های شما به‌صورت زنده نمایش داده می‌شوند.'
                    : 'با ثبت اولین سفارش از فروشگاه، مراحل تایید پیش‌فاکتور، بارگیری کارگاه و کد رهگیری بارنامه در این بخش نمایش داده می‌شود.'}
                </p>
              </div>
            ) : (
              <div className={isMobilePreview ? 'space-y-4' : 'grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch'}>
                {customerOrders
                  .filter((order) => {
                    const isCompleted = order.status === 'delivered' || order.status === 'cancelled';
                    if (orderStatusFilter === 'active' && isCompleted) return false;
                    if (orderStatusFilter === 'completed' && !isCompleted) return false;
                    const q = orderSearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      order.orderNumber.toLowerCase().includes(q) ||
                      order.city.toLowerCase().includes(q) ||
                      order.items.some((it) => it.product.name.toLowerCase().includes(q))
                    );
                  })
                  .map((order) => {
                  const stageMeta = getOrderStageMeta(order.status);
                  const isCancelled = order.status === 'cancelled';

                  return (
                    <div
                      key={order.orderNumber}
                      className="[perspective:1200px] h-full"
                    >
                      <article className="h-full flex flex-col rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-700/80 shadow-[0_18px_36px_-14px_rgba(6,78,59,0.16),0_6px_14px_-6px_rgba(0,0,0,0.08)] hover:shadow-[0_24px_44px_-12px_rgba(6,78,59,0.24),0_10px_20px_-8px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1 overflow-hidden relative">
                        {/* Subtle 3D top metallic highlight edge & ambient gradient */}
                        <div className={`bg-gradient-to-l ${stageMeta.surfaceAccent} p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-stone-100">
                                  سفارش تاریخ {order.orderDate}
                                </span>
                                <span className="text-[10.5px] font-mono tabular-nums text-stone-500 dark:text-stone-400 bg-stone-100/90 dark:bg-stone-800 px-2 py-0.5 rounded-lg border border-stone-200/80 dark:border-stone-700">
                                  {order.orderNumber}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                                {stageMeta.hint}
                              </p>
                            </div>

                            <span className={`shrink-0 text-[10.5px] font-bold px-2.5 py-1 rounded-xl border shadow-2xs ${stageMeta.badgeClass}`}>
                              {stageMeta.label}
                            </span>
                          </div>

                          {/* 3D Tactile Invoice & Fulfillment Stage Stepper */}
                          {!isCancelled && (
                            <div className="mt-4 p-3 rounded-2xl bg-white/85 dark:bg-stone-950/65 border border-stone-200/80 dark:border-stone-800 shadow-[inset_0_2px_6px_rgba(0,0,0,0.04)]">
                              <div className="grid grid-cols-5 gap-1.5 items-start">
                                {ORDER_PIPELINE_STEPS.map((step, idx) => {
                                  const isDone = idx < stageMeta.stepIndex;
                                  const isCurrent = idx === stageMeta.stepIndex;
                                  return (
                                    <div key={step.status} className="flex flex-col items-center text-center relative">
                                      <div
                                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-extrabold font-mono transition-all ${
                                          isDone
                                            ? 'bg-emerald-700 text-white shadow-[0_4px_10px_rgba(4,120,87,0.35)]'
                                            : isCurrent
                                            ? 'bg-amber-400 text-stone-950 ring-4 ring-amber-400/25 shadow-[0_6px_14px_rgba(245,158,11,0.4)] scale-105'
                                            : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 border border-stone-200 dark:border-stone-700'
                                        }`}
                                      >
                                        {isDone ? '✓' : (idx + 1).toLocaleString('fa-IR')}
                                      </div>
                                      <span
                                        className={`mt-1.5 text-[9.5px] leading-tight line-clamp-2 ${
                                          isCurrent
                                            ? 'font-extrabold text-stone-900 dark:text-stone-100'
                                            : isDone
                                            ? 'font-bold text-emerald-800 dark:text-emerald-400'
                                            : 'font-medium text-stone-400 dark:text-stone-500'
                                        }`}
                                      >
                                        {step.shortLabel}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Card Body: Recessed 3D Item Block & Shipping Notice */}
                        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                          <div className="space-y-3">
                            {/* Order Items Recessed Box */}
                            <div className="rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/80 p-3 space-y-1.5 shadow-[inset_0_2px_5px_rgba(0,0,0,0.03)]">
                              <div className="text-[10.5px] font-bold text-stone-500 dark:text-stone-400 flex items-center justify-between pb-1 border-b border-stone-200/70 dark:border-stone-700">
                                <span>اقلام پیش‌فاکتور ({order.items.length.toLocaleString('fa-IR')} ردیف)</span>
                                <span className="font-mono tabular-nums">
                                  وزن کل: {order.totalWeightKg.toLocaleString('fa-IR')} کیلوگرم
                                </span>
                              </div>
                              {order.items.map((it) => (
                                <div key={it.id} className="flex items-center justify-between gap-2 text-xs text-stone-800 dark:text-stone-200">
                                  <span className="truncate font-semibold">
                                    {it.product.name}
                                    <span className="text-[10.5px] text-stone-500 dark:text-stone-400 font-normal">
                                      {' '}({it.selectedPackage.title || it.selectedPackage.weightOrVolume})
                                    </span>
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums text-[11px]">
                                    <span className="text-stone-500">×{it.quantity}</span>
                                    <span className="font-bold text-stone-900 dark:text-stone-100">
                                      {it.totalPrice.toLocaleString('fa-IR')} ت
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Delivery & Tracking Info Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div className="rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/70 dark:border-stone-700/60 px-3 py-2">
                                <div className="text-[10px] text-stone-400">مقصد و روش ارسال</div>
                                <div className="font-bold text-stone-800 dark:text-stone-200 mt-0.5 truncate">
                                  {order.province} - {order.city} · {formatDeliveryMethodFa(order.deliveryMethod)}
                                </div>
                              </div>
                              <div className="rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/70 dark:border-stone-700/60 px-3 py-2">
                                <div className="text-[10px] text-stone-400">کد رهگیری بارنامه / راننده</div>
                                <div className="font-mono font-bold text-emerald-800 dark:text-emerald-300 mt-0.5 truncate">
                                  {order.trackingNumber || 'پس از بارگیری درج می‌شود'}
                                </div>
                              </div>
                            </div>

                            {/* Financial Breakdown with Explicit Estimated Shipping Notice */}
                            <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70 p-3 space-y-1.5 text-[11.5px]">
                              <div className="flex justify-between text-stone-600 dark:text-stone-300">
                                <span>جمع اقلام:</span>
                                <span className="font-mono tabular-nums font-semibold">
                                  {order.subtotalToman.toLocaleString('fa-IR')} تومان
                                </span>
                              </div>
                              {order.discountToman > 0 && (
                                <div className="flex justify-between text-amber-700 dark:text-amber-400 font-semibold">
                                  <span>تخفیف بسته‌بندی و همکاری:</span>
                                  <span className="font-mono tabular-nums">- {order.discountToman.toLocaleString('fa-IR')} تومان</span>
                                </div>
                              )}
                              <div className="flex justify-between text-stone-700 dark:text-stone-200">
                                <span className="font-semibold">هزینه حمل و باربری (قیمت تخمینی):</span>
                                <span className="font-mono tabular-nums font-bold">
                                  {order.shippingEstimateToman > 0
                                    ? `${order.shippingEstimateToman.toLocaleString('fa-IR')} تومان`
                                    : 'رایگان ✓'}
                                </span>
                              </div>
                              <div className="pt-1.5 border-t border-emerald-200/80 dark:border-emerald-800 flex justify-between items-center text-emerald-950 dark:text-emerald-200 font-extrabold text-xs">
                                <span>مبلغ کل پیش‌فاکتور:</span>
                                <span className="font-mono tabular-nums text-sm">
                                  {order.finalPayableToman.toLocaleString('fa-IR')} تومان
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 3D Raised Action Footer */}
                          <div className="pt-1 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setViewingOrderReceipt(order)}
                              className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-b from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-extrabold shadow-[0_8px_18px_-6px_rgba(6,95,70,0.55),inset_0_1px_0_rgba(255,255,255,0.25)] active:translate-y-0.5 transition-all flex items-center justify-center gap-2"
                            >
                              <FileText className="w-4 h-4" />
                              <span>مشاهده پیش‌فاکتور و چاپ با مهر کارگاه</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 5: PROFILE ===================== */}
        {mobileTab === 'profile' && (
          <div className={`space-y-4 ${isMobilePreview ? '' : 'max-w-xl mx-auto'}`}>
            <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200 dark:border-stone-800 shadow-sm text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-800 text-white text-2xl font-bold mx-auto flex items-center justify-center mb-3 shadow-md">
                {currentUser ? currentUser.fullName.slice(0, 1) : '👤'}
              </div>

              {currentUser ? (
                <>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    {currentUser.fullName}
                  </h3>
                  <p className="text-xs font-mono tabular-nums text-stone-500 dark:text-stone-400 mt-0.5">
                    {currentUser.phoneNumber}
                  </p>
                  <div className="mt-2 inline-block px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg text-[10.5px] font-bold">
                    {currentUser.role === 'admin' ? '👑 مدیر کارگاه و فروشگاه' : '🌱 مشتری عضو سامانه'}
                  </div>

                  {currentUser.role === 'admin' && onOpenAdminPanel && (
                    <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800">
                      <button
                        onClick={onOpenAdminPanel}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-xl text-xs shadow transition-all flex items-center justify-center gap-2"
                      >
                        <span>👑</span>
                        <span>ورود به پنل جامع مدیریت کارگاه</span>
                      </button>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 text-right space-y-2 text-xs">
                    <div className="flex justify-between text-stone-600 dark:text-stone-400">
                      <span>استان و شهر:</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">
                        {currentUser.role === 'admin'
                          ? `${adminResolvedLocation.province} / ${adminResolvedLocation.city}`
                          : `${currentUser.province || '-'} / ${currentUser.city || '-'}`}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3 text-stone-600 dark:text-stone-400">
                      <span className="shrink-0">{currentUser.role === 'admin' ? 'نشانی کارگاه:' : 'آدرس ثبت‌شده:'}</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200 text-left break-words">
                        {currentUser.role === 'admin'
                          ? (storeSettings.workshopAddress || '').trim() ||
                            currentUser.address ||
                            '-'
                          : currentUser.address || '-'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setCurrentUser(null);
                      onUserChange(null);
                    }}
                    className="w-full mt-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold transition-colors"
                  >
                    خروج از حساب کاربری
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    ورود یا ثبت‌نام مشتری
                  </h3>
                  <p className="text-xs text-stone-400 mt-1">
                    ثبت نهایی سفارش و مشاهده سوابق خرید ویژه اعضای سامانه است
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      onClick={() => openAuthModal('register')}
                      className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                    >
                      📝 ثبت‌نام جدید
                    </button>
                    <button
                      onClick={() => openAuthModal('login')}
                      className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold transition-all"
                    >
                      🔑 ورود
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Direct Factory Support Box */}
            <div className="bg-stone-50 dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 text-xs space-y-2.5">
              <div className="flex items-center gap-2.5">
                <img
                  src={appLogoSrc}
                  alt={storeSettings.workshopName}
                  className="w-9 h-9 rounded-xl object-cover border border-stone-200 dark:border-stone-700 bg-white shrink-0"
                />
                <div>
                  <h4 className="font-bold text-stone-800 dark:text-stone-200">
                    {storeSettings.workshopName}
                  </h4>
                  <p className="text-[10px] text-stone-500">
                    مشاوره با {storeSettings.agronomistName} ({storeSettings.agronomistTitle})
                  </p>
                </div>
              </div>
              {storeSettings.workshopAddress?.trim() && (
                <div className="text-[10.5px] text-stone-600 dark:text-stone-400 bg-white dark:bg-stone-800/60 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 leading-relaxed">
                  📍 <strong>نشانی کارگاه:</strong> {storeSettings.workshopAddress}
                  {storeSettings.workingHours ? ` · 🕒 ${storeSettings.workingHours}` : ''}
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <div className="space-y-0.5">
                  <div className="text-[10px] text-stone-400">شماره تماس مستقیم مشاور:</div>
                  <span className="font-mono text-emerald-800 dark:text-emerald-400 font-bold" dir="ltr">
                    {storeSettings.agronomistPhone || storeSettings.supportPhone}
                  </span>
                </div>
                <a
                  href={`tel:${normalizeDigits(storeSettings.agronomistPhone || storeSettings.supportPhone).replace(/[^\d+]/g, '') || '09120000003'}`}
                  className="px-3 py-1.5 bg-emerald-800 text-white rounded-lg text-[10px] font-bold"
                >
                  تماس با مشاور
                </a>
              </div>
              {storeSettings.supportPhone && storeSettings.supportPhone !== storeSettings.agronomistPhone && (
                <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
                  <div className="space-y-0.5">
                    <div className="text-[10px] text-stone-400">پشتیبانی و پیگیری سفارشات:</div>
                    <span className="font-mono text-stone-700 dark:text-stone-300 font-bold" dir="ltr">
                      {storeSettings.supportPhone}
                    </span>
                  </div>
                  <a
                    href={`tel:${normalizeDigits(storeSettings.supportPhone).replace(/[^\d+]/g, '') || '09120000003'}`}
                    className="px-3 py-1.5 bg-stone-700 text-white rounded-lg text-[10px] font-bold"
                  >
                    تماس با پشتیبانی
                  </a>
                </div>
              )}
            </div>

            {/* Virtual Consultant Chat Quick Launcher inside Profile */}
            <div className="bg-gradient-to-l from-emerald-900 to-teal-900 text-white rounded-2xl p-4 shadow-sm border border-emerald-700/50 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-xs font-extrabold flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-amber-300" />
                  <span>مشاوره متنی با مهندس صفری (پاسخ هوشمند باغبانی)</span>
                </h4>
                <p className="text-[10.5px] text-emerald-100/90 leading-relaxed">
                  سوالات کودی، گیاهپزشکی و نحوه مصرف محصولات را مستقیماً در چت تخصصی بپرسید.
                </p>
              </div>
              <button
                type="button"
                onClick={openConsultantChat}
                className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold rounded-xl text-[11px] shrink-0 shadow-xs transition-colors"
              >
                💬 شروع گفتگو
              </button>
            </div>

            {/* Theme Appearance Selector (Device Default / Light / Dark) */}
            {onChangeThemeMode && (
              <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 text-xs space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5">
                      <span>{isDark ? '🌙' : '☀️'}</span>
                      <span>ظاهر و تم برنامه</span>
                    </h4>
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                      به صورت پیش‌فرض بر اساس تم دستگاه شما تنظیم می‌شود و قابل تغییر است
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
                  {(
                    [
                      { id: 'system', label: '📱 خودکار دستگاه' },
                      { id: 'light', label: '☀️ حالت روشن' },
                      { id: 'dark', label: '🌙 حالت تیره' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeThemeMode(opt.id)}
                      className={`py-2 px-2 rounded-lg text-[10.5px] font-bold transition-all ${
                        themeMode === opt.id
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-white/70 dark:hover:bg-stone-700/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Offline PWA Catalog & Page Cache Status Box */}
            <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 text-xs space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5">
                    <WifiOff className={`w-4 h-4 ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600'}`} />
                    <span>دسترسی آفلاین کاتالوگ و صفحات</span>
                  </h4>
                  <p className="text-[10.5px] text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                    صفحات بازدیدشده و آخرین لیست محصولات و قیمت‌ها برای مشاهده بدون اینترنت روی دستگاه ذخیره می‌شود.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!isOnline || isRefreshingOfflineCache}
                  onClick={async () => {
                    if (!isOnline) return;
                    setIsRefreshingOfflineCache(true);
                    try {
                      await syncFromTelegramCloudDb(false, { fresh: true });
                      const updatedMeta = await warmCacheCatalogAssets(products);
                      setOfflineMeta(updatedMeta);
                      setCartNotice('کاتالوگ، تصاویر و صفحات برای استفاده آفلاین بروزرسانی شد ✓');
                      setTimeout(() => setCartNotice(null), 2600);
                    } finally {
                      setIsRefreshingOfflineCache(false);
                    }
                  }}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10.5px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingOfflineCache ? 'animate-spin' : ''}`} />
                  <span>{isRefreshingOfflineCache ? 'در حال ذخیره...' : 'بروزرسانی حافظه'}</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center text-[10.5px]">
                <div className="p-2 rounded-xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200/70 dark:border-stone-700/60">
                  <div className="text-stone-500 dark:text-stone-400">محصولات ذخیره</div>
                  <div className="font-mono tabular-nums font-extrabold text-emerald-800 dark:text-emerald-300 mt-0.5">
                    {(offlineMeta.productCount || products.length).toLocaleString('fa-IR')} کالا
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200/70 dark:border-stone-700/60">
                  <div className="text-stone-500 dark:text-stone-400">بخش‌های کش‌شده</div>
                  <div className="font-mono tabular-nums font-extrabold text-stone-800 dark:text-stone-200 mt-0.5">
                    {Math.max(1, offlineMeta.visitedTabs.length).toLocaleString('fa-IR')} بخش
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200/70 dark:border-stone-700/60">
                  <div className="text-stone-500 dark:text-stone-400">آخرین ذخیره</div>
                  <div className="font-mono tabular-nums font-bold text-stone-700 dark:text-stone-300 mt-0.5 truncate">
                    {offlineMeta.cachedAt || 'هم‌اکنون'}
                  </div>
                </div>
              </div>
            </div>

            {/* Install App (Instant WebApp Only) Box */}
            {onOpenInstallModal && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                    <span>📱</span>
                    <span>نصب فوری اپلیکیشن کارگاه (WebApp)</span>
                  </h4>
                  <p className="text-[10px] text-emerald-800 dark:text-emerald-400 mt-0.5">
                    نصب فوری و مستقیم روی گوشی اندروید و آیفون بدون نیاز به دانلود فایل مجزا
                  </p>
                </div>
                <button
                  onClick={onOpenInstallModal}
                  className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shrink-0 shadow-xs"
                >
                  نصب فوری
                </button>
              </div>
            )}

            <div className="pt-2 text-center text-[11px] font-mono text-stone-500 dark:text-stone-400" dir="ltr">
              © 2011-2026 {storeSettings.workshopName}
            </div>
          </div>
        )}

      </div>

      {/* Responsive Sliding Product Detail Drawer (Bottom Sheet on Mobile/Telegram, Side Drawer on Desktop) + Voice Intro + In-Drawer Quick Buy */}
      {activeDetailProduct && (() => {
        const modalPkg = getSelectedPackage(activeDetailProduct);
        const isUnavailable = !activeDetailProduct.inStock || !modalPkg || Boolean(modalPkg.isOutOfStock);
        const quickQty = Math.max(1, drawerQuickQty);
        const quickSubtotal = modalPkg ? modalPkg.priceToman * quickQty : 0;
        const quickWeightKg = modalPkg ? Math.round(modalPkg.nominalWeightKg * quickQty * 100) / 100 : 0;
        const { shippingEstimate: quickShipping, freeShippingApplied: quickFreeShip } = computeShippingEstimate(
          quickWeightKg,
          quickSubtotal,
          checkoutDeliveryMethod,
          storeSettings
        );
        const quickTotalPayable = Math.max(0, quickSubtotal + quickShipping);
        const insideTg = isInsideTelegramWebApp();

        return (
          <div
            className="fixed inset-0 z-50 bg-stone-950/65 backdrop-blur-xs text-right no-print"
            dir="rtl"
            onClick={closeProductDrawer}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={activeDetailProduct.name}
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-x-0 bottom-0 lg:inset-y-0 lg:right-0 lg:left-auto lg:top-0 lg:bottom-0 w-full lg:max-w-xl max-h-[92dvh] lg:max-h-none bg-white dark:bg-stone-900 rounded-t-3xl lg:rounded-none lg:rounded-l-3xl border-t lg:border-t-0 lg:border-l border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col overflow-hidden animate-fade-in"
            >
              {/* Mobile Drag Handle */}
              <div className="lg:hidden flex justify-center pt-2.5 pb-1 shrink-0">
                <span className="w-10 h-1.5 rounded-full bg-stone-300 dark:bg-stone-700" />
              </div>

              {/* Sticky Drawer Header */}
              <div className="px-4 sm:px-6 py-3 border-b border-stone-100 dark:border-stone-800 flex items-start justify-between gap-3 shrink-0 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="font-bold text-emerald-800 dark:text-emerald-400">
                      {activeDetailProduct.categoryLabel}
                    </span>
                    <span className="text-stone-300 dark:text-stone-700">·</span>
                    <span
                      className={`font-bold tabular-nums ${
                        activeDetailProduct.inStock
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {activeDetailProduct.inStock
                        ? showStockCount
                          ? `موجود (${activeDetailProduct.stockQuantity.toLocaleString('fa-IR')} ${activeDetailProduct.stockUnit})`
                          : 'موجود در انبار'
                        : 'ناموجود'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-stone-900 dark:text-stone-100 mt-0.5 leading-snug">
                    {activeDetailProduct.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeProductDrawer}
                  aria-label="بستن پنجره محصول"
                  className="min-w-[44px] min-h-[44px] rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 flex items-center justify-center shrink-0 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Drawer Body */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
                {/* 4:3 Product Photography */}
                <div className="rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 aspect-[4/3] bg-stone-100 dark:bg-stone-800 relative">
                  <CachedProductImage
                    product={activeDetailProduct}
                    className="w-full h-full object-cover"
                  />
                  {modalPkg && !modalPkg.isOutOfStock && (
                    <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-stone-950/80 text-white backdrop-blur-xs text-xs font-extrabold font-mono tabular-nums shadow">
                      {modalPkg.priceToman.toLocaleString('fa-IR')} تومان
                    </div>
                  )}
                </div>

                {/* Dedicated Voice Intro Card */}
                <div className="rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/80 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-emerald-950 dark:text-emerald-200">
                        🎙️ معرفی صوتی تخصصی محصول
                      </div>
                      <p className="text-[11px] text-emerald-800/85 dark:text-emerald-300/85 mt-0.5">
                        توضیحات فنی، مزایا و نحوه مصرف این محصول را با صدای راهنما بشنوید
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleProductVoice(activeDetailProduct)}
                      disabled={voiceLoadingProductId === activeDetailProduct.id}
                      className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-2 shrink-0 transition-all shadow-xs ${
                        activeVoiceProductId === activeDetailProduct.id
                          ? 'bg-amber-400 border-amber-500 text-stone-950'
                          : 'bg-emerald-800 hover:bg-emerald-700 border-emerald-800 text-white'
                      }`}
                    >
                      {voiceLoadingProductId === activeDetailProduct.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>در حال دریافت...</span>
                        </>
                      ) : activeVoiceProductId === activeDetailProduct.id ? (
                        <>
                          <Square className="w-4 h-4 fill-current" />
                          <span>توقف پخش</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" />
                          <span>پخش معرفی صوتی</span>
                        </>
                      )}
                    </button>
                  </div>

                  {(voiceTranscriptMap[activeDetailProduct.id] || activeDetailProduct.voiceIntroText) &&
                    activeVoiceProductId === activeDetailProduct.id && (
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-stone-900/80 border border-amber-300 dark:border-amber-800 text-[11.5px] text-stone-800 dark:text-stone-200 leading-relaxed">
                        {voiceTranscriptMap[activeDetailProduct.id] || activeDetailProduct.voiceIntroText}
                      </div>
                    )}
                  {voiceErrorMap[activeDetailProduct.id] && (
                    <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                      ⚠️ {voiceErrorMap[activeDetailProduct.id]}
                    </div>
                  )}
                </div>

                {/* Packaging Tiers Selector */}
                <div className="space-y-2">
                  <div className="text-xs font-extrabold text-stone-800 dark:text-stone-200">
                    انتخاب بسته‌بندی و وزن:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeDetailProduct.packagingOptions.map((pkg) => {
                      const isSel = modalPkg?.id === pkg.id;
                      const isOut = Boolean(pkg.isOutOfStock);
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => handleSelectPackage(activeDetailProduct.id, pkg.id)}
                          className={`min-h-[52px] p-2.5 rounded-2xl border text-right text-xs transition-all ${
                            isOut
                              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-stone-400'
                              : isSel
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-700 text-emerald-950 dark:text-emerald-100 font-bold shadow-xs'
                              : 'bg-stone-50 dark:bg-stone-800/70 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <div className="truncate font-bold">{pkg.title || pkg.weightOrVolume}</div>
                          <div className="font-mono tabular-nums font-extrabold text-emerald-800 dark:text-emerald-300 mt-0.5">
                            {isOut ? 'ناموجود' : `${pkg.priceToman.toLocaleString('fa-IR')} تومان`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Inline Quick Buy Order Success Card inside Drawer */}
                {drawerQuickOrderResult && (
                  <div className="rounded-2xl bg-emerald-800 text-white p-4 space-y-3 shadow-lg border border-emerald-600">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold">
                          سفارش شما با موفقیت ثبت و به‌صورت ریل‌تایم برای کارگاه ارسال شد ✓
                        </div>
                        <div className="text-xs font-mono tabular-nums text-amber-200 mt-1">
                          کد پیگیری: {drawerQuickOrderResult.orderNumber}
                        </div>
                        <p className="text-[11px] text-emerald-100 mt-1 leading-relaxed">
                          اطلاعات سفارش و حساب کاربری شما در سامانه ثبت شد و در بخش «سفارشات من» نیز قابل مشاهده است.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingOrderReceipt(drawerQuickOrderResult)}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-white text-emerald-950 font-extrabold text-xs flex items-center gap-1.5 shadow-xs"
                      >
                        <Printer className="w-4 h-4" />
                        <span>مشاهده و چاپ پیش‌فاکتور</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeProductDrawer();
                          setMobileTab('orders');
                        }}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-extrabold text-xs"
                      >
                        پیگیری در «سفارشات من»
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Buy & Add to Cart Toggle Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isUnavailable}
                    onClick={() => {
                      setDrawerQuickError(null);
                      setDrawerQuickOrderResult(null);
                      setDrawerQuickBuyOpen((prev) => {
                        const next = !prev;
                        if (next) {
                          setTimeout(() => {
                            drawerQuickFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          }, 80);
                        }
                        return next;
                      });
                    }}
                    className={`min-h-[46px] px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                      isUnavailable
                        ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed'
                        : drawerQuickBuyOpen
                        ? 'bg-amber-400 text-stone-950 border-2 border-amber-500'
                        : 'bg-emerald-800 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <span>⚡</span>
                    <span>خرید سریع در همین صفحه (بدون خروج)</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUnavailable}
                    onClick={() => {
                      handleAddToCart(activeDetailProduct, modalPkg, quickQty);
                      closeProductDrawer();
                    }}
                    className={`min-h-[46px] px-4 py-2.5 rounded-2xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1.5 ${
                      isUnavailable
                        ? 'bg-stone-100 dark:bg-stone-800 border-stone-200 text-stone-400 cursor-not-allowed'
                        : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100'
                    }`}
                  >
                    <span>🧺</span>
                    <span>افزودن به سبد خرید</span>
                  </button>
                </div>

                {/* Inline 1-Step Quick Buy Form Inside Drawer */}
                {drawerQuickBuyOpen && modalPkg && !isUnavailable && (
                  <form
                    ref={drawerQuickFormRef}
                    onSubmit={(e) => handleDrawerQuickBuySubmit(e, activeDetailProduct, modalPkg)}
                    className="rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-emerald-600/40 p-4 space-y-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200 dark:border-stone-700">
                      <span className="font-extrabold text-stone-900 dark:text-stone-100">
                        ⚡ ثبت سریع سفارش (همگام‌سازی خودکار با کارگاه)
                      </span>
                      <div className="flex items-center gap-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => setDrawerQuickQty((q) => Math.max(1, q - 1))}
                          className="w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-800 font-extrabold text-sm flex items-center justify-center"
                          aria-label="کاهش تعداد"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-mono tabular-nums font-extrabold">
                          {quickQty.toLocaleString('fa-IR')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDrawerQuickQty((q) => Math.min(999, q + 1))}
                          className="w-9 h-9 rounded-lg bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center"
                          aria-label="افزایش تعداد"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          نام و نام خانوادگی خریدار:
                        </label>
                        <input
                          type="text"
                          required
                          value={checkoutName}
                          onChange={(e) => setCheckoutName(e.target.value)}
                          placeholder="مثال: علی رضایی"
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                            شماره موبایل (جهت پیگیری و ثبت حساب):
                          </label>
                          {insideTg && !checkoutPhone.trim() && canRequestTelegramMiniAppContact() && (
                            <button
                              type="button"
                              disabled={drawerRequestingTgPhone}
                              onClick={async () => {
                                setDrawerRequestingTgPhone(true);
                                try {
                                  const phone = await requestTelegramMiniAppContact();
                                  if (phone) setCheckoutPhone(phone);
                                } finally {
                                  setDrawerRequestingTgPhone(false);
                                }
                              }}
                              className="text-[10px] font-bold text-sky-700 dark:text-sky-300 hover:underline"
                            >
                              {drawerRequestingTgPhone ? 'در حال دریافت...' : '📱 دریافت از تلگرام'}
                            </button>
                          )}
                        </div>
                        <input
                          type="tel"
                          required
                          dir="ltr"
                          value={checkoutPhone}
                          onChange={(e) => setCheckoutPhone(e.target.value)}
                          placeholder="09123456789"
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-mono text-xs text-left"
                        />
                      </div>
                    </div>

                    <IranLocationSelector
                      province={checkoutProvince}
                      city={checkoutCity}
                      onProvinceChange={setCheckoutProvince}
                      onCityChange={setCheckoutCity}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          نحوه ارسال:
                        </label>
                        <select
                          value={checkoutDeliveryMethod}
                          onChange={(e) => setCheckoutDeliveryMethod(e.target.value as CustomerOrder['deliveryMethod'])}
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                        >
                          <option value="freight_terminal">باربری مجاز بین‌شهری</option>
                          <option value="truck_dedicated">وانت نیسان / خاور دربستی</option>
                          <option value="courier">پیک و پست پیشتاز</option>
                          <option value="pickup_factory">تحویل حضوری درب کارگاه</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          آدرس دقیق تحویل:
                        </label>
                        <input
                          type="text"
                          required={checkoutDeliveryMethod !== 'pickup_factory'}
                          value={checkoutAddress}
                          onChange={(e) => setCheckoutAddress(e.target.value)}
                          placeholder="شهر، خیابان، پلاک یا ترمینال باربری"
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                        />
                      </div>
                    </div>

                    {/* Live Cost Summary */}
                    <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-3 space-y-1 text-[11.5px]">
                      <div className="flex justify-between text-stone-600 dark:text-stone-300">
                        <span>قیمت کالا ({quickQty.toLocaleString('fa-IR')} × {modalPkg.weightOrVolume}):</span>
                        <span className="font-mono tabular-nums font-bold">
                          {quickSubtotal.toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                      <div className="flex justify-between text-stone-600 dark:text-stone-300">
                        <span>برآورد هزینه ارسال ({quickWeightKg.toLocaleString('fa-IR')} کیلوگرم):</span>
                        <span className="font-mono tabular-nums font-bold">
                          {quickShipping > 0
                            ? `${quickShipping.toLocaleString('fa-IR')} تومان`
                            : quickFreeShip
                            ? 'رایگان ✓'
                            : '۰ تومان (حضوری)'}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-stone-200 dark:border-stone-700 font-extrabold text-emerald-900 dark:text-emerald-300 text-xs">
                        <span>جمع کل پیش‌فاکتور:</span>
                        <span className="font-mono tabular-nums">
                          {quickTotalPayable.toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    </div>

                    {storeSettings.paymentCardNumber && (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-950 dark:text-amber-200 space-y-1">
                        <div className="font-bold">💳 شماره کارت واریز ({storeSettings.paymentBankName || 'بانک عامل'}):</div>
                        <div className="font-mono tabular-nums font-extrabold text-xs" dir="ltr">
                          {storeSettings.paymentCardNumber}
                        </div>
                        {storeSettings.paymentCardHolder && <div>به‌نام: {storeSettings.paymentCardHolder}</div>}
                      </div>
                    )}

                    {drawerQuickError && (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold text-[11px]">
                        ⚠️ {drawerQuickError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={drawerQuickSubmitting}
                      className="w-full min-h-[48px] py-3 rounded-2xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-xs shadow-md transition-all"
                    >
                      {drawerQuickSubmitting
                        ? 'در حال ثبت و همگام‌سازی آنی...'
                        : `✅ تایید و ثبت قطعی سفارش (${quickTotalPayable.toLocaleString('fa-IR')} تومان)`}
                    </button>
                  </form>
                )}

                {/* Product Description, Highlights & Lab Specs */}
                <div className="space-y-3.5 pt-1">
                  <p className="text-xs sm:text-[13px] text-stone-700 dark:text-stone-300 leading-relaxed">
                    {activeDetailProduct.description}
                  </p>

                  <div>
                    <h4 className="text-xs font-extrabold text-stone-800 dark:text-stone-200 mb-2">
                      ویژگی‌های کلیدی و مزایا:
                    </h4>
                    <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-300">
                      {activeDetailProduct.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">✓</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-3 border-t border-stone-100 dark:border-stone-800">
                    <h4 className="text-xs font-extrabold text-stone-800 dark:text-stone-200 mb-2">
                      آنالیز آزمایشگاهی و مشخصات فنی:
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {activeDetailProduct.specs.map((s, i) => (
                        <div
                          key={i}
                          className="bg-stone-50 dark:bg-stone-800/60 p-2.5 rounded-xl border border-stone-200/70 dark:border-stone-700/70"
                        >
                          <div className="text-[10.5px] text-stone-500 dark:text-stone-400">{s.label}</div>
                          <div className="font-bold font-mono tabular-nums text-stone-800 dark:text-stone-200 mt-0.5">
                            {s.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Print-Ready Formal Customer Proforma / Order Receipt Modal */}
      {viewingOrderReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-stone-950/75 backdrop-blur-xs text-right animate-fade-in printable-modal-backdrop overflow-y-auto"
          dir="rtl"
        >
          <div className="bg-white text-stone-900 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 border border-stone-300 shadow-2xl space-y-5 relative my-auto printable-invoice-sheet">
            {/* Screen-Only Modal Action Toolbar */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-200 no-print">
              <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                <span>پیش‌نمایش چاپی پیش‌فاکتور فروش (قطع A4)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ / ذخیره PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingOrderReceipt(null)}
                  className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center"
                  aria-label="بستن پیش‌فاکتور"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Formal Invoice Header with Workshop Logo & Metadata */}
            <div className="border-b-2 border-stone-900 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 print-break-avoid">
              <div className="flex items-start gap-3.5">
                <img
                  src={appLogoSrc}
                  alt={storeSettings.workshopName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-800/30 bg-white shrink-0 shadow-xs"
                />
                <div className="space-y-1">
                  <div className="text-[11px] font-extrabold text-emerald-800">
                    پیش‌فاکتور فروش و بارگیری کالا
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-stone-950 leading-snug">
                    {storeSettings.workshopName}
                  </h3>
                  <p className="text-[11px] text-stone-600">
                    {storeSettings.appTagline || 'واحد تخصصی تولید و فرآوری ورمیکمپوست و نهاده‌های زیستی'}
                  </p>
                </div>
              </div>

              <div className="sm:text-left text-xs space-y-1 bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 shrink-0">
                <div>
                  <span className="text-stone-500">شماره فاکتور: </span>
                  <strong className="font-mono tabular-nums text-stone-950">{viewingOrderReceipt.orderNumber}</strong>
                </div>
                <div>
                  <span className="text-stone-500">تاریخ ثبت: </span>
                  <strong className="font-mono tabular-nums text-stone-950">{viewingOrderReceipt.orderDate}</strong>
                </div>
                <div>
                  <span className="text-stone-500">مرحله سفارش: </span>
                  <strong className="text-emerald-900">{getOrderStageMeta(viewingOrderReceipt.status).label}</strong>
                </div>
              </div>
            </div>

            {/* Buyer & Destination Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-stone-50 border border-stone-200 p-4 rounded-2xl text-xs print-break-avoid">
              <div className="space-y-1.5">
                <div className="font-extrabold text-stone-900 border-b border-stone-200 pb-1 mb-1">
                  مشخصات خریدار
                </div>
                <div>
                  <span className="text-stone-500">نام خریدار: </span>
                  <strong className="text-stone-900">{viewingOrderReceipt.customerName}</strong>
                </div>
                <div>
                  <span className="text-stone-500">شماره تماس: </span>
                  <strong className="font-mono tabular-nums text-stone-900" dir="ltr">{viewingOrderReceipt.phoneNumber}</strong>
                </div>
                <div>
                  <span className="text-stone-500">مقصد ارسال: </span>
                  <strong className="text-stone-900">{viewingOrderReceipt.province} - {viewingOrderReceipt.city}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-extrabold text-stone-900 border-b border-stone-200 pb-1 mb-1">
                  اطلاعات حمل و بارگیری
                </div>
                <div>
                  <span className="text-stone-500">روش ارسال: </span>
                  <strong className="text-stone-900">{formatDeliveryMethodFa(viewingOrderReceipt.deliveryMethod)}</strong>
                </div>
                <div>
                  <span className="text-stone-500">کد رهگیری بارنامه: </span>
                  <strong className="font-mono text-emerald-900">{viewingOrderReceipt.trackingNumber || 'در انتظار بارگیری'}</strong>
                </div>
                <div>
                  <span className="text-stone-500">نشانی تخلیه: </span>
                  <span className="text-stone-800">{viewingOrderReceipt.deliveryAddress}</span>
                </div>
              </div>
            </div>

            {/* Structured Itemized Table */}
            <div className="overflow-x-auto rounded-2xl border border-stone-300">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-300 text-stone-900 font-extrabold">
                    <th className="p-2.5 text-center w-10">ردیف</th>
                    <th className="p-2.5">شرح کالا</th>
                    <th className="p-2.5">بسته‌بندی</th>
                    <th className="p-2.5 text-center">تعداد</th>
                    <th className="p-2.5 text-left">فی واحد (تومان)</th>
                    <th className="p-2.5 text-left">جمع کل (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {viewingOrderReceipt.items.map((it, idx) => (
                    <tr key={it.id} className="bg-white">
                      <td className="p-2.5 text-center font-mono tabular-nums text-stone-500">
                        {(idx + 1).toLocaleString('fa-IR')}
                      </td>
                      <td className="p-2.5 font-bold text-stone-900">{it.product.name}</td>
                      <td className="p-2.5 text-stone-700">
                        {it.selectedPackage.title || it.selectedPackage.weightOrVolume}
                      </td>
                      <td className="p-2.5 text-center font-mono tabular-nums font-bold">
                        {it.quantity.toLocaleString('fa-IR')}
                      </td>
                      <td className="p-2.5 text-left font-mono tabular-nums text-stone-700">
                        {it.unitPrice.toLocaleString('fa-IR')}
                      </td>
                      <td className="p-2.5 text-left font-mono tabular-nums font-bold text-stone-950">
                        {it.totalPrice.toLocaleString('fa-IR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Totals & Estimated Freight Notice */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 print-break-avoid">
              <div className="flex-1 text-[10.5px] text-stone-600 bg-amber-50/70 border border-amber-200 rounded-2xl p-3 leading-relaxed">
                <strong className="text-amber-950 block mb-0.5">توجه درباره کرایه باربری:</strong>
                هزینه حمل و باربری درج‌شده در این پیش‌فاکتور <strong>«قیمت تخمینی»</strong> بر مبنای وزن تقریبی ({viewingOrderReceipt.totalWeightKg.toLocaleString('fa-IR')} کیلوگرم) است و کرایه قطعی طبق نرخ روز باربری محاسبه می‌گردد.
              </div>

              <div className="w-full sm:w-72 bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-2 text-xs shrink-0">
                <div className="flex justify-between text-stone-700">
                  <span>جمع کل اقلام:</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {viewingOrderReceipt.subtotalToman.toLocaleString('fa-IR')} تومان
                  </span>
                </div>
                {viewingOrderReceipt.discountToman > 0 && (
                  <div className="flex justify-between text-amber-800 font-semibold">
                    <span>تخفیف بسته‌بندی و همکاری:</span>
                    <span className="font-mono tabular-nums">
                      - {viewingOrderReceipt.discountToman.toLocaleString('fa-IR')} تومان
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-stone-700">
                  <span>هزینه حمل و باربری (قیمت تخمینی):</span>
                  <span className="font-mono tabular-nums font-bold">
                    {viewingOrderReceipt.shippingEstimateToman > 0
                      ? `${viewingOrderReceipt.shippingEstimateToman.toLocaleString('fa-IR')} تومان`
                      : 'رایگان ✓'}
                  </span>
                </div>
                <div className="flex justify-between font-extrabold text-sm pt-2 border-t-2 border-stone-900 text-emerald-900">
                  <span>مبلغ نهایی قابل پرداخت:</span>
                  <span className="font-mono tabular-nums">
                    {viewingOrderReceipt.finalPayableToman.toLocaleString('fa-IR')} تومان
                  </span>
                </div>
              </div>
            </div>

            {/* Official Workshop Stamp / Seal & Manager Signature */}
            <div className="pt-4 border-t border-stone-300 flex flex-col sm:flex-row items-center justify-between gap-4 print-break-avoid">
              <div className="text-[11px] text-stone-600 space-y-1 flex-1">
                <div className="font-extrabold text-stone-900">
                  تایید مدیریت کارگاه: {storeSettings.managerFullName || 'مهندس وفایی / صفری'}
                </div>
                {storeSettings.managerTitle && (
                  <div className="text-stone-700">{storeSettings.managerTitle}</div>
                )}
                <div className="text-[10.5px] text-stone-600">
                  📍 نشانی کارگاه: {(storeSettings.workshopAddress || storeSettings.managerAddress || 'استان تهران، شهرستان فیروزکوه').trim()}
                </div>
                {storeSettings.supportPhone && (
                  <div className="text-[10.5px] font-mono tabular-nums text-stone-700" dir="ltr">
                    Tel: {storeSettings.supportPhone}
                  </div>
                )}
                {storeSettings.invoiceFooterNote && (
                  <div className="text-[10px] text-stone-500 pt-1">{storeSettings.invoiceFooterNote}</div>
                )}
              </div>

              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <StoreSealBadge
                  settings={storeSettings}
                  appLogoSrc={appLogoSrc}
                  size="lg"
                />
                <span className="text-[10px] font-bold text-stone-600">
                  مهر معتبر تایید فروش کارگاه
                </span>
              </div>
            </div>

            {/* Bottom Screen-Only Print Button */}
            <div className="pt-2 flex items-center justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => setViewingOrderReceipt(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs"
              >
                بستن
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ پیش‌فاکتور / ذخیره PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Unified Cart Quick Summary Bar */}
      {cart.length > 0 && mobileTab !== 'cart' && (
        <div
          className={`fixed bottom-4 z-30 pointer-events-none no-print ${
            isMobilePreview
              ? 'left-0 right-0 max-w-md mx-auto px-3'
              : 'left-4 right-4 sm:left-6 sm:right-auto sm:w-96'
          }`}
        >
          <button
            onClick={() => setMobileTab('cart')}
            className="pointer-events-auto w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-700 text-white rounded-2xl shadow-xl border border-emerald-600/60 flex items-center justify-between text-xs font-bold transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-stone-950 font-mono font-extrabold px-2 py-0.5 rounded-lg text-[11px]">
                {cartTotals.totalItemsCount}
              </span>
              <span>سبد خرید واحد ({cart.length} نوع کالا)</span>
            </div>
            <span className="text-amber-300 font-bold flex items-center gap-1">
              <span>{cartTotals.finalPayableToman.toLocaleString('fa-IR')} ت</span>
              <span>· تکمیل سفارش ←</span>
            </span>
          </button>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authInitialMode}
        appLogoSrc={appLogoSrc}
        workshopName={storeSettings.workshopName}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(user) => {
          onUserChange(user);
          if (user.role === 'admin' && onOpenAdminPanel) {
            onOpenAdminPanel();
          }
        }}
      />
    </div>
  );
}
