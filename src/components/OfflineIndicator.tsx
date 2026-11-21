import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { readOfflineCatalogMeta } from '../utils/offlineCatalogCache';
import { syncFromTelegramCloudDb } from '../utils/storeStorage';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [cachedMeta, setCachedMeta] = useState(() => readOfflineCatalogMeta());

  useEffect(() => {
    setCachedMeta(readOfflineCatalogMeta());
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnectedBanner(true);
      void syncFromTelegramCloudDb(false, { fresh: true });
      const timer = setTimeout(() => {
        setShowReconnectedBanner(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  const handleManualReconnect = async () => {
    setIsRetrying(true);
    try {
      await syncFromTelegramCloudDb(false, { fresh: true });
    } finally {
      setIsRetrying(false);
    }
  };

  if (isOnline && !showReconnectedBanner) {
    return null;
  }

  if (isOnline && showReconnectedBanner) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-emerald-800 text-white text-[11px] font-bold px-3 py-1.5 border-b border-emerald-700 no-print"
        dir="rtl"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
          <span>اتصال اینترنت برقرار شد · کاتالوگ و سفارش‌ها به‌صورت خودکار همگام‌سازی می‌شوند</span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-950 text-amber-100 text-[11px] px-3 py-2 border-b border-amber-700/60 no-print"
      dir="rtl"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span className="font-bold text-amber-200 shrink-0">حالت آفلاین</span>
          <span className="text-amber-100/90 truncate">
            نمایش آخرین کاتالوگ و صفحات ذخیره‌شده
            {cachedMeta.productCount > 0
              ? ` (${cachedMeta.productCount.toLocaleString('fa-IR')} محصول آماده بررسی${
                  cachedMeta.cachedAt ? ` · آخرین ذخیره ${cachedMeta.cachedAt}` : ''
                })`
              : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={handleManualReconnect}
          disabled={isRetrying}
          className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-[10.5px] flex items-center gap-1 shrink-0 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>بررسی اتصال</span>
        </button>
      </div>
    </div>
  );
};
