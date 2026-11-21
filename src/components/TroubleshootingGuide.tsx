import React, { useState } from 'react';
import { TROUBLESHOOTING_CASES } from '../data/vermicompostData';
import { TroubleCase } from '../types/vermicompost';
import { 
  AlertTriangle, 
  HelpCircle, 
  Wrench, 
  CheckCircle, 
  Search,
  Filter
} from 'lucide-react';

export const TroubleshootingGuide: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    { id: 'all', label: 'همه مشکلات کارگاهی' },
    { id: 'ph', label: 'اسیدیته (pH)' },
    { id: 'temperature', label: 'دما و داغ شدن توده' },
    { id: 'odor', label: 'بوی نامطبوع و آمونیاک' },
    { id: 'moisture', label: 'رطوبت و خفگی لایه‌ها' },
    { id: 'sieving', label: 'سرند و دانه‌بندی' },
  ];

  const filteredCases = TROUBLESHOOTING_CASES.filter((item) => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesQuery =
      searchQuery.trim() === '' ||
      item.symptom.includes(searchQuery) ||
      item.cause.includes(searchQuery) ||
      item.remedy.includes(searchQuery);
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>پروتکل‌های اضطراری و عیب‌یابی خط تولید</span>
            </div>
            <h1 className="text-2xl font-extrabold text-stone-900 dark:text-stone-50 tracking-tight">
              راهنمای جامع رفع خطاهای کارگاهی تفاله قهوه و بستر کرم
            </h1>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-3xl">
              تفاله قهوه ماده‌ای به شدت مستعد تخمیر بی‌هوازی و اسیدی‌شدن است. در صورت بروز هرگونه علائم هشدار در بستر، فوراً اقدامات اصلاحی زیر را اجرا کنید.
            </p>
          </div>

          {/* Search box */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی علامت یا مشکل..."
              className="w-full pr-9 pl-4 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>
        </div>

        {/* Filter Segmented Controls */}
        <div className="flex flex-wrap items-center gap-1.5 pt-6">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-semibold'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCases.map((item) => {
          return (
            <div
              key={item.id}
              className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-stone-300 dark:hover:border-stone-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.urgency === 'critical'
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                    }`}>
                      {item.urgency === 'critical' ? 'اقدام فوری' : 'اولویت بالا'}
                    </span>
                    <span className="text-xs font-mono text-stone-400">کد: {item.id}</span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-2">
                  {item.symptom}
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-stone-50 dark:bg-stone-800/40 rounded-lg border border-stone-100 dark:border-stone-800">
                    <span className="font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                      ریشه علمی و علت کارگاهی:
                    </span>
                    <p className="text-stone-600 dark:text-stone-400 leading-relaxed text-[11px]">
                      {item.cause}
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
                    <span className="font-semibold text-emerald-900 dark:text-emerald-300 block mb-1 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5" />
                      دستورالعمل اجرایی رفع عیب:
                    </span>
                    <p className="text-emerald-950 dark:text-emerald-300 leading-relaxed text-[11px]">
                      {item.remedy}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
