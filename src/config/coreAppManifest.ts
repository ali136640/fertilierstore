import { WorkshopStoreSettings } from '../types/storefront';

export const CORE_APP_VERSION = '2.5.0';

export const CORE_APP_SECTIONS = [
  'store_catalog',
  'nutrition_calculator',
  'golden_tips_and_faq',
  'ag_weather_briefing',
  'customer_cart_checkout',
  'customer_profile_orders',
  'admin_dashboard',
  'admin_voice_studio',
] as const;

export const CORE_UPDATE_NOTES =
  'بارگذاری یک‌باره و کش دائمی تصاویر/صوت‌های بازشده روی دستگاه، منوی کشویی سوالات پرتکرار مشاور تخصصی و بروزرسانی بر اساس تنظیمات اصلی';

export interface CoreSectionDefinition {
  id: string;
  label: string;
  description: string;
}

export const CORE_SECTION_LABELS: CoreSectionDefinition[] = [
  { id: 'store_catalog', label: 'فروشگاه و کاتالوگ محصولات', description: 'نمایش و خرید آنلاین محصولات با معرفی صوتی و کش محلی' },
  { id: 'nutrition_calculator', label: 'ماشین‌حساب علمی تغذیه گیاه', description: 'محاسبه دقیق دوز مصرف بر اساس نوع گیاه و سن درخت' },
  { id: 'golden_tips_and_faq', label: 'نکات طلایی و منوی کشویی مشاور تخصصی', description: 'پاسخ هوشمند مهندس صفری + سوالات پرتکرار و توصیه‌های میدانی' },
  { id: 'ag_weather_briefing', label: 'هواشناسی کشاورزی و هشدار سمپاشی', description: 'پیش‌بینی زنده موقعیت مشتری با راهنمای زمان سمپاشی' },
];

/**
 * Deterministic signature derived strictly from core app structure & primary Admin settings
 * (never from server timestamps) so updates trigger only on real structural/settings changes.
 */
export function buildCoreSettingsSignature(
  settings?: Partial<WorkshopStoreSettings> | null
): string {
  const coreVer = (settings?.coreAppVersion || CORE_APP_VERSION).trim();
  const calc = settings?.enableCalculator ?? true ? '1' : '0';
  const stock = settings?.showStockCountToCustomers ?? true ? '1' : '0';
  const badge = settings?.trustBadgeMode || 'app_logo';
  const appName = (settings?.pwaAppName || '').trim();
  return `${coreVer}|calc:${calc}|stock:${stock}|badge:${badge}|name:${appName}`;
}
