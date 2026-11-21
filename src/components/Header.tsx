import React from 'react';
import { Printer, Moon, Sun, Smartphone, HardDrive } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onPrintCertificate: () => void;
  onOpenAndroidModal: () => void;
  onOpenBackupModal: () => void;
  isDark: boolean;
  toggleDark: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onPrintCertificate,
  onOpenAndroidModal,
  onOpenBackupModal,
  isDark,
  toggleDark,
}) => {
  const navLinks = [
    { id: 'calculator', label: 'ماشین‌حساب فرمولاسیون' },
    { id: 'ai', label: 'هوش مصنوعی کارگاه' },
    { id: 'masoud', label: 'واحد مسعود (پیش‌کمپوست)' },
    { id: 'mohammad', label: 'واحد محمد (بستر و کرم)' },
    { id: 'troubleshoot', label: 'پایش و عیب‌یابی' },
    { id: 'certificate', label: 'شناسنامه آزمایشگاهی' },
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 border-b border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md no-print">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setActiveTab('calculator')}
          className="text-base sm:text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap text-right"
        >
          گروه تولیدی و زیستفناوری مهندس صفری
        </button>
      </div>

      {/* Zone 2: 4–5 concise single-line text navigation links */}
      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-stone-600 dark:text-stone-300">
        {navLinks.map((link) => {
          const isActive = activeTab === link.id;
          return (
            <button
              key={link.id}
              onClick={() => setActiveTab(link.id)}
              className={`hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 text-xs xl:text-sm pb-0.5 border-b-2 ${
                isActive
                  ? 'text-emerald-700 dark:text-emerald-400 border-emerald-600 font-semibold'
                  : 'border-transparent text-stone-600 dark:text-stone-400'
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Actions (Android install, Print certificate, Theme toggle) */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onOpenBackupModal}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors whitespace-nowrap shrink-0 border border-stone-200 dark:border-stone-700"
          title="مدیریت حافظه سیستم و پشتیبان‌گیری داده‌ها"
        >
          <HardDrive className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          <span className="hidden md:inline">حافظه و پشتیبان</span>
        </button>

        <button
          onClick={onOpenAndroidModal}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
          title="نصب نسخه اندروید و راهنمای APK"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">نسخه اندروید (APK)</span>
          <span className="sm:hidden">اندروید</span>
        </button>

        <button
          onClick={toggleDark}
          className="p-2 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 transition-colors rounded-md"
          title={isDark ? 'حالت روشن' : 'حالت تیره'}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onPrintCertificate}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-600 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
        >
          <Printer className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">صدور برگه آنالیز</span>
        </button>
      </div>
    </header>
  );
};
