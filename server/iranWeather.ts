import type { Express, Request, Response } from 'express';

// Authoritative All-Iran Provinces (31 Provinces) & Comprehensive Cities/Counties Coordinates
const IRAN_PROVINCE_CAPITALS: Record<string, { lat: number; lon: number }> = {
  'تهران': { lat: 35.6892, lon: 51.3890 },
  'البرز': { lat: 35.8400, lon: 50.9391 },
  'اصفهان': { lat: 32.6546, lon: 51.6680 },
  'فارس': { lat: 29.5918, lon: 52.5837 },
  'کرمان': { lat: 30.2839, lon: 57.0834 },
  'خراسان رضوی': { lat: 36.2605, lon: 59.6168 },
  'مازندران': { lat: 36.5659, lon: 53.0586 },
  'گیلان': { lat: 37.2808, lon: 49.5832 },
  'خوزستان': { lat: 31.3183, lon: 48.6706 },
  'آذربایجان شرقی': { lat: 38.0962, lon: 46.2738 },
  'آذربایجان غربی': { lat: 37.5527, lon: 45.0761 },
  'همدان': { lat: 34.7989, lon: 48.5150 },
  'قزوین': { lat: 36.2797, lon: 50.0049 },
  'یزد': { lat: 31.8974, lon: 54.3569 },
  'قم': { lat: 34.6416, lon: 50.8746 },
  'مرکزی': { lat: 34.0954, lon: 49.7013 },
  'سمنان': { lat: 35.5769, lon: 53.3953 },
  'زنجان': { lat: 36.6736, lon: 48.4787 },
  'بوشهر': { lat: 28.9234, lon: 50.8203 },
  'هرمزگان': { lat: 27.1865, lon: 56.2808 },
  'کرمانشاه': { lat: 34.3142, lon: 47.0650 },
  'کردستان': { lat: 35.3219, lon: 46.9862 },
  'لرستان': { lat: 33.4878, lon: 48.3558 },
  'گلستان': { lat: 36.8427, lon: 54.4439 },
  'سیستان و بلوچستان': { lat: 29.4963, lon: 60.8629 },
  'اردبیل': { lat: 38.2498, lon: 48.2933 },
  'چهارمحال و بختیاری': { lat: 32.3256, lon: 50.8644 },
  'کهگیلویه و بویراحمد': { lat: 30.6682, lon: 51.5880 },
  'خراسان جنوبی': { lat: 32.8663, lon: 59.2211 },
  'خراسان شمالی': { lat: 37.4747, lon: 57.3290 },
  'ایلام': { lat: 33.6374, lon: 46.4227 },
};

