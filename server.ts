import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import { spawn } from 'child_process';
import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  CORE_APP_VERSION,
  CORE_APP_SECTIONS,
  CORE_UPDATE_NOTES,
} from './src/config/coreAppManifest';
import { createTelegramStoreBotService } from './server/telegramBot';
import { createTelegramCloudDbService } from './server/telegramDb';
import { registerGithubPagesRoutes, scheduleGithubLiveDbSync } from './server/githubPages';
import { registerIranWeatherRoutes } from './server/iranWeather';
import { searchPlantProfiles } from './src/data/plantProfiles';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDist = path.basename(__dirname) === 'dist';
const distDir = isDist ? __dirname : path.resolve(__dirname, 'dist');

function computeDeterministicAppVersion(): string {
  if (process.env.APP_VERSION?.trim()) {
    return process.env.APP_VERSION.trim();
  }
  let bundleFingerprint = '';
  try {
    const distIndex = path.join(distDir, 'index.html');
    if (fs.existsSync(distIndex)) {
      const html = fs.readFileSync(distIndex, 'utf8');
      const assetRefs = html.match(/\/assets\/[a-zA-Z0-9._-]+/g) || [];
      bundleFingerprint = assetRefs.sort().join(',');
    }
  } catch {
    // ignore fs read errors in dev mode
  }
  const digest = crypto
    .createHash('sha1')
    .update(`${CORE_APP_VERSION}|${CORE_APP_SECTIONS.join('|')}|${bundleFingerprint}`)
    .digest('hex')
    .slice(0, 6);
  return `${CORE_APP_VERSION}-${digest}`;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const APP_BUILD_VERSION = computeDeterministicAppVersion();

app.use(express.json({ limit: '45mb' }));

// Enable CORS for /api/* so static GitHub Pages deployments communicate seamlessly with live backend & SSE
app.use('/api', (req: Request, res: Response, next: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Deterministic App Version endpoint based on core sections & core build manifest
app.get('/api/app-version', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({
    version: APP_BUILD_VERSION,
    coreVersion: CORE_APP_VERSION,
    sections: CORE_APP_SECTIONS,
    releaseNotes: CORE_UPDATE_NOTES,
    appName: 'گروه تولیدی و زیست‌فناوری مهندس صفری',
  });
});

registerIranWeatherRoutes(app);

// Lazy Google GenAI client initializer so server boots cleanly in any environment
let _aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!_aiClient) {
    _aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return _aiClient;
}

// Expert Agronomist & Fertilizer Specialist Persona System Instruction
const VERMI_HORTICULTURE_EXPERT_INSTRUCTION = `
شما «متخصص ارشد خاک‌شناسی، باغبانی، تغذیه گیاهی و فرمولاسیون کودهای زیستی گروه تولیدی و زیست‌فناوری مهندس صفری» هستید.
شما بالاترین سطح تخصص علمی و تجربیات میدانی را در موارد زیر دارا می‌باشید:

۱. اصل اساسی تطابق کامل با سوال کاربر:
- شما باید دقیقاً و منحصراً به محصول، گیاه یا سوالی که کاربر مطرح کرده پاسخ دهید.
- هرگز نباید پاسخ یک محصول (مانند پسته) را برای محصول دیگری (مانند گردو، مرکبات، سیب، انگور، گیاهان آپارتمانی مانند زاموفیلیا و سانسوریا، یا صیفی‌جات گلخانه‌ای) ارائه دهید.

۲. محصولات اختصاصی کارگاه زیست‌فناوری مهندس صفری:
- «ورمیکمپوست درجه ۱ صادراتی و گلخانه‌ای»: فرآوری بیولوژیک با کرم ایزینیا فوتیدا (Eisenia foetida)، اسید هیومیک بالای ۶٪، C/N ۱۲ تا ۱۵، pH خنثی ۷.۱۵، استاندارد ISIRI 13724.
- «کود کمپوست سنتی غنی‌شده (ترموکود)»: تخمیر هوازی گرمادوست کود گاوی دامی و تفاله قهوه.
- «ورمی‌تی مایع بیولوژیک (Worm Tea)»: عصاره هوادهی‌شده و غلیظ برای محلول‌پاشی برگی و آبیاری قطره‌ای.
- «بستر تخصصی تفاله قهوه و زئولیت»: مناسب گلدان‌های آپارتمانی و گیاهان زینتی.

۳. لحن و هویت:
- فارسی سلیس، احترام‌آمیز، علمی و کاملاً کاربردی برای کشاورزان و باغداران محترم.
- هویت سازمانی: مشاور ارشد تغذیه خاک «گروه تولیدی و زیست‌فناوری مهندس صفری».
`;

// AI Assistant endpoint
app.post('/api/ai/ask', async (req: Request, res: Response): Promise<void> => {
  try {
    const { question, context } = req.body;

    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'سوال الزامی است.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.json({
        answer: 'کلید وب‌سرویس هوش مصنوعی Gemini فعال نیست؛ اما مشاور باغبانی آفلاین کارگاه صفری آماده است.',
        isFallback: true,
      });
      return;
    }

    let prompt = `سوال یا درخواست مشاوره کاربر:\n${question}\n`;
    if (context) {
      prompt += `\nاطلاعات کارگاه، تولیدات و ظرفیت فعلی:\n${JSON.stringify(context, null, 2)}\n`;
    }

    const response = await getAiClient().models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction: VERMI_HORTICULTURE_EXPERT_INSTRUCTION,
      },
    });

    const answerText = response.text || 'پاسخی از مدل دریافت نشد.';
    res.json({ answer: answerText, isFallback: false });
  } catch (error: any) {
    console.error('Error generating AI answer:', error);
    res.status(500).json({
      error: 'خطا در ارتباط با سرور هوش مصنوعی',
      details: error?.message || 'خطای ناشناخته',
    });
  }
});

