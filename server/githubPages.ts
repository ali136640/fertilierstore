import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Express, Request, Response } from 'express';

const execFileAsync = promisify(execFile);

const DEFAULT_BRANCH = 'main';
const WORKFLOW_FILENAME = 'deploy-pages.yml';

function sanitizeGithubSegment(raw: unknown): string {
  return String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '');
}

function isDeadLegacyDomain(raw: unknown): boolean {
  return /fertilierstore\.ai\.studio/i.test(String(raw || ''));
}

function sanitizeCustomDomain(raw: unknown): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-zA-Z0-9.-]/g, '');
  if (!cleaned || isDeadLegacyDomain(cleaned)) return '';
  return cleaned;
}

function resolveCleanBackendApiBaseUrl(candidate?: unknown): string {
  const raw = String(candidate || '').trim().replace(/\/+$/, '');
  if (raw && /^https?:\/\//i.test(raw) && !isDeadLegacyDomain(raw)) {
    return raw;
  }
  const envApp = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envApp && /^https?:\/\//i.test(envApp) && !isDeadLegacyDomain(envApp)) {
    return envApp;
  }
  return '';
}

function computePagesUrl(owner: string, repo: string, customDomain: string): string {
  if (customDomain) {
    return `https://${customDomain}/`;
  }
  if (!owner) return '';
  if (!repo || repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
    return `https://${owner}.github.io/`;
  }
  return `https://${owner}.github.io/${repo}/`;
}

