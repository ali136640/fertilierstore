export interface SafeJsonResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  isHtmlOrInvalid: boolean;
  errorMessage?: string;
}

/**
 * Safely parses any fetch Response without ever throwing `Unexpected token '<', "<!doctype "... is not valid JSON`
 */
export async function parseJsonResponseSafe<T = any>(
  resp: Response,
  fallbackError = 'پاسخ معتبری از سرور دریافت نشد.'
): Promise<SafeJsonResult<T>> {
  let rawText = '';
  try {
    rawText = await resp.text();
  } catch {
    return {
      ok: false,
      status: resp.status,
      data: null,
      isHtmlOrInvalid: true,
      errorMessage: fallbackError,
    };
  }

  const trimmed = rawText.trim();
  const looksLikeHtml =
    trimmed.startsWith('<') ||
    /^<!doctype/i.test(trimmed) ||
    /^<html/i.test(trimmed);

  if (!trimmed || looksLikeHtml) {
    return {
      ok: false,
      status: resp.status,
      data: null,
      isHtmlOrInvalid: true,
      errorMessage:
        'سرویس هوش مصنوعی موقتاً شلوغ است یا پاسخ غیرمعتبر ارسال کرد؛ لطفاً مجدد تلاش کنید.',
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as T;
    const errMsg =
      parsed && typeof parsed === 'object' && 'error' in (parsed as any)
        ? String((parsed as any).error || '')
        : undefined;
    return {
      ok: resp.ok,
      status: resp.status,
      data: parsed,
      isHtmlOrInvalid: false,
      errorMessage: !resp.ok ? errMsg || fallbackError : undefined,
    };
  } catch {
    return {
      ok: false,
      status: resp.status,
      data: null,
      isHtmlOrInvalid: true,
      errorMessage: fallbackError,
    };
  }
}

/**
 * Reliable client-side Persian Web Speech playback fallback when cloud TTS is busy or unavailable
 */
export function speakPersianBrowserVoice(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: () => void
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) {
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.trim());
    utter.lang = 'fa-IR';
    utter.rate = 0.96;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const faVoice =
      voices.find((v) => v.lang?.toLowerCase().startsWith('fa')) ||
      voices.find((v) => v.lang?.toLowerCase().includes('ir'));
    if (faVoice) {
      utter.voice = faVoice;
    }
    utter.onstart = () => onStart?.();
    utter.onend = () => onEnd?.();
    utter.onerror = () => onError?.();
    onStart?.();
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    return false;
  }
}