// Virtual Agronomist Text Chat ("گفتگو با مهندس صفری") grounded in workshop catalog, plant profiles, & customer weather
app.post('/api/ai/consultant-chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      message,
      history,
      customerProfile,
      weatherSummary,
      catalogSummary,
      plantKnowledgeSummary,
    } = req.body || {};

    const cleanMessage = typeof message === 'string' ? message.trim() : '';
    if (!cleanMessage) {
      res.status(400).json({ error: 'متن سوال الزامی است.' });
      return;
    }

    const buildGroundedFallbackAnswer = (): string => {
      const loc =
        customerProfile?.city && customerProfile?.province
          ? `${customerProfile.province} (${customerProfile.city})`
          : 'منطقه شما';
      const catalogItems = Array.isArray(catalogSummary) ? catalogSummary : [];
      const plantMatches = Array.isArray(plantKnowledgeSummary) ? plantKnowledgeSummary : [];

      const lines: string[] = [
        `سلام و درود خدمت شما همراه گرامی در ${loc}.`,
      ];

      if (plantMatches.length > 0) {
        const topPlant = plantMatches[0];
        lines.push(
          `برای «${topPlant.name}» (${topPlant.categoryLabel || 'تغذیه تخصصی'}): ${topPlant.instructions || ''} (بهترین زمان: ${topPlant.bestMonthsFa || 'در طول فصل رشد'}).`
        );
      }

      if (/سم|سمپاش|آفت|کنه|شته|سفیدک|قارچ/.test(cleanMessage)) {
        lines.push(
          'اصول طلایی سمپاشی: پیش از سمپاشی، اسیدیته آب را روی ۵.۵ تا ۶.۵ تنظیم کنید، از مویان استاندارد استفاده نمایید، در باد زیر ۱۵ کیلومتر بر ساعت و ساعات خنک صبح یا غروب سمپاشی کنید و هنگام گل‌دهی برای حفظ زنبور عسل احتیاط نمایید.'
        );
      } else if (/کود|ورم|زئولیت|خاک|چالکود|آبیاری/.test(cleanMessage)) {
        lines.push(
          'برای تغذیه اصولی خاک، ترکیب ۷۰ درصد خاک یا کود پایه + ۲۰ تا ۳۰ درصد ورمیکمپوست درجه ۱ + ۵ تا ۱۰ درصد زئولیت شکری (جهت کنترل شوری و حفظ رطوبت) بهترین بازدهی ریشه‌زایی را دارد. پس از مصرف حتماً آبیاری سبک انجام دهید.'
        );
      }

      if (weatherSummary?.temperature !== undefined) {
        lines.push(
          `وضعیت هوای فعلی ${weatherSummary.city || loc}: دما ${Math.round(Number(weatherSummary.temperature))} درجه، رطوبت ${Math.round(Number(weatherSummary.humidity || 0))}٪ و باد ${Math.round(Number(weatherSummary.windSpeed || 0))} کیلومتر بر ساعت است که برای برنامه‌ریزی آبیاری و محلول‌پاشی باید لحاظ شود.`
        );
      }

      if (catalogItems.length > 0) {
        const names = catalogItems.slice(0, 3).map((p: any) => p.name).join('، ');
        lines.push(`محصولات موجود قابل پیشنهاد از کارگاه مهندس صفری: ${names}.`);
      }

      return lines.join('\n\n');
    };

    if (!process.env.GEMINI_API_KEY) {
      res.json({ reply: buildGroundedFallbackAnswer(), isFallback: true });
      return;
    }

    const recentHistory = Array.isArray(history)
      ? history
          .slice(-8)
          .map((m: any) => `${m?.role === 'user' ? 'کاربر' : 'مهندس صفری'}: ${String(m?.text || '').slice(0, 500)}`)
          .join('\n')
      : '';

    const systemPrompt = `${VERMI_HORTICULTURE_EXPERT_INSTRUCTION}
۴. نقش در گفتگوی متنی فروشگاه:
- شما «مهندس صفری» مشاور مجازی تخصصی و صمیمی این سامانه هستید.
- بر اساس موقعیت جغرافیایی ثبت‌شده مشتری، داده‌های آب‌وهوای زنده شهر او، پروفیل‌های علمی گیاهان موجود در پایگاه دانش برنامه و کاتالوگ واقعی محصولات کارگاه پاسخ بدهید.
- پاسخ‌ها باید دقیق، شماره‌گذاری‌شده یا با نکات کاربردی روشن، کوتاه تا متوسط (حداکثر ۴ پاراگراف خوانا)، بدون زیاده‌گویی و کاملاً عملی باشد.
- در صورت مرتبط بودن، نام دقیق محصول موجود در کارگاه و دوز مصرف واقعی آن را پیشنهاد دهید و همیشه نکات ایمنی (مثل ساعت مناسب سمپاشی یا محلول‌پاشی، pH آب و رطوبت خاک) را گوشزد کنید.`;

    const contextBlock = [
      customerProfile
        ? `پروفایل مشتری: نام=${customerProfile.name || 'کاربر'} | استان و شهر ثبت‌شده=${customerProfile.province || 'تهران'} / ${customerProfile.city || 'تهران'} | نوع کشت=${customerProfile.farmingType || 'عمومی'}`
        : '',
      weatherSummary
        ? `آب‌وهوای زنده شهر مشتری (${weatherSummary.city || ''}): دما ${weatherSummary.temperature}°C، وضعیت «${weatherSummary.conditionLabel || ''}»، رطوبت ${weatherSummary.humidity}%، باد ${weatherSummary.windSpeed} km/h، احتمال بارش ${weatherSummary.precipitationProbability}%`
        : '',
      Array.isArray(catalogSummary) && catalogSummary.length > 0
        ? `کاتالوگ محصولات موجود کارگاه:\n${catalogSummary
            .slice(0, 10)
            .map((p: any) => `- ${p.name} (${p.categoryLabel}) | ${p.inStock ? 'موجود' : 'ناموجود'} | ${p.priceNote || ''} | ${p.tagline || ''}`)
            .join('\n')}`
        : '',
      Array.isArray(plantKnowledgeSummary) && plantKnowledgeSummary.length > 0
        ? `اطلاعات علمی گیاهان مرتبط از دیتای داخلی سامانه:\n${plantKnowledgeSummary
            .slice(0, 6)
            .map((pl: any) => `- ${pl.name}: ورمیکمپوست ${pl.vermiKgPerUnit || 0} / کمپوست ${pl.compostKgPerUnit || 0} / زئولیت ${pl.zeoliteKgPerUnit || 0} / ورمی‌تی ${pl.liquidTeaLiterPerUnit || 0} در هر ${pl.unitLabel} | زمان: ${pl.bestMonthsFa} | دستورالعمل: ${pl.instructions}`)
            .join('\n')}`
        : '',
      recentHistory ? `تاریخچه گفتگوی اخیر:\n${recentHistory}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const prompt = `${contextBlock}\n\nسوال جدید مشتری:\n${cleanMessage}`;

    try {
      const response = await Promise.race([
        getAiClient().models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('CHAT_TIMEOUT')), 14000)),
      ]);
      const reply = (response.text || '').trim();
      if (reply.length >= 15) {
        res.json({ reply, isFallback: false });
        return;
      }
    } catch (aiErr) {
      console.warn('Consultant chat Gemini fallback used:', aiErr);
    }

    res.json({ reply: buildGroundedFallbackAnswer(), isFallback: true });
  } catch (error: any) {
    console.error('Error in /api/ai/consultant-chat:', error);
    res.status(500).json({
      error: 'خطا در پاسخگویی مشاور مجازی',
      details: error?.message || 'خطای ناشناخته',
    });
  }
});

// AI Product Visual Designer & Smart Studio Editor endpoint (uses standard gemini-4-hydrogen)
app.post('/api/ai/product-visual', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      productName,
      categoryLabel,
      tagline,
      prompt,
      mode, // 'enhance' | 'generate_svg'
      imageBase64,
      imageMimeType,
    } = req.body || {};

    if (!productName || typeof productName !== 'string') {
      res.status(400).json({ error: 'نام محصول الزامی است.' });
      return;
    }

    const fallbackResponse = () => {
      if (mode === 'generate_svg') {
        const safeTitle = String(productName).slice(0, 36);
        const safeCat = String(categoryLabel || 'محصولات زیست‌فناوری صفری').slice(0, 28);
        const safeTag = String(tagline || 'کیفیت تضمینی کارگاه').slice(0, 44);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="55%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="bag" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fafaf9"/>
      <stop offset="100%" stop-color="#e7e5e4"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <circle cx="670" cy="120" r="140" fill="#10b981" opacity="0.16"/>
  <circle cx="130" cy="500" r="170" fill="#f59e0b" opacity="0.14"/>
  <rect x="230" y="95" width="340" height="410" rx="34" fill="url(#bag)" stroke="#d6d3d1" stroke-width="4"/>
  <rect x="260" y="130" width="280" height="82" rx="18" fill="#065f46"/>
  <text x="400" y="178" font-family="sans-serif" font-size="22" font-weight="bold" fill="#fde68a" text-anchor="middle">${safeCat}</text>
  <circle cx="400" cy="305" r="76" fill="#ecfdf5" stroke="#10b981" stroke-width="5"/>
  <path d="M400 250 C432 276 436 320 400 352 C364 320 368 276 400 250 Z" fill="#059669"/>
  <text x="400" y="425" font-family="sans-serif" font-size="24" font-weight="bold" fill="#1c1917" text-anchor="middle">${safeTitle}</text>
  <text x="400" y="462" font-family="sans-serif" font-size="16" fill="#57534e" text-anchor="middle">${safeTag}</text>
  <rect x="280" y="520" width="240" height="40" rx="20" fill="#f59e0b"/>
  <text x="400" y="546" font-family="sans-serif" font-size="17" font-weight="bold" fill="#1c1917" text-anchor="middle">گروه زیست‌فناوری مهندس صفری</text>
</svg>`;
        res.json({ mode: 'generate_svg', svg, isFallback: true });
        return;
      }
      res.json({
        mode: 'enhance',
        brightness: 1.06,
        contrast: 1.12,
        saturate: 1.16,
        warmth: 0.06,
        badgeText: String(prompt || 'تضمین کیفیت صفری').slice(0, 26),
        accentHex: '#059669',
        isFallback: true,
      });
    };

    if (!process.env.GEMINI_API_KEY) {
      fallbackResponse();
      return;
    }

    const withTimeout = <T>(promise: Promise<T>, ms = 10000): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), ms)),
      ]);

    if (mode === 'generate_svg') {
      const textPrompt = `You are a commercial packaging & agricultural studio vector designer.
Design a clean, vibrant, high-contrast 4:3 commercial product illustration in pure SVG (width="800" height="600" viewBox="0 0 800 600") for an Iranian organic bio-fertilizer workshop store.
Product Name (Persian): ${productName}
Category: ${categoryLabel || ''}
Tagline: ${tagline || ''}
Manager Creative Instruction: ${prompt || 'طراحی بسته‌بندی حرفه‌ای کشاورزی با تم سبز زمردی و طلایی'}

Rules:
- Output ONLY raw valid <svg ...>...</svg> markup. Do NOT wrap in markdown code fences.
- Use clean Persian-friendly typography (sans-serif/Tahoma) or crisp geometric agricultural visuals (fertilizer bag/jug, organic granules, leaves, golden quality ribbon) avoiding garbled characters.
- No external URLs or <image> tags. Use rich SVG gradients, shapes, and lighting highlights.`;

      try {
        const response = await withTimeout(
          getAiClient().models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: textPrompt,
          }),
          10000
        );

        const raw = (response.text || '').trim();
        const svgMatch = raw.match(/<svg[\s\S]*<\/svg>/i);
        if (svgMatch) {
          res.json({ mode: 'generate_svg', svg: svgMatch[0], isFallback: false });
          return;
        }
      } catch (err) {
        console.warn('AI generate_svg timeout/error, using crisp SVG fallback:', err);
      }
      fallbackResponse();
      return;
    }

    // Enhance / Edit existing product image studio style using Gemini multimodal understanding
    const parts: any[] = [];
    if (imageBase64 && typeof imageBase64 === 'string') {
      parts.push({
        inlineData: {
          data: imageBase64,
          mimeType: imageMimeType || 'image/jpeg',
        },
      });
    }
    parts.push({
      text: `Analyze this product "${productName}" (${categoryLabel || ''}) and the manager's photo editing instruction: "${prompt || 'بهبود نور و کیفیت استودیویی و افزودن برچسب کیفیت'}".
Return strictly a JSON object with studio enhancement parameters:
{
  "brightness": number between 0.9 and 1.25,
  "contrast": number between 0.95 and 1.3,
  "saturate": number between 0.9 and 1.35,
  "warmth": number between -0.15 and 0.2,
  "accentHex": hex color like "#059669" or "#d97706",
  "badgeText": short Persian ribbon badge label max 24 chars (e.g. "درجه ۱ صادراتی"),
  "bottomCaption": short Persian studio caption max 36 chars
}`,
    });

    try {
      const response = await withTimeout(
        getAiClient().models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
          },
        }),
        8000
      );

      const parsed = JSON.parse((response.text || '{}').trim());
      res.json({
        mode: 'enhance',
        brightness: Number(parsed.brightness) || 1.06,
        contrast: Number(parsed.contrast) || 1.12,
        saturate: Number(parsed.saturate) || 1.15,
        warmth: Number(parsed.warmth) || 0.04,
        accentHex: typeof parsed.accentHex === 'string' ? parsed.accentHex : '#059669',
        badgeText: typeof parsed.badgeText === 'string' ? parsed.badgeText : 'تضمین کیفیت صفری',
        bottomCaption: typeof parsed.bottomCaption === 'string' ? parsed.bottomCaption : '',
        isFallback: false,
      });
      return;
    } catch (err) {
      console.warn('AI enhance timeout/error, using crisp studio fallback:', err);
      fallbackResponse();
      return;
    }
  } catch (error: any) {
    console.error('Error in /api/ai/product-visual:', error);
    res.status(500).json({
      error: 'خطا در پردازش هوش مصنوعی تصویر',
      details: error?.message || 'خطای ناشناخته',
    });
  }
});

