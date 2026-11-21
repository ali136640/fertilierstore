import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'خطای غیرمنتظره';
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown) {
    console.error('App render boundary caught error:', error);
  }

  private handleResetAndReload = async () => {
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
      }
    } catch {
      // ignore cleanup failures
    }
    try {
      localStorage.removeItem('safari_store_settings_v3');
      localStorage.removeItem('safari_store_products_override_v3');
      localStorage.removeItem('safari_vermi_workshop_data_v3');
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        dir="rtl"
        className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex items-center justify-center p-4"
      >
        <div className="max-w-md w-full rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center text-2xl mx-auto">
            ⚠️
          </div>
          <h1 className="text-base font-bold">خطا در بارگذاری رابط کاربری</h1>
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            برای جلوگیری از صفحه سفید، برنامه متوقف شد. با پاکسازی کش موقت می‌توانید دوباره وارد شوید.
          </p>
          {this.state.errorMessage && (
            <div
              dir="ltr"
              className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-[11px] font-mono text-rose-700 dark:text-rose-300 break-all text-left"
            >
              {this.state.errorMessage}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              بارگذاری مجدد
            </button>
            <button
              type="button"
              onClick={() => void this.handleResetAndReload()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100 text-xs font-bold"
            >
              پاکسازی کش و بازنشانی
            </button>
          </div>
        </div>
      </div>
    );
  }
}
