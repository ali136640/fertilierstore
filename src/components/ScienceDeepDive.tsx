import React from 'react';
import { 
  BookOpen, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  Layers, 
  Droplet, 
  FlaskRound as Flask,
  Zap
} from 'lucide-react';

export const ScienceDeepDive: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 lg:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-400 mb-2">
          <BookOpen className="w-4 h-4" />
          <span>مبانی بیوشیمی و فیزیولوژی کرم خاکی</span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-stone-900 dark:text-stone-50 tracking-tight">
          چرا تفاله قهوه و کود گاوی به تنهایی برای «درجه ۱ صادراتی» کافی نیستند؟
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-3xl">
          تفاله قهوه یکی از ارزشمندترین ضایعات آلی با نیتروژن بالا و رنگ سیاه دانه چای است، اما دو نقطه‌ضعف ساختاری مرگبار برای کرم خاکی دارد: **اسیدیته بالا ($pH$ حدود ۵ تا ۵.۵)** و **بافت بسیار ریز و فشرده که جلوی تنفس بستر را می‌گیرد**. با افزودن دو ماده معدنی ارزان (کربنات کلسیم و زئولیت شکری)، بستر به تعادل کامل می‌رسد.
        </p>
      </div>

      {/* 4 Pillars of Formulation Science */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Pillar 1: Coffee Grounds Double Edge */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-800 dark:text-amber-300 font-bold">
              ۰۱
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                تفاله قهوه: نیتروژن عالی در کنار اسیدیته و خفگی بافت
              </h2>
              <span className="text-[11px] text-stone-400">۲۸٪ از حجم کل خوراک خام</span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-300 text-[11px]">
              <strong>ریسک اسیدیته و فشردگی:</strong> تفاله قهوه $pH$ بین ۵ الی ۵.۵ دارد. پوست کرم از کوتیکول مرطوب تشکیل شده و اسید بالا سبب سوختگی شدید پوست، توقف تخم‌گذاری و خروج از بستر می‌شود. همچنین ذرات پودری آن در رطوبت به هم چسبیده و بستر را بی‌هوازی و لجن می‌کنند.
            </div>
            <p>
              <strong>مزیت صادراتی:</strong> تفاله قهوه رنگ توده را سیاه درخشان کرده، کربن آلی و اسید هیومیک را به بالای ۶٪ می‌رساند و نسبت $C:N$ بستر را غنی می‌کند؛ مشروط بر اینکه با کود گاوی خشبی و مواد معدنی تعدیل شود.
            </p>
          </div>
        </div>

        {/* Pillar 2: Calcium Carbonate Buffer */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-800 dark:text-emerald-300 font-bold">
              ۰۲
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                پودر کربنات کلسیم / دولومیت: بافر اسیدیته و دانه‌بندی چای
              </h2>
              <span className="text-[11px] text-stone-400">۲٪ از فرمول (۵۰ کیلوگرم در هر ۲۴۰۰ kg)</span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-300 text-[11px]">
              <strong>تحریک غدد مورن کرم خاکی:</strong> در بدن ایزینیا فوتیدا، غدد ترشحی کلسیم (Morren Glands) وجود دارند. با دریافت کلسیم، کرم یون‌های کلسیم را ترشح کرده که هوموس تفاله قهوه را به گرانول‌های مدفوعی پایدار به شکل «دانه چای کله‌مورچه‌ای» تبدیل می‌کند.
            </div>
            <p>
              <strong>تثبیت pH در محدوده ۶.۸ تا ۷.۴:</strong> کربنات کلسیم به عنوان بافر عمل کرده و مانع از ترشیدگی توده حین گوارش ۶۰ روزه می‌شود.
            </p>
          </div>
        </div>

        {/* Pillar 3: Zeolite (Sugar Mesh 1-3mm) */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-800 dark:text-blue-300 font-bold">
              ۰۳
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                زئولیت کشاورزی شکری (۱-۳ میلی‌متر): نجات‌بخش تخلخل و شوری
              </h2>
              <span className="text-[11px] text-stone-400">۳٪ از فرمول (۷۰ کیلوگرم در هر ۲۴۰۰ kg)</span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-300 text-[11px]">
              <strong>جذب آمونیاک و تعدیل شوری ($EC$):</strong> زئولیت کانی آلومینوسیلیکاتی با ظرفیت تبادل کاتیونی فوق‌العاده است. گاز آمونیاک سمی را به دام انداخته، شوری کود را زیر ۲.۵ dS/m نگه می‌دارد تا برای نشاءهای حساس گلخانه‌ای کاملاً بی‌خطر باشد.
            </div>
            <p>
              <strong>ایجاد منافذ تنفسی و نگهداری آب:</strong> دانه‌بندی شکری ۱ تا ۳ میلی‌متری زئولیت مانع چسبیدن تفاله‌های قهوه به هم شده و ظرفیت نگهداری آب محصول نهایی را تا ۲ برابر افزایش می‌دهد.
            </p>
          </div>
        </div>

        {/* Pillar 4: Molasses & Thermophilic Phase */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-800 dark:text-purple-300 font-bold">
              ۰۴
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                فاز دمایی ۵۵°+ و استارتر ملاس چغندرقند
              </h2>
              <span className="text-[11px] text-stone-400">تضمین صفر مطلق بذر علف و نماتد</span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 text-purple-900 dark:text-purple-300 text-[11px]">
              <strong>چرا عقیم‌سازی حرارتی ۵۵ درجه حیاتی است؟</strong> کرم‌های خاکی بذور علف‌های هرز سخت‌پوسته و کیست نماتد کود گاوی را نابود نمی‌کنند. فاز گرمادوست مسعود با رسیدن دما به بالای ۵۵ درجه در دپوی اولیه، تضمین می‌کند بار صادراتی ۱۰۰٪ استریل زیستی باشد.
            </div>
            <p>
              <strong>تحریک باکتری‌های همزیست با ملاس:</strong> کرم‌ها مستقیماً سلولز خام را نمی‌خورند، بلکه میکروارگانیسم‌های روی مواد را هضم می‌کنند. ملاس سرعت تولید توده باکتریایی مفید را ۱۰ برابر می‌کند.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
