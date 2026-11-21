import React, { useState } from 'react';
import { 
  BatchConfig, 
  FormulationResult, 
  ProductType, 
  CustomRawMaterial 
} from '../types/vermicompost';
import { 
  getCurrentPersianDate, 
  PRODUCT_TYPES_INFO,
  STANDARD_PRODUCT_FORMULAS
} from '../data/vermicompostData';
import { 
  Calculator, 
  Layers, 
  Scale, 
  Calendar, 
  Droplet, 
  Sparkles,
  ArrowRight,
  Info,
  Coins,
  TrendingUp,
  DollarSign,
  PieChart,
  Percent,
  RotateCcw,
  Tag,
  Users,
  Home,
  Zap,
  Building2,
  Wallet,
  Briefcase,
  Plus,
  Trash2,
  Check,
  Package,
  CheckCircle2
} from 'lucide-react';

interface BatchCalculatorProps {
  config: BatchConfig;
  setConfig: React.Dispatch<React.SetStateAction<BatchConfig>>;
  formulation: FormulationResult;
  onNavigateToMasoud: () => void;
  onNavigateToMohammad: () => void;
  onOpenPersonnelModal: () => void;
}

export const BatchCalculator: React.FC<BatchCalculatorProps> = ({
  config,
  setConfig,
  formulation,
  onNavigateToMasoud,
  onNavigateToMohammad,
  onOpenPersonnelModal,
}) => {
  const quickPresets = [500, 1000, 2500, 5000, 10000];
  const monthlyCapacityPresets = [1000, 2500, 5000, 10000];

  // State for new material modal
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [newMatName, setNewMatName] = useState('');
  const [newMatRatio, setNewMatRatio] = useState('5');
  const [newMatPrice, setNewMatPrice] = useState('2000');
  const [newMatCategory, setNewMatCategory] = useState<CustomRawMaterial['category']>('carbon');

  // Input string state so user can clear inputs and type '0' smoothly
  const [strInputs, setStrInputs] = useState<Record<string, string>>({});

  const getInputValue = (key: string, numVal: number): string => {
    if (strInputs[key] !== undefined) return strInputs[key];
    return numVal !== undefined ? numVal.toString() : '0';
  };

  const handleTextNumberChange = (
    key: keyof BatchConfig | string, 
    rawVal: string, 
    isBatchProp = true
  ) => {
    // Record current raw typed string
    setStrInputs(prev => ({ ...prev, [key]: rawVal }));

    // Parse value
    const cleaned = rawVal.replace(/[^\d.]/g, '');
    const num = cleaned === '' ? 0 : parseFloat(cleaned);

    if (isBatchProp) {
      setConfig(prev => ({
        ...prev,
        [key]: isNaN(num) ? 0 : num,
      }));
    }
  };

  const handleBlurTextNumber = (key: string) => {
    setStrInputs(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Lock and unlock page scrolling when hovering over numeric inputs so mouse wheel only changes numbers
  const handleMouseEnterNumber = () => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  };

  const handleMouseLeaveNumber = () => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  };

  React.useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  // Support changing numeric values with mouse wheel scroll without scrolling the page
  const handleWheelStep = (
    e: React.WheelEvent<HTMLInputElement>,
    currentVal: number,
    step: number,
    onValueChange: (newVal: number) => void,
    min = 0,
    max?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? step : -step;
    let nextVal = Math.round((currentVal + delta) * 100) / 100;
    if (min !== undefined && nextVal < min) nextVal = min;
    if (max !== undefined && nextVal > max) nextVal = max;
    onValueChange(nextVal);
  };

  // Reset entire formula to standard defaults for current product
  const handleResetToStandardFormula = (pType?: ProductType) => {
    const targetType = pType || config.productType;
    const stdMaterials = STANDARD_PRODUCT_FORMULAS[targetType] || STANDARD_PRODUCT_FORMULAS.vermicompost;
    const stdInfo = PRODUCT_TYPES_INFO[targetType];
    const stdCoffee = stdInfo.standardCoffeeRatio;

    // Clear any string input cache
    setStrInputs({});

    setConfig(prev => ({
      ...prev,
      productType: targetType,
      coffeeRatioPercent: stdCoffee,
      rawMaterials: stdMaterials.map((m: CustomRawMaterial) => ({ ...m })),
      isCustomSellingPrice: false,
    }));
  };

  // Coffee percentage change (0% to 100%) with dynamic complementary balancing
  const handleCoffeeSliderOrNumber = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setConfig(prev => {
      const rawMats = prev.rawMaterials ? [...prev.rawMaterials] : [];
      const activeOtherMats = rawMats.filter(m => (m.id !== 'mat-coffee' && !m.name.includes('قهوه')) && m.enabled);

      let updatedMats: CustomRawMaterial[];

      if (activeOtherMats.length === 1) {
        // Exactly 2 active materials: one is clamped, the other is 100 - clamped
        const otherId = activeOtherMats[0].id;
        const otherVal = Math.max(0, Math.round((100 - clamped) * 100) / 100);
        updatedMats = rawMats.map(m => {
          if (m.id === 'mat-coffee' || m.name.includes('قهوه')) return { ...m, ratioPercent: clamped };
          if (m.id === otherId) return { ...m, ratioPercent: otherVal };
          return m;
        });
      } else if (activeOtherMats.length > 1) {
        const currentOtherTotal = activeOtherMats.reduce((sum, m) => sum + (m.ratioPercent || 0), 0);
        const neededOtherTotal = Math.max(0, 100 - clamped);

        updatedMats = rawMats.map(m => {
          if (m.id === 'mat-coffee' || m.name.includes('قهوه')) return { ...m, ratioPercent: clamped };
          if (m.enabled) {
            const share = currentOtherTotal > 0 ? (m.ratioPercent / currentOtherTotal) : (1 / activeOtherMats.length);
            const newShareVal = Math.max(0, Math.round((neededOtherTotal * share) * 100) / 100);
            return { ...m, ratioPercent: newShareVal };
          }
          return m;
        });
      } else {
        updatedMats = rawMats.map(m => (m.id === 'mat-coffee' || m.name.includes('قهوه')) ? { ...m, ratioPercent: clamped } : m);
      }

      const cowMat = updatedMats.find(m => m.id === 'mat-cow' || m.name.includes('گاوی'));

      return {
        ...prev,
        coffeeRatioPercent: clamped,
        cowManureRatioPercent: cowMat ? cowMat.ratioPercent : prev.cowManureRatioPercent,
        rawMaterials: updatedMats,
      };
    });

    // Clear stale input cache so updated complementary values render immediately
    setStrInputs(prev => {
      const next = { ...prev };
      delete next['coffeeRatioPercent'];
      for (const k of Object.keys(next)) {
        if (k.startsWith('mat-ratio-')) delete next[k];
      }
      return next;
    });
  };

  // Product Type Change - loads default standard formula for selected product
  const handleProductTypeChange = (pType: ProductType) => {
    handleResetToStandardFormula(pType);
  };

  // Reset only coffee percentage to standard for current product
  const handleResetCoffeeToStandard = () => {
    const stdCoffee = currentProduct.standardCoffeeRatio;
    handleCoffeeSliderOrNumber(stdCoffee);
  };

  // Toggle single raw material - automatically re-normalizes all active materials to 100% in their main input boxes
  const handleToggleMaterial = (matId: string) => {
    setConfig(prev => {
      const rawMats = prev.rawMaterials ? [...prev.rawMaterials] : [];
      const target = rawMats.find(m => m.id === matId);
      if (!target) return prev;
      const willBeEnabled = !target.enabled;

      let updated = rawMats.map(m => {
        if (m.id === matId) {
          return {
            ...m,
            enabled: willBeEnabled,
            ratioPercent: willBeEnabled ? (m.ratioPercent > 0 ? m.ratioPercent : 10) : 0,
          };
        }
        return m;
      });

      // Directly re-normalize all enabled materials so their sum in the main input boxes is exactly 100%
      const active = updated.filter(m => m.enabled);
      if (active.length > 0) {
        const totalRatio = active.reduce((acc, m) => acc + (m.ratioPercent || 0), 0);
        if (totalRatio > 0) {
          let runningTotal = 0;
          active.forEach((m, idx) => {
            const found = updated.find(x => x.id === m.id);
            if (!found) return;
            if (idx === active.length - 1) {
              found.ratioPercent = Math.max(0, Math.round((100 - runningTotal) * 100) / 100);
            } else {
              const val = Math.max(0, Math.round(((m.ratioPercent / totalRatio) * 100) * 100) / 100);
              runningTotal += val;
              found.ratioPercent = val;
            }
          });
        } else {
          const evenShare = Math.round((100 / active.length) * 100) / 100;
          active.forEach((m, idx) => {
            const found = updated.find(x => x.id === m.id);
            if (found) {
              found.ratioPercent = (idx === active.length - 1) 
                ? +(100 - evenShare * (active.length - 1)).toFixed(2)
                : evenShare;
            }
          });
        }
      }

      // Sync coffee ratio field if coffee material exists
      const coffeeMat = updated.find(m => m.id === 'mat-coffee' || m.name.includes('قهوه'));
      const cowMat = updated.find(m => m.id === 'mat-compost' || m.id === 'mat-cow' || m.name.includes('کمپوست') || m.name.includes('گاوی'));

      return {
        ...prev,
        coffeeRatioPercent: coffeeMat ? coffeeMat.ratioPercent : prev.coffeeRatioPercent,
        cowManureRatioPercent: cowMat ? cowMat.ratioPercent : prev.cowManureRatioPercent,
        rawMaterials: updated,
      };
    });

    // Clear string input cache so main input boxes directly update to the normalized percentages
    setStrInputs(prevStr => {
      const nextStr = { ...prevStr };
      for (const k of Object.keys(nextStr)) {
        if (k.startsWith('mat-ratio-')) delete nextStr[k];
      }
      delete nextStr['coffeeRatioPercent'];
      return nextStr;
    });
  };

  // Update material ratio or price with automatic complementary balancing
  const handleUpdateMaterial = (matId: string, field: 'ratioPercent' | 'pricePerUnit', val: number) => {
    setConfig(prev => {
      const rawMats = prev.rawMaterials ? [...prev.rawMaterials] : [];
      if (field === 'pricePerUnit') {
        const updated = rawMats.map(m => m.id === matId ? { ...m, pricePerUnit: Math.max(0, val) } : m);
        return { ...prev, rawMaterials: updated };
      }

      // Ratio percentage change: rebalance complementary materials so sum stays exactly 100%
      const clampedVal = Math.max(0, Math.min(100, val));
      const targetMat = rawMats.find(m => m.id === matId);
      if (!targetMat) return prev;

      const activeOtherMats = rawMats.filter(m => m.id !== matId && m.enabled);
      
      let updatedMats: CustomRawMaterial[];

      if (activeOtherMats.length === 1) {
        // Exactly 2 active materials: user sets one to 65%, the other automatically becomes 35% in its main input box
        const otherId = activeOtherMats[0].id;
        const otherVal = Math.max(0, Math.round((100 - clampedVal) * 100) / 100);
        updatedMats = rawMats.map(m => {
          if (m.id === matId) return { ...m, ratioPercent: clampedVal };
          if (m.id === otherId) return { ...m, ratioPercent: otherVal };
          return m;
        });
      } else if (activeOtherMats.length > 1) {
        // Multiple active materials: distribute the difference proportionally among the other active materials
        const currentOtherTotal = activeOtherMats.reduce((sum, m) => sum + (m.ratioPercent || 0), 0);
        const neededOtherTotal = Math.max(0, 100 - clampedVal);

        let runningOther = 0;
        updatedMats = rawMats.map(m => {
          if (m.id === matId) return { ...m, ratioPercent: clampedVal };
          if (m.enabled) {
            const isLast = activeOtherMats[activeOtherMats.length - 1].id === m.id;
            let newShareVal: number;
            if (isLast) {
              newShareVal = Math.max(0, Math.round((neededOtherTotal - runningOther) * 100) / 100);
            } else {
              const share = currentOtherTotal > 0 ? (m.ratioPercent / currentOtherTotal) : (1 / activeOtherMats.length);
              newShareVal = Math.max(0, Math.round((neededOtherTotal * share) * 100) / 100);
              runningOther += newShareVal;
            }
            return { ...m, ratioPercent: newShareVal };
          }
          return m;
        });
      } else {
        // Only 1 material active
        updatedMats = rawMats.map(m => m.id === matId ? { ...m, ratioPercent: clampedVal } : m);
      }

      // Clear other material ratio inputs from strInputs so they immediately update visually
      setStrInputs(prevStr => {
        const nextStr = { ...prevStr };
        for (const k of Object.keys(nextStr)) {
          if (k.startsWith('mat-ratio-') && k !== `mat-ratio-${matId}`) {
            delete nextStr[k];
          }
        }
        delete nextStr['coffeeRatioPercent'];
        return nextStr;
      });

      // Sync coffee ratio field if coffee material was updated or balanced
      const coffeeMat = updatedMats.find(m => m.id === 'mat-coffee' || m.name.includes('قهوه'));
      const cowMat = updatedMats.find(m => m.id === 'mat-cow' || m.name.includes('گاوی'));

      return {
        ...prev,
        coffeeRatioPercent: coffeeMat ? coffeeMat.ratioPercent : prev.coffeeRatioPercent,
        cowManureRatioPercent: cowMat ? cowMat.ratioPercent : prev.cowManureRatioPercent,
        rawMaterials: updatedMats,
      };
    });
  };

  // Add new custom material
  const handleAddCustomMaterial = () => {
    if (!newMatName.trim()) return;
    const ratio = parseFloat(newMatRatio) || 0;
    const price = parseFloat(newMatPrice) || 0;

    const newMat: CustomRawMaterial = {
      id: `mat-custom-${Date.now()}`,
      name: newMatName.trim(),
      category: newMatCategory,
      enabled: true,
      ratioPercent: ratio,
      pricePerUnit: price,
      unit: 'kg',
      moisturePercent: 50,
      roleDescription: 'ماده اولیه سفارشی اضافه‌شده توسط کاربر',
    };

    setConfig(prev => ({
      ...prev,
      rawMaterials: [...(prev.rawMaterials || []), newMat],
    }));

    setNewMatName('');
    setIsAddingMaterial(false);
  };

  // Delete custom material
  const handleDeleteMaterial = (matId: string) => {
    setConfig(prev => ({
      ...prev,
      rawMaterials: (prev.rawMaterials || []).filter(m => m.id !== matId),
    }));
  };

  // Profit Margin change & Reset selling price to suggested
  const handleMarginChange = (marginPercent: number) => {
    setConfig(prev => ({
      ...prev,
      targetProfitMarginPercent: marginPercent,
      isCustomSellingPrice: false, // use suggested
    }));
  };

  const handleApplySuggestedSellingPrice = () => {
    setConfig(prev => ({
      ...prev,
      sellingPricePerKg: formulation.suggestedSellingPricePerKg,
      isCustomSellingPrice: false,
    }));
  };

  const handleManualSellingPriceChange = (priceVal: number) => {
    setConfig(prev => ({
      ...prev,
      sellingPricePerKg: priceVal,
      isCustomSellingPrice: true,
    }));
  };

  const currentProduct = PRODUCT_TYPES_INFO[config.productType] || PRODUCT_TYPES_INFO.vermicompost;

  return (
    <div className="space-y-8 text-right">
      
      {/* ========================================================================= */}
      {/* SECTION 1: Product Selection, Target Output & Batch Identification       */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 lg:p-8 space-y-6">
        
        {/* Header & Product Types */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-400 mb-1.5">
              <Sparkles className="w-4 h-4" />
              <span>سامانه هوشمند گروه تولیدی و زیست‌فناوری مهندس صفری</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-stone-900 dark:text-stone-50 tracking-tight">
              ماشین‌حساب فرمولاسیون، بهای تمام‌شده و تخصیص هزینه‌های ماهانه
            </h1>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-3xl">
              محاسبه دقیق افت بیولوژیک، امکان تنظیم تفاله قهوه تا ۱۰۰٪ با بافر کلسیم و زئولیت، تعیین فرمول با انتخاب تکی مواد اولیه، و سرشکن کردن حقوق پرسنل و اجاره سوله بر مبنای ظرفیت ماهانه.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              onClick={onNavigateToMasoud}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-lg text-xs font-semibold hover:bg-stone-800 transition-colors whitespace-nowrap shadow-xs"
            >
              <span>دستور کار واحد مسعود</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
            <button
              onClick={onNavigateToMohammad}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shadow-xs"
            >
              <span>دستور کار واحد محمد</span>
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Product Type Selector Tabs */}
        <div>
          <label className="block text-xs font-bold text-stone-900 dark:text-stone-100 mb-2.5">
            انتخاب نوع محصول فرآوری‌شده کارگاه:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(PRODUCT_TYPES_INFO) as ProductType[]).map((pKey) => {
              const pInfo = PRODUCT_TYPES_INFO[pKey];
              const isSelected = config.productType === pKey;
              return (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => handleProductTypeChange(pKey)}
                  className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-600/30 shadow-xs'
                      : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 bg-stone-50/50 dark:bg-stone-800/40 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span>{pInfo.title}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-stone-500 line-clamp-2">
                      {pInfo.description}
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-stone-500 pt-2 border-t border-stone-200/60 dark:border-stone-700/60">
                    <span>ضریب خوراک: {pInfo.conversionFactor}x</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{pInfo.badge}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Parameters Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          
          {/* Target Output */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-stone-900 dark:text-stone-100">
              هدف تولید محصول نهایی این بچ
            </label>
            <div className="relative">
              <input
                type="text"
                dir="rtl"
                value={getInputValue('targetOutputKg', config.targetOutputKg)}
                onChange={(e) => handleTextNumberChange('targetOutputKg', e.target.value)}
                onBlur={() => handleBlurTextNumber('targetOutputKg')}
                onMouseEnter={handleMouseEnterNumber}
                onMouseLeave={handleMouseLeaveNumber}
                onWheel={(e) => handleWheelStep(e, config.targetOutputKg, 50, (v) => handleTextNumberChange('targetOutputKg', v.toString()), 50)}
                title="امکان تغییر مقدار با اسکرول ماوس (Wheel Scroll)"
                className="w-full px-4 py-2.5 bg-stone-50 dark:bg-stone-800/60 border border-stone-300 dark:border-stone-700 rounded-lg text-lg font-bold font-mono text-stone-900 dark:text-stone-100 text-right focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <span className="absolute left-3 top-3 text-xs font-medium text-stone-400">کیلوگرم (Kg)</span>
            </div>
            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <span className="text-[11px] text-stone-400 ml-1">پیش‌فرض:</span>
              {quickPresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleTextNumberChange('targetOutputKg', preset.toString())}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded transition-colors ${
                    config.targetOutputKg === preset
                      ? 'bg-emerald-800 text-white font-bold'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                  }`}
                >
                  {preset.toLocaleString('fa-IR')}
                </button>
              ))}
            </div>
          </div>

          {/* Coffee Grounds Slider & Direct Number Input (0% to 100%) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-900 dark:text-stone-100">
              <div className="flex items-center gap-1.5">
                <span>درصد تفاله قهوه در فرمول (تا ۱۰۰٪)</span>
                {config.coffeeRatioPercent !== currentProduct.standardCoffeeRatio && (
                  <button
                    type="button"
                    onClick={handleResetCoffeeToStandard}
                    className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline font-sans font-medium flex items-center gap-0.5"
                    title="بازگشت به درصد استاندارد این محصول"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>استاندارد ({currentProduct.standardCoffeeRatio}٪)</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 font-mono text-emerald-800 dark:text-emerald-400 font-bold">
                <input
                  type="text"
                  dir="rtl"
                  value={getInputValue('coffeeRatioPercent', config.coffeeRatioPercent)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0;
                    handleCoffeeSliderOrNumber(val);
                    setStrInputs(prev => ({ ...prev, coffeeRatioPercent: e.target.value }));
                  }}
                  onBlur={() => handleBlurTextNumber('coffeeRatioPercent')}
                  onMouseEnter={handleMouseEnterNumber}
                  onMouseLeave={handleMouseLeaveNumber}
                  onWheel={(e) => handleWheelStep(e, config.coffeeRatioPercent, 1, (v) => handleCoffeeSliderOrNumber(v), 0, 100)}
                  title="تغییر با اسکرول ماوس (Wheel Scroll)"
                  className="w-14 px-1.5 py-0.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded text-center text-xs font-bold font-mono"
                />
                <span>٪</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={config.coffeeRatioPercent}
              onChange={(e) => handleCoffeeSliderOrNumber(parseFloat(e.target.value) || 0)}
              className="w-full accent-emerald-700 cursor-pointer h-2 bg-stone-200 dark:bg-stone-700 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-stone-400 font-mono">
              <span>۰٪ (فاقد قهوه)</span>
              <span className="text-emerald-700 font-bold">{currentProduct.standardCoffeeRatio}٪ (استاندارد {currentProduct.title.split(' ')[0]})</span>
              <span>۵۰٪</span>
              <span>۱۰۰٪ (بستر خالص)</span>
            </div>
            {config.coffeeRatioPercent > 35 && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-tight bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-900">
                * نکته بیولوژیک: به ازای تفاله بالای ۳۵٪، حتماً بافر کربنات کلسیم و زئولیت را فعال نگه دارید تا pH خنثی شده و رطوبت فشرده نشود.
              </p>
            )}
          </div>

          {/* Batch Code & Date */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-900 dark:text-stone-100">
              <label>کد رهگیری و تاریخ شروع بچ</label>
              <button
                type="button"
                onClick={() => setConfig(p => ({ ...p, startDate: getCurrentPersianDate() }))}
                className="text-[11px] text-emerald-800 dark:text-emerald-400 hover:underline flex items-center gap-1 font-sans"
              >
                <Calendar className="w-3 h-3" />
                <span>امروز سیستم</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="text"
                  dir="rtl"
                  value={config.batchCode}
                  onChange={(e) => setConfig(p => ({ ...p, batchCode: e.target.value }))}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800/60 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-right"
                  placeholder="کد محموله"
                />
              </div>
              <div>
                <input
                  type="text"
                  dir="rtl"
                  value={config.startDate}
                  onChange={(e) => setConfig(p => ({ ...p, startDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800/60 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-right"
                  placeholder="۱۴۰۵/۰۸/۱۸"
                />
              </div>
            </div>
            <div className="text-[11px] text-stone-500 flex items-center justify-between">
              <span>گروه تولیدی و زیستفناوری مهندس صفری</span>
              <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                افت فرآوری: {formulation.shrinkagePercent}٪
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: Dynamic Raw Materials Selection & Custom Materials Addition   */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 lg:p-8 space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-1">
              <Package className="w-4 h-4" />
              <span>انتخاب تکی مواد اولیه و افزودن مواد سفارشی کارگاهی</span>
            </div>
            <h2 className="text-lg font-extrabold text-stone-900 dark:text-stone-100">
              فرمول مواد اولیه و نهاده‌ها (فقط اقلام تیک‌خورده در فرمول و قیمت حساب می‌شوند)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleResetToStandardFormula()}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
              title="بارگذاری مجدد عناصر و درصدهای استاندارد این محصول"
            >
              <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
              <span>فرمول استاندارد {currentProduct.title.split(' ')[0]}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddingMaterial(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن ماده اولیه جدید</span>
            </button>
          </div>
        </div>

        {/* Synergistic Compost-to-Vermicompost integration banner */}
        <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-amber-50 to-emerald-50 dark:from-emerald-950/40 dark:via-amber-950/30 dark:to-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-stone-700 dark:text-stone-300 leading-relaxed">
              <span className="font-bold text-emerald-950 dark:text-emerald-200">هم‌افزایی زیستی کود کمپوست و ورمی‌کمپوست: </span>
              کود کمپوست سنتی کارگاه (ترکیب کود گاوی دامی ۷۰٪ + تفاله قهوه ۲۲٪ + زئولیت ۵٪ + کلسیم ۳٪) پس از طی فاز حرارتی ترموفیل (۵۵ تا ۶۵ درجه) و پاستوریزاسیون، مستقیماً به عنوان بستر پیش‌کمپوست آماده و ایمن جهت خوراک کرم‌های ورمیکمپوست مورد استفاده قرار می‌گیرد.
            </div>
          </div>
        </div>

        {/* Modal for adding custom material */}
        {isAddingMaterial && (
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-950 dark:text-emerald-200">
              <span>تعریف ماده اولیه یا افزودنی جدید کارگاه</span>
              <button
                type="button"
                onClick={() => setIsAddingMaterial(false)}
                className="text-stone-400 hover:text-stone-600 text-xs"
              >
                انصراف
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1 font-semibold">
                  نام ماده اولیه
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={newMatName}
                  onChange={(e) => setNewMatName(e.target.value)}
                  placeholder="مثلاً: کلش گندم خردشده"
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-right"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1 font-semibold">
                  درصد سهم در توده (٪)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={newMatRatio}
                  onChange={(e) => setNewMatRatio(e.target.value)}
                  placeholder="5"
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-right font-mono"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1 font-semibold">
                  قیمت هر کیلو (تومان)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={newMatPrice}
                  onChange={(e) => setNewMatPrice(e.target.value)}
                  placeholder="2000"
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-right font-mono"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1 font-semibold">
                  دسته‌بندی ماده
                </label>
                <select
                  value={newMatCategory}
                  onChange={(e) => setNewMatCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-right"
                >
                  <option value="carbon">کربنی / ساختاری</option>
                  <option value="nitrogen">نیتروژنی / محرک</option>
                  <option value="mineral">معدنی / زئولیت و بافر</option>
                  <option value="starter">استارتر / باکتریایی</option>
                  <option value="additive">افزودنی خاص</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleAddCustomMaterial}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg text-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>ثبت ماده در فرمولاسیون کارگاه</span>
              </button>
            </div>
          </div>
        )}

        {/* Raw Materials Grid with Individual Checkboxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(config.rawMaterials || []).map((mat) => {
            const isCustom = mat.id.startsWith('mat-custom');
            const breakdown = formulation.activeMaterialsBreakdown.find(m => m.id === mat.id);

            return (
              <div
                key={mat.id}
                className={`p-4 rounded-xl border transition-all text-right ${
                  mat.enabled
                    ? 'border-emerald-600/40 bg-white dark:bg-stone-900 shadow-xs'
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-stone-900 dark:text-stone-100">
                    <input
                      type="checkbox"
                      checked={mat.enabled}
                      onChange={() => handleToggleMaterial(mat.id)}
                      className="w-4 h-4 text-emerald-700 rounded focus:ring-emerald-600"
                    />
                    <span>{mat.name}</span>
                  </label>

                  <div className="flex items-center gap-1">
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMaterial(mat.id)}
                        className="p-1 text-stone-400 hover:text-red-600 rounded transition-colors"
                        title="حذف ماده سفارشی"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-mono">
                      {mat.category}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-stone-500 mb-3 min-h-[30px] line-clamp-2">
                  {mat.roleDescription}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 dark:border-stone-800 text-xs">
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-stone-400 mb-0.5">
                      <span>درصد سهم در توده</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        dir="rtl"
                        disabled={!mat.enabled}
                        value={getInputValue(`mat-ratio-${mat.id}`, mat.ratioPercent)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0;
                          handleUpdateMaterial(mat.id, 'ratioPercent', val);
                          setStrInputs(prev => ({ ...prev, [`mat-ratio-${mat.id}`]: e.target.value }));
                        }}
                        onBlur={() => handleBlurTextNumber(`mat-ratio-${mat.id}`)}
                        onMouseEnter={handleMouseEnterNumber}
                        onMouseLeave={handleMouseLeaveNumber}
                        onWheel={(e) => handleWheelStep(e, mat.ratioPercent, 0.5, (v) => handleUpdateMaterial(mat.id, 'ratioPercent', v), 0, 100)}
                        title="تغییر درصد با اسکرول ماوس (Wheel Scroll)"
                        className="w-full px-2 py-1 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded text-xs font-mono font-bold text-right"
                      />
                      <span className="absolute left-1.5 top-1 text-[10px] text-stone-400">٪</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-stone-400 mb-0.5">قیمت خرید (تومان/kg)</label>
                    <div className="relative">
                      <input
                        type="text"
                        dir="rtl"
                        disabled={!mat.enabled}
                        value={getInputValue(`mat-price-${mat.id}`, mat.pricePerUnit)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0;
                          handleUpdateMaterial(mat.id, 'pricePerUnit', val);
                          setStrInputs(prev => ({ ...prev, [`mat-price-${mat.id}`]: e.target.value }));
                        }}
                        onBlur={() => handleBlurTextNumber(`mat-price-${mat.id}`)}
                        onMouseEnter={handleMouseEnterNumber}
                        onMouseLeave={handleMouseLeaveNumber}
                        onWheel={(e) => handleWheelStep(e, mat.pricePerUnit, 100, (v) => handleUpdateMaterial(mat.id, 'pricePerUnit', v), 0)}
                        title="تغییر قیمت با اسکرول ماوس (Wheel Scroll)"
                        className="w-full px-2 py-1 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded text-xs font-mono font-bold text-right"
                      />
                      <span className="absolute left-1.5 top-1 text-[10px] text-stone-400">ت</span>
                    </div>
                  </div>
                </div>

                {mat.enabled && breakdown && (
                  <div className="mt-3 pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px] font-mono text-emerald-800 dark:text-emerald-400">
                    <span>مصرف در بچ: {breakdown.weightKg.toLocaleString('fa-IR')} {mat.unit} ({mat.ratioPercent}٪ توده)</span>
                    <span className="font-bold">{breakdown.totalCost.toLocaleString('fa-IR')} ت</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-stone-50 dark:bg-stone-800/40 rounded-xl text-xs text-stone-600 dark:text-stone-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>
              فرمول توده بر اساس <strong>{formulation.activeMaterialsBreakdown.length} ماده فعال</strong> بازتراز شده و مجموع سهم آن‌ها <strong>دقیقاً ۱۰۰٪</strong> است.
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-stone-400">مجموع خوراک خام ورودی:</span>
            <span className="font-bold text-stone-900 dark:text-stone-100 text-sm">
              {formulation.totalRawFeedKg.toLocaleString('fa-IR')} کیلوگرم
            </span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: Monthly Fixed Overhead, Personnel Payroll & Facility Rent      */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-stone-900 border-2 border-emerald-600/30 dark:border-emerald-500/20 rounded-xl p-6 lg:p-8 space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-1">
              <Users className="w-4 h-4" />
              <span>مدیریت پرسنل، اجاره سوله و تبدیل هزینه‌های ماهانه به هر کالا</span>
            </div>
            <h2 className="text-xl font-extrabold text-stone-900 dark:text-stone-100">
              سربار ثابت ماهانه کارگاه و تخصیص به ازای هر کیلوگرم محصول نهایی
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              پرسنل ماهیانه حقوق می‌گیرند و اجاره سوله و قبوض نیز ماهانه پرداخت می‌شوند. این مبالغ بر ظرفیت ماهانه تقسیم و به هر کیلوگرم محصول اضافه می‌شود.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenPersonnelModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-xs"
          >
            <Users className="w-4 h-4" />
            <span>مدیریت و ویرایش پرسنل ({formulation.activePersonnelCount} نفر فعال)</span>
          </button>
        </div>

        {/* 4 Monthly Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Monthly Labor Payroll Summary */}
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-950 dark:text-indigo-200">
              <span>مجموع حقوق ماهانه پرسنل</span>
              <button
                type="button"
                onClick={onOpenPersonnelModal}
                className="text-[10px] text-indigo-700 dark:text-indigo-400 hover:underline"
              >
                ویرایش
              </button>
            </div>
            <div className="text-xl font-extrabold font-mono text-indigo-900 dark:text-indigo-200">
              {formulation.monthlyLaborPayrollTotal.toLocaleString('fa-IR')}
              <span className="text-xs font-sans text-indigo-700 dark:text-indigo-400 mr-1.5 font-normal">تومان/ماه</span>
            </div>
            <div className="text-[10px] text-stone-500 font-mono">
              سهم در هر ۱ کیلو: {formulation.laborCostPerKgFinished.toLocaleString('fa-IR')} ت
            </div>
          </div>

          {/* Monthly Facility Rent */}
          <div className="p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800 space-y-1.5">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
              اجاره ماهانه مکان / سوله کارگاه
            </label>
            <div className="relative">
              <input
                type="text"
                dir="rtl"
                value={getInputValue('monthlyFacilityRent', config.monthlyFacilityRent)}
                onChange={(e) => handleTextNumberChange('monthlyFacilityRent', e.target.value)}
                onBlur={() => handleBlurTextNumber('monthlyFacilityRent')}
                onMouseEnter={handleMouseEnterNumber}
                onMouseLeave={handleMouseLeaveNumber}
                onWheel={(e) => handleWheelStep(e, config.monthlyFacilityRent, 500000, (v) => handleTextNumberChange('monthlyFacilityRent', v.toString()), 0)}
                title="امکان تغییر مقدار با اسکرول ماوس (Wheel Scroll)"
                className="w-full px-3 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-sm font-mono font-bold text-stone-900 dark:text-stone-100 text-right"
              />
              <span className="absolute left-2.5 top-2 text-[10px] text-stone-400 font-sans">تومان/ماه</span>
            </div>
            <div className="text-[10px] text-stone-500 font-mono">
              سهم در هر ۱ کیلو: {formulation.rentCostPerKgFinished.toLocaleString('fa-IR')} ت
            </div>
          </div>

          {/* Monthly Utilities */}
          <div className="p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800 space-y-1.5">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
              قبوض و مصارف جاری ماهانه (آب، برق، گاز)
            </label>
            <div className="relative">
              <input
                type="text"
                dir="rtl"
                value={getInputValue('monthlyUtilitiesAndMisc', config.monthlyUtilitiesAndMisc)}
                onChange={(e) => handleTextNumberChange('monthlyUtilitiesAndMisc', e.target.value)}
                onBlur={() => handleBlurTextNumber('monthlyUtilitiesAndMisc')}
                onMouseEnter={handleMouseEnterNumber}
                onMouseLeave={handleMouseLeaveNumber}
                onWheel={(e) => handleWheelStep(e, config.monthlyUtilitiesAndMisc, 250000, (v) => handleTextNumberChange('monthlyUtilitiesAndMisc', v.toString()), 0)}
                title="امکان تغییر مقدار با اسکرول ماوس (Wheel Scroll)"
                className="w-full px-3 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-sm font-mono font-bold text-stone-900 dark:text-stone-100 text-right"
              />
              <span className="absolute left-2.5 top-2 text-[10px] text-stone-400 font-sans">تومان/ماه</span>
            </div>
            <div className="text-[10px] text-stone-500 font-mono">
              سهم در هر ۱ کیلو: {formulation.utilitiesCostPerKgFinished.toLocaleString('fa-IR')} ت
            </div>
          </div>

          {/* Monthly Production Capacity */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-300 dark:border-emerald-800 space-y-1.5">
            <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
              ظرفیت تولید ماهانه کارگاه (مبنای سرشکن)
            </label>
            <div className="relative">
              <input
                type="text"
                dir="rtl"
                value={getInputValue('monthlyProductionCapacityKg', config.monthlyProductionCapacityKg)}
                onChange={(e) => handleTextNumberChange('monthlyProductionCapacityKg', e.target.value)}
                onBlur={() => handleBlurTextNumber('monthlyProductionCapacityKg')}
                onMouseEnter={handleMouseEnterNumber}
                onMouseLeave={handleMouseLeaveNumber}
                onWheel={(e) => handleWheelStep(e, config.monthlyProductionCapacityKg, 250, (v) => handleTextNumberChange('monthlyProductionCapacityKg', v.toString()), 100)}
                title="امکان تغییر مقدار با اسکرول ماوس (Wheel Scroll)"
                className="w-full px-3 py-1.5 bg-white dark:bg-stone-900 border border-emerald-400 dark:border-emerald-700 rounded-lg text-sm font-mono font-extrabold text-emerald-900 dark:text-emerald-200 text-right"
              />
              <span className="absolute left-2.5 top-2 text-[10px] text-emerald-700 dark:text-emerald-400 font-sans">kg/ماه</span>
            </div>
            <div className="flex gap-1 pt-0.5 text-[9px] font-mono">
              {monthlyCapacityPresets.map(preset => (
                <button
                  key={preset}
                  onClick={() => handleTextNumberChange('monthlyProductionCapacityKg', preset.toString())}
                  className={`px-1.5 py-0.2 rounded ${
                    config.monthlyProductionCapacityKg === preset
                      ? 'bg-emerald-800 text-white'
                      : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300'
                  }`}
                >
                  {preset.toLocaleString('fa-IR')}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: Final Unit Cost, Suggested Logical Selling Price & Profit      */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-800 rounded-xl p-6 lg:p-8 space-y-6">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span>پیشنهاد قیمت فروش بر اساس حاشیه سود منطقی</span>
            </div>
            <h2 className="text-xl font-extrabold text-stone-900 dark:text-stone-100">
              قیمت‌گذاری بر مبنای سود منطقی و تحلیل سودآوری بچ
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              سامانه همواره قیمت فروش را با حاشیه سود منطقی ({config.targetProfitMarginPercent}٪) پیشنهاد می‌دهد؛ شما می‌توانید قیمت پیشنهادی را اعمال کرده یا مستقیماً قیمت دلخواه خود را تایپ نمایید.
            </p>
          </div>

          {/* Quick margin selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400">حاشیه سود:</span>
            {[20, 30, 35, 45, 50].map((margin) => (
              <button
                key={margin}
                onClick={() => handleMarginChange(margin)}
                className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-colors ${
                  config.targetProfitMarginPercent === margin
                    ? 'bg-emerald-800 text-white font-bold'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                }`}
              >
                {margin}٪
              </button>
            ))}
          </div>
        </div>

        {/* 4 Financial Key Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Cost Per 1 Kg Finished Product */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl p-5">
            <div className="text-xs text-emerald-800 dark:text-emerald-300 font-bold mb-1">
              بهای تمام‌شده هر ۱ kg محصول نهایی
            </div>
            <div className="text-2xl lg:text-3xl font-extrabold font-mono text-emerald-900 dark:text-emerald-200">
              {formulation.costPerKgFinished.toLocaleString('fa-IR')}
              <span className="text-xs font-sans text-emerald-700 dark:text-emerald-400 mr-1.5 font-normal">تومان/kg</span>
            </div>
            <div className="mt-2 text-[11px] text-emerald-800 dark:text-emerald-400 font-mono">
              مواد اولیه: {formulation.rawFeedCostPerKgFinished.toLocaleString('fa-IR')} ت · سربار: {formulation.totalOverheadPerKgFinished.toLocaleString('fa-IR')} ت
            </div>
          </div>

          {/* Card 2: Suggested Rational Selling Price */}
          <div className="bg-stone-50 dark:bg-stone-800/40 border border-stone-300 dark:border-stone-700 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs text-stone-700 dark:text-stone-300 font-bold mb-1">
              <span>قیمت پیشنهادی با سود {config.targetProfitMarginPercent}٪</span>
              <button
                type="button"
                onClick={handleApplySuggestedSellingPrice}
                className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline font-bold"
              >
                اعمال پیشنهاد
              </button>
            </div>
            <div className="text-2xl lg:text-3xl font-extrabold font-mono text-stone-900 dark:text-stone-100">
              {formulation.suggestedSellingPricePerKg.toLocaleString('fa-IR')}
              <span className="text-xs font-sans text-stone-400 mr-1.5 font-normal">تومان/kg</span>
            </div>
            <div className="mt-2 text-[11px] text-stone-500 font-mono">
              سود هر کیلو: {(formulation.suggestedSellingPricePerKg - formulation.costPerKgFinished).toLocaleString('fa-IR')} تومان
            </div>
          </div>

          {/* Card 3: Actual Selling Price Input (Editable with Reset to Suggested & onWheel) */}
          <div className="bg-white dark:bg-stone-900 border-2 border-emerald-500 rounded-xl p-5 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-950 dark:text-emerald-200">
              <span className="flex items-center gap-1">
                <span>قیمت فروش اعمال‌شده</span>
                {config.isCustomSellingPrice && (
                  <button
                    type="button"
                    onClick={handleApplySuggestedSellingPrice}
                    className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5 font-normal mr-1"
                    title="بازنشانی قیمت فروش به مقدار پیشنهادی سیستم"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>بازنشانی به پیشنهادی</span>
                  </button>
                )}
              </span>
              {config.isCustomSellingPrice ? (
                <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded font-mono">
                  تنظیم دستی
                </span>
              ) : (
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                  سود پیشنهادی {config.targetProfitMarginPercent}٪
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                dir="rtl"
                value={getInputValue('sellingPricePerKg', config.sellingPricePerKg)}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^\d.]/g, '');
                  const num = cleaned === '' ? 0 : parseFloat(cleaned);
                  handleManualSellingPriceChange(num);
                  setStrInputs(prev => ({ ...prev, sellingPricePerKg: e.target.value }));
                }}
                onBlur={() => handleBlurTextNumber('sellingPricePerKg')}
                onMouseEnter={handleMouseEnterNumber}
                onMouseLeave={handleMouseLeaveNumber}
                onWheel={(e) => handleWheelStep(e, config.sellingPricePerKg, 500, (v) => handleManualSellingPriceChange(v), 1000)}
                title="تغییر قیمت فروش با اسکرول ماوس (Wheel Scroll)"
                className="w-full px-2 py-1 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-xl font-mono font-extrabold text-stone-900 dark:text-stone-100 text-right"
              />
              <span className="absolute left-2 top-2 text-xs text-stone-400 font-sans">تومان</span>
            </div>
            <div className="text-[10px] text-stone-400 font-mono flex items-center justify-between">
              <span>فروش بچ: {formulation.projectedRevenue.toLocaleString('fa-IR')} ت</span>
              {config.isCustomSellingPrice && (
                <button
                  type="button"
                  onClick={handleApplySuggestedSellingPrice}
                  className="text-emerald-700 dark:text-emerald-400 hover:underline text-[10px]"
                >
                  بازنشانی
                </button>
              )}
            </div>
          </div>

          {/* Card 4: Profit Margin & Net Profit */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5">
            <div className="text-xs text-stone-500 dark:text-stone-400 font-medium mb-1">
              سود ناخالص کل این بچ
            </div>
            <div className="text-2xl lg:text-3xl font-extrabold font-mono text-emerald-800 dark:text-emerald-400">
              {formulation.projectedGrossProfit.toLocaleString('fa-IR')}
              <span className="text-xs font-sans text-stone-400 mr-1.5 font-normal">تومان</span>
            </div>
            <div className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold font-mono">
              حاشیه سود: {formulation.profitMarginPercent}٪ (سر‌به‌سر: {formulation.breakEvenSellingPrice.toLocaleString('fa-IR')} ت)
            </div>
          </div>

        </div>

        {/* Detailed Breakdown Table */}
        <div className="overflow-x-auto pt-4">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-700">
                <th className="px-4 py-3">قلم هزینه و نهاده</th>
                <th className="px-4 py-3">مقدار مصرف این بچ</th>
                <th className="px-4 py-3">کل هزینه بچ</th>
                <th className="px-4 py-3">هزینه در ۱ kg محصول</th>
                <th className="px-4 py-3">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-sans">
              {formulation.activeMaterialsBreakdown.map((mat) => (
                <tr key={mat.id} className="hover:bg-stone-50/50">
                  <td className="px-4 py-3 font-bold text-stone-900 dark:text-stone-100">{mat.name}</td>
                  <td className="px-4 py-3 font-mono text-stone-600 dark:text-stone-400">
                    {mat.weightKg.toLocaleString('fa-IR')} {mat.unit} ({mat.ratioPercent}٪)
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-stone-900 dark:text-stone-100">
                    {mat.totalCost.toLocaleString('fa-IR')} تومان
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                    {mat.unitCostPerKgFinished.toLocaleString('fa-IR')} ت
                  </td>
                  <td className="px-4 py-3 text-emerald-700 text-[10px]">تایید شده در فرمول</td>
                </tr>
              ))}

              <tr className="bg-indigo-50/40 dark:bg-indigo-950/20">
                <td className="px-4 py-3 font-bold text-indigo-950 dark:text-indigo-200">
                  سهم حقوق ماهانه پرسنل ({formulation.activePersonnelCount} نفر)
                </td>
                <td className="px-4 py-3 font-mono text-stone-500">
                  تسهیم بر {config.monthlyProductionCapacityKg.toLocaleString('fa-IR')} kg ماهانه
                </td>
                <td className="px-4 py-3 font-mono font-bold text-indigo-900 dark:text-indigo-300">
                  {formulation.totalBatchLaborCost.toLocaleString('fa-IR')} تومان
                </td>
                <td className="px-4 py-3 font-mono font-bold text-indigo-800 dark:text-indigo-400">
                  {formulation.laborCostPerKgFinished.toLocaleString('fa-IR')} ت
                </td>
                <td className="px-4 py-3 text-indigo-700 text-[10px]">حقوق ماهانه کارگران</td>
              </tr>

              <tr className="bg-purple-50/40 dark:bg-purple-950/20">
                <td className="px-4 py-3 font-bold text-purple-950 dark:text-purple-200">
                  سهم اجاره ماهانه مکان و سوله
                </td>
                <td className="px-4 py-3 font-mono text-stone-500">
                  تسهیم بر {config.monthlyProductionCapacityKg.toLocaleString('fa-IR')} kg ماهانه
                </td>
                <td className="px-4 py-3 font-mono font-bold text-purple-900 dark:text-purple-300">
                  {formulation.totalBatchRentCost.toLocaleString('fa-IR')} تومان
                </td>
                <td className="px-4 py-3 font-mono font-bold text-purple-800 dark:text-purple-400">
                  {formulation.rentCostPerKgFinished.toLocaleString('fa-IR')} ت
                </td>
                <td className="px-4 py-3 text-purple-700 text-[10px]">اجاره مکان کارگاه</td>
              </tr>

              <tr className="bg-teal-50/40 dark:bg-teal-950/20">
                <td className="px-4 py-3 font-bold text-teal-950 dark:text-teal-200">
                  سهم قبوض آب، برق، گاز و استهلاک
                </td>
                <td className="px-4 py-3 font-mono text-stone-500">
                  تسهیم بر {config.monthlyProductionCapacityKg.toLocaleString('fa-IR')} kg ماهانه
                </td>
                <td className="px-4 py-3 font-mono font-bold text-teal-900 dark:text-teal-300">
                  {formulation.totalBatchUtilitiesCost.toLocaleString('fa-IR')} تومان
                </td>
                <td className="px-4 py-3 font-mono font-bold text-teal-800 dark:text-teal-400">
                  {formulation.utilitiesCostPerKgFinished.toLocaleString('fa-IR')} ت
                </td>
                <td className="px-4 py-3 text-teal-700 text-[10px]">انرژی و استهلاک</td>
              </tr>

              <tr className="bg-stone-100 dark:bg-stone-800/80 font-bold text-stone-900 dark:text-stone-100 text-sm">
                <td className="px-4 py-3.5">جمع کل بهای تمام‌شده و سود نهایی</td>
                <td className="px-4 py-3.5 font-mono text-xs">
                  {formulation.targetOutputKg.toLocaleString('fa-IR')} kg ({currentProduct.title})
                </td>
                <td className="px-4 py-3.5 font-mono text-emerald-800 dark:text-emerald-400">
                  {formulation.totalBatchProductionCost.toLocaleString('fa-IR')} تومان
                </td>
                <td className="px-4 py-3.5 font-mono text-emerald-800 dark:text-emerald-400">
                  {formulation.costPerKgFinished.toLocaleString('fa-IR')} ت/kg
                </td>
                <td className="px-4 py-3.5 text-xs text-stone-600 dark:text-stone-300">
                  سود هر کیلو: {(config.sellingPricePerKg - formulation.costPerKgFinished).toLocaleString('fa-IR')} ت
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
