import React, { useState } from 'react';
import { FormulationResult } from '../types/vermicompost';
import { 
  Play, 
  RotateCcw, 
  Clock, 
  Thermometer, 
  Droplet, 
  Activity, 
  ShieldCheck, 
  CheckCircle2, 
  Layers, 
  Sparkles 
} from 'lucide-react';

interface ProcessTimelineProps {
  formulation: FormulationResult;
}

export const ProcessTimeline: React.FC<ProcessTimelineProps> = ({ formulation }) => {
  const [currentDay, setCurrentDay] = useState<number>(25);

  // Dynamic values depending on currentDay
  let phaseName = '';
  let operator = '';
  let temp = 22;
  let ph = 7.1;
  let moisture = 68;
  let wormActivity = 'طبیعی و فعال';
  let dailyAction = '';

  if (currentDay <= 4) {
    phaseName = 'فاز ۱: اختلاط اولیه و شروع تخمیر مزوفیل';
    operator = 'مسعود (واحد پیش‌کمپوست)';
    temp = 35 + currentDay * 4;
    ph = 5.8;
    moisture = 65;
    wormActivity = 'هنوز وارد نشده (توده در حال آماده‌سازی)';
    dailyAction = 'مخلوط کردن ۱۶۰۰ کیلو کود با ۶۸۰ کیلو قهوه، ۵۰ کیلو کربنات کلسیم و ۷۰ کیلو زئولیت، پاشش محلول ملاس.';
  } else if (currentDay <= 12) {
    phaseName = 'فاز ۲: اوج ترموفیل گرمادوست (عقیم‌سازی ۵۵°+)';
    operator = 'مسعود (واحد پیش‌کمپوست)';
    temp = 58;
    ph = 6.4;
    moisture = 60;
    wormActivity = 'عدم تماس کرم (دمای کشنده)';
    dailyAction = 'دمای ۵۵ تا ۶۰ درجه سانتیگراد کافئین مازاد و تانن را تجزیه کرده و بذر علف و نماتد را می‌سوزاند. هوادهی و زیرورو کردن اول.';
  } else if (currentDay <= 19) {
    phaseName = 'فاز ۳: خنک‌سازی بیولوژیک و آماده‌سازی گیت';
    operator = 'مسعود (واحد پیش‌کمپوست)';
    temp = Math.max(22, 58 - (currentDay - 12) * 5);
    ph = 7.0;
    moisture = 66;
    wormActivity = 'آماده تست زیستی';
    dailyAction = 'هوادهی مجدد برای خروج گاز آمونیاک و کاهش دما به زیر ۲۵ درجه. آماده‌سازی ظرف تست زیستی ۱۰ کرم.';
  } else if (currentDay === 20) {
    phaseName = 'فاز ۴: گیت زیستی تحویل خوراک از مسعود به محمد';
    operator = 'مسعود و محمد';
    temp = 22;
    ph = 7.2;
    moisture = 68;
    wormActivity = 'تست زیستی ۲۴ ساعته: ۱۰ کرم زنده و شاداب';
    dailyAction = 'کنترل نهایی دما، بوی خاک باران‌خورده، تست مشت رطوبت و صدور برگه ترخیص بار به بسترهای محمد.';
  } else if (currentDay <= 65) {
    phaseName = 'فاز ۵: گوارش کرم و تغذیه لایه‌ای ۶ مرحله‌ای';
    operator = 'محمد (واحد بستر و کرم)';
    temp = 22;
    ph = 7.15;
    moisture = 68;
    wormActivity = 'حداکثر اشتها و تولید اسید هیومیک';
    const cycleNum = Math.min(6, Math.floor((currentDay - 20) / 7.5) + 1);
    dailyAction = `اجرای نوبت ۰${cycleNum} تغذیه لایه‌ای (۵ تا ۷ سانتیمتر)، حفظ تاریکی با گونی کنفی و مه‌پاشی منظم روزانه.`;
  } else if (currentDay <= 70) {
    phaseName = 'فاز ۶: قطع آب و تله‌گذاری توری (Trapping)';
    operator = 'محمد (واحد بستر)';
    temp = 21;
    ph = 7.2;
    moisture = 55;
    wormActivity = 'مهاجرت به سمت توری طعمه قهوه و ملاس';
    dailyAction = 'قطع آبدهی ۳ تا ۵ روز قبل از برداشت، انداختن توری و طعمه تفاله قهوه شیرین؛ جداسازی ۹۰٪ کرم‌ها بدون آسیب.';
  } else {
    phaseName = 'فاز ۷: هوادهی در سایه، سرند ترامپل و بسته‌بندی';
    operator = 'محمد و مسعود';
    temp = 20;
    ph = 7.15;
    moisture = 32;
    wormActivity = 'کرم‌ها به بستر جدید منتقل شده‌اند';
    dailyAction = 'کاهش رطوبت به ۳۲٪، عبور از سرند دوار ترامپل ۲ تا ۳ میلیمتر و تولید ۱ تن ورمیکمپوست گرانوله اعلا صادراتی.';
  }

  const progressPercent = Math.round((currentDay / 75) * 100);

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-100 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-400 mb-1">
            <Activity className="w-4 h-4" />
            <span>شبیه‌ساز بیولوژیک چرخه ۷۵ روزه تولید ورمیکمپوست درجه ۱</span>
          </div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            تایم‌لاین و تغییرات فیزیکوشیمیایی توده (روز ۰ الی ۷۵)
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentDay(1)}
            className="px-3 py-1.5 text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md border border-stone-200 dark:border-stone-700 transition-colors"
          >
            روز ۱ (شروع مسعود)
          </button>
          <button
            onClick={() => setCurrentDay(20)}
            className="px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-md border border-amber-300 dark:border-amber-800 transition-colors font-medium"
          >
            روز ۲۰ (گیت تحویل)
          </button>
          <button
            onClick={() => setCurrentDay(72)}
            className="px-3 py-1.5 text-xs text-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md border border-emerald-300 dark:border-emerald-800 transition-colors font-medium"
          >
            روز ۷۲ (برداشت و سرند)
          </button>
        </div>
      </div>

      {/* Interactive Day Scrubber */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">موقعیت زمانی دوره:</span>
            <span className="text-lg font-bold font-mono text-emerald-800 dark:text-emerald-400">
              روز {currentDay} از ۷۵ ({progressPercent}٪)
            </span>
          </div>
          <span className="text-xs text-stone-500 font-medium">{phaseName}</span>
        </div>

        <input
          type="range"
          min="1"
          max="75"
          value={currentDay}
          onChange={(e) => setCurrentDay(parseInt(e.target.value))}
          className="w-full accent-emerald-800 cursor-pointer h-2.5 bg-stone-200 dark:bg-stone-700 rounded-lg"
        />

        <div className="flex justify-between text-[11px] text-stone-400 font-mono">
          <span>روز ۱: اختلاط اولیه</span>
          <span>روز ۸: اوج ۵۸°C ترموفیل</span>
          <span>روز ۲۰: گیت زیستی</span>
          <span>روز ۴۰: تغذیه میانی</span>
          <span>روز ۶۸: تله‌گذاری</span>
          <span>روز ۷۵: سرند ترامپل</span>
        </div>
      </div>

      {/* Status Card for Current Day */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
        <div>
          <div className="text-[11px] text-stone-400 flex items-center gap-1">
            <Thermometer className="w-3.5 h-3.5" />
            <span>دمای توده/بستر</span>
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100 mt-1">
            {temp}°C
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            {temp > 50 ? 'فاز بهداشتی ۵۵°+' : temp <= 25 ? 'مطلوب کرم‌ها' : 'درحال خنک شدن'}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-stone-400 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" />
            <span>اسیدیته (pH)</span>
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-400 mt-1">
            {ph}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            {ph < 6 ? 'اسیدیته اولیه قهوه' : 'بافرشده با کربنات کلسیم'}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-stone-400 flex items-center gap-1">
            <Droplet className="w-3.5 h-3.5" />
            <span>رطوبت نسبی</span>
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100 mt-1">
            {moisture}٪
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            {moisture > 60 ? 'رطوبت تغذیه فعال' : 'رطوبت استاندارد سرند (۳۲٪)'}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-stone-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>مسئول نوبت</span>
          </div>
          <div className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-1">
            {operator}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 truncate">
            {wormActivity}
          </div>
        </div>
      </div>

      {/* Operational Task of the Day */}
      <div className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
            دستورالعمل اجرایی کارگاه در روز {currentDay}:
          </div>
          <p className="text-xs text-emerald-950 dark:text-emerald-300 mt-1 leading-relaxed">
            {dailyAction}
          </p>
        </div>
      </div>
    </div>
  );
};
