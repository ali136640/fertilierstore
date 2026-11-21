const RUNTIME_API_BASE_STORAGE_KEY = 'safari_api_base_url_v1';

export function isDeadLegacyHostUrl(raw?: string | null): boolean {
  const s = String(raw || '').trim();
  return /^https?:\/\/fertilierstore\.ai\.studio(?:[/?#:]|$)/i.test(s);
}

export function normalizeBaseUrl(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return '';
  if (isDeadLegacyHostUrl(trimmed)) return '';
  return trimmed.replace(/\/+$/, '');
}

export function isStaticHostingEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = (window.location.hostname || '').toLowerCase();
  const proto = (window.location.protocol || '').toLowerCase();
  return (
    proto === 'file:' ||
    host.endsWith('.github.io') ||
    host === 'github.io' ||
    host.endsWith('.pages.dev') ||
    host.endsWith('.netlify.app') ||
    host.endsWith('.vercel.app')
  );
}

export function isGithubPagesHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = (window.location.hostname || '').toLowerCase();
  return host.endsWith('.github.io') || host === 'github.io';
}

export function resolveGithubOwnerRepoFromLocation(): { owner: string; repo: string } | null {
  if (typeof window === 'undefined') return null;
  const host = (window.location.hostname || '').toLowerCase();
  if (!host.endsWith('.github.io')) return null;
  const owner = host.slice(0, -'.github.io'.length).trim();
  if (!owner) return null;
  const segments = (window.location.pathname || '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  const repo = segments[0] || `${owner}.github.io`;
  return { owner, repo };
}

export function getApiBaseUrl(): string {
  // Always use same-origin relative /api/* routes when hosted on a live Express backend
  // (Dev, Preview, or custom Node domain) so stale localStorage URLs cannot cause proxy redirects.
  if (typeof window !== 'undefined' && !isStaticHostingEnvironment()) {
    return '';
  }

  if (typeof window !== 'undefined') {
    try {
      const saved = normalizeBaseUrl(localStorage.getItem(RUNTIME_API_BASE_STORAGE_KEY));
      if (saved) {
        const currentOrigin = normalizeBaseUrl(window.location.origin);
        if (saved !== currentOrigin) {
          return saved;
        }
      }
    } catch {
      // ignore storage access issues
    }
  }

  const envUrl = normalizeBaseUrl(
    typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_BASE_URL : ''
  );
  if (envUrl) {
    if (typeof window !== 'undefined' && envUrl === normalizeBaseUrl(window.location.origin)) {
      return '';
    }
    return envUrl;
  }

  return '';
}

export function setRuntimeApiBaseUrl(raw?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = normalizeBaseUrl(raw);
    if (!clean || clean === normalizeBaseUrl(window.location.origin)) {
      localStorage.removeItem(RUNTIME_API_BASE_STORAGE_KEY);
    } else {
      localStorage.setItem(RUNTIME_API_BASE_STORAGE_KEY, clean);
    }
  } catch {
    // ignore storage errors
  }
}

export function resolveApiUrl(pathOrUrl: string): string {
  const input = String(pathOrUrl || '').trim();
  if (!input) return input;
  if (/^https?:\/\//i.test(input)) return input;
  const normalizedPath = input.startsWith('/') ? input : `/${input}`;
  if (!normalizedPath.startsWith('/api/') && normalizedPath !== '/api') {
    return input;
  }
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function resolvePublicAssetUrl(assetPath: string): string {
  const clean = String(assetPath || '').trim().replace(/^\/+/, '');
  const viteBase =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL) || '/';
  const normalizedBase = viteBase.endsWith('/') ? viteBase : `${viteBase}/`;
  return `${normalizedBase}${clean}`;
}

export function resolveAssetOrApiUrl(
  rawUrl?: string | null,
  fallbackPublicAsset = 'pwa-192x192.png'
): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return resolvePublicAssetUrl(fallbackPublicAsset);
  }
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    /^https?:\/\//i.test(trimmed)
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/api/') || trimmed.startsWith('api/')) {
    return resolveApiUrl(trimmed);
  }
  if (trimmed.startsWith('/')) {
    return resolvePublicAssetUrl(trimmed);
  }
  return trimmed;
}

export function initApiBaseFromQueryAndInstallFetchBridge(): void {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    const apiParam = url.searchParams.get('api') || url.searchParams.get('backend');
    if (apiParam) {
      const clean = normalizeBaseUrl(apiParam);
      if (clean) {
        setRuntimeApiBaseUrl(clean);
      }
      url.searchParams.delete('api');
      url.searchParams.delete('backend');
      window.history.replaceState({}, '', url.toString());
    }
  } catch {
    // ignore invalid URLs or restricted history APIs
  }
}

export function parseGithubRepoInput(raw: string): { owner: string; repo: string } | null {
  const cleaned = String(raw || '').trim();
  if (!cleaned) return null;

  // Match https://github.com/owner/repo or git@github.com:owner/repo.git
  const urlMatch = cleaned.match(/github\.com[:/]([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+?)(?:\.git|\/|$)/i);
  if (urlMatch) {
    return {
      owner: urlMatch[1].trim(),
      repo: urlMatch[2].replace(/\.git$/i, '').trim(),
    };
  }

  // Match owner/repo
  const slashMatch = cleaned.match(/^([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/);
  if (slashMatch) {
    return {
      owner: slashMatch[1].trim(),
      repo: slashMatch[2].replace(/\.git$/i, '').trim(),
    };
  }

  return null;
}

export function buildGithubPagesUrl(params: {
  owner?: string;
  repo?: string;
  customDomain?: string;
  apiBaseUrl?: string;
  includeApiQuery?: boolean;
}): string {
  const customDomain = String(params.customDomain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  const owner = String(params.owner || '').trim();
  const repo = String(params.repo || '').trim();

  let baseUrl = '';
  if (customDomain) {
    baseUrl = `https://${customDomain}/`;
  } else if (owner && repo) {
    if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
      baseUrl = `https://${owner}.github.io/`;
    } else {
      baseUrl = `https://${owner}.github.io/${repo}/`;
    }
  } else if (owner) {
    baseUrl = `https://${owner}.github.io/`;
  }

  if (!baseUrl) return '';

  const api = normalizeBaseUrl(params.apiBaseUrl);
  if (params.includeApiQuery && api) {
    return `${baseUrl}?api=${encodeURIComponent(api)}`;
  }
  return baseUrl;
}