const IRAN_CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  // تهران و البرز
  'تهران': { lat: 35.6892, lon: 51.3890 },
  'شهریار': { lat: 35.6598, lon: 51.0592 },
  'اسلامشهر': { lat: 35.5522, lon: 51.2350 },
  'ورامین': { lat: 35.3252, lon: 51.6472 },
  'پاکدشت': { lat: 35.4819, lon: 51.6819 },
  'رباط کریم': { lat: 35.4846, lon: 51.0829 },
  'پردیس': { lat: 35.7418, lon: 51.8124 },
  'دماوند': { lat: 35.7178, lon: 52.0650 },
  'فیروزکوه': { lat: 35.7566, lon: 52.7706 },
  'ملارد': { lat: 35.6659, lon: 50.9767 },
  'پیشوا': { lat: 35.3080, lon: 51.7267 },
  'قرچک': { lat: 35.4394, lon: 51.5689 },
  'بهارستان': { lat: 35.4900, lon: 51.1600 },
  'لواسان': { lat: 35.8180, lon: 51.6270 },
  'شمیرانات': { lat: 35.8050, lon: 51.4300 },
  'ری': { lat: 35.5935, lon: 51.4400 },
  'قدس': { lat: 35.7130, lon: 51.1090 },
  'کرج': { lat: 35.8400, lon: 50.9391 },
  'فردیس': { lat: 35.7240, lon: 50.9880 },
  'هشتگرد': { lat: 35.9619, lon: 50.6800 },
  'ساوجبلاغ': { lat: 35.9619, lon: 50.6800 },
  'نظرآباد': { lat: 35.9522, lon: 50.6069 },
  'طالقان': { lat: 36.1780, lon: 50.7660 },
  'اشتهارد': { lat: 35.7256, lon: 50.3661 },
  // اصفهان
  'اصفهان': { lat: 32.6546, lon: 51.6680 },
  'کاشان': { lat: 33.9850, lon: 51.4100 },
  'نجف‌آباد': { lat: 32.6344, lon: 51.3668 },
  'خمینی‌شهر': { lat: 32.6856, lon: 51.5211 },
  'شاهین‌شهر': { lat: 32.8579, lon: 51.5529 },
  'شهرضا': { lat: 32.0089, lon: 51.8669 },
  'زرین‌شهر': { lat: 32.3894, lon: 51.3766 },
  'لنجان': { lat: 32.3894, lon: 51.3766 },
  'فلاورجان': { lat: 32.5553, lon: 51.5097 },
  'مبارکه': { lat: 32.3465, lon: 51.5045 },
  'گلپایگان': { lat: 33.4537, lon: 50.2884 },
  'سمیرم': { lat: 31.4142, lon: 51.5697 },
  'نایین': { lat: 32.8601, lon: 53.0875 },
  'نطنز': { lat: 33.5110, lon: 51.9180 },
  'آران و بیدگل': { lat: 34.0578, lon: 51.4841 },
  'اردستان': { lat: 33.3761, lon: 52.3694 },
  'تیران': { lat: 32.7025, lon: 51.1539 },
  'خوانسار': { lat: 33.2206, lon: 50.3150 },
  'فریدونشهر': { lat: 32.9410, lon: 50.1210 },
  'دهاقان': { lat: 31.9400, lon: 51.6480 },
  // فارس
  'شیراز': { lat: 29.5918, lon: 52.5837 },
  'مرودشت': { lat: 29.8742, lon: 52.8025 },
  'جهرم': { lat: 28.5000, lon: 53.5605 },
  'فسا': { lat: 28.9383, lon: 53.6482 },
  'کازرون': { lat: 29.6195, lon: 51.6541 },
  'داراب': { lat: 28.7519, lon: 54.5444 },
  'لار': { lat: 27.6835, lon: 54.3413 },
  'لارستان': { lat: 27.6835, lon: 54.3413 },
  'آباده': { lat: 31.1608, lon: 52.6506 },
  'اقلید': { lat: 30.8926, lon: 52.6877 },
  'فیروزآباد': { lat: 28.8438, lon: 52.5707 },
  'نی‌ریز': { lat: 29.1986, lon: 54.3278 },
  'استهبان': { lat: 29.1265, lon: 54.0419 },
  'نورآباد': { lat: 30.1141, lon: 51.5217 },
  'ممسنی': { lat: 30.1141, lon: 51.5217 },
  'لامرد': { lat: 27.3339, lon: 53.1789 },
  'سپیدان': { lat: 30.2606, lon: 51.9840 },
  'زرقان': { lat: 29.7725, lon: 52.7190 },
  // کرمان
  'کرمان': { lat: 30.2839, lon: 57.0834 },
  'رفسنجان': { lat: 30.4067, lon: 55.9939 },
  'سیرجان': { lat: 29.4514, lon: 55.6809 },
  'جیرفت': { lat: 28.6781, lon: 57.7406 },
  'بم': { lat: 29.1060, lon: 58.3570 },
  'زرند': { lat: 30.8127, lon: 56.5640 },
  'شهربابک': { lat: 30.1165, lon: 55.1186 },
  'بافت': { lat: 29.2331, lon: 56.6022 },
  'کهنوج': { lat: 27.9519, lon: 57.7019 },
  'بردسیر': { lat: 29.9275, lon: 56.5722 },
  'راور': { lat: 31.2656, lon: 56.8056 },
  'عنبرآباد': { lat: 28.4744, lon: 57.8475 },
  'انار': { lat: 30.8733, lon: 55.2706 },
  // خراسان رضوی، جنوبی، شمالی
  'مشهد': { lat: 36.2605, lon: 59.6168 },
  'نیشابور': { lat: 36.2133, lon: 58.7958 },
  'سبزوار': { lat: 36.2126, lon: 57.6819 },
  'تربت حیدریه': { lat: 35.2740, lon: 59.2195 },
  'کاشمر': { lat: 35.2383, lon: 58.4656 },
  'قوچان': { lat: 37.1060, lon: 58.5095 },
  'تربت جام': { lat: 35.2440, lon: 60.6225 },
  'گناباد': { lat: 34.3529, lon: 58.6837 },
  'تایباد': { lat: 34.7400, lon: 60.7756 },
  'چناران': { lat: 36.6455, lon: 59.1212 },
  'درگز': { lat: 37.4445, lon: 59.1082 },
  'فریمان': { lat: 35.7069, lon: 59.8500 },
  'خواف': { lat: 34.5764, lon: 60.1408 },
  'سرخس': { lat: 36.5447, lon: 61.1578 },
  'بردسکن': { lat: 35.2578, lon: 57.9722 },
  'بیرجند': { lat: 32.8663, lon: 59.2211 },
  'قائن': { lat: 33.7265, lon: 59.1844 },
  'فردوس': { lat: 34.0186, lon: 58.1722 },
  'طبس': { lat: 33.5959, lon: 56.9244 },
  'نهبندان': { lat: 31.5419, lon: 60.0364 },
  'سرایان': { lat: 33.8606, lon: 58.5222 },
  'بجنورد': { lat: 37.4747, lon: 57.3290 },
  'شیروان': { lat: 37.3967, lon: 57.9295 },
  'اسفراین': { lat: 37.0765, lon: 57.5101 },
  'جاجرم': { lat: 36.9500, lon: 56.3800 },
  // مازندران، گیلان، گلستان
  'ساری': { lat: 36.5659, lon: 53.0586 },
  'بابل': { lat: 36.5513, lon: 52.6790 },
  'آمل': { lat: 36.4696, lon: 52.3507 },
  'قائم‌شهر': { lat: 36.4631, lon: 52.8601 },
  'بهشهر': { lat: 36.6923, lon: 53.5526 },
  'تنکابن': { lat: 36.8163, lon: 50.8738 },
  'چالوس': { lat: 36.6550, lon: 51.4204 },
  'رامسر': { lat: 36.9025, lon: 50.6582 },
  'نوشهر': { lat: 36.6490, lon: 51.4962 },
  'بابلسر': { lat: 36.7025, lon: 52.6576 },
  'محمودآباد': { lat: 36.6319, lon: 52.2629 },
  'نور': { lat: 36.5735, lon: 52.0138 },
  'نکا': { lat: 36.6508, lon: 53.2990 },
  'جویبار': { lat: 36.6410, lon: 52.9120 },
  'فریدونکنار': { lat: 36.6860, lon: 52.5225 },
  'رشت': { lat: 37.2808, lon: 49.5832 },
  'بندرانزلی': { lat: 37.4727, lon: 49.4622 },
  'لاهیجان': { lat: 37.2071, lon: 50.0034 },
  'لنگرود': { lat: 37.1970, lon: 50.1535 },
  'آستارا': { lat: 38.4291, lon: 48.8720 },
  'تالش': { lat: 37.8016, lon: 48.9065 },
  'فومن': { lat: 37.2240, lon: 49.3125 },
  'صومعه‌سرا': { lat: 37.3116, lon: 49.3219 },
  'آستانه اشرفیه': { lat: 37.2650, lon: 49.9444 },
  'رودسر': { lat: 37.1376, lon: 50.2880 },
  'رودبار': { lat: 36.8211, lon: 49.4264 },
  'گرگان': { lat: 36.8427, lon: 54.4439 },
  'گنبدکاووس': { lat: 37.2500, lon: 55.1672 },
  'علی‌آباد کتول': { lat: 36.9084, lon: 54.8689 },
  'بندرترکمن': { lat: 36.9012, lon: 54.0707 },
  'آزادشهر': { lat: 37.0870, lon: 55.1740 },
  'کردکوی': { lat: 36.7931, lon: 54.1122 },
  // خوزستان، بوشهر، هرمزگان
  'اهواز': { lat: 31.3183, lon: 48.6706 },
  'دزفول': { lat: 32.3811, lon: 48.4058 },
  'آبادان': { lat: 30.3392, lon: 48.3043 },
  'خرمشهر': { lat: 30.4397, lon: 48.1664 },
  'بندر ماهشهر': { lat: 30.5589, lon: 49.1981 },
  'ماهشهر': { lat: 30.5589, lon: 49.1981 },
  'بهبهان': { lat: 30.5959, lon: 50.2417 },
  'شوشتر': { lat: 32.0455, lon: 48.8567 },
  'اندیمشک': { lat: 32.4600, lon: 48.3594 },
  'ایذه': { lat: 31.8342, lon: 49.8672 },
  'شوش': { lat: 32.1942, lon: 48.2436 },
  'مسجدسلیمان': { lat: 31.9364, lon: 49.3039 },
  'شادگان': { lat: 30.6497, lon: 48.6647 },
  'بوشهر': { lat: 28.9234, lon: 50.8203 },
  'برازجان': { lat: 29.2666, lon: 51.2159 },
  'گناوه': { lat: 29.5791, lon: 50.5170 },
  'عسلویه': { lat: 27.4761, lon: 52.6075 },
  'کنگان': { lat: 27.8342, lon: 52.0628 },
  'خورموج': { lat: 28.6542, lon: 51.3800 },
  'بندرعباس': { lat: 27.1865, lon: 56.2808 },
  'میناب': { lat: 27.1310, lon: 57.0872 },
  'قشم': { lat: 26.9581, lon: 56.2719 },
  'کیش': { lat: 26.5578, lon: 53.9803 },
  'بندرلنگه': { lat: 26.5579, lon: 54.8807 },
  'حاجی‌آباد': { lat: 28.3091, lon: 55.9017 },
  'رودان': { lat: 27.4419, lon: 57.1920 },
  // شمال‌غرب و غرب
  'تبریز': { lat: 38.0962, lon: 46.2738 },
  'مراغه': { lat: 37.3921, lon: 46.2391 },
  'مرند': { lat: 38.4329, lon: 45.7749 },
  'میانه': { lat: 37.4210, lon: 47.7150 },
  'اهر': { lat: 38.4774, lon: 47.0699 },
  'بناب': { lat: 37.3404, lon: 46.0561 },
  'سراب': { lat: 37.9408, lon: 47.5367 },
  'شبستر': { lat: 38.1803, lon: 45.7028 },
  'جلفا': { lat: 38.9403, lon: 45.6308 },
  'ارومیه': { lat: 37.5527, lon: 45.0761 },
  'خوی': { lat: 38.5503, lon: 44.9521 },
  'میاندوآب': { lat: 36.9694, lon: 46.1027 },
  'مهاباد': { lat: 36.7631, lon: 45.7222 },
  'بوکان': { lat: 36.5210, lon: 46.2089 },
  'سلماس': { lat: 38.1973, lon: 44.7653 },
  'نقده': { lat: 36.9553, lon: 45.3880 },
  'ماکو': { lat: 39.2950, lon: 44.4981 },
  'اردبیل': { lat: 38.2498, lon: 48.2933 },
  'پارس‌آباد': { lat: 39.6482, lon: 47.9174 },
  'مشگین‌شهر': { lat: 38.3989, lon: 47.6820 },
  'خلخال': { lat: 37.6189, lon: 48.5258 },
  'گرمی': { lat: 39.0214, lon: 48.0711 },
  'زنجان': { lat: 36.6736, lon: 48.4787 },
  'ابهر': { lat: 36.1468, lon: 49.2180 },
  'خرمدره': { lat: 36.2031, lon: 49.1869 },
  'قیدار': { lat: 36.1153, lon: 48.5900 },
  'کرمانشاه': { lat: 34.3142, lon: 47.0650 },
  'اسلام‌آباد غرب': { lat: 34.1094, lon: 46.5275 },
  'کنگاور': { lat: 34.5044, lon: 47.9653 },
  'سرپل ذهاب': { lat: 34.4611, lon: 45.8647 },
  'سنقر': { lat: 34.7836, lon: 47.6003 },
  'سنندج': { lat: 35.3219, lon: 46.9862 },
  'سقز': { lat: 36.2499, lon: 46.2735 },
  'مریوان': { lat: 35.5194, lon: 46.1760 },
  'بانه': { lat: 35.9975, lon: 45.8853 },
  'قروه': { lat: 35.1664, lon: 47.8045 },
  'بیجار': { lat: 35.8668, lon: 47.6050 },
  // مرکز و جنوب‌شرق
  'همدان': { lat: 34.7989, lon: 48.5150 },
  'ملایر': { lat: 34.2969, lon: 48.8235 },
  'نهاوند': { lat: 34.1883, lon: 48.3769 },
  'تویسرکان': { lat: 34.5480, lon: 48.4470 },
  'کبودرآهنگ': { lat: 35.2083, lon: 48.7239 },
  'اسدآباد': { lat: 34.7822, lon: 48.1186 },
  'قزوین': { lat: 36.2797, lon: 50.0049 },
  'تاکستان': { lat: 36.0721, lon: 49.7013 },
  'بوئین‌زهرا': { lat: 35.7669, lon: 50.0578 },
  'آبیک': { lat: 36.0408, lon: 50.5319 },
  'یزد': { lat: 31.8974, lon: 54.3569 },
  'میبد': { lat: 32.2501, lon: 54.0166 },
  'اردکان': { lat: 32.3100, lon: 54.0175 },
  'بافق': { lat: 31.6035, lon: 55.4025 },
  'مهریز': { lat: 31.5917, lon: 54.4317 },
  'تفت': { lat: 31.7475, lon: 54.2042 },
  'ابرکوه': { lat: 31.1289, lon: 53.2822 },
  'قم': { lat: 34.6416, lon: 50.8746 },
  'اراک': { lat: 34.0954, lon: 49.7013 },
  'ساوه': { lat: 35.0213, lon: 50.3566 },
  'خمین': { lat: 33.6422, lon: 50.0789 },
  'محلات': { lat: 33.9056, lon: 50.4572 },
  'دلیجان': { lat: 33.9906, lon: 50.6836 },
  'شازند': { lat: 33.9275, lon: 49.4114 },
  'سمنان': { lat: 35.5769, lon: 53.3953 },
  'شاهرود': { lat: 36.4182, lon: 54.9763 },
  'دامغان': { lat: 36.1683, lon: 54.3480 },
  'گرمسار': { lat: 35.2182, lon: 52.3409 },
  'مهدی‌شهر': { lat: 35.7114, lon: 53.3564 },
  'خرم‌آباد': { lat: 33.4878, lon: 48.3558 },
  'بروجرد': { lat: 33.8973, lon: 48.7516 },
  'دورود': { lat: 33.4933, lon: 49.0750 },
  'کوهدشت': { lat: 33.5350, lon: 47.6061 },
  'الیگودرز': { lat: 33.4006, lon: 49.6949 },
  'ازنا': { lat: 33.4539, lon: 49.4556 },
  'زاهدان': { lat: 29.4963, lon: 60.8629 },
  'زابل': { lat: 31.0287, lon: 61.5012 },
  'چابهار': { lat: 25.2919, lon: 60.6430 },
  'ایرانشهر': { lat: 27.2024, lon: 60.6848 },
  'سراوان': { lat: 27.3708, lon: 62.3342 },
  'خاش': { lat: 28.2211, lon: 61.2158 },
  'شهرکرد': { lat: 32.3256, lon: 50.8644 },
  'بروجن': { lat: 31.9652, lon: 51.2873 },
  'لردگان': { lat: 31.5097, lon: 50.8294 },
  'فارسان': { lat: 32.2569, lon: 50.5642 },
  'یاسوج': { lat: 30.6682, lon: 51.5880 },
  'دوگنبدان': { lat: 30.3586, lon: 50.7981 },
  'گچساران': { lat: 30.3586, lon: 50.7981 },
  'دهدشت': { lat: 30.7939, lon: 50.5653 },
  'سی‌سخت': { lat: 30.8639, lon: 51.4558 },
  'ایلام': { lat: 33.6374, lon: 46.4227 },
  'دهلران': { lat: 32.6941, lon: 47.2679 },
  'ایوان': { lat: 33.8272, lon: 46.3097 },
  'آبدانان': { lat: 32.9928, lon: 47.4197 },
  'مهران': { lat: 33.1222, lon: 46.1647 },
};

