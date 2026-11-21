import React, { useState } from 'react';
import { resolveApiUrl } from '../utils/apiBase';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Lightbulb, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Cpu,
  Wifi,
  WifiOff,
  TreePine,
  Sprout,
  Calculator,
  ShoppingBag
} from 'lucide-react';
import { BatchConfig, FormulationResult } from '../types/vermicompost';
import { formatDeviceTime } from '../utils/deviceTime';
import { parseJsonResponseSafe } from '../utils/safeFetchJson';

interface AiAssistantProps {
  config: BatchConfig;
  formulation: FormulationResult;
}

interface QAPair {
  question: string;
  answer: string;
  category: 'orchard' | 'dosage' | 'products' | 'troubleshoot';
}

const OFFLINE_HORTICULTURE_KNOWLEDGE_BASE: QAPair[] = [
  {
    category: 'dosage',
    question: 'برای ۵۰۰ اصله درخت پسته چند کیلو ورمیکمپوست صفری نیاز دارم و چطور چالکود کنم؟',
    answer: `محاسبه تخصصی دوز و مقدار خرید برای ۵۰۰ اصله درخت پسته (کارگاه مهندس صفری):
۱. دوز استاندارد به ازای هر اصله بارده: ۵ تا ۷ کیلوگرم ورمیکمپوست درجه ۱ صفری + ۱ کیلوگرم زئولیت شکری اصلاح‌کننده شوری.
۲. کل مقدار خرید مورد نیاز: ۵۰۰ اصله × ۵.۵ کیلوگرم = ۲,۷۵۰ کیلوگرم (۲.۷۵ تن).
۳. تعداد کیسه‌های ۲۵ کیلویی کارگاه صفری: ۱۱۰ کیسه ۲۵ کیلویی لمینت.
۴. زمان و روش مصرف: دی و بهمن ماه به صورت چالکود در انتهای سایه‌انداز درخت در عمق ۳۰ تا ۴۰ سانتیمتری، مخلوط با خاک.
۵. توصیه تکمیلی: مصرف ۱۰ تا ۱۵ لیتر ورمی‌تی مایع صفری در مرحله ارزنی شدن و پر کردن مغز جهت جلوگیری از پسته پوک.`,
  },
  {
    category: 'dosage',
    question: 'برای ۲۰۰ اصله درخت گردوی بارده چقدر ورمیکمپوست صفری و چه زمانی باید مصرف شود؟',
    answer: `محاسبه تخصصی دوز و مقدار خرید برای ۲۰۰ اصله درخت گردو:
۱. دوز استاندارد هر درخت گردوی بالغ: ۷ تا ۸ کیلوگرم ورمیکمپوست درجه ۱ مهندس صفری.
۲. کل مقدار خرید مورد نیاز: ۲۰۰ اصله × ۷ کیلوگرم = ۱,۴۰۰ کیلوگرم (۱.۴ تن).
۳. تعداد کیسه‌های ۲۵ کیلویی کارگاه صفری: ۵۶ کیسه ۲۵ کیلویی.
۴. روش چالکود: حفر ۲ تا ۴ چاله به عمق ۴۰ سانتیمتر در محل سایه‌انداز تاج درخت (جایی که ریشه‌های موئین فعال قرار دارند).
۵. اثرات بارز: اسید هیومیک بالای ۶٪ و اسید فولویک ورمیکمپوست صفری موجب جذب بهتر فسفر و پتاسیم، پر شدن کامل مغز گردو و جلوگیری از سرمازدگی دیررس بهاره می‌گردد.`,
  },
  {
    category: 'dosage',
    question: 'برای ۳۰۰ اصله درخت مرکبات (پرتقال و لیمو) چقدر ورمیکمپوست نیاز است؟',
    answer: `محاسبه دقیق دوز مصرف برای ۳۰۰ اصله مرکبات:
۱. دوز پیشنهادی هر درخت: ۴ تا ۶ کیلوگرم ورمیکمپوست درجه ۱ صفری.
۲. کل مقدار خرید مورد نیاز: ۳۰۰ اصله × ۵ کیلوگرم = ۱,۵۰۰ کیلوگرم (۱.۵ تن).
۳. تعداد کیسه‌های ۲۵ کیلویی کارگاه: ۶۰ کیسه ۲۵ کیلویی.
۴. روش مصرف: در پاییز و اواخر بهمن ماه به صورت شیاری یا ۲ چاله در سایه‌انداز درخت با خاک مخلوط شود.
۵. رفع کلروز و زردی: ترکیب کربنات کلسیم بافرشده و زئولیت در کود صفری مانع از ریزش گل و زردی برگ مرکبات می‌شود.`,
  },
  {
    category: 'dosage',
    question: 'مقدار مصرف ورمیکمپوست و ورمی‌تی برای ۱۰۰۰ متر مربع گلخانه صیفی‌جات (گوجه و خیار) چقدر است؟',
    answer: `برنامه جامع تغذیه زیستی گلخانه (۱۰۰۰ متر مربع):
۱. فاز پایه قبل از کاشت نشاء: ۴ تا ۵ کیلوگرم ورمیکمپوست درجه ۱ صفری در هر متر مربع (مجموعاً ۴ تا ۵ تن معادل ۱۶۰ تا ۲۰۰ کیسه ۲۵ کیلویی). با عمق ۱۵ تا ۲۰ سانتیمتری خاک بستر شخم زده شود.
۲. فاز گلدهی و رشد بوته: مصرف عصاره مایع «ورمی‌تی صفری» به میزان ۱۵ تا ۲۰ لیتر در هر نوبت در سیستم آبیاری قطره‌ای هر ۲ هفته یک‌بار.
۳. مزایا: ریشه‌زایی فوق‌العاده، کنترل بیولوژیک قارچ‌های ریشه‌ای (پیتیم و فوزاریوم) و تأمین یکنواخت عناصر ماکرو و میکرو.`,
  },
  {
    category: 'products',
    question: 'فرمول کود کمپوست سنتی دامی و قهوه چطور در فرمول ورمی‌کمپوست استفاده می‌شود؟',
    answer: `هم‌افزایی فنی و بیولوژیک کود کمپوست و ورمی‌کمپوست در کارگاه مهندس صفری:
۱. در فاز اول (کود کمپوست سنتی): کود گاوی دامی (۷۰٪)، تفاله قهوه (۲۲٪)، زئولیت (۵٪) و پودر کلسیم (۳٪) دپو شده و وارد فاز حرارتی ترموفیل (۵۵ تا ۶۵ درجه سانتیگراد) می‌شوند. این مرحله تمام بذور علف هرز و پارازیت‌ها را از بین می‌برد و گاز آمونیاک تند دفع می‌شود.
۲. در فاز دوم (ورود به فارم ورمی): این کمپوست سنتی فرآوری‌شده پس از خنک شدن، به عنوان «بستر پیش‌کمپوست آماده (Pre-compost Feedstock)» در اختیار کرم‌های ایزینیا فوتیدا قرار می‌گیرد.
۳. نتیجه نهایی: کرم‌ها ماده آلی از قبل تجزیه‌شده را بدون تنش حرارتی گوارش کرده و کود غنی با ترشحات آنزیمی کلسیمی و اسید هیومیک بالای ۶٪ تولید می‌کنند.`,
  },
  {
    category: 'orchard',
    question: 'دستور مصرف ورمی‌تی مایع (Worm Tea) در باغات و مزارع چگونه است؟',
    answer: `دستورالعمل مصرف عصاره زیستی ورمی‌تی کارگاه صفری:
۱. محلول‌پاشی برگی در باغات: ۱۰ تا ۲۰ لیتر در ۱۰۰۰ لیتر آب در هر هکتار، ترجیحاً صبح زود یا غروب آفتاب.
۲. زمان‌های طلایی محلول‌پاشی:
   - بعد از ریزش گلبرگ‌ها (تشکیل میوه اولیه)
   - مرحله فندقی شدن میوه
   - یک ماه قبل از برداشت جهت بهبود رنگ، قند و ماندگاری انبارداری
۳. سیستم آبیاری قطره‌ای: ۲۰ تا ۳۰ لیتر در هکتار همراه با آب آبیاری جهت احیای جمعیت میکروبی مفید ریشه.`,
  },
];

