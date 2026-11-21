import React, { useState, useMemo, useEffect } from 'react';
import { IRAN_PROVINCES, getCitiesByProvince, searchIranLocations } from '../data/iranCities';

interface IranLocationSelectorProps {
  province: string;
  city: string;
  onProvinceChange: (province: string) => void;
  onCityChange: (city: string) => void;
  compact?: boolean;
}

const CUSTOM_CITY_OPTION = '__CUSTOM_CITY__';
const CUSTOM_PROVINCE_OPTION = '__CUSTOM_PROVINCE__';

export function IranLocationSelector({
  province,
  city,
  onProvinceChange,
  onCityChange,
  compact = false,
}: IranLocationSelectorProps) {
  const isKnownProvince = useMemo(
    () => IRAN_PROVINCES.some((p) => p.name.trim() === (province || '').trim()),
    [province]
  );

  const availableCities = useMemo(() => getCitiesByProvince(province), [province]);
  const isKnownCity = useMemo(
    () => availableCities.some((c) => c.trim() === (city || '').trim()),
    [availableCities, city]
  );

  const [manualProvinceMode, setManualProvinceMode] = useState<boolean>(() => Boolean(province && !isKnownProvince));
  const [manualCityMode, setManualCityMode] = useState<boolean>(() => Boolean(city && !isKnownCity));
  const [quickQuery, setQuickQuery] = useState<string>('');

  // Keep selector synced cleanly if parent resets province/city externally
  useEffect(() => {
    if (province && isKnownProvince) {
      setManualProvinceMode(false);
    }
    if (city && isKnownCity) {
      setManualCityMode(false);
    }
  }, [province, city, isKnownProvince, isKnownCity]);

  const quickMatches = useMemo(() => {
    if (!quickQuery.trim()) return [];
    return searchIranLocations(quickQuery, 30);
  }, [quickQuery]);

  const labelClass = compact
    ? 'block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1'
    : 'block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1';
  const fieldClass = compact
    ? 'w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs'
    : 'w-full px-2.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs';

  const handleProvinceSelect = (val: string) => {
    if (val === CUSTOM_PROVINCE_OPTION) {
      setManualProvinceMode(true);
      onProvinceChange('');
      setManualCityMode(true);
      onCityChange('');
      return;
    }
    setManualProvinceMode(false);
    onProvinceChange(val);
    const cities = getCitiesByProvince(val);
    if (cities.length > 0) {
      setManualCityMode(false);
      onCityChange(cities[0]);
    } else {
      setManualCityMode(true);
      onCityChange('');
    }
  };

  const handleCitySelect = (val: string) => {
    if (val === CUSTOM_CITY_OPTION) {
      setManualCityMode(true);
      onCityChange('');
      return;
    }
    setManualCityMode(false);
    onCityChange(val);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
        <span>🇮🇷 پوشش کامل ۳۱ استان و تمام شهرهای کشور</span>
        <span className="text-stone-400 font-normal">
          {province && city ? `${province} / ${city}` : 'انتخاب یا تایپ دستی'}
        </span>
      </div>

      {/* Fast Nationwide City/County Search */}
      <div className="relative">
        <input
          type="text"
          value={quickQuery}
          onChange={(e) => setQuickQuery(e.target.value)}
          placeholder="🔍 جستجوی سریع شهر یا شهرستان در سراسر کشور (مثلاً: رفسنجان، مریوان، لاهیجان...)"
          className="w-full px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-stone-900 dark:text-stone-100 text-[11px] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
        {quickQuery && (
          <button
            type="button"
            onClick={() => setQuickQuery('')}
            className="absolute left-2.5 top-1.5 text-[11px] text-stone-400 hover:text-stone-700"
            title="پاک کردن جستجو"
          >
            ✕
          </button>
        )}
        {quickMatches.length > 0 && (
          <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-stone-900 shadow-lg divide-y divide-stone-100 dark:divide-stone-800 z-20">
            {quickMatches.map((m) => (
              <button
                key={`${m.province}-${m.city}`}
                type="button"
                onClick={() => {
                  setManualProvinceMode(false);
                  setManualCityMode(false);
                  onProvinceChange(m.province);
                  onCityChange(m.city);
                  setQuickQuery('');
                }}
                className="w-full px-3 py-1.5 text-right text-[11px] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between gap-2 transition-colors"
              >
                <span className="font-bold text-stone-800 dark:text-stone-100">{m.city}</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  استان {m.province}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Province Selection or Manual Typing */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelClass.replace(' mb-1', '')}>استان</label>
            <button
              type="button"
              onClick={() => {
                if (manualProvinceMode) {
                  setManualProvinceMode(false);
                  const fallbackProv = IRAN_PROVINCES[0].name;
                  onProvinceChange(fallbackProv);
                  setManualCityMode(false);
                  onCityChange(IRAN_PROVINCES[0].cities[0]);
                } else {
                  setManualProvinceMode(true);
                }
              }}
              className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              {manualProvinceMode ? 'انتخاب از لیست استان‌ها' : '✍️ تایپ استان'}
            </button>
          </div>

          {manualProvinceMode ? (
            <input
              type="text"
              value={province}
              onChange={(e) => onProvinceChange(e.target.value)}
              placeholder="نام استان را تایپ کنید..."
              className={fieldClass}
            />
          ) : (
            <select
              value={isKnownProvince ? province : IRAN_PROVINCES[0].name}
              onChange={(e) => handleProvinceSelect(e.target.value)}
              className={fieldClass}
            >
              {IRAN_PROVINCES.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
              <option value={CUSTOM_PROVINCE_OPTION}>✍️ تایپ دستی نام استان...</option>
            </select>
          )}
        </div>

        {/* City Selection or Manual Typing */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelClass.replace(' mb-1', '')}>شهر / شهرستان / بخش</label>
            <button
              type="button"
              onClick={() => {
                if (manualCityMode && availableCities.length > 0) {
                  setManualCityMode(false);
                  if (!isKnownCity) {
                    onCityChange(availableCities[0]);
                  }
                } else {
                  setManualCityMode(true);
                  if (isKnownCity) {
                    onCityChange('');
                  }
                }
              }}
              className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              {manualCityMode && availableCities.length > 0
                ? 'انتخاب از لیست شهرها'
                : '✍️ تایپ دستی شهر/روستا'}
            </button>
          </div>

          {manualCityMode || availableCities.length === 0 ? (
            <input
              type="text"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder="نام شهر، بخش یا روستای خود را تایپ کنید..."
              className={fieldClass}
            />
          ) : (
            <select
              value={isKnownCity ? city : availableCities[0] || ''}
              onChange={(e) => handleCitySelect(e.target.value)}
              className={fieldClass}
            >
              {availableCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={CUSTOM_CITY_OPTION}>✍️ سایر (تایپ دستی شهر / روستا...)</option>
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
