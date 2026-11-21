import React, { useState, useId, useEffect, useRef } from 'react';
import { authenticateUser, saveUserAccount, loadUserAccounts, setCurrentUser, normalizeDigits } from '../utils/storeStorage';
import { UserAccount } from '../types/storefront';
import { IRAN_PROVINCES } from '../data/iranCities';
import { IranLocationSelector } from './IranLocationSelector';
import { resolveAssetOrApiUrl } from '../utils/apiBase';
import {
  isInsideTelegramWebApp,
  getTelegramCustomerProfile,
  getCachedTelegramPhone,
  resolveTelegramUserPhoneFromServer,
  requestTelegramMiniAppContact,
  canRequestTelegramMiniAppContact,
  syncTelegramPhoneToServer,
} from '../utils/telegramWebApp';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserAccount) => void;
  initialMode?: 'login' | 'register';
  adminOnly?: boolean;
  appLogoSrc?: string;
  workshopName?: string;
}

export function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
  initialMode = 'login',
  adminOnly = false,
  appLogoSrc,
  workshopName = 'گروه تولیدی و زیست‌فناوری مهندس صفری',
}: AuthModalProps) {
  const resolvedLogoSrc = resolveAssetOrApiUrl(appLogoSrc, 'pwa-192x192.png');
  const [mode, setMode] = useState<'login' | 'register'>(adminOnly ? 'login' : initialMode);

  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regProvince, setRegProvince] = useState(IRAN_PROVINCES[0].name);
  const [regCity, setRegCity] = useState(IRAN_PROVINCES[0].cities[0]);
  const [regAddress, setRegAddress] = useState('');
  const [regFarmingType, setRegFarmingType] = useState('orchard');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inTelegram, setInTelegram] = useState(false);
  const [tgDetectedPhone, setTgDetectedPhone] = useState('');
  const [tgAccountExists, setTgAccountExists] = useState<boolean | null>(null);
  const [isFetchingTgPhone, setIsFetchingTgPhone] = useState(false);
  const hasAutoRequestedTgRef = useRef(false);

  const phoneInputId = useId();
  const passInputId = useId();

  const applyDetectedTelegramInfo = (phone?: string, fullName?: string) => {
    const cleanPhone = (phone || '').trim();
    const cleanName = (fullName || '').trim();
    if (cleanPhone) {
      setTgDetectedPhone(cleanPhone);
      setLoginIdentifier((prev) => (prev.trim() ? prev : cleanPhone));
      setRegPhone((prev) => (prev.trim() ? prev : cleanPhone));
      const cleanNorm = normalizeDigits(cleanPhone);
      const exists = loadUserAccounts().some(
        (u) => u.role === 'customer' && normalizeDigits(u.phoneNumber) === cleanNorm
      );
      setTgAccountExists(exists);
    }
    if (cleanName) {
      setRegFullName((prev) => (prev.trim() ? prev : cleanName));
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setMode(adminOnly ? 'login' : initialMode);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (adminOnly) return;

    const insideTg = isInsideTelegramWebApp();
    setInTelegram(insideTg);

    const tgProfile = getTelegramCustomerProfile();
    const cachedPhone = getCachedTelegramPhone();
    applyDetectedTelegramInfo(cachedPhone || tgProfile?.phoneNumber, tgProfile?.fullName);

    if (!insideTg) return;

    let cancelled = false;
    void (async () => {
      const resolved = await resolveTelegramUserPhoneFromServer();
      if (cancelled) return;
      if (resolved.phoneNumber) {
        applyDetectedTelegramInfo(resolved.phoneNumber, resolved.fullName || tgProfile?.fullName);
        return;
      }

      if (!cachedPhone && !tgProfile?.phoneNumber && !hasAutoRequestedTgRef.current && canRequestTelegramMiniAppContact()) {
        hasAutoRequestedTgRef.current = true;
        setIsFetchingTgPhone(true);
        const requestedPhone = await requestTelegramMiniAppContact();
        if (cancelled) return;
        setIsFetchingTgPhone(false);
        if (requestedPhone) {
          applyDetectedTelegramInfo(requestedPhone, tgProfile?.fullName);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, initialMode, adminOnly]);

  const handleManualTelegramPhoneRequest = async () => {
    setErrorMessage(null);
    setIsFetchingTgPhone(true);
    try {
      const phone = await requestTelegramMiniAppContact();
      const tgProfile = getTelegramCustomerProfile();
      if (phone) {
        applyDetectedTelegramInfo(phone, tgProfile?.fullName);
      } else {
        setErrorMessage('برای دریافت خودکار شماره، در پنجره تلگرام گزینه اشتراک‌گذاری شماره را تایید کنید یا شماره را دستی بنویسید.');
      }
    } finally {
      setIsFetchingTgPhone(false);
    }
  };

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setErrorMessage('لطفاً نام کاربری / شماره همراه و رمز عبور را وارد فرمایید.');
      return;
    }

    const user = authenticateUser(loginIdentifier, loginPassword);
    if (!user) {
      setErrorMessage('اطلاعات ورود اشتباه است. لطفاً دقت فرمایید.');
      return;
    }

    if (adminOnly && user.role !== 'admin') {
      setErrorMessage('این حساب کاربری دسترسی مدیریت ندارد.');
      return;
    }

    let finalUser: UserAccount = user;
    const tgProfile = getTelegramCustomerProfile();
    if (!adminOnly && user.role === 'customer' && (inTelegram || tgProfile || tgDetectedPhone)) {
      const needsLinkUpdate =
        !user.telegramLinked ||
        (tgProfile?.id && user.telegramUserId !== String(tgProfile.id)) ||
        (tgProfile?.username && user.telegramUsername !== tgProfile.username);

      if (needsLinkUpdate) {
        finalUser = {
          ...user,
          telegramLinked: true,
          ...(tgProfile?.id ? { telegramUserId: String(tgProfile.id) } : {}),
          ...(tgProfile?.username ? { telegramUsername: tgProfile.username } : {}),
          ...(tgProfile?.fullName ? { telegramFullName: tgProfile.fullName } : {}),
        };
        await saveUserAccount(finalUser);
      }
      if (finalUser.phoneNumber) {
        void syncTelegramPhoneToServer(finalUser.phoneNumber, finalUser.fullName, tgProfile?.username);
      }
    }

    // Persist session to local storage immediately
    setCurrentUser(finalUser);
    setSuccessMessage(`ورود موفقیت‌آمیز. خوش آمدید، ${finalUser.fullName}`);
    setTimeout(() => {
      onLoginSuccess(finalUser);
      onClose();
    }, 250);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regFullName.trim() || !regPhone.trim() || !regPassword.trim()) {
      setErrorMessage('لطفاً نام، شماره همراه و رمز عبور را وارد نمایید.');
      return;
    }

    const cleanRegPhone = normalizeDigits(regPhone.trim());
    if (cleanRegPhone.length < 10) {
      setErrorMessage('شماره همراه معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)');
      return;
    }

    const existingUsers = loadUserAccounts();
    if (existingUsers.some(u => normalizeDigits(u.phoneNumber) === cleanRegPhone)) {
      setErrorMessage('این شماره همراه قبلاً در سیستم ثبت شده است.');
      return;
    }

    if (!regProvince.trim() || !regCity.trim()) {
      setErrorMessage('لطفاً استان و شهر یا نام روستای خود را انتخاب یا تایپ نمایید.');
      return;
    }

    const tgProfile = getTelegramCustomerProfile();
    const hasTelegram = Boolean(inTelegram || tgProfile || tgDetectedPhone);

    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      phoneNumber: cleanRegPhone,
      password: regPassword.trim(),
      fullName: regFullName.trim(),
      role: 'customer',
      province: regProvince.trim(),
      city: regCity.trim(),
      address: regAddress.trim(),
      farmingType: regFarmingType,
      ...(hasTelegram
        ? {
            telegramLinked: true,
            ...(tgProfile?.id ? { telegramUserId: String(tgProfile.id) } : {}),
            ...(tgProfile?.username ? { telegramUsername: tgProfile.username } : {}),
            ...(tgProfile?.fullName ? { telegramFullName: tgProfile.fullName } : {}),
          }
        : {}),
      createdAt: new Date().toLocaleDateString('fa-IR'),
    };

    await saveUserAccount(newUser);
    setCurrentUser(newUser);
    if (hasTelegram) {
      void syncTelegramPhoneToServer(newUser.phoneNumber, newUser.fullName, tgProfile?.username);
    }
    setSuccessMessage('ثبت‌نام با موفقیت انجام شد و در پایگاه داده ابری ذخیره گردید!');
    setTimeout(() => {
      onLoginSuccess(newUser);
      onClose();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/75 backdrop-blur-md animate-fade-in text-right" dir="rtl">
      <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200 dark:border-stone-800 transition-all">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-stone-900 to-emerald-950 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute left-4 top-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-sm"
            title="بستن"
          >
            ✕
          </button>
          
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img
                src={resolvedLogoSrc}
                alt={workshopName}
                className="w-11 h-11 rounded-xl object-cover border border-white/25 bg-white shadow-sm"
              />
              {adminOnly && (
                <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-amber-500 text-stone-950 text-[10px] flex items-center justify-center shadow">
                  🔒
                </span>
              )}
            </div>
            <div>
              <h2 className="text-base font-bold">
                {adminOnly ? 'ورود امن به پنل مدیریت کارگاه' : 'ورود / ثبت‌نام مشتریان'}
              </h2>
              <p className="text-[11px] text-emerald-200 mt-0.5">
                {workshopName}
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs (Only if not adminOnly) */}
          {!adminOnly && (
            <div className="flex mt-5 bg-black/30 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMessage(null); }}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-white text-stone-900 shadow font-bold'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                ورود به حساب
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setErrorMessage(null); }}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  mode === 'register'
                    ? 'bg-white text-stone-900 shadow font-bold'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                ثبت‌نام مشتری جدید
              </button>
            </div>
          )}
        </div>

        {/* Form Body */}
        <div className="p-6">
          {!adminOnly && (inTelegram || Boolean(tgDetectedPhone)) && (
            <div className="mb-4 p-3 rounded-2xl border bg-sky-50/90 dark:bg-sky-950/35 border-sky-200 dark:border-sky-800/70 text-xs flex items-center justify-between gap-2">
              {tgDetectedPhone ? (
                <div className="flex flex-col gap-1 text-emerald-800 dark:text-emerald-300 font-semibold w-full">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span>✅</span>
                      <span>
                        شماره تلگرام شما شناسایی شد:{' '}
                        <span className="font-mono font-bold" dir="ltr">{tgDetectedPhone}</span>
                      </span>
                    </div>
                    {tgAccountExists === false && mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setMode('register'); setErrorMessage(null); }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold transition-colors"
                      >
                        تکمیل ثبت‌نام ←
                      </button>
                    )}
                    {tgAccountExists === true && mode === 'register' && (
                      <button
                        type="button"
                        onClick={() => { setMode('login'); setErrorMessage(null); }}
                        className="px-2.5 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-[11px] font-bold transition-colors"
                      >
                        ورود به حساب ←
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-sky-900 dark:text-sky-200 leading-snug">
                    <div className="font-bold">ورود از طریق تلگرام شناسایی شد</div>
                    <div className="text-[11px] opacity-85 mt-0.5">
                      شماره موبایل خود را با یک لمس دریافت و خودکار جایگذاری کنید.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isFetchingTgPhone}
                    onClick={handleManualTelegramPhoneRequest}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-60 text-white font-bold text-[11px] shadow-xs transition-all"
                  >
                    {isFetchingTgPhone ? 'در حال دریافت...' : '📱 دریافت شماره از تلگرام'}
                  </button>
                </>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
              <span>✓</span>
              <span>{successMessage}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor={phoneInputId} className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                  {adminOnly ? 'نام کاربری مدیریت' : 'نام کاربری / شماره همراه'}
                </label>
                <input
                  id={phoneInputId}
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder={adminOnly ? 'نام کاربری مدیریت را وارد کنید' : 'شماره همراه یا نام کاربری'}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono text-left"
                  dir="ltr"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor={passInputId} className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                  رمز عبور
                </label>
                <input
                  id={passInputId}
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 text-left font-mono"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                className={`w-full py-3 text-white font-bold rounded-xl shadow-lg text-sm transition-all flex items-center justify-center gap-2 ${
                  adminOnly
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20'
                }`}
              >
                <span>{adminOnly ? 'احراز هویت و ورود به پنل مدیریت' : 'ورود به حساب کاربری'}</span>
                <span>←</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  نام و نام خانوادگی خریدار / باغدار
                </label>
                <input
                  type="text"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="مثال: مهندس حسینی"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    شماره همراه
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="۰۹..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    رمز عبور دلخواه
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Complete List of 31 Provinces & Cities + Custom Typing */}
              <IranLocationSelector
                province={regProvince}
                city={regCity}
                onProvinceChange={setRegProvince}
                onCityChange={setRegCity}
              />

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  حوزه فعالیت کشاورزی
                </label>
                <select
                  value={regFarmingType}
                  onChange={(e) => setRegFarmingType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs"
                >
                  <option value="orchard">باغداری (پسته، گردو، مرکبات، سیب، زیتون)</option>
                  <option value="houseplants">گیاهان آپارتمانی و گل‌های خانگی / گلخانه خانگی</option>
                  <option value="greenhouse">گلخانه صنعتی صیفی‌جات (توت‌فرنگی، گوجه، خیار)</option>
                  <option value="farming">زراعت، غلات، زعفران و علوفه</option>
                  <option value="industrial">تولیدکننده کود و اصلاح‌کننده خاک</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  آدرس دقیق برای تخلیه باربری یا وانت
                </label>
                <textarea
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  rows={2}
                  placeholder="آدرس دقیق باغ، گلخانه یا منزل جهت ارسال کالا..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow text-xs transition-all"
              >
                تکمیل ثبت‌نام و ورود به فروشگاه
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
