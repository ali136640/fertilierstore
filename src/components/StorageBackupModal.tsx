import React, { useRef, useState } from 'react';
import { WorkshopAppState, LabSignatories } from '../types/vermicompost';
import { 
  exportWorkshopBackup, 
  clearWorkshopData 
} from '../utils/storage';
import { 
  Database, 
  Download, 
  Upload, 
  RotateCcw, 
  Check, 
  AlertTriangle, 
  X, 
  HardDrive, 
  ShieldCheck, 
  FileJson,
  UserCheck
} from 'lucide-react';

interface StorageBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  appState: WorkshopAppState;
  onRestoreState: (state: WorkshopAppState) => void;
  onResetDefaults: () => void;
}

export const StorageBackupModal: React.FC<StorageBackupModalProps> = ({
  isOpen,
  onClose,
  appState,
  onRestoreState,
  onResetDefaults,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    exportWorkshopBackup(appState);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed && parsed.config) {
          onRestoreState(parsed);
          setImportStatus('فایل پشتیبان با موفقیت بازگردانی شد.');
          setTimeout(() => {
            setImportStatus(null);
            onClose();
          }, 1500);
        } else {
          setImportStatus('خطا: ساختار فایل پشتیبان معتبر نیست.');
        }
      } catch (err) {
        setImportStatus('خطا در خواندن فایل JSON پشتیبان.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
      <div className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden text-right font-sans my-8">
        
        {/* Header */}
        <div className="p-6 bg-stone-900 text-white relative">
          <button
            onClick={onClose}
            className="absolute left-5 top-5 p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700/80 flex items-center justify-center shrink-0">
              <HardDrive className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-lg font-bold">مدیریت حافظه و پشتیبان‌گیری در سیستم کاربر</h3>
              <p className="text-xs text-stone-400 mt-0.5">
                ذخیره محلی (Local Storage) بدون نیاز به اینترنت و بدون ارسال داده‌ها به سرور
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Persistence status banner */}
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
              <strong>تمام تغییرات شما به صورت خودکار در دستگاه شما ذخیره می‌شود:</strong>
              <div className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300">
                فرمولاسیون، قیمت‌های خرید، تاریخ بچ ({appState.config.startDate})، پیشرفت ۶ نوبت تغذیه لایه‌ای محمد و نام مسئولین برگه آزمایش بلافاصله در حافظه سیستم شما محفوظ است و با بستن مرورگر یا گوشی پاک نمی‌شود.
              </div>
            </div>
          </div>

          {/* Backup / Export */}
          <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <FileJson className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
                  <span>پشتیبان‌گیری (دانلود فایل JSON)</span>
                </h4>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  برای انتقال داده‌ها به کامپیوتر یا گوشی دیگر، یک نسخه فایل پشتیبان دانلود کنید.
                </p>
              </div>
            </div>

            <button
              onClick={handleExport}
              className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>دانلود فایل پشتیبان کارگاه (.json)</span>
            </button>
          </div>

          {/* Restore / Import */}
          <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
                <span>بازگردانی فایل پشتیبان (Restore)</span>
              </h4>
              <p className="text-[11px] text-stone-500 mt-0.5">
                فایل JSON پشتیبان قبلی را برای بازگردانی اطلاعات انتخاب کنید.
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json,application/json"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-4 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>انتخاب و بارگذاری فایل پشتیبان</span>
            </button>

            {importStatus && (
              <div className="text-xs text-center font-medium text-emerald-700 dark:text-emerald-400 pt-1">
                {importStatus}
              </div>
            )}
          </div>

          {/* Reset Defaults */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
            {!isResetConfirmOpen ? (
              <button
                onClick={() => setIsResetConfirmOpen(true)}
                className="text-xs text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازنشانی حافظه به مقادیر پیش‌فرض کارگاه</span>
              </button>
            ) : (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl space-y-2">
                <div className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>آیا از بازنشانی داده‌ها به حالت اولیه اطمینان دارید؟</span>
                </div>
                <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-relaxed">
                  این کار تمام قیمت‌های خرید و تنظیمات ذخیره‌شده را به حالت اولیه برمی‌گرداند.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      onResetDefaults();
                      setIsResetConfirmOpen(false);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold"
                  >
                    بله، بازنشانی شود
                  </button>
                  <button
                    onClick={() => setIsResetConfirmOpen(false)}
                    className="px-3 py-1.5 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-xs"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 dark:bg-stone-800/60 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-semibold"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
};
