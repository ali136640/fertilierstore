import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { resolveAssetOrApiUrl, normalizeBaseUrl, buildGithubPagesUrl } from '../utils/apiBase';
import { loadStoreSettings } from '../utils/storeStorage';
import {
  Download,
  CheckCircle2,
  X,
  Share2,
  Check,
} from 'lucide-react';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  appLogoSrc?: string;
  workshopName?: string;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({
  isOpen,
  onClose,
  appLogoSrc,
  workshopName = 'گروه تولیدی و زیست‌فناوری مهندس صفری',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const settings = loadStoreSettings();
  const resolvedLogo = resolveAssetOrApiUrl(appLogoSrc, 'pwa-192x192.png');
  const configuredWebAppUrl =
    normalizeBaseUrl(settings.telegramWebAppUrl) ||
    (settings.githubPagesEnabled
      ? buildGithubPagesUrl({
          owner: settings.githubOwner,
          repo: settings.githubRepo,
          customDomain: settings.githubCustomDomain,
        })
      : '');
  const resolvedAppUrl =
    typeof window !== 'undefined' && window.location.origin.startsWith('https://')
      ? window.location.origin + ((import.meta as any).env?.BASE_URL || '/')
      : configuredWebAppUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(resolvedAppUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDirectInstall = async () => {
    const success = await install();
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
      <div className="w-full max-w-xl bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden text-right font-sans my-8">

        {/* Modal Header (Instant Install Only) */}
        <div className="bg-emerald-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute left-5 top-5 p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-950 text-white transition-colors"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <img
              src={resolvedLogo}
              alt={workshopName}
              className="w-12 h-12 rounded-xl object-cover border border-white/25 bg-white shrink-0 shadow-md"
            />
            <div>
              <h3 className="text-lg font-bold">نصب فوری اپلیکیشن {workshopName}</h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                نصب مستقیم روی گوشی (اندروید و آیفون) بدون نیاز به دانلود فایل مجزا
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Always-visible Direct App URL Card */}
          <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                🔗 لینک مستقیم App URL برنامه (جهت نصب و اشتراک‌گذاری):
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-700 text-white font-bold">
                نسخه آنلاین
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-stone-900 border border-emerald-200/80 dark:border-emerald-800/80">
              <span
                className="text-stone-700 dark:text-stone-200 font-mono text-[11px] break-all select-all text-left"
                dir="ltr"
              >
                {resolvedAppUrl}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'کپی شد!' : 'کپی لینک'}</span>
                </button>
                <a
                  href={resolvedAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-semibold transition-colors shrink-0"
                >
                  باز کردن ↗
                </a>
              </div>
            </div>
          </div>

          {isInstalled ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  برنامه هم‌اکنون روی دستگاه شما نصب است
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-400 mt-0.5">
                  شما در حال استفاده از نسخه نصب‌شده و تمام‌صفحه هستید.
                </p>
              </div>
            </div>
          ) : isInstallable ? (
            <div className="p-5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 text-center space-y-3">
              <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                نصب فوری و مستقیم روی گوشی یا کامپیوتر
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed max-w-md mx-auto">
                با لمس دکمه زیر، اپلیکیشن بلافاصله به صفحه اصلی و لیست برنامه‌های دستگاه شما اضافه می‌شود.
              </p>
              <button
                onClick={handleDirectInstall}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 mx-auto"
              >
                <Download className="w-4 h-4" />
                <span>نصب فوری اپلیکیشن</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800">
                <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-800 text-white flex items-center justify-center text-[10px] font-mono">
                    ۱
                  </span>
                  <span>
                    {isIOS
                      ? 'نصب فوری در آیفون / آیپد (Safari iOS):'
                      : 'نصب فوری از طریق مرورگر Chrome گوشی اندروید:'}
                  </span>
                </h4>
                {isIOS ? (
                  <ol className="text-xs text-stone-600 dark:text-stone-400 space-y-2 list-decimal list-inside pr-2 leading-relaxed">
                    <li>این لینک را در مرورگر <strong>Safari</strong> باز کنید.</li>
                    <li>دکمه اشتراک‌گذاری <strong>Share</strong> (مربع با فلش رو به بالا) را لمس کنید.</li>
                    <li>به پایین اسکرول کرده و گزینه <strong>Add to Home Screen</strong> را بزنید.</li>
                    <li>گزینه <strong>Add</strong> را تایید کنید تا آیکون وب‌اپ نصب شود.</li>
                  </ol>
                ) : (
                  <ol className="text-xs text-stone-600 dark:text-stone-400 space-y-2 list-decimal list-inside pr-2 leading-relaxed">
                    <li>این آدرس را در مرورگر <strong>Google Chrome</strong> گوشی خود باز کنید.</li>
                    <li>روی <strong>علامت سه‌نقطه (⋮)</strong> در بالا سمت راست مرورگر بزنید.</li>
                    <li>گزینه <strong>«نصب برنامه» (Install app)</strong> یا <strong>«افزودن به صفحه اصلی» (Add to Home screen)</strong> را انتخاب کنید.</li>
                    <li>گزینه <strong>Install</strong> را تایید نمایید تا آیکون برنامه در منوی گوشی اضافه شود.</li>
                  </ol>
                )}
              </div>
            </div>
          )}

          {/* Offline Capabilities Highlight */}
          <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
            <div className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/30">
              <span className="font-bold text-stone-800 dark:text-stone-200 block mb-1">
                ⚡ دسترسی سریع و آفلاین
              </span>
              <span className="text-[11px] text-stone-500">
                تمام فرمول‌ها و محاسبه‌گر کود حتی با اینترنت ضعیف به سرعت باز می‌شوند.
              </span>
            </div>
            <div className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/30">
              <span className="font-bold text-stone-800 dark:text-stone-200 block mb-1">
                📱 اجرای تمام‌صفحه روی موبایل
              </span>
              <span className="text-[11px] text-stone-500">
                بدون نوار آدرس مرورگر و با آیکون اختصاصی در صفحه اصلی گوشی.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-50 dark:bg-stone-800/60 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs">
          <span className="text-stone-500 text-[11px]">
            سازگار با اندروید، آیفون و دسکتاپ
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 rounded-lg font-semibold transition-colors"
          >
            بستن پنجره
          </button>
        </div>

      </div>
    </div>
  );
};