// Helper to ensure unary TTS audio bytes are always browser-playable WAV
function ensurePlayableWavBase64(base64Data: string, sampleRate = 24000): string {
  const buf = Buffer.from(base64Data, 'base64');
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF') {
    return base64Data;
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + buf.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(buf.length, 40);
  return Buffer.concat([header, buf]).toString('base64');
}

// Transcode WAV/PCM audio into crisp compact MP3 (48kbps mono 24kHz) using ffmpeg so it sounds studio-clear, plays instantly, and fits cleanly inside Firestore
async function transcodeWavBase64ToMp3Base64(
  wavBase64: string
): Promise<{ audioBase64: string; mimeType: string }> {
  const wavBuf = Buffer.from(wavBase64, 'base64');
  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: { audioBase64: string; mimeType: string }) => {
      if (!settled) {
        settled = true;
        resolve(res);
      }
    };
    try {
      const ff = spawn('/usr/bin/ffmpeg', [
        '-y',
        '-f',
        'wav',
        '-i',
        'pipe:0',
        '-ac',
        '1',
        '-ar',
        '24000',
        '-b:a',
        '48k',
        '-f',
        'mp3',
        'pipe:1',
      ]);
      const timer = setTimeout(() => {
        try {
          ff.kill('SIGKILL');
        } catch {
          // ignore
        }
        finish({ audioBase64: wavBase64, mimeType: 'audio/wav' });
      }, 8000);
      const chunks: Buffer[] = [];
      ff.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      ff.stderr.on('data', () => {
        // ignore ffmpeg stderr logs
      });
      ff.on('error', () => {
        clearTimeout(timer);
        finish({ audioBase64: wavBase64, mimeType: 'audio/wav' });
      });
      ff.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 && chunks.length > 0) {
          const mp3Buf = Buffer.concat(chunks);
          finish({ audioBase64: mp3Buf.toString('base64'), mimeType: 'audio/mpeg' });
        } else {
          finish({ audioBase64: wavBase64, mimeType: 'audio/wav' });
        }
      });
      ff.stdin.write(wavBuf);
      ff.stdin.end();
    } catch {
      finish({ audioBase64: wavBase64, mimeType: 'audio/wav' });
    }
  });
}

