export type ProductType = 
  | 'vermicompost' // ورمیکمپوست درجه ۱ صادراتی
  | 'traditional_compost' // کمپوست سنتی پوسیده گاوی/گیاهی
  | 'worm_tea' // چای کمپوست و عصاره مایع ورمی‌تی
  | 'spent_coffee_substrate'; // بستر تخصصی تفاله قهوه قارچ و گیاهان اسیددوست

export interface CustomRawMaterial {
  id: string;
  name: string;
  category: 'carbon' | 'nitrogen' | 'mineral' | 'starter' | 'additive';
  enabled: boolean;
  ratioPercent: number; // درصد در توده
  pricePerUnit: number; // قیمت هر واحد (تومان)
  unit: 'kg' | 'liter';
  moisturePercent: number; // درصد رطوبت ورودی
  roleDescription: string;
}

export interface PersonnelMember {
  id: string;
  fullName: string;
  roleTitle: string; // سمت
  unit: 'precompost' | 'bed' | 'lab' | 'packaging' | 'management' | 'other';
  monthlySalary: number; // حقوق ماهانه به تومان
  phone?: string;
  isActive: boolean;
  hireDate?: string;
  notes?: string;
}

export interface BatchConfig {
  targetOutputKg: number; // e.g. 1000 kg
  productType: ProductType; // ورمیکمپوست یا کمپوست معمولی یا ...
  
  // Ratios (0-100%)
  coffeeRatioPercent: number; // default 28.33%, can now be 0 to 100%
  cowManureRatioPercent: number;
  zeoliteRatioPercent: number;
  calciumCarbonateRatioPercent: number;
  moistureInputPercent: number;
  moistureOutputPercent: number;
  batchCode: string;
  startDate: string;

  // Custom Raw Materials list with toggle enabled/disabled
  rawMaterials: CustomRawMaterial[];

  // Pricing inputs
  priceCowManurePerKg: number;
  priceCoffeePerKg: number;
  priceZeolitePerKg: number;
  priceCalciumCarbonatePerKg: number;
  priceMolassesPerLiter: number;
  costPackagingPerKg: number;
  costLaborEnergyPerKg: number;
  
  // Profit Margin & Selling Price
  targetProfitMarginPercent: number; // e.g. 35% منطقی
  sellingPricePerKg: number; // can be overridden by user
  isCustomSellingPrice: boolean; // if true, user typed a price; if false, uses suggested price
  currency: 'تومان' | 'ریال';

  // Monthly Overhead
  monthlyFacilityRent: number;
  monthlyUtilitiesAndMisc: number; // قبوض و مصارف جاری ماهانه
  monthlyProductionCapacityKg: number;
  
  // Dynamic Personnel List
  personnelList: PersonnelMember[];
}

export interface FormulationResult {
  targetOutputKg: number;
  productType: ProductType;
  totalRawFeedKg: number;
  conversionFactor: number;
  shrinkagePercent: number;

  // Calculated weights of active materials
  activeMaterialsBreakdown: {
    id: string;
    name: string;
    ratioPercent: number;
    weightKg: number;
    pricePerUnit: number;
    totalCost: number;
    unitCostPerKgFinished: number;
    unit: string;
  }[];

  // Classic fields kept for compatibility
  cowManureKg: number;
  coffeeKg: number;
  zeoliteKg: number;
  calciumCarbonateKg: number;
  molassesLiters: number;
  wormBiomassKg: number;
  wormCountApprox: number;
  bedAreaM2: number;
  bedHeightCm: number;
  feedingCycles: number;
  feedPerCycleKg: number;
  daysBetweenFeedings: number;
  totalDurationDays: number;

  // Financial Outputs
  totalCowManureCost: number;
  totalCoffeeCost: number;
  totalZeoliteCost: number;
  totalCalciumCarbonateCost: number;
  totalMolassesCost: number;
  totalRawMaterialsCost: number;
  totalPackagingCost: number;
  totalLaborEnergyCost: number;

  // Monthly Overhead Allocation
  activePersonnelCount: number;
  monthlyLaborPayrollTotal: number;
  monthlyFacilityRent: number;
  monthlyUtilitiesAndMisc: number;
  monthlyFixedOverheadTotal: number;
  
  laborCostPerKgFinished: number;
  rentCostPerKgFinished: number;
  utilitiesCostPerKgFinished: number;
  totalOverheadPerKgFinished: number;
  
  totalBatchLaborCost: number;
  totalBatchRentCost: number;
  totalBatchUtilitiesCost: number;
  totalBatchOverheadCost: number;

  totalBatchProductionCost: number;
  costPerKgFinished: number;
  rawFeedCostPerKgFinished: number;
  
  // Suggested Selling Price based on target logical margin
  suggestedSellingPricePerKg: number;
  suggestedRevenue: number;
  suggestedGrossProfit: number;

  // Actual values using current sellingPricePerKg
  projectedRevenue: number;
  projectedGrossProfit: number;
  profitMarginPercent: number;
  breakEvenSellingPrice: number;
}

export interface BioassayChecklist {
  tempBelow25: boolean;
  odorClean: boolean;
  moistureTested: boolean;
  wormBioassay24h: boolean;
  operatorNotes: string;
  signedBy: string;
  isApproved: boolean;
  approvalDate?: string;
}

export interface FeedingCycleLog {
  cycleNumber: number;
  targetDay: number;
  feedKg: number;
  layerThicknessCm: number;
  isApplied: boolean;
  textureChecked: boolean;
  dateApplied?: string;
}

export interface TroubleCase {
  id: string;
  symptom: string;
  category: 'moisture' | 'ph' | 'temperature' | 'odor' | 'sieving';
  cause: string;
  remedy: string;
  urgency: 'high' | 'medium' | 'critical';
}

export interface LabSignatories {
  workshopName: string;
  precompostSupervisor: string;
  precompostTitle: string;
  bedSupervisor: string;
  bedTitle: string;
  technicalManager: string;
  technicalTitle: string;
  laboratoryName: string;
  standardCode: string;
}

export interface WorkshopAppState {
  config: BatchConfig;
  checklist: BioassayChecklist;
  cycles: FeedingCycleLog[];
  signatories: LabSignatories;
  lastUpdated: string;
}