function buildWorkflowYamlContent(branch = DEFAULT_BRANCH): string {
  const cleanBranch = sanitizeGithubSegment(branch) || DEFAULT_BRANCH;
  return `name: Deploy to GitHub Pages

on:
  push:
    branches:
      - "${cleanBranch}"
  workflow_dispatch:
    inputs:
      api_base_url:
        description: "Backend API Server URL (optional override)"
        required: false
        default: ""
      custom_domain:
        description: "Custom domain for CNAME (optional)"
        required: false
        default: ""

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build_and_deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: |
          if [ -f package-lock.json ]; then
            npm ci --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps
          else
            npm install --no-audit --no-fund --legacy-peer-deps
          fi

      - name: Setup GitHub Pages
        id: pages
        uses: actions/configure-pages@v5

      - name: Build static frontend for GitHub Pages
        env:
          VITE_API_BASE_URL: \${{ github.event.inputs.api_base_url || vars.VITE_API_BASE_URL || '' }}
        run: |
          CUSTOM_DOM="\${{ github.event.inputs.custom_domain || vars.GITHUB_CUSTOM_DOMAIN || '' }}"
          OWNER_LOWER="$(echo "\${{ github.repository_owner }}" | tr '[:upper:]' '[:lower:]')"
          REPO_NAME="\${GITHUB_REPOSITORY#*/}"
          REPO_LOWER="$(echo "$REPO_NAME" | tr '[:upper:]' '[:lower:]')"
          if [ -n "$CUSTOM_DOM" ] || [ -f "CNAME" ] || [ -f "public/CNAME" ] || [ "$REPO_LOWER" = "\${OWNER_LOWER}.github.io" ]; then
            export VITE_BASE_PATH="/"
          else
            export VITE_BASE_PATH="./"
          fi
          echo "Building with VITE_BASE_PATH=$VITE_BASE_PATH"
          npx vite build
          cp dist/index.html dist/404.html
          touch dist/.nojekyll
          if [ -n "$CUSTOM_DOM" ]; then
            echo "$CUSTOM_DOM" > dist/CNAME
          elif [ -f "CNAME" ]; then
            cp CNAME dist/CNAME
          elif [ -f "public/CNAME" ]; then
            cp public/CNAME dist/CNAME
          fi

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
}

function resolveWorkflowFilePath(): string {
  const candidates = [
    path.resolve(process.cwd(), '.github', 'workflows', WORKFLOW_FILENAME),
    path.resolve(process.cwd(), '..', '.github', 'workflows', WORKFLOW_FILENAME),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function collectFilesRecursively(dir: string, prefix = ''): Array<{ relPath: string; fullPath: string }> {
  const results: Array<{ relPath: string; fullPath: string }> = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursively(full, rel));
    } else if (entry.isFile()) {
      results.push({ relPath: rel, fullPath: full });
    }
  }
  return results;
}

async function upsertRepoVariable(
  owner: string,
  repo: string,
  headers: Record<string, string>,
  name: string,
  value: string
): Promise<void> {
  if (!value) return;
  const varEndpoint = `https://api.github.com/repos/${owner}/${repo}/actions/variables/${encodeURIComponent(name)}`;
  const patchResp = await fetch(varEndpoint, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name, value }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);

  if (patchResp && patchResp.status === 404) {
    await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/variables`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, value }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
  }
}

async function ensureGithubPagesConfig(
  owner: string,
  repo: string,
  headers: Record<string, string>,
  mode: 'workflow' | 'gh_pages_branch',
  customDomain: string
): Promise<{ ok: boolean; configuredAction?: 'created' | 'updated' | 'already_ok'; error?: string }> {
  try {
    const pagesEndpoint = `https://api.github.com/repos/${owner}/${repo}/pages`;
    const getResp = await fetch(pagesEndpoint, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(8000),
    });

    const desiredPayload: Record<string, unknown> =
      mode === 'gh_pages_branch'
        ? { build_type: 'legacy', source: { branch: 'gh-pages', path: '/' } }
        : { build_type: 'workflow' };
    if (customDomain) {
      desiredPayload.cname = customDomain;
    }

    if (getResp.status === 404) {
      const createResp = await fetch(pagesEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(desiredPayload),
        signal: AbortSignal.timeout(8000),
      });
      if (createResp.ok || createResp.status === 201 || createResp.status === 409) {
        return { ok: true, configuredAction: 'created' };
      }
      const errBody = (await createResp.json().catch(() => null)) as any;
      return { ok: false, error: errBody?.message || `HTTP ${createResp.status}` };
    }

    if (getResp.ok) {
      const pagesJson = (await getResp.json().catch(() => null)) as any;
      const currentBuildType = pagesJson?.build_type || '';
      const currentBranch = pagesJson?.source?.branch || '';
      const currentPath = pagesJson?.source?.path || '';
      const currentCname = pagesJson?.cname || '';
      const alreadyMatching =
        mode === 'gh_pages_branch'
          ? currentBuildType === 'legacy' && currentBranch === 'gh-pages' && currentPath === '/'
          : currentBuildType === 'workflow';

      if (alreadyMatching && (!customDomain || currentCname === customDomain)) {
        return { ok: true, configuredAction: 'already_ok' };
      }

      if (!customDomain && currentCname) {
        desiredPayload.cname = currentCname;
      }
      const putResp = await fetch(pagesEndpoint, {
        method: 'PUT',
        headers,
        body: JSON.stringify(desiredPayload),
        signal: AbortSignal.timeout(8000),
      });
      if (putResp.ok || putResp.status === 204) {
        return { ok: true, configuredAction: 'updated' };
      }
      const errBody = (await putResp.json().catch(() => null)) as any;
      return { ok: false, error: errBody?.message || `HTTP ${putResp.status}` };
    }

    return { ok: false, error: `HTTP ${getResp.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Pages configuration check failed' };
  }
}

let lastLiveDbContentHash = '';
let lastLiveDbSyncedAt: string | null = null;
let lastLiveDbError: string | null = null;
let liveDbDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastLiveDbPushMs = 0;
let activeLiveDbPromise: Promise<{ ok: boolean; skippedUnchanged?: boolean; error?: string }> | null = null;

function isSensitiveSettingKey(key: string): boolean {
  return /password|secret|token|apikey|api_key|privatekey/i.test(key);
}

export function sanitizePublicLiveDbSnapshot(raw: Record<string, unknown> | null | undefined): {
  ok: true;
  hasData: boolean;
  dbVersionMs: number;
  updatedAt: string;
  vermiPricePerKg: number;
  settings: Record<string, unknown>;
  productOverrides: Record<string, unknown>;
  voiceIndex: Record<string, unknown>;
} {
  const safeSettings: Record<string, unknown> = {};
  const rawSettings = raw && typeof raw.settings === 'object' && raw.settings !== null ? (raw.settings as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(rawSettings)) {
    if (isSensitiveSettingKey(k)) continue;
    if ((k === 'githubApiBaseUrl' || k === 'telegramWebAppUrl') && isDeadLegacyDomain(v)) {
      safeSettings[k] = k === 'githubApiBaseUrl' ? resolveCleanBackendApiBaseUrl('') : '';
      continue;
    }
    safeSettings[k] = v;
  }
  if (!safeSettings.githubApiBaseUrl) {
    const envApi = resolveCleanBackendApiBaseUrl('');
    if (envApi) safeSettings.githubApiBaseUrl = envApi;
  }

  const rawOverrides =
    raw && typeof raw.productOverrides === 'object' && raw.productOverrides !== null && !Array.isArray(raw.productOverrides)
      ? (raw.productOverrides as Record<string, unknown>)
      : {};

  const safeVoiceIndex: Record<string, unknown> = {};
  const rawVoiceIndex =
    raw && typeof raw.voiceIndex === 'object' && raw.voiceIndex !== null && !Array.isArray(raw.voiceIndex)
      ? (raw.voiceIndex as Record<string, unknown>)
      : {};
  for (const [clipId, entry] of Object.entries(rawVoiceIndex)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    safeVoiceIndex[clipId] = {
      kind: e.kind || 'product',
      targetId: e.targetId || '',
      scriptText: typeof e.scriptText === 'string' ? e.scriptText : '',
      updatedAt: typeof e.updatedAt === 'string' ? e.updatedAt : '',
      source: 'telegram',
    };
  }

  const workshopObj =
    raw && typeof raw.workshop === 'object' && raw.workshop !== null
      ? (raw.workshop as Record<string, unknown>)
      : null;
  const workshopConfig =
    workshopObj && typeof workshopObj.config === 'object' && workshopObj.config !== null
      ? (workshopObj.config as Record<string, unknown>)
      : null;
  const vermiRaw = Number(raw?.vermiPricePerKg ?? workshopConfig?.sellingPricePerKg ?? 0);
  const vermiPricePerKg = Number.isFinite(vermiRaw) && vermiRaw > 0 ? Math.round(vermiRaw) : 24000;

  const dbVersionMs = Number(raw?.dbVersionMs || 0) || Date.now();
  const updatedAt = typeof raw?.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : new Date().toISOString();
  const hasData =
    Object.keys(safeSettings).length > 0 ||
    Object.keys(rawOverrides).length > 0 ||
    Object.keys(safeVoiceIndex).length > 0;

  return {
    ok: true,
    hasData,
    dbVersionMs,
    updatedAt,
    vermiPricePerKg,
    settings: safeSettings,
    productOverrides: rawOverrides,
    voiceIndex: safeVoiceIndex,
  };
}

export async function syncPublicLiveDbToGithubPages(params: {
  rawPayload: Record<string, unknown> | null;
  owner?: string;
  repo?: string;
  force?: boolean;
}): Promise<{
  ok: boolean;
  skippedUnchanged?: boolean;
  syncedAt?: string | null;
  liveDbUrl?: string;
  error?: string;
}> {
  if (activeLiveDbPromise) {
    return activeLiveDbPromise;
  }

  const owner = sanitizeGithubSegment(params.owner || process.env.GITHUB_OWNER);
  const repo = sanitizeGithubSegment(params.repo || process.env.GITHUB_REPO);
  const token = (process.env.GITHUB_TOKEN || '').trim();
  const liveDbUrl = owner && repo ? `https://raw.githubusercontent.com/${owner}/${repo}/gh-pages/live-db.json` : '';

  if (!owner || !repo || !token) {
    return {
      ok: false,
      liveDbUrl,
      error: !token
        ? 'متغیر GITHUB_TOKEN روی سرور تنظیم نشده است.'
        : 'نام کاربری یا مخزن گیت‌هاب مشخص نشده است.',
    };
  }

  const sanitized = sanitizePublicLiveDbSnapshot(params.rawPayload);
  const canonicalHash = crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        settings: sanitized.settings,
        productOverrides: sanitized.productOverrides,
        vermiPricePerKg: sanitized.vermiPricePerKg,
        voiceIndex: sanitized.voiceIndex,
      })
    )
    .digest('hex');

  if (!params.force && lastLiveDbContentHash === canonicalHash) {
    return {
      ok: true,
      skippedUnchanged: true,
      syncedAt: lastLiveDbSyncedAt,
      liveDbUrl,
    };
  }

  activeLiveDbPromise = (async () => {
    try {
      const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SafariBiotech-Store-App',
      };

      const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/live-db.json`;
      const existingResp = await fetch(`${contentsUrl}?ref=gh-pages`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(9000),
      });

      let existingSha: string | undefined;
      if (existingResp.ok) {
        const existingJson = (await existingResp.json().catch(() => null)) as any;
        if (existingJson?.sha) {
          existingSha = String(existingJson.sha);
        }
      } else if (existingResp.status !== 404) {
        const errBody = (await existingResp.json().catch(() => null)) as any;
        const msg = errBody?.message || `GitHub API HTTP ${existingResp.status}`;
        lastLiveDbError = msg;
        return { ok: false, liveDbUrl, error: msg };
      }

      const jsonText = JSON.stringify(sanitized);
      const putResp = await fetch(contentsUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: 'Auto-sync live public storefront snapshot from Telegram Cloud DB',
          content: Buffer.from(jsonText, 'utf8').toString('base64'),
          branch: 'gh-pages',
          ...(existingSha ? { sha: existingSha } : {}),
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!putResp.ok) {
        const errBody = (await putResp.json().catch(() => null)) as any;
        const rawErr = errBody?.message || `HTTP ${putResp.status}`;
        const friendlyErr =
          putResp.status === 422 && rawErr.toLowerCase().includes('branch')
            ? 'شاخه gh-pages هنوز ساخته نشده است؛ یک‌بار دکمه «ساخت و انتشار مستقیم» را بزنید.'
            : rawErr;
        lastLiveDbError = friendlyErr;
        return { ok: false, liveDbUrl, error: friendlyErr };
      }

      lastLiveDbContentHash = canonicalHash;
      lastLiveDbPushMs = Date.now();
      lastLiveDbSyncedAt = new Date().toLocaleTimeString('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      lastLiveDbError = null;
      return {
        ok: true,
        skippedUnchanged: false,
        syncedAt: lastLiveDbSyncedAt,
        liveDbUrl,
      };
    } catch (err: any) {
      lastLiveDbError = err?.message || 'خطا در همگام‌سازی زنده live-db.json با گیت‌هاب';
      return { ok: false, liveDbUrl, error: lastLiveDbError || undefined };
    } finally {
      activeLiveDbPromise = null;
    }
  })();

  return activeLiveDbPromise;
}

export function scheduleGithubLiveDbSync(getPayloadFn: () => Record<string, unknown> | null): void {
  const owner = sanitizeGithubSegment(process.env.GITHUB_OWNER);
  const repo = sanitizeGithubSegment(process.env.GITHUB_REPO);
  const token = (process.env.GITHUB_TOKEN || '').trim();
  if (!owner || !repo || !token) return;

  if (liveDbDebounceTimer) {
    clearTimeout(liveDbDebounceTimer);
  }
  const elapsed = Date.now() - lastLiveDbPushMs;
  const delayMs = elapsed >= 8000 ? 2500 : Math.max(2500, 8000 - elapsed);

  liveDbDebounceTimer = setTimeout(() => {
    liveDbDebounceTimer = null;
    void syncPublicLiveDbToGithubPages({
      rawPayload: getPayloadFn(),
      owner,
      repo,
    });
  }, delayMs);
}

export function registerGithubPagesRoutes(
  app: Express,
  getPublicLiveDbPayload?: () => Record<string, unknown> | null
): void {
  app.get('/api/github/status', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const serverToken = (process.env.GITHUB_TOKEN || '').trim();
    const envOwner = sanitizeGithubSegment(process.env.GITHUB_OWNER || '');
    const envRepo = sanitizeGithubSegment(process.env.GITHUB_REPO || '');
    const defaultApiBaseUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
    const workflowPath = resolveWorkflowFilePath();
    const pagesUrl = envOwner && envRepo ? computePagesUrl(envOwner, envRepo, '') : '';
    const liveDbUrl =
      envOwner && envRepo
        ? `https://raw.githubusercontent.com/${envOwner}/${envRepo}/gh-pages/live-db.json`
        : '';

    res.json({
      ok: true,
      hasServerToken: Boolean(serverToken),
      autoConfigured: Boolean(envOwner && envRepo),
      envOwner,
      envRepo,
      defaultApiBaseUrl,
      pagesUrl,
      liveDbUrl,
      liveDbSyncedAt: lastLiveDbSyncedAt,
      liveDbError: lastLiveDbError,
      workflowExists: fs.existsSync(workflowPath),
    });
  });

  app.post('/api/github/sync-live-db', async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const owner = sanitizeGithubSegment(req.body?.owner || process.env.GITHUB_OWNER);
      const repo = sanitizeGithubSegment(req.body?.repo || process.env.GITHUB_REPO);
      const rawPayload = getPublicLiveDbPayload ? getPublicLiveDbPayload() : null;
      const result = await syncPublicLiveDbToGithubPages({
        rawPayload,
        owner,
        repo,
        force: true,
      });
      res.status(result.ok ? 200 : 400).json({
        ...result,
        pagesUrl: computePagesUrl(owner, repo, sanitizeCustomDomain(req.body?.customDomain)),
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err?.message || 'خطا در همگام‌سازی فوری داده‌ها روی گیت‌هاب',
      });
    }
  });

  app.get('/api/github/workflow-yaml', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const branch = sanitizeGithubSegment(req.query.branch) || DEFAULT_BRANCH;
    const workflowPath = resolveWorkflowFilePath();
    let content = '';
    try {
      if (fs.existsSync(workflowPath) && branch === DEFAULT_BRANCH) {
        content = fs.readFileSync(workflowPath, 'utf8');
      }
    } catch {
      // fall back to generated template
    }
    if (!content) {
      content = buildWorkflowYamlContent(branch);
    }
    res.json({
      ok: true,
      filename: WORKFLOW_FILENAME,
      path: `.github/workflows/${WORKFLOW_FILENAME}`,
      content,
    });
  });

  app.post('/api/github/check', async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const owner = sanitizeGithubSegment(req.body?.owner || process.env.GITHUB_OWNER);
      const repo = sanitizeGithubSegment(req.body?.repo || process.env.GITHUB_REPO);
      const branch = sanitizeGithubSegment(req.body?.branch) || DEFAULT_BRANCH;
      const customDomain = sanitizeCustomDomain(req.body?.customDomain);

      if (!owner || !repo) {
        res.status(400).json({
          ok: false,
          error: 'لطفاً نام کاربری گیت‌هاب (Owner) و نام مخزن (Repo) را وارد کنید.',
        });
        return;
      }

      const serverToken = (process.env.GITHUB_TOKEN || '').trim();
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'SafariBiotech-Store-App',
      };
      if (serverToken) {
        headers.Authorization = `Bearer ${serverToken}`;
      }

      const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      const repoJson = (await repoResp.json().catch(() => null)) as any;
      if (!repoResp.ok || !repoJson) {
        const isNotFound = repoResp.status === 404;
        res.status(isNotFound ? 404 : 502).json({
          ok: false,
          repoFound: false,
          hasServerToken: Boolean(serverToken),
          error: isNotFound
            ? `مخزن ${owner}/${repo} در گیت‌هاب یافت نشد (یا خصوصی است و GITHUB_TOKEN روی سرور تنظیم نشده است).`
            : repoJson?.message || 'خطا در ارتباط با API گیت‌هاب',
        });
        return;
      }

      let pagesInfo: {
        enabled: boolean;
        status?: string;
        htmlUrl?: string;
        buildType?: string;
        cname?: string;
      } = { enabled: false };

      if (serverToken) {
        const pagesResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
          headers,
          signal: AbortSignal.timeout(8000),
        }).catch(() => null);
        if (pagesResp && pagesResp.ok) {
          const pagesJson = (await pagesResp.json().catch(() => null)) as any;
          if (pagesJson) {
            pagesInfo = {
              enabled: true,
              status: pagesJson.status || 'built',
              htmlUrl: pagesJson.html_url || '',
              buildType: pagesJson.build_type || '',
              cname: pagesJson.cname || '',
            };
          }
        }
      }

      let latestRun: {
        status?: string;
        conclusion?: string | null;
        htmlUrl?: string;
        updatedAt?: string;
      } | null = null;
      const runsResp = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${WORKFLOW_FILENAME}/runs?per_page=1`,
        {
          headers,
          signal: AbortSignal.timeout(8000),
        }
      ).catch(() => null);
      if (runsResp && runsResp.ok) {
        const runsJson = (await runsResp.json().catch(() => null)) as any;
        const firstRun = Array.isArray(runsJson?.workflow_runs) ? runsJson.workflow_runs[0] : null;
        if (firstRun) {
          latestRun = {
            status: firstRun.status,
            conclusion: firstRun.conclusion,
            htmlUrl: firstRun.html_url,
            updatedAt: firstRun.updated_at,
          };
        }
      }

      const expectedPagesUrl =
        pagesInfo.htmlUrl || computePagesUrl(owner, repo, customDomain || pagesInfo.cname || '');

      let liveSiteReachable = false;
      let liveStatusCode = 0;
      let diagnosis: 'healthy' | 'raw_branch_source' | 'broken_asset_404' | 'not_published_yet' = 'not_published_yet';
      let diagnosisMessage = 'سایت هنوز در GitHub Pages منتشر نشده است یا لینک آن در دسترس نیست.';
      let assetCheckOk = false;

      if (expectedPagesUrl) {
        try {
          const liveResp = await fetch(expectedPagesUrl, {
            method: 'GET',
            redirect: 'follow',
            signal: AbortSignal.timeout(7000),
          });
          liveStatusCode = liveResp.status;
          liveSiteReachable = liveResp.ok;

          if (liveResp.ok) {
            const html = await liveResp.text();
            // Match actual <script src="...src/main.tsx"> entry tag (never match the inline mount-watchdog string inside index.html)
            const hasRawMainScriptTag = /<script\b[^>]*\bsrc=["'][^"']*\/?src\/main\.tsx["'][^>]*>/i.test(html);
            if (hasRawMainScriptTag) {
              diagnosis = 'raw_branch_source';
              diagnosisMessage =
                'علت صفحه سفید شناسایی شد: خروجی سایت هنوز روی نسخه خام (src/main.tsx) است زیرا بیلد Actions اجرا نشده یا Source روی شاخه main بوده است. دکمه «ساخت و انتشار مستقیم ⚡» را بزنید تا بلافاصله نسخه بیلد شده منتشر شود.';
            } else {
              const moduleMatch = html.match(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/i);
              if (moduleMatch && moduleMatch[1]) {
                try {
                  const scriptUrl = new URL(moduleMatch[1], expectedPagesUrl).href;
                  let scriptResp = await fetch(scriptUrl, {
                    method: 'HEAD',
                    redirect: 'follow',
                    signal: AbortSignal.timeout(6000),
                  }).catch(() => null);
                  if (!scriptResp || !scriptResp.ok) {
                    scriptResp = await fetch(scriptUrl, {
                      method: 'GET',
                      redirect: 'follow',
                      signal: AbortSignal.timeout(7000),
                    }).catch(() => null);
                  }
                  assetCheckOk = Boolean(scriptResp && scriptResp.ok);
                  if (assetCheckOk) {
                    diagnosis = 'healthy';
                    diagnosisMessage = 'ساختار HTML و فایل‌های جاوااسکریپت بیلد روی GitHub Pages سالم، آنلاین و آماده نمایش هستند ✓';
                  } else {
                    diagnosis = 'broken_asset_404';
                    diagnosisMessage = `فایل اسکریپت بیلد (${moduleMatch[1]}) خطای ${scriptResp?.status || 'شبکه'} برگرداند. از «تنظیم و انتشار فوری ⚡» استفاده کنید تا فایل‌های صحیح منتشر شوند.`;
                  }
                } catch {
                  diagnosis = 'healthy';
                  diagnosisMessage = 'صفحه اصلی در دسترس است ✓';
                }
              } else {
                diagnosis = 'healthy';
                diagnosisMessage = 'صفحه در دسترس است ✓';
              }
            }
          } else {
            diagnosis = 'not_published_yet';
            diagnosisMessage = `سایت کد وضعیت HTTP ${liveStatusCode} برگرداند؛ از دکمه «ساخت و انتشار مستقیم ⚡» استفاده کنید.`;
          }
        } catch {
          liveSiteReachable = false;
          diagnosis = 'not_published_yet';
        }
      }

      res.json({
        ok: true,
        repoFound: true,
        hasServerToken: Boolean(serverToken),
        repoFullName: repoJson.full_name,
        defaultBranch: repoJson.default_branch || branch,
        visibility: repoJson.private ? 'private' : 'public',
        pushedAt: repoJson.pushed_at || null,
        repoHtmlUrl: repoJson.html_url,
        pages: pagesInfo,
        latestRun,
        pagesUrl: expectedPagesUrl,
        liveSiteReachable,
        liveStatusCode,
        assetCheckOk,
        diagnosis,
        diagnosisMessage,
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err?.message || 'خطا در بررسی وضعیت گیت‌هاب',
      });
    }
  });

  app.post('/api/github/deploy', async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const owner = sanitizeGithubSegment(req.body?.owner || process.env.GITHUB_OWNER);
      const repo = sanitizeGithubSegment(req.body?.repo || process.env.GITHUB_REPO);
      const branch = sanitizeGithubSegment(req.body?.branch) || DEFAULT_BRANCH;
      const customDomain = sanitizeCustomDomain(req.body?.customDomain);
      const apiBaseUrl = resolveCleanBackendApiBaseUrl(req.body?.apiBaseUrl);

      if (!owner || !repo) {
        res.status(400).json({
          ok: false,
          error: 'نام کاربری گیت‌هاب و نام مخزن الزامی است.',
        });
        return;
      }

      const serverToken = (process.env.GITHUB_TOKEN || '').trim();
      if (!serverToken) {
        res.json({
          ok: false,
          needsServerToken: true,
          actionsUrl: `https://github.com/${owner}/${repo}/actions/workflows/${WORKFLOW_FILENAME}`,
          pagesSettingsUrl: `https://github.com/${owner}/${repo}/settings/pages`,
          message:
            'تنظیمات گردش‌کار خودکار در پروژه اعمال شده است. کافیست تغییرات جدید را با دکمه Sync روی گیت‌هاب بفرستید و در Settings > Pages گزینه Source را روی «GitHub Actions» بگذارید.',
        });
        return;
      }

      const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${serverToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SafariBiotech-Store-App',
      };

      const pagesConfigResult = await ensureGithubPagesConfig(owner, repo, headers, 'workflow', customDomain);
      await upsertRepoVariable(owner, repo, headers, 'VITE_API_BASE_URL', apiBaseUrl);
      if (customDomain) {
        await upsertRepoVariable(owner, repo, headers, 'GITHUB_CUSTOM_DOMAIN', customDomain);
      }

      const dispatchResp = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${WORKFLOW_FILENAME}/dispatches`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ref: branch,
            inputs: {
              api_base_url: apiBaseUrl,
              custom_domain: customDomain,
            },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!dispatchResp.ok) {
        const errBody = (await dispatchResp.json().catch(() => null)) as any;
        res.status(dispatchResp.status === 404 ? 404 : 502).json({
          ok: false,
          pagesAutoConfigured: pagesConfigResult.ok,
          actionsUrl: `https://github.com/${owner}/${repo}/actions`,
          error:
            dispatchResp.status === 404
              ? `فایل ${WORKFLOW_FILENAME} هنوز روی شاخه ${branch} مخزن ${owner}/${repo} پیدا نشد. ابتدا تغییرات جدید را روی گیت‌هاب Sync کنید.`
              : errBody?.message || 'خطا در اجرای Workflow گیت‌هاب',
        });
        return;
      }

      res.json({
        ok: true,
        pagesAutoConfigured: pagesConfigResult.ok,
        actionsUrl: `https://github.com/${owner}/${repo}/actions/workflows/${WORKFLOW_FILENAME}`,
        pagesUrl: computePagesUrl(owner, repo, customDomain),
        message: 'فرمان ساخت و انتشار روی GitHub Pages با موفقیت به GitHub Actions ارسال شد ✓',
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err?.message || 'خطا در ارسال درخواست انتشار گیت‌هاب',
      });
    }
  });

  // Direct build & publish to gh-pages branch + auto-configure Pages (bypasses stalled/failing Actions runners)
  app.post('/api/github/publish-direct', async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    let tempOutDir = '';
    try {
      const owner = sanitizeGithubSegment(req.body?.owner || process.env.GITHUB_OWNER);
      const repo = sanitizeGithubSegment(req.body?.repo || process.env.GITHUB_REPO);
      const customDomain = sanitizeCustomDomain(req.body?.customDomain);
      const apiBaseUrl = resolveCleanBackendApiBaseUrl(req.body?.apiBaseUrl);

      if (!owner || !repo) {
        res.status(400).json({
          ok: false,
          error: 'نام کاربری گیت‌هاب و نام مخزن الزامی است.',
        });
        return;
      }

      const serverToken = (process.env.GITHUB_TOKEN || '').trim();
      if (!serverToken) {
        res.status(400).json({
          ok: false,
          needsServerToken: true,
          error: 'برای انتشار مستقیم روی شاخه gh-pages، متغیر محیطی GITHUB_TOKEN روی سرور لازم است.',
        });
        return;
      }

      const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${serverToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SafariBiotech-Store-App',
      };

      const isRootPagesRepo = repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;
      const basePath = customDomain || isRootPagesRepo ? '/' : './';

      tempOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safari-gh-pages-'));
      const cwdRoot = process.cwd();
      const projectRoot = fs.existsSync(path.join(cwdRoot, 'package.json'))
        ? cwdRoot
        : path.resolve(cwdRoot, '..');
      const viteBin = path.join(projectRoot, 'node_modules', '.bin', 'vite');

      await execFileAsync(
        viteBin,
        ['build', '--outDir', tempOutDir, '--emptyOutDir'],
        {
          cwd: projectRoot,
          env: {
            ...process.env,
            VITE_BASE_PATH: basePath,
            VITE_API_BASE_URL: apiBaseUrl,
          },
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      const builtIndex = path.join(tempOutDir, 'index.html');
      if (!fs.existsSync(builtIndex)) {
        throw new Error('فایل خروجی index.html پس از بیلد تولید نشد.');
      }

      fs.copyFileSync(builtIndex, path.join(tempOutDir, '404.html'));
      fs.writeFileSync(path.join(tempOutDir, '.nojekyll'), '', 'utf8');
      if (customDomain) {
        fs.writeFileSync(path.join(tempOutDir, 'CNAME'), `${customDomain}\n`, 'utf8');
      }
      if (getPublicLiveDbPayload) {
        const sanitizedFeed = sanitizePublicLiveDbSnapshot(getPublicLiveDbPayload());
        fs.writeFileSync(path.join(tempOutDir, 'live-db.json'), JSON.stringify(sanitizedFeed), 'utf8');
      }

      const files = collectFilesRecursively(tempOutDir);
      const treeEntries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];

      // Upload blobs in batches of 5
      for (let i = 0; i < files.length; i += 5) {
        const batch = files.slice(i, i + 5);
        const uploaded = await Promise.all(
          batch.map(async (f) => {
            const buf = fs.readFileSync(f.fullPath);
            const blobResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                content: buf.toString('base64'),
                encoding: 'base64',
              }),
              signal: AbortSignal.timeout(30000),
            });
            const blobJson = (await blobResp.json().catch(() => null)) as any;
            if (!blobResp.ok || !blobJson?.sha) {
              throw new Error(blobJson?.message || `خطا در آپلود فایل ${f.relPath} به گیت‌هاب`);
            }
            return {
              path: f.relPath,
              mode: '100644' as const,
              type: 'blob' as const,
              sha: String(blobJson.sha),
            };
          })
        );
        treeEntries.push(...uploaded);
      }

      const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tree: treeEntries }),
        signal: AbortSignal.timeout(20000),
      });
      const treeJson = (await treeResp.json().catch(() => null)) as any;
      if (!treeResp.ok || !treeJson?.sha) {
        throw new Error(treeJson?.message || 'خطا در ساخت درخت فایل‌های gh-pages');
      }

      const commitResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: 'Auto-publish static storefront build to gh-pages',
          tree: treeJson.sha,
          parents: [],
        }),
        signal: AbortSignal.timeout(15000),
      });
      const commitJson = (await commitResp.json().catch(() => null)) as any;
      if (!commitResp.ok || !commitJson?.sha) {
        throw new Error(commitJson?.message || 'خطا در ثبت کامیت روی شاخه gh-pages');
      }

      const refCheck = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/gh-pages`,
        { headers, signal: AbortSignal.timeout(10000) }
      );
      if (refCheck.ok) {
        const patchRef = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/gh-pages`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ sha: commitJson.sha, force: true }),
            signal: AbortSignal.timeout(10000),
          }
        );
        if (!patchRef.ok) {
          const errJson = (await patchRef.json().catch(() => null)) as any;
          throw new Error(errJson?.message || 'خطا در بروزرسانی شاخه gh-pages');
        }
      } else {
        const createRef = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ref: 'refs/heads/gh-pages', sha: commitJson.sha }),
          signal: AbortSignal.timeout(10000),
        });
        if (!createRef.ok) {
          const errJson = (await createRef.json().catch(() => null)) as any;
          throw new Error(errJson?.message || 'خطا در ایجاد شاخه gh-pages');
        }
      }

      const pagesCfg = await ensureGithubPagesConfig(
        owner,
        repo,
        headers,
        'gh_pages_branch',
        customDomain
      );

      await fetch(`https://api.github.com/repos/${owner}/${repo}/pages/builds`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);

      res.json({
        ok: true,
        filesUploaded: treeEntries.length,
        pagesAutoConfigured: pagesCfg.ok,
        pagesUrl: computePagesUrl(owner, repo, customDomain),
        message: `بیلد استاتیک (${treeEntries.length} فایل با مسیر نسبی ./ و اتصال خودکار API) مستقیماً روی شاخه gh-pages منتشر و تنظیمات GitHub Pages روی آن فعال شد ✓ (تا ۶۰ ثانیه سایت به‌روز می‌شود)`,
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err?.message || 'خطا در بیلد و انتشار مستقیم روی GitHub Pages',
      });
    } finally {
      if (tempOutDir) {
        try {
          fs.rmSync(tempOutDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup failure
        }
      }
    }
  });
}
