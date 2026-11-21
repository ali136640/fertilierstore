import React from 'react';
import { WorkshopStoreSettings } from '../types/storefront';
import { resolveAssetOrApiUrl } from '../utils/apiBase';

interface StoreSealBadgeProps {
  settings: WorkshopStoreSettings;
  appLogoSrc: string;
  size?: 'sm' | 'md' | 'lg';
}

const SEAL_PALETTE: Record<
  string,
  { border: string; text: string; subtext: string; bg: string }
> = {
  '#065f46': {
    border: '#065f46',
    text: '#064e3b',
    subtext: '#047857',
    bg: 'rgba(236, 253, 245, 0.72)',
  },
  '#1d4ed8': {
    border: '#1d4ed8',
    text: '#1e3a8a',
    subtext: '#2563eb',
    bg: 'rgba(239, 246, 255, 0.78)',
  },
  '#9f1239': {
    border: '#9f1239',
    text: '#881337',
    subtext: '#be123c',
    bg: 'rgba(255, 241, 242, 0.75)',
  },
  '#1c1917': {
    border: '#292524',
    text: '#1c1917',
    subtext: '#44403c',
    bg: 'rgba(245, 245, 244, 0.85)',
  },
};

export function StoreSealBadge({
  settings,
  appLogoSrc,
  size = 'md',
}: StoreSealBadgeProps) {
  const isEnabled = settings.enableInvoiceSeal ?? true;
  if (!isEnabled) return null;

  // Respect explicit independent seal mode; never force app logo unless explicitly selected as 'logo'
  const mode: 'text_stamp' | 'custom_image' | 'logo' =
    settings.invoiceSealMode ||
    (settings.invoiceSealImageDataUrl
      ? 'custom_image'
      : settings.useLogoAsInvoiceSeal
      ? 'logo'
      : 'text_stamp');

  const colorKey = settings.invoiceSealColor || '#065f46';
  const palette = SEAL_PALETTE[colorKey] || SEAL_PALETTE['#065f46'];

  const sealTitle = (settings.invoiceSealTitle || settings.workshopName || 'گروه زیست‌فناوری مهندس صفری').trim();
  const sealSubtitle = (settings.invoiceSealSubtitle || 'مهر معتبر تایید فروش و بارگیری').trim();
  const sealCode = (settings.invoiceSealCode || settings.managerLicenseCode || 'ISIRI 13724').trim();

  const dimensions =
    size === 'sm'
      ? 'w-20 h-20 p-1.5'
      : size === 'lg'
      ? 'w-28 h-28 p-2'
      : 'w-24 h-24 p-2';

  if (mode === 'custom_image' && settings.invoiceSealImageDataUrl) {
    return (
      <div className="flex flex-col items-center justify-center shrink-0">
        <img
          src={resolveAssetOrApiUrl(settings.invoiceSealImageDataUrl, 'pwa-192x192.png')}
          alt={sealTitle || 'مهر معتبر فروشگاه'}
          className={`${dimensions} object-contain rounded-xl -rotate-3`}
        />
      </div>
    );
  }

  if (mode === 'logo') {
    return (
      <div
        className={`${dimensions} rounded-full border-2 border-double flex flex-col items-center justify-center text-center shrink-0 -rotate-6 shadow-xs`}
        style={{
          borderColor: palette.border,
          backgroundColor: palette.bg,
        }}
      >
        <img
          src={appLogoSrc}
          alt={sealTitle}
          className={size === 'lg' ? 'w-10 h-10 rounded-full object-cover bg-white border' : 'w-8 h-8 rounded-full object-cover bg-white border'}
          style={{ borderColor: palette.border }}
        />
        <span
          className="text-[7.5px] font-extrabold leading-tight mt-0.5 line-clamp-1"
          style={{ color: palette.text }}
        >
          {sealTitle}
        </span>
        <span
          className="text-[6.5px] font-bold leading-tight line-clamp-1"
          style={{ color: palette.subtext }}
        >
          {sealSubtitle}
        </span>
      </div>
    );
  }

  // Default: Independent Editable Text Stamp (NO Logo!)
  return (
    <div
      className={`${dimensions} rounded-full border-[3px] border-double flex flex-col items-center justify-center text-center shrink-0 -rotate-6 shadow-xs relative`}
      style={{
        borderColor: palette.border,
        backgroundColor: palette.bg,
      }}
    >
      <div
        className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center px-1.5 py-1"
        style={{ borderColor: palette.border }}
      >
        <span
          className="text-[7.5px] font-extrabold leading-tight line-clamp-2"
          style={{ color: palette.text }}
        >
          {sealTitle}
        </span>
        <div
          className="w-10 h-[1px] my-0.5 opacity-60"
          style={{ backgroundColor: palette.border }}
        />
        <span
          className="text-[7px] font-bold leading-tight line-clamp-1"
          style={{ color: palette.subtext }}
        >
          {sealSubtitle}
        </span>
        {sealCode && (
          <span
            className="text-[6.5px] font-mono font-bold mt-0.5 line-clamp-1"
            style={{ color: palette.text }}
          >
            {sealCode}
          </span>
        )}
      </div>
    </div>
  );
}