// Helper: Convert Persian/Arabic digits to Latin digits
function toEnglishDigits(str: string): string {
  const pDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const aDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(pDigits[i], 'g'), i.toString());
    res = res.replace(new RegExp(aDigits[i], 'g'), i.toString());
  }
  return res;
}

// Expert Agronomic Engine: Dynamic calculation and crop-specific consultation
function computeExpertAgronomyResponse(
  rawQuery: string,
  config: BatchConfig,
  formulation: FormulationResult
): string {
  const qClean = toEnglishDigits(rawQuery).toLowerCase();
  
  // 1. Extract any tree count or area numbers
  const numberMatches = qClean.match(/\d+(\.\d+)?/g);
  let treeCount: number | null = null;
  let areaSqm: number | null = null;
  let hectares: number | null = null;

  if (numberMatches && numberMatches.length > 0) {
    const val = parseFloat(numberMatches[0]);
    if (qClean.includes('هکتار')) {
      hectares = val;
    } else if (qClean.includes('متر') || qClean.includes('متراژ')) {
      areaSqm = val;
    } else if (qClean.includes('درخت') || qClean.includes('اصله') || qClean.includes('بوته') || qClean.includes('نهال')) {
      treeCount = Math.round(val);
    } else if (val >= 10 && val <= 50000) {
      // General count inferred as trees or items
      treeCount = Math.round(val);
    }
  }

  // 2. Identify the specific crop or domain
  const isPistachio = qClean.includes('پسته');
  const isWalnut = qClean.includes('گردو');
  const isCitrus = qClean.includes('مرکبات') || qClean.includes('پرتقال') || qClean.includes('لیمو') || qClean.includes('نارنگی');
  const isApple = qClean.includes('سیب') || qClean.includes('گلابی') || qClean.includes('به');
  const isGrape = qClean.includes('انگور') || qClean.includes('مو') || qClean.includes('تاک');
  const isOlive = qClean.includes('زیتون');
  const isStoneFruit = qClean.includes('هلو') || qClean.includes('شلیل') || qClean.includes('زردآلو') || qClean.includes('گیلاس') || qClean.includes('آلبالو') || qClean.includes('بادام');
  const isGreenhouse = qClean.includes('گلخانه') || qClean.includes('گوجه') || qClean.includes('خیار') || qClean.includes('فلفل') || qClean.includes('توت فرنگی');
  const isHouseplant = qClean.includes('آپارتمان') || qClean.includes('گلدان') || qClean.includes('سانسوریا') || qClean.includes('زاموفیلیا');
  const isCompostSynergy = qClean.includes('کمپوست') && (qClean.includes('گاوی') || qClean.includes('دامی') || qClean.includes('قهوه') || qClean.includes('ورمی'));
  const isWormTea = qClean.includes('ورمی تی') || qClean.includes('ورمی‌تی') || qClean.includes('عصاره') || qClean.includes('مایع') || qClean.includes('محلول پاشی');
  const isPricing = qClean.includes('قیمت') || qClean.includes('خرید') || qClean.includes('فروش') || qClean.includes('هزینه');

  const unitPrice = config.sellingPricePerKg || 24000;

  // Case A: Compost synergy formula explanation
  if (isCompostSynergy) {
    return `تحلیل فرمولاسیون هم‌افزای کود کمپوست دامی و ورمیکمپوست (کارگاه مهندس صفری):
۱. اصل هماهنگی زیستی:
کود گاوی دامی تازه و تفاله قهوه به دلیل داشتن نیتروژن و فعالیت باکتریایی اولیه، در صورت مصرف مستقیم روی بستر کرم باعث بالا رفتن دما تا ۶۵ درجه شده و کرم‌ها را از بین می‌برند.
۲. فرآیند پخت دو مرحله‌ای کارگاه صفری:
• فاز اول (کود کمپوست سنتی): مخلوط کود گاوی (۷۰٪) + تفاله قهوه (۲۲٪) + زئولیت (۵٪) + کربنات کلسیم (۳٪) به مدت ۲۵ تا ۳۵ روز دپو و هوادهی می‌شود تا دمای ۵۵ تا ۶۵ درجه را تجربه کرده و کاملاً استریل، بی‌بو و پاستوریزه شود.
• فاز دوم (خوراک ورمیکمپوست): این کمپوست پخته شده، به عنوان خوراک پایه اصلی (Pre-compost Feedstock) وارد فارم کرم‌های ایزینیا فوتیدا می‌شود.
۳. نتیجه نهایی:
کرم‌ها بستر آماده را به کود همگن، سرشار از ترشحات غدد کلسیم، اسید هیومیک بالای ۶٪ و اسید فولویک تبدیل می‌کنند که برای حساس‌ترین کشت‌های صادراتی ایمن است.`;
  }

  // Case B: Worm Tea instructions
  if (isWormTea && !treeCount) {
    return `دستورالعمل تخصصی مصرف عصاره زیستی ورمی‌تی مهندس صفری:
۱. محلول‌پاشی برگی در باغات:
• دوز مصرف: ۱۰ تا ۲۰ لیتر در ۱۰۰۰ لیتر آب برای هر هکتار باغ (یا ۵۰ تا ۱۰۰ سی‌سی در ۱۰ لیتر آب جهت درختان تکی یا خانگی).
• زمان طلایی: پس از ریزش گلبرگ‌ها، زمان فندقی شدن میوه و یک نوبت قبل از برداشت.
۲. مصرف در سیستم آبیاری قطره‌ای:
• دوز مصرف: ۲۰ تا ۳۰ لیتر در هکتار در هر نوبت آبیاری جهت اصلاح میکروارگانیسم‌های ریزوسفر خاک و افزایش جذب فسفر و کلسیم.
۳. ویژگی برجسته:
ورمی‌تی صفری به روش هوادهی اکسیژنه (ACT) تولید شده و دارای هورمون‌های اکسین و سیتوکینین طبیعی برای تحریک رشد رویشی است.`;
  }

  // Case C: Walnut with tree count
  if (isWalnut && treeCount) {
    const dosePerTree = 7; // kg
    const totalKg = treeCount * dosePerTree;
    const totalTons = (totalKg / 1000).toFixed(2);
    const bags = Math.ceil(totalKg / 25);
    const totalCost = totalKg * unitPrice;

    return `برنامه تخصصی و برآورد خرید برای ${treeCount.toLocaleString('fa-IR')} اصله درخت گردو:
۱. دوز استاندارد هر درخت گردوی بالغ: ۷ تا ۸ کیلوگرم ورمیکمپوست درجه ۱ مهندس صفری + ۱ کیلوگرم زئولیت شکری.
۲. کل مقدار خرید مورد نیاز:
• مجموع وزن: ${totalKg.toLocaleString('fa-IR')} کیلوگرم (${parseFloat(totalTons).toLocaleString('fa-IR')} تن)
• تعداد کیسه‌های ۲۵ کیلویی کارگاه: ${bags.toLocaleString('fa-IR')} کیسه ۲۵ کیلویی لمینت
• برآورد هزینه خرید (نرخ ${unitPrice.toLocaleString('fa-IR')} ت/kg): حدوداً ${totalCost.toLocaleString('fa-IR')} تومان
۳. روش و زمان چالکود:
دی و بهمن ماه، حفر ۲ تا ۴ چاله به عمق ۴۰ تا ۵۰ سانتیمتر در انتهای سایه‌انداز تاج درخت (محل استقرار ریشه‌های تغذیه‌کننده فعال).
۴. اثر فیزیولوژیک در گردو:
اسید هیومیک و زئولیت صفری موجب جذب حداکثری فسفر، روی و پتاسیم شده، مغز گردو را کاملاً پر و سفید کرده و درخت را در برابر سرمای زودرس پاییزه و دیررس بهاره بیمه می‌کند.`;
  }

  // Case D: Pistachio with tree count
  if (isPistachio && treeCount) {
    const dosePerTree = 6; // kg
    const totalKg = treeCount * dosePerTree;
    const totalTons = (totalKg / 1000).toFixed(2);
    const bags = Math.ceil(totalKg / 25);
    const totalCost = totalKg * unitPrice;

    return `برنامه تخصصی و برآورد خرید برای ${treeCount.toLocaleString('fa-IR')} اصله درخت پسته:
۱. دوز استاندارد هر اصله پسته بارده: ۵ تا ۷ کیلوگرم ورمیکمپوست درجه ۱ صفری + ۱ کیلوگرم زئولیت اصلاحی.
۲. برآورد دقیق مقدار خرید:
• کل وزن کود مورد نیاز: ${totalKg.toLocaleString('fa-IR')} کیلوگرم (${parseFloat(totalTons).toLocaleString('fa-IR')} تن)
• تعداد کیسه‌های ۲۵ کیلویی کارگاه: ${bags.toLocaleString('fa-IR')} کیسه ۲۵ کیلویی
• هزینه کل سفارش: ${totalCost.toLocaleString('fa-IR')} تومان
۳. روش اجرای چالکود:
حفر دو کانال یا چاله در یک‌سوم بیرونی سایه‌انداز درخت، کود را با خاک زراعی مخلوط و چاله پر شود.
۴. نتایج اختصاصی در باغات پسته:
اصلاح EC آب و خاک کویری، جلوگیری از پوکی پسته، تقویت خنداندن طبیعی دانه و جلوگیری از سال‌آوری درختان.`;
  }

  // Case E: Citrus with tree count
  if (isCitrus && treeCount) {
    const dosePerTree = 5; // kg
    const totalKg = treeCount * dosePerTree;
    const bags = Math.ceil(totalKg / 25);
    const totalCost = totalKg * unitPrice;

    return `برنامه تغذیه و برآورد خرید برای ${treeCount.toLocaleString('fa-IR')} اصله درخت مرکبات (پرتقال / لیمو / نارنگی):
۱. دوز پیشنهادی به ازای هر درخت: ۵ کیلوگرم ورمیکمپوست درجه ۱ صادراتی مهندس صفری.
۲. برآورد مقدار خرید:
• کل وزن مورد نیاز: ${totalKg.toLocaleString('fa-IR')} کیلوگرم
• تعداد کیسه‌های ۲۵ کیلویی: ${bags.toLocaleString('fa-IR')} کیسه
• برآورد قیمت کل: ${totalCost.toLocaleString('fa-IR')} تومان
۳. زمان و نحوه مصرف:
اواخر زمستان (بهمن تا اسفند) قبل از گلدهی بهاره، در سایه‌انداز درخت مخلوط با خاک.
۴. مزیت برای مرکبات:
رفع کامل زردی برگ و کلروز آهن، پوست میوه شفاف‌تر، آبدار شدن گوشت میوه و مقاومت بالا به بیماری‌های قارچی طوقه (گموز).`;
  }

  // Case F: General tree count detected
  if (treeCount) {
    const cropName = isApple ? 'سیب و گلابی' : isGrape ? 'انگور' : isOlive ? 'زیتون' : isStoneFruit ? 'هلو و بادام' : 'باغ شما';
    const dose = isGrape ? 3 : 5.5;
    const totalKg = Math.round(treeCount * dose);
    const bags = Math.ceil(totalKg / 25);
    const totalCost = totalKg * unitPrice;

    return `برآورد تخصصی دوز و مقدار خرید برای ${treeCount.toLocaleString('fa-IR')} اصله درخت (${cropName}):
۱. دوز پیشنهادی هر اصله: ${dose} کیلوگرم ورمیکمپوست درجه ۱ مهندس صفری در چاله کود.
۲. محاسبه سرانگشتی خرید:
• کل وزن مورد نیاز: ${totalKg.toLocaleString('fa-IR')} کیلوگرم (${(totalKg / 1000).toFixed(2)} تن)
• تعداد کیسه‌های ۲۵ کیلویی کارگاه: ${bags.toLocaleString('fa-IR')} کیسه لمینت
• هزینه تخمینی خرید: ${totalCost.toLocaleString('fa-IR')} تومان
۳. نحوه مصرف:
در محل سایه‌انداز درخت ۲ چاله به عمق ۳۰ تا ۴۰ سانتیمتر حفر شود، کود با خاک مخلوط و آبیاری انجام گردد.
۴. توصیه مکمل:
یک نوبت محلول‌پاشی ورمی‌تی مایع صفری (۱۰ لیتر در ۱۰۰۰ لیتر آب) در مرحله فندقی شدن میوه جهت افزایش تناژ باردهی.`;
  }

  // Case G: Greenhouse area detected
  if (isGreenhouse || areaSqm) {
    const area = areaSqm || 1000;
    const dose = 4.5; // kg/sqm
    const totalKg = Math.round(area * dose);
    const bags = Math.ceil(totalKg / 25);

    return `برنامه تغذیه زیستی گلخانه صیفی‌جات (${area.toLocaleString('fa-IR')} متر مربع):
۱. فاز بسترپایه قبل از کاشت نشاء:
• دوز مصرف: ۴ تا ۵ کیلوگرم ورمیکمپوست درجه ۱ صفری در هر متر مربع.
• کل خرید مورد نیاز: ${totalKg.toLocaleString('fa-IR')} کیلوگرم (${(totalKg / 1000).toFixed(2)} تن معادل ${bags.toLocaleString('fa-IR')} کیسه ۲۵ کیلویی).
۲. در طول دوره رشد:
• محلول‌پاشی یا تزریق ورمی‌تی مایع صفری (۱۵ لیتر در هر ۱۰۰۰ متر هر دو هفته یک‌بار) جهت جلوگیری از پوسیدگی گلگاه و قارچ‌های طوقه.
۳. تضمین کیفیت: عاری از نماتد و بذر علف هرز بر اساس استاندارد ISIRI 13724.`;
  }

  // Case H: Houseplants
  if (isHouseplant) {
    return `دستور مصرف ورمیکمپوست و ورمی‌تی صفری برای گیاهان آپارتمانی:
۱. تعویض گلدان: مخلوط کردن ۱۵ تا ۲۰ درصد حجمی ورمیکمپوست صفری با خاک برگ یا پیت‌ماس.
۲. تغذیه گلدان‌های موجود: ۲ تا ۳ قاشق غذاخوری ورمیکمپوست را روی سطح خاک گلدان ریخته و با خاک سطحی به آرامی مخلوط کرده و آبیاری کنید.
۳. شادابی برگ‌ها: استفاده از ورمی‌تی رقیق‌شده (۱۰ سی‌سی در ۱ لیتر آب) به صورت اسپری برگی هر ۲ هفته یک‌بار جهت براق شدن برگ‌ها و رفع لکه‌های قهوه‌ای.`;
  }

  // Case I: Scoring knowledge base for generic inquiries
  let bestScore = 0;
  let bestItem: QAPair | null = null;
  const qWords = qClean.split(/[\s,،.؛;]+/).filter(w => w.length > 2);

  for (const item of OFFLINE_HORTICULTURE_KNOWLEDGE_BASE) {
    const itemWords = item.question.toLowerCase().split(/[\s,،.؛;]+/);
    let score = 0;
    for (const w of qWords) {
      if (itemWords.includes(w)) score += 2;
      else if (item.question.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  if (bestItem && bestScore >= 2) {
    return bestItem.answer;
  }

  // Fallback default
  return `مشاور ارشد باغبانی گروه زیست‌فناوری مهندس صفری:
درباره پرسش باغبانی و تغذیه گیاهی شما:
• باغات میوه (پسته، گردو، مرکبات، سیب، زیتون): دوز استاندارد ۵ تا ۷ کیلوگرم ورمیکمپوست درجه ۱ صفری به همراه ۱ کیلوگرم زئولیت در چاله کود زمستانه است.
• گلخانه‌ها و صیفی‌جات: ۴ تا ۵ کیلوگرم در هر متر مربع خاک بستر یا ۲۰٪ حجمی.
• محلول‌پاشی برگی: ۱۰ تا ۱۵ لیتر عصاره ورمی‌تی صفری در ۱۰۰۰ لیتر آب.

جهت محاسبه دقیق تعداد کیسه و تناژ خرید، لطفاً نوع محصول و تعداد درختان یا متراژ زمین خود را بفرمایید تا جدول خرید اختصاصی شما تهیه گردد.`;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ config, formulation }) => {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string }>>([
    {
      sender: 'ai',
      text: `درود بر شما باغدار و همراه گرامی!
من مشاور تخصصی خاک‌شناسی، باغبانی و تغذیه گیاهی «گروه تولیدی و زیست فناوری مهندس صفری» هستم.

در تمام زمینه‌ها آماده ارائه مشاوره فنی هستم:
• تغذیه و چالکود درختان میوه (پسته، گردو، مرکبات، سیب، زیتون، انگور، هلو و...)
• گلخانه‌های هیدروپونیک و خاکی، نشاء و گیاهان آپارتمانی
• محاسبه دقیق دوز، تعداد کیسه و تناژ خرید متناسب با تعداد درختان یا مساحت شما
• مشاوره تخصصی درباره تولیدات کارگاه مهندس صفری (ورمیکمپوست درجه ۱، ترموکود، ورمی‌تی و بستر تخصصی قهوه)

چه محصول یا گیاهی دارید؟ تعداد درختان یا متراژ زمین خود را بفرمایید تا دقیق‌ترین دستور مصرف و مقدار خرید را تقدیم کنم.`,
      time: 'اکنون',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAsk = async (questionText: string) => {
    const q = questionText.trim();
    if (!q) return;

    const timeStr = formatDeviceTime(new Date());

    setMessages(prev => [...prev, { sender: 'user', text: q, time: timeStr }]);
    setInputQuery('');
    setIsLoading(true);

    const workshopContext = {
      workshopName: 'گروه تولیدی و زیست فناوری مهندس صفری',
      productType: config.productType,
      currentBatchOutputKg: formulation.targetOutputKg,
      currentPricePerKg: config.sellingPricePerKg,
      currency: 'تومان',
      availableProducts: [
        'ورمیکمپوست درجه ۱ صادراتی و گلخانه‌ای (کیسه ۲۵ کیلویی لمینت)',
        'کود کمپوست سنتی غنی‌شده (ترموکود باغبانی)',
        'ورمی‌تی و عصاره مایع بیولوژیک (گالن‌های ۵، ۱۰ و ۲۰ لیتری)',
        'بستر تخصصی تفاله قهوه و زئولیت بافرشده'
      ]
    };

    if (navigator.onLine) {
      try {
        const res = await fetch(resolveApiUrl('/api/ai/ask'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, context: workshopContext }),
        });

        const parsed = await parseJsonResponseSafe<{ answer?: string; isFallback?: boolean }>(res);
        if (parsed.ok && parsed.data?.answer && !parsed.data?.isFallback) {
          setMessages(prev => [...prev, { sender: 'ai', text: parsed.data!.answer!, time: timeStr }]);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Online AI failed, falling back to offline knowledge base:', err);
      }
    }

    // Dynamic Offline Agronomic Consultation Engine (Ensures zero off-topic answers)
    const fallbackResponse = computeExpertAgronomyResponse(q, config, formulation);

    setMessages(prev => [...prev, { sender: 'ai', text: fallbackResponse, time: timeStr }]);
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 text-right">
      {/* Top Banner */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-1.5">
              <TreePine className="w-4 h-4" />
              <span>کلینیک تخصصی باغبانی، کودشناسی و تغذیه گیاهی</span>
            </div>
            <h1 className="text-xl lg:text-2xl font-extrabold text-stone-900 dark:text-stone-100">
              مشاور ارشد باغبانی و کودشناسی گروه زیست‌فناوری مهندس صفری
            </h1>
            <p className="text-xs text-stone-500 mt-1 max-w-2xl leading-relaxed">
              مشاوره تخصصی باغات میوه، گلخانه، زراعت، محاسبه دوز مصرف هر درخت و برآورد دقیق مقدار و تناژ خرید از تولیدات کارگاه صفری.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              isOnline 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'سامانه هوشمند آنلاین' : 'حالت آفلاین کلینیک باغبانی'}</span>
            </div>
          </div>
        </div>

        {/* Suggested Quick Inquiries */}
        <div className="pt-4">
          <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-2.5 font-medium">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>نمونه سوالات باغبانی و محاسبه مقدار خرید (کلیک کنید):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {OFFLINE_HORTICULTURE_KNOWLEDGE_BASE.map((qa, idx) => (
              <button
                key={idx}
                onClick={() => handleAsk(qa.question)}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-stone-700 dark:text-stone-300 hover:text-emerald-800 dark:hover:text-emerald-300 border border-stone-200 dark:border-stone-700 transition-colors text-right flex items-center gap-1.5"
              >
                <Sprout className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>{qa.question}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs flex flex-col min-h-[480px]">
        <div className="flex-1 p-5 lg:p-6 space-y-4 overflow-y-auto max-h-[580px]">
          {messages.map((msg, index) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={index}
                className={`flex gap-3 text-xs ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isUser 
                    ? 'bg-stone-800 text-white' 
                    : 'bg-emerald-800 text-white shadow-xs'
                }`}>
                  {isUser ? <HelpCircle className="w-4 h-4" /> : <TreePine className="w-4 h-4 text-emerald-300" />}
                </div>

                <div className={`max-w-2xl rounded-2xl p-4 leading-relaxed whitespace-pre-line text-right ${
                  isUser 
                    ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-tr-none' 
                    : 'bg-emerald-50/70 dark:bg-emerald-950/30 text-stone-900 dark:text-stone-100 border border-emerald-200/60 dark:border-emerald-900 rounded-tl-none font-sans'
                }`}>
                  <div className="text-[10px] text-stone-400 mb-1 flex items-center justify-between font-mono">
                    <span>{isUser ? 'پرسش شما' : 'مشاور ارشد باغبانی و کودشناسی مهندس صفری'}</span>
                    <span>{msg.time}</span>
                  </div>
                  <div className="text-stone-800 dark:text-stone-200">
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 text-xs items-center">
              <div className="w-8 h-8 rounded-lg bg-emerald-800 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-xl text-stone-500 font-mono text-[11px] flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>در حال بررسی خاک‌شناسی و محاسبه دوز مصرف متناسب با تولیدات کارگاه...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(inputQuery);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              dir="rtl"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="مثال: ۲۰۰ درخت گردوی ۱۰ ساله دارم، چقدر ورمیکمپوست یا ورمی‌تی نیاز است و چه زمانی مصرف کنم؟"
              className="flex-1 px-4 py-3 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 text-right focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
            <button
              type="submit"
              disabled={isLoading || !inputQuery.trim()}
              className="px-5 py-3 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shrink-0 shadow-sm"
            >
              <span>ارسال</span>
              <Send className="w-4 h-4 rotate-180" />
            </button>
          </form>
          <div className="flex items-center justify-between mt-2 text-[10px] text-stone-400">
            <span>توصیه‌های کودی و مقدار خرید به صورت علمی و بر اساس تولیدات کارگاه مهندس صفری تنظیم می‌شود.</span>
            <span className="font-mono">هوش مصنوعی Gemini 3.8 Flash فعال</span>
          </div>
        </div>
      </div>
    </div>
  );
};
