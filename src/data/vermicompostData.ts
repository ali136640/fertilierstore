import { 
  BatchConfig, 
  FormulationResult, 
  ProductType, 
  CustomRawMaterial, 
  PersonnelMember, 
  TroubleCase, 
  LabSignatories 
} from '../types/vermicompost';

export function getCurrentPersianDate(): string {
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch (e) {
    const d = new Date();
    return `${d.getFullYear() - 621}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }
}

export function formatPersianDateVerbose(): string {
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    return formatter.format(new Date());
  } catch (e) {
    return getCurrentPersianDate();
  }
}

// Standard formulas per product type
export const STANDARD_PRODUCT_FORMULAS: Record<ProductType, CustomRawMaterial[]> = {
  vermicompost: [
    {
      id: 'mat-compost',
      name: 'کود کمپوست سنتی فرآوری‌شده (پایه دامی و تفاله قهوه)',
      category: 'carbon',
      enabled: true,
      ratioPercent: 80.0,
      pricePerUnit: 2500,
      unit: 'kg',
      moisturePercent: 60,
      roleDescription: 'خوراک پخته‌شده کرم‌ها، پاستوریزه در دمای ۵۵ تا ۶۵ درجه و عاری از گاز آمونیاک و بذر علف',
    },
    {
      id: 'mat-worm',
      name: 'کرم خاکی ایزینیا فوتیدا (بیومس فعال و بستر زنده)',
      category: 'starter',
      enabled: true,
      ratioPercent: 12.0,
      pricePerUnit: 35000,
      unit: 'kg',
      moisturePercent: 75,
      roleDescription: 'عامل بیولوژیک هضم کمپوست، ترشح هورمون، آنزیم و کلسیت و تولید ورمیکمپوست درجه ۱',
    },
    {
      id: 'mat-zeolite',
      name: 'زئولیت کشاورزی شکری (۱-۳mm)',
      category: 'mineral',
      enabled: true,
      ratioPercent: 5.0,
      pricePerUnit: 4200,
      unit: 'kg',
      moisturePercent: 5,
      roleDescription: 'تعدیل شوری EC، جذب گاز آمونیاک، تخلخل هوازی و افزایش ظرفیت تبادل کاتیونی',
    },
    {
      id: 'mat-calcium',
      name: 'پودر کربنات کلسیم / دولومیت',
      category: 'mineral',
      enabled: true,
      ratioPercent: 2.5,
      pricePerUnit: 1800,
      unit: 'kg',
      moisturePercent: 1,
      roleDescription: 'تغذیه غدد کلسیم کرم‌ها، بافر اسیدیته و تنظیم pH روی ۷.۱۵ خنثی',
    },
    {
      id: 'mat-molasses',
      name: 'ملاس چغندرقند مایع (استارتر زیستی)',
      category: 'starter',
      enabled: true,
      ratioPercent: 0.5,
      pricePerUnit: 15000,
      unit: 'liter',
      moisturePercent: 20,
      roleDescription: 'محرک رشد باکتری‌های تجزیه‌کننده و افزایش اشتهای تغذیه کرم‌ها',
    },
  ],
  traditional_compost: [
    {
      id: 'mat-cow',
      name: 'کود گاوی غنی‌شده',
      category: 'carbon',
      enabled: true,
      ratioPercent: 70.0,
      pricePerUnit: 1400,
      unit: 'kg',
      moisturePercent: 60,
      roleDescription: 'پایه ماده آلی و بستر فعالیت ترموفیل باکتریایی',
    },
    {
      id: 'mat-coffee',
      name: 'تفاله قهوه دپو شده',
      category: 'nitrogen',
      enabled: true,
      ratioPercent: 22.0,
      pricePerUnit: 2500,
      unit: 'kg',
      moisturePercent: 50,
      roleDescription: 'منبع ازت سریع و شتاب‌دهنده رسیدن به دمای ۵۵ تا ۶۵ درجه',
    },
    {
      id: 'mat-zeolite',
      name: 'زئولیت کشاورزی',
      category: 'mineral',
      enabled: true,
      ratioPercent: 5.0,
      pricePerUnit: 4200,
      unit: 'kg',
      moisturePercent: 5,
      roleDescription: 'تثبیت ازت و جلوگیری از هدررفت آمونیاک در دمای بالا',
    },
    {
      id: 'mat-calcium',
      name: 'پودر آهک هیدراته / کربنات کلسیم',
      category: 'mineral',
      enabled: true,
      ratioPercent: 3.0,
      pricePerUnit: 1800,
      unit: 'kg',
      moisturePercent: 1,
      roleDescription: 'کنترل اسیدیته حاصل از تجزیه اسیدهای چرب کمپوست',
    },
  ],
  worm_tea: [
    {
      id: 'mat-wormcast',
      name: 'ورمیکمپوست درجه ۱ سرندشده',
      category: 'carbon',
      enabled: true,
      ratioPercent: 80.0,
      pricePerUnit: 24000,
      unit: 'kg',
      moisturePercent: 35,
      roleDescription: 'منبع سرشار از باکتری‌ها، قارچ‌های مفید و اسید هیومیک و فولویک',
    },
    {
      id: 'mat-molasses',
      name: 'ملاس چغندرقند غیرگوگردی',
      category: 'starter',
      enabled: true,
      ratioPercent: 12.0,
      pricePerUnit: 15000,
      unit: 'liter',
      moisturePercent: 20,
      roleDescription: 'منبع غذای قندی برای تکثیر انفجاری میکروب‌های هوازی در مخزن هوادهی',
    },
    {
      id: 'mat-humic',
      name: 'عصاره هیومات پتاسیم مایع',
      category: 'additive',
      enabled: true,
      ratioPercent: 8.0,
      pricePerUnit: 35000,
      unit: 'liter',
      moisturePercent: 80,
      roleDescription: 'افزایش پایداری عصاره مایع و خاصیت کلات‌کنندگی عناصر برگی',
    },
  ],
  spent_coffee_substrate: [
    {
      id: 'mat-coffee',
      name: 'تفاله قهوه استریل‌شده',
      category: 'nitrogen',
      enabled: true,
      ratioPercent: 75.0,
      pricePerUnit: 2500,
      unit: 'kg',
      moisturePercent: 55,
      roleDescription: 'بستر اصلی کربن و نیتروژن لیگنوسلولزی قارچ و گیاهان اسیددوست',
    },
    {
      id: 'mat-straw',
      name: 'کلش گندم یا خاک‌اره راش خردشده',
      category: 'carbon',
      enabled: true,
      ratioPercent: 15.0,
      pricePerUnit: 2000,
      unit: 'kg',
      moisturePercent: 15,
      roleDescription: 'ساختار هوادهی اسکلتی برای تنفس میسلیوم و ریشه',
    },
    {
      id: 'mat-calcium',
      name: 'سولفات کلسیم (گچ کشاورزی) و کربنات کلسیم',
      category: 'mineral',
      enabled: true,
      ratioPercent: 6.0,
      pricePerUnit: 1800,
      unit: 'kg',
      moisturePercent: 1,
      roleDescription: 'تعدیل ساختار پفکی و تأمین کلسیم و گوگرد',
    },
    {
      id: 'mat-zeolite',
      name: 'زئولیت دانه‌ریز',
      category: 'mineral',
      enabled: true,
      ratioPercent: 4.0,
      pricePerUnit: 4200,
      unit: 'kg',
      moisturePercent: 5,
      roleDescription: 'نگهداشت رطوبت عمقی و ممانعت از ترشیدگی بی‌هوازی بستر',
    },
  ],
};

export const DEFAULT_RAW_MATERIALS = STANDARD_PRODUCT_FORMULAS.vermicompost;

export const DEFAULT_PERSONNEL: PersonnelMember[] = [
  {
    id: 'per-masoud',
    fullName: 'مسعود رادمهر',
    roleTitle: 'سرپرست واحد فرآوری و پیش‌کمپوست',
    unit: 'precompost',
    monthlySalary: 14000000,
    phone: '۰۹۱۲۰۰۰۰۰۰۱',
    isActive: true,
    hireDate: '۱۴۰۳/۰۱/۱۵',
    notes: 'مسئول ترکیب اولیه، اندازه‌گیری رطوبت، هوادهی دپو و تست زیستی کرم',
  },
  {
    id: 'per-mohammad',
    fullName: 'محمد کیانی',
    roleTitle: 'سرپرست واحد بستر و سرند دوار',
    unit: 'bed',
    monthlySalary: 14000000,
    phone: '۰۹۱۲۰۰۰۰۰۰۲',
    isActive: true,
    hireDate: '۱۴۰۳/۰۱/۱۵',
    notes: 'مسئول تغذیه لایه‌ای ۶ نوبت، مه‌پاشی و عملیات سرند ۲-۳ میلی‌متر',
  },
  {
    id: 'per-safari',
    fullName: 'مهندس صفری',
    roleTitle: 'مدیر ارشد فنی و زیست‌فناوری',
    unit: 'management',
    monthlySalary: 22000000,
    phone: '۰۹۱۲۰۰۰۰۰۰۳',
    isActive: true,
    hireDate: '۱۴۰۱/۰۶/۰۱',
    notes: 'نظارت بر فرمولاسیون، آنالیز EC/pH و صدور شناسنامه صادراتی',
  },
];

export const DEFAULT_SIGNATORIES: LabSignatories = {
  workshopName: 'گروه تولیدی و زیست فناوری مهندس صفری',
  precompostSupervisor: 'مسعود رادمهر',
  precompostTitle: 'سرپرست واحد فرآوری و پیش‌کمپوست',
  bedSupervisor: 'محمد کیانی',
  bedTitle: 'سرپرست واحد بستر و سرند دوار',
  technicalManager: 'مهندس صفری',
  technicalTitle: 'مدیر ارشد فنی و زیست‌فناوری',
  laboratoryName: 'آزمایشگاه تخصصی بیوتکنولوژی و تغذیه خاک مهندس صفری',
  standardCode: 'ISIRI 13724 / Bio-Grade-A',
};

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  targetOutputKg: 1000,
  productType: 'vermicompost',
  coffeeRatioPercent: 0,
  cowManureRatioPercent: 80.0,
  zeoliteRatioPercent: 5.0,
  calciumCarbonateRatioPercent: 2.5,
  moistureInputPercent: 65,
  moistureOutputPercent: 35,
  batchCode: 'VC-EXP-1405-SAFARI-01',
  startDate: getCurrentPersianDate(),

  rawMaterials: DEFAULT_RAW_MATERIALS,

  // Prices per kg/unit
  priceCowManurePerKg: 2500,
  priceCoffeePerKg: 2500,
  priceZeolitePerKg: 4200,
  priceCalciumCarbonatePerKg: 1800,
  priceMolassesPerLiter: 15000,
  costPackagingPerKg: 1500,
  costLaborEnergyPerKg: 0,

  // Logical Profit Margin & Selling Price
  targetProfitMarginPercent: 35,
  sellingPricePerKg: 24000,
  isCustomSellingPrice: false,
  currency: 'تومان',

  // Monthly Fixed Overhead
  monthlyFacilityRent: 10000000,
  monthlyUtilitiesAndMisc: 3500000,
  monthlyProductionCapacityKg: 2500,

  // Personnel list
  personnelList: DEFAULT_PERSONNEL,
};

export const PRODUCT_TYPES_INFO: Record<ProductType, {
  title: string;
  badge: string;
  conversionFactor: number;
  description: string;
  defaultMoistureOutput: number;
  recommendedMargin: number;
  standardCoffeeRatio: number;
}> = {
  vermicompost: {
    title: 'ورمیکمپوست درجه ۱ صادراتی و گلخانه‌ای',
    badge: 'تغذیه کرم خاکی ایزینیا فوتیدا',
    conversionFactor: 2.4, // ۲۴۰۰ کیلو ورودی به ۱۰۰۰ کیلو خروجی (افت ۵۸٪)
    description: 'کود زیستی چای‌مانند با ترشحات غدد کلسیم، غنی از اسید هیومیک و میکروارگانیسم‌های هوازی مفید',
    defaultMoistureOutput: 35,
    recommendedMargin: 35,
    standardCoffeeRatio: 0,
  },
  traditional_compost: {
    title: 'کود کمپوست سنتی غنی‌شده (ترموکود)',
    badge: 'فرآوری باکتریایی گرمادوست (فاقد کرم)',
    conversionFactor: 1.8, // ۱۸۰۰ کیلو ورودی به ۱۰۰۰ کیلو خروجی (افت ۴۴٪)
    description: 'تخمیر هوازی در دمای ۵۵ تا ۶۵ درجه جهت پوساندن ماده آلی، از بین بردن بذور علف هرز و پارازیت‌ها',
    defaultMoistureOutput: 30,
    recommendedMargin: 25,
    standardCoffeeRatio: 22.0,
  },
  worm_tea: {
    title: 'ورمی‌تی و عصاره مایع ورمیکمپوست (Worm Tea)',
    badge: 'عصاره زیستی بیولوژیک با هوادهی اکسیژن',
    conversionFactor: 1.2,
    description: 'عصاره مایع سرشار از فولویک اسید، هورمون‌های اکسین و سیتوکینین جهت محلول‌پاشی برگی و آبیاری قطره‌ای',
    defaultMoistureOutput: 95,
    recommendedMargin: 50,
    standardCoffeeRatio: 0,
  },
  spent_coffee_substrate: {
    title: 'بستر تخصصی بر پایه تفاله قهوه و اصلاح‌کننده‌ها',
    badge: 'فرمولاسیون اختصاصی قارچ و خاک اسیدی',
    conversionFactor: 1.5,
    description: 'بستر غنی از سلولز و لیگنین فرآوری‌شده با زئولیت و بافر کربنات کلسیم جهت پرورش قارچ یا گل‌های اسیددوست',
    defaultMoistureOutput: 45,
    recommendedMargin: 40,
    standardCoffeeRatio: 75.0,
  },
};

export const calculateFormulation = (config: BatchConfig): FormulationResult => {
  const target = Math.max(0, config.targetOutputKg);
  const pType = config.productType || 'vermicompost';
  const prodInfo = PRODUCT_TYPES_INFO[pType] || PRODUCT_TYPES_INFO.vermicompost;
  const conversionFactor = prodInfo.conversionFactor;

  // Raw feed needed
  const totalRawFeedKg = target > 0 ? Math.round(target * conversionFactor) : 0;
  const shrinkagePercent = totalRawFeedKg > 0 ? Math.round(((totalRawFeedKg - target) / totalRawFeedKg) * 100) : 0;

  // Retrieve materials list
  let rawList = (config.rawMaterials && config.rawMaterials.length > 0) 
    ? [...config.rawMaterials] 
    : [...(STANDARD_PRODUCT_FORMULAS[pType] || DEFAULT_RAW_MATERIALS)];

  // Active enabled materials
  const activeMaterials = rawList.filter(m => m.enabled);
  const totalActiveRatios = activeMaterials.reduce((acc, m) => acc + (m.ratioPercent || 0), 0);

  // Exact 100% dynamic re-normalization among active elements:
  // If an element is unselected, the remaining active elements scale up proportionately so their sum equals exactly 100%.
  const normalizedDivisor = totalActiveRatios > 0 ? totalActiveRatios : 1;

  let totalRawMaterialsCost = 0;
  const activeMaterialsBreakdown = activeMaterials.map(mat => {
    // Exact re-normalized percentage so sum of active items is 100%
    const normalizedRatio = totalActiveRatios > 0 
      ? (mat.ratioPercent / normalizedDivisor) * 100 
      : 0;
    
    const weightKg = totalRawFeedKg > 0 
      ? Math.round((totalRawFeedKg * normalizedRatio) / 100) 
      : 0;
    
    const price = mat.pricePerUnit || 0;
    const totalCost = Math.round(weightKg * price);
    totalRawMaterialsCost += totalCost;

    const unitCostPerKgFinished = target > 0 ? Math.round(totalCost / target) : 0;

    return {
      id: mat.id,
      name: mat.name,
      ratioPercent: Math.round(normalizedRatio * 100) / 100,
      weightKg,
      pricePerUnit: price,
      totalCost,
      unitCostPerKgFinished,
      unit: mat.unit,
    };
  });

  // Extract individual classic weights for stations
  const wormMat = activeMaterialsBreakdown.find(m => m.id === 'mat-worm' || m.name.includes('کرم'));
  const cowManureMat = activeMaterialsBreakdown.find(m => m.id === 'mat-compost' || m.id === 'mat-cow' || m.name.includes('کمپوست') || m.name.includes('گاوی'));
  const coffeeMat = activeMaterialsBreakdown.find(m => m.id === 'mat-coffee' || m.name.includes('قهوه'));
  const zeoliteMat = activeMaterialsBreakdown.find(m => m.id === 'mat-zeolite' || m.name.includes('زئولیت'));
  const calciumMat = activeMaterialsBreakdown.find(m => m.id === 'mat-calcium' || m.name.includes('کربنات'));
  const molassesMat = activeMaterialsBreakdown.find(m => m.id === 'mat-molasses' || m.name.includes('ملاس'));

  const cowManureKg = cowManureMat ? cowManureMat.weightKg : 0;
  const coffeeKg = coffeeMat ? coffeeMat.weightKg : 0;
  const zeoliteKg = zeoliteMat ? zeoliteMat.weightKg : 0;
  const calciumCarbonateKg = calciumMat ? calciumMat.weightKg : 0;
  const molassesLiters = molassesMat ? Math.round((molassesMat.weightKg * 0.75) * 10) / 10 : Math.round((totalRawFeedKg / 1000) * 3.5 * 10) / 10;

  const totalCowManureCost = cowManureMat ? cowManureMat.totalCost : 0;
  const totalCoffeeCost = coffeeMat ? coffeeMat.totalCost : 0;
  const totalZeoliteCost = zeoliteMat ? zeoliteMat.totalCost : 0;
  const totalCalciumCarbonateCost = calciumMat ? calciumMat.totalCost : 0;
  const totalMolassesCost = molassesMat ? molassesMat.totalCost : 0;

  // Worm biological needs (applicable mainly for vermicompost)
  const isVermicompost = pType === 'vermicompost';
  const wormBiomassKg = wormMat 
    ? wormMat.weightKg 
    : (isVermicompost && target > 0 ? Math.round((target / 1000) * 55 * 10) / 10 : 0);
  const wormCountApprox = Math.round(wormBiomassKg * 1000);
  const bedAreaM2 = isVermicompost && target > 0 ? Math.round((target / 1000) * 11 * 10) / 10 : 0;
  const bedHeightCm = 45;

  const feedingCycles = isVermicompost ? 6 : 1;
  const feedPerCycleKg = totalRawFeedKg > 0 ? Math.round(totalRawFeedKg / feedingCycles) : 0;
  const daysBetweenFeedings = isVermicompost ? 11 : 0;
  const totalDurationDays = isVermicompost ? 70 : 45;

  // Monthly Payroll Calculation from active personnel list
  const personnel = config.personnelList || DEFAULT_PERSONNEL;
  const activePersonnel = personnel.filter(p => p.isActive);
  const activePersonnelCount = activePersonnel.length;
  const monthlyLaborPayrollTotal = activePersonnel.reduce((sum, p) => sum + (p.monthlySalary || 0), 0);

  // Monthly Rent & Utilities
  const monthlyFacilityRent = config.monthlyFacilityRent ?? 10000000;
  const monthlyUtilitiesAndMisc = config.monthlyUtilitiesAndMisc ?? 3500000;
  const monthlyFixedOverheadTotal = monthlyLaborPayrollTotal + monthlyFacilityRent + monthlyUtilitiesAndMisc;

  // Allocation to per 1 kg finished product:
  // Formula: (Monthly Cost) / (Monthly Production Capacity in Kg)
  const monthlyCapacityKg = Math.max(1, config.monthlyProductionCapacityKg || 2500);

  const laborCostPerKgFinished = monthlyCapacityKg > 0 ? Math.round(monthlyLaborPayrollTotal / monthlyCapacityKg) : 0;
  const rentCostPerKgFinished = monthlyCapacityKg > 0 ? Math.round(monthlyFacilityRent / monthlyCapacityKg) : 0;
  const utilitiesCostPerKgFinished = monthlyCapacityKg > 0 ? Math.round(monthlyUtilitiesAndMisc / monthlyCapacityKg) : 0;
  const totalOverheadPerKgFinished = laborCostPerKgFinished + rentCostPerKgFinished + utilitiesCostPerKgFinished;

  // Batch specific overhead shares
  const totalBatchLaborCost = Math.round(target * laborCostPerKgFinished);
  const totalBatchRentCost = Math.round(target * rentCostPerKgFinished);
  const totalBatchUtilitiesCost = Math.round(target * utilitiesCostPerKgFinished);
  const totalBatchOverheadCost = totalBatchLaborCost + totalBatchRentCost + totalBatchUtilitiesCost;

  // Packaging
  const totalPackagingCost = target * (config.costPackagingPerKg || 0);
  const totalLaborEnergyCost = totalBatchOverheadCost;

  // Total Batch Production Cost
  const totalBatchProductionCost = totalRawMaterialsCost + totalPackagingCost + totalBatchOverheadCost;

  // Production Cost per kg finished
  const costPerKgFinished = target > 0 ? Math.round(totalBatchProductionCost / target) : 0;
  const rawFeedCostPerKgFinished = target > 0 ? Math.round(totalRawMaterialsCost / target) : 0;

  // Logical Profit Margin Suggestion
  const logicalMargin = config.targetProfitMarginPercent > 0 ? config.targetProfitMarginPercent : (prodInfo.recommendedMargin || 35);
  // Formula for selling price with target margin: Cost / (1 - (margin / 100))
  const suggestedSellingPricePerKg = costPerKgFinished > 0 
    ? Math.round(costPerKgFinished / (1 - (logicalMargin / 100))) 
    : 0;

  const suggestedRevenue = target * suggestedSellingPricePerKg;
  const suggestedGrossProfit = suggestedRevenue - totalBatchProductionCost;

  // Actual Selling Price (use user's price if customized, or suggested price)
  const actualSellingPrice = (config.isCustomSellingPrice && config.sellingPricePerKg > 0)
    ? config.sellingPricePerKg
    : (suggestedSellingPricePerKg > 0 ? suggestedSellingPricePerKg : config.sellingPricePerKg || 24000);

  const projectedRevenue = target * actualSellingPrice;
  const projectedGrossProfit = projectedRevenue - totalBatchProductionCost;
  const profitMarginPercent = projectedRevenue > 0 
    ? Math.round((projectedGrossProfit / projectedRevenue) * 100) 
    : 0;
  const breakEvenSellingPrice = costPerKgFinished;

  return {
    targetOutputKg: target,
    productType: pType,
    totalRawFeedKg,
    conversionFactor,
    shrinkagePercent,
    activeMaterialsBreakdown,

    cowManureKg,
    coffeeKg,
    zeoliteKg,
    calciumCarbonateKg,
    molassesLiters,
    wormBiomassKg,
    wormCountApprox,
    bedAreaM2,
    bedHeightCm,
    feedingCycles,
    feedPerCycleKg,
    daysBetweenFeedings,
    totalDurationDays,

    totalCowManureCost,
    totalCoffeeCost,
    totalZeoliteCost,
    totalCalciumCarbonateCost,
    totalMolassesCost,
    totalRawMaterialsCost,
    totalPackagingCost,
    totalLaborEnergyCost,

    activePersonnelCount,
    monthlyLaborPayrollTotal,
    monthlyFacilityRent,
    monthlyUtilitiesAndMisc,
    monthlyFixedOverheadTotal,

    laborCostPerKgFinished,
    rentCostPerKgFinished,
    utilitiesCostPerKgFinished,
    totalOverheadPerKgFinished,

    totalBatchLaborCost,
    totalBatchRentCost,
    totalBatchUtilitiesCost,
    totalBatchOverheadCost,

    totalBatchProductionCost,
    costPerKgFinished,
    rawFeedCostPerKgFinished,

    suggestedSellingPricePerKg,
    suggestedRevenue,
    suggestedGrossProfit,

    projectedRevenue,
    projectedGrossProfit,
    profitMarginPercent,
    breakEvenSellingPrice,
  };
};

export const TROUBLESHOOTING_CASES: TroubleCase[] = [
  {
    id: 'tr-01',
    category: 'ph',
    symptom: 'بوی ترشیدگی، اسیدی شدن بستر یا کلافه شدن کرم‌ها روی سطح',
    cause: 'اسیدیته بالای تفاله قهوه (pH زیر ۵.۵) ناشی از کمبود یا عدم اختلاط کامل پودر کربنات کلسیم در فاز مسعود.',
    remedy: 'سریعاً پودر کربنات کلسیم یا دولومیت میکرونیزه (به میزان ۱ کیلوگرم به ازای هر متر مربع بستر) را به صورت پاششی روی بستر پخش کرده و با چنگک بسیار آرام لایه سطحی را هوادهی کنید. آب‌پاشی سبک انجام دهید.',
    urgency: 'critical',
  },
  {
    id: 'tr-02',
    category: 'temperature',
    symptom: 'داغ کردن ناگهانی بستر (دمای بالای ۳۲ درجه سانتیگراد)',
    cause: 'ریختن خوراک در لایه ضخیم (بیش از ۷ سانتیمتر) یا تخلیه یکباره بار پیش‌کمپوست نشده که سبب شروع تخمیر حرارتی مجدد شده است.',
    remedy: 'فوراً لایه ضخیم را کنار زده و ضخامت را به زیر ۵ سانتیمتر برسانید. مه‌پاش خنک‌کننده را روشن کرده و گونی‌های کنفی خیس روی بستر بکشید. تغذیه بعدی را تا زمان خنک شدن کامل به تعویق بیندازید.',
    urgency: 'critical',
  },
  {
    id: 'tr-03',
    category: 'odor',
    symptom: 'استشمام بوی تند و سوزاننده آمونیاک',
    cause: 'تخمیر بی‌هوازی اوره و نیتروژن کود گاوی یا عدم مصرف زئولیت کافی برای به دام انداختن گاز آمونیوم.',
    remedy: 'پودر زئولیت کشاورزی با دانه شکری (۱ تا ۳ میلی‌متر) به بستر بیفزایید (۲ کیلوگرم در هر متر مربع). زئولیت گاز آمونیاک را فوراً مبادله یونی کرده و هوادهی بستر را بهبود می‌بخشد.',
    urgency: 'high',
  },
  {
    id: 'tr-04',
    category: 'sieving',
    symptom: 'کیپ شدن و گرفتگی توری سرند دوار (ترامپل) هنگام جداسازی',
    cause: 'رطوبت بالای ورمیکمپوست خام برداشتی (بیش از ۴۰٪) در زمان ورود به دستگاه سرند.',
    remedy: 'سرند کردن را متوقف کنید. توده را در سایه‌بان روی سلفون یا کف سیمانی با ضخامت ۱۰ سانتیمتر پهن کنید و روزی دو بار زیرورو کنید تا رطوبت آن با تبخیر طبیعی به ۳۰ تا ۳۵ درصد برسد، سپس سرند ۲ تا ۳ میلی‌متری را آغاز کنید.',
    urgency: 'medium',
  },
  {
    id: 'tr-05',
    category: 'moisture',
    symptom: 'فشردگی بیش از حد، خفگی لایه‌ها و چسبیدن تفاله قهوه به شکل خمیر',
    cause: 'بافت ریز تفاله قهوه بدون حضور ساختار اسکلتی کود گاوی و زئولیت، همراه با آبیاری با شلنگ پرفشار.',
    remedy: 'هرگز از شلنگ پرفشار استفاده نکنید؛ صرفاً از نازل مه‌پاش غبارساز استفاده شود. در فاز اختلاط مسعود، سهم کود گاوی خشبی نباید کمتر از ۶۵٪ باشد و زئولیت برای ایجاد منافذ هوا حیاتی است.',
    urgency: 'high',
  },
  {
    id: 'tr-06',
    category: 'moisture',
    symptom: 'تجمع کرم‌ها در گوشه‌های تاریک و تمایل به فرار از بستر',
    cause: 'نامساعد بودن همزمان رطوبت (زیر ۶۰٪ یا بالای ۸۰٪) یا غلظت بالای شوری (EC بالای ۳) به دلیل عدم شستشوی کود گاوی.',
    remedy: 'تست رطوبت با مشت انجام دهید: وقتی یک مشت فشرده می‌شود باید فقط ۱ تا ۲ قطره آب از لای انگشتان بچکد. زئولیت اضافه کنید تا شوری را تعدیل کند و شرایط دمایی را روی ۲۲ درجه تنظیم نمایید.',
    urgency: 'critical',
  },
];

export const GUARANTEED_LAB_SPECS = [
  {
    parameter: 'رنگ ظاهری و دانه بندی',
    symbol: 'Texture',
    target: 'سیاه دانه چای، بافت گرانوله پایدار',
    labValue: 'Granular Tea-Grain 100%',
    status: 'passed',
    note: 'حاصل غدد ترشحی کلسیم بدن ایزینیا فوتیدا',
  },
  {
    parameter: 'اسیدیته (واکنش خاک)',
    symbol: 'pH',
    target: '۶.۸ تا ۷.۴ (خنثی)',
    labValue: '۷.۱۵',
    status: 'passed',
    note: 'تثبیت‌شده با اثر بافری پودر کربنات کلسیم',
  },
  {
    parameter: 'هدایت الکتریکی (شوری)',
    symbol: 'EC',
    target: 'کمتر از ۲.۵ dS/m',
    labValue: '۱.۸۲ dS/m',
    status: 'passed',
    note: 'کاملاً ایمن برای ریشه نشاء و نهال‌های حساس به شوری',
  },
  {
    parameter: 'ماده آلی کل',
    symbol: 'OM',
    target: 'بیش از ۴۰ تا ۴۵ درصد',
    labValue: '۴۶.۸ %',
    status: 'passed',
    note: 'تأمین‌شده از کربن غنی تفاله قهوه',
  },
  {
    parameter: 'اسید هیومیک و فولویک',
    symbol: 'Humic Acid',
    target: '۵ تا ۸ درصد',
    labValue: '۶.۴ %',
    status: 'passed',
    note: 'محرک رشد فوق‌العاده ریشه و کلات‌کننده طبیعی عناصر',
  },
  {
    parameter: 'بذر علف هرز و نماتد زنده',
    symbol: 'Pathogens',
    target: 'صفر مطلق (غیرقابل ردیابی)',
    labValue: 'Zero (Negative)',
    status: 'passed',
    note: 'تثبیت‌شده در فاز دپوی ۵۵ درجه مسعود',
  },
  {
    parameter: 'رطوبت محصول سرند شده',
    symbol: 'Moisture',
    target: '۳۰ تا ۳۵ درصد',
    labValue: '۳۲.۵ %',
    status: 'passed',
    note: 'حفظ ماندگاری میکروارگانیسم‌های مفید بدون کیپ شدن',
  },
  {
    parameter: 'نسبت کربن به نیتروژن',
    symbol: 'C:N Ratio',
    target: '۱۲:۱ تا ۱۵:۱',
    labValue: '۱۳.۲:۱',
    status: 'passed',
    note: 'نشان‌دهنده بلوغ بیولوژیک کامل و پوسیدگی ارگانیک',
  },
];
