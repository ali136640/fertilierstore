import React, { useEffect, useState } from 'react';
import type { CustomerOrder, StoreProduct, WorkshopStoreSettings } from '../types/storefront';
import { parseJsonResponseSafe } from '../utils/safeFetchJson';
import { resolveApiUrl, normalizeBaseUrl, buildGithubPagesUrl } from '../utils/apiBase';

export interface TelegramBotStatusPayload {
  hasToken: boolean;
  tokenMasked: string;
  enabled: boolean;
  isRunning: boolean;
  botVerified?: boolean;
  conflictActive?: boolean;
  conflictMessage?: string | null;
  effectiveMode?: 'polling' | 'webhook' | 'standby';
  mode: 'polling' | 'webhook';
  botId?: number;
  botUsername?: string;
  botFirstName?: string;
  botLink?: string;
  miniAppUrl?: string;
  webAppUrl: string;
  isWebAppUrlHttps: boolean;
  adminChatId: string;
  storageChatId?: string;
  syncedProductsCount: number;
  syncedOrdersCount: number;
  knownUsersCount: number;
  lastError: string | null;
  lastUpdateAt: string | null;
}

interface TelegramBotManagerPanelProps {
  settings: WorkshopStoreSettings;
  productOverrides: Record<string, Partial<StoreProduct>>;
  orders: CustomerOrder[];
  activeProductsCount: number;
}