const weatherDataCache = new Map<string, { payload: any; createdAt: number }>();
const geocodeCache = new Map<string, { coord: { lat: number; lon: number }; label: string; createdAt: number }>();

function normalizePersianText(raw: string): string {
  return String(raw || '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPlaceCandidates(raw: string): string[] {
  const normalized = normalizePersianText(raw);
  if (!normalized) return [];
  const candidates: string[] = [];
  const parenMatch = normalized.match(/\(([^)]+)\)/);
  const withoutParens = normalized.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (withoutParens) candidates.push(withoutParens);
  if (parenMatch && parenMatch[1]) {
    const inner = parenMatch[1].trim();
    if (inner && !candidates.includes(inner)) {
      candidates.push(inner);
    }
  }
  return candidates;
}

function normalizePersianPlaceName(raw: string): string {
  return extractPlaceCandidates(raw)[0] || '';
}

function approxDistanceSq(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = a.lat - b.lat;
  const dLon = a.lon - b.lon;
  return dLat * dLat + dLon * dLon;
}

function lookupCityInDictionary(rawCity: string): { lat: number; lon: number; label: string } | null {
  const candidates = extractPlaceCandidates(rawCity);
  for (const cleanCity of candidates) {
    if (IRAN_CITY_COORDS[cleanCity]) {
      return { ...IRAN_CITY_COORDS[cleanCity], label: cleanCity };
    }
    const cityKeys = Object.keys(IRAN_CITY_COORDS);
    const partial = cityKeys.find((k) => cleanCity === k || cleanCity.includes(k) || k.includes(cleanCity));
    if (partial) {
      return { ...IRAN_CITY_COORDS[partial], label: cleanCity };
    }
  }
  return null;
}

function lookupProvinceCapital(rawProvince: string): { lat: number; lon: number; label: string } | null {
  const candidates = extractPlaceCandidates(rawProvince);
  for (const cleanProv of candidates) {
    if (IRAN_PROVINCE_CAPITALS[cleanProv]) {
      return { ...IRAN_PROVINCE_CAPITALS[cleanProv], label: cleanProv };
    }
    const provKeys = Object.keys(IRAN_PROVINCE_CAPITALS);
    const partial = provKeys.find((k) => cleanProv === k || cleanProv.includes(k) || k.includes(cleanProv));
    if (partial) {
      return { ...IRAN_PROVINCE_CAPITALS[partial], label: cleanProv };
    }
  }
  return null;
}