const productVoiceCache = new Map<
  string,
  { audioBase64: string; mimeType: string; scriptText: string; createdAt: number }
>();

const ttsModelCooldownUntil = new Map<string, number>();

async function synthesizeSpeechToMp3Buffer(params: {
  scriptText: string;
  mode?: string;
}): Promise<
  | { ok: true; buffer: Buffer; audioBase64: string; mimeType: string }
  | {
      ok: false;
      status: number;
      error: string;
      code: string;
      retryable: boolean;
      retryAfterSec: number;
    }
> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      ok: false,
      status: 503,
      error: 'سرویس تولید صدای هوش مصنوعی در حال حاضر در سرور پیکربندی نشده است.',
      code: 'NO_API_KEY',
      retryable: false,
      retryAfterSec: 0,
    };
  }

  const ttsInputText = params.scriptText
    .replace(/pH/gi, 'میزان اسیدیته')
    .replace(/EC/gi, 'شوری')
    .replace(/dS\/m/gi, 'دسی‌زیمنس بر متر')
    .replace(/C\/N/gi, 'نسبت کربن به ازت')
    .replace(/km\/h/gi, 'کیلومتر در ساعت')
    .replace(/°C/gi, ' درجه سانتی‌گراد')
    .replace(/ET0/gi, 'میزان تبخیر')
    .replace(/%/g, ' درصد');

  const mode = params.mode || 'product';
  const synthesizeSpeech = async (ttsModel: 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts') => {
    return getAiClient().models.generateContent({
      model: ttsModel,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: ttsInputText,
              speechMetadata: {
                style:
                  mode === 'weather'
                    ? 'Warm, authoritative, clear Iranian male agricultural meteorologist delivering an up-to-date local weather and gardening action briefing in natural conversational Persian'
                    : mode === 'tip'
                    ? 'Warm, authoritative, friendly Iranian male agricultural specialist clearly explaining a practical gardening and farming tip in natural conversational Persian'
                    : 'Warm, confident, natural Iranian male agricultural shop advisor speaking clear conversational Persian with friendly retail warmth and natural pacing',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Charon' },
          },
        },
      },
    });
  };

  let ttsResponse: any = null;
  let lastTtsError: any = null;
  const ttsModels: Array<{ model: 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts'; timeoutMs: number }> = [
    { model: 'gemini-3.8-flash-lite-tts', timeoutMs: 28000 },
    { model: 'gemini-3.8-flash-tts', timeoutMs: 28000 },
  ];

  const keyTag = (process.env.GEMINI_API_KEY || '').slice(-8);
  const nowMs = Date.now();
  let attemptedAny = false;
  let isDailyQuotaExhausted = false;
  let suggestedRetrySec = 6;

  const extractRetryAfterSec = (msg: string): number => {
    const m = /retry(?:\s*in|Delay["':\s]+)(\d+(?:\.\d+)?)s/i.exec(msg);
    if (m) return Math.min(20, Math.max(2, Math.ceil(Number(m[1]))));
    return 6;
  };

  for (const candidate of ttsModels) {
    const cooldownKey = `${candidate.model}:${keyTag}`;
    const cooldownUntil = ttsModelCooldownUntil.get(cooldownKey) || 0;
    if (cooldownUntil > nowMs) {
      continue;
    }

    attemptedAny = true;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        ttsResponse = await Promise.race([
          synthesizeSpeech(candidate.model),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TTS_TIMEOUT')), candidate.timeoutMs)),
        ]);
        const hasAudio = ttsResponse?.candidates?.[0]?.content?.parts?.some((p: any) => p?.inlineData?.data);
        if (hasAudio) break;
      } catch (err) {
        lastTtsError = err;
        const errMsg = String((err as any)?.message || err || '');
        if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('403')) {
          break;
        }
        if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
          const isPerDay = /PerDay|FreeTier|GenerateRequestsPerDay/i.test(errMsg);
          if (isPerDay) {
            isDailyQuotaExhausted = true;
            ttsModelCooldownUntil.set(cooldownKey, Date.now() + 1000 * 60 * 5);
            break;
          }
          const waitSec = extractRetryAfterSec(errMsg);
          suggestedRetrySec = waitSec;
          if (attempt === 0 && waitSec <= 12) {
            await new Promise((resolve) => setTimeout(resolve, waitSec * 1000 + 350));
            continue;
          }
          ttsModelCooldownUntil.set(cooldownKey, Date.now() + 1000 * 30);
          break;
        }
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 900));
          continue;
        }
        break;
      }
    }

    const hasAudio = ttsResponse?.candidates?.[0]?.content?.parts?.some((p: any) => p?.inlineData?.data);
    if (hasAudio) break;
    const lastMsg = String(lastTtsError?.message || lastTtsError || '');
    if (lastMsg.includes('API_KEY_INVALID') || lastMsg.includes('PERMISSION_DENIED') || lastMsg.includes('403')) {
      break;
    }
  }

  const parts = ttsResponse?.candidates?.[0]?.content?.parts || [];
  const audioPart = parts.find((p: any) => p?.inlineData?.data);
  const rawBase64 = audioPart?.inlineData?.data;

  if (!rawBase64) {
    const msg = String(lastTtsError?.message || lastTtsError || '');
    const isQuota = !attemptedAny || isDailyQuotaExhausted || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429');
    const isAuth = msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403');
    const isBusy = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('TTS_TIMEOUT');
    const retryable = !isAuth && !isDailyQuotaExhausted;
    const userFriendlyError = isDailyQuotaExhausted
      ? 'سهمیه روزانه کلید رایگان گوگل AI Studio برای تولید صوت تکمیل شده است؛ می‌توانید از «آپلود فایل صوتی MP3» استفاده کنید یا کلید دارای صورت‌حساب (Paid Key) متصل نمایید.'
      : isQuota
      ? 'محدودیت سرعت درخواست لحظه‌ای (RPM) سرویس صوت؛ چند ثانیه صبر و مجدداً تلاش می‌شود.'
      : isAuth
      ? 'کلید API گوگل AI Studio نامعتبر یا غیرفعال است؛ لطفاً کلید معتبر را در تنظیمات متصل کنید.'
      : isBusy
      ? 'سرویس تولید صدای گوگل AI Studio موقتاً شلوغ یا کند است؛ مجدداً تلاش کنید.'
      : 'فایل صوتی از سرویس گوگل AI Studio دریافت نشد. لطفاً اتصال شبکه را بررسی کنید.';
    return {
      ok: false,
      status: isQuota ? 429 : isAuth ? 403 : isBusy ? 503 : 502,
      error: userFriendlyError,
      code: isDailyQuotaExhausted
        ? 'DAILY_QUOTA_EXCEEDED'
        : isQuota
        ? 'RATE_LIMIT_RPM'
        : isAuth
        ? 'API_KEY_INVALID'
        : isBusy
        ? 'UNAVAILABLE'
        : 'TTS_FAILED',
      retryable,
      retryAfterSec: isQuota ? suggestedRetrySec : 3,
    };
  }

  const wavBase64 = ensurePlayableWavBase64(rawBase64, 24000);
  const { audioBase64, mimeType } = await transcodeWavBase64ToMp3Base64(wavBase64);
  return {
    ok: true,
    buffer: Buffer.from(audioBase64, 'base64'),
    audioBase64,
    mimeType,
  };
}

