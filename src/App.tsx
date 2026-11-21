import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CustomerMobileApp } from './components/CustomerMobileApp';
import { AdminStoreManager } from './components/AdminStoreManager';
import { AuthModal } from './components/AuthModal';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { StorageBackupModal } from './components/StorageBackupModal';
import { PersonnelManagerModal } from './components/PersonnelManagerModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { calculateFormulation } from './data/vermicompostData';
import {
  loadWorkshopData,
  saveWorkshopData,
  clearWorkshopData,
} from './utils/storage';
import {
  getCurrentUser,
  setCurrentUser,
  loadStoreSettings,
  startUnifiedCloudSync,
  syncWorkshopStateToCloud,
  hasAnyPendingCloudSync,
  getCloudSyncState,
  DB_SYNC_EVENT,
  SYNC_STATUS_EVENT,
  WORKSHOP_SYNC_EVENT,
  CloudSyncState,
} from './utils/storeStorage';
import {
  BatchConfig,
  BioassayChecklist,
  FeedingCycleLog,
  LabSignatories,
  WorkshopAppState,
  PersonnelMember,
} from './types/vermicompost';
import { UserAccount, WorkshopStoreSettings } from './types/storefront';
import { useDeviceClock } from './utils/deviceTime';
import {
  initTelegramMiniApp,
  isInsideTelegramWebApp,
  syncTelegramMiniAppTheme,
} from './utils/telegramWebApp';
import { resolveAssetOrApiUrl, resolvePublicAssetUrl } from './utils/apiBase';

// Only TWO primary modes as explicitly instructed by user:
// 1. Customer Store (فروشگاه مشتریان)
// 2. Admin Panel (پنل مدیریت - شامل سفارشات، انبار، تولید و فرمولاسیون و تنظیمات)
export type AppViewMode = 'customer_app' | 'admin_panel';
export type ThemeModePreference = 'system' | 'light' | 'dark';

const THEME_MODE_STORAGE_KEY = 'safari_theme_mode_v1';

function readInitialThemeMode(): ThemeModePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'system';
}

function getDevicePrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function App() {
  // Live local device clock
  const deviceClock = useDeviceClock(1000);

  // Current logged in user (Customer or Admin)
  const [currentUser, setLocalCurrentUser] = useState<UserAccount | null>(() => getCurrentUser());

  // App View Mode: only 'customer_app' or 'admin_panel'
  const [appMode, setAppMode] = useState<AppViewMode>(() => {
    const savedUser = getCurrentUser();
    if (savedUser?.role === 'admin') return 'admin_panel';
    return 'customer_app';
  });

  // Automatically render full-width website on desktop/non-mobile devices; optional mobile preview toggle available
  const [isMobileFrameActive, setIsMobileFrameActive] = useState<boolean>(false);

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authAdminOnly, setAuthAdminOnly] = useState<boolean>(false);

  // Theme preference: defaults to device OS preference ('system'), user can change anytime
  const [themeMode, setThemeMode] = useState<ThemeModePreference>(() => readInitialThemeMode());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => getDevicePrefersDark());
  const isDark = themeMode === 'dark' ? true : themeMode === 'light' ? false : systemPrefersDark;

  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState<boolean>(false);
  const [isTelegramMiniApp] = useState<boolean>(() => isInsideTelegramWebApp());

  useEffect(() => {
    try {
      (window as any).__clearMountWatchdog?.();
    } catch {
      // ignore
    }
    initTelegramMiniApp();
    const tgScript = document.querySelector<HTMLScriptElement>('script[src*="telegram-web-app.js"]');
    if (tgScript) {
      const onTgLoad = () => initTelegramMiniApp();
      tgScript.addEventListener('load', onTgLoad);
      return () => tgScript.removeEventListener('load', onTgLoad);
    }
  }, []);

  // Workshop & Factory OS Data
  const initialData = useMemo(() => loadWorkshopData(), []);
  const [config, setConfig] = useState<BatchConfig>(initialData.config);
  const [checklist, setChecklist] = useState<BioassayChecklist>(initialData.checklist);
  const [cycles, setCycles] = useState<FeedingCycleLog[]>(initialData.cycles);
  const [signatories, setSignatories] = useState<LabSignatories>(initialData.signatories);

  // Reactive Store settings & Unified Telegram Cloud sync state
  const [storeSettings, setStoreSettings] = useState<WorkshopStoreSettings>(() => loadStoreSettings());
  const [syncState, setSyncState] = useState<CloudSyncState>(() => getCloudSyncState());

  // Prevent echo writes when workshop state arrives from remote Cloud DB snapshot
  const isInitialMountRef = useRef(true);
  const isApplyingRemoteWorkshopRef = useRef(false);
  const globalHeaderRef = useRef<HTMLElement | null>(null);

  // Publish exact height of sticky global header so CustomerMobileApp header sticks cleanly directly underneath it
  useEffect(() => {
    const el = globalHeaderRef.current;
    if (!el || typeof document === 'undefined') return;
    const syncHeight = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--global-header-h', `${h}px`);
    };
    syncHeight();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncHeight);
      observer.observe(el);
    }
    window.addEventListener('resize', syncHeight);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', syncHeight);
    };
  }, []);

  // Unified Telegram Cloud DB Realtime Sync Engine
  useEffect(() => {
    const stopSync = startUnifiedCloudSync();

    const handleDbSync = () => {
      setStoreSettings(loadStoreSettings());
      // Protect active user session; never wipe an authenticated session
      const stored = getCurrentUser();
      if (stored) {
        setLocalCurrentUser(stored);
      }
    };

    const handleSyncStatus = (e: Event) => {
      const detail = (e as CustomEvent<CloudSyncState>).detail;
      if (detail) {
        setSyncState(detail);
      } else {
        setSyncState(getCloudSyncState());
      }
    };

    const handleWorkshopSync = () => {
      const latest = loadWorkshopData();
      isApplyingRemoteWorkshopRef.current = true;
      setConfig(latest.config);
      setChecklist(latest.checklist);
      setCycles(latest.cycles);
      setSignatories(latest.signatories);
      setTimeout(() => {
        isApplyingRemoteWorkshopRef.current = false;
      }, 100);
    };

    window.addEventListener(DB_SYNC_EVENT, handleDbSync);
    window.addEventListener(SYNC_STATUS_EVENT, handleSyncStatus);
    window.addEventListener(WORKSHOP_SYNC_EVENT, handleWorkshopSync);

    return () => {
      window.removeEventListener(DB_SYNC_EVENT, handleDbSync);
      window.removeEventListener(SYNC_STATUS_EVENT, handleSyncStatus);
      window.removeEventListener(WORKSHOP_SYNC_EVENT, handleWorkshopSync);
      stopSync();
    };
  }, []);

  // Dynamic formulation results based on current batch config
  const formulation = useMemo(() => calculateFormulation(config), [config]);

  // Current vermicompost sales price per kg suggested by factory OS
  const currentVermiPricePerKg = config.sellingPricePerKg || formulation.suggestedSellingPricePerKg || 24000;

  const workshopSyncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save Workshop State locally & auto-push live to Telegram Cloud DB (real-time across devices)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    const payload: WorkshopAppState = {
      config,
      checklist,
      cycles,
      signatories,
      lastUpdated: new Date().toISOString(),
    };
    saveWorkshopData(payload);

    if (isApplyingRemoteWorkshopRef.current) {
      return;
    }

    if (workshopSyncDebounceRef.current) {
      clearTimeout(workshopSyncDebounceRef.current);
    }
    workshopSyncDebounceRef.current = setTimeout(() => {
      void syncWorkshopStateToCloud(payload);
    }, 900);
  }, [config, checklist, cycles, signatories]);

  // Listen for OS/device theme changes (active when themeMode === 'system')
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(mql.matches);
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    // Legacy Safari fallback
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, []);

  // Sync dark class & theme-color meta tag on document element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.content = isDark ? '#0c0a09' : '#064e3b';
    }
    syncTelegramMiniAppTheme(isDark);
  }, [isDark]);

  // Sync dynamic App Logo (from Admin Publish / Logo Upload), Installed PWA Name & Icon, & Workshop Title
  const appLogoSrc = resolveAssetOrApiUrl(storeSettings.appLogoDataUrl, 'pwa-192x192.png');
  const pwaIconSrc = resolveAssetOrApiUrl(
    storeSettings.pwaAppIconDataUrl || storeSettings.appLogoDataUrl,
    'pwa-192x192.png'
  );
  const pwaInstalledName = (storeSettings.pwaAppName || storeSettings.workshopName || 'ورمیکمپوست صفری').trim();

  useEffect(() => {
    const iconHref = resolveAssetOrApiUrl(
      storeSettings.appLogoDataUrl || storeSettings.pwaAppIconDataUrl,
      'icon.svg'
    );
    const appleHref = resolveAssetOrApiUrl(
      storeSettings.pwaAppIconDataUrl || storeSettings.appLogoDataUrl,
      'apple-touch-icon.png'
    );

    const faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (faviconEl) {
      faviconEl.href = iconHref;
      if (storeSettings.appLogoDataUrl || storeSettings.pwaAppIconDataUrl) {
        faviconEl.removeAttribute('type');
      } else {
        faviconEl.type = 'image/svg+xml';
      }
    }

    const appleIconEl = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (appleIconEl) {
      appleIconEl.href = appleHref;
    }

    let appleTitleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitleMeta) {
      appleTitleMeta = document.createElement('meta');
      appleTitleMeta.name = 'apple-mobile-web-app-title';
      document.head.appendChild(appleTitleMeta);
    }
    appleTitleMeta.content = pwaInstalledName.slice(0, 30);

    if (storeSettings.workshopName) {
      document.title = `${storeSettings.workshopName} | ${storeSettings.appTagline || 'فروشگاه آنلاین و سامانه کارگاهی'}`;
    }

    // Dynamically update PWA Web App Manifest so installed app name & icon match Admin Settings
    let manifestBlobUrl: string | null = null;
    if (storeSettings.pwaAppIconDataUrl || storeSettings.pwaAppName || storeSettings.appLogoDataUrl || storeSettings.workshopName) {
      const pageBaseHref = new URL('./', window.location.href).href;
      const customPwaIcon = storeSettings.pwaAppIconDataUrl || storeSettings.appLogoDataUrl;
      const resolvedCustomIcon = customPwaIcon ? resolveAssetOrApiUrl(customPwaIcon, 'pwa-192x192.png') : '';
      let logoUrl = '';
      try {
        logoUrl = new URL(
          resolvedCustomIcon || resolvePublicAssetUrl('pwa-192x192.png'),
          window.location.href
        ).href;
      } catch {
        logoUrl = `${window.location.origin}/pwa-192x192.png`;
      }
      const logoType = customPwaIcon?.startsWith('data:image/webp')
        ? 'image/webp'
        : customPwaIcon?.startsWith('data:image/jpeg')
          ? 'image/jpeg'
          : 'image/png';
      const manifestData = {
        id: pageBaseHref,
        name: pwaInstalledName || 'گروه تولیدی و زیست‌فناوری مهندس صفری',
        short_name: pwaInstalledName.slice(0, 24) || 'ورمیکمپوست',
        description: storeSettings.appTagline || 'فروشگاه آنلاین و سامانه کارگاهی زیست‌فناوری',
        theme_color: '#064e3b',
        background_color: '#064e3b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: pageBaseHref,
        scope: pageBaseHref,
        lang: 'fa',
        dir: 'rtl',
        icons: [
          { src: logoUrl, sizes: '192x192', type: logoType, purpose: 'any' },
          { src: logoUrl, sizes: '512x512', type: logoType, purpose: 'any' },
          { src: logoUrl, sizes: '512x512', type: logoType, purpose: 'maskable' },
        ],
      };
      const blob = new Blob([JSON.stringify(manifestData)], { type: 'application/manifest+json' });
      manifestBlobUrl = URL.createObjectURL(blob);
      let manifestEl = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (!manifestEl) {
        manifestEl = document.createElement('link');
        manifestEl.rel = 'manifest';
        document.head.appendChild(manifestEl);
      }
      manifestEl.href = manifestBlobUrl;
    }

    return () => {
      if (manifestBlobUrl) {
        URL.revokeObjectURL(manifestBlobUrl);
      }
    };
  }, [
    storeSettings.appLogoDataUrl,
    storeSettings.pwaAppIconDataUrl,
    storeSettings.pwaAppName,
    storeSettings.workshopName,
    storeSettings.appTagline,
    pwaInstalledName,
  ]);

  const setThemePreference = (nextMode: ThemeModePreference) => {
    setThemeMode(nextMode);
    try {
      if (nextMode === 'system') {
        localStorage.removeItem(THEME_MODE_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_MODE_STORAGE_KEY, nextMode);
      }
    } catch {
      // ignore storage errors
    }
  };

  const toggleDark = () => {
    setThemePreference(isDark ? 'light' : 'dark');
  };

  const handlePrintCertificate = () => {
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleRestoreState = (restored: WorkshopAppState) => {
    if (restored.config) setConfig(restored.config);
    if (restored.checklist) setChecklist(restored.checklist);
    if (restored.cycles) setCycles(restored.cycles);
    if (restored.signatories) setSignatories(restored.signatories);
  };

  const handleResetDefaults = () => {
    const fresh = clearWorkshopData();
    setConfig(fresh.config);
    setChecklist(fresh.checklist);
    setCycles(fresh.cycles);
    setSignatories(fresh.signatories);
  };

  const handleUpdatePersonnelList = (updated: PersonnelMember[]) => {
    setConfig((prev) => ({
      ...prev,
      personnelList: updated,
    }));
  };

  const handleUserChange = (user: UserAccount | null) => {
    setCurrentUser(user);
    setLocalCurrentUser(user);
    if (user?.role === 'admin') {
      setAppMode('admin_panel');
    }
  };

  // Strict Security Gate for Admin Panel
  const handleOpenAdminPanel = () => {
    if (currentUser?.role === 'admin') {
      setAppMode('admin_panel');
    } else {
      setAuthAdminOnly(true);
      setIsAuthModalOpen(true);
    }
  };

  const handleOpenCustomerAuth = () => {
    setAuthAdminOnly(false);
    setIsAuthModalOpen(true);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLocalCurrentUser(null);
    setAppMode('customer_app');
  };

  // Unified Telegram Cloud DB Realtime indicator helper
  const renderCloudBadge = () => {
    const p = syncState.pendingDomains;
    const hasPending = Boolean(p?.settings || p?.products || p?.workshop) || hasAnyPendingCloudSync();
    if (syncState.status === 'syncing' || syncState.status === 'connecting') {
      return {
        dot: 'bg-sky-400',
        text: syncState.status === 'connecting' ? 'در حال اتصال زنده...' : 'در حال انتقال آنی...',
        textColor: 'text-sky-300',
        border: 'bg-sky-950/60 border-sky-800/70',
      };
    }
    if (syncState.status === 'offline' || syncState.status === 'error') {
      return {
        dot: 'bg-rose-500',
        text: syncState.status === 'offline' ? 'آفلاین (کش محلی)' : 'خطای ارتباط',
        textColor: 'text-rose-300',
        border: 'bg-rose-950/60 border-rose-800/70',
      };
    }
    if (hasPending) {
      return {
        dot: 'bg-amber-400',
        text: 'در حال ارسال تغییرات...',
        textColor: 'text-amber-300',
        border: 'bg-amber-950/70 border-amber-700/80',
      };
    }
    return {
      dot: 'bg-emerald-400',
      text: 'متصل · ریل‌تایم',
      textColor: 'text-emerald-300',
      border: 'bg-emerald-950/60 border-emerald-800/70',
    };
  };

  const cloudBadge = renderCloudBadge();

  return (
    <div className="min-h-screen bg-stone-100/70 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col font-sans transition-colors text-right" dir="rtl">
      
      {/* ========================================================================= */}
      {/* GLOBAL TOP BAR: CLEAN 3-ZONE EXECUTIVE HEADER (فروشگاه / پنل مدیریت)       */}
      {/* ========================================================================= */}
      <header ref={globalHeaderRef} className="bg-stone-900 text-white text-xs border-b border-stone-800 no-print py-2 px-3 sm:px-4 z-50 sticky top-0">
        <div className="max-w-7xl mx-auto flex flex-wrap lg:flex-nowrap items-center justify-between gap-2">
          
          {/* Zone 1: Brand Identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={appLogoSrc}
              alt={storeSettings.workshopName || signatories.workshopName}
              className="w-8 h-8 rounded-lg object-cover border border-emerald-500/40 bg-emerald-950/60 shrink-0"
            />
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-stone-100 text-xs sm:text-[13px] truncate max-w-[180px] sm:max-w-[240px]">
                {storeSettings.workshopName || signatories.workshopName}
              </span>
              <span className="text-stone-600 hidden xl:inline">|</span>
              <span className="text-stone-400 text-[11px] hidden xl:inline truncate max-w-[210px]">
                {storeSettings.appTagline || 'سامانه جامع فروشگاه و کارگاه زیست‌فناوری'}
              </span>
              {isTelegramMiniApp && (
                <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/40 text-sky-200 text-[10px] font-bold whitespace-nowrap shrink-0">
                  ✈️ مینی‌اپ
                </span>
              )}
            </div>
          </div>

          {/* Zone 2: Primary Mode Switcher (فروشگاه مشتریان / پنل مدیر) */}
          <div className="flex items-center gap-1 bg-stone-800/90 p-1 rounded-xl text-xs font-semibold border border-stone-700/60 shrink-0">
            <button
              onClick={() => setAppMode('customer_app')}
              className={`whitespace-nowrap shrink-0 px-3 sm:px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                appMode === 'customer_app'
                  ? 'bg-emerald-700 text-white font-bold'
                  : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
              }`}
            >
              <span>🛒</span>
              <span>فروشگاه مشتریان</span>
            </button>

            <button
              onClick={handleOpenAdminPanel}
              className={`whitespace-nowrap shrink-0 px-3 sm:px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                appMode === 'admin_panel'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
              }`}
            >
              <span>👑</span>
              <span>پنل مدیر</span>
              {currentUser?.role !== 'admin' && (
                <span className="text-[10px] bg-stone-700 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                  🔒
                </span>
              )}
            </button>
          </div>

          {/* Zone 3: Session, Live Clock, Cloud Status & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-stone-800/70 border border-stone-700/60 whitespace-nowrap shrink-0">
                <span className="text-emerald-400 font-bold truncate max-w-[110px]">
                  {currentUser.role === 'admin' ? '👑 ' : '👤 '}
                  {currentUser.fullName}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-stone-400 hover:text-red-400 text-[10px] underline shrink-0"
                >
                  خروج
                </button>
              </div>
            ) : (
              <button
                onClick={handleOpenCustomerAuth}
                className="whitespace-nowrap shrink-0 px-2.5 py-1.5 bg-emerald-800/80 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1"
              >
                <span>👤</span>
                <span>ورود خریداران</span>
              </button>
            )}

            {/* Live Device Clock */}
            <div
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-800/90 border border-stone-700/70 text-[10.5px] font-mono tabular-nums text-emerald-300 whitespace-nowrap shrink-0"
              title={`ساعت و تاریخ دستگاه شما: ${deviceClock.weekdayDateStr}`}
            >
              <span>🕒</span>
              <span>{deviceClock.timeWithSecStr}</span>
            </div>

            {/* Unified Telegram Cloud DB Realtime Indicator */}
            <div
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] whitespace-nowrap shrink-0 ${cloudBadge.border}`}
              title={`پایگاه داده زنده تلگرام (ریل‌تایم و بدون محدودیت) - آخرین همگام‌سازی: ${syncState.lastSyncedAt || 'لحظه‌ای'}`}
            >
              <span className={`w-2 h-2 rounded-sm ${cloudBadge.dot}`} />
              <span className="text-sky-200">دیتابیس تلگرام:</span>
              <span className={`font-bold ${cloudBadge.textColor}`}>{cloudBadge.text}</span>
            </div>

            <button
              onClick={() => setIsAndroidModalOpen(true)}
              className="whitespace-nowrap shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 text-[10.5px] font-bold flex items-center gap-1 transition-colors"
              title="نصب فوری اپلیکیشن کارگاه روی گوشی و دسکتاپ"
            >
              <span>📲</span>
              <span className="hidden sm:inline">نصب اپ</span>
            </button>

            <button
              onClick={toggleDark}
              className="whitespace-nowrap shrink-0 px-2.5 py-1.5 rounded-lg bg-stone-800/90 hover:bg-stone-700 border border-stone-700/70 text-stone-200 hover:text-white transition-colors flex items-center gap-1 text-[10.5px] font-semibold"
              title={
                themeMode === 'system'
                  ? `تم خودکار هماهنگ با دستگاه شما (${isDark ? 'تیره' : 'روشن'}) · برای تغییر دستی کلیک کنید`
                  : isDark
                  ? 'تغییر به حالت روشن'
                  : 'تغییر به حالت تیره'
              }
            >
              <span>{isDark ? '☀️' : '🌙'}</span>
              <span className="hidden sm:inline">{isDark ? 'روشن' : 'تیره'}</span>
            </button>
          </div>

        </div>
      </header>

      <OfflineIndicator />

      {/* ========================================================================= */}
      {/* 1. CUSTOMER STOREFRONT (تمام صفحه خودکار در دسکتاپ/ویندوز + واکنش‌گرا در موبایل) */}
      {/* ========================================================================= */}
      {appMode === 'customer_app' && (() => {
        const insideTelegramMiniApp = isInsideTelegramWebApp();
        const effectiveMobileFrame = isMobileFrameActive && !insideTelegramMiniApp;
        return (
        <div
          className={`flex-1 flex flex-col justify-start ${
            effectiveMobileFrame ? 'items-center py-4 px-4' : 'items-stretch'
          }`}
        >
          {effectiveMobileFrame ? (
            <>
              <div className="hidden sm:flex items-center justify-between max-w-md w-full mb-3 px-2 text-xs text-stone-500 no-print">
                <span className="font-bold text-stone-700 dark:text-stone-300">
                  پیش‌نمایش قاب موبایل
                </span>
                <button
                  onClick={() => setIsMobileFrameActive(false)}
                  className="text-[11px] text-emerald-800 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>💻 بازگشت به نمای تمام‌صفحه وب‌سایت</span>
                </button>
              </div>
              <div className="w-full max-w-md sm:rounded-[40px] sm:ring-12 sm:ring-stone-800/90 sm:shadow-2xl overflow-x-clip transition-all duration-300 printable-host-frame">
                <CustomerMobileApp
                  currentVermiPricePerKg={currentVermiPricePerKg}
                  currentUser={currentUser}
                  onUserChange={handleUserChange}
                  onOpenAdminPanel={handleOpenAdminPanel}
                  onOpenInstallModal={() => setIsAndroidModalOpen(true)}
                  isMobilePreview
                  onToggleMobilePreview={() => setIsMobileFrameActive(false)}
                  isDark={isDark}
                  themeMode={themeMode}
                  onToggleTheme={toggleDark}
                  onChangeThemeMode={setThemePreference}
                />
              </div>
            </>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              <CustomerMobileApp
                currentVermiPricePerKg={currentVermiPricePerKg}
                currentUser={currentUser}
                onUserChange={handleUserChange}
                onOpenAdminPanel={handleOpenAdminPanel}
                onOpenInstallModal={() => setIsAndroidModalOpen(true)}
                isMobilePreview={false}
                onToggleMobilePreview={insideTelegramMiniApp ? undefined : () => setIsMobileFrameActive(true)}
                isDark={isDark}
                themeMode={themeMode}
                onToggleTheme={toggleDark}
                onChangeThemeMode={setThemePreference}
              />
            </div>
          )}
        </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 2. ADMIN PANEL (پنل مدیریت کارگاه - شامل سفارشات، انبار، تولید، تنظیمات)   */}
      {/* ========================================================================= */}
      {appMode === 'admin_panel' && currentUser?.role === 'admin' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
          <AdminStoreManager
            currentVermiPricePerKg={currentVermiPricePerKg}
            currentUser={currentUser}
            onPreviewCustomerApp={() => setAppMode('customer_app')}
            config={config}
            setConfig={setConfig}
            checklist={checklist}
            setChecklist={setChecklist}
            cycles={cycles}
            setCycles={setCycles}
            signatories={signatories}
            setSignatories={setSignatories}
            formulation={formulation}
            onOpenPersonnelModal={() => setIsPersonnelModalOpen(true)}
            onPrintCertificate={handlePrintCertificate}
          />
        </main>
      )}

      {/* Admin Panel Secure Login Gate if not authenticated */}
      {appMode === 'admin_panel' && currentUser?.role !== 'admin' && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-stone-900 rounded-3xl p-8 border border-stone-200 dark:border-stone-800 shadow-xl text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 text-3xl flex items-center justify-center mx-auto">
              🔒
            </div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              دسترسی به پنل مدیریت کارگاه نیازمند ورود است
            </h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              جهت ورود به پنل، مدیریت سفارشات، انبارداری و خط تولید کارگاه، لطفاً با نام کاربری و رمز عبور مدیریت وارد شوید.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleOpenAdminPanel}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>🔑</span>
                <span>ورود به پنل مدیریت</span>
              </button>
              <button
                onClick={() => setAppMode('customer_app')}
                className="w-full py-2 text-stone-500 hover:text-stone-700 text-xs font-semibold"
              >
                بازگشت به فروشگاه مشتریان
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        adminOnly={authAdminOnly}
        appLogoSrc={appLogoSrc}
        workshopName={storeSettings.workshopName}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthAdminOnly(false);
        }}
        onLoginSuccess={(user) => {
          handleUserChange(user);
          setIsAuthModalOpen(false);
          setAuthAdminOnly(false);
        }}
      />

      {/* Storage Persistence & Backup Modal */}
      <StorageBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        appState={{ config, checklist, cycles, signatories, lastUpdated: new Date().toISOString() }}
        onRestoreState={handleRestoreState}
        onResetDefaults={handleResetDefaults}
      />

      {/* Android Installation Modal */}
      <AndroidInstallModal
        isOpen={isAndroidModalOpen}
        appLogoSrc={pwaIconSrc}
        workshopName={pwaInstalledName}
        onClose={() => setIsAndroidModalOpen(false)}
      />

      {/* Personnel Manager Modal */}
      <PersonnelManagerModal
        isOpen={isPersonnelModalOpen}
        onClose={() => setIsPersonnelModalOpen(false)}
        personnelList={config.personnelList || []}
        onUpdatePersonnelList={handleUpdatePersonnelList}
      />
    </div>
  );
}
