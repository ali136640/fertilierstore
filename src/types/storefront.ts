export interface PackageOption {
  id: string;
  title: string;
  weightOrVolume: string; // e.g. "۲۵ کیلوگرم" or "۲۰ لیتر"
  nominalWeightKg: number;
  priceToman: number;
  originalPriceToman?: number; // reference price from baseUnitPriceToman * nominalWeightKg
  discountToman?: number;
  discountPercent?: number; // percentage discount calculated against unit price
  badge?: string;
  isPopular?: boolean;
  isOutOfStock?: boolean;
}

export interface StoreProduct {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  tagline: string;
  description: string;
  highlights: string[];
  specs: {
    label: string;
    value: string;
  }[];
  packagingOptions: PackageOption[];
  badge?: string;
  rating: number;
  reviewCount: number;
  deliveryTimeDays: string;
  colorScheme: 'emerald' | 'amber' | 'blue' | 'purple' | 'stone';
  // Unit-price based discount configuration
  baseUnitPriceToman?: number;
  baseUnitLabel?: string; // e.g. "کیلوگرم" or "لیتر"
  // Media, Voice & Visibility Fields
  imageUrl?: string;
  voiceIntroText?: string;
  voiceUpdatedAt?: string;
  isDisabled?: boolean;
  // Admin & Inventory Fields
  inStock: boolean;
  stockQuantity: number; // e.g. in bags or kg
  stockUnit: string; // e.g. "کیسه" or "تن" or "گالن"
  minOrderQuantity?: number;
  isCustomProduct?: boolean;
  isDeleted?: boolean;
}

export interface VoiceClip {
  id: string;
  kind: 'product' | 'tip' | 'weather';
  targetId: string;
  scriptText: string;
  audioBase64: string;
  mimeType: string;
  updatedAt: string;
  updatedAtMs?: number;
}

export interface PendingCloudSyncFlags {
  settings: boolean;
  products: boolean;
  workshop: boolean;
  lastModifiedFa?: string;
}

export interface CartItem {
  id: string; // unique item id in cart (product.id + package.id)
  product: StoreProduct;
  selectedPackage: PackageOption;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type OrderStatus = 
  | 'registered'       // در انتظار بررسی
  | 'confirmed'        // تایید و صدور پیش‌فاکتور
  | 'processing'       // در حال آماده‌سازی و بارگیری
  | 'shipped'          // تحویل باربری / راننده
  | 'delivered'        // تحویل نهایی مشتری
  | 'cancelled';       // لغو شده

export interface CustomerOrder {
  orderNumber: string;
  orderDate: string;
  customerId?: string;
  customerName: string;
  phoneNumber: string;
  province: string;
  city: string;
  deliveryAddress: string;
  farmingType: 'orchard' | 'greenhouse' | 'farming' | 'houseplants' | 'industrial';
  deliveryMethod: 'freight_terminal' | 'truck_dedicated' | 'pickup_factory' | 'courier';
  items: CartItem[];
  totalWeightKg: number;
  subtotalToman: number;
  discountToman: number;
  shippingEstimateToman: number;
  finalPayableToman: number;
  orderNotes?: string;
  status: OrderStatus;
  statusHistory?: {
    status: OrderStatus;
    timestamp: string;
    note?: string;
  }[];
  adminNotes?: string;
  trackingNumber?: string;
  updatedAt?: string;
  updatedAtMs?: number;
}

export interface UserAccount {
  id: string;
  username?: string;
  phoneNumber: string;
  password: string;
  fullName: string;
  role: 'customer' | 'admin';
  province?: string;
  city?: string;
  address?: string;
  farmingType?: string;
  telegramLinked?: boolean;
  telegramUserId?: string;
  telegramUsername?: string;
  telegramFullName?: string;
  createdAt: string;
  updatedAtMs?: number;
}

export interface WorkshopStoreSettings {
  workshopName: string;
  appTagline?: string;
  appLogoDataUrl?: string;
  pwaAppName?: string;
  pwaAppIconDataUrl?: string;
  useLogoAsInvoiceSeal?: boolean;
  enableInvoiceSeal?: boolean;
  invoiceSealMode?: 'text_stamp' | 'custom_image' | 'logo';
  invoiceSealImageDataUrl?: string;
  invoiceSealTitle?: string;
  invoiceSealSubtitle?: string;
  invoiceSealCode?: string;
  invoiceSealColor?: string;
  trustBadgeMode?: 'app_logo' | 'custom_image' | 'invoice_seal';
  trustBadgeImageDataUrl?: string;
  trustBadgeTitle?: string;
  managerFullName?: string;
  managerTitle?: string;
  managerPhone?: string;
  managerEmail?: string;
  managerLicenseCode?: string;
  managerProvince?: string;
  managerCity?: string;
  managerProvinceCity?: string;
  managerAddress?: string;
  managerBioNote?: string;
  supportPhone: string;
  salesAdvisorName?: string;
  agronomistName: string;
  agronomistPhone: string;
  agronomistTitle: string;
  workshopAddress?: string;
  workingHours?: string;
  adminUsername: string;
  adminPassword: string;
  minOrderNotice: string;
  storeHeroBadgeText?: string;
  paymentCardNumber?: string;
  paymentIban?: string;
  paymentCardHolder?: string;
  paymentBankName?: string;
  paymentTermsNotice?: string;
  invoiceFooterNote?: string;
  shippingSmallFee?: number;
  shippingMediumBaseFee?: number;
  shippingTonFee?: number;
  freeShippingThresholdToman?: number;
  enableCalculator?: boolean;
  showStockCountToCustomers?: boolean;
  coreAppVersion?: string;
  coreUpdateSummary?: string;
  githubPagesEnabled?: boolean;
  githubOwner?: string;
  githubRepo?: string;
  githubBranch?: string;
  githubCustomDomain?: string;
  githubApiBaseUrl?: string;
  telegramWebAppUrl?: string;
  lastSyncedAt: string;
  autoRealtimeSync: boolean;
  updatedAt?: string;
  updatedAtMs?: number;
}

export type PlantCategory = 'orchard' | 'houseplants' | 'greenhouse' | 'farming';

export interface PlantProfile {
  id: string;
  name: string;
  aliases: string[];
  category: PlantCategory;
  categoryLabel: string;
  popular?: boolean;
  scientificDose: {
    // For orchards / trees
    vermiKgPerUnit?: number;
    compostKgPerUnit?: number;
    zeoliteKgPerUnit?: number;
    liquidTeaLiterPerUnit?: number;
    substrateKgPerUnit?: number;
    unitLabel: string; // e.g. "اصله درخت" or "گلدان متوسط" or "متر مربع"
    instructions: string;
    bestMonthsFa: string;
    comboStrategy: 'combo_all' | 'vermi_only' | 'houseplant_trio' | 'greenhouse_spray';
  };
}
