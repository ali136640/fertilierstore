import React, { useState } from 'react';
import { FormulationResult, BioassayChecklist } from '../types/vermicompost';
import { 
  Flame, 
  Thermometer, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Wind, 
  Clock, 
  FlaskConical,
  Check,
  UserCheck
} from 'lucide-react';

interface MasoudStationProps {
  formulation: FormulationResult;
  batchCode: string;
  checklist: BioassayChecklist;
  setChecklist: React.Dispatch<React.SetStateAction<BioassayChecklist>>;
  supervisorName?: string;
  onProceedToMohammad: () => void;
}

export const MasoudStation: React.FC<MasoudStationProps> = ({
  formulation,
  batchCode,
  checklist,
  setChecklist,
  supervisorName = 'مسعود',
  onProceedToMohammad,
}) => {
  const [currentPileTemp, setCurrentPileTemp] = useState<number>(22);
  const [isSignModalOpen, setIsSignModalOpen] = useState<boolean>(false);

  const toggleCheck = (key: keyof BioassayChecklist) => {
    setChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleApproveGate = () => {
    setChecklist((prev) => ({
      ...prev,
      isApproved: true,
      signedBy: `${supervisorName} - سرپرست واحد فرآوری و پیش‌کمپوست`,
      approvalDate: new Date().toLocaleDateString('fa-IR'),
    }));
    setIsSignModalOpen(false);
  };

  const allChecksPassed =
    checklist.tempBelow25 &&
    checklist.odorClean &&
    checklist.moistureTested &&
    checklist.wormBioassay24h;

  return (
    <div className="space-y-8">
      {/* Station Header */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
              <Flame className="w-4 h-4" />
              <span>ایستگاه شماره ۱ کارگاه · سرپرست واحد: {supervisorName}</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-stone-900 dark:text-stone-50 tracking-tight">
              واحد آماده‌سازی، فرمولاسیون و پیش‌تخمیر هوازی توده
            </h1>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-3xl">
              مسئولیت {supervisorName}: ترکیب دقیق {formulation.totalRawFeedKg.toLocaleString('fa-IR')} کیلوگرم خوراک خام با مواد معدنی، مدیریت فاز گرمادوست بالای ۵۵ درجه جهت عقیم‌سازی بذور علف و نماتد، و انجام تست بیولوژیک ۲۴ ساعته قبل از تحویل بار به محمد.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-mono">
              بچ فعال: {batchCode}
            </div>
          </div>
        </div>

        {/* 4 Execution Steps for Masoud */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
            <div className="text-xs font-mono text-stone-400 mb-1">گام اول</div>
            <div className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-2">
              اختلاط اولیه کود و قهوه
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              آماده‌سازی و استقرار <strong>{formulation.cowManureKg.toLocaleString('fa-IR')} کیلوگرم</strong> {formulation.productType === 'vermicompost' ? 'کود کمپوست سنتی فرآوری‌شده (پایه دامی و قهوه)' : 'کود گاوی پیش‌کمپوست‌شده'}{formulation.coffeeKg > 0 ? <> با <strong>{formulation.coffeeKg.toLocaleString('fa-IR')} کیلوگرم</strong> تفاله قهوه</> : null}.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
            <div className="text-xs font-mono text-stone-400 mb-1">گام دوم</div>
            <div className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-2">
              تزریق مکمل‌های معدنی
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              پاشش یکنواخت <strong>{formulation.calciumCarbonateKg.toLocaleString('fa-IR')} کیلوگرم</strong> پودر کربنات کلسیم و <strong>{formulation.zeoliteKg.toLocaleString('fa-IR')} کیلوگرم</strong> زئولیت شکری حین زیرورو کردن.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
            <div className="text-xs font-mono text-stone-400 mb-1">گام سوم</div>
            <div className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-2">
              فاز گرمادوست (دپوی ۱۵-۲۰ روز)
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              افزایش دمای توده به <strong>بالای ۵۵ درجه</strong> جهت تجزیه تانن و کافئین و نابودی کامل بذور علف هرز و نماتد با ۲ تا ۳ نوبت هوادهی.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
            <div className="text-xs font-mono text-stone-400 mb-1">گام چهارم</div>
            <div className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-2">
              تست زیستی ۲۴ ساعته
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              کاهش دما به <strong>زیر ۲۵ درجه</strong>، سنجش رایحه خاک جنگلی و سنجش ماندگاری ۱۰ کرم تست در ظرف به مدت ۲۴ ساعت.
            </p>
          </div>
        </div>
      </div>

      {/* Thermophilic Process Detail & Scientific Rationale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800 mb-4">
            <div className="flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-amber-700 dark:text-amber-400" />
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                پایش حرارتی فاز دپوی پیش‌تخمیر مسعود (Thermophilic Sanitization)
              </h2>
            </div>
            <span className="text-xs font-mono text-stone-400">حداقل زمان: ۱۵ الی ۲۰ روز</span>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              تفاله قهوه تازه حاوی مقادیر بالایی پلی‌فنول، تانن و کافئین آزاد است که در غلظت بالا برای کرم‌ها سمی است. دپوی اولیه و رسیدن دمای مرکزی توده به ۵۵ تا ۶۰ درجه سانتیگراد، کافئین را به اسیدهای آلی ساده‌تر می‌شکند و علف‌های هرز کود گاوی را می‌سوزاند.
            </p>

            {/* Visual Temperature Stages */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="text-[11px] text-stone-400">روز ۱ تا ۴ (مزوفیل)</div>
                <div className="text-base font-bold font-mono text-stone-800 dark:text-stone-200 mt-1">۳۰° الی ۴۵°C</div>
                <div className="text-[11px] text-stone-500 mt-1">شروع رشد باکتری‌ها با ملاس</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">روز ۵ تا ۱۲ (ترموفیل ۵۵°+)</div>
                <div className="text-base font-bold font-mono text-amber-800 dark:text-amber-300 mt-1">۵۵° الی ۶۲°C</div>
                <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">عقیم‌سازی نماتد و کافئین‌زدایی</div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">روز ۱۵ تا ۲۰ (خنک‌سازی)</div>
                <div className="text-base font-bold font-mono text-emerald-800 dark:text-emerald-300 mt-1">زیر ۲۵°C</div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">آماده تست زیستی کرم</div>
              </div>
            </div>

            {/* Pile Turner Note */}
            <div className="p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-lg border border-stone-200 dark:border-stone-800 flex items-start gap-3 text-xs text-stone-600 dark:text-stone-300">
              <Wind className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
              <span>
                <strong>برنامه زیرورو کردن توده:</strong> در روزهای ۵، ۱۰ و ۱۵ توده باید با چنگک یا لودر کوچک زیرورو شود تا هوادهی شده و بوی آمونیاک ناشی از تخمیر بی‌هوازی متصاعد نشود.
              </span>
            </div>
          </div>
        </div>

        {/* Pile Temperature Simulator / Check Probe */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 mb-3">
              <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">دماسنج میله‌ای دیجیتال توده</span>
              <span className="text-xs font-mono text-stone-400">سنسور عمق ۴۰cm</span>
            </div>
            
            <div className="py-4 text-center">
              <div className="text-4xl font-extrabold font-mono tabular-nums text-stone-900 dark:text-stone-100">
                {currentPileTemp}°C
              </div>
              <div className="mt-2 text-xs font-medium">
                {currentPileTemp > 30 ? (
                  <span className="text-rose-700 dark:text-rose-400 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    داغ است؛ نباید به کرم داده شود!
                  </span>
                ) : (
                  <span className="text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    دمای ایمن برای کرم‌ها (زیر ۲۵°C)
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-[11px] text-stone-500">تنظیم دمای نمونه‌برداری دماسنج:</label>
              <input
                type="range"
                min="18"
                max="65"
                value={currentPileTemp}
                onChange={(e) => setCurrentPileTemp(parseInt(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer h-2 bg-stone-200 dark:bg-stone-700 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                <span>۲۰°C (خنک)</span>
                <span>۴۰°C (مزوفیل)</span>
                <span>۶۰°C (ترموفیل)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 text-[11px] text-stone-500">
            * ملاک تایید گیت، افت دما به کمتر از ۲۵ درجه است.
          </div>
        </div>
      </div>

      {/* Critical Gate: Biological Delivery Release Gate (گیت تحویل به محمد) */}
      <div className={`border rounded-xl p-6 lg:p-8 transition-colors ${
        checklist.isApproved
          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
          : 'bg-white dark:bg-stone-900 border-amber-200 dark:border-amber-900/60'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-stone-200 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>گیت تضمین کیفیت و تحویل محموله به محمد (Quality Biological Release Gate)</span>
            </div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
              چک‌لیست تست زیستی و تاییدیه سلامت خوراک
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              پیش از خروج خوراک از ایستگاه مسعود و پخش روی بستر کرم‌های محمد، رعایت ۴ شرط زیر الزامی و ضامن عدم تلفات کرم است.
            </p>
          </div>

          <div>
            {checklist.isApproved ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-semibold">
                <Check className="w-4 h-4" />
                <span>مجوز تحویل صادر شده ({checklist.approvalDate})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-semibold">
                <Clock className="w-4 h-4" />
                <span>در انتظار تکمیل تست زیستی مسعود</span>
              </div>
            )}
          </div>
        </div>

        {/* 4 Essential Gate Checkboxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
          <div
            onClick={() => toggleCheck('tempBelow25')}
            className={`p-4 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
              checklist.tempBelow25
                ? 'bg-white dark:bg-stone-800 border-emerald-500 shadow-sm'
                : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700 hover:border-stone-400'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${
              checklist.tempBelow25 ? 'bg-emerald-700 text-white' : 'border border-stone-400'
            }`}>
              {checklist.tempBelow25 && <Check className="w-3.5 h-3.5" />}
            </div>
            <div>
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                ۱. دمای توده کاملاً افت کرده و زیر ۲۵ درجه است
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                سنجش با دماسنج میله‌ای در ۳ نقطه عمقی توده. هیچ گرمای موضعی حس نمی‌شود.
              </p>
            </div>
          </div>

          <div
            onClick={() => toggleCheck('odorClean')}
            className={`p-4 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
              checklist.odorClean
                ? 'bg-white dark:bg-stone-800 border-emerald-500 shadow-sm'
                : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700 hover:border-stone-400'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${
              checklist.odorClean ? 'bg-emerald-700 text-white' : 'border border-stone-400'
            }`}>
              {checklist.odorClean && <Check className="w-3.5 h-3.5" />}
            </div>
            <div>
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                ۲. بوی آمونیاک، کود ترشیده یا سرکه وجود ندارد
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                رایحه مطبوع خاک مرطوب باران‌خورده (پتریکور) و قهوه تخمیرشده ملایم احساس می‌شود.
              </p>
            </div>
          </div>

          <div
            onClick={() => toggleCheck('moistureTested')}
            className={`p-4 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
              checklist.moistureTested
                ? 'bg-white dark:bg-stone-800 border-emerald-500 shadow-sm'
                : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700 hover:border-stone-400'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${
              checklist.moistureTested ? 'bg-emerald-700 text-white' : 'border border-stone-400'
            }`}>
              {checklist.moistureTested && <Check className="w-3.5 h-3.5" />}
            </div>
            <div>
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                ۳. تست رطوبت با مشت انجام شد (۶۵٪ الی ۷۰٪)
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                وقتی یک مشت از مواد محکم فشرده می‌شود، آب شره نمی‌کند؛ فقط ۱ الی ۲ قطره از لای انگشتان می‌چکد.
              </p>
            </div>
          </div>

          <div
            onClick={() => toggleCheck('wormBioassay24h')}
            className={`p-4 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
              checklist.wormBioassay24h
                ? 'bg-white dark:bg-stone-800 border-emerald-500 shadow-sm'
                : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700 hover:border-stone-400'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${
              checklist.wormBioassay24h ? 'bg-emerald-700 text-white' : 'border border-stone-400'
            }`}>
              {checklist.wormBioassay24h && <Check className="w-3.5 h-3.5" />}
            </div>
            <div>
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                ۴. تست زیستی ۲۴ ساعته تایید شد (۱۰ کرم زنده و فعال)
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                ۱۰ کرم در ظرف نمونه قرار داده شد؛ پس از ۲۴ ساعت هیچ کرمی فرار نکرده و پوست آنها بدون سوختگی است.
              </p>
            </div>
          </div>
        </div>

        {/* Action button to sign and release to Mohammad */}
        <div className="mt-6 pt-6 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-stone-500">
            {allChecksPassed ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                همه معیارهای زیستی پاس شده‌اند. بار آماده انتقال به بستر کرم‌هاست.
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">
                * برای صدور مجوز خروج، تیک تمامی ۴ شرط الزامی است.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {!checklist.isApproved ? (
              <button
                disabled={!allChecksPassed}
                onClick={handleApproveGate}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:bg-stone-300 dark:disabled:bg-stone-800 disabled:text-stone-500 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-sm"
              >
                ثبت تاییدیه زیستی و صدور مجوز انتقال به محمد
              </button>
            ) : (
              <button
                onClick={onProceedToMohammad}
                className="w-full sm:w-auto px-6 py-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-lg text-xs font-bold hover:bg-stone-800 transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                <span>ورود به ایستگاه محمد (مدیریت بستر و تغذیه)</span>
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
