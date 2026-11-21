import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  ShoppingCart, 
  Truck, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  Percent, 
  Phone, 
  MapPin, 
  Printer, 
  Trash2, 
  Plus, 
  Minus, 
  Sprout, 
  TreePine, 
  Award, 
  ArrowRight, 
  Clock, 
  Star, 
  HelpCircle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  BadgeCheck,
  Check,
  Info,
  X
} from 'lucide-react';
import { BatchConfig, FormulationResult } from '../types/vermicompost';
import { StoreProduct, PackageOption, CartItem, CustomerOrder } from '../types/storefront';
import { getStoreProducts } from '../data/storefrontProducts';
import { getCurrentPersianDate } from '../data/vermicompostData';

interface StorefrontProps {
  config: BatchConfig;
  formulation: FormulationResult;
  onNavigateToAi: () => void;
  onNavigateToCalculator: () => void;
  onNavigateToCertificate: () => void;
}

export const Storefront: React.FC<StorefrontProps> = ({
  config,
  formulation,
  onNavigateToAi,
  onNavigateToCalculator,
  onNavigateToCertificate,
}) => {
  // Retrieve dynamic catalog based on current workshop selling price
  const products = useMemo(() => getStoreProducts(config.sellingPricePerKg), [config.sellingPricePerKg]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPackages, setSelectedPackages] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    products.forEach(p => {
      init[p.id] = p.packagingOptions[0]?.id || '';
    });
    return init;
  });

  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    products.forEach(p => {
      init[p.id] = 1;
    });
    return init;
  });

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [activeSpecProductId, setActiveSpecProductId] = useState<string | null>(null);

  // Quick Orchard Calculator State inside Store
  const [calcTreeCount, setCalcTreeCount] = useState<string>('100');
  const [calcCropType, setCalcCropType] = useState<'pistachio' | 'walnut' | 'citrus' | 'greenhouse'>('pistachio');
  const [isCalcAddedSuccess, setIsCalcAddedSuccess] = useState(false);

  // Order Form State
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [farmingType, setFarmingType] = useState<CustomerOrder['farmingType']>('orchard');
  const [deliveryMethod, setDeliveryMethod] = useState<CustomerOrder['deliveryMethod']>('freight_terminal');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderSubmitted, setOrderSubmitted] = useState<CustomerOrder | null>(null);

  // Filter products by category
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return products;
    return products.filter(p => p.category === selectedCategory);
  }, [products, selectedCategory]);

  // Handle package selection for a product
  const handleSelectPackage = (productId: string, packageId: string) => {
    setSelectedPackages(prev => ({ ...prev, [productId]: packageId }));
  };

  // Handle quantity change
  const handleQuantityChange = (productId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[productId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  // Add product to cart
  const handleAddToCart = (product: StoreProduct) => {
    const selectedPkgId = selectedPackages[product.id] || product.packagingOptions[0].id;
    const pkg = product.packagingOptions.find(p => p.id === selectedPkgId) || product.packagingOptions[0];
    const qty = quantities[product.id] || 1;
    const cartItemId = `${product.id}_${pkg.id}`;

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.id === cartItemId);
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx].quantity += qty;
        next[existingIdx].totalPrice = next[existingIdx].quantity * pkg.priceToman;
        return next;
      } else {
        const newItem: CartItem = {
          id: cartItemId,
          product,
          selectedPackage: pkg,
          quantity: qty,
          unitPrice: pkg.priceToman,
          totalPrice: qty * pkg.priceToman,
        };
        return [...prev, newItem];
      }
    });

    setIsCartOpen(true);
  };

  // Remove from cart
  const handleRemoveFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  // Update item quantity in cart
  const handleUpdateCartQuantity = (cartItemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === cartItemId) {
          const nextQty = Math.max(1, item.quantity + delta);
          return {
            ...item,
            quantity: nextQty,
            totalPrice: nextQty * item.unitPrice,
          };
        }
        return item;
      });
    });
  };

  // Totals Calculation
  const totalCartWeightKg = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.selectedPackage.nominalWeightKg * item.quantity), 0);
  }, [cart]);

  const subtotalCartToman = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [cart]);

  // Bulk Discount: 5% over 1,000 kg, 10% over 5,000 kg
  const bulkDiscountToman = useMemo(() => {
    if (totalCartWeightKg >= 5000) {
      return Math.round(subtotalCartToman * 0.10);
    }
    if (totalCartWeightKg >= 1000) {
      return Math.round(subtotalCartToman * 0.05);
    }
    return 0;
  }, [totalCartWeightKg, subtotalCartToman]);

  const finalPayableToman = Math.max(0, subtotalCartToman - bulkDiscountToman);

  // Quick Orchard Calculator Logic
  const calculatedDose = useMemo(() => {
    const count = parseInt(calcTreeCount) || 0;
    if (calcCropType === 'pistachio') {
      const kg = count * 6;
      return { kg, bags: Math.ceil(kg / 25), title: 'پسته بارده', dosePerTree: '۵ تا ۷ کیلوگرم' };
    }
    if (calcCropType === 'walnut') {
      const kg = count * 7;
      return { kg, bags: Math.ceil(kg / 25), title: 'گردو بارده', dosePerTree: '۷ تا ۸ کیلوگرم' };
    }
    if (calcCropType === 'citrus') {
      const kg = count * 5;
      return { kg, bags: Math.ceil(kg / 25), title: 'مرکبات', dosePerTree: '۴ تا ۶ کیلوگرم' };
    }
    // greenhouse
    const sqm = count;
    const kg = sqm * 4.5;
    return { kg, bags: Math.ceil(kg / 25), title: 'گلخانه صیفی', dosePerTree: '۴ تا ۵ کیلو در هر متر مربع' };
  }, [calcTreeCount, calcCropType]);

  const handleAddCalculatedToCart = () => {
    const vermiProduct = products.find(p => p.id === 'prod-vermicompost-grade-a');
    if (!vermiProduct) return;
    const pkg25 = vermiProduct.packagingOptions[0];
    const qty = calculatedDose.bags;

    const cartItemId = `${vermiProduct.id}_${pkg25.id}`;
    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.id === cartItemId);
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx].quantity += qty;
        next[existingIdx].totalPrice = next[existingIdx].quantity * pkg25.priceToman;
        return next;
      } else {
        return [...prev, {
          id: cartItemId,
          product: vermiProduct,
          selectedPackage: pkg25,
          quantity: qty,
          unitPrice: pkg25.priceToman,
          totalPrice: qty * pkg25.priceToman,
        }];
      }
    });

    setIsCalcAddedSuccess(true);
    setTimeout(() => setIsCalcAddedSuccess(false), 2500);
    setIsCartOpen(true);
  };

  // Submit Order
  const handleFinalSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phoneNumber || !deliveryAddress) {
      alert('لطفاً نام خریدار، شماره تماس و آدرس تحویل را تکمیل بفرمایید.');
      return;
    }

    const todayCompact = getCurrentPersianDate().replace(/\//g, '');
    const orderNumber = `ORD-${todayCompact}-${Math.floor(1000 + Math.random() * 9000)}`;
    const todayPersian = new Date().toLocaleDateString('fa-IR');
    const newOrder: CustomerOrder = {
      orderNumber,
      orderDate: todayPersian,
      customerName,
      phoneNumber,
      province,
      city,
      deliveryAddress,
      farmingType,
      deliveryMethod,
      items: [...cart],
      totalWeightKg: totalCartWeightKg,
      subtotalToman: subtotalCartToman,
      discountToman: bulkDiscountToman,
      shippingEstimateToman: 0,
      finalPayableToman,
      orderNotes,
      status: 'registered',
    };

    setOrderSubmitted(newOrder);
    setIsInvoiceModalOpen(true);
    setIsCartOpen(false);
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  return (
    <div className="space-y-10 text-right">
      
      {/* ========================================================================= */}
      {/* 1. HERO STORE BANNER & WORKSHOP PROMISE                                   */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-stone-900 to-emerald-950 text-white p-8 lg:p-12 border border-emerald-700/40 shadow-xl">
        <div className="relative z-10 max-w-4xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>عرضه مستقیم از کارگاه زیست‌فناوری مهندس صفری · بدون واسطه</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            فروشگاه تخصصی فرآورده‌های زیستی، ورمیکمپوست و اصلاح‌کننده‌های خاک
          </h1>

          <p className="text-sm sm:text-base text-stone-300 leading-relaxed max-w-3xl">
            تولید و تأمین مستقیم ورمیکمپوست گرید A صادراتی، کود کمپوست سنتی پاستوریزه، عصاره مایع ورمی‌تی و زئولیت کشاورزی با تضمین ۱۰۰٪ آنالیز استاندارد آزمایشگاهی ISIRI 13724. آماده بارگیری در بسته‌بندی کیسه‌ای و تناژ عمده کامیونی به سراسر کشور.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => {
                const catalogEl = document.getElementById('products-catalog');
                catalogEl?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-extrabold text-xs sm:text-sm transition-all shadow-lg flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>مشاهده و سفارش آنلاین محصولات</span>
            </button>

            <button
              onClick={onNavigateToAi}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs sm:text-sm font-semibold transition-all backdrop-blur-sm flex items-center gap-2"
            >
              <TreePine className="w-4 h-4 text-emerald-300" />
              <span>مشاوره تخصصی باغات و محاسبه دوز با AI</span>
            </button>

            <button
              onClick={onNavigateToCertificate}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs sm:text-sm font-semibold transition-all backdrop-blur-sm flex items-center gap-2"
            >
              <Award className="w-4 h-4 text-amber-300" />
              <span>مشاهده آنالیز و شناسنامه استاندارد</span>
            </button>
          </div>
        </div>

        {/* 4 Feature Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 mt-8 border-t border-white/10 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-400/20 text-emerald-300">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-stone-100">ارسال سریع کشوری</div>
              <div className="text-[11px] text-stone-400">کامیونی، خاور، وانت و باربری</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-400/20 text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-stone-100">تضمین کتبی آنالیز</div>
              <div className="text-[11px] text-stone-400">اسید هیومیک بالای ۶.۵٪ و عاری از بذر علف</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-400/20 text-emerald-300">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-stone-100">تخفیف ویژه تناژ</div>
              <div className="text-[11px] text-stone-400">۵٪ تخفیف بالای ۱ تن · ۱۰٪ بالای ۵ تن</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-400/20 text-emerald-300">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-stone-100">مشاوره فنی رایگان</div>
              <div className="text-[11px] text-stone-400">با مهندسین بیوتکنولوژی و خاک‌شناسی</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. QUICK ORCHARD & GREENHOUSE BUY CALCULATOR WIDGET                       */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-stone-900 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-6 lg:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <Calculator className="w-4 h-4" />
              <span>محاسبه‌گر سریع خرید متناسب با باغ یا گلخانه شما</span>
            </div>
            <h2 className="text-lg lg:text-xl font-extrabold text-stone-900 dark:text-stone-100">
              نمی‌دانید چند کیسه یا چند تن کود ورمیکمپوست نیاز دارید؟
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              تعداد درختان یا متراژ زمین خود را وارد کنید تا مقدار کیسه ۲۵ کیلویی و تناژ مورد نیاز به همراه دوز دقیق چالکود بلافاصله برآورد شود.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-stone-50 dark:bg-stone-800/60 p-4 rounded-xl border border-stone-200 dark:border-stone-700/60">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 mb-1">
                نوع کشت یا باغ
              </label>
              <select
                value={calcCropType}
                onChange={(e) => setCalcCropType(e.target.value as any)}
                className="px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-right"
              >
                <option value="pistachio">باغ پسته بارده (چالکود)</option>
                <option value="walnut">باغ گردو (چالکود)</option>
                <option value="citrus">مرکبات / پرتقال / لیمو</option>
                <option value="greenhouse">گلخانه صیفی‌جات (متراژ)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 mb-1">
                {calcCropType === 'greenhouse' ? 'متراژ گلخانه (m²)' : 'تعداد اصله درخت'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={calcTreeCount}
                onChange={(e) => {
                  const norm = e.target.value
                    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
                    .replace(/[^\d]/g, '');
                  if (!norm) {
                    setCalcTreeCount('0');
                  } else {
                    setCalcTreeCount(norm.replace(/^0+(?=\d)/, '') || '0');
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="w-28 px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold font-mono text-center"
              />
            </div>

            <div className="sm:border-r sm:border-stone-200 sm:dark:border-stone-700 sm:pr-4 flex flex-col justify-center">
              <div className="text-[11px] text-stone-500">پیشنهاد کارگاه:</div>
              <div className="text-sm font-extrabold text-emerald-800 dark:text-emerald-400 font-mono">
                {calculatedDose.bags.toLocaleString('fa-IR')} کیسه ۲۵kg
                <span className="text-[10px] text-stone-400 font-normal mr-1">({(calculatedDose.kg / 1000).toFixed(2)} تن)</span>
              </div>
            </div>

            <button
              onClick={handleAddCalculatedToCart}
              className={`px-4 py-2.5 rounded-lg text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs ${
                isCalcAddedSuccess ? 'bg-emerald-600' : 'bg-emerald-800 hover:bg-emerald-900'
              }`}
            >
              {isCalcAddedSuccess ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
              <span>{isCalcAddedSuccess ? 'به سبد اضافه شد!' : 'افزودن به سبد'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PRODUCT CATALOG HEADER & CATEGORY FILTER                               */}
      {/* ========================================================================= */}
      <div id="products-catalog" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
          <div>
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
              کاتالوگ جامع تولیدات کارگاه
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100">
              فرآورده‌های زیستی، کودهای پایه و مکمل‌های خاک مهندس صفری
            </h2>
          </div>

          {/* Cart Trigger Badge */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition-all shadow-md self-start sm:self-auto"
          >
            <div className="relative">
              <ShoppingCart className="w-4 h-4" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-amber-400 text-stone-950 text-[10px] font-black flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </div>
            <span>سبد خرید ({cart.length} قلم کالا)</span>
            {subtotalCartToman > 0 && (
              <span className="font-mono bg-emerald-900/80 px-2 py-0.5 rounded text-[11px]">
                {subtotalCartToman.toLocaleString('fa-IR')} ت
              </span>
            )}
          </button>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'همه محصولات (۶)' },
            { id: 'vermicompost', label: 'ورمیکمپوست درجه ۱' },
            { id: 'compost', label: 'کود کمپوست سنتی' },
            { id: 'liquid', label: 'ورمی‌تی مایع' },
            { id: 'mineral', label: 'زئولیت کشاورزی' },
            { id: 'substrate', label: 'بستر تفاله قهوه' },
            { id: 'starter', label: 'کرم خاکی زنده' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* 4. PRODUCTS GRID                                                          */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => {
            const selectedPkgId = selectedPackages[product.id] || product.packagingOptions[0].id;
            const currentPkg = product.packagingOptions.find(p => p.id === selectedPkgId) || product.packagingOptions[0];
            const qty = quantities[product.id] || 1;
            const isSpecOpen = activeSpecProductId === product.id;

            return (
              <div
                key={product.id}
                className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header & Badge */}
                  <div className="p-5 pb-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {product.categoryLabel}
                      </span>
                      {product.badge && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono">
                          {product.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100 leading-snug">
                      {product.name}
                    </h3>

                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 leading-relaxed line-clamp-2">
                      {product.tagline}
                    </p>
                  </div>

                  {/* Highlights Bullet points */}
                  <div className="px-5 py-2 space-y-1.5 text-xs text-stone-600 dark:text-stone-300 bg-stone-50/60 dark:bg-stone-800/30 border-y border-stone-100 dark:border-stone-800/80">
                    {product.highlights.slice(0, 3).map((hl, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-relaxed">{hl}</span>
                      </div>
                    ))}
                  </div>

                  {/* Packaging Options Selector */}
                  <div className="p-5 space-y-3">
                    <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                      انتخاب بسته‌بندی یا شیوه بارگیری:
                    </label>

                    <div className="space-y-1.5">
                      {product.packagingOptions.map(pkg => (
                        <label
                          key={pkg.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            currentPkg.id === pkg.id
                              ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 font-bold text-stone-900 dark:text-stone-100'
                              : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`pkg-${product.id}`}
                              checked={currentPkg.id === pkg.id}
                              onChange={() => handleSelectPackage(product.id, pkg.id)}
                              className="text-emerald-700 focus:ring-emerald-600"
                            />
                            <span className="text-xs">{pkg.title}</span>
                          </div>

                          <div className="flex items-center gap-1.5 font-mono text-left">
                            {pkg.discountToman ? (
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1 rounded">
                                {pkg.badge || 'تخفیف'}
                              </span>
                            ) : null}
                            <span className="text-emerald-800 dark:text-emerald-300 font-bold">
                              {pkg.priceToman.toLocaleString('fa-IR')} ت
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* Technical Specs Toggle Button */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setActiveSpecProductId(isSpecOpen ? null : product.id)}
                        className="text-[11px] text-stone-500 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors mt-1"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>مشاهده مشخصات فیزیکوشیمیایی و آنالیز</span>
                        {isSpecOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {isSpecOpen && (
                        <div className="mt-2.5 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-[11px] space-y-1.5 border border-stone-200 dark:border-stone-700">
                          {product.specs.map((sp, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="text-stone-500">{sp.label}:</span>
                              <span className="font-mono font-bold text-stone-800 dark:text-stone-200">{sp.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Quantity & Add to Cart */}
                <div className="p-5 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3 bg-stone-50/40 dark:bg-stone-900/40">
                  <div className="flex items-center gap-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(product.id, -1)}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-xs font-mono font-bold">
                      {qty.toLocaleString('fa-IR')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(product.id, 1)}
                      className="w-6 h-6 rounded flex items-center justify-center text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex-1 text-left">
                    <div className="text-[10px] text-stone-400 font-mono">مجموع:</div>
                    <div className="text-xs font-extrabold text-stone-900 dark:text-stone-100 font-mono">
                      {(currentPkg.priceToman * qty).toLocaleString('fa-IR')} تومان
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddToCart(product)}
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>خرید</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. SHOPPING CART & CHECKOUT DRAWER / MODAL                                */}
      {/* ========================================================================= */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white dark:bg-stone-900 w-full max-w-xl h-full shadow-2xl flex flex-col justify-between overflow-hidden text-right border-l border-stone-200 dark:border-stone-800">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                  سبد خرید شما ({cart.length} قلم کالا)
                </h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto text-stone-400">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <div className="font-bold text-sm text-stone-700 dark:text-stone-300">
                    سبد خرید شما در حال حاضر خالی است
                  </div>
                  <p className="text-xs text-stone-400 max-w-xs mx-auto">
                    از بین محصولات کاتالوگ بالا، بسته‌بندی مورد نظر خود را انتخاب و به سبد خرید اضافه فرمایید.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                            {item.product.name}
                          </div>
                          <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                            بسته‌بندی: {item.selectedPackage.title}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="text-stone-400 hover:text-red-600 transition-colors p-1"
                          title="حذف از سبد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-stone-200/60 dark:border-stone-700/60">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg p-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQuantity(item.id, -1)}
                            className="w-5 h-5 flex items-center justify-center text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-bold font-mono">
                            {item.quantity.toLocaleString('fa-IR')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQuantity(item.id, 1)}
                            className="w-5 h-5 flex items-center justify-center text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="font-mono text-left">
                          <span className="text-[10px] text-stone-400 block">قیمت کل:</span>
                          <span className="font-extrabold text-emerald-800 dark:text-emerald-400">
                            {item.totalPrice.toLocaleString('fa-IR')} تومان
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Customer Checkout Form */}
                  <form onSubmit={handleFinalSubmitOrder} className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-3">
                    <div className="font-bold text-xs text-stone-900 dark:text-stone-100 mb-2">
                      اطلاعات خریدار و آدرس تحویل بار:
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-stone-600 dark:text-stone-300 mb-1">نام خریدار / کارگاه / باغدار *</label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="مثلاً: علی وفایی"
                          className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-right"
                        />
                      </div>

                      <div>
                        <label className="block text-stone-600 dark:text-stone-300 mb-1">شماره تماس همراه *</label>
                        <input
                          type="tel"
                          required
                          dir="ltr"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                          className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-right font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-stone-600 dark:text-stone-300 mb-1">استان</label>
                        <input
                          type="text"
                          value={province}
                          onChange={(e) => setProvince(e.target.value)}
                          placeholder="مثلاً: کرمان / همدان / تهران"
                          className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-right"
                        />
                      </div>

                      <div>
                        <label className="block text-stone-600 dark:text-stone-300 mb-1">شهر / شهرستان</label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="مثلاً: رفسنجان / تویسرکان"
                          className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-right"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="block text-stone-600 dark:text-stone-300 mb-1">آدرس دقیق تحویل یا باربری *</label>
                      <textarea
                        required
                        rows={2}
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="آدرس دقیق باغ، گلخانه یا نام باربری مورد نظر جهت تحویل بار..."
                        className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-right"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-stone-600 dark:text-stone-300 mb-1">نوع کاربری</label>
                        <select
                          value={farmingType}
                          onChange={(e) => setFarmingType(e.target.value as any)}
                          className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-right"
                        >
                          <option value="orchard">باغ میوه (پسته، گردو، مرکبات)</option>
                          <option value="greenhouse">گلخانه صیفی و هیدروپونیک</option>
                          <option value="farming">زراعت و کشاورزی</option>
                          <option value="houseplants">گیاهان آپارتمانی و فضای سبز</option>
                          <option value="industrial">مصرف صنعتی و بازیافت</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-stone-600 dark:text-stone-300 mb-1">شیوه ارسال</label>
                        <select
                          value={deliveryMethod}
                          onChange={(e) => setDeliveryMethod(e.target.value as any)}
                          className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-right"
                        >
                          <option value="freight_terminal">ارسال با باربری بین‌شهری</option>
                          <option value="truck_dedicated">ارسال با کامیون دربستی (تناژ بالا)</option>
                          <option value="pickup_factory">تحویل حضوری درب کارگاه صفری</option>
                          <option value="courier">پست و تیپاکس (بسته‌های سبک)</option>
                        </select>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Drawer Footer: Total and Submit Button */}
            {cart.length > 0 && (
              <div className="p-5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/80 space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-stone-500">
                    <span>مجموع وزن بار:</span>
                    <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                      {totalCartWeightKg.toLocaleString('fa-IR')} کیلوگرم ({(totalCartWeightKg / 1000).toFixed(2)} تن)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-stone-500">
                    <span>جمع اقلام:</span>
                    <span className="font-mono text-stone-800 dark:text-stone-200">
                      {subtotalCartToman.toLocaleString('fa-IR')} تومان
                    </span>
                  </div>

                  {bulkDiscountToman > 0 && (
                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                      <span>تخفیف ویژه سفارش تناژ:</span>
                      <span className="font-mono">- {bulkDiscountToman.toLocaleString('fa-IR')} تومان</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm font-black text-stone-900 dark:text-stone-100 pt-2 border-t border-stone-200 dark:border-stone-700">
                    <span>مبلغ قابل پرداخت نهایی:</span>
                    <span className="font-mono text-emerald-800 dark:text-emerald-400 text-base">
                      {finalPayableToman.toLocaleString('fa-IR')} تومان
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFinalSubmitOrder}
                  className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>ثبت سفارش و صدور پیش‌فاکتور فروش</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PROFORMA INVOICE MODAL (صدور پیش‌فاکتور فروش)                          */}
      {/* ========================================================================= */}
      {isInvoiceModalOpen && orderSubmitted && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-stone-900 w-full max-w-3xl rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-right border border-stone-300">
            
            {/* Invoice Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-emerald-800">
              <div>
                <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-base">
                  <BadgeCheck className="w-5 h-5 text-emerald-700" />
                  <span>پیش‌فاکتور فروش محصولات زیستی و بیوکود</span>
                </div>
                <h2 className="text-xl font-black mt-1">
                  گروه تولیدی و زیست فناوری مهندس صفری
                </h2>
                <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                  استاندارد ملی ISIRI 13724 · کد ثبت بچ: {config.batchCode}
                </div>
              </div>

              <div className="text-left font-mono text-xs space-y-1">
                <div>شماره سفارش: <span className="font-bold">{orderSubmitted.orderNumber}</span></div>
                <div>تاریخ صدور: <span>{orderSubmitted.orderDate}</span></div>
                <div className="text-emerald-800 font-bold">وضعیت: ثبت اولیه و آماده ارسال</div>
              </div>
            </div>

            {/* Customer Details Block */}
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 text-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-stone-500 ml-1">نام و نام خانوادگی خریدار:</span>
                <span className="font-bold">{orderSubmitted.customerName}</span>
              </div>
              <div>
                <span className="text-stone-500 ml-1">شماره تماس:</span>
                <span className="font-mono font-bold">{orderSubmitted.phoneNumber}</span>
              </div>
              <div>
                <span className="text-stone-500 ml-1">استان و شهر:</span>
                <span>{orderSubmitted.province || '-'} / {orderSubmitted.city || '-'}</span>
              </div>
              <div>
                <span className="text-stone-500 ml-1">نوع کاربری:</span>
                <span>{orderSubmitted.farmingType}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-stone-500 ml-1">نشانی تحویل بار:</span>
                <span>{orderSubmitted.deliveryAddress}</span>
              </div>
            </div>

            {/* Invoice Table */}
            <div className="border border-stone-300 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-right">
                <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-300">
                  <tr>
                    <th className="p-2.5">ردیف</th>
                    <th className="p-2.5">شرح کالا / فرآورده</th>
                    <th className="p-2.5">بسته‌بندی</th>
                    <th className="p-2.5 text-center">تعداد</th>
                    <th className="p-2.5 text-left">قیمت واحد (تومان)</th>
                    <th className="p-2.5 text-left">مجموع (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-mono">
                  {orderSubmitted.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 text-stone-500">{idx + 1}</td>
                      <td className="p-2.5 font-bold font-sans">{item.product.name}</td>
                      <td className="p-2.5 font-sans">{item.selectedPackage.title}</td>
                      <td className="p-2.5 text-center font-bold">{item.quantity}</td>
                      <td className="p-2.5 text-left">{item.unitPrice.toLocaleString('fa-IR')}</td>
                      <td className="p-2.5 text-left font-bold">{item.totalPrice.toLocaleString('fa-IR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary in Invoice */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 text-xs pt-2">
              <div className="space-y-1 text-stone-500 max-w-sm">
                <div>• بارگیری از درب کارگاه «گروه تولیدی و زیست فناوری مهندس صفری».</div>
                <div>• این پیش‌فاکتور دارای ۴۸ ساعت اعتبار از زمان صدور می‌باشد.</div>
                <div>• شماره حساب و هماهنگی ارسال از طریق واحد فروش اطلاع‌رسانی می‌شود.</div>
              </div>

              <div className="w-full sm:w-64 space-y-1.5 font-mono text-xs bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                <div className="flex justify-between">
                  <span className="font-sans text-stone-600">جمع کل فاکتور:</span>
                  <span>{orderSubmitted.subtotalToman.toLocaleString('fa-IR')} ت</span>
                </div>
                {orderSubmitted.discountToman > 0 && (
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span className="font-sans">تخفیف تناژ:</span>
                    <span>- {orderSubmitted.discountToman.toLocaleString('fa-IR')} ت</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-stone-900 pt-1.5 border-t border-emerald-300">
                  <span className="font-sans">مبلغ نهایی:</span>
                  <span className="text-emerald-900">{orderSubmitted.finalPayableToman.toLocaleString('fa-IR')} ت</span>
                </div>
              </div>
            </div>

            {/* Signatures & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200 no-print">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintInvoice}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ / ذخیره PDF پیش‌فاکتور</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-bold"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. CUSTOMER TESTIMONIALS & SUCCESS CASES                                  */}
      {/* ========================================================================= */}
      <div className="bg-stone-50 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 lg:p-8 space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
            اعتماد کشاورزان و باغداران نمونه
          </div>
          <h3 className="text-xl font-extrabold text-stone-900 dark:text-stone-100">
            تجربه موفق مصرف‌کنندگان فرآورده‌های زیستی مهندس صفری
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 space-y-2">
            <div className="flex items-center gap-1 text-amber-500">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
            </div>
            <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
              «برای ۱۵ هکتار پسته در رفسنجان از ورمیکمپوست و زئولیت صفری استفاده کردیم. شوری خاک تعدیل شد و درصد پوکی پسته بیش از ۴۰ درصد کاهش پیدا کرد.»
            </p>
            <div className="font-bold text-stone-800 dark:text-stone-200 pt-1 border-t border-stone-100 dark:border-stone-800">
              مهندس ابراهیمی · باغدار پسته رفسنجان
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 space-y-2">
            <div className="flex items-center gap-1 text-amber-500">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
            </div>
            <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
              «ورمی‌تی مایع صفری رو در ۲ نوبت محلول‌پاشی کردیم. مغز گردوها کاملاً سفید و پر شد و از سرمای دیررس بهاره هم هیچ آسیبی ندیدیم.»
            </p>
            <div className="font-bold text-stone-800 dark:text-stone-200 pt-1 border-t border-stone-100 dark:border-stone-800">
              حاج رضا مرادی · گردوکار تویسرکان
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 space-y-2">
            <div className="flex items-center gap-1 text-amber-500">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
            </div>
            <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
              «در گلخانه گوجه‌فرنگی صادراتی با ورمیکمپوست صفری پوسیدگی گلگاه به صفر رسید و ماندگاری میوه در سردخانه فوق‌العاده شد.»
            </p>
            <div className="font-bold text-stone-800 dark:text-stone-200 pt-1 border-t border-stone-100 dark:border-stone-800">
              دکتر معتمدی · گلخانه‌دار ورامین
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
