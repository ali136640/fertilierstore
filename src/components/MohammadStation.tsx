import React, { useState } from 'react';
import { FormulationResult, FeedingCycleLog } from '../types/vermicompost';
import { 
  Layers, 
  Droplet, 
  Thermometer, 
  Eye, 
  Filter, 
  Sparkles, 
  Check, 
  AlertCircle,
  PackageCheck,
  RefreshCw
} from 'lucide-react';

interface MohammadStationProps {
  formulation: FormulationResult;
  batchCode: string;
  isMasoudApproved: boolean;
  cycles: FeedingCycleLog[];
  setCycles: React.Dispatch<React.SetStateAction<FeedingCycleLog[]>>;
  supervisorName?: string;
  onNavigateToCertificate: () => void;
  onNavigateToTroubleshoot: () => void;
}

export const MohammadStation: React.FC<MohammadStationProps> = ({
  formulation,
  batchCode,
  isMasoudApproved,
  cycles,
  setCycles,
  supervisorName = 'محمد',
  onNavigateToCertificate,
  onNavigateToTroubleshoot,
}) => {
  const [trappingStatus, setTrappingStatus] = useState<'idle' | 'water_cut' | 'net_placed' | 'harvested'>('idle');
  const [trammelMesh, setTrammelMesh] = useState<'2mm' | '3mm'>('2mm');

  const toggleCycleApplied = (cycleIndex: number) => {
    setCycles((prev) =>
      prev.map((c, i) => (i === cycleIndex ? { ...c, isApplied: !c.isApplied } : c))
    );
  };

  const toggleCycleTexture = (cycleIndex: number) => {
    setCycles((prev) =>
      prev.map((c, i) => (i === cycleIndex ? { ...c, textureChecked: !c.textureChecked } : c))
    );
  };

  const appliedCyclesCount = cycles.filter((c) => c.isApplied).length;
  const totalAppliedKg = appliedCyclesCount * formulation.feedPerCycleKg;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-400 mb-2">
              <Layers className="w-4 h-4" />
              <span>ایستگاه شماره ۲ کارگاه · سرپرست واحد: {supervisorName}</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-stone-900 dark:text-stone-50 tracking-tight">
              مدیریت بستر، تغذیه لایه‌ای، مه‌پاشی و جداسازی کرم (برداشت)
            </h1>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-3xl">
              مسئولیت {supervisorName}: استقرار {formulation.wormBiomassKg} کیلوگرم کرم خالص ایزینیا فوتیدا در {formulation.bedAreaM2} متر مربع بستر، اجرای تغذیه لایه‌ای ۵ تا ۷ سانتیمتری در ۶ نوبت، تنظیم رطوبت با مه‌پاش ظریف، تله‌گذاری توری و سرند ترامپل ۲ تا ۳ میلی‌متری.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!isMasoudApproved && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>تاییدیه زیستی مسعود هنوز ثبت نشده است</span>
              </div>
            )}
          </div>
        </div>

        {/* 5 Operating Rules Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
            <div className="text-[11px] text-stone-400 font-mono">دمای بستر</div>
            <div className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100 mt-1">۲۰° الی ۲۵°C</div>
            <div className="text-[11px] text-stone-500 mt-1">بالای ۳۰° کندی / بالای ۳۵° تلفات</div>
          </div>

          <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
            <div className="text-[11px] text-stone-400 font-mono">رطوبت فعال بستر</div>
            <div className="text-xl font-bold font-mono text-emerald-800 dark:text-emerald-400 mt-1">۶۵٪ الی ۷۰٪</div>
            <div className="text-[11px] text-stone-500 mt-1">فقط نازل مه‌پاش (بدون شلنگ تند)</div>
          </div>

          <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
            <div className="text-[11px] text-stone-400 font-mono">پوشش سطحی بستر</div>
            <div className="text-xl font-bold text-stone-900 dark:text-stone-100 mt-1">گونی کنفی مرطوب</div>
            <div className="text-[11px] text-stone-500 mt-1">تاریکی مطلق + تنفس هوایی آزاد</div>
          </div>

          <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
            <div className="text-[11px] text-stone-400 font-mono">تغذیه لایه‌ای</div>
            <div className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100 mt-1">۵ الی ۷ سانتی‌متر</div>
            <div className="text-[11px] text-stone-500 mt-1">هر ۱۰ الی ۱۲ روز یک لایه</div>
          </div>
        </div>
      </div>

      {/* Visual Facility Beds Spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden flex flex-col justify-between">
          <div className="p-6 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                چیدمان کارگاهی بسترهای سیمانی و سامانه مه‌پاش
              </h2>
              <span className="text-xs font-mono text-stone-400">مساحت فعال: {formulation.bedAreaM2} متر مربع</span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              کف بسترها دارای لایه زهکش است. پوشش‌های کنفی روی بستر، رطوبت را در محدوده ۷۰٪ حفظ کرده و نور محیطی را مسدود می‌کنند تا کرم‌ها در بالاترین لایه خوراک فعالیت کنند.
            </p>
          </div>
          <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-stone-900">
            <img
              src="/src/assets/images/vermicompost_facility_beds_1794139169866.jpg"
              alt="سالن بسترهای ورمیکمپوست کارگاه با مه‌پاش و گونی کنفی"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-5">
              <div className="text-white text-xs">
                <span className="font-semibold block text-sm">سالن تولید شماره ۱ · واحد محمد</span>
                <span className="text-stone-300 text-[11px]">بسترهای سیمانی با نازل‌های غبارساز مه‌پاش و پوشش گونی کنفی</span>
              </div>
            </div>
          </div>
        </div>

        {/* Worm Health & Biomass Card */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden flex flex-col">
          <div className="relative h-44 w-full bg-stone-900">
            <img
              src="/src/assets/images/eisenia_fetida_worms_1794139169680.jpg"
              alt="کرم‌های ایزینیا فوتیدا در حال فعالیت روی تفاله قهوه و کود"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
              <span className="text-white text-xs font-bold">ایزینیا فوتیدا (*Eisenia fetida*)</span>
            </div>
          </div>
          <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                جمعیت فعال بستر بچ: {formulation.wormBiomassKg} kg
              </div>
              <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                کرم قرمز کالیفرنیایی قادر است روزانه تا ۵۰٪ الی ۱۰۰٪ وزن بدن خود از تفاله قهوه و کود مصرف کرده و آن را به گرانول‌های مدفوعی سرشار از اسید هیومیک تبدیل کند.
              </p>
            </div>
            <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
              <span className="text-stone-500">غدد مورن (ترشح کلسیم):</span>
              <span className="font-mono text-emerald-800 dark:text-emerald-400 font-bold">فعال با CaCO3</span>
            </div>
          </div>
        </div>
      </div>

      {/* Layer Feeding Tracker (6 Rounds) */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-100 dark:border-stone-800">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              ثبت پیشرفت نوبت‌های تغذیه لایه‌ای (Layer Feeding Tracker)
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              کل حجم خوراک ({formulation.totalRawFeedKg.toLocaleString('fa-IR')} کیلوگرم) به ۶ مرحله تقسیم شده است. اعمال هر لایه منوط به تبدیل لایه قبلی به بافت تیره گرانوله مدفوع کرم است.
            </p>
          </div>
          <div className="text-left">
            <span className="text-xs font-mono text-stone-500">
              تغذیه انجام‌شده: {totalAppliedKg.toLocaleString('fa-IR')} از {formulation.totalRawFeedKg.toLocaleString('fa-IR')} kg ({appliedCyclesCount} از ۶)
            </span>
          </div>
        </div>

        <div className="space-y-3 pt-6">
          {cycles.map((cycle, index) => {
            return (
              <div
                key={cycle.cycleNumber}
                className={`p-4 rounded-lg border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  cycle.isApplied
                    ? 'bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 opacity-90'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                    cycle.isApplied
                      ? 'bg-emerald-800 text-white'
                      : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-400'
                  }`}>
                    ۰{cycle.cycleNumber}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      نوبت ۰{cycle.cycleNumber}: افزودن {cycle.feedKg.toLocaleString('fa-IR')} کیلوگرم خوراک آماده
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      زمان پیشنهادی: روز {cycle.targetDay} دوره · ضخامت لایه: {cycle.layerThicknessCm} سانتی‌متر
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Texture check toggle */}
                  <button
                    onClick={() => toggleCycleTexture(index)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                      cycle.textureChecked
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : 'border-stone-300 dark:border-stone-700 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>لایه قبلی گرانوله و هضم‌شده است</span>
                  </button>

                  {/* Apply toggle */}
                  <button
                    onClick={() => toggleCycleApplied(index)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      cycle.isApplied
                        ? 'bg-emerald-800 text-white'
                        : 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800'
                    }`}
                  >
                    {cycle.isApplied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>پخش شد</span>
                      </>
                    ) : (
                      <span>ثبت اجرای این نوبت</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Worm Trapping, Harvest & Trammel Sieving */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Worm Trapping Protocol */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6">
          <div className="flex items-center gap-2 pb-4 border-b border-stone-100 dark:border-stone-800 mb-4">
            <Filter className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              پروتکل جداسازی کرم (تله‌گذاری توری - Trapping Method)
            </h2>
          </div>

          <div className="space-y-3 text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            <p>
              پس از ۶۵ تا ۷۵ روز، تمام لایه‌ها به ورمیکمپوست تبدیل شده‌اند. برای تفکیک کرم‌ها بدون هیچ‌گونه آسیب فیزیکی:
            </p>

            <ol className="list-decimal list-inside space-y-2 text-stone-700 dark:text-stone-300 font-medium">
              <li>
                <strong>قطع آب:</strong> ۳ تا ۵ روز قبل از برداشت، آب‌پاشی را کاملاً قطع کنید تا لایه سطحی خشک شود.
              </li>
              <li>
                <strong>پهن کردن توری:</strong> یک توری پلاستیکی با چشمه نیم‌سانتیمتری روی تمام سطح بستر بیندازید.
              </li>
              <li>
                <strong>طعمه‌گذاری خوش‌خوراک:</strong> روی توری یک لایه ۵ سانتیمتری از تفاله قهوه شیرین‌شده با کمی ملاس بریزید.
              </li>
              <li>
                <strong>مهاجرت ۹۰٪ کرم‌ها:</strong> ظرف ۲۴ الی ۴۸ ساعت، کرم‌های گرسنه از توری عبور کرده و وارد طعمه می‌شوند. توری را با کرم‌ها بلند کرده و به بستر بعدی منتقل کنید.
              </li>
            </ol>

            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">وضعیت عملیات تله‌گذاری:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTrappingStatus('water_cut')}
                  className={`text-xs px-2.5 py-1 rounded transition-colors ${
                    trappingStatus === 'water_cut'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  قطع آب
                </button>
                <button
                  onClick={() => setTrappingStatus('net_placed')}
                  className={`text-xs px-2.5 py-1 rounded transition-colors ${
                    trappingStatus === 'net_placed'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  نصب توری
                </button>
                <button
                  onClick={() => setTrappingStatus('harvested')}
                  className={`text-xs px-2.5 py-1 rounded transition-colors ${
                    trappingStatus === 'harvested'
                      ? 'bg-emerald-800 text-white font-bold'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  کرم‌ها تفکیک شدند
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rotary Trammel Sieving & Product Separation */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  فرآوری، سرند دوار ترامپل و دانه‌بندی چای
                </h2>
              </div>
              <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-lg">
                <button
                  onClick={() => setTrammelMesh('2mm')}
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded ${
                    trammelMesh === '2mm'
                      ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                      : 'text-stone-500'
                  }`}
                >
                  مش ۲mm (اعلا)
                </button>
                <button
                  onClick={() => setTrammelMesh('3mm')}
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded ${
                    trammelMesh === '3mm'
                      ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                      : 'text-stone-500'
                  }`}
                >
                  مش ۳mm
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-300">
                  <span>خروجی زیرسرند (محصول درجه ۱ صادراتی):</span>
                  <span className="font-mono text-sm">{formulation.targetOutputKg.toLocaleString('fa-IR')} kg</span>
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-400 mt-1">
                  دانه‌بندی یکنواخت چای‌مانند، رطوبت ۳۲٪، غنی از اسید هیومیک، آماده بسته‌بندی در کیسه‌های لمینت‌دار ۵ الی ۲۵ کیلویی.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
                <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
                    سرند درشت (اورسایز عمل‌نیامده):
                  </span>
                  <span className="font-mono text-xs">حدود ۲۰۰ الی ۲۵۰ kg</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  ذرات الیاف کود گاوی و تفاله‌های هضم‌نشده؛ طبق پروتکل کارگاه بلافاصله به دپوی پیش‌کمپوست مسعود برای بچ بعدی بازگردانده می‌شود.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <button
              onClick={onNavigateToTroubleshoot}
              className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 underline"
            >
              راهنمای رفع گرفتگی سرند
            </button>
            <button
              onClick={onNavigateToCertificate}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <PackageCheck className="w-4 h-4" />
              <span>مشاهده و صدور شناسنامه کیفیت</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
