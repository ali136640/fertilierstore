import { PlantProfile } from '../types/storefront';

export const COMPREHENSIVE_PLANT_PROFILES: PlantProfile[] = [
  // ===================== باغات و درختان میوه =====================
  {
    id: 'tree-pistachio',
    name: 'درخت پسته (بارده و جوان)',
    aliases: ['پسته', 'پسته اکبری', 'پسته کله‌قوچی', 'پسته احمدآقایی', 'پسته فندقی', 'باغ پسته'],
    category: 'orchard',
    categoryLabel: 'باغات میوه و خشکبار',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 6,
      compostKgPerUnit: 12,
      zeoliteKgPerUnit: 1.5,
      liquidTeaLiterPerUnit: 0.2,
      unitLabel: 'اصله درخت',
      instructions: 'حفر ۲ تا ۴ چاله چالکود در سایه‌انداز بیرونی ریشه‌های موئین. اختلاط کودها با خاک سطحی و آبیاری سنگین زمستانه جهت اصلاح شوری EC و تثبیت ازت.',
      bestMonthsFa: 'آذر تا بهمن (فصل خواب و زمستان)',
      comboStrategy: 'combo_all',
    }
  },
  {
    id: 'tree-walnut',
    name: 'درخت گردو (پیوندی و بومی)',
    aliases: ['گردو', 'گردو چندلر', 'گردو فرنور', 'گردو تویسرکان', 'باغ گردو'],
    category: 'orchard',
    categoryLabel: 'باغات میوه و خشکبار',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 8,
      compostKgPerUnit: 16,
      zeoliteKgPerUnit: 2,
      liquidTeaLiterPerUnit: 0.3,
      unitLabel: 'اصله درخت',
      instructions: 'درختان تنومند گردو به دلیل ریشه‌دوانی گسترده نیازمند ۴ کانال چالکود با اختلاط ورمیکمپوست غنی از هیومیک و کمپوست سنتی جهت رفع سیاه شدن مغز گردو هستند.',
      bestMonthsFa: 'دی تا اسفند',
      comboStrategy: 'combo_all',
    }
  },
  {
    id: 'tree-citrus',
    name: 'مرکبات (پرتقال، نارنگی، لیمو، گریپ‌فروت)',
    aliases: ['مرکبات', 'پرتقال', 'نارنگی', 'لیمو ترش', 'لیمو شیرین', 'نارنج', 'دارابی'],
    category: 'orchard',
    categoryLabel: 'باغات میوه و خشکبار',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 5,
      compostKgPerUnit: 8,
      zeoliteKgPerUnit: 1,
      liquidTeaLiterPerUnit: 0.2,
      unitLabel: 'اصله درخت',
      instructions: 'استفاده از ورمیکمپوست بافرشده به همراه زئولیت در فاصله ۱ متری تنه درخت جهت جلوگیری از زردی برگ و ریزش گل‌های بهاره مرکبات.',
      bestMonthsFa: 'بهمن تا فروردین و اوایل پاییز',
      comboStrategy: 'combo_all',
    }
  },
  {
    id: 'tree-olive',
    name: 'درخت زیتون (روغنی و کنسروی)',
    aliases: ['زیتون', 'باغ زیتون', 'زیتون زرد', 'زیتون ماری', 'زیتون مانزانیلا'],
    category: 'orchard',
    categoryLabel: 'باغات میوه و خشکبار',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 4,
      compostKgPerUnit: 7,
      zeoliteKgPerUnit: 1.5,
      liquidTeaLiterPerUnit: 0.15,
      unitLabel: 'اصله درخت',
      instructions: 'زئولیت موجود در پکیج ترکیبی شوری بالای آب و خاک را مهار کرده و ورمیکمپوست صفری درصد روغن و سایز میوه را تا ۲۵٪ ارتقا می‌دهد.',
      bestMonthsFa: 'دی و بهمن',
      comboStrategy: 'combo_all',
    }
  },
  {
    id: 'tree-apple',
    name: 'درخت سیب و گلابی',
    aliases: ['سیب', 'سیب سرخ', 'سیب زرد', 'گلابی', 'به', 'باغ سیب'],
    category: 'orchard',
    categoryLabel: 'باغات میوه و خشکبار',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 5,
      compostKgPerUnit: 10,
      zeoliteKgPerUnit: 1.2,
      liquidTeaLiterPerUnit: 0.25,
      unitLabel: 'اصله درخت',
      instructions: 'چالکود ورمیکمپوست غنی از کلسیم بیولوژیک از لکه‌سیاه و عارضه لکه‌تلخی سیب جلوگیری کرده و استحکام انبارداری را افزایش می‌دهد.',
      bestMonthsFa: 'دی تا اسفند',
      comboStrategy: 'combo_all',
    }
  },
  {
    id: 'tree-stone-fruits',
    name: 'هسته دارها (هلو، شلیل، زردآلو، گیلاس، آلبالو)',
    aliases: ['هلو', 'شلیل', 'زردآلو', 'گیلاس', 'آلبالو', 'گوجه سبز', 'آلو'],
    category: 'orchard',
    categoryLabel: 'باغات میوه و خشکبار',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 4.5,
      compostKgPerUnit: 8,
      zeoliteKgPerUnit: 1,
      liquidTeaLiterPerUnit: 0.2,
      unitLabel: 'اصله درخت',
      instructions: 'تغذیه با ورمیکمپوست ارگانیک زمان گل‌انگیزی را تنظیم کرده و مقاومت جوانه‌های بازشده به سرمای دیررس بهاره را بهبود می‌بخشد.',
      bestMonthsFa: 'آذر و دی',
      comboStrategy: 'combo_all',
    }
  },
  {
    id: 'tree-pomegranate',
    name: 'درخت انار و انجیر',
    aliases: ['انار', 'انار ساوه', 'انجیر', 'انجیر استهبان', 'باغ انار'],
    category: 'orchard',
    categoryLabel: 'باغات میوه و خشکبار',
    popular: false,
    scientificDose: {
      vermiKgPerUnit: 4,
      compostKgPerUnit: 6,
      zeoliteKgPerUnit: 1,
      liquidTeaLiterPerUnit: 0.15,
      unitLabel: 'اصله درخت',
      instructions: 'تثبیت رطوبت با زئولیت و اسید هیومیک ورمیکمپوست مانع ترکیدگی پوست انار و عارضه دانه‌سفیدی می‌شود.',
      bestMonthsFa: 'دی و بهمن',
      comboStrategy: 'combo_all',
    }
  },
  {
    id: 'tree-grape',
    name: 'مو و تاکستان انگور (ایستاده و سنتی)',
    aliases: ['انگور', 'مو', 'تاکستان', 'انگور بیدانه', 'انگور یاقوتی', 'انگور شانی'],
    category: 'orchard',
    categoryLabel: 'باغات میوه و خشکبار',
    popular: false,
    scientificDose: {
      vermiKgPerUnit: 3,
      compostKgPerUnit: 5,
      zeoliteKgPerUnit: 0.8,
      liquidTeaLiterPerUnit: 0.1,
      unitLabel: 'اصله بوته انگور',
      instructions: 'در کانال شیاری به عمق ۳۰ سانتیمتر بین ردیف‌های مو پاشیده شود.',
      bestMonthsFa: 'بهمن و اسفند قبل از باز شدن جوانه‌ها',
      comboStrategy: 'combo_all',
    }
  },
  {
    id: 'tree-date-palm',
    name: 'نخل خرما (ارقام تجاری و صادراتی)',
    aliases: ['نخل', 'خرما', 'نخلستان', 'مضافتی', 'پیارم', 'کبکاب', 'زاهدی'],
    category: 'orchard',
    categoryLabel: 'باغات میوه و خشکبار',
    popular: false,
    scientificDose: {
      vermiKgPerUnit: 7,
      compostKgPerUnit: 15,
      zeoliteKgPerUnit: 2,
      liquidTeaLiterPerUnit: 0.3,
      unitLabel: 'اصله نخل',
      instructions: 'دور تا دور پاجوش‌ها و طوقه با حریم ۴۰ سانتی‌متری، در خاک‌های شنی جنوبی باعث حفظ رطوبت تا ۲ برابر می‌شود.',
      bestMonthsFa: 'آبان و آذر',
      comboStrategy: 'combo_all',
    }
  },

  // ===================== گیاهان آپارتمانی و گل‌های زینتی =====================
  {
    id: 'plant-sansevieria',
    name: 'سانسوریا (شمشیری، مهتابی، ابلق، لوله‌ای)',
    aliases: ['سانسوریا', 'سانسوریا ابلق', 'سانسوریا شمشیری', 'سانسوریا پاکوتاه', 'مار پلات'],
    category: 'houseplants',
    categoryLabel: 'گیاهان آپارتمانی و زینتی',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 0.25, // ~250 grams per medium pot
      substrateKgPerUnit: 0.5,
      liquidTeaLiterPerUnit: 0.05,
      unitLabel: 'گلدان',
      instructions: 'مخلوط کردن ۳ تا ۴ قاشق غذاخوری ورمیکمپوست صفری با خاک رویی گلدان هر ۳ ماه یک‌بار، یا ترکیب ۱۰٪ با بستر تفاله قهوه و زئولیت در زمان تعویض گلدان جهت پاجوش‌زنی انفجاری.',
      bestMonthsFa: 'تمام فصول (به ویژه اوایل بهار و تابستان)',
      comboStrategy: 'houseplant_trio',
    }
  },
  {
    id: 'plant-zz-plant',
    name: 'زاموفیلیا (سبز، بلک، ابلق و سوپر ابلق)',
    aliases: ['زاموفیلیا', 'زامیفولیا', 'زاموفیلیا بلک', 'ZZ Plant'],
    category: 'houseplants',
    categoryLabel: 'گیاهان آپارتمانی و زینتی',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 0.2,
      substrateKgPerUnit: 0.6,
      liquidTeaLiterPerUnit: 0.05,
      unitLabel: 'گلدان',
      instructions: 'غده‌های زاموفیلیا به شوری و آب اضافی حساس هستند. بستر قهوه و زئولیت بافرشده به همراه مقادیر کنترل‌شده ورمیکمپوست پیازها را حجیم کرده و ساقه‌های جدید مقاوم ایجاد می‌کند.',
      bestMonthsFa: 'بهار و اواخر تابستان',
      comboStrategy: 'houseplant_trio',
    }
  },
  {
    id: 'plant-pothos',
    name: 'پتوس (سبز، ابلق، مرمری، نئون، حصیری)',
    aliases: ['پتوس', 'پوتوس', 'پتوس فرانسوی', 'پتوس نئون', 'پتوس سفید'],
    category: 'houseplants',
    categoryLabel: 'گیاهان آپارتمانی و زینتی',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 0.15,
      substrateKgPerUnit: 0.35,
      liquidTeaLiterPerUnit: 0.04,
      unitLabel: 'گلدان',
      instructions: 'اضافه کردن ۲ قاشق ورمیکمپوست روی سطح خاک هر ۶ هفته، همراه با ماهی یک‌بار غبارپاشی برگی با محلول ۱۰ سی‌سی ورمی‌تی در ۱ لیتر آب.',
      bestMonthsFa: 'تمام ایام سال',
      comboStrategy: 'houseplant_trio',
    }
  },
  {
    id: 'plant-ficus',
    name: 'خانواده فیکوس (لیراتا، بنجامین، الاستیکا، رتوزا)',
    aliases: ['فیکوس', 'فیکوس لیراتا', 'لیراتا', 'بنجامین', 'فیکوس بنجامین', 'فیکوس الاستیکا', 'بلک الاستیکا'],
    category: 'houseplants',
    categoryLabel: 'گیاهان آپارتمانی و زینتی',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 0.4,
      substrateKgPerUnit: 0.8,
      liquidTeaLiterPerUnit: 0.08,
      unitLabel: 'گلدان بزرگ',
      instructions: 'برای جلوگیری از ریزش برگ در بنجامین و سوختگی حاشیه برگ در لیراتا، ورمیکمپوست فاقد بوی صفری ریشه‌زایی موئین را تحریک کرده و تهویه خاک را با زئولیت تضمین می‌کند.',
      bestMonthsFa: 'اسفند تا آبان ماه',
      comboStrategy: 'houseplant_trio',
    }
  },
  {
    id: 'plant-monstera',
    name: 'برگ انجیری و مونسترا (دلسیوزا، مانکی، بورسیجیانا)',
    aliases: ['برگ انجیری', 'مونسترا', 'مونسترا دلسیوزا', 'برگ انجیری پنجه شیری', 'مانکی ماسک'],
    category: 'houseplants',
    categoryLabel: 'گیاهان آپارتمانی و زینتی',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 0.35,
      substrateKgPerUnit: 0.7,
      liquidTeaLiterPerUnit: 0.08,
      unitLabel: 'گلدان',
      instructions: 'تغذیه با عصاره ارگانیک ورمی‌تی و بستر تفاله قهوه بافرشده باعث باز شدن برگ‌های پهن‌تر با شیارهای عمیق‌تر می‌شود.',
      bestMonthsFa: 'بهار و تابستان',
      comboStrategy: 'houseplant_trio',
    }
  },
  {
    id: 'plant-aglaonema-dieff',
    name: 'آگلونما و دیفن‌باخیا',
    aliases: ['آگلونما', 'آگلونما برفی', 'آگلونما صورتی', 'دیفن باخیا', 'دیفن'],
    category: 'houseplants',
    categoryLabel: 'گیاهان آپارتمانی و زینتی',
    popular: false,
    scientificDose: {
      vermiKgPerUnit: 0.2,
      substrateKgPerUnit: 0.4,
      liquidTeaLiterPerUnit: 0.05,
      unitLabel: 'گلدان',
      instructions: 'بافت خاک باید اسفنجی باشد. ۲ قاشق ورمیکمپوست با خاک ترکیب و با ورمی‌تی غبارپاشی شود.',
      bestMonthsFa: 'بهار و اوایل پاییز',
      comboStrategy: 'houseplant_trio',
    }
  },
  {
    id: 'plant-cactus-succulent',
    name: 'کاکتوس و ساکولنت‌ها (انواع کلکسیونی و معمولی)',
    aliases: ['کاکتوس', 'ساکولنت', 'هاورتیا', 'کراسولا', 'آلوئه‌ورا', 'اچینو'],
    category: 'houseplants',
    categoryLabel: 'گیاهان آپارتمانی و زینتی',
    popular: false,
    scientificDose: {
      vermiKgPerUnit: 0.1,
      zeoliteKgPerUnit: 0.3,
      substrateKgPerUnit: 0.2,
      unitLabel: 'گلدان',
      instructions: 'تنها ۵٪ ورمیکمپوست همراه با ۳۰٪ زئولیت شکری جهت زهکشی عالی و ممانعت از پوسیدگی ریشه استفاده شود.',
      bestMonthsFa: 'اردیبهشت تا شهریور',
      comboStrategy: 'vermi_only',
    }
  },
  {
    id: 'plant-orchid-anthurium',
    name: 'ارکیده و آنتوریوم',
    aliases: ['ارکیده', 'آنتوریوم', 'گل ارکیده', 'اسپاتی فیلوم'],
    category: 'houseplants',
    categoryLabel: 'گیاهان آپارتمانی و زینتی',
    popular: false,
    scientificDose: {
      vermiKgPerUnit: 0.1,
      substrateKgPerUnit: 0.5,
      liquidTeaLiterPerUnit: 0.04,
      unitLabel: 'گلدان',
      instructions: 'بستر تفاله قهوه شسته‌شده و بافرشده به همراه رقیق‌شده عصاره ورمی‌تی بدون مسدود کردن روزنه‌های هوایی.',
      bestMonthsFa: 'دوره قبل از گل‌دهی',
      comboStrategy: 'houseplant_trio',
    }
  },

  // ===================== گلخانه‌ها و صیفی‌جات =====================
  {
    id: 'gh-strawberry',
    name: 'گلخانه توت‌فرنگی (هیدروپونیک و خاکی)',
    aliases: ['توت فرنگی', 'توت‌فرنگی گلخانه‌ای', 'توت فرنگی هیدروپونیک', 'کاماروسا', 'سلوا'],
    category: 'greenhouse',
    categoryLabel: 'گلخانه‌های صنعتی و صیفی‌جات',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 2.5,
      zeoliteKgPerUnit: 0.8,
      liquidTeaLiterPerUnit: 0.05,
      unitLabel: 'متر مربع بستر کشت',
      instructions: 'در کشت خاکی اختلاط با خاک بستر، در هیدروپونیک محلول‌پاشی مرتب ورمی‌تی جهت پیشگیری از کپک خاکستری و افزایش بریکس قند میوه.',
      bestMonthsFa: 'قبل از نشاءکاری و در طول دوره باردهی',
      comboStrategy: 'greenhouse_spray',
    }
  },
  {
    id: 'gh-tomato-cucumber',
    name: 'گوجه‌فرنگی و خیار گلخانه‌ای',
    aliases: ['گوجه', 'گوجه فرنگی', 'خیار', 'خیار گلخانه‌ای', 'فلفل دلمه‌ای', 'بادمجان گلخانه‌ای'],
    category: 'greenhouse',
    categoryLabel: 'گلخانه‌های صنعتی و صیفی‌جات',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 3,
      compostKgPerUnit: 5,
      zeoliteKgPerUnit: 1,
      liquidTeaLiterPerUnit: 0.06,
      unitLabel: 'متر مربع گلخانه',
      instructions: 'آماده‌سازی پشته‌های خاکی قبل از انتقال نشاء، تزریق ورمی‌تی به سیستم قطره‌ای در فاز گل‌دهی.',
      bestMonthsFa: 'شهریور برای کشت پاییزه، دی برای کشت بهاره',
      comboStrategy: 'combo_all',
    }
  },
  {
    id: 'gh-mushrooms',
    name: 'پرورش قارچ خوراکی (دکمه‌ای و صدفی)',
    aliases: ['قارچ', 'قارچ دکمه‌ای', 'قارچ صدفی', 'کمپوست قارچ', 'سالن قارچ'],
    category: 'greenhouse',
    categoryLabel: 'گلخانه‌های صنعتی و صیفی‌جات',
    popular: false,
    scientificDose: {
      substrateKgPerUnit: 1.5,
      vermiKgPerUnit: 0.5,
      unitLabel: 'متر مربع قفسه',
      instructions: 'استفاده از بستر تخصصی تفاله قهوه و زئولیت بافرشده به عنوان خاک پوششی و مکمل پروتئینی بستر جهت تولید کلاهک‌های ضخیم و سفید.',
      bestMonthsFa: 'تمام طول دوره کشت سالنی',
      comboStrategy: 'vermi_only',
    }
  },

  // ===================== زراعت، غلات و گیاهان دارویی =====================
  {
    id: 'farm-saffron',
    name: 'مزارع زعفران (پیازهای ۵ تا ۱۰ ساله)',
    aliases: ['زعفران', 'پیاز زعفران', 'مزرعه زعفران', 'طلای سرخ'],
    category: 'farming',
    categoryLabel: 'زراعت، غلات و گیاهان دارویی',
    popular: true,
    scientificDose: {
      vermiKgPerUnit: 1.5,
      compostKgPerUnit: 3,
      zeoliteKgPerUnit: 0.5,
      unitLabel: 'متر مربع (معادل ۱۵ تن ورمی در هکتار)',
      instructions: 'قبل از شخم تابستانه یا در شیارهای بین خطوط پیازها در شهریور ماه قبل از آبیاری بسار (آب اول) جهت تحریک گل‌دهی چند شاخه‌ای.',
      bestMonthsFa: 'مرداد و شهریور',
      comboStrategy: 'combo_all',
    }
  },
  {
    id: 'farm-cereals',
    name: 'غلات و دانه‌های روغنی (گندم، جو، کلزا، ذرت)',
    aliases: ['گندم', 'جو', 'کلزا', 'ذرت', 'مزرعه گندم', 'یونجه'],
    category: 'farming',
    categoryLabel: 'زراعت، غلات و گیاهان دارویی',
    popular: false,
    scientificDose: {
      vermiKgPerUnit: 0.8,
      compostKgPerUnit: 2,
      unitLabel: 'متر مربع (معادل ۸ تن ورمی در هکتار)',
      instructions: 'پخش با کودپاش پیش از شخم اولیه جهت افزایش ماده آلی خاک، اصلاح پنجه‌زنی و پر شدن دانه.',
      bestMonthsFa: 'مهر و آبان برای غلات پاییزه',
      comboStrategy: 'combo_all',
    }
  },
  {
    id: 'farm-medicinal',
    name: 'گیاهان دارویی و گل محمدی',
    aliases: ['گل محمدی', 'گلاب', 'آویشن', 'نعناع فلفلی', 'رزماری', 'اسطوخودوس'],
    category: 'farming',
    categoryLabel: 'زراعت، غلات و گیاهان دارویی',
    popular: false,
    scientificDose: {
      vermiKgPerUnit: 2,
      compostKgPerUnit: 4,
      zeoliteKgPerUnit: 0.5,
      liquidTeaLiterPerUnit: 0.05,
      unitLabel: 'متر مربع یا هر بوته گل محمدی',
      instructions: 'ورمیکمپوست ارگانیک بدون مواد شیمیایی درصد اسانس و ترپن‌های روغنی گیاه را به طور چشمگیری افزایش می‌دهد.',
      bestMonthsFa: 'بهمن و اسفند',
      comboStrategy: 'combo_all',
    }
  }
];

export function searchPlantProfiles(query: string, categoryFilter: string = 'all'): PlantProfile[] {
  const cleanQ = query.trim().toLowerCase();
  
  return COMPREHENSIVE_PLANT_PROFILES.filter(p => {
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
    if (!matchCat) return false;

    if (!cleanQ) return true;

    const matchName = p.name.toLowerCase().includes(cleanQ);
    const matchAliases = p.aliases.some(a => a.toLowerCase().includes(cleanQ));
    const matchCatLabel = p.categoryLabel.toLowerCase().includes(cleanQ);

    return matchName || matchAliases || matchCatLabel;
  });
}
