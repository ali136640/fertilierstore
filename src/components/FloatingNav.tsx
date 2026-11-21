import React from 'react';
import { 
  Calculator, 
  ShoppingBag,
  Bot, 
  Flame, 
  Layers, 
  Activity, 
  AlertTriangle, 
  Award, 
  BookOpen, 
  Sparkles,
  Printer,
  HardDrive,
  Smartphone,
  Sun,
  Moon
} from 'lucide-react';

interface FloatingNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  targetOutputKg: number;
  batchCode: string;
  startDate: string;
  precompostSupervisor: string;
  bedSupervisor: string;
  isMasoudApproved: boolean;
  onOpenAndroidModal: () => void;
  onOpenBackupModal: () => void;
  onPrintCertificate: () => void;
  isDark: boolean;
  toggleDark: () => void;
}

export const FloatingNav: React.FC<FloatingNavProps> = ({
  activeTab,
  setActiveTab,
  targetOutputKg,
  batchCode,
  startDate,
  precompostSupervisor,
  bedSupervisor,
  isMasoudApproved,
  onOpenAndroidModal,
  onOpenBackupModal,
  onPrintCertificate,
  isDark,
  toggleDark,
}) => {
  const tabs = [
    { 
      id: 'calculator', 
      label: 'ماشین‌حساب', 
      icon: Calculator, 
      badge: `${targetOutputKg.toLocaleString('fa-IR')} kg` 
    },
    { 
      id: 'store', 
      label: 'فروشگاه محصولات', 
      icon: ShoppingBag, 
      badge: 'خرید آنلاین' 
    },
    { 
      id: 'ai', 
      label: 'هوش مصنوعی', 
      icon: Bot, 
      badge: 'مشاور آنلاین/آفلاین' 
    },
    { 
      id: 'masoud', 
      label: `واحد ${precompostSupervisor.split(' ')[0]} (دپو)`, 
      icon: Flame, 
      badge: isMasoudApproved ? 'تایید شد' : 'دپوی ۵۵°' 
    },
    { 
      id: 'mohammad', 
      label: `واحد ${bedSupervisor.split(' ')[0]} (بستر)`, 
      icon: Layers, 
      badge: '۶ نوبت تغذیه' 
    },
    { 
      id: 'timeline', 
      label: 'شبیه‌ساز دوره', 
      icon: Activity 
    },
    { 
      id: 'troubleshoot', 
      label: 'عیب‌یابی آفات', 
      icon: AlertTriangle 
    },
    { 
      id: 'certificate', 
      label: 'شناسنامه آنالیز', 
      icon: Award, 
      badge: 'استاندارد' 
    },
    { 
      id: 'science', 
      label: 'دانشنامه بیوشیمی', 
      icon: BookOpen 
    },
  ];

  return (
    <>
      {/* Floating Top Header Island (Brand & Global Actions) */}
      <header className="sticky top-3 z-40 max-w-7xl mx-auto px-4 sm:px-6 w-full no-print">
        <div className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-md rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-md px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 transition-all">
          
          {/* Brand & Batch Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('calculator')}
              className="text-right flex flex-col group text-stone-900 dark:text-stone-100"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span className="text-sm sm:text-base font-extrabold tracking-tight group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors">
                  گروه تولیدی و زیست فناوری مهندس صفری
                </span>
              </div>
              <div className="text-[11px] text-stone-500 font-mono mt-0.5 hidden sm:block">
                سامانه کارگاهی تولید ورمیکمپوست و کودهای بیولوژیک صادراتی
              </div>
            </button>
          </div>

          {/* Quick Info & Top Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-stone-100/80 dark:bg-stone-800/80 px-2.5 py-1 rounded-lg text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
              <span className="text-[10px] text-stone-400">بچ فعال:</span>
              <span className="font-bold">{batchCode}</span>
              <span className="text-stone-300 dark:text-stone-600">|</span>
              <span>{startDate}</span>
            </div>

            <button
              onClick={() => setActiveTab('store')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs ${
                activeTab === 'store'
                  ? 'bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-500'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
              title="فروشگاه آنلاین محصولات کارگاه"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>فروشگاه آنلاین</span>
            </button>

            <button
              onClick={onOpenBackupModal}
              className="p-2 sm:px-2.5 sm:py-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors border border-stone-200 dark:border-stone-700 flex items-center gap-1.5"
              title="پشتیبان‌گیری و حافظه محلی"
            >
              <HardDrive className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span className="hidden lg:inline text-xs">پشتیبان</span>
            </button>

            <button
              onClick={onOpenAndroidModal}
              className="px-2.5 py-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
              title="نصب نسخه اندروید و راهنمای APK"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">نسخه اندروید (APK)</span>
              <span className="sm:hidden">APK</span>
            </button>

            <button
              onClick={toggleDark}
              className="p-2 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 transition-colors rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 border border-transparent hover:border-stone-200"
              title={isDark ? 'حالت روشن' : 'حالت تیره'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={onPrintCertificate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-600 rounded-xl transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">صدور شناسنامه</span>
            </button>
          </div>

        </div>
      </header>

      {/* Floating Navigation Dock (Fully visible menu without clipping) */}
      <nav 
        aria-label="منوی شناور سامانه کارگاه" 
        className="sticky top-20 z-30 max-w-7xl mx-auto px-4 sm:px-6 w-full pt-1.5 no-print"
      >
        <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl border border-stone-200/90 dark:border-stone-800 shadow-md p-1.5 flex items-center justify-start xl:justify-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-emerald-800 text-white font-bold shadow-sm ring-2 ring-emerald-700/20'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-white' : 'text-stone-500 dark:text-stone-400'}`} />
                <span className="text-[11px] sm:text-xs">{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? 'bg-emerald-950/70 text-emerald-100'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
