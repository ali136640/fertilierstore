import { useEffect, useRef, useState, useCallback } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { WorkshopStoreSettings } from '../types/storefront';
import { buildCoreSettingsSignature, CORE_APP_VERSION } from '../config/coreAppManifest';
import { resolveApiUrl } from '../utils/apiBase';

export interface AppUpdateStatus {
  updateAvailable: boolean;
  isChecking: boolean;
  isUpdating: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  updateReason: string | null;
  checkError: string | null;
  lastCheckedFa: string | null;
  checkForUpdates: () => Promise<boolean>;
  applyUpdate: () => Promise<void>;
}

const STORED_VERSION_KEY = 'safari_client_app_version_v1';
const STORED_CORE_SIG_KEY = 'safari_core_settings_sig_v1';

export function useAppUpdate(storeSettings?: Partial<WorkshopStoreSettings> | null): AppUpdateStatus {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORED_VERSION_KEY) || CORE_APP_VERSION;
    } catch {
      return CORE_APP_VERSION;
    }
  });
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateReason, setUpdateReason] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [lastCheckedFa, setLastCheckedFa] = useState<string | null>(null);

  const swUpdateFnRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);
  const swNeedsRefreshRef = useRef(false);

  const liveCoreSignature = storeSettings ? buildCoreSettingsSignature(storeSettings) : null;

  // Detect updates driven strictly by core structure & primary Admin settings changes
  useEffect(() => {
    if (!liveCoreSignature || !storeSettings) return;
    try {
      const knownSig = localStorage.getItem(STORED_CORE_SIG_KEY);
      if (!knownSig) {
        localStorage.setItem(STORED_CORE_SIG_KEY, liveCoreSignature);
        return;
      }
      if (knownSig !== liveCoreSignature) {
        if (storeSettings.coreAppVersion) {
          setLatestVersion(storeSettings.coreAppVersion);
        }
        setUpdateReason(
          storeSettings.coreUpdateSummary?.trim() ||
            'تغییرات جدید در بخش‌های اصلی و تنظیمات کارگاه منتشر شده است.'
        );
        setUpdateAvailable(true);
      }
    } catch {
      // ignore storage issues
    }
  }, [liveCoreSignature, storeSettings]);

  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    setCheckError(null);
    let foundUpdate = false;

    try {
      // 1. Trigger service worker update check if registered
      if (swRegRef.current) {
        try {
          await swRegRef.current.update();
        } catch {
          // ignore SW update check error when offline
        }
      }
      if (swNeedsRefreshRef.current) {
        foundUpdate = true;
      }

      // 2. Check deterministic core sections / build version on server
      const resp = await fetch(resolveApiUrl(`/api/app-version?t=${Date.now()}`), {
        cache: 'no-store',
      });
      if (resp.ok) {
        const data = (await resp.json()) as {
          version?: string;
          coreVersion?: string;
          releaseNotes?: string;
        };
        const serverVer = (data?.version || '').trim();
        if (serverVer) {
          setLatestVersion(storeSettings?.coreAppVersion || data?.coreVersion || serverVer);
          const known = (() => {
            try {
              return localStorage.getItem(STORED_VERSION_KEY);
            } catch {
              return null;
            }
          })();
          if (!known) {
            try {
              localStorage.setItem(STORED_VERSION_KEY, serverVer);
            } catch {
              // ignore
            }
            setCurrentVersion(data?.coreVersion || serverVer);
          } else if (known !== serverVer) {
            setCurrentVersion(known);
            if (data?.releaseNotes) {
              setUpdateReason(data.releaseNotes);
            }
            foundUpdate = true;
          } else {
            setCurrentVersion(storeSettings?.coreAppVersion || data?.coreVersion || known);
          }
        }
      }

      // 3. Also check primary Admin core settings signature change
      if (liveCoreSignature) {
        try {
          const knownSig = localStorage.getItem(STORED_CORE_SIG_KEY);
          if (knownSig && knownSig !== liveCoreSignature) {
            setUpdateReason(
              storeSettings?.coreUpdateSummary?.trim() ||
                'تغییرات جدید در بخش‌های اصلی و تنظیمات کارگاه منتشر شده است.'
            );
            foundUpdate = true;
          }
        } catch {
          // ignore
        }
      }

      setLastCheckedFa(
        new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
      );
      if (foundUpdate) {
        setUpdateAvailable(true);
      }
      return foundUpdate;
    } catch {
      setCheckError('بررسی نسخه جدید نیازمند دسترسی اینترنت است.');
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [liveCoreSignature, storeSettings?.coreAppVersion, storeSettings?.coreUpdateSummary]);

  useEffect(() => {
    try {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          swNeedsRefreshRef.current = true;
          setUpdateAvailable(true);
        },
        onRegisteredSW(_swUrl, r) {
          if (r) {
            swRegRef.current = r;
          }
        },
      });
      swUpdateFnRef.current = updateSW;
    } catch {
      // gracefully ignore in environments where SW is unavailable
    }

    // Check once cleanly after initial site load settles
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 2500);
    const interval = setInterval(() => {
      checkForUpdates();
    }, 1000 * 60 * 15);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [checkForUpdates]);

  const applyUpdate = useCallback(async () => {
    setIsUpdating(true);
    try {
      const resp = await fetch(resolveApiUrl(`/api/app-version?t=${Date.now()}`), { cache: 'no-store' }).catch(() => null);
      if (resp?.ok) {
        const data = (await resp.json()) as { version?: string };
        if (data?.version) {
          localStorage.setItem(STORED_VERSION_KEY, data.version);
        }
      } else if (latestVersion) {
        localStorage.setItem(STORED_VERSION_KEY, latestVersion);
      }
      if (liveCoreSignature) {
        localStorage.setItem(STORED_CORE_SIG_KEY, liveCoreSignature);
      }
    } catch {
      // ignore storage errors
    }
    try {
      if (swUpdateFnRef.current && swNeedsRefreshRef.current) {
        await swUpdateFnRef.current(true);
        setTimeout(() => window.location.reload(), 800);
        return;
      }
      window.location.reload();
    } catch {
      window.location.reload();
    }
  }, [latestVersion, liveCoreSignature]);

  return {
    updateAvailable,
    isChecking,
    isUpdating,
    currentVersion,
    latestVersion,
    updateReason,
    checkError,
    lastCheckedFa,
    checkForUpdates,
    applyUpdate,
  };
}