async function resolveIranLocation(
  rawProvince: string,
  rawCity: string
): Promise<{ lat: number; lon: number; cityLabel: string; provinceLabel: string }> {
  const cleanProvince = normalizePersianPlaceName(rawProvince) || 'تهران';
  const cityCandidates = extractPlaceCandidates(rawCity);
  const cleanCity = cityCandidates[0] || normalizePersianPlaceName(rawCity) || cleanProvince;
  const cacheKey = `${cleanProvince}::${cleanCity}`;

  const cachedGeo = geocodeCache.get(cacheKey);
  if (cachedGeo && Date.now() - cachedGeo.createdAt < 1000 * 60 * 60 * 24) {
    return {
      lat: cachedGeo.coord.lat,
      lon: cachedGeo.coord.lon,
      cityLabel: cachedGeo.label,
      provinceLabel: cleanProvince,
    };
  }

  // 1. Direct curated Iranian cities table
  const cityDictHit = lookupCityInDictionary(rawCity);
  if (cityDictHit) {
    geocodeCache.set(cacheKey, {
      coord: { lat: cityDictHit.lat, lon: cityDictHit.lon },
      label: cityDictHit.label,
      createdAt: Date.now(),
    });
    return {
      lat: cityDictHit.lat,
      lon: cityDictHit.lon,
      cityLabel: cityDictHit.label,
      provinceLabel: cleanProvince,
    };
  }

  const provAnchor = lookupProvinceCapital(rawProvince);

  // 2. Open-Meteo Geocoding filtered strictly for country_code === 'IR'
  const queries = Array.from(
    new Set(
      [
        ...cityCandidates,
        ...cityCandidates.map((c) => `${c} ${cleanProvince}`),
        cleanCity,
      ].filter((q) => q && q.length >= 2)
    )
  );

  for (const q of queries) {
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        q
      )}&count=8&language=fa&format=json`;
      const geoResp = await fetch(geoUrl, { signal: AbortSignal.timeout(4500) });
      if (geoResp.ok) {
        const geoJson: any = await geoResp.json();
        const irResults: any[] = (Array.isArray(geoJson?.results) ? geoJson.results : []).filter(
          (r: any) => String(r?.country_code || '').toUpperCase() === 'IR'
        );
        if (irResults.length > 0) {
          let chosen = irResults[0];
          if (provAnchor) {
            chosen = [...irResults].sort(
              (a, b) =>
                approxDistanceSq({ lat: a.latitude, lon: a.longitude }, provAnchor) -
                approxDistanceSq({ lat: b.latitude, lon: b.longitude }, provAnchor)
            )[0];
          }
          if (typeof chosen?.latitude === 'number' && typeof chosen?.longitude === 'number') {
            const label = cleanCity || chosen.name || cleanProvince;
            geocodeCache.set(cacheKey, {
              coord: { lat: chosen.latitude, lon: chosen.longitude },
              label,
              createdAt: Date.now(),
            });
            return {
              lat: chosen.latitude,
              lon: chosen.longitude,
              cityLabel: label,
              provinceLabel: cleanProvince,
            };
          }
        }
      }
    } catch {
      // continue to OSM Nominatim
    }
  }

  // 3. OpenStreetMap Nominatim Geocoding strictly scoped to Iran (countrycodes=ir)
  try {
    const osmQuery = cleanProvince && cleanCity !== cleanProvince ? `${cleanCity}, ${cleanProvince}, Iran` : `${cleanCity}, Iran`;
    const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      osmQuery
    )}&countrycodes=ir&format=json&limit=3&accept-language=fa`;
    const osmResp = await fetch(osmUrl, {
      headers: {
        'User-Agent': 'SafariBiotechAgronomy/2.5 (contact@safaribiotech.ir)',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (osmResp.ok) {
      const osmRows: any[] = await osmResp.json();
      if (Array.isArray(osmRows) && osmRows.length > 0) {
        const lat = Number(osmRows[0].lat);
        const lon = Number(osmRows[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          geocodeCache.set(cacheKey, { coord: { lat, lon }, label: cleanCity, createdAt: Date.now() });
          return { lat, lon, cityLabel: cleanCity, provinceLabel: cleanProvince };
        }
      }
    }
  } catch {
    // fall back to selected province capital
  }

  // 4. Selected Province Capital (never fall back silently to Tehran if province is known)
  if (provAnchor) {
    return {
      lat: provAnchor.lat,
      lon: provAnchor.lon,
      cityLabel: cleanCity || provAnchor.label,
      provinceLabel: cleanProvince,
    };
  }

  return {
    lat: 35.6892,
    lon: 51.3890,
    cityLabel: cleanCity || 'تهران',
    provinceLabel: cleanProvince || 'تهران',
  };
}

function describeWmoWeatherCodeFa(code: number, isDay = true): {
  label: string;
  conditionKey: 'clear' | 'partly_cloudy' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow';
} {
  if (code === 0) return { label: isDay ? 'آفتابی و صاف' : 'شب صاف و پرستاره', conditionKey: 'clear' };
  if (code === 1 || code === 2) return { label: isDay ? 'کمی تا قسمتی ابری' : 'شب نیمه‌ابری', conditionKey: 'partly_cloudy' };
  if (code === 3) return { label: 'تمام ابری', conditionKey: 'cloudy' };
  if (code === 45 || code === 48) return { label: 'مه‌آلود / غبار صبحگاهی', conditionKey: 'fog' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: code >= 63 || code >= 81 ? 'بارش باران قابل توجه' : 'بارش پراکنده / نم‌نم باران', conditionKey: 'rain' };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { label: 'بارش برف و هوای سرد', conditionKey: 'snow' };
  }
  if ([95, 96, 99].includes(code)) {
    return { label: 'رعدوبرق و رگبار تند', conditionKey: 'storm' };
  }
  return { label: 'معتدل و نیمه‌ابری', conditionKey: 'partly_cloudy' };
}

function mapMetNoSymbolToWmo(symbolCode: string): number {
  const s = String(symbolCode || '').toLowerCase();
  if (s.includes('thunder')) return 95;
  if (s.includes('snow') || s.includes('sleet')) return 73;
  if (s.includes('heavyrain')) return 65;
  if (s.includes('rain') || s.includes('drizzle')) return 61;
  if (s.includes('fog')) return 45;
  if (s.includes('cloudy')) return 3;
  if (s.includes('partlycloudy') || s.includes('fair')) return 2;
  if (s.includes('clearsky')) return 0;
  return 2;
}

function buildAgronomicWeatherAdvisories(params: {
  city: string;
  temp: number;
  humidity: number;
  windSpeed: number;
  rainProb: number;
  precipSumToday: number;
  minTempToday: number;
  maxTempToday: number;
  soilTemp?: number | null;
  soilMoisturePct?: number | null;
  et0?: number | null;
  uvMax?: number | null;
}) {
  const advisories: Array<{
    id: string;
    title: string;
    detail: string;
    severity: 'optimal' | 'caution' | 'alert';
    category: 'spraying' | 'irrigation' | 'soil' | 'frost_heat' | 'pest_disease' | 'gardening';
  }> = [];

  const uvVal = typeof params.uvMax === 'number' ? params.uvMax : 5;
  const et0Val = typeof params.et0 === 'number' ? params.et0 : 3.5;
  const soilTempVal = typeof params.soilTemp === 'number' ? params.soilTemp : params.temp;

  if (params.windSpeed > 15 || params.rainProb >= 45 || params.precipSumToday >= 1.5) {
    advisories.push({
      id: 'spray_wait',
      title: 'نکات سمپاشی و محلول‌پاشی: توقف برگ‌پاشی امروز',
      detail:
        params.windSpeed > 15
          ? `سرعت باد (${Math.round(params.windSpeed)} کیلومتر/ساعت) بالاست و باعث بادبردگی سموم و کودهای برگی می‌شود. از سمپاشی پرهیز کنید و در صورت نیاز تغذیه، ورمی‌تی رقیق را فقط پای ریشه (کودآبیاری) بدهید.`
          : `احتمال بارندگی (${Math.round(params.rainProb)}٪) بالاست؛ سمپاشی قارچ‌کش، حشره‌کش یا محلول‌پاشی برگی را به ۶ تا ۲۴ ساعت هوای بدون باران موکول کنید و حتماً در سمپاشی‌های بعدی از مویان یا صابون کشاورزی استفاده نمایید.`,
      severity: 'caution',
      category: 'spraying',
    });
  } else if (params.maxTempToday >= 30 || uvVal >= 7 || params.humidity < 30) {
    advisories.push({
      id: 'spray_early_only',
      title: 'سمپاشی و محلول‌پاشی صرفاً در ساعات خنک (۵ تا ۸:۳۰ صبح)',
      detail: `در ${params.city} به دلیل گرمای میانه روز (${Math.round(params.maxTempToday)} درجه) یا اشعه UV بالا و تبخیر سریع، هرگز بین ۱۰ تا ۱۷ سمپاشی و روغن‌پاشی انجام ندهید (خطر گیاه‌سوزی). بهترین زمان سمپاشی و محلول‌پاشی ورمی‌تی، سپیده‌دم یا پس از غروب و همراه با تنظیم pH آب است.`,
      severity: 'caution',
      category: 'spraying',
    });
  } else {
    advisories.push({
      id: 'spray_good',
      title: 'پنجره طلایی سمپاشی و محلول‌پاشی برگی',
      detail: `باد آرام (${Math.round(params.windSpeed)} km/h)، رطوبت متعادل (${Math.round(params.humidity)}٪) و نبود بارش شدید، بهترین شرایط در ${params.city} برای سمپاشی کنترل‌شده و برگ‌پاشی ورمی‌تی در صبح زود یا عصر است. از تمیز بودن نازل، فشار یکنواخت پمپ و پوشش زیر و روی برگ‌ها اطمینان حاصل کنید.`,
      severity: 'optimal',
      category: 'spraying',
    });
  }

  if (params.minTempToday <= 2) {
    advisories.push({
      id: 'frost_alert',
      title: 'هشدار افت دما، سرمازدگی شبانه و حفاظت باغ',
      detail: `کمینه دما به ${Math.round(params.minTempToday)} درجه می‌رسد. از آبیاری سنگین نیمه‌شب پرهیز کنید؛ مالچ‌پاشی ۳ تا ۵ سانتی‌متری ورمیکمپوست پای طوقه، استفاده از هیتر/بخاری باغی یا دوددهی در باغات حساس و انتقال گلدان‌های آپارتمانی از بالکن به فضای سرپوشیده ضروری است.`,
      severity: 'alert',
      category: 'frost_heat',
    });
  } else if (params.maxTempToday >= 33) {
    advisories.push({
      id: 'heat_caution',
      title: 'مدیریت تنش گرمایی، آفتاب‌سوختگی و تبخیر بالا',
      detail: `بیشینه دما تا ${Math.round(params.maxTempToday)} درجه بالا می‌رود. از توری سایبان (شید ۵۰٪) در نهالستان و گلخانه استفاده کنید؛ افزودن ورمیکمپوست و زئولیت شکری به پای ریشه، نگهداری رطوبت خاک را افزایش داده و تنش گرمایی درختان را کاهش می‌دهد.`,
      severity: 'caution',
      category: 'frost_heat',
    });
  } else {
    advisories.push({
      id: 'temp_optimal',
      title: 'دمای متعادل برای فتوسنتز و جذب ریشه',
      detail: `بازه دمایی ${Math.round(params.minTempToday)} تا ${Math.round(params.maxTempToday)} درجه سانتی‌گراد شرایط ایده‌آلی برای فعالیت ریشه‌های مویین، تلقیح شکوفه‌ها، تکثیر میکروارگانیسم‌های مفید خاک و کارایی بالای کودهای آلی است.`,
      severity: 'optimal',
      category: 'frost_heat',
    });
  }

  if (params.rainProb >= 60 || params.precipSumToday >= 3) {
    advisories.push({
      id: 'rain_irrigation',
      title: 'تنظیم آبیاری هم‌زمان با بارندگی طبیعی',
      detail: `با احتمال بارش ${Math.round(params.rainProb)}٪، دور آبیاری باغ و مزرعه را متوقف یا به تعویق بیندازید تا ریشه‌ها دچار خفگی و پوسیدگی نشوند. زهکش پای درختان و گلدان‌های فضای باز را پیش از بارندگی بررسی و باز کنید.`,
      severity: 'optimal',
      category: 'irrigation',
    });
  } else {
    advisories.push({
      id: 'et0_irrigation',
      title: `برنامه آبیاری دقیق (تبخیر ${et0Val.toFixed(1)} میلی‌متر)`,
      detail: `میزان تبخیر و تعرق امروز ${et0Val.toFixed(1)} میلی‌متر و رطوبت هوا ${Math.round(params.humidity)}٪ است. آبیاری را منحصراً سحرگاه یا غروب انجام دهید؛ پرهیز از آبیاری ظهرگاهی مانع هدررفت ۴۰٪ آب و جلوگیری از شوک حرارتی ریشه می‌شود.`,
      severity: et0Val >= 5.5 ? 'caution' : 'optimal',
      category: 'irrigation',
    });
  }

  advisories.push({
    id: 'soil_nutrition',
    title: `مدیریت خاک و کوددهی آلی (دمای خاک ${Math.round(soilTempVal)}°)`,
    detail:
      soilTempVal < 12
        ? `دمای سطح خاک حدود ${Math.round(soilTempVal)} درجه${typeof params.soilMoisturePct === 'number' ? ` و رطوبت خاک ${Math.round(params.soilMoisturePct)}٪` : ''} است. اکنون بهترین زمان جایگذاری چالکود با ورمیکمپوست و کمپوست غنی‌شده در عمق ۲۰ تا ۴۰ سانتی‌متری سایه‌انداز درخت است تا با گرم شدن خاک، جذب سریع آغاز شود.`
        : `دمای فعال خاک (${Math.round(soilTempVal)} درجه)${typeof params.soilMoisturePct === 'number' ? ` و رطوبت ${Math.round(params.soilMoisturePct)}٪` : ''} شرایط عالی برای فعالیت باکتری‌های حل‌کننده فسفات و نیتروژن ورمیکمپوست است. بلافاصله پس از پخش سطحی ورمیکمپوست و زئولیت، آبیاری سبک انجام دهید.`,
    severity: 'optimal',
    category: 'soil',
  });

  if (params.humidity >= 68 || params.rainProb >= 45) {
    advisories.push({
      id: 'pest_humid',
      title: 'پیشگیری از بیماری‌های قارچی و سفیدک (رطوبت بالا)',
      detail: `رطوبت بالای هوا (${Math.round(params.humidity)}٪) خطر سفیدک پودری، لکه‌برگی، بوتریتیس و پوسیدگی طوقه را بالا می‌برد. از آبیاری بارانی شبانه خودداری کنید، تهویه گلخانه را افزایش دهید، شاخه‌های متراکم را برای گردش هوا خلوت کنید و در صورت لزوم پیشگیری قارچ‌کش مس‌دار یا گوگردی طبق دستور گیاه‌پزشک انجام دهید.`,
      severity: 'alert',
      category: 'pest_disease',
    });
  } else if (params.humidity <= 35 && params.temp >= 26) {
    advisories.push({
      id: 'pest_dry_mite',
      title: 'پایش آفات مکنده (کنه تار عنکبوتی و تریپس) در هوای خشک',
      detail: `ترکیب رطوبت پایین (${Math.round(params.humidity)}٪) و گرما محیط مستعد طغیان کنه تارعنکبوتی، شته و تریپس است. پشت برگ‌ها را بررسی کنید؛ شست‌وشوی ملایم شاخ‌وبرگ در صبح زود و تقویت مقاومت گیاه با عصاره ورمی‌تی تکثیر آفات را به شدت محدود می‌کند.`,
      severity: 'caution',
      category: 'pest_disease',
    });
  } else {
    advisories.push({
      id: 'pest_balanced',
      title: 'پایش بهداشت باغ، علف‌های هرز و تله‌های زرد',
      detail: `رطوبت متعادل امروز فشار بیماری‌های قارچی را کاهش می‌دهد؛ با این حال حاشیه باغ را از علف‌های هرز میزبان آفات پاکسازی کنید، کارت‌های زرد و آبی چسبنده را در گلخانه بازدید نمایید و پیش از بروز آفت تغذیه متوازن را حفظ کنید.`,
      severity: 'optimal',
      category: 'pest_disease',
    });
  }

  advisories.push({
    id: 'spraying_general_protocol',
    title: 'اصول کامل و استاندارد سمپاشی عمومی و محلول‌پاشی (چک‌لیست میدانی)',
    detail: `۱) کیفیت آب و pH: آب سمپاش را قبل از مخلوط‌کردن سم با بافر یا سرکه/اسیدسیتریک به pH حدود ۵.۵ تا ۶.۵ برسانید و از افزودن مویان برای جذب بهتر استفاده کنید. ۲) دمای ایده‌آل سمپاشی ۱۴ تا ۲۶ درجه و باد زیر ۱۵ کیلومتر بر ساعت است. ۳) در زمان گل‌دهی برای حفظ زنبور عسل، سمپاشی را فقط پس از غروب و پایان پرواز زنبورها انجام دهید و دوره کارنس را رعایت کنید.`,
    severity: 'optimal',
    category: 'spraying',
  });

  advisories.push({
    id: 'gardening_checklist',
    title: 'توصیه‌های کاربردی هرس، پیوند، خاک‌ورزی و گیاهان آپارتمانی',
    detail:
      params.rainProb >= 40
        ? `به دلیل احتمال بارندگی، از هرس شاخه‌های ضخیم خودداری کنید یا بلافاصله پس از برش روی زخم‌ها چسب باغبانی و قارچ‌کش مس‌دار بزنید تا بیماری وارد بافت چوب نشود. آب زیرگلدانی گیاهان آپارتمانی را تخلیه کرده و تا خشک شدن لایه ۳ سانتی‌متری سطح خاک آبیاری نکنید.`
        : `هوای پایدار ${params.city} برای حذف پاجوش‌ها، تنک شاخه‌های خشک، کوددهی سطحی پای ریشه و تعویض خاک گلدان با ترکیب ۷۰٪ خاک سبک + ۲۰٪ ورمیکمپوست + ۱۰٪ زئولیت شکری عالی است. قیچی و اره هرس را قبل از هر درخت با الکل ۷۰٪ ضدعفونی کنید.`,
    severity: 'optimal',
    category: 'gardening',
  });

  return advisories;
}

function buildLiveWeatherVoiceScript(params: {
  city: string;
  province: string;
  conditionLabel: string;
  temp: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  rainProb: number;
  minTempToday: number;
  maxTempToday: number;
  soilTemp?: number | null;
  advisories: Array<{ title: string; detail: string; category: string }>;
}): string {
  const sprayAdv = params.advisories.find((a) => a.category === 'spraying');
  const irrigAdv = params.advisories.find((a) => a.category === 'irrigation');
  const pestAdv = params.advisories.find((a) => a.category === 'pest_disease');
  const clean = (s: string) =>
    String(s || '')
      .replace(/°C/gi, ' درجه سانتی‌گراد')
      .replace(/°/g, ' درجه')
      .replace(/km\/h/gi, ' کیلومتر در ساعت')
      .replace(/%/g, ' درصد')
      .replace(/pH/gi, 'اسیدیته آب')
      .trim();

  return [
    `سلام و درود خدمت همراهان گرامی گروه تولیدی و زیست‌فناوری مهندس صفری.`,
    `گزارش زنده هواشناسی و توصیه‌های فنی باغبانی امروز برای شهر ${params.city} در استان ${params.province} آماده است.`,
    `در حال حاضر هوا ${params.conditionLabel} با دمای ${Math.round(params.temp)} درجه سانتی‌گراد، رطوبت نسبی ${Math.round(params.humidity)} درصد، سرعت باد ${Math.round(params.windSpeed)} کیلومتر در ساعت و احتمال بارندگی ${Math.round(params.rainProb)} درصد می‌باشد. بازه دمای امروز بین ${Math.round(params.minTempToday)} تا ${Math.round(params.maxTempToday)} درجه پیش‌بینی شده است${typeof params.soilTemp === 'number' ? ` و دمای سطح خاک حدود ${Math.round(params.soilTemp)} درجه است` : ''}.`,
    sprayAdv ? `در خصوص سمپاشی و محلول‌پاشی امروز: ${clean(sprayAdv.detail.slice(0, 220))}` : '',
    irrigAdv ? `توصیه آبیاری: ${clean(irrigAdv.detail.slice(0, 180))}` : '',
    pestAdv ? `پایش آفات و بیماری‌ها: ${clean(pestAdv.title)}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

async function fetchMetNorwayCurrentAndDaily(lat: number, lon: number): Promise<{
  verified: boolean;
  current?: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    cloudCover: number;
    precipitation: number;
    weatherCode: number;
  };
  daily?: Array<{
    date: string;
    tempMax: number;
    tempMin: number;
    windMax: number;
    precipSum: number;
    weatherCode: number;
  }>;
} | null> {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(
      4
    )}&lon=${lon.toFixed(4)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'SafariBiotechAgronomy/2.5 (contact@safaribiotech.ir)',
      },
      signal: AbortSignal.timeout(5500),
    });
    if (!resp.ok) return null;
    const json: any = await resp.json();
    const timeseries: any[] = Array.isArray(json?.properties?.timeseries)
      ? json.properties.timeseries
      : [];
    if (timeseries.length === 0) return null;

    const first = timeseries[0];
    const details = first?.data?.instant?.details || {};
    const next1h = first?.data?.next_1_hours || first?.data?.next_6_hours || {};
    const symbolCode = String(next1h?.summary?.symbol_code || 'fair_day');

    const byDate = new Map<
      string,
      { temps: number[]; winds: number[]; precip: number; symbol: string }
    >();
    for (const entry of timeseries) {
      const dateStr = String(entry?.time || '').slice(0, 10);
      if (!dateStr) continue;
      // Convert UTC date roughly to Asia/Tehran date slice by using local time slice or UTC day bucket
      const d = entry?.data?.instant?.details || {};
      const t = Number(d.air_temperature);
      const w = Number(d.wind_speed || 0) * 3.6;
      const p = Number(entry?.data?.next_1_hours?.details?.precipitation_amount || 0);
      const sym = String(
        entry?.data?.next_6_hours?.summary?.symbol_code ||
          entry?.data?.next_1_hours?.summary?.symbol_code ||
          ''
      );
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, { temps: [], winds: [], precip: 0, symbol: sym });
      }
      const bucket = byDate.get(dateStr)!;
      if (Number.isFinite(t)) bucket.temps.push(t);
      if (Number.isFinite(w)) bucket.winds.push(w);
      if (Number.isFinite(p)) bucket.precip += p;
      if (!bucket.symbol && sym) bucket.symbol = sym;
    }

    const daily = Array.from(byDate.entries())
      .slice(0, 7)
      .map(([date, bucket]) => ({
        date,
        tempMax: bucket.temps.length ? Math.round(Math.max(...bucket.temps)) : 20,
        tempMin: bucket.temps.length ? Math.round(Math.min(...bucket.temps)) : 10,
        windMax: bucket.winds.length ? Math.round(Math.max(...bucket.winds)) : 8,
        precipSum: Math.round(bucket.precip * 10) / 10,
        weatherCode: mapMetNoSymbolToWmo(bucket.symbol),
      }));

    return {
      verified: true,
      current: {
        temperature: Number(details.air_temperature ?? 20),
        humidity: Number(details.relative_humidity ?? 40),
        windSpeed: Number(details.wind_speed ?? 2) * 3.6,
        windDirection: Number(details.wind_from_direction ?? 0),
        cloudCover: Number(details.cloud_area_fraction ?? 10),
        precipitation: Number(next1h?.details?.precipitation_amount ?? 0),
        weatherCode: mapMetNoSymbolToWmo(symbolCode),
      },
      daily,
    };
  } catch {
    return null;
  }
}

async function fetchWttrEmergencyFallback(lat: number, lon: number) {
  try {
    const resp = await fetch(`https://wttr.in/${lat.toFixed(3)},${lon.toFixed(3)}?format=j1`, {
      headers: { 'User-Agent': 'curl/8.0.1' },
      signal: AbortSignal.timeout(5500),
    });
    if (!resp.ok) return null;
    const j: any = await resp.json();
    const cur = j?.current_condition?.[0];
    if (!cur) return null;
    const daily = (Array.isArray(j?.weather) ? j.weather : []).slice(0, 7).map((w: any) => ({
      date: String(w.date || ''),
      tempMax: Math.round(Number(w.maxtempC ?? cur.temp_C ?? 20)),
      tempMin: Math.round(Number(w.mintempC ?? cur.temp_C ?? 10)),
      windMax: Math.round(Number(w.hourly?.[4]?.windspeedKmph ?? cur.windspeedKmph ?? 10)),
      precipSum: Number(w.hourly?.[4]?.precipMM ?? 0),
      precipProb: Number(w.hourly?.[4]?.chanceofrain ?? 10),
      weatherCode: Number(w.hourly?.[4]?.precipMM || 0) > 0.5 ? 61 : 1,
    }));
    return {
      temperature: Number(cur.temp_C ?? 20),
      apparentTemperature: Number(cur.FeelsLikeC ?? cur.temp_C ?? 20),
      humidity: Number(cur.humidity ?? 40),
      windSpeed: Number(cur.windspeedKmph ?? 8),
      windDirection: Number(cur.winddirDegree ?? 0),
      cloudCover: Number(cur.cloudcover ?? 15),
      precipitation: Number(cur.precipMM ?? 0),
      weatherCode: Number(cur.precipMM ?? 0) > 0.4 ? 61 : Number(cur.cloudcover ?? 0) > 65 ? 3 : 0,
      daily,
    };
  } catch {
    return null;
  }
}

