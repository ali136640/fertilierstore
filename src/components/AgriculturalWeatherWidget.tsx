import React, { useState, useEffect, useRef, useMemo } from 'react';
import { resolveApiUrl } from '../utils/apiBase';
import {
  Wind,
  Droplets,
  Thermometer,
  Sprout,
  RefreshCw,
  Volume2,
  Square,
  Loader2,
  MapPin,
  Sunrise,
  Sunset,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Maximize2,
  X,
  Clock,
} from 'lucide-react';
import { IRAN_PROVINCES, getCitiesByProvince, searchIranLocations } from '../data/iranCities';
import { useDeviceClock, formatDeviceTime } from '../utils/deviceTime';
import { parseJsonResponseSafe, speakPersianBrowserVoice } from '../utils/safeFetchJson';
import {
  buildWeatherVoiceClipId,
  resolvePreGeneratedVoiceClip,
  base64AudioToBlobUrl,
} from '../utils/voiceClipStorage';

export type WeatherConditionKey =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'storm'
  | 'snow';

export interface WeatherAdvisoryItem {
  id: string;
  title: string;
  detail: string;
  severity: 'optimal' | 'caution' | 'alert';
  category: 'spraying' | 'irrigation' | 'soil' | 'frost_heat' | 'pest_disease' | 'gardening';
}

export interface DailyForecastItem {
  date: string;
  dayLabel: string;
  weatherCode: number;
  conditionLabel: string;
  conditionKey: WeatherConditionKey;
  tempMax: number;
  tempMin: number;
  precipProb: number;
  precipSum: number;
  windMax: number;
  uvMax: number;
  et0: number;
  sunrise: string;
  sunset: string;
}

export interface LiveWeatherPayload {
  sourceName?: string;
  voiceScript?: string;
  location: {
    province: string;
    city: string;
    lat: number;
    lon: number;
  };
  updatedAtFa: string;
  current: {
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    precipitation: number;
    precipitationProbability: number;
    cloudCover: number;
    weatherCode: number;
    conditionLabel: string;
    conditionKey: WeatherConditionKey;
    isDay: boolean;
    soilTemp: number | null;
    soilMoisturePct: number | null;
    et0Today: number;
    uvMaxToday: number;
    sunrise: string;
    sunset: string;
  };
  forecast: DailyForecastItem[];
  advisories: WeatherAdvisoryItem[];
}

interface AgriculturalWeatherWidgetProps {
  defaultProvince?: string;
  defaultCity?: string;
  locationSourceNote?: string;
  onStopOtherAudio?: () => void;
  floating?: boolean;
  hasBottomCartBar?: boolean;
  isMobilePreview?: boolean;
}