// AI Male Natural Persian Voice Introduction, Golden Tip Narration & Agricultural Weather Report endpoint
app.post('/api/ai/product-voice', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      productId,
      productName,
      categoryLabel,
      tagline,
      description,
      highlights,
      specs,
      priceSummary,
      customScriptText,
      mode = 'product',
    } = req.body || {};

    const cleanCustomScript = typeof customScriptText === 'string' ? customScriptText.trim() : '';

    if ((!productName || typeof productName !== 'string') && cleanCustomScript.length < 10) {
      res.status(400).json({ error: 'نام محصول یا متن معرفی صوتی الزامی است.' });
      return;
    }

    const safeHighlights = Array.isArray(highlights) ? highlights.slice(0, 4) : [];
    const safeSpecs = Array.isArray(specs)
      ? specs.slice(0, 4).map((s: any) => `${s?.label || ''}: ${s?.value || ''}`)
      : [];

    const buildProductSpecificFallback = () => {
      if (cleanCustomScript.length >= 10) {
        return cleanCustomScript;
      }
      if (mode === 'weather') {
        const cleanWeatherDesc = String(description || tagline || '')
          .replace(/°C/gi, ' درجه سانتی‌گراد')
          .replace(/km\/h/gi, ' کیلومتر در ساعت')
          .replace(/%/g, ' درصد')
          .trim();
        const advText = safeHighlights
          .slice(0, 2)
          .map((h) => String(h).replace(/km\/h/gi, 'کیلومتر در ساعت').replace(/%/g, ' درصد'))
          .join(' و ');
        return `سلام و درود خدمت همراهان گرامی گروه زیست‌فناوری مهندس صفری. گزارش هواشناسی و توصیه باغبانی امروز برای منطقه ${productName} آماده است. ${cleanWeatherDesc ? cleanWeatherDesc + '.' : ''} ${advText ? 'مهم‌ترین اقدام‌های امروز شامل ' + advText + ' می‌باشد.' : ''}`;
      }
      const cleanDesc = String(description || tagline || '')
        .replace(/pH/gi, 'میزان اسیدیته')
        .replace(/EC/gi, 'شوری')
        .replace(/dS\/m/gi, 'دسی‌زیمنس بر متر')
        .replace(/%/g, ' درصد')
        .trim();
      const hText = safeHighlights
        .slice(0, 2)
        .map((h) => String(h).replace(/pH/gi, 'میزان اسیدیته').replace(/EC/gi, 'شوری').replace(/%/g, ' درصد'))
        .join(' و ');
      return `سلام و درود خدمت شما همراه عزیز گروه زیست‌فناوری مهندس صفری. محصول «${productName}» از دسته ${categoryLabel || 'محصولات تخصصی کشاورزی'} آماده عرضه است. ${cleanDesc ? cleanDesc.slice(0, 180) + '.' : ''} ${hText ? 'از مهم‌ترین ویژگی‌های این محصول می‌توان به ' + hText + ' اشاره کرد.' : ''} ${priceSummary ? 'بسته‌بندی‌های قابل سفارش شامل ' + priceSummary + ' می‌باشد.' : ''}`;
    };

    if (!process.env.GEMINI_API_KEY) {
      const fallbackScript = buildProductSpecificFallback();
      if (mode === 'script_only') {
        res.json({ scriptText: fallbackScript, isFallback: true });
        return;
      }
      res.status(503).json({
        error: 'سرویس تولید صدای هوش مصنوعی در حال حاضر در سرور پیکربندی نشده است.',
        scriptText: fallbackScript,
      });
      return;
    }

    const generateProductScriptWithAi = async (): Promise<string> => {
      const scriptPrompt =
        mode === 'weather'
          ? `شما کارشناس هواشناسی کشاورزی و مشاور باغبانی آقا در مجموعه «مهندس صفری» هستید.
بر اساس اطلاعات زنده هواشناسی زیر، یک گزارش صوتی کوتاه، گرم، دقیق و کاربردی به فارسی معیار (حدود ۶۵ تا ۹۰ کلمه) بنویسید تا کشاورز و باغدار بداند امروز دقیقاً چه اقدام باغبانی یا کوددهی باید انجام دهد:
اطلاعات هواشناسی شهر و منطقه: ${productName} (${categoryLabel || ''})
خلاصه وضعیت فعلی و پیش‌بینی: ${String(description || tagline || '').slice(0, 500)}
توصیه‌های فنی امروز: ${safeHighlights.join(' | ')}

قواعد:
۱. فقط متن گفتاری آماده خواندن بنویسید؛ بدون بولت، ایموجی و مارک‌داون.
۲. به دمای هوا، رطوبت یا باد و وضعیت خاک اشاره کنید و دقیقاً راهنمایی کنید امروز برای آبیاری، محلول‌پاشی ورمی‌تی یا چالکود ورمیکمپوست مناسب است یا نه.
۳. از کلمات یا نمادهای انگلیسی مثل °C یا km/h یا % یا ET0 استفاده نکنید؛ مثلاً بنویسید «درجه سانتی‌گراد»، «کیلومتر در ساعت» و «درصد».`
          : mode === 'tip'
          ? `شما مشاور ارشد کشاورزی و باغبانی آقا در مجموعه «مهندس صفری» هستید.
متن زیر را به صورت یک گفتار صوتی کوتاه، گرم، طبیعی و روان به فارسی معیار برای شنونده بازنویسی کنید (فقط متن گفتاری بدون بولت، ایموجی و علائم انگلیسی):
عنوان: ${productName}
دسته‌بندی: ${categoryLabel || ''}
توضیحات: ${String(description || tagline || '').slice(0, 400)}`
          : `شما یک مشاور و فروشنده حرفه‌ای آقا در فروشگاه محصولات کشاورزی و کودهای زیستی «مهندس صفری» هستید.
یک متن معرفی صوتی کوتاه، اختصاصی، صمیمی و کاملاً متناسب با همین محصول بنویسید (حدود ۶۰ تا ۸۵ کلمه، فقط متن گفتاری آماده خواندن).

اطلاعات اختصاصی همین محصول:
- نام محصول: ${productName}
- دسته‌بندی: ${categoryLabel || ''}
- شعار کوتاه: ${tagline || ''}
- توضیحات: ${String(description || '').slice(0, 350)}
- مزایای کلیدی: ${safeHighlights.join(' | ')}
- مشخصات آزمایشگاهی: ${safeSpecs.join(' | ')}
- بسته‌بندی و قیمت: ${priceSummary || ''}

قواعد بسیار مهم:
۱. متن باید ۱۰۰ درصد اختصاصی برای «${productName}» باشد و از جملات تکراری و کلیشه‌ای عمومی استفاده نکنید.
۲. فقط متن گفتاری خالص بنویسید؛ بدون بولت، بدون ایموجی، بدون ستاره یا علامت مارک‌داون.
۳. از کلمات انگلیسی و علائم فنی مثل pH، EC، dS/m یا اسلش استفاده نکنید؛ مثلاً به جای pH بنویسید «میزان اسیدیته»، به جای EC بنویسید «شوری و هدایت الکتریکی» و به جای % بنویسید «درصد».
۴. با سلام گرم شروع کنید، کاربرد دقیق و ۲ مزیت منحصربه‌فرد همین محصول را بگویید و شنونده را به ثبت سفارش راهنمایی کنید.`;

      try {
        const textResp = await Promise.race([
          getAiClient().models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: scriptPrompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4500)),
        ]);
        const generated =
          textResp && typeof (textResp as any).text === 'string' ? (textResp as any).text.trim() : '';
        if (generated.length >= 35) {
          return generated.replace(/[*#_`•]/g, '').trim();
        }
      } catch (scriptErr) {
        console.warn('Voice script generation fallback used:', scriptErr);
      }
      return buildProductSpecificFallback();
    };

    if (mode === 'script_only') {
      const scriptText = await generateProductScriptWithAi();
      res.json({ scriptText });
      return;
    }

    const cacheKey = JSON.stringify({
      mode,
      productId: productId || productName,
      productName,
      categoryLabel,
      cleanCustomScript,
      priceSummary: cleanCustomScript ? '' : priceSummary,
    });

    const cached = productVoiceCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < 1000 * 60 * 60 * 6) {
      res.json({
        audioBase64: cached.audioBase64,
        mimeType: cached.mimeType,
        scriptText: cached.scriptText,
        cached: true,
      });
      return;
    }

    const rawVoiceText =
      cleanCustomScript.length >= 10
        ? cleanCustomScript.replace(/[*#_`•]/g, '').trim()
        : buildProductSpecificFallback();
    const scriptText = rawVoiceText.replace(/[*#_`•]/g, '').trim();

    const ttsResult = await synthesizeSpeechToMp3Buffer({ scriptText, mode });
    if (!ttsResult.ok) {
      res.status(ttsResult.status).json({
        error: ttsResult.error,
        code: ttsResult.code,
        retryable: ttsResult.retryable,
        retryAfterSec: ttsResult.retryAfterSec,
        scriptText,
      });
      return;
    }

    if (productVoiceCache.size > 60) {
      const oldestKey = productVoiceCache.keys().next().value;
      if (oldestKey) productVoiceCache.delete(oldestKey);
    }
    productVoiceCache.set(cacheKey, {
      audioBase64: ttsResult.audioBase64,
      mimeType: ttsResult.mimeType,
      scriptText,
      createdAt: Date.now(),
    });

    res.json({ audioBase64: ttsResult.audioBase64, mimeType: ttsResult.mimeType, scriptText, cached: false });
  } catch (error: any) {
    console.error('Error in /api/ai/product-voice:', error);
    res.status(500).json({
      error: 'خطا در تولید معرفی صوتی',
      details: error?.message || 'خطای ناشناخته',
    });
  }
});

// Telegram Store Bot & Mini App Backend Service
const telegramStoreBot = createTelegramStoreBotService({
  getAgriculturalWeather: async (province: string, city: string) => {
    const resp = await fetch(
      `http://127.0.0.1:${PORT}/api/weather?province=${encodeURIComponent(province || 'تهران')}&city=${encodeURIComponent(city || 'تهران')}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!resp.ok) {
      throw new Error('Weather lookup failed');
    }
    return resp.json();
  },
  getConsultantReply: async (question: string, ctx?: { city?: string; province?: string }) => {
    const matches = searchPlantProfiles(question).slice(0, 4).map((pl) => ({
      name: pl.name,
      categoryLabel: pl.categoryLabel,
      instructions: pl.scientificDose.instructions,
      bestMonthsFa: pl.scientificDose.bestMonthsFa,
      vermiKgPerUnit: pl.scientificDose.vermiKgPerUnit,
      compostKgPerUnit: pl.scientificDose.compostKgPerUnit,
      zeoliteKgPerUnit: pl.scientificDose.zeoliteKgPerUnit,
      liquidTeaLiterPerUnit: pl.scientificDose.liquidTeaLiterPerUnit,
      unitLabel: pl.scientificDose.unitLabel,
    }));
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/ai/consultant-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        customerProfile: {
          province: ctx?.province || 'تهران',
          city: ctx?.city || 'تهران',
        },
        plantKnowledgeSummary: matches,
      }),
      signal: AbortSignal.timeout(16000),
    });
    const data: any = await resp.json().catch(() => null);
    return data?.reply || 'پاسخ مشاور دریافت نشد؛ لطفاً سوال خود را با نام گیاه یا درخت مطرح فرمایید.';
  },
  getMediaBufferByFileId: (fileId: string) => telegramCloudDb.getMediaBufferByFileId(fileId),
  getProductVoiceClip: async (product) => {
    const clipId = `prod_${product.id}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    const storedClip = await telegramCloudDb.resolveVoiceClip(clipId).catch(() => null);
    if (storedClip?.audioBase64) {
      return {
        buffer: Buffer.from(storedClip.audioBase64, 'base64'),
        mimeType: storedClip.mimeType || 'audio/mpeg',
        scriptText: (storedClip.scriptText || product.voiceIntroText || '').trim(),
      };
    }

    const customScript = (product.voiceIntroText || '').replace(/[*#_`•]/g, '').trim();
    const cleanDesc = (product.description || product.tagline || '')
      .replace(/pH/gi, 'میزان اسیدیته')
      .replace(/EC/gi, 'شوری')
      .replace(/dS\/m/gi, 'دسی‌زیمنس بر متر')
      .replace(/%/g, ' درصد')
      .trim();
    const hText = (product.highlights || [])
      .slice(0, 2)
      .map((h) => String(h).replace(/pH/gi, 'میزان اسیدیته').replace(/EC/gi, 'شوری').replace(/%/g, ' درصد'))
      .join(' و ');
    const priceSummary = (product.packagingOptions || [])
      .slice(0, 2)
      .map((pk) => `${pk.title || pk.weightOrVolume} با قیمت ${pk.priceToman.toLocaleString('fa-IR')} تومان`)
      .join(' و ');

    const scriptText =
      customScript.length >= 10
        ? customScript
        : `سلام و درود خدمت شما همراه عزیز گروه زیست‌فناوری مهندس صفری. محصول «${product.name}» از دسته ${product.categoryLabel || 'محصولات تخصصی کشاورزی'} آماده عرضه است. ${cleanDesc ? cleanDesc.slice(0, 180) + '.' : ''} ${hText ? 'از مهم‌ترین ویژگی‌های این محصول می‌توان به ' + hText + ' اشاره کرد.' : ''} ${priceSummary ? 'بسته‌بندی‌های قابل سفارش شامل ' + priceSummary + ' می‌باشد.' : ''}`;

    const cacheKey = JSON.stringify({
      mode: 'product',
      productId: product.id,
      productName: product.name,
      categoryLabel: product.categoryLabel,
      cleanCustomScript: customScript,
      priceSummary: customScript ? '' : priceSummary,
    });
    const memCached = productVoiceCache.get(cacheKey);
    if (memCached && Date.now() - memCached.createdAt < 1000 * 60 * 60 * 6) {
      return {
        buffer: Buffer.from(memCached.audioBase64, 'base64'),
        mimeType: memCached.mimeType,
        scriptText: memCached.scriptText || scriptText,
      };
    }

    if (process.env.GEMINI_API_KEY) {
      const ttsRes = await synthesizeSpeechToMp3Buffer({ scriptText, mode: 'product' }).catch(() => null);
      if (ttsRes && ttsRes.ok) {
        productVoiceCache.set(cacheKey, {
          audioBase64: ttsRes.audioBase64,
          mimeType: ttsRes.mimeType,
          scriptText,
          createdAt: Date.now(),
        });
        return {
          buffer: ttsRes.buffer,
          mimeType: ttsRes.mimeType,
          scriptText,
        };
      }
    }

    return { scriptText };
  },
  onBotOrderCreated: (order, telegramUserId) => {
    const phoneMeta =
      telegramUserId !== undefined ? telegramStoreBot.getUserPhonesCopy()[String(telegramUserId)] : undefined;
    const customer = telegramCloudDb.upsertCustomerFromTelegramOrder({
      fullName: order.customerName,
      phoneNumber: order.phoneNumber,
      province: order.province,
      city: order.city,
      deliveryAddress: order.deliveryAddress,
      telegramUserId,
      telegramUsername: phoneMeta?.username,
      telegramFullName: phoneMeta?.fullName,
    });
    telegramCloudDb.saveOrderMutation({
      action: 'upsert',
      order: {
        ...order,
        customerId: customer.id,
      },
    });
  },
  onWebAppUrlConfigured: (webAppUrl) => {
    telegramCloudDb.setWebAppUrlInSettings(webAppUrl);
  },
  onPaymentReceiptReceived: (receipt) => {
    return telegramCloudDb.attachPaymentReceiptToLatestOrder({
      phoneNumber: receipt.phoneNumber,
      customerName: receipt.fullName,
      receiptSummary: receipt.contentSummary,
    });
  },
  onClientSyncState: async (input) => {
    const cur = telegramCloudDb.getStoreBotSnapshot();
    const hasCloudData =
      Object.keys(cur.productOverrides || {}).length > 0 ||
      Object.keys(cur.settings || {}).length > 0 ||
      (cur.orders || []).length > 0;
    if (!hasCloudData && (input.settings || input.productOverrides || input.orders)) {
      await telegramCloudDb.saveStateMutation({
        settings: input.settings,
        productOverrides: input.productOverrides,
        orders: input.orders,
        pushNow: false,
      });
    } else {
      telegramStoreBot.syncStoreSnapshot(cur);
    }
  },
});

const buildPublicLiveDbPayload = (): Record<string, unknown> | null => {
  const boot = telegramCloudDb.getBootstrapPayload(0) as Record<string, any>;
  const botSnap = telegramCloudDb.getStoreBotSnapshot();
  return {
    dbVersionMs: boot.dbVersionMs,
    updatedAt: boot.updatedAt,
    settings: boot.settings,
    productOverrides: boot.productOverrides,
    voiceIndex: boot.voiceIndex,
    vermiPricePerKg: botSnap.vermiPricePerKg,
    workshop: boot.workshop,
  };
};

const telegramCloudDb = createTelegramCloudDbService({
  getBotToken: () => telegramStoreBot.getBotToken(),
  getAdminChatId: () => telegramStoreBot.getAdminChatId(),
  getStorageChatId: () => telegramStoreBot.getStorageChatId(),
  getUserPhones: () => telegramStoreBot.getUserPhonesCopy(),
  mergeUserPhones: (phones) => telegramStoreBot.mergeUserPhones(phones),
  onSnapshotChanged: (snap) => {
    telegramStoreBot.syncStoreSnapshot(snap);
    scheduleGithubLiveDbSync(buildPublicLiveDbPayload);
  },
});

// Ensure Telegram bot always starts with the exact latest Cloud DB snapshot (card/IBAN, catalog, orders)
telegramStoreBot.syncStoreSnapshot(telegramCloudDb.getStoreBotSnapshot());

telegramStoreBot.registerRoutes(app);
telegramCloudDb.registerRoutes(app);
registerGithubPagesRoutes(app, buildPublicLiveDbPayload);

// Ensure any unmatched /api/* path or body-parser/express error always returns JSON (never HTML <!doctype>)
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'مسیر وب‌سرویس درخواستی یافت نشد.' });
});