export function registerIranWeatherRoutes(app: Express): void {
  app.get('/api/weather', async (req: Request, res: Response): Promise<void> => {
    try {
      const rawProvince = String(req.query.province || 'تهران').trim();
      const rawCity = String(req.query.city || 'تهران').trim();

      const resolved = await resolveIranLocation(rawProvince, rawCity);
      const cacheKey = `${resolved.lat.toFixed(2)},${resolved.lon.toFixed(2)}:${resolved.provinceLabel}:${resolved.cityLabel}`;
      const cached = weatherDataCache.get(cacheKey);
      if (cached && Date.now() - cached.createdAt < 1000 * 60 * 10) {
        res.json({ ...cached.payload, cached: true });
        return;
      }

      const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
      forecastUrl.searchParams.set('latitude', String(resolved.lat));
      forecastUrl.searchParams.set('longitude', String(resolved.lon));
      forecastUrl.searchParams.set('models', 'best_match');
      forecastUrl.searchParams.set('timezone', 'Asia/Tehran');
      forecastUrl.searchParams.set(
        'current',
        'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m'
      );
      forecastUrl.searchParams.set(
        'hourly',
        'temperature_2m,precipitation_probability,soil_temperature_0cm,soil_moisture_0_to_7cm'
      );
      forecastUrl.searchParams.set(
        'daily',
        'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,et0_fao_evapotranspiration,sunrise,sunset'
      );
      forecastUrl.searchParams.set('forecast_days', '7');

      const openMeteoPromise = (async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const resp = await fetch(forecastUrl.toString(), { signal: AbortSignal.timeout(7000) });
            if (resp.ok) return await resp.json();
          } catch {
            // retry once
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        return null;
      })();

      const metNoPromise = fetchMetNorwayCurrentAndDaily(resolved.lat, resolved.lon);

      const [openMeteoData, metNoData] = await Promise.all([openMeteoPromise, metNoPromise]);

      if (openMeteoData && openMeteoData.current) {
        const cur = openMeteoData.current || {};
        const hourly = openMeteoData.hourly || {};
        const daily = openMeteoData.daily || {};

        const currentTimeStr = String(cur.time || '').slice(0, 13);
        const hourlyTimes: string[] = Array.isArray(hourly.time) ? hourly.time : [];
        let hourIdx = hourlyTimes.findIndex((t) => String(t).startsWith(currentTimeStr));
        if (hourIdx < 0) hourIdx = 0;

        const soilTemp =
          Array.isArray(hourly.soil_temperature_0cm) && typeof hourly.soil_temperature_0cm[hourIdx] === 'number'
            ? Math.round(hourly.soil_temperature_0cm[hourIdx] * 10) / 10
            : null;
        const rawSoilMoisture =
          Array.isArray(hourly.soil_moisture_0_to_7cm) && typeof hourly.soil_moisture_0_to_7cm[hourIdx] === 'number'
            ? hourly.soil_moisture_0_to_7cm[hourIdx]
            : null;
        const soilMoisturePct =
          rawSoilMoisture !== null ? Math.min(100, Math.max(5, Math.round((rawSoilMoisture / 0.45) * 100))) : null;

        const currentPrecipProb =
          Array.isArray(hourly.precipitation_probability) && typeof hourly.precipitation_probability[hourIdx] === 'number'
            ? hourly.precipitation_probability[hourIdx]
            : Array.isArray(daily.precipitation_probability_max)
            ? Number(daily.precipitation_probability_max[0] || 0)
            : 0;

        const isDay = cur.is_day !== 0;
        const wmoInfo = describeWmoWeatherCodeFa(Number(cur.weather_code ?? 0), isDay);

        const dailyForecast = (Array.isArray(daily.time) ? daily.time : []).map((dateStr: string, idx: number) => {
          const code = Number(daily.weather_code?.[idx] ?? 0);
          const desc = describeWmoWeatherCodeFa(code, true);
          let dayLabel = dateStr;
          try {
            if (idx === 0) {
              dayLabel = 'امروز';
            } else if (idx === 1) {
              dayLabel = 'فردا';
            } else {
              dayLabel = new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(
                new Date(`${dateStr}T12:00:00Z`)
              );
            }
          } catch {
            dayLabel = dateStr;
          }
          return {
            date: dateStr,
            dayLabel,
            weatherCode: code,
            conditionLabel: desc.label,
            conditionKey: desc.conditionKey,
            tempMax: Math.round(Number(daily.temperature_2m_max?.[idx] ?? 0)),
            tempMin: Math.round(Number(daily.temperature_2m_min?.[idx] ?? 0)),
            precipProb: Math.round(Number(daily.precipitation_probability_max?.[idx] ?? 0)),
            precipSum: Math.round(Number(daily.precipitation_sum?.[idx] ?? 0) * 10) / 10,
            windMax: Math.round(Number(daily.wind_speed_10m_max?.[idx] ?? 0)),
            uvMax: Math.round(Number(daily.uv_index_max?.[idx] ?? 0) * 10) / 10,
            et0: Math.round(Number(daily.et0_fao_evapotranspiration?.[idx] ?? 0) * 10) / 10,
            sunrise: String(daily.sunrise?.[idx] || '').slice(11, 16),
            sunset: String(daily.sunset?.[idx] || '').slice(11, 16),
          };
        });

        const todayDaily = dailyForecast[0] || {
          tempMax: Math.round(Number(cur.temperature_2m ?? 20)),
          tempMin: Math.round(Number(cur.temperature_2m ?? 12)),
          precipProb: currentPrecipProb,
          precipSum: 0,
          et0: 3.5,
          uvMax: 5,
          sunrise: '06:15',
          sunset: '18:00',
        };

        const tempVal = Number(cur.temperature_2m ?? 20);
        const humidityVal = Number(cur.relative_humidity_2m ?? 40);
        const windVal = Number(cur.wind_speed_10m ?? 5);

        const advisories = buildAgronomicWeatherAdvisories({
          city: resolved.cityLabel,
          temp: tempVal,
          humidity: humidityVal,
          windSpeed: windVal,
          rainProb: Math.max(currentPrecipProb, todayDaily.precipProb || 0),
          precipSumToday: todayDaily.precipSum || 0,
          minTempToday: todayDaily.tempMin,
          maxTempToday: todayDaily.tempMax,
          soilTemp,
          soilMoisturePct,
          et0: todayDaily.et0,
          uvMax: todayDaily.uvMax,
        });

        const voiceScript = buildLiveWeatherVoiceScript({
          city: resolved.cityLabel,
          province: resolved.provinceLabel,
          conditionLabel: wmoInfo.label,
          temp: tempVal,
          apparentTemp: Number(cur.apparent_temperature ?? tempVal),
          humidity: humidityVal,
          windSpeed: windVal,
          rainProb: Math.max(currentPrecipProb, todayDaily.precipProb || 0),
          minTempToday: todayDaily.tempMin,
          maxTempToday: todayDaily.tempMax,
          soilTemp,
          advisories,
        });

        const sourceName = metNoData?.verified
          ? 'Open-Meteo (ECMWF/ICON) + سازمان هواشناسی نروژ (MET Norway)'
          : 'Open-Meteo (مدل باکیفیت ECMWF/ICON ایران)';

        const payload = {
          sourceName,
          location: {
            province: resolved.provinceLabel,
            city: resolved.cityLabel,
            lat: resolved.lat,
            lon: resolved.lon,
          },
          updatedAtFa: new Intl.DateTimeFormat('fa-IR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Tehran',
          }).format(new Date()),
          current: {
            temperature: Math.round(tempVal),
            apparentTemperature: Math.round(Number(cur.apparent_temperature ?? tempVal)),
            humidity: Math.round(humidityVal),
            windSpeed: Math.round(windVal),
            windDirection: Math.round(Number(cur.wind_direction_10m ?? 0)),
            precipitation: Number(cur.precipitation ?? 0),
            precipitationProbability: Math.round(currentPrecipProb),
            cloudCover: Math.round(Number(cur.cloud_cover ?? 0)),
            weatherCode: Number(cur.weather_code ?? 0),
            conditionLabel: wmoInfo.label,
            conditionKey: wmoInfo.conditionKey,
            isDay,
            soilTemp,
            soilMoisturePct,
            et0Today: todayDaily.et0,
            uvMaxToday: todayDaily.uvMax,
            sunrise: todayDaily.sunrise,
            sunset: todayDaily.sunset,
          },
          forecast: dailyForecast,
          advisories,
          voiceScript,
          cached: false,
        };

        if (weatherDataCache.size > 150) {
          const oldest = weatherDataCache.keys().next().value;
          if (oldest) weatherDataCache.delete(oldest);
        }
        weatherDataCache.set(cacheKey, { payload, createdAt: Date.now() });

        res.json(payload);
        return;
      }

      // Secondary authoritative failover: MET Norway Locationforecast 2.0
      if (metNoData?.current && Array.isArray(metNoData.daily) && metNoData.daily.length > 0) {
        const cur = metNoData.current;
        const hourFa = Number(
          new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            hour12: false,
            timeZone: 'Asia/Tehran',
          }).format(new Date())
        );
        const isDay = hourFa >= 6 && hourFa < 19;
        const wmoInfo = describeWmoWeatherCodeFa(cur.weatherCode, isDay);

        const dailyForecast = metNoData.daily.map((d, idx) => {
          const desc = describeWmoWeatherCodeFa(d.weatherCode, true);
          let dayLabel = d.date;
          try {
            if (idx === 0) dayLabel = 'امروز';
            else if (idx === 1) dayLabel = 'فردا';
            else {
              dayLabel = new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(
                new Date(`${d.date}T12:00:00Z`)
              );
            }
          } catch {
            dayLabel = d.date;
          }
          const precipProb = d.precipSum > 0.2 ? Math.min(90, Math.round(35 + d.precipSum * 10)) : 5;
          return {
            date: d.date,
            dayLabel,
            weatherCode: d.weatherCode,
            conditionLabel: desc.label,
            conditionKey: desc.conditionKey,
            tempMax: d.tempMax,
            tempMin: d.tempMin,
            precipProb,
            precipSum: d.precipSum,
            windMax: d.windMax,
            uvMax: 5,
            et0: Math.max(1.5, Math.round((d.tempMax * 0.16) * 10) / 10),
            sunrise: '06:15',
            sunset: '18:00',
          };
        });

        const todayDaily = dailyForecast[0];
        const advisories = buildAgronomicWeatherAdvisories({
          city: resolved.cityLabel,
          temp: cur.temperature,
          humidity: cur.humidity,
          windSpeed: cur.windSpeed,
          rainProb: todayDaily.precipProb,
          precipSumToday: todayDaily.precipSum,
          minTempToday: todayDaily.tempMin,
          maxTempToday: todayDaily.tempMax,
          soilTemp: Math.round((cur.temperature - 1.5) * 10) / 10,
          soilMoisturePct: null,
          et0: todayDaily.et0,
          uvMax: todayDaily.uvMax,
        });

        const voiceScript = buildLiveWeatherVoiceScript({
          city: resolved.cityLabel,
          province: resolved.provinceLabel,
          conditionLabel: wmoInfo.label,
          temp: cur.temperature,
          apparentTemp: cur.temperature,
          humidity: cur.humidity,
          windSpeed: cur.windSpeed,
          rainProb: todayDaily.precipProb,
          minTempToday: todayDaily.tempMin,
          maxTempToday: todayDaily.tempMax,
          soilTemp: Math.round(cur.temperature - 1.5),
          advisories,
        });

        const payload = {
          sourceName: 'سازمان هواشناسی نروژ (MET Norway - شبکه پشتیبان معتبر)',
          location: {
            province: resolved.provinceLabel,
            city: resolved.cityLabel,
            lat: resolved.lat,
            lon: resolved.lon,
          },
          updatedAtFa: new Intl.DateTimeFormat('fa-IR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Tehran',
          }).format(new Date()),
          current: {
            temperature: Math.round(cur.temperature),
            apparentTemperature: Math.round(cur.temperature),
            humidity: Math.round(cur.humidity),
            windSpeed: Math.round(cur.windSpeed),
            windDirection: Math.round(cur.windDirection),
            precipitation: cur.precipitation,
            precipitationProbability: todayDaily.precipProb,
            cloudCover: Math.round(cur.cloudCover),
            weatherCode: cur.weatherCode,
            conditionLabel: wmoInfo.label,
            conditionKey: wmoInfo.conditionKey,
            isDay,
            soilTemp: Math.round((cur.temperature - 1.5) * 10) / 10,
            soilMoisturePct: null,
            et0Today: todayDaily.et0,
            uvMaxToday: todayDaily.uvMax,
            sunrise: todayDaily.sunrise,
            sunset: todayDaily.sunset,
          },
          forecast: dailyForecast,
          advisories,
          voiceScript,
          cached: false,
        };

        weatherDataCache.set(cacheKey, { payload, createdAt: Date.now() });
        res.json(payload);
        return;
      }

      // Tertiary emergency failover: wttr.in
      const wttr = await fetchWttrEmergencyFallback(resolved.lat, resolved.lon);
      if (wttr && wttr.daily.length > 0) {
        const wmoInfo = describeWmoWeatherCodeFa(wttr.weatherCode, true);
        const dailyForecast = wttr.daily.map((d: any, idx: number) => {
          const desc = describeWmoWeatherCodeFa(d.weatherCode, true);
          return {
            date: d.date,
            dayLabel: idx === 0 ? 'امروز' : idx === 1 ? 'فردا' : d.date,
            weatherCode: d.weatherCode,
            conditionLabel: desc.label,
            conditionKey: desc.conditionKey,
            tempMax: d.tempMax,
            tempMin: d.tempMin,
            precipProb: d.precipProb,
            precipSum: d.precipSum,
            windMax: d.windMax,
            uvMax: 5,
            et0: 3.5,
            sunrise: '06:15',
            sunset: '18:00',
          };
        });
        const todayDaily = dailyForecast[0];
        const advisories = buildAgronomicWeatherAdvisories({
          city: resolved.cityLabel,
          temp: wttr.temperature,
          humidity: wttr.humidity,
          windSpeed: wttr.windSpeed,
          rainProb: todayDaily.precipProb,
          precipSumToday: todayDaily.precipSum,
          minTempToday: todayDaily.tempMin,
          maxTempToday: todayDaily.tempMax,
          et0: 3.5,
          uvMax: 5,
        });
        const payload = {
          sourceName: 'سرویس هواشناسی پشتیبان (شبکه جهانی)',
          location: {
            province: resolved.provinceLabel,
            city: resolved.cityLabel,
            lat: resolved.lat,
            lon: resolved.lon,
          },
          updatedAtFa: new Intl.DateTimeFormat('fa-IR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Tehran',
          }).format(new Date()),
          current: {
            temperature: Math.round(wttr.temperature),
            apparentTemperature: Math.round(wttr.apparentTemperature),
            humidity: Math.round(wttr.humidity),
            windSpeed: Math.round(wttr.windSpeed),
            windDirection: Math.round(wttr.windDirection),
            precipitation: wttr.precipitation,
            precipitationProbability: todayDaily.precipProb,
            cloudCover: Math.round(wttr.cloudCover),
            weatherCode: wttr.weatherCode,
            conditionLabel: wmoInfo.label,
            conditionKey: wmoInfo.conditionKey,
            isDay: true,
            soilTemp: null,
            soilMoisturePct: null,
            et0Today: 3.5,
            uvMaxToday: 5,
            sunrise: '06:15',
            sunset: '18:00',
          },
          forecast: dailyForecast,
          advisories,
          voiceScript: buildLiveWeatherVoiceScript({
            city: resolved.cityLabel,
            province: resolved.provinceLabel,
            conditionLabel: wmoInfo.label,
            temp: wttr.temperature,
            apparentTemp: wttr.apparentTemperature,
            humidity: wttr.humidity,
            windSpeed: wttr.windSpeed,
            rainProb: todayDaily.precipProb,
            minTempToday: todayDaily.tempMin,
            maxTempToday: todayDaily.tempMax,
            advisories,
          }),
          cached: false,
        };
        weatherDataCache.set(cacheKey, { payload, createdAt: Date.now() });
        res.json(payload);
        return;
      }

      res.status(502).json({
        error: 'دریافت اطلاعات لحظه‌ای هواشناسی با تاخیر موقت روبه‌رو شد؛ لطفاً چند لحظه دیگر مجدداً تلاش کنید.',
      });
    } catch (error: any) {
      console.error('Error in /api/weather:', error);
      res.status(500).json({
        error: 'خطا در برقراری ارتباط با سرویس هواشناسی آنلاین',
        details: error?.message || 'خطای ناشناخته',
      });
    }
  });
}