function WeatherIllustrationSvg({
  conditionKey,
  isDay = true,
  size = 'lg',
}: {
  conditionKey: WeatherConditionKey;
  isDay?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls =
    size === 'lg'
      ? 'w-16 h-16 shrink-0'
      : size === 'md'
      ? 'w-9 h-9 shrink-0'
      : 'w-6 h-6 shrink-0';

  if (conditionKey === 'clear') {
    if (!isDay && size === 'lg') {
      return (
        <svg viewBox="0 0 64 64" className={cls} fill="none" aria-hidden="true">
          <circle cx="32" cy="32" r="24" fill="#1e293b" opacity="0.45" />
          <path
            d="M40 16a15 15 0 1 0 11 25.2A13 13 0 0 1 40 16Z"
            fill="#FDE68A"
            stroke="#FBBF24"
            strokeWidth="2"
          />
          <circle cx="46" cy="18" r="2" fill="#FEF3C7" />
          <circle cx="20" cy="20" r="1.5" fill="#FEF3C7" />
          <circle cx="48" cy="36" r="1.5" fill="#FEF3C7" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 64 64" className={cls} fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="13" fill="#FBBF24" />
        <circle cx="32" cy="32" r="18" stroke="#FDE68A" strokeWidth="2" strokeDasharray="4 4" opacity="0.7" />
        <g stroke="#FCD34D" strokeWidth="2.8" strokeLinecap="round">
          <line x1="32" y1="6" x2="32" y2="12" />
          <line x1="32" y1="52" x2="32" y2="58" />
          <line x1="6" y1="32" x2="12" y2="32" />
          <line x1="52" y1="32" x2="58" y2="32" />
          <line x1="13.6" y1="13.6" x2="17.8" y2="17.8" />
          <line x1="46.2" y1="46.2" x2="50.4" y2="50.4" />
          <line x1="50.4" y1="13.6" x2="46.2" y2="17.8" />
          <line x1="17.8" y1="46.2" x2="13.6" y2="50.4" />
        </g>
      </svg>
    );
  }

  if (conditionKey === 'partly_cloudy') {
    return (
      <svg viewBox="0 0 64 64" className={cls} fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="10" fill="#FBBF24" />
        <g stroke="#FCD34D" strokeWidth="2.2" strokeLinecap="round">
          <line x1="24" y1="8" x2="24" y2="12" />
          <line x1="8" y1="24" x2="12" y2="24" />
          <line x1="13" y1="13" x2="16" y2="16" />
          <line x1="35" y1="13" x2="32" y2="16" />
        </g>
        <path
          d="M22 46h25a9 9 0 0 0 1.4-17.9A12 12 0 0 0 25 27a8.5 8.5 0 0 0-3 19Z"
          fill="#F8FAFC"
          stroke="#CBD5E1"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (conditionKey === 'rain' || conditionKey === 'storm') {
    return (
      <svg viewBox="0 0 64 64" className={cls} fill="none" aria-hidden="true">
        <path
          d="M17 38h30a9 9 0 0 0 1.5-17.9A12.5 12.5 0 0 0 24 19a9 9 0 0 0-7 19Z"
          fill="#E2E8F0"
          stroke="#94A3B8"
          strokeWidth="2"
        />
        {conditionKey === 'storm' ? (
          <path d="M33 37l-5 9h5l-3 10 9-12h-5l3-7h-4Z" fill="#FBBF24" />
        ) : null}
        <g stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round">
          <line x1="21" y1="43" x2="18" y2="52" />
          <line x1="31" y1="44" x2="28" y2="54" />
          <line x1="42" y1="43" x2="39" y2="52" />
        </g>
      </svg>
    );
  }

  if (conditionKey === 'snow') {
    return (
      <svg viewBox="0 0 64 64" className={cls} fill="none" aria-hidden="true">
        <path
          d="M17 37h30a9 9 0 0 0 1.5-17.9A12.5 12.5 0 0 0 24 18a9 9 0 0 0-7 19Z"
          fill="#F1F5F9"
          stroke="#CBD5E1"
          strokeWidth="2"
        />
        <g fill="#BAE6FD">
          <circle cx="22" cy="46" r="2.5" />
          <circle cx="32" cy="50" r="2.5" />
          <circle cx="42" cy="46" r="2.5" />
          <circle cx="27" cy="55" r="2" />
          <circle cx="37" cy="55" r="2" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" className={cls} fill="none" aria-hidden="true">
      <path
        d="M16 40h32a9.5 9.5 0 0 0 1.4-18.9A13 13 0 0 0 24 20a9.5 9.5 0 0 0-8 20Z"
        fill="#E2E8F0"
        stroke="#94A3B8"
        strokeWidth="2"
      />
      {conditionKey === 'fog' && (
        <g stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round">
          <line x1="16" y1="47" x2="48" y2="47" />
          <line x1="20" y1="53" x2="44" y2="53" />
        </g>
      )}
    </svg>
  );
}

export function AgriculturalWeatherWidget({
  defaultProvince,
  defaultCity,
  locationSourceNote,
  onStopOtherAudio,
  floating = false,
  hasBottomCartBar = false,
  isMobilePreview = false,
}: AgriculturalWeatherWidgetProps) {
  const initialProvince = defaultProvince?.trim() || 'تهران';
  const initialCity = defaultCity?.trim() || 'تهران';

  const deviceClock = useDeviceClock(1000);
  const [deviceUpdatedAt, setDeviceUpdatedAt] = useState<string>(() => formatDeviceTime(new Date()));

  const [selectedProvince, setSelectedProvince] = useState<string>(initialProvince);
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [customCityDraft, setCustomCityDraft] = useState<string>('');
  const [quickLocationSearch, setQuickLocationSearch] = useState<string>('');
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState<boolean>(false);
  const [isAdvisoriesExpanded, setIsAdvisoriesExpanded] = useState<boolean>(true);
  // Collapsible panel state (expanded by default in dedicated standalone tab)
  const [isExpanded, setIsExpanded] = useState<boolean>(!floating);

  const [weatherData, setWeatherData] = useState<LiveWeatherPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Live On-Demand Voice Briefing Audio State (requires zero admin approval)
  const [isVoiceLoading, setIsVoiceLoading] = useState<boolean>(false);
  const [isVoicePlaying, setIsVoicePlaying] = useState<boolean>(false);
  const [voiceScript, setVoiceScript] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceCacheRef = useRef<Map<string, { audioUrl: string; scriptText: string }>>(new Map());

  // Sync automatically if customer residence profile province/city changes
  useEffect(() => {
    if (defaultProvince?.trim()) {
      setSelectedProvince(defaultProvince.trim());
    }
    if (defaultCity?.trim()) {
      setSelectedCity(defaultCity.trim());
    }
  }, [defaultProvince, defaultCity]);

  const stopWeatherAudio = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setIsVoicePlaying(false);
  };

  useEffect(() => {
    return () => {
      stopWeatherAudio();
      voiceCacheRef.current.forEach((entry) => {
        try {
          URL.revokeObjectURL(entry.audioUrl);
        } catch {
          // ignore
        }
      });
      voiceCacheRef.current.clear();
    };
  }, []);

  const fetchLiveWeather = async (prov: string, cty: string) => {
    setIsLoading(true);
    setWeatherError(null);
    stopWeatherAudio();
    setVoiceScript(null);
    setVoiceError(null);
    try {
      const qs = new URLSearchParams({
        province: prov || 'تهران',
        city: cty || prov || 'تهران',
      });
      const resp = await fetch(resolveApiUrl(`/api/weather?${qs.toString()}`));
      const parsed = await parseJsonResponseSafe<LiveWeatherPayload & { error?: string }>(
        resp,
        'دریافت وضعیت هواشناسی ممکن نشد.'
      );
      if (!parsed.ok || !parsed.data?.current) {
        throw new Error(parsed.errorMessage || parsed.data?.error || 'دریافت وضعیت هواشناسی ممکن نشد.');
      }
      setWeatherData(parsed.data);
      const immediateScript =
        parsed.data.voiceScript?.trim() ||
        `گزارش زنده هواشناسی ${parsed.data.location.city}: هوا ${parsed.data.current.conditionLabel}، دمای ${parsed.data.current.temperature} درجه، رطوبت ${parsed.data.current.humidity} درصد و سرعت باد ${parsed.data.current.windSpeed} کیلومتر بر ساعت. ${parsed.data.advisories
          .slice(0, 2)
          .map((a) => `${a.title}: ${a.detail}`)
          .join(' ')}`;
      setVoiceScript(immediateScript);
      setDeviceUpdatedAt(formatDeviceTime(new Date()));
    } catch (err) {
      setWeatherError(
        err instanceof Error ? err.message : 'خطا در دریافت داده‌های آنلاین هواشناسی'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchLiveWeather(selectedProvince, selectedCity);
  }, [selectedProvince, selectedCity]);

  const provinceCities = useMemo(
    () => getCitiesByProvince(selectedProvince),
    [selectedProvince]
  );

  const quickSearchMatches = useMemo(() => {
    if (!quickLocationSearch.trim()) return [];
    return searchIranLocations(quickLocationSearch, 12);
  }, [quickLocationSearch]);

  // Direct Live Customer Weather Voice Generation (No Admin Approval Needed)
  const handleToggleWeatherVoice = async () => {
    if (isVoicePlaying) {
      stopWeatherAudio();
      return;
    }
    if (!weatherData) return;

    onStopOtherAudio?.();
    stopWeatherAudio();
    setVoiceError(null);

    const cur = weatherData.current;
    const today = weatherData.forecast[0];
    const cacheKey = `${weatherData.location.province}:${weatherData.location.city}:${cur.temperature}:${cur.weatherCode}:${weatherData.updatedAtFa}`;

    const playUrl = async (audioUrl: string, script: string) => {
      setVoiceScript(script);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setIsVoicePlaying(false);
        }
      };
      audio.onerror = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setIsVoicePlaying(false);
        }
        setVoiceError('پخش صوت گزارش هواشناسی با خطا مواجه شد.');
      };
      setIsVoicePlaying(true);
      await audio.play();
    };

    const cached = voiceCacheRef.current.get(cacheKey);
    if (cached) {
      try {
        await playUrl(cached.audioUrl, cached.scriptText);
        return;
      } catch {
        // fallback below
      }
    }

    setIsVoiceLoading(true);
    try {
      // 1. Check if Admin uploaded or pre-generated custom weather audio in Voice Studio
      const cityClip =
        (await resolvePreGeneratedVoiceClip(buildWeatherVoiceClipId(weatherData.location.city))) ||
        (await resolvePreGeneratedVoiceClip(buildWeatherVoiceClipId('general')));
      if (cityClip?.audioBase64) {
        const clipUrl = base64AudioToBlobUrl(cityClip.audioBase64, cityClip.mimeType || 'audio/mpeg');
        const clipScript = cityClip.scriptText?.trim() || weatherData.voiceScript || '';
        voiceCacheRef.current.set(cacheKey, { audioUrl: clipUrl, scriptText: clipScript });
        await playUrl(clipUrl, clipScript);
        return;
      }

      const weatherSummary =
        weatherData.voiceScript?.trim() ||
        `وضعیت فعلی ${weatherData.location.city} (استان ${weatherData.location.province}): ${cur.conditionLabel}، دمای فعلی ${cur.temperature} درجه، بیشینه امروز ${today?.tempMax ?? cur.temperature} و کمینه ${today?.tempMin ?? cur.temperature} درجه، رطوبت هوا ${cur.humidity} درصد، سرعت باد ${cur.windSpeed} کیلومتر در ساعت، احتمال بارندگی ${cur.precipitationProbability} درصد${cur.soilTemp !== null ? `، دمای سطح خاک ${cur.soilTemp} درجه` : ''}${cur.soilMoisturePct !== null ? ` و رطوبت خاک ${cur.soilMoisturePct} درصد` : ''}، میزان تبخیر و تعرق ${cur.et0Today} میلی‌متر.`;

      const resp = await fetch(resolveApiUrl('/api/ai/product-voice'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'weather',
          productId: `weather-${weatherData.location.province}-${weatherData.location.city}`,
          productName: `${weatherData.location.city} - استان ${weatherData.location.province}`,
          categoryLabel: 'گزارش زنده هواشناسی و اقدامات باغبانی',
          description: weatherSummary,
          customScriptText: weatherData.voiceScript || undefined,
          highlights: weatherData.advisories.map((a) => `${a.title}: ${a.detail}`),
        }),
      });
      const parsed = await parseJsonResponseSafe<{
        audioBase64?: string;
        mimeType?: string;
        scriptText?: string;
        error?: string;
      }>(resp, 'تولید گزارش صوتی هواشناسی با خطا مواجه شد.');
      const data = parsed.data;
      if (!parsed.ok || !data?.audioBase64) {
        const advisorySummary = weatherData.advisories
          .slice(0, 2)
          .map((a) => `${a.title}: ${a.detail}`)
          .join(' ');
        const fallbackScript =
          (typeof data?.scriptText === 'string' && data.scriptText.trim()) ||
          `${weatherSummary} ${advisorySummary}`.trim();
        const spoke = speakPersianBrowserVoice(
          fallbackScript,
          () => {
            setVoiceScript(fallbackScript);
            setIsVoicePlaying(true);
          },
          () => setIsVoicePlaying(false),
          () => setIsVoicePlaying(false)
        );
        if (spoke) {
          return;
        }
        throw new Error(
          parsed.errorMessage || data?.error || 'تولید گزارش صوتی هواشناسی با خطا مواجه شد.'
        );
      }

      const binStr = atob(data.audioBase64);
      const len = binStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const scriptText =
        typeof data.scriptText === 'string' && data.scriptText.trim()
          ? data.scriptText.trim()
          : weatherSummary;

      voiceCacheRef.current.set(cacheKey, { audioUrl, scriptText });
      await playUrl(audioUrl, scriptText);
    } catch (err) {
      setVoiceError(
        err instanceof Error ? err.message : 'خطا در آماده سازی گزارش صوتی هواشناسی'
      );
    } finally {
      setIsVoiceLoading(false);
    }
  };

  const weeklyRange = useMemo(() => {
    if (!weatherData?.forecast?.length) return { min: 0, max: 40 };
    const mins = weatherData.forecast.map((d) => d.tempMin);
    const maxs = weatherData.forecast.map((d) => d.tempMax);
    const min = Math.min(...mins);
    const max = Math.max(...maxs);
    return { min, max: max > min ? max : min + 1 };
  }, [weatherData]);

  const skyThemeClass = useMemo(() => {
    const key = weatherData?.current.conditionKey || 'clear';
    const isDay = weatherData?.current.isDay ?? true;
    if (!isDay) {
      return 'from-slate-900 via-emerald-950 to-slate-950 border-slate-700/70';
    }
    switch (key) {
      case 'rain':
      case 'storm':
        return 'from-slate-800 via-sky-950 to-emerald-950 border-sky-700/60';
      case 'snow':
        return 'from-slate-800 via-cyan-950 to-slate-900 border-cyan-700/60';
      case 'cloudy':
      case 'fog':
        return 'from-stone-800 via-slate-800 to-emerald-950 border-stone-600/60';
      default:
        return 'from-sky-900 via-emerald-900 to-emerald-950 border-emerald-700/50';
    }
  }, [weatherData]);

  // 1) COLLAPSED FLOATING STATE: Shows ONLY live temperature + voice report button (clicking temp/card expands full dashboard)
  if (floating && !isExpanded) {
    const dockPositionClass = isMobilePreview
      ? hasBottomCartBar
        ? 'fixed bottom-16 right-4 z-40'
        : 'fixed bottom-4 right-4 z-40'
      : hasBottomCartBar
      ? 'fixed bottom-16 sm:bottom-4 right-3 sm:right-6 z-40'
      : 'fixed bottom-4 right-3 sm:right-6 z-40';

    return (
      <div
        dir="rtl"
        className={`${dockPositionClass} max-w-[calc(100vw-1.5rem)] animate-fade-in`}
      >
        <div
          className={`flex items-center gap-2 p-1.5 pr-2.5 rounded-2xl bg-gradient-to-l ${skyThemeClass} text-white border shadow-2xl backdrop-blur-md`}
        >
          {/* Clickable Temp Display -> Expands Full Weather View */}
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            title="مشاهده کامل پیش‌بینی هواشناسی و توصیه‌های باغبانی"
            className="flex items-center gap-2 pl-2 py-1 rounded-xl hover:bg-white/10 transition-colors text-right cursor-pointer"
          >
            <WeatherIllustrationSvg
              conditionKey={weatherData?.current.conditionKey || 'clear'}
              isDay={weatherData?.current.isDay ?? true}
              size="md"
            />
            <div className="flex items-center gap-1.5">
              {isLoading && !weatherData ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
              ) : (
                <span className="text-xl font-extrabold font-mono tabular-nums tracking-tight text-white">
                  {weatherData ? `${weatherData.current.temperature.toLocaleString('fa-IR')}°` : '--°'}
                </span>
              )}
              <div className="text-right leading-tight max-w-[110px]">
                <div className="text-[10.5px] font-bold text-emerald-100 truncate">
                  {weatherData?.location.city || selectedCity}
                </div>
                <div className="text-[9px] text-amber-200/90 flex items-center gap-0.5">
                  <Maximize2 className="w-2.5 h-2.5 shrink-0" />
                  <span>جزئیات کامل</span>
                </div>
              </div>
            </div>
          </button>

          <div className="w-px h-7 bg-white/15 shrink-0" />

          {/* Direct Live Voice Weather Report Button */}
          <button
            type="button"
            onClick={() => void handleToggleWeatherVoice()}
            disabled={isVoiceLoading || isLoading || !weatherData}
            className={`px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm border shrink-0 ${
              isVoicePlaying
                ? 'bg-amber-400 border-amber-300 text-stone-950 animate-pulse'
                : isVoiceLoading
                ? 'bg-white/15 border-white/25 text-amber-200 cursor-wait'
                : 'bg-amber-400 hover:bg-amber-300 border-amber-300 text-stone-950'
            }`}
          >
            {isVoiceLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>آماده‌سازی...</span>
              </>
            ) : isVoicePlaying ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>توقف صوت</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>گزارش صوتی</span>
              </>
            )}
          </button>
        </div>

        {voiceError && (
          <div className="mt-1.5 px-2.5 py-1.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-[10px] text-rose-100 shadow-lg max-w-xs">
            ⚠️ {voiceError}
          </div>
        )}
      </div>
    );
  }

  // 2) EXPANDED FULL WEATHER VIEW CARD (Inside Floating Overlay when floating=true, or Inline)
  const weatherCardContent = (
    <section
      aria-label="هواشناسی آنلاین کشاورزی و باغبانی"
      dir="rtl"
      className={`rounded-3xl bg-gradient-to-br ${skyThemeClass} text-white border shadow-2xl overflow-hidden ${
        floating ? 'w-full max-w-3xl max-h-[86vh] overflow-y-auto' : ''
      }`}
    >
      {/* Top Location & Voice Action Header */}
      <div className="p-3.5 sm:p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5 sticky top-0 z-10 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                هواشناسی کشاورزی {weatherData?.location.city || selectedCity}
              </h3>
              <span className="text-[10.5px] text-emerald-200 font-medium">
                · استان {selectedProvince}
              </span>
              {locationSourceNote && (
                <span className="text-[9.5px] bg-emerald-500/25 border border-emerald-300/35 text-emerald-100 px-2 py-0.5 rounded-md font-semibold">
                  {locationSourceNote}
                </span>
              )}
            </div>
            <div className="text-[10px] text-stone-300 flex flex-wrap items-center gap-1.5 mt-0.5">
              <span
                className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md font-mono font-bold text-amber-200"
                title="ساعت و تاریخ لحظه‌ای مطابق دستگاه شما"
              >
                <Clock className="w-3 h-3 text-amber-300" />
                <span>{deviceClock.timeWithSecStr}</span>
                <span className="text-stone-300 font-sans font-normal">· {deviceClock.weekdayDateStr}</span>
              </span>
              <span className="text-emerald-200/90">
                منبع معتبر: {weatherData?.sourceName || 'Open-Meteo Live'}
              </span>
              <span>· بروزرسانی: {deviceUpdatedAt}</span>
              <span>·</span>
              <button
                type="button"
                onClick={() => setIsLocationPickerOpen((prev) => !prev)}
                className="text-amber-300 hover:text-amber-200 font-bold underline underline-offset-2"
              >
                {isLocationPickerOpen ? 'بستن انتخاب شهر' : 'تغییر استان / شهر'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleToggleWeatherVoice()}
            disabled={isVoiceLoading || isLoading || !weatherData}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm border ${
              isVoicePlaying
                ? 'bg-amber-400 border-amber-300 text-stone-950 animate-pulse'
                : isVoiceLoading
                ? 'bg-white/15 border-white/25 text-amber-200 cursor-wait'
                : 'bg-amber-400 hover:bg-amber-300 border-amber-300 text-stone-950'
            }`}
          >
            {isVoiceLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>آماده‌سازی گزارش صوتی...</span>
              </>
            ) : isVoicePlaying ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>توقف پخش صوتی</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>پخش گزارش صوتی به روز</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void fetchLiveWeather(selectedProvince, selectedCity)}
            disabled={isLoading}
            title="به‌روزرسانی لحظه‌ای هواشناسی"
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {floating && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              title="جمع‌کردن پنجره هواشناسی"
              className="px-2.5 h-8 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center gap-1 text-[11px] font-bold text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">جمع‌کردن</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Quick Location Switcher (Nationwide Search + All 31 Iranian Provinces & Counties/Cities + Custom Typing) */}
      {isLocationPickerOpen && (
        <div className="p-3 bg-black/30 border-b border-white/10 space-y-2.5 text-xs animate-fade-in">
          {/* Quick Nationwide Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={quickLocationSearch}
              onChange={(e) => setQuickLocationSearch(e.target.value)}
              placeholder="🔍 جستجوی سریع شهر یا شهرستان در سراسر کشور (مثلاً: رفسنجان، مریوان، لاهیجان...)"
              className="w-full px-3 py-1.5 rounded-xl bg-stone-900/90 border border-white/25 text-white text-xs placeholder:text-stone-400"
            />
            {quickSearchMatches.length > 0 && (
              <div className="mt-1 max-h-36 overflow-y-auto rounded-xl bg-stone-900 border border-white/20 divide-y divide-white/10">
                {quickSearchMatches.map((m) => (
                  <button
                    key={`${m.province}-${m.city}`}
                    type="button"
                    onClick={() => {
                      setSelectedProvince(m.province);
                      setSelectedCity(m.city);
                      setQuickLocationSearch('');
                      setIsLocationPickerOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-right hover:bg-white/10 flex items-center justify-between text-[11px]"
                  >
                    <span className="font-bold text-white">{m.city}</span>
                    <span className="text-emerald-300 text-[10px]">استان {m.province}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-emerald-200 mb-1 font-semibold">
                انتخاب استان:
              </label>
              <select
                value={selectedProvince}
                onChange={(e) => {
                  const nextProv = e.target.value;
                  setSelectedProvince(nextProv);
                  const list = getCitiesByProvince(nextProv);
                  setSelectedCity(list[0] || nextProv);
                }}
                className="w-full px-2.5 py-1.5 rounded-xl bg-stone-900/90 border border-white/20 text-white text-xs"
              >
                {IRAN_PROVINCES.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-emerald-200 mb-1 font-semibold">
                انتخاب شهر / شهرستان:
              </label>
              <select
                value={provinceCities.includes(selectedCity) ? selectedCity : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedCity(e.target.value);
                    setIsLocationPickerOpen(false);
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-xl bg-stone-900/90 border border-white/20 text-white text-xs"
              >
                {!provinceCities.includes(selectedCity) && (
                  <option value="">{selectedCity} (دلخواه)</option>
                )}
                {provinceCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customCityDraft.trim()) {
                  setSelectedCity(customCityDraft.trim());
                  setCustomCityDraft('');
                  setIsLocationPickerOpen(false);
                }
              }}
              className="flex items-end gap-1.5"
            >
              <div className="flex-1">
                <label className="block text-[10px] text-emerald-200 mb-1 font-semibold">
                  یا تایپ دستی شهر/روستا:
                </label>
                <input
                  type="text"
                  value={customCityDraft}
                  onChange={(e) => setCustomCityDraft(e.target.value)}
                  placeholder="نام شهر یا روستای شما..."
                  className="w-full px-2.5 py-1.5 rounded-xl bg-stone-900/90 border border-white/20 text-white text-xs placeholder:text-stone-400"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0"
              >
                نمایش
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Voice Error Notice & Always-Visible Weather Voice Briefing Transcript */}
      {voiceError && (
        <div className="mx-3.5 mt-3 p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-[11px] text-rose-200">
          ⚠️ {voiceError}
        </div>
      )}
      {weatherData && (voiceScript || weatherData.voiceScript) && (
        <div
          className={`mx-3.5 mt-3 p-3 rounded-xl border text-[11px] leading-relaxed space-y-1 transition-all ${
            isVoicePlaying
              ? 'bg-amber-950/45 border-amber-400/70 text-amber-50 shadow-md'
              : 'bg-black/25 border-white/15 text-stone-100'
          }`}
        >
          <div className="font-bold text-amber-300 flex items-center justify-between gap-1.5">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              <span>
                {isVoicePlaying
                  ? `در حال پخش گزارش صوتی هواشناسی ${weatherData.location.city}:`
                  : `متن کامل گزارش هواشناسی و اقدام‌های امروز (${weatherData.location.city}):`}
              </span>
            </span>
            <span className="text-[9.5px] text-emerald-200 font-normal">
              قابل مطالعه حتی بدون پخش صدا
            </span>
          </div>
          <p>{voiceScript || weatherData.voiceScript}</p>
        </div>
      )}

      {/* Weather Content Body */}
      {isLoading && !weatherData ? (
        <div className="p-5 flex items-center justify-center gap-2 text-xs text-emerald-100">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>در حال دریافت داده‌های زنده هواشناسی و دمای خاک برای {selectedCity}...</span>
        </div>
      ) : weatherError && !weatherData ? (
        <div className="p-4 text-center space-y-2 text-xs text-rose-200">
          <p>⚠️ {weatherError}</p>
          <button
            type="button"
            onClick={() => void fetchLiveWeather(selectedProvince, selectedCity)}
            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold"
          >
            تلاش مجدد
          </button>
        </div>
      ) : weatherData ? (
        <div className="p-3.5 sm:p-4 space-y-3.5">
          {/* Primary Hero Temp + Agronomic Telemetry Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Current Condition & Temp */}
            <div className="md:col-span-5 flex items-center gap-3.5 bg-white/8 rounded-2xl p-3 border border-white/10">
              <WeatherIllustrationSvg
                conditionKey={weatherData.current.conditionKey}
                isDay={weatherData.current.isDay}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold font-mono tabular-nums tracking-tight">
                    {weatherData.current.temperature.toLocaleString('fa-IR')}°
                  </span>
                  <span className="text-xs text-emerald-200 font-semibold">سانتی‌گراد</span>
                </div>
                <div className="text-xs font-bold text-amber-200 mt-0.5">
                  {weatherData.current.conditionLabel}
                </div>
                <div className="text-[10.5px] text-stone-300 mt-1 flex flex-wrap items-center gap-x-2 tabular-nums">
                  <span>دمای محسوس {weatherData.current.apparentTemperature.toLocaleString('fa-IR')}°</span>
                  <span>·</span>
                  <span>
                    بیشینه {weatherData.forecast[0]?.tempMax.toLocaleString('fa-IR')}° / کمینه{' '}
                    {weatherData.forecast[0]?.tempMin.toLocaleString('fa-IR')}°
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Key Agricultural & Atmospheric Metrics */}
            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-white/8 rounded-xl p-2.5 border border-white/10 space-y-1">
                <div className="flex items-center gap-1 text-sky-200 text-[10px]">
                  <Droplets className="w-3.5 h-3.5" />
                  <span>رطوبت هوا</span>
                </div>
                <div className="text-sm font-extrabold font-mono tabular-nums">
                  {weatherData.current.humidity.toLocaleString('fa-IR')}٪
                </div>
                <div className="text-[9.5px] text-stone-300">
                  احتمال بارش: {weatherData.current.precipitationProbability.toLocaleString('fa-IR')}٪
                </div>
              </div>

              <div className="bg-white/8 rounded-xl p-2.5 border border-white/10 space-y-1">
                <div className="flex items-center gap-1 text-amber-200 text-[10px]">
                  <Wind className="w-3.5 h-3.5" />
                  <span>سرعت باد</span>
                </div>
                <div className="text-sm font-extrabold font-mono tabular-nums">
                  {weatherData.current.windSpeed.toLocaleString('fa-IR')} km/h
                </div>
                <div className="text-[9.5px] text-stone-300">
                  {weatherData.current.windSpeed <= 18 ? 'مناسب محلول‌پاشی' : 'باد شدید / احتیاط'}
                </div>
              </div>

              <div className="bg-white/8 rounded-xl p-2.5 border border-white/10 space-y-1">
                <div className="flex items-center gap-1 text-emerald-300 text-[10px]">
                  <Thermometer className="w-3.5 h-3.5" />
                  <span>دما و رطوبت خاک</span>
                </div>
                <div className="text-sm font-extrabold font-mono tabular-nums">
                  {weatherData.current.soilTemp !== null
                    ? `${Math.round(weatherData.current.soilTemp).toLocaleString('fa-IR')}°`
                    : `${weatherData.current.temperature.toLocaleString('fa-IR')}°`}
                </div>
                <div className="text-[9.5px] text-stone-300">
                  {weatherData.current.soilMoisturePct !== null
                    ? `رطوبت لایه سطحی: ${weatherData.current.soilMoisturePct.toLocaleString('fa-IR')}٪`
                    : 'لایه ریشه سطحی'}
                </div>
              </div>

              <div className="bg-white/8 rounded-xl p-2.5 border border-white/10 space-y-1">
                <div className="flex items-center gap-1 text-lime-300 text-[10px]">
                  <Sprout className="w-3.5 h-3.5" />
                  <span>تبخیر (ET0) و نور</span>
                </div>
                <div className="text-sm font-extrabold font-mono tabular-nums">
                  {weatherData.current.et0Today.toLocaleString('fa-IR')} mm
                </div>
                <div className="text-[9.5px] text-stone-300 flex items-center gap-1">
                  <Sunrise className="w-2.5 h-2.5 text-amber-300" />
                  <span className="font-mono">{weatherData.current.sunrise}</span>
                  <span>-</span>
                  <Sunset className="w-2.5 h-2.5 text-orange-300" />
                  <span className="font-mono">{weatherData.current.sunset}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Graphical 7-Day Forecast Strip with Proportional Temperature Range Bars */}
          <div className="bg-black/20 rounded-2xl p-3 border border-white/10">
            <div className="flex items-center justify-between text-[10.5px] text-emerald-200 font-bold mb-2">
              <span>پیش‌بینی گرافیکی ۷ روز آینده و بارندگی</span>
              <span className="text-[10px] text-stone-300 font-normal">
                کمینه / بیشینه دمای هفته ({weeklyRange.min.toLocaleString('fa-IR')}° تا{' '}
                {weeklyRange.max.toLocaleString('fa-IR')}°)
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 overflow-x-auto">
              {weatherData.forecast.map((day) => {
                const span = weeklyRange.max - weeklyRange.min || 1;
                const leftPct = Math.max(0, Math.min(92, ((day.tempMin - weeklyRange.min) / span) * 100));
                const widthPct = Math.max(12, Math.min(100 - leftPct, ((day.tempMax - day.tempMin) / span) * 100));
                return (
                  <div
                    key={day.date}
                    className="rounded-xl bg-white/8 border border-white/10 px-1.5 py-2 flex flex-col items-center justify-between gap-1.5 text-center min-w-[44px]"
                    title={`${day.dayLabel}: ${day.conditionLabel} | حداکثر ${day.tempMax}° حداقل ${day.tempMin}°`}
                  >
                    <span className="text-[10px] font-bold text-stone-100 truncate w-full">
                      {day.dayLabel}
                    </span>
                    <WeatherIllustrationSvg conditionKey={day.conditionKey} size="sm" />
                    <div className="w-full px-1 space-y-1">
                      <div className="flex items-center justify-between text-[9.5px] font-mono tabular-nums">
                        <span className="text-sky-200">{day.tempMin.toLocaleString('fa-IR')}°</span>
                        <span className="text-amber-200 font-bold">{day.tempMax.toLocaleString('fa-IR')}°</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/15 relative overflow-hidden" dir="ltr">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-400"
                          style={{
                            marginLeft: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-[9px] text-sky-200 font-mono flex items-center gap-0.5">
                      <CloudRain className="w-2.5 h-2.5" />
                      <span>{day.precipProb.toLocaleString('fa-IR')}٪</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Gardening & Farming Action Recommendations */}
          <div className="bg-black/20 rounded-2xl border border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsAdvisoriesExpanded((prev) => !prev)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-right text-xs font-bold text-amber-200 hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Sprout className="w-4 h-4 text-emerald-300" />
                <span>توصیه‌های کاربردی باغبانی و تغذیه خاک برای هوای امروز {weatherData.location.city}</span>
              </span>
              {isAdvisoriesExpanded ? (
                <ChevronUp className="w-4 h-4 text-stone-300" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-300" />
              )}
            </button>

            {isAdvisoriesExpanded && (
              <div className="px-3.5 pb-3.5 grid grid-cols-1 md:grid-cols-3 gap-2">
                {weatherData.advisories.map((adv) => {
                  const styleCls =
                    adv.severity === 'alert'
                      ? 'bg-rose-950/55 border-rose-500/40 text-rose-100'
                      : adv.severity === 'caution'
                      ? 'bg-amber-950/50 border-amber-400/40 text-amber-100'
                      : 'bg-emerald-950/55 border-emerald-500/35 text-emerald-50';
                  return (
                    <div
                      key={adv.id}
                      className={`p-2.5 rounded-xl border text-[10.5px] leading-relaxed space-y-1 ${styleCls}`}
                    >
                      <div className="font-bold text-[11px] flex items-center justify-between gap-1">
                        <span>{adv.title}</span>
                      </div>
                      <p className="opacity-90">{adv.detail}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );

  if (floating) {
    return (
      <div
        className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-5 animate-fade-in"
        onClick={() => setIsExpanded(false)}
      >
        <div
          className="w-full max-w-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          {weatherCardContent}
        </div>
      </div>
    );
  }

  return weatherCardContent;
}