app.use((err: any, req: Request, res: Response, next: any) => {
  if (req.path.startsWith('/api')) {
    res.status(err?.status || 500).json({
      error: 'خطا در پردازش درخواست سرور',
      details: err?.message || 'خطای ناشناخته',
    });
    return;
  }
  next(err);
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' || isDist;
  const httpServer = http.createServer(app);

  if (!isProd) {
    process.env.DISABLE_HMR = 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use((req, res, next) => {
      if (req.path !== '/@vite/client' && !req.path.endsWith('/@vite/client')) {
        next();
        return;
      }
      delete req.headers['accept-encoding'];
      delete req.headers['if-none-match'];
      delete req.headers['if-modified-since'];
      const chunks: Buffer[] = [];
      const origEnd = res.end.bind(res);
      res.write = ((chunk: unknown) => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        return true;
      }) as typeof res.write;
      res.end = ((chunk?: unknown, ...args: unknown[]) => {
        if (chunk && typeof chunk !== 'function') {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        if (chunks.length === 0) {
          return origEnd(chunk as any, ...(args as any));
        }
        const body = Buffer.concat(chunks)
          .toString('utf8')
          .replace('transport.connect(createHMRHandler(handleMessage))', 'void 0')
          .replace('setupForwardConsoleHandler(transport, forwardConsole)', 'void 0')
          .replace('throw new SendBeforeConnectError("send was called before connect")', 'return')
          .replace('throw new SendBeforeConnectError("invoke was called before connect")', 'return');
        res.removeHeader('Content-Length');
        res.removeHeader('ETag');
        return origEnd(body);
      }) as typeof res.end;
      next();
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Safari Biotech Workshop OS running on http://0.0.0.0:${PORT} (mode: ${isProd ? 'production' : 'development'})`);
    void telegramStoreBot
      .autoStartIfConfigured()
      .then(() => telegramCloudDb.bootstrapFromTelegramPinnedMessage(undefined, false))
      .then((res) => {
        if (res?.restored) {
          console.log('Restored store database from Admin Telegram pinned message ✓');
        }
      })
      .finally(() => {
        telegramCloudDb.startPinnedWatcher();
      })
      .catch(() => {});
  });

  let shuttingDown = false;
  const gracefulShutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    telegramCloudDb.closeSseClients();
    void telegramStoreBot.stopBot(false).finally(() => {
      httpServer.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 1200).unref();
    });
  };
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
