import React, { useState } from 'react';
import { GUARANTEED_LAB_SPECS } from '../data/vermicompostData';
import { BatchConfig, FormulationResult, LabSignatories } from '../types/vermicompost';
import { 
  FileText, 
  Printer, 
  CheckCircle2, 
  ShieldCheck, 
  Award,
  Sparkles,
  Barcode,
  Edit3,
  Check,
  RotateCcw,
  Building,
  UserCheck
} from 'lucide-react';

interface LabCertificateProps {
  config: BatchConfig;
  formulation: FormulationResult;
  signatories: LabSignatories;
  setSignatories: React.Dispatch<React.SetStateAction<LabSignatories>>;
  onPrint: () => void;
}

export const LabCertificate: React.FC<LabCertificateProps> = ({
  config,
  formulation,
  signatories,
  setSignatories,
  onPrint,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tempSignatories, setTempSignatories] = useState<LabSignatories>(signatories);

  const handleOpenEdit = () => {
    setTempSignatories(signatories);
    setIsEditModalOpen(true);
  };

  const handleSaveSignatories = () => {
    setSignatories(tempSignatories);
    setIsEditModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Action Header (hidden in print) */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-400 mb-1">
            <Award className="w-4 h-4" />
            <span>گواهینامه کنترل کیفیت بیولوژیک و صادرات</span>
          </div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            شناسنامه آنالیز آزمایشگاهی ورمیکمپوست درجه ۱ گلخانه‌ای
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            واحد تولیدی: <span className="font-semibold text-stone-800 dark:text-stone-200">{signatories.workshopName}</span> · تاریخ صدور: <span className="font-mono">{config.startDate}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenEdit}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>تغییر نام مسئولین و کارگاه</span>
          </button>

          <button
            onClick={onPrint}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ / ذخیره نسخه چاپی PDF</span>
          </button>
        </div>
      </div>

      {/* Edit Signatories Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl p-6 text-right space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  ویرایش مشخصات مسئولین امضا و واحد تولیدی
                </h3>
              </div>
              <span className="text-[11px] text-stone-400">ذخیره دائمی در مرورگر</span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  نام کارگاه یا شرکت تولیدی
                </label>
                <input
                  type="text"
                  value={tempSignatories.workshopName}
                  onChange={(e) => setTempSignatories(p => ({ ...p, workshopName: e.target.value }))}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    نام مسئول واحد پیش‌کمپوست
                  </label>
                  <input
                    type="text"
                    value={tempSignatories.precompostSupervisor}
                    onChange={(e) => setTempSignatories(p => ({ ...p, precompostSupervisor: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                    placeholder="مثلاً: مسعود رادمهر"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    سمت سازمانی مسئول پیش‌کمپوست
                  </label>
                  <input
                    type="text"
                    value={tempSignatories.precompostTitle}
                    onChange={(e) => setTempSignatories(p => ({ ...p, precompostTitle: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    نام مسئول واحد بستر و سرند
                  </label>
                  <input
                    type="text"
                    value={tempSignatories.bedSupervisor}
                    onChange={(e) => setTempSignatories(p => ({ ...p, bedSupervisor: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                    placeholder="مثلاً: محمد کیانی"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    سمت سازمانی مسئول بستر
                  </label>
                  <input
                    type="text"
                    value={tempSignatories.bedTitle}
                    onChange={(e) => setTempSignatories(p => ({ ...p, bedTitle: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    نام مسئول فنی / تاییدکننده آزمایشگاه
                  </label>
                  <input
                    type="text"
                    value={tempSignatories.technicalManager}
                    onChange={(e) => setTempSignatories(p => ({ ...p, technicalManager: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 font-bold"
                    placeholder="مثلاً: دکتر علی وفایی"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    سمت مسئول فنی آزمایشگاه
                  </label>
                  <input
                    type="text"
                    value={tempSignatories.technicalTitle}
                    onChange={(e) => setTempSignatories(p => ({ ...p, technicalTitle: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    نام آزمایشگاه همکار
                  </label>
                  <input
                    type="text"
                    value={tempSignatories.laboratoryName}
                    onChange={(e) => setTempSignatories(p => ({ ...p, laboratoryName: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    کد استاندارد / شماره مجوز
                  </label>
                  <input
                    type="text"
                    value={tempSignatories.standardCode}
                    onChange={(e) => setTempSignatories(p => ({ ...p, standardCode: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 font-mono text-left dir-ltr"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-xs font-semibold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveSignatories}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>ذخیره در برگه آزمایش و حافظه سیستم</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Formal Certificate Card */}
      <div className="bg-white text-stone-900 border-2 border-stone-300 dark:border-stone-700 rounded-xl p-8 lg:p-12 shadow-sm relative overflow-hidden font-sans print:border-none print:shadow-none print:p-0">
        
        {/* Certificate Watermark Stamp */}
        <div className="absolute left-8 top-8 opacity-10 pointer-events-none select-none">
          <Award className="w-48 h-48 text-emerald-900" />
        </div>

        {/* Certificate Header */}
        <div className="border-b-2 border-stone-900 pb-6 mb-8 text-center relative">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-4">
            <span className="font-mono">کد استاندارد: {signatories.standardCode}</span>
            <span className="font-mono">شماره سریال: CERT-{config.batchCode}-EXP</span>
            <span className="font-mono">تاریخ صدور: {config.startDate}</span>
          </div>

          <div className="text-xs font-bold text-emerald-900 mb-1">
            {signatories.workshopName}
          </div>

          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            برگه شناسنامه آنالیز تضمینی ورمیکمپوست «درجه ۱ صادراتی و گلخانه‌ای»
          </h2>
          <p className="text-xs text-stone-600 mt-2 font-medium">
            تولیدشده در بستر کنترل‌شده کرم قرمز ایزینیا فوتیدا (*Eisenia fetida*) با رژیم اصلاحی کلسیم-زئولیت
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-4 text-xs font-mono text-stone-700">
            <div>
              <strong>کد محموله (Batch):</strong> {config.batchCode}
            </div>
            <div>
              <strong>وزن خالص محموله:</strong> {formulation.targetOutputKg.toLocaleString('fa-IR')} کیلوگرم
            </div>
            <div>
              <strong>دانه‌بندی سرند:</strong> مش ۲ تا ۳ میلی‌متر (چای‌مانند)
            </div>
          </div>
        </div>

        {/* Visual Inspection Card with High-Res Grain Image */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-4 rounded-xl bg-stone-50 border border-stone-200">
          <div className="relative h-36 md:h-full rounded-lg overflow-hidden border border-stone-300 bg-stone-900">
            <img
              src="/src/assets/images/vermicompost_tea_grain_1794139169301.jpg"
              alt="بافت دانه چای سیاه ورمیکمپوست درجه ۱"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
              <span className="text-white text-[11px] font-bold">بافت گرانوله چای‌مانند (Macro 10x)</span>
            </div>
          </div>

          <div className="md:col-span-2 space-y-2.5 text-xs text-stone-700">
            <div className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-800" />
              <span>نتیجه بازرسی فیزیکی و بیولوژیک ارگانولپتیک:</span>
            </div>
            <p className="leading-relaxed text-[11px] text-stone-600">
              نمونه کاملاً همگن و فاقد هرگونه ذرات درشت کود عمل‌نیامده یا پوسته‌های قهوه زبر است. فرآیند هضم کرم‌ها با ترشح کلسیم منجر به تشکیل گرانول‌های آب‌پایدار پایدار شده است. محصول عاری از بوی کود، ترشیدگی یا گاز متان بوده و دارای رایحه مطبوع ژئوسمین (خاک مرطوب جنگلی) است.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
              <div className="p-2 bg-white rounded border border-stone-200">
                <span className="text-stone-500 block">رنگ و بافت:</span>
                <strong className="text-stone-900">سیاه دانه چای گرانوله</strong>
              </div>
              <div className="p-2 bg-white rounded border border-stone-200">
                <span className="text-stone-500 block">شاخص بهداشت حرارتی:</span>
                <strong className="text-emerald-800">تثبیت‌شده در دمای ۵۵°+</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Quantitative Parameters Table */}
        <div className="border border-stone-300 rounded-lg overflow-hidden mb-8">
          <div className="bg-stone-100 px-4 py-2.5 font-bold text-xs text-stone-900 border-b border-stone-300 flex items-center justify-between">
            <span>جدول پارامترهای آزمایشگاهی و حدود استاندارد تضمینی</span>
            <span className="font-mono text-[11px] text-stone-600">روش‌های آزمون استاندارد خاک و کود</span>
          </div>

          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-700 border-b border-stone-200 font-semibold text-[11px]">
                <th className="px-4 py-2.5">پارامتر کیفی</th>
                <th className="px-4 py-2.5">نماد فنی</th>
                <th className="px-4 py-2.5">حد استاندارد درجه ۱</th>
                <th className="px-4 py-2.5">مقدار اندازه‌گیری‌شده</th>
                <th className="px-4 py-2.5">وضعیت</th>
                <th className="px-4 py-2.5">علت علمی در فرمول</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 font-sans text-[11px]">
              {GUARANTEED_LAB_SPECS.map((spec) => (
                <tr key={spec.parameter} className="hover:bg-stone-50/60">
                  <td className="px-4 py-3 font-bold text-stone-900">{spec.parameter}</td>
                  <td className="px-4 py-3 font-mono text-stone-500">{spec.symbol}</td>
                  <td className="px-4 py-3 font-mono font-medium text-stone-700">{spec.target}</td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-900 text-xs">{spec.labValue}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-emerald-800 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      منطبق (Pass)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-[10px]">{spec.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Guarantee Seal & Signatures - Fully Editable and Dynamic */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-stone-300 text-center text-xs">
          <div className="space-y-6">
            <span className="text-stone-500 block">{signatories.precompostTitle}</span>
            <div className="font-bold text-stone-900 text-sm">
              {signatories.precompostSupervisor}
              <div className="text-[10px] text-stone-400 font-normal mt-0.5">تایید بهداشت حرارتی و تست زیستی ۲۴h</div>
            </div>
            <div className="text-[11px] font-mono text-emerald-800">[امضای الکترونیک ثبت‌شده]</div>
          </div>

          <div className="space-y-6">
            <span className="text-stone-500 block">{signatories.bedTitle}</span>
            <div className="font-bold text-stone-900 text-sm">
              {signatories.bedSupervisor}
              <div className="text-[10px] text-stone-400 font-normal mt-0.5">تایید رژیم لایه‌ای و مش ۲-۳ میلی‌متر</div>
            </div>
            <div className="text-[11px] font-mono text-emerald-800">[امضای الکترونیک ثبت‌شده]</div>
          </div>

          <div className="space-y-6">
            <span className="text-stone-500 block">{signatories.technicalTitle}</span>
            <div className="font-bold text-stone-900 text-sm">
              {signatories.technicalManager}
              <div className="text-[10px] text-stone-400 font-normal mt-0.5">{signatories.laboratoryName}</div>
            </div>
            <div className="text-[11px] font-mono text-emerald-800">[مهر و تایید نهایی آزمایشگاه]</div>
          </div>
        </div>

        {/* Certificate Footer Notice */}
        <div className="mt-8 pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-stone-400">
          <span>این برگه به عنوان شناسنامه اصالت و سلامت ورمیکمپوست درجه ۱ صادراتی صادر گردیده است.</span>
          <span className="font-mono">VALIDATION-HASH: 9F7B2A-VERMI-EXP-2026</span>
        </div>
      </div>
    </div>
  );
};