export function TelegramBotManagerPanel({
  settings,
  productOverrides,
  orders,
  activeProductsCount,
}: TelegramBotManagerPanelProps) {
  const [status, setStatus] = useState<TelegramBotStatusPayload | null>(null);
  const [botTokenInput, setBotTokenInput] = useState('');
  const [webAppUrlInput, setWebAppUrlInput] = useState('');
  const [adminChatIdInput, setAdminChatIdInput] = useState('');
  const [storageChatIdInput, setStorageChatIdInput] = useState('');
  const [modeInput, setModeInput] = useState<'polling' | 'webhook'>('polling');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingAdmin, setIsTestingAdmin] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const defaultOrigin =
    typeof window !== 'undefined' &&
    window.location.origin.startsWith('https://') &&
    !window.location.hostname.endsWith('.github.io')
      ? normalizeBaseUrl(window.location.origin)
      : '';

  const configuredGithubUrl = settings.githubPagesEnabled
    ? buildGithubPagesUrl({
        owner: settings.githubOwner,
        repo: settings.githubRepo,
        customDomain: settings.githubCustomDomain,
      })
    : '';

  const unifiedSettingsUrl = normalizeBaseUrl(settings.telegramWebAppUrl);

  const fetchStatus = async () => {
    try {
      const resp = await fetch(resolveApiUrl('/api/telegram/status'), { cache: 'no-store' });
      const parsed = await parseJsonResponseSafe<{ status?: TelegramBotStatusPayload }>(
        resp,
        'خطا در دریافت وضعیت ربات تلگرام'
      );
      if (parsed.ok && parsed.data?.status) {
        const st = parsed.data.status;
        setStatus(st);
        setWebAppUrlInput(
          (prev) =>
            prev ||
            unifiedSettingsUrl ||
            normalizeBaseUrl(st.webAppUrl) ||
            configuredGithubUrl ||
            defaultOrigin
        );
        setAdminChatIdInput((prev) => prev || st.adminChatId || '');
        setStorageChatIdInput((prev) => prev || st.storageChatId || '');
        setModeInput(st.mode || 'polling');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  useEffect(() => {
    if (unifiedSettingsUrl) {
      setWebAppUrlInput((prev) => (prev === unifiedSettingsUrl ? prev : unifiedSettingsUrl));
    }
  }, [unifiedSettingsUrl]);

  const handleCopy = (key: string, text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleConfigureAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedbackMsg(null);
    setIsSubmitting(true);

    try {
      const { adminPassword: _pw, ...safeSettings } = settings;
      await fetch(resolveApiUrl('/api/telegram/sync-state'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: safeSettings,
          productOverrides,
          orders,
        }),
      }).catch(() => null);

      const resp = await fetch(resolveApiUrl('/api/telegram/configure'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botTokenInput.trim() || undefined,
          webAppUrl: (webAppUrlInput || defaultOrigin).trim(),
          mode: modeInput,
          adminChatId: adminChatIdInput.trim(),
          storageChatId: storageChatIdInput.trim(),
          enabled: true,
        }),
      });
      const parsed = await parseJsonResponseSafe<{
        ok?: boolean;
        status?: TelegramBotStatusPayload;
        message?: string;
      }>(resp, 'خطا در اتصال به سرویس ربات تلگرام');

      if (parsed.data?.status) {
        setStatus(parsed.data.status);
      }

      if (!parsed.ok || !parsed.data?.ok) {
        setErrorMsg(parsed.data?.message || parsed.errorMessage || 'اتصال ربات ناموفق بود.');
      } else {
        setFeedbackMsg(parsed.data.message || 'ربات تلگرام و مینی‌اپ با موفقیت متصل شد ✓');
        setBotTokenInput('');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در ارتباط با سرور');
    } finally {
      setIsSubmitting(false);
    }
  };



  const handleTestAdminMessage = async () => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setIsTestingAdmin(true);
    try {
      // Save adminChatId first if entered cleanly with existing token
      if (status?.hasToken && adminChatIdInput.trim() !== status.adminChatId) {
        await fetch(resolveApiUrl('/api/telegram/configure'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminChatId: adminChatIdInput.trim(),
            webAppUrl: (webAppUrlInput || defaultOrigin).trim(),
            mode: modeInput,
            enabled: true,
          }),
        });
      }
      const resp = await fetch(resolveApiUrl('/api/telegram/test-admin-message'), { method: 'POST' });
      const parsed = await parseJsonResponseSafe<{ ok?: boolean; message?: string }>(
        resp,
        'خطا در ارسال پیام تست به تلگرام مدیر'
      );
      if (parsed.ok && parsed.data?.ok) {
        setFeedbackMsg(parsed.data.message || 'پیام تست به تلگرام مدیر ارسال شد ✓');
      } else {
        setErrorMsg(parsed.data?.message || parsed.errorMessage || 'ارسال پیام تست ناموفق بود.');
      }
    } finally {
      setIsTestingAdmin(false);
    }
  };

  const handleStopBot = async () => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setIsSubmitting(true);
    try {
      const resp = await fetch(resolveApiUrl('/api/telegram/stop'), { method: 'POST' });
      const parsed = await parseJsonResponseSafe<{
        ok?: boolean;
        status?: TelegramBotStatusPayload;
        message?: string;
      }>(resp, 'خطا در توقف ربات');
      if (parsed.data?.status) setStatus(parsed.data.status);
      if (parsed.ok) {
        setFeedbackMsg(parsed.data?.message || 'ربات متوقف شد.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimPolling = async () => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setIsSubmitting(true);
    try {
      const resp = await fetch(resolveApiUrl('/api/telegram/claim-polling'), { method: 'POST' });
      const parsed = await parseJsonResponseSafe<{
        ok?: boolean;
        status?: TelegramBotStatusPayload;
        message?: string;
      }>(resp, 'خطا در فعال‌سازی دریافت پیام‌ها در همین محیط');
      if (parsed.data?.status) setStatus(parsed.data.status);
      if (parsed.ok && parsed.data?.ok) {
        setFeedbackMsg(parsed.data.message || 'دریافت پیام‌های ورودی در همین محیط فعال شد ✓');
      } else {
        setErrorMsg(parsed.data?.message || parsed.errorMessage || 'انتقال دریافت پیام‌ها ناموفق بود.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const workshopDisplayName = settings.workshopName || 'فروشگاه کارگاه مهندس صفری';
  const botStartDeepLinks = status?.botUsername
    ? [
        { label: '🏠 باز کردن ربات و فروشگاه اصلی', url: `https://t.me/${status.botUsername}` },
        { label: '🛒 مینی‌اپ کاتالوگ و خرید', url: `${webAppUrlInput || status.webAppUrl}?tab=catalog` },
        { label: '🧮 مینی‌اپ محاسبه‌گر دوز کود', url: `${webAppUrlInput || status.webAppUrl}?tab=calculator` },
        { label: '🌦 مینی‌اپ هواشناسی و سمپاشی', url: `${webAppUrlInput || status.webAppUrl}?tab=weather` },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Header Status Banner */}
      <div className="bg-gradient-to-l from-sky-900 via-sky-800 to-emerald-900 text-white rounded-3xl p-5 shadow-lg border border-sky-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-base font-extrabold">
                ربات تلگرام فروشگاه و مینی‌اپ اختصاصی
              </h3>
              <span className="text-sky-200/80 text-xs font-medium">
                {isLoading
                  ? '· در حال بررسی وضعیت اتصال...'
                  : status?.conflictActive
                  ? '· متصل (هم‌زیستی با محیط هم‌زمان)'
                  : status?.isRunning
                  ? `· متصل و فعال (${status.mode === 'webhook' ? 'Webhook' : 'Polling زنده'})`
                  : '· در انتظار تنظیم توکن BotFather'}
              </span>
            </div>
            <p className="text-xs text-sky-100/90 leading-relaxed max-w-3xl">
              تمامی بخش‌های برنامه شامل کاتالوگ محصولات و قیمت روز، محاسبه‌گر دوز کود، نکات طلایی، هواشناسی کشاورزی، پیگیری سفارش، مشاوره هوشمند و <b>باز شدن مستقیم وب‌اپ داخل تلگرام (Menu Button)</b> روی ربات اختصاصی شما فعال است.
            </p>
          </div>

          {status?.botUsername && (
            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 border border-white/20 shrink-0 text-xs space-y-1.5">
              <div className="text-[10px] text-sky-200">شناسه ربات فعال در تلگرام:</div>
              <div className="font-mono font-extrabold text-sm text-amber-300" dir="ltr">
                @{status.botUsername}
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={`https://t.me/${status.botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold rounded-lg text-[10px] transition-colors"
                >
                  باز کردن در تلگرام ↗
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy('botlink', `https://t.me/${status.botUsername}`)}
                  className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white font-bold rounded-lg text-[10px]"
                >
                  {copiedKey === 'botlink' ? 'کپی شد ✓' : 'کپی لینک'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3.5 border-t border-white/15 text-xs">
          <div className="bg-white/10 rounded-xl px-3 py-2">
            <div className="text-[10px] text-sky-200">محصولات همگام‌شده با ربات</div>
            <div className="font-mono font-extrabold text-sm mt-0.5">
              {(status?.syncedProductsCount ?? activeProductsCount).toLocaleString('fa-IR')} محصول
            </div>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2">
            <div className="text-[10px] text-sky-200">سفارش‌های قابل پیگیری در ربات</div>
            <div className="font-mono font-extrabold text-sm mt-0.5">
              {(status?.syncedOrdersCount ?? orders.length).toLocaleString('fa-IR')} سفارش
            </div>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2">
            <div className="text-[10px] text-sky-200">کاربران متصل در تلگرام</div>
            <div className="font-mono font-extrabold text-sm mt-0.5">
              {(status?.knownUsersCount ?? 0).toLocaleString('fa-IR')} کاربر
            </div>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2">
            <div className="text-[10px] text-sky-200">وضعیت آدرس وب‌اپ (Mini App)</div>
            <div className="font-bold text-[11px] mt-0.5">
              {status?.isWebAppUrlHttps ? '✅ HTTPS امن برای تلگرام' : '⚠️ نیازمند آدرس HTTPS'}
            </div>
          </div>
        </div>
      </div>

      {/* Transparency & Architecture Note */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 rounded-2xl p-4 text-xs space-y-2">
        <h4 className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
          <span>ℹ️</span>
          <span>نحوه ساخت ربات با اکانت تلگرام مدیر و اجرای وب‌اپ داخل تلگرام</span>
        </h4>
        <ul className="space-y-1.5 text-amber-900/90 dark:text-amber-300/90 list-disc list-inside leading-relaxed">
          <li>
            به دلیل امنیت حساب تلگرام، تنها شخص مدیر با اکانت خودش می‌تواند در ربات <b>@BotFather</b> دستور{' '}
            <code className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 rounded font-mono">/newbot</code> را بزند و توکن دریافت کند (هیچ برنامه‌ای بدون توکن دسترسی به ساخت ربات در اکانت شخصی ندارد).
          </li>
          <li>
            بلافاصله پس از وارد کردن توکن در فرم زیر، سرور ما تمام دستورات، توضیحات، دکمه فشرده منوی مینی‌اپ (<b>فروشگاه</b>) و صفحات وب‌اپ را روی سرور تلگرام ثبت می‌کند؛ از آن لحظه مشتری با باز کردن ربات، وب‌اپ را به‌صورت مستقیم از طریق تلگرام بارگذاری کرده و شماره موبایل او در بخش ورود و ثبت‌نام به‌طور پیش‌فرض تکمیل می‌شود.
          </li>
        </ul>

        {/* 1-Click Copy Helpers for @BotFather */}
        <div className="pt-2 flex flex-wrap gap-2 items-center">
          <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">کپی سریع برای BotFather:</span>
          <button
            type="button"
            onClick={() => handleCopy('bf_cmd', '/newbot')}
            className="px-2.5 py-1 bg-white dark:bg-stone-800 border border-amber-300 dark:border-amber-700 rounded-lg font-mono text-[11px] hover:bg-amber-100"
          >
            {copiedKey === 'bf_cmd' ? 'کپی شد ✓' : '/newbot'}
          </button>
          <button
            type="button"
            onClick={() => handleCopy('bf_name', workshopDisplayName)}
            className="px-2.5 py-1 bg-white dark:bg-stone-800 border border-amber-300 dark:border-amber-700 rounded-lg text-[11px] hover:bg-amber-100"
          >
            {copiedKey === 'bf_name' ? 'نام کپی شد ✓' : `نام پیشنهادی: ${workshopDisplayName.slice(0, 24)}...`}
          </button>
          <button
            type="button"
            onClick={() => handleCopy('bf_user', 'safari_vermi_shop_bot')}
            className="px-2.5 py-1 bg-white dark:bg-stone-800 border border-amber-300 dark:border-amber-700 rounded-lg font-mono text-[11px] hover:bg-amber-100"
          >
            {copiedKey === 'bf_user' ? 'کپی شد ✓' : 'safari_vermi_shop_bot'}
          </button>
        </div>
      </div>

      {/* Feedback / Coexistence Notice / Fatal Errors */}
      {feedbackMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-sm">
          {feedbackMsg}
        </div>
      )}
      {status?.conflictActive && status?.conflictMessage && (
        <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-100 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <span>ℹ️ {status.conflictMessage}</span>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClaimPolling}
            className="px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-[11px] shrink-0 whitespace-nowrap"
          >
            🎯 دریافت پیام‌های ورودی در همین محیط
          </button>
        </div>
      )}
      {(errorMsg || (!status?.botVerified && status?.lastError)) && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <span>⚠️ {errorMsg || status?.lastError}</span>
        </div>
      )}

      {/* Configuration Form */}
      <form
        onSubmit={handleConfigureAndStart}
        className="bg-white dark:bg-stone-900 rounded-3xl p-5 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 text-xs"
      >
        <h4 className="text-sm font-extrabold text-stone-900 dark:text-stone-100 flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
          <span>🔑</span>
          <span>پیکربندی اتصال ربات و مینی‌اپ تلگرام</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bot Token */}
          <div className="space-y-1.5">
            <label className="block font-bold text-stone-700 dark:text-stone-200">
              توکن ربات تلگرام (HTTP API Token از @BotFather)
            </label>
            <input
              type="password"
              dir="ltr"
              value={botTokenInput}
              onChange={(e) => setBotTokenInput(e.target.value)}
              placeholder={
                status?.hasToken
                  ? `توکن فعلی ثبت‌شده (${status.tokenMasked}) · برای تغییر، توکن جدید بزنید`
                  : 'مثال: 7512345678:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-xs"
            />
            <p className="text-[10.5px] text-stone-500 dark:text-stone-400">
              توکن صرفاً در حافظه سرور نگه داشته می‌شود و هرگز در سمت مرورگر مشتریان افشا نمی‌گردد.
            </p>
          </div>

          {/* WebApp HTTPS URL */}
          <div className="space-y-1.5">
            <label className="block font-bold text-stone-700 dark:text-stone-200">
              آدرس واحد باز شدن فروشگاه و مینی‌اپ در ربات (هماهنگ با تنظیمات مدیر)
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                type="url"
                dir="ltr"
                value={webAppUrlInput}
                onChange={(e) => setWebAppUrlInput(e.target.value)}
                placeholder="https://your-store-url.example"
                className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-xs"
              />
              {defaultOrigin && (
                <button
                  type="button"
                  onClick={() => setWebAppUrlInput(defaultOrigin)}
                  className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-bold text-[11px] shrink-0 whitespace-nowrap"
                >
                  ⚡ آدرس همین سرور
                </button>
              )}
              {configuredGithubUrl && (
                <button
                  type="button"
                  onClick={() => setWebAppUrlInput(configuredGithubUrl)}
                  className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 font-bold text-[11px] shrink-0 whitespace-nowrap"
                >
                  🐙 آدرس GitHub Pages
                </button>
              )}
            </div>
            <p className="text-[10.5px] text-stone-500 dark:text-stone-400">
              این آدرس هم‌زمان برای دکمه <b>فروشگاه / Open</b> ربات و تمامی دکمه‌های خرید سریع محصولات اعمال می‌شود و با فیلد «آدرس واحد ربات و مینی‌اپ» در تنظیمات مدیر یکپارچه است.
            </p>
          </div>

          {/* Transport Mode */}
          <div className="space-y-1.5">
            <label className="block font-bold text-stone-700 dark:text-stone-200">
              حالت ارتباط سرور ربات با تلگرام
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModeInput('polling')}
                className={`py-2 px-3 rounded-xl border font-bold text-[11px] transition-all ${
                  modeInput === 'polling'
                    ? 'bg-sky-700 border-sky-700 text-white shadow-xs'
                    : 'bg-stone-50 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                🔄 Long-Polling زنده (پیشنهادی)
              </button>
              <button
                type="button"
                onClick={() => setModeInput('webhook')}
                className={`py-2 px-3 rounded-xl border font-bold text-[11px] transition-all ${
                  modeInput === 'webhook'
                    ? 'bg-sky-700 border-sky-700 text-white shadow-xs'
                    : 'bg-stone-50 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                ⚡ Webhook فوری (HTTPS)
              </button>
            </div>
            <p className="text-[10.5px] text-stone-500 dark:text-stone-400">
              در حالت Long-Polling حتی اگر Webhook روی سرور بیرونی مسدود باشد، ربات بلافاصله به مشتریان پاسخ می‌دهد.
            </p>
          </div>

          {/* Admin Chat ID */}
          <div className="space-y-1.5">
            <label className="block font-bold text-stone-700 dark:text-stone-200">
              شناسه عددی تلگرام مدیر جهت دریافت فوری سفارش‌ها (Admin Chat ID)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                dir="ltr"
                value={adminChatIdInput}
                onChange={(e) => setAdminChatIdInput(e.target.value)}
                placeholder="مثال: 123456789"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-xs"
              />
              <button
                type="button"
                disabled={isTestingAdmin || !status?.hasToken}
                onClick={handleTestAdminMessage}
                className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-white font-bold text-[11px] shrink-0"
              >
                {isTestingAdmin ? 'در حال ارسال...' : '🧪 تست پیام مدیر'}
              </button>
            </div>
            <p className="text-[10.5px] text-stone-500 dark:text-stone-400">
              در تلگرام داخل ربات خودتان <code className="font-mono">/myid</code> را بزنید و عدد نمایش‌داده‌شده را اینجا وارد کنید.
            </p>
          </div>

          {/* Optional Archive Channel / Group ID for Telegram DB */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="block font-bold text-stone-700 dark:text-stone-200">
              شناسه چت یا کانال اختصاصی آرشیو پایگاه داده تلگرام (اختیاری — پیش‌فرض: همان چت مدیر بالا)
            </label>
            <input
              type="text"
              dir="ltr"
              value={storageChatIdInput}
              onChange={(e) => setStorageChatIdInput(e.target.value)}
              placeholder="در صورت خالی بودن، تمام فایل‌های صوتی، تصاویر و نسخه جامع پایگاه داده مستقیماً در تلگرام مدیر ذخیره و پین می‌شوند"
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-xs"
            />
            <p className="text-[10.5px] text-stone-500 dark:text-stone-400">
              اگر می‌خواهید فایل‌های پایگاه داده در یک کانال خصوصی آرشیو شوند، ربات را ادمین آن کانال کرده و شناسه عددی کانال (مثلاً <code className="font-mono">-100...</code>) را وارد کنید؛ در غیر این صورت خالی بگذارید تا در چت شخصی مدیر ذخیره گردد.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-sky-700 hover:bg-sky-600 disabled:opacity-60 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <span>🚀</span>
              <span>{isSubmitting ? 'در حال اتصال و تنظیم در تلگرام...' : 'اتصال و راه‌اندازی خودکار ربات + مینی‌اپ'}</span>
            </button>

            {status?.isRunning && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleStopBot}
                className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold rounded-xl hover:bg-rose-100 transition-all"
              >
                ⏹ توقف موقت ربات
              </button>
            )}
          </div>

          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <span>⚡</span>
            <span>همگام‌سازی محصولات، قیمت‌ها، تنظیمات، شماره کارت و سفارشات در کل برنامه، ربات و مینی‌اپ خودکار و لحظه‌ای است ✓</span>
          </span>
        </div>
      </form>

      {/* Capabilities & Deep Links Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        <div className="bg-stone-50 dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 space-y-2.5">
          <h5 className="font-extrabold text-stone-800 dark:text-stone-100 flex items-center gap-1.5">
            <span>✅</span>
            <span>امکانات فعال‌شده روی ربات تلگرام شما</span>
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-stone-700 dark:text-stone-300">
            <div className="bg-white dark:bg-stone-800/70 p-2.5 rounded-xl border border-stone-200/70 dark:border-stone-700">
              🛍 <b>دکمه کوتاه «فروشگاه»</b> در منوی پایین چت + تشخیص خودکار شماره مشتری در ورود و ثبت‌نام
            </div>
            <div className="bg-white dark:bg-stone-800/70 p-2.5 rounded-xl border border-stone-200/70 dark:border-stone-700">
              💳 <b>شماره کارت و شبا + ارسال رسید</b> واریز و دریافت فوری عکس فیش پرداختی مشتری در تلگرام مدیر
            </div>
            <div className="bg-white dark:bg-stone-800/70 p-2.5 rounded-xl border border-stone-200/70 dark:border-stone-700">
              🏷️ <b>کاتالوگ زنده محصولات</b> با قیمت، تخفیف و موجودی ریل‌تایم
            </div>
            <div className="bg-white dark:bg-stone-800/70 p-2.5 rounded-xl border border-stone-200/70 dark:border-stone-700">
              🧮 <b>محاسبه‌گر علمی دوز</b> با انتخاب درخت، گلخانه و آپارتمانی
            </div>
            <div className="bg-white dark:bg-stone-800/70 p-2.5 rounded-xl border border-stone-200/70 dark:border-stone-700">
              🌦 <b>هواشناسی کشاورزی شهرها</b> + توصیه سمپاشی در چت
            </div>
            <div className="bg-white dark:bg-stone-800/70 p-2.5 rounded-xl border border-stone-200/70 dark:border-stone-700">
              📦 <b>پیگیری سفارش با کد/موبایل</b> + هشدار آنی سفارش جدید به مدیر
            </div>
          </div>
        </div>

        <div className="bg-stone-50 dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 space-y-2.5">
          <h5 className="font-extrabold text-stone-800 dark:text-stone-100 flex items-center gap-1.5">
            <span>🔗</span>
            <span>لینک‌های مستقیم بخش‌های فروشگاه برای کانال و استوری</span>
          </h5>
          {botStartDeepLinks.length > 0 ? (
            <div className="space-y-2">
              {botStartDeepLinks.map((lnk, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 bg-white dark:bg-stone-800/70 px-3 py-2 rounded-xl border border-stone-200/70 dark:border-stone-700"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-stone-800 dark:text-stone-200 text-[11px]">{lnk.label}</div>
                    <div className="font-mono text-[10px] text-sky-700 dark:text-sky-400 truncate" dir="ltr">
                      {lnk.url}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(`dl_${idx}`, lnk.url)}
                    className="px-2.5 py-1 bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 rounded-lg text-[10px] font-bold shrink-0"
                  >
                    {copiedKey === `dl_${idx}` ? 'کپی شد ✓' : 'کپی'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed py-4">
              پس از وارد کردن توکن @BotFather و کلیک روی دکمه راه‌اندازی، لینک مستقیم ربات و لینک اختصاصی ورود به هر بخش وب‌اپ اینجا نمایش داده می‌شوند.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
