import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CustomerOrder, StoreProduct, PackageOption, OrderStatus, UserAccount, WorkshopStoreSettings } from '../types/storefront';
import { getStoreProducts } from '../data/storefrontProducts';
import { getProductImageSrc } from '../data/productDefaultImages';
import {
  loadCustomerOrders,
  updateOrderStatus,
  deleteCustomerOrder,
  loadProductOverrides,
  saveProductOverrides,
  loadStoreSettings,
  saveStoreSettings,
  loadUserAccounts,
  saveUserAccount,
  mergeProductsWithOverrides,
  resolveProductBaseUnitPrice,
  getCloudSyncState,
  getPendingCloudSyncState,
  hasAnyPendingCloudSync,
  normalizeDigits,
  DB_SYNC_EVENT,
  SYNC_STATUS_EVENT,
  CloudSyncState,
} from '../utils/storeStorage';
import { PendingCloudSyncFlags } from '../types/storefront';
import {
  createLocalAppBackup,
  listLocalAppBackups,
  listLocalAppBackupsAsync,
  deleteLocalAppBackup,
  restoreFullAppBackup,
  downloadBackupJsonFile,
  parseUploadedBackupJson,
  FullAppBackupSnapshot,
} from '../utils/appBackup';
import { StoreSealBadge } from './StoreSealBadge';
import {
  AGRICULTURAL_GOLDEN_TIPS,
  TIP_CATEGORIES,
  GoldenTipItem,
  TipCategory,
} from '../data/agriculturalGoldenTips';
import {
  buildProductVoiceClipId,
  buildTipVoiceClipId,
  buildWeatherVoiceClipId,
  buildProductSpecificVoiceScript,
  buildTipVoiceScript,
  generateAndPersistVoiceClip,
  saveUploadedVoiceClip,
  resolvePreGeneratedVoiceClip,
  downloadVoiceClipAudio,
  buildPersianVoiceDownloadName,
  supportsDirectoryPicker,
  writeVoiceClipToDirectoryHandle,
  fetchReadyVoiceClipIndex,
  base64AudioToBlobUrl,
  VOICE_CLIP_UPDATED_EVENT,
} from '../utils/voiceClipStorage';
import { parseJsonResponseSafe } from '../utils/safeFetchJson';
import { useDeviceClock } from '../utils/deviceTime';
import { CORE_APP_VERSION } from '../config/coreAppManifest';
import { IranLocationSelector } from './IranLocationSelector';
import { AgriculturalWeatherWidget } from './AgriculturalWeatherWidget';
import {
  fetchVerifiedTelegramUsersFromServer,
  VerifiedTelegramUserEntry,
} from '../utils/telegramWebApp';
import { TelegramBotManagerPanel } from './TelegramBotManagerPanel';
import { resolveManagerProvinceCity } from '../data/iranCities';
import {
  resolveApiUrl,
  resolveAssetOrApiUrl,
  parseGithubRepoInput,
  buildGithubPagesUrl,
  normalizeBaseUrl,
} from '../utils/apiBase';

// Production OS Components
import { BatchCalculator } from './BatchCalculator';
import { MasoudStation } from './MasoudStation';
import { MohammadStation } from './MohammadStation';
import { LabCertificate } from './LabCertificate';
import { ProcessTimeline } from './ProcessTimeline';
import { TroubleshootingGuide } from './TroubleshootingGuide';
import { AiAssistant } from './AiAssistant';
import { ScienceDeepDive } from './ScienceDeepDive';

import { 
  BatchConfig, 
  BioassayChecklist, 
  FeedingCycleLog, 
  LabSignatories, 
  FormulationResult 
} from '../types/vermicompost';

interface AdminStoreManagerProps {
  currentVermiPricePerKg?: number;
  currentUser: UserAccount | null;
  onPreviewCustomerApp: () => void;
  // Factory OS Props
  config: BatchConfig;
  setConfig: React.Dispatch<React.SetStateAction<BatchConfig>>;
  checklist: BioassayChecklist;
  setChecklist: React.Dispatch<React.SetStateAction<BioassayChecklist>>;
  cycles: FeedingCycleLog[];
  setCycles: React.Dispatch<React.SetStateAction<FeedingCycleLog[]>>;
  signatories: LabSignatories;
  setSignatories: React.Dispatch<React.SetStateAction<LabSignatories>>;
  formulation: FormulationResult;
  onOpenPersonnelModal: () => void;
  onPrintCertificate: () => void;
}

export function AdminStoreManager({
  currentVermiPricePerKg = 24000,
  currentUser,
  onPreviewCustomerApp,
  config,
  setConfig,
  checklist,
  setChecklist,
  cycles,
  setCycles,
  signatories,
  setSignatories,
  formulation,
  onOpenPersonnelModal,
  onPrintCertificate,
}: AdminStoreManagerProps) {
  const deviceClock = useDeviceClock(1000);

  // Admin Sub-tabs: 'orders' | 'products' | 'inventory' | 'production' | 'settings' | 'telegram'
  const [adminTab, setAdminTab] = useState<'orders' | 'products' | 'inventory' | 'production' | 'settings' | 'telegram'>('orders');
  const [settingsSubTab, setSettingsSubTab] = useState<'branding' | 'contacts' | 'commerce' | 'cloud_github' | 'voice_backups'>('branding');
  
  // Production station sub-tab
  const [prodStation, setProdStation] = useState<'calculator' | 'masoud' | 'mohammad' | 'certificate' | 'ai' | 'timeline' | 'troubleshoot' | 'science'>('calculator');

  // Orders State
  const [orders, setOrders] = useState<CustomerOrder[]>(() => loadCustomerOrders());
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('all');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [editStatus, setEditStatus] = useState<OrderStatus>('registered');
  const [editTracking, setEditTracking] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [confirmDeleteOrderNumber, setConfirmDeleteOrderNumber] = useState<string | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState<boolean>(false);

  // Products & Inventory State
  const [productOverrides, setProductOverrides] = useState<Record<string, Partial<StoreProduct>>>(() => loadProductOverrides());
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Store Settings & Telegram Cloud Sync State
  const [settings, setSettings] = useState<WorkshopStoreSettings>(() => loadStoreSettings());
  const [isSettingsDirty, setIsSettingsDirty] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string | null>(null);
  const [settingsErrorMessage, setSettingsErrorMessage] = useState<string | null>(null);
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newAdminUser, setNewAdminUser] = useState('');
  const [syncState, setSyncState] = useState<CloudSyncState>(() => getCloudSyncState());
  const [pendingSyncFlags, setPendingSyncFlags] = useState<PendingCloudSyncFlags>(() => getPendingCloudSyncState());

  // Full App Local Backups Vault (keeps & displays up to 3 previous snapshots)
  const [localBackups, setLocalBackups] = useState<FullAppBackupSnapshot[]>(() => listLocalAppBackups());
  const [backupStatusMsg, setBackupStatusMsg] = useState<string | null>(null);
  const [backupErrorMsg, setBackupErrorMsg] = useState<string | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState<boolean>(false);

  // Refs to prevent async DB_SYNC_EVENT from clobbering active user input
  const isSettingsDirtyRef = useRef(false);
  const isSavingSettingsRef = useRef(false);
  isSettingsDirtyRef.current = isSettingsDirty;
  isSavingSettingsRef.current = isSavingSettings;

  // Local draft map for stock inputs so rapid typing never reverts mid-edit
  const [stockDrafts, setStockDrafts] = useState<Record<string, number>>({});
  const stockDebounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Print invoice modal state
  const [invoiceToPrint, setInvoiceToPrint] = useState<CustomerOrder | null>(null);

  // Merged products list for Admin (includes both active and disabled products, excludes deleted)
  const products = useMemo(() => {
    const base = getStoreProducts(currentVermiPricePerKg);
    return mergeProductsWithOverrides(base, productOverrides, { includeDisabled: true });
  }, [currentVermiPricePerKg, productOverrides]);

  // Deleted products list so manager can inspect & restore any deleted item
  const deletedProducts = useMemo(() => {
    const baseMap = new Map(getStoreProducts(currentVermiPricePerKg).map((p) => [p.id, p]));
    return Object.entries(productOverrides)
      .filter(([, ov]) => ov && ov.isDeleted)
      .map(([id, ov]) => {
        const base = baseMap.get(id);
        return {
          id,
          name: ov.name || base?.name || id,
          category: ov.category || base?.category || 'vermicompost',
          categoryLabel: ov.categoryLabel || base?.categoryLabel || 'محصولات کارگاه',
          imageUrl: ov.imageUrl ?? base?.imageUrl ?? '',
        };
      });
  }, [currentVermiPricePerKg, productOverrides]);

  // Registered user accounts list for admin overview + verified Telegram phone directory
  const [registeredUsers, setRegisteredUsers] = useState<UserAccount[]>(() => loadUserAccounts());
  const [verifiedTgUsers, setVerifiedTgUsers] = useState<VerifiedTelegramUserEntry[]>([]);

  // GitHub & GitHub Pages deployment configuration state
  const [githubServerStatus, setGithubServerStatus] = useState<{
    hasServerToken: boolean;
    autoConfigured?: boolean;
    envOwner?: string;
    envRepo?: string;
    pagesUrl?: string | null;
    liveDbUrl?: string | null;
    liveDbSyncedAt?: string | null;
    liveDbError?: string | null;
    defaultApiBaseUrl?: string;
    workflowExists?: boolean;
  } | null>(null);
  const [githubRepoQuickInput, setGithubRepoQuickInput] = useState('');
  const [githubCheckResult, setGithubCheckResult] = useState<{
    repoFound?: boolean;
    repoFullName?: string;
    defaultBranch?: string;
    visibility?: string;
    pushedAt?: string | null;
    repoHtmlUrl?: string;
    pages?: { enabled: boolean; status?: string; htmlUrl?: string; buildType?: string; cname?: string };
    latestRun?: { status?: string; conclusion?: string | null; htmlUrl?: string; updatedAt?: string } | null;
    pagesUrl?: string;
    liveSiteReachable?: boolean;
    liveStatusCode?: number;
    assetCheckOk?: boolean;
    diagnosis?: 'healthy' | 'raw_branch_source' | 'broken_asset_404' | 'not_published_yet';
    diagnosisMessage?: string;
  } | null>(null);
  const [isCheckingGithub, setIsCheckingGithub] = useState(false);
  const [isDeployingGithub, setIsDeployingGithub] = useState(false);
  const [isSyncingGithubLiveDb, setIsSyncingGithubLiveDb] = useState(false);
  const [githubFeedbackMsg, setGithubFeedbackMsg] = useState<string | null>(null);
  const [githubErrorMsg, setGithubErrorMsg] = useState<string | null>(null);
  const [copiedGithubKey, setCopiedGithubKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchVerifiedTelegramUsersFromServer().then((entries) => {
      if (!cancelled) setVerifiedTgUsers(entries);
    });
    void fetch(resolveApiUrl('/api/github/status'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.ok) {
          const defaultUrl =
            data.defaultApiBaseUrl ||
            (typeof window !== 'undefined' &&
            window.location.origin.startsWith('https://') &&
            !window.location.hostname.endsWith('.github.io')
              ? window.location.origin
              : '');
          setGithubServerStatus({
            hasServerToken: Boolean(data.hasServerToken),
            autoConfigured: Boolean(data.autoConfigured),
            envOwner: data.envOwner || '',
            envRepo: data.envRepo || '',
            pagesUrl: data.pagesUrl || null,
            liveDbUrl: data.liveDbUrl || null,
            liveDbSyncedAt: data.liveDbSyncedAt || null,
            liveDbError: data.liveDbError || null,
            defaultApiBaseUrl: defaultUrl,
            workflowExists: Boolean(data.workflowExists),
          });
          setSettings((prev) => {
            const nextOwner = prev.githubOwner || data.envOwner || '';
            const nextRepo = prev.githubRepo || data.envRepo || '';
            const nextApi = normalizeBaseUrl(prev.githubApiBaseUrl) || normalizeBaseUrl(defaultUrl) || '';
            const nextEnabled = Boolean(prev.githubPagesEnabled || data.autoConfigured);
            const nextTgWebApp =
              normalizeBaseUrl(prev.telegramWebAppUrl) ||
              normalizeBaseUrl(data.pagesUrl) ||
              normalizeBaseUrl(defaultUrl) ||
              '';
            if (
              nextOwner === (prev.githubOwner || '') &&
              nextRepo === (prev.githubRepo || '') &&
              nextApi === (prev.githubApiBaseUrl || '') &&
              nextEnabled === Boolean(prev.githubPagesEnabled) &&
              nextTgWebApp === (prev.telegramWebAppUrl || '')
            ) {
              return prev;
            }
            return {
              ...prev,
              githubOwner: nextOwner,
              githubRepo: nextRepo,
              githubApiBaseUrl: nextApi,
              githubBranch: prev.githubBranch || 'main',
              githubPagesEnabled: nextEnabled,
              telegramWebAppUrl: nextTgWebApp,
            };
          });
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  const tgEntryByPhone = useMemo(() => {
    const map = new Map<string, VerifiedTelegramUserEntry>();
    for (const entry of verifiedTgUsers) {
      const norm = normalizeDigits(entry.phoneNumber);
      if (norm) map.set(norm, entry);
    }
    return map;
  }, [verifiedTgUsers]);

  // Product currently being edited or created in modal
  const editingProduct = useMemo(() => {
    if (!editingProductId) return null;
    return (
      products.find(p => p.id === editingProductId) || {
        id: editingProductId,
        name: '',
        category: 'vermicompost',
        categoryLabel: 'بیوکود تخصصی',
        tagline: '',
        description: '',
        highlights: [],
        specs: [],
        packagingOptions: [],
        rating: 4.9,
        reviewCount: 1,
        deliveryTimeDays: '۱ الی ۳ روز کاری',
        colorScheme: 'emerald' as const,
        imageUrl: '',
        isDisabled: false,
        baseUnitPriceToman: 24000,
        baseUnitLabel: 'کیلوگرم',
        inStock: true,
        stockQuantity: 100,
        stockUnit: 'کیسه',
        isCustomProduct: true,
      }
    );
  }, [editingProductId, products]);

  // Local state for full product editor modal
  const [editModalTab, setEditModalTab] = useState<'info' | 'packaging' | 'specs'>('info');
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [modalProdName, setModalProdName] = useState('');
  const [modalProdCategory, setModalProdCategory] = useState('vermicompost');
  const [modalProdCategoryLabel, setModalProdCategoryLabel] = useState('بیوکود تخصصی');
  const [modalProdBadge, setModalProdBadge] = useState('');
  const [modalProdDeliveryDays, setModalProdDeliveryDays] = useState('۱ الی ۳ روز کاری');
  const [modalProdTagline, setModalProdTagline] = useState('');
  const [modalProdDescription, setModalProdDescription] = useState('');
  const [modalProdImageUrl, setModalProdImageUrl] = useState('');
  const [modalProdIsDisabled, setModalProdIsDisabled] = useState(false);
  const [modalProdInStock, setModalProdInStock] = useState(true);
  const [modalProdStockQty, setModalProdStockQty] = useState(0);
  const [modalProdStockUnit, setModalProdStockUnit] = useState('کیسه');
  const [modalBaseUnitPrice, setModalBaseUnitPrice] = useState(0);
  const [modalBaseUnitLabel, setModalBaseUnitLabel] = useState('کیلوگرم');
  const [modalPackaging, setModalPackaging] = useState<PackageOption[]>([]);
  const [modalSpecs, setModalSpecs] = useState<{ label: string; value: string }[]>([]);
  const [modalHighlights, setModalHighlights] = useState<string[]>([]);
  const [confirmDeleteProdId, setConfirmDeleteProdId] = useState<string | null>(null);
  const [showDeletedProducts, setShowDeletedProducts] = useState(false);
  const [aiImagePrompt, setAiImagePrompt] = useState('');
  const [isProcessingAiImage, setIsProcessingAiImage] = useState(false);
  const [aiImageError, setAiImageError] = useState<string | null>(null);

  // Product & Golden Tips Pre-Generated Voice Studio State
  const [modalProdVoiceText, setModalProdVoiceText] = useState('');
  const [isGeneratingProductVoice, setIsGeneratingProductVoice] = useState(false);
  const [isGeneratingProductScript, setIsGeneratingProductScript] = useState(false);
  const [productVoiceMessage, setProductVoiceMessage] = useState<string | null>(null);
  const [productVoiceError, setProductVoiceError] = useState<string | null>(null);
  const [readyVoiceClips, setReadyVoiceClips] = useState<
    Record<string, { kind: 'product' | 'tip' | 'weather'; targetId: string; scriptText: string; updatedAt: string }>
  >({});
  const [playingVoiceClipId, setPlayingVoiceClipId] = useState<string | null>(null);
  const adminAudioRef = useRef<HTMLAudioElement | null>(null);

  // Batch Voice Studio & Weather Voice Briefing State in Settings
  const [voiceStudioCategory, setVoiceStudioCategory] = useState<'all' | TipCategory>('all');
  const [isBatchGeneratingVoice, setIsBatchGeneratingVoice] = useState(false);
  const [batchVoiceProgress, setBatchVoiceProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const batchVoiceCancelRef = useRef(false);
  const [voiceStudioStatusMsg, setVoiceStudioStatusMsg] = useState<string | null>(null);
  const [voiceStudioErrorMsg, setVoiceStudioErrorMsg] = useState<string | null>(null);
  const [weatherVoiceScript, setWeatherVoiceScript] = useState<string>(
    'سلام و وقت بخیر خدمت باغداران و کشاورزان گرامی. گزارش هواشناسی کشاورزی امروز نشان می‌دهد بهترین زمان سمپاشی و محلول‌پاشی، ساعات خنک صبح یا غروب با سرعت باد زیر ۱۰ کیلومتر بر ساعت است. پیش از سمپاشی حتماً دمای محیط و احتمال بارش ۶ ساعت آینده را بررسی کنید.'
  );
  const [isGeneratingWeatherVoice, setIsGeneratingWeatherVoice] = useState<boolean>(false);
  const [selectedProductVoiceIds, setSelectedProductVoiceIds] = useState<string[]>([]);
  const [selectedTipVoiceIds, setSelectedTipVoiceIds] = useState<string[]>([]);
  const [isBatchDownloadingVoice, setIsBatchDownloadingVoice] = useState<boolean>(false);
  const [batchDownloadProgress, setBatchDownloadProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const batchDownloadCancelRef = useRef(false);
  const [savedVoiceDirHandle, setSavedVoiceDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [customDownloadPathInput, setCustomDownloadPathInput] = useState<string>(() => {
    try {
      return localStorage.getItem('safari_admin_voice_save_path_v1') || 'صوت-کارگاه-صفری';
    } catch {
      return 'صوت-کارگاه-صفری';
    }
  });
  const [organizeByCategoryFolders, setOrganizeByCategoryFolders] = useState<boolean>(true);
  const [pendingDownloadRequest, setPendingDownloadRequest] = useState<{
    title: string;
    inProductModal?: boolean;
    items: {
      clipId: string;
      fileBaseName: string;
      label: string;
      subfolder: string;
    }[];
  } | null>(null);
  const [downloadPathModalNotice, setDownloadPathModalNotice] = useState<string | null>(null);
  const [showAdminLiveWeather, setShowAdminLiveWeather] = useState<boolean>(false);

  const adminWeatherLocation = useMemo(
    () => resolveManagerProvinceCity(settings, currentUser),
    [settings, currentUser]
  );

  useEffect(() => {
    let mounted = true;
    const refreshVoiceIndex = () => {
      fetchReadyVoiceClipIndex().then((idx) => {
        if (mounted) setReadyVoiceClips(idx);
      });
    };
    const initialVoiceTimer = window.setTimeout(refreshVoiceIndex, 600);
    window.addEventListener(VOICE_CLIP_UPDATED_EVENT, refreshVoiceIndex);
    listLocalAppBackupsAsync().then((snaps) => {
      if (mounted && snaps.length > 0) setLocalBackups(snaps);
    });
    return () => {
      mounted = false;
      window.clearTimeout(initialVoiceTimer);
      window.removeEventListener(VOICE_CLIP_UPDATED_EVENT, refreshVoiceIndex);
      if (adminAudioRef.current) {
        try {
          adminAudioRef.current.pause();
        } catch {
          // ignore
        }
        adminAudioRef.current = null;
      }
    };
  }, []);

  // Telegram Cloud DB pushes every settings, product, and order update directly to the Telegram Bot snapshot on the server.

  const showSuccessToast = (msg: string) => {
    setSettingsErrorMessage(null);
    setSettingsSavedMessage(msg);
    setTimeout(() => setSettingsSavedMessage(null), 4000);
  };

  const showErrorToast = (msg: string) => {
    setSettingsSavedMessage(null);
    setSettingsErrorMessage(msg);
    setTimeout(() => setSettingsErrorMessage(null), 5000);
  };

  const STANDARD_CATEGORIES = [
    { id: 'vermicompost', label: 'بیوکود تخصصی (ورمیکمپوست)' },
    { id: 'compost', label: 'اصلاح‌کننده فیزیکی خاک (کمپوست)' },
    { id: 'liquid', label: 'کود مایع بیولوژیک' },
    { id: 'mineral', label: 'مکمل معدنی اصلاح خاک' },
    { id: 'substrate', label: 'بستر تخصصی کشت' },
    { id: 'starter', label: 'موجود زنده و استارتر' },
  ];

  // Open edit modal for existing product
  const handleOpenEditProduct = (prod: StoreProduct, initialTab: 'info' | 'packaging' | 'specs' = 'info') => {
    const unitPrice = prod.baseUnitPriceToman && prod.baseUnitPriceToman > 0
      ? prod.baseUnitPriceToman
      : resolveProductBaseUnitPrice(prod);
    const unitLabel = prod.baseUnitLabel || (prod.category === 'liquid' ? 'لیتر' : 'کیلوگرم');

    setIsCreatingProduct(false);
    setEditModalTab(initialTab);
    setEditingProductId(prod.id);
    setModalProdName(prod.name);
    setModalProdCategory(prod.category);
    setModalProdCategoryLabel(prod.categoryLabel);
    setModalProdBadge(prod.badge || '');
    setModalProdDeliveryDays(prod.deliveryTimeDays || '۱ الی ۳ روز کاری');
    setModalProdTagline(prod.tagline);
    setModalProdDescription(prod.description || '');
    setModalProdImageUrl(prod.imageUrl || '');
    setModalProdIsDisabled(Boolean(prod.isDisabled));
    setModalProdInStock(prod.inStock);
    setModalProdStockQty(prod.stockQuantity);
    setModalProdStockUnit(prod.stockUnit || 'کیسه');
    setModalBaseUnitPrice(unitPrice);
    setModalBaseUnitLabel(unitLabel);
    setModalProdVoiceText(prod.voiceIntroText?.trim() || buildProductSpecificVoiceScript(prod));
    setProductVoiceMessage(null);
    setProductVoiceError(null);
    setAiImagePrompt('');
    setAiImageError(null);
    setModalPackaging(
      JSON.parse(JSON.stringify(prod.packagingOptions)).map((pkg: PackageOption) => {
        const expected = unitPrice > 0 && pkg.nominalWeightKg > 0 ? Math.round(unitPrice * pkg.nominalWeightKg) : 0;
        const orig = pkg.originalPriceToman && pkg.originalPriceToman > pkg.priceToman ? pkg.originalPriceToman : expected;
        const discToman = orig > pkg.priceToman ? orig - pkg.priceToman : (pkg.discountToman || 0);
        const discPct = orig > pkg.priceToman ? Math.round(((orig - pkg.priceToman) / orig) * 1000) / 10 : (pkg.discountPercent || 0);
        return {
          ...pkg,
          originalPriceToman: orig > 0 ? orig : undefined,
          discountToman: discToman,
          discountPercent: discPct,
        };
      })
    );
    setModalSpecs(JSON.parse(JSON.stringify(prod.specs || [])));
    setModalHighlights(JSON.parse(JSON.stringify(prod.highlights || [])));
  };

  // Open modal to create a brand new product in catalog
  const handleOpenCreateProduct = () => {
    const newId = `prod-custom-${Date.now()}`;
    setIsCreatingProduct(true);
    setEditModalTab('info');
    setEditingProductId(newId);
    setModalProdName('');
    setModalProdCategory('vermicompost');
    setModalProdCategoryLabel('بیوکود تخصصی');
    setModalProdBadge('محصول جدید');
    setModalProdDeliveryDays('۱ الی ۳ روز کاری');
    setModalProdTagline('');
    setModalProdDescription('');
    setModalProdImageUrl('');
    setModalProdIsDisabled(false);
    setModalProdInStock(true);
    setModalProdStockQty(100);
    setModalProdStockUnit('کیسه');
    setModalBaseUnitPrice(24000);
    setModalBaseUnitLabel('کیلوگرم');
    setModalProdVoiceText('');
    setProductVoiceMessage(null);
    setProductVoiceError(null);
    setAiImagePrompt('');
    setAiImageError(null);
    setModalPackaging([
      {
        id: `pkg-${Date.now()}-1`,
        title: 'کیسه ۲۵ کیلوگرمی استاندارد',
        weightOrVolume: '۲۵ کیلوگرم',
        nominalWeightKg: 25,
        priceToman: 600000,
        originalPriceToman: 600000,
        discountToman: 0,
        discountPercent: 0,
        isPopular: true,
      },
    ]);
    setModalSpecs([
      { label: 'ماده آلی کل (OM)', value: '> ۴۵٪' },
      { label: 'میزان اسیدیته (pH)', value: '۷.۰' },
    ]);
    setModalHighlights(['تضمین کیفیت مستقیم از کارگاه مهندس صفری']);
  };

  // Recalculate discount amount & percentage for a package against base unit price
  const syncPackageMetricsFromPrice = (pkg: PackageOption, newPrice: number, unitPrice: number): PackageOption => {
    const expectedRef = unitPrice > 0 && pkg.nominalWeightKg > 0 ? Math.round(unitPrice * pkg.nominalWeightKg) : 0;
    if (expectedRef > 0 && newPrice < expectedRef) {
      const discToman = expectedRef - newPrice;
      const discPct = Math.round((discToman / expectedRef) * 1000) / 10;
      return {
        ...pkg,
        priceToman: newPrice,
        originalPriceToman: expectedRef,
        discountToman: discToman,
        discountPercent: discPct,
      };
    }
    return {
      ...pkg,
      priceToman: newPrice,
      originalPriceToman: expectedRef > 0 ? expectedRef : undefined,
      discountToman: 0,
      discountPercent: 0,
    };
  };

  const syncPackageMetricsFromDiscountPct = (pkg: PackageOption, pct: number, unitPrice: number): PackageOption => {
    const clampedPct = Math.max(0, Math.min(99, pct));
    const expectedRef = unitPrice > 0 && pkg.nominalWeightKg > 0 ? Math.round(unitPrice * pkg.nominalWeightKg) : pkg.priceToman;
    const newPrice = Math.round(expectedRef * (1 - clampedPct / 100));
    const discToman = Math.max(0, expectedRef - newPrice);
    return {
      ...pkg,
      priceToman: newPrice,
      originalPriceToman: expectedRef,
      discountToman: discToman,
      discountPercent: clampedPct,
    };
  };

  const handleRecalcAllPackagesFromUnitPrice = () => {
    if (modalBaseUnitPrice <= 0) return;
    setModalPackaging((prev) =>
      prev.map((pkg) => {
        const pct = pkg.discountPercent || 0;
        if (pkg.nominalWeightKg > 0) {
          const ref = Math.round(modalBaseUnitPrice * pkg.nominalWeightKg);
          const price = Math.round(ref * (1 - pct / 100));
          return {
            ...pkg,
            originalPriceToman: ref,
            priceToman: price,
            discountToman: Math.max(0, ref - price),
            discountPercent: pct,
          };
        }
        return pkg;
      })
    );
  };

  // Listen for Telegram Cloud DB realtime sync & status events
  useEffect(() => {
    const handleDbSync = () => {
      setOrders(loadCustomerOrders());
      setProductOverrides(loadProductOverrides());
      setRegisteredUsers(loadUserAccounts());
      setPendingSyncFlags(getPendingCloudSyncState());
      setLocalBackups(listLocalAppBackups());
      void fetchVerifiedTelegramUsersFromServer().then((entries) => {
        setVerifiedTgUsers(entries);
      });
      // Never overwrite settings form inputs while manager is editing or saving
      if (!isSettingsDirtyRef.current && !isSavingSettingsRef.current) {
        setSettings(loadStoreSettings());
      }
    };

    const handleSyncStatus = (e: Event) => {
      const detail = (e as CustomEvent<CloudSyncState>).detail;
      if (detail) {
        setSyncState(detail);
      } else {
        setSyncState(getCloudSyncState());
      }
      setPendingSyncFlags(getPendingCloudSyncState());
    };

    window.addEventListener(DB_SYNC_EVENT, handleDbSync);
    window.addEventListener(SYNC_STATUS_EVENT, handleSyncStatus);
    return () => {
      window.removeEventListener(DB_SYNC_EVENT, handleDbSync);
      window.removeEventListener(SYNC_STATUS_EVENT, handleSyncStatus);
      Object.values(stockDebounceTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  // Update a local settings field safely (marks form dirty so remote snapshots don't overwrite)
  const handleSettingChange = <K extends keyof WorkshopStoreSettings>(field: K, value: WorkshopStoreSettings[K]) => {
    isSettingsDirtyRef.current = true;
    setIsSettingsDirty(true);
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  // Save full product changes (including packaging titles, unit rates, specs, categories) to Telegram Cloud DB
  const handleSaveProductEdit = async () => {
    if (!editingProductId) return;
    if (!modalProdName.trim()) {
      showErrorToast('لطفاً نام محصول را وارد کنید.');
      return;
    }

    const sanitizedPackaging = modalPackaging
      .filter((p) => p.title.trim() || p.weightOrVolume.trim())
      .map((p) => ({
        ...p,
        title: p.title.trim() || p.weightOrVolume.trim(),
        weightOrVolume: p.weightOrVolume.trim() || p.title.trim(),
      }));

    if (sanitizedPackaging.length === 0) {
      showErrorToast('حداقل یک بسته‌بندی و نرخ فروش برای محصول تعریف کنید.');
      return;
    }

    const latestOverrides = loadProductOverrides();
    const cleanSpecs = modalSpecs.filter((s) => s.label.trim() && s.value.trim());
    const cleanHighlights = modalHighlights.filter((h) => h.trim());

    const updatedOverrides = {
      ...latestOverrides,
      [editingProductId]: {
        ...(latestOverrides[editingProductId] || {}),
        name: modalProdName.trim(),
        category: modalProdCategory.trim() || 'vermicompost',
        categoryLabel: modalProdCategoryLabel.trim() || 'محصولات کارگاه',
        badge: modalProdBadge.trim() || undefined,
        deliveryTimeDays: modalProdDeliveryDays.trim() || '۱ الی ۳ روز کاری',
        tagline: modalProdTagline.trim(),
        description: modalProdDescription.trim(),
        imageUrl: modalProdImageUrl.trim(),
        voiceIntroText: modalProdVoiceText.trim() || undefined,
        isDisabled: modalProdIsDisabled,
        inStock: modalProdInStock,
        stockQuantity: modalProdStockQty,
        stockUnit: modalProdStockUnit.trim() || 'کیسه',
        baseUnitPriceToman: modalBaseUnitPrice,
        baseUnitLabel: modalBaseUnitLabel.trim() || 'کیلوگرم',
        packagingOptions: sanitizedPackaging,
        specs: cleanSpecs,
        highlights: cleanHighlights,
        isCustomProduct: editingProduct?.isCustomProduct || isCreatingProduct,
        isDeleted: false,
      },
    };
    setProductOverrides(updatedOverrides);
    setStockDrafts((prev) => {
      const next = { ...prev };
      delete next[editingProductId];
      return next;
    });
    setEditingProductId(null);
    setIsCreatingProduct(false);

    const res = await saveProductOverrides(updatedOverrides);
    setPendingSyncFlags(getPendingCloudSyncState());
    if (res.ok) {
      showSuccessToast(
        isCreatingProduct
          ? 'محصول جدید ثبت و به‌صورت لحظه‌ای در کل برنامه، ربات و مینی‌اپ تلگرام منتشر شد ✓'
          : 'تغییرات کامل محصول به‌صورت ریل‌تایم در فروشگاه، ربات و مینی‌اپ تلگرام اعمال شد ✓'
      );
    } else {
      showErrorToast('خطا در ذخیره تغییرات کالا: ' + (res.error || 'نامشخص'));
    }
  };

  // Delete a product from catalog (soft-mark deleted in overrides — works for ALL products)
  const handleDeleteProduct = async (prodId: string) => {
    const latestOverrides = loadProductOverrides();
    const updatedOverrides = {
      ...latestOverrides,
      [prodId]: {
        ...(latestOverrides[prodId] || {}),
        isDeleted: true,
      },
    };
    setProductOverrides(updatedOverrides);
    setConfirmDeleteProdId(null);
    if (editingProductId === prodId) {
      setEditingProductId(null);
    }
    const res = await saveProductOverrides(updatedOverrides);
    setPendingSyncFlags(getPendingCloudSyncState());
    if (res.ok) {
      showSuccessToast('محصول از کاتالوگ حذف و در لحظه برای مشتریان و ربات تلگرام بروزرسانی شد ✓');
    } else {
      showErrorToast('خطا در حذف محصول: ' + (res.error || 'نامشخص'));
    }
  };

  // Restore a previously deleted product back into the catalog
  const handleRestoreProduct = async (prodId: string) => {
    const latestOverrides = loadProductOverrides();
    const updatedOverrides = {
      ...latestOverrides,
      [prodId]: {
        ...(latestOverrides[prodId] || {}),
        isDeleted: false,
      },
    };
    setProductOverrides(updatedOverrides);
    const res = await saveProductOverrides(updatedOverrides);
    setPendingSyncFlags(getPendingCloudSyncState());
    if (res.ok) {
      showSuccessToast('محصول به کاتالوگ بازگردانده و در لحظه منتشر شد ✓');
    } else {
      showErrorToast('خطا در بازیابی محصول: ' + (res.error || 'نامشخص'));
    }
  };

  // Disable / Enable a product in customer storefront without deleting it
  const handleToggleProductDisabled = async (prodId: string) => {
    const current = products.find((p) => p.id === prodId);
    if (!current) return;
    const nextDisabled = !current.isDisabled;
    const latestOverrides = loadProductOverrides();
    const updatedOverrides = {
      ...latestOverrides,
      [prodId]: {
        ...(latestOverrides[prodId] || {}),
        isDisabled: nextDisabled,
      },
    };
    setProductOverrides(updatedOverrides);
    const res = await saveProductOverrides(updatedOverrides);
    setPendingSyncFlags(getPendingCloudSyncState());
    if (res.ok) {
      showSuccessToast(
        nextDisabled
          ? `کالای «${current.name}» مخفی و در لحظه در کل برنامه و ربات تلگرام اعمال شد ✓`
          : `کالای «${current.name}» فعال و در لحظه در کل برنامه و ربات تلگرام منتشر شد ✓`
      );
    } else {
      showErrorToast('خطا در تغییر وضعیت نمایش کالا: ' + (res.error || 'نامشخص'));
    }
  };

  // Canvas helpers: compress 4:3 product visuals under ~45KB so Firestore catalog_overrides stays lightweight
  const loadHtmlImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('بارگذاری تصویر ناموفق بود.'));
      img.src = src;
    });
  };

  const compressCanvasToProductDataUrl = (canvas: HTMLCanvasElement): string => {
    const qualities = [0.8, 0.68, 0.56];
    for (const q of qualities) {
      const webp = canvas.toDataURL('image/webp', q);
      if (webp.startsWith('data:image/webp') && webp.length <= 62000) {
        return webp;
      }
    }
    const fallbackWebp = canvas.toDataURL('image/webp', 0.48);
    if (fallbackWebp.startsWith('data:image/webp')) {
      return fallbackWebp;
    }
    return canvas.toDataURL('image/jpeg', 0.72);
  };

  const renderCoverCanvas = (
    img: HTMLImageElement,
    width = 400,
    height = 300,
    opts?: {
      brightness?: number;
      contrast?: number;
      saturate?: number;
      warmth?: number;
      accentHex?: string;
      badgeText?: string;
      bottomCaption?: string;
    }
  ): string => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const scale = Math.max(width / img.width, height / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const offsetX = (width - drawW) / 2;
    const offsetY = (height - drawH) / 2;

    if (opts && (opts.brightness || opts.contrast || opts.saturate)) {
      ctx.filter = `brightness(${opts.brightness ?? 1}) contrast(${opts.contrast ?? 1}) saturate(${opts.saturate ?? 1})`;
    }
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    ctx.filter = 'none';

    if (opts?.warmth && opts.warmth !== 0) {
      ctx.fillStyle =
        opts.warmth > 0
          ? `rgba(245, 158, 11, ${Math.min(0.22, opts.warmth * 0.28)})`
          : `rgba(16, 185, 129, ${Math.min(0.2, Math.abs(opts.warmth) * 0.25)})`;
      ctx.fillRect(0, 0, width, height);
    }

    // Subtle studio vignette
    const grad = ctx.createRadialGradient(width / 2, height / 2, width * 0.25, width / 2, height / 2, width * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    if (opts?.badgeText && opts.badgeText.trim()) {
      const text = opts.badgeText.trim().slice(0, 26);
      ctx.font = 'bold 13px Tahoma, sans-serif';
      const metrics = ctx.measureText(text);
      const pillW = Math.min(width - 28, metrics.width + 24);
      const pillH = 26;
      const rx = width - pillW - 12;
      const ry = 12;

      ctx.fillStyle = opts.accentHex || '#059669';
      ctx.beginPath();
      ctx.roundRect(rx, ry, pillW, pillH, 13);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, rx + pillW / 2, ry + pillH / 2 + 1);
    }

    if (opts?.bottomCaption && opts.bottomCaption.trim()) {
      const cap = opts.bottomCaption.trim().slice(0, 38);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(0, height - 34, width, 34);
      ctx.font = 'bold 12px Tahoma, sans-serif';
      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cap, width / 2, height - 16);
    }

    return compressCanvasToProductDataUrl(canvas);
  };

  // Handle manager uploading a custom photo for a product
  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiImageError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const img = await loadHtmlImage(String(reader.result));
        const compressed = renderCoverCanvas(img, 400, 300);
        if (compressed) {
          setModalProdImageUrl(compressed);
          showSuccessToast('تصویر محصول با کیفیت بهینه بارگذاری شد. برای ثبت نهایی ذخیره را بزنید.');
        }
      } catch {
        setAiImageError('فرمت فایل انتخابی قابل پردازش نبود.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // AI Studio Enhance on current product photo (uses free/standard /api/ai/product-visual)
  const handleAiEnhanceProductImage = async () => {
    if (!editingProductId) return;
    setIsProcessingAiImage(true);
    setAiImageError(null);
    try {
      const currentSrc =
        modalProdImageUrl.trim() ||
        getProductImageSrc({
          id: editingProductId,
          category: modalProdCategory,
          imageUrl: '',
        });
      const img = await loadHtmlImage(currentSrc);

      // Extract lightweight base64 snapshot for Gemini analysis
      const prepCanvas = document.createElement('canvas');
      prepCanvas.width = 480;
      prepCanvas.height = 360;
      const pCtx = prepCanvas.getContext('2d');
      let base64 = '';
      if (pCtx) {
        const scale = Math.max(480 / img.width, 360 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        pCtx.drawImage(img, (480 - w) / 2, (360 - h) / 2, w, h);
        base64 = prepCanvas.toDataURL('image/jpeg', 0.8).split(',')[1] || '';
      }

      const resp = await fetch(resolveApiUrl('/api/ai/product-visual'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'enhance',
          productName: modalProdName || 'محصول تخصصی کارگاه',
          categoryLabel: modalProdCategoryLabel,
          tagline: modalProdTagline,
          prompt: aiImagePrompt.trim(),
          imageBase64: base64,
          imageMimeType: 'image/jpeg',
        }),
      });
      const parsed = await parseJsonResponseSafe<any>(resp, 'خطا در ویرایش هوشمند تصویر');
      const data = parsed.data;
      if (!parsed.ok || !data) {
        throw new Error(parsed.errorMessage || data?.error || 'خطا در ویرایش هوشمند تصویر');
      }

      const editedDataUrl = renderCoverCanvas(img, 400, 300, {
        brightness: data.brightness,
        contrast: data.contrast,
        saturate: data.saturate,
        warmth: data.warmth,
        accentHex: data.accentHex,
        badgeText: data.badgeText,
        bottomCaption: data.bottomCaption,
      });

      if (editedDataUrl) {
        setModalProdImageUrl(editedDataUrl);
        showSuccessToast('ویرایش و نورپردازی هوشمند تصویر انجام شد ✓');
      }
    } catch (err) {
      setAiImageError(err instanceof Error ? err.message : 'خطا در ارتباط با هوش مصنوعی');
    } finally {
      setIsProcessingAiImage(false);
    }
  };

  // AI Generate fresh bespoke product packaging visual from prompt & metadata
  const handleAiGenerateProductImage = async () => {
    if (!editingProductId) return;
    setIsProcessingAiImage(true);
    setAiImageError(null);
    try {
      const resp = await fetch(resolveApiUrl('/api/ai/product-visual'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'generate_svg',
          productName: modalProdName || 'کود ارگانیک صفری',
          categoryLabel: modalProdCategoryLabel,
          tagline: modalProdTagline,
          prompt: aiImagePrompt.trim(),
        }),
      });
      const parsed = await parseJsonResponseSafe<{ svg?: string; error?: string }>(
        resp,
        'خطا در طراحی تصویر توسط هوش مصنوعی'
      );
      const data = parsed.data;
      if (!parsed.ok || !data?.svg) {
        throw new Error(parsed.errorMessage || data?.error || 'خطا در طراحی تصویر توسط هوش مصنوعی');
      }

      const svgBlob = new Blob([data.svg], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(svgBlob);
      try {
        const img = await loadHtmlImage(blobUrl);
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 400, 300);
          const generatedDataUrl = compressCanvasToProductDataUrl(canvas);
          setModalProdImageUrl(generatedDataUrl);
          showSuccessToast('تصویر جدید محصول با هوش مصنوعی طراحی و آماده ثبت شد ✓');
        }
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      setAiImageError(err instanceof Error ? err.message : 'خطا در طراحی هوش مصنوعی تصویر');
    } finally {
      setIsProcessingAiImage(false);
    }
  };

  // Update order status handler
  const handleUpdateOrderStatus = async (orderNumber: string) => {
    const res = await updateOrderStatus(orderNumber, editStatus, editAdminNotes, editTracking);
    const reloaded = loadCustomerOrders();
    setOrders(reloaded);
    const updated = reloaded.find((o) => o.orderNumber === orderNumber);
    if (updated) setSelectedOrder(updated);
    if (res.ok) {
      showSuccessToast(`وضعیت سفارش ${orderNumber} با موفقیت در پایگاه داده ابری ثبت و به‌روزرسانی شد ✓`);
    } else {
      showErrorToast('خطا در ثبت وضعیت سفارش: ' + (res.error || 'نامشخص'));
    }
  };

  // Delete order permanently from Cloud Database
  const handleDeleteOrder = async (orderNumber: string) => {
    setIsDeletingOrder(true);
    try {
      const res = await deleteCustomerOrder(orderNumber);
      const reloaded = loadCustomerOrders();
      setOrders(reloaded);
      setConfirmDeleteOrderNumber(null);
      if (selectedOrder?.orderNumber === orderNumber) {
        setSelectedOrder(null);
      }
      if (invoiceToPrint?.orderNumber === orderNumber) {
        setInvoiceToPrint(null);
      }
      if (res.ok) {
        showSuccessToast(`سفارش ${orderNumber} با موفقیت از پایگاه داده حذف گردید ✓`);
      } else {
        showErrorToast('خطا در حذف سفارش: ' + (res.error || 'نامشخص'));
      }
    } finally {
      setIsDeletingOrder(false);
    }
  };

  // Quick toggle stock
  const handleToggleStock = async (prodId: string) => {
    const current = products.find((p) => p.id === prodId);
    if (!current) return;
    const latestOverrides = loadProductOverrides();
    const updatedOverrides = {
      ...latestOverrides,
      [prodId]: {
        ...(latestOverrides[prodId] || {}),
        inStock: !current.inStock,
      },
    };
    setProductOverrides(updatedOverrides);
    const res = await saveProductOverrides(updatedOverrides);
    setPendingSyncFlags(getPendingCloudSyncState());
    if (res.ok) {
      showSuccessToast(`وضعیت موجودی «${current.name}» ذخیره و همگام شد ✓`);
    } else {
      showErrorToast('خطا در تغییر وضعیت موجودی: ' + (res.error || 'نامشخص'));
    }
  };

  // Quick update stock quantity (draft-protected + realtime sync to Telegram Cloud DB)
  const commitStockQuantity = async (prodId: string, qty: number) => {
    const cleanQty = Math.max(0, qty);
    const latestOverrides = loadProductOverrides();
    const updatedOverrides = {
      ...latestOverrides,
      [prodId]: {
        ...(latestOverrides[prodId] || {}),
        stockQuantity: cleanQty,
        inStock: cleanQty > 0,
      },
    };
    setProductOverrides(updatedOverrides);
    const res = await saveProductOverrides(updatedOverrides);
    setPendingSyncFlags(getPendingCloudSyncState());
    setStockDrafts((prev) => {
      const next = { ...prev };
      delete next[prodId];
      return next;
    });
    if (res.ok) {
      showSuccessToast('موجودی انبار ذخیره شد و به‌صورت زنده در کل برنامه منتشر گردید ✓');
    } else {
      showErrorToast('خطا در ذخیره موجودی انبار: ' + (res.error || 'نامشخص'));
    }
  };

  const handleUpdateStockQuantity = (prodId: string, qty: number) => {
    const cleanQty = Math.max(0, qty);
    setStockDrafts((prev) => ({ ...prev, [prodId]: cleanQty }));

    // Immediately update overrides in UI list
    setProductOverrides((prev) => ({
      ...prev,
      [prodId]: {
        ...(prev[prodId] || {}),
        stockQuantity: cleanQty,
        inStock: cleanQty > 0,
      },
    }));

    if (stockDebounceTimersRef.current[prodId]) {
      clearTimeout(stockDebounceTimersRef.current[prodId]);
    }
    stockDebounceTimersRef.current[prodId] = setTimeout(() => {
      commitStockQuantity(prodId, cleanQty);
    }, 350);
  };

  // Handle app logo file upload -> resize/compress cleanly so it fits inside Firestore settings doc
  const resizeBrandingImageFile = (file: File, onDone: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, size, size);
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

        let dataUrl = canvas.toDataURL('image/png');
        if (dataUrl.length > 140000) {
          dataUrl = canvas.toDataURL('image/webp', 0.85);
        }
        onDone(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resizeBrandingImageFile(file, (dataUrl) => {
      handleSettingChange('appLogoDataUrl', dataUrl);
      showSuccessToast('لوگو بارگذاری شد! برای انتشار در کل برنامه و مهر فاکتور «ذخیره تنظیمات» را بزنید.');
    });
    e.target.value = '';
  };

  const handlePwaIconFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resizeBrandingImageFile(file, (dataUrl) => {
      handleSettingChange('pwaAppIconDataUrl', dataUrl);
      showSuccessToast('آیکون اختصاصی نسخه نصب‌شده بارگذاری شد! برای اعمال دکمه «ذخیره تنظیمات» را بزنید.');
    });
    e.target.value = '';
  };

  const handleCustomSealImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resizeBrandingImageFile(file, (dataUrl) => {
      isSettingsDirtyRef.current = true;
      setIsSettingsDirty(true);
      setSettings((prev) => ({
        ...prev,
        invoiceSealImageDataUrl: dataUrl,
        invoiceSealMode: 'custom_image',
        enableInvoiceSeal: true,
        useLogoAsInvoiceSeal: false,
      }));
      showSuccessToast('تصویر مهر اختصاصی بارگذاری شد! برای ثبت در سیستم «ذخیره تنظیمات» را بزنید.');
    });
    e.target.value = '';
  };

  const handleTrustBadgeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resizeBrandingImageFile(file, (dataUrl) => {
      isSettingsDirtyRef.current = true;
      setIsSettingsDirty(true);
      setSettings((prev) => ({
        ...prev,
        trustBadgeImageDataUrl: dataUrl,
        trustBadgeMode: 'custom_image',
      }));
      showSuccessToast('تصویر نشان اعتبار فروشگاه بارگذاری شد! برای ثبت «ذخیره تنظیمات» را بزنید.');
    });
    e.target.value = '';
  };

  const stopAdminVoicePreview = () => {
    if (adminAudioRef.current) {
      try {
        adminAudioRef.current.pause();
        adminAudioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      adminAudioRef.current = null;
    }
    setPlayingVoiceClipId(null);
  };

  const playAdminVoiceClip = async (clipId: string) => {
    if (playingVoiceClipId === clipId) {
      stopAdminVoicePreview();
      return;
    }
    stopAdminVoicePreview();
    const clip = await resolvePreGeneratedVoiceClip(clipId);
    if (!clip) {
      setProductVoiceError('فایل صوتی آماده یافت نشد. ابتدا دکمه «تولید و ذخیره صدا» را بزنید.');
      return;
    }
    const url = base64AudioToBlobUrl(clip.audioBase64, clip.mimeType || 'audio/mpeg');
    const audio = new Audio(url);
    adminAudioRef.current = audio;
    setPlayingVoiceClipId(clipId);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (adminAudioRef.current === audio) {
        adminAudioRef.current = null;
        setPlayingVoiceClipId(null);
      }
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (adminAudioRef.current === audio) {
        adminAudioRef.current = null;
        setPlayingVoiceClipId(null);
      }
    };
    await audio.play();
  };

  const openVoiceDownloadPrompt = (
    items: { clipId: string; fileBaseName: string; label: string; subfolder: string }[],
    title: string,
    inProductModal = false
  ) => {
    setDownloadPathModalNotice(null);
    if (inProductModal) {
      setProductVoiceError(null);
      setProductVoiceMessage(null);
    } else {
      setVoiceStudioErrorMsg(null);
      setVoiceStudioStatusMsg(null);
    }
    if (items.length === 0) {
      const msg = 'هنوز فایل صوتی تولید یا آپلودشده‌ای برای دانلود انتخاب نشده است.';
      if (inProductModal) setProductVoiceError(msg);
      else setVoiceStudioErrorMsg(msg);
      return;
    }
    setPendingDownloadRequest({
      title,
      inProductModal,
      items,
    });
  };

  const executePendingVoiceDownloads = async (
    method: 'directory_handle' | 'pick_directory' | 'browser_downloads'
  ) => {
    if (!pendingDownloadRequest) return;
    const req = pendingDownloadRequest;
    setDownloadPathModalNotice(null);

    try {
      localStorage.setItem('safari_admin_voice_save_path_v1', customDownloadPathInput.trim() || 'صوت-کارگاه-صفری');
    } catch {
      // ignore
    }

    let dirHandle: FileSystemDirectoryHandle | null =
      method === 'directory_handle' ? savedVoiceDirHandle : null;

    if (method === 'pick_directory') {
      if (!supportsDirectoryPicker()) {
        setDownloadPathModalNotice(
          'مرورگر فعلی از انتخاب مستقیم پوشه پشتیبانی نمی‌کند. می‌توانید از گزینه «دانلود در پوشه مرورگر» استفاده کنید.'
        );
        return;
      }
      try {
        const pickerFn = (
          window as unknown as {
            showDirectoryPicker: (opts?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
          }
        ).showDirectoryPicker;
        dirHandle = await pickerFn({ id: 'safari-voice-downloads', mode: 'readwrite' });
        setSavedVoiceDirHandle(dirHandle);
      } catch (err: unknown) {
        const errName = err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : '';
        if (errName === 'AbortError') {
          return;
        }
        setDownloadPathModalNotice(
          'در این محیط پیش‌نمایش یا مرورگر، دسترسی مستقیم به انتخابگر پوشه محدود شده است. برای ذخیره بدون خطا، گزینه «دانلود در پوشه پیش‌فرض مرورگر» را بزنید.'
        );
        return;
      }
    }

    setPendingDownloadRequest(null);
    batchDownloadCancelRef.current = false;
    setIsBatchDownloadingVoice(true);

    let savedCount = 0;
    let missingCount = 0;
    const customLabel = (customDownloadPathInput || '').trim();

    try {
      for (let i = 0; i < req.items.length; i++) {
        if (batchDownloadCancelRef.current) break;
        const item = req.items[i];

        if (req.items.length > 1) {
          setBatchDownloadProgress({
            current: i + 1,
            total: req.items.length,
            label: item.label,
          });
        }

        const clip = await resolvePreGeneratedVoiceClip(item.clipId);
        if (!clip) {
          missingCount += 1;
          continue;
        }

        if (dirHandle) {
          const subfolders: string[] = [];
          if (organizeByCategoryFolders && item.subfolder) {
            subfolders.push(item.subfolder);
          }
          try {
            await writeVoiceClipToDirectoryHandle(dirHandle, clip, item.fileBaseName, subfolders);
          } catch {
            const fallbackPrefix =
              organizeByCategoryFolders && customLabel
                ? `${customLabel}-${item.subfolder}`
                : organizeByCategoryFolders
                ? item.subfolder
                : customLabel || undefined;
            downloadVoiceClipAudio(clip, item.fileBaseName, fallbackPrefix);
          }
          savedCount += 1;
        } else {
          const prefix =
            organizeByCategoryFolders && customLabel
              ? `${customLabel}-${item.subfolder}`
              : organizeByCategoryFolders
              ? item.subfolder
              : customLabel || undefined;
          downloadVoiceClipAudio(clip, item.fileBaseName, prefix);
          savedCount += 1;
          if (i < req.items.length - 1 && !batchDownloadCancelRef.current) {
            await new Promise((r) => setTimeout(r, 420));
          }
        }
      }

      const locationLabel = dirHandle
        ? `پوشه «${dirHandle.name}»`
        : customLabel
        ? `مسیر/برچسب «${customLabel}» در پوشه Downloads`
        : 'پوشه پیش‌فرض Downloads مرورگر';

      const statusText = batchDownloadCancelRef.current
        ? `عملیات پس از ذخیره ${savedCount} فایل در ${locationLabel} متوقف شد.`
        : savedCount === 0
        ? 'هیچ فایل صوتی آماده‌ای برای دانلود یافت نشد.'
        : savedCount === 1
        ? `فایل صوتی «${req.items[0].fileBaseName}» با موفقیت در ${locationLabel} ذخیره شد ✓`
        : `تعداد ${savedCount} فایل صوتی با نام فارسی با موفقیت در ${locationLabel} ذخیره شد ✓${
            missingCount > 0 ? ` (${missingCount} مورد هنوز تولید نشده بود)` : ''
          }`;

      if (savedCount === 0) {
        if (req.inProductModal) setProductVoiceError(statusText);
        else setVoiceStudioErrorMsg(statusText);
      } else {
        if (req.inProductModal) setProductVoiceMessage(statusText);
        else setVoiceStudioStatusMsg(statusText);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'خطا در ذخیره‌سازی فایل‌های صوتی.';
      if (req.inProductModal) setProductVoiceError(errMsg);
      else setVoiceStudioErrorMsg(errMsg);
    } finally {
      setIsBatchDownloadingVoice(false);
      setBatchDownloadProgress(null);
    }
  };

  const handleDownloadVoiceClip = async (
    clipId: string,
    fileBaseName: string,
    inProductModal = false,
    subfolder = 'فایل-صوتی'
  ) => {
    const clip = await resolvePreGeneratedVoiceClip(clipId);
    if (!clip) {
      const msg = 'هنوز فایل صوتی برای دانلود تولید یا آپلود نشده است.';
      if (inProductModal) setProductVoiceError(msg);
      else setVoiceStudioErrorMsg(msg);
      return;
    }
    openVoiceDownloadPrompt(
      [
        {
          clipId,
          fileBaseName,
          label: fileBaseName,
          subfolder,
        },
      ],
      `ذخیره فایل صوتی: ${fileBaseName}`,
      inProductModal
    );
  };

  const readyProductVoices = useMemo(
    () => products.filter((p) => Boolean(readyVoiceClips[buildProductVoiceClipId(p.id)])),
    [products, readyVoiceClips]
  );

  const readySelectedProductVoiceCount = useMemo(
    () => readyProductVoices.filter((p) => selectedProductVoiceIds.includes(p.id)).length,
    [readyProductVoices, selectedProductVoiceIds]
  );

  const toggleProductVoiceSelection = (productId: string) => {
    setSelectedProductVoiceIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleToggleSelectAllProductVoices = () => {
    if (readyProductVoices.length === 0) return;
    if (readySelectedProductVoiceCount === readyProductVoices.length) {
      setSelectedProductVoiceIds([]);
    } else {
      setSelectedProductVoiceIds(readyProductVoices.map((p) => p.id));
    }
  };

  const handleBatchDownloadProductVoices = (mode: 'selected' | 'all') => {
    const targets =
      mode === 'all'
        ? readyProductVoices
        : readyProductVoices.filter((p) => selectedProductVoiceIds.includes(p.id));

    if (targets.length === 0) {
      setVoiceStudioErrorMsg(
        mode === 'all'
          ? 'هنوز هیچ فایل صوتی برای محصولات تولید یا آپلود نشده است.'
          : 'لطفاً ابتدا حداقل یک محصول دارای فایل صوتی را با تیک انتخاب کنید.'
      );
      return;
    }

    openVoiceDownloadPrompt(
      targets.map((prod) => ({
        clipId: buildProductVoiceClipId(prod.id),
        fileBaseName: buildPersianVoiceDownloadName('product', prod.name),
        label: prod.name,
        subfolder: 'معرفی-محصولات',
      })),
      mode === 'all'
        ? `دانلود کلی همه فایل‌های صوتی محصولات (${targets.length} فایل)`
        : `دانلود فایل‌های صوتی انتخاب‌شده محصولات (${targets.length} فایل)`
    );
  };

  const visibleTipsInVoiceStudio = useMemo(
    () =>
      AGRICULTURAL_GOLDEN_TIPS.filter(
        (t) => voiceStudioCategory === 'all' || t.category === voiceStudioCategory
      ),
    [voiceStudioCategory]
  );

  const readyVisibleTipVoices = useMemo(
    () =>
      visibleTipsInVoiceStudio.filter((t) =>
        Boolean(readyVoiceClips[buildTipVoiceClipId(t.id)])
      ),
    [visibleTipsInVoiceStudio, readyVoiceClips]
  );

  const allReadyTipVoices = useMemo(
    () =>
      AGRICULTURAL_GOLDEN_TIPS.filter((t) =>
        Boolean(readyVoiceClips[buildTipVoiceClipId(t.id)])
      ),
    [readyVoiceClips]
  );

  const readySelectedTipVoiceCount = useMemo(
    () => readyVisibleTipVoices.filter((t) => selectedTipVoiceIds.includes(t.id)).length,
    [readyVisibleTipVoices, selectedTipVoiceIds]
  );

  const toggleTipVoiceSelection = (tipId: string) => {
    setSelectedTipVoiceIds((prev) =>
      prev.includes(tipId) ? prev.filter((id) => id !== tipId) : [...prev, tipId]
    );
  };

  const handleToggleSelectAllTipVoices = () => {
    if (readyVisibleTipVoices.length === 0) return;
    const allVisibleSelected = readyVisibleTipVoices.every((t) =>
      selectedTipVoiceIds.includes(t.id)
    );
    if (allVisibleSelected) {
      const visibleIds = new Set(readyVisibleTipVoices.map((t) => t.id));
      setSelectedTipVoiceIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      setSelectedTipVoiceIds((prev) =>
        Array.from(new Set([...prev, ...readyVisibleTipVoices.map((t) => t.id)]))
      );
    }
  };

  const handleBatchDownloadTipVoices = (mode: 'selected' | 'all') => {
    const targets =
      mode === 'all'
        ? readyVisibleTipVoices
        : readyVisibleTipVoices.filter((t) => selectedTipVoiceIds.includes(t.id));

    if (targets.length === 0) {
      setVoiceStudioErrorMsg(
        mode === 'all'
          ? 'هنوز هیچ فایل صوتی برای نکات طلایی این دسته تولید یا آپلود نشده است.'
          : 'لطفاً ابتدا حداقل یک نکته طلایی دارای فایل صوتی را با تیک انتخاب کنید.'
      );
      return;
    }

    openVoiceDownloadPrompt(
      targets.map((tip) => ({
        clipId: buildTipVoiceClipId(tip.id),
        fileBaseName: buildPersianVoiceDownloadName('tip', tip.title),
        label: tip.title,
        subfolder: 'نکات-طلایی',
      })),
      mode === 'all'
        ? `دانلود کلی همه فایل‌های صوتی نکات طلایی (${targets.length} فایل)`
        : `دانلود فایل‌های صوتی انتخاب‌شده نکات طلایی (${targets.length} فایل)`
    );
  };

  const handleBatchDownloadAllVoiceArchive = () => {
    const items: { clipId: string; fileBaseName: string; label: string; subfolder: string }[] = [
      ...readyProductVoices.map((prod) => ({
        clipId: buildProductVoiceClipId(prod.id),
        fileBaseName: buildPersianVoiceDownloadName('product', prod.name),
        label: prod.name,
        subfolder: 'معرفی-محصولات',
      })),
      ...allReadyTipVoices.map((tip) => ({
        clipId: buildTipVoiceClipId(tip.id),
        fileBaseName: buildPersianVoiceDownloadName('tip', tip.title),
        label: tip.title,
        subfolder: 'نکات-طلایی',
      })),
    ];

    const weatherCid = buildWeatherVoiceClipId('general');
    if (readyVoiceClips[weatherCid]) {
      items.push({
        clipId: weatherCid,
        fileBaseName: buildPersianVoiceDownloadName('weather', 'گزارش-هواشناسی-کشاورزی'),
        label: 'گزارش هواشناسی کشاورزی',
        subfolder: 'هواشناسی',
      });
    }

    if (items.length === 0) {
      setVoiceStudioErrorMsg('هنوز هیچ فایل صوتی تولید یا آپلودشده‌ای برای دانلود کلی موجود نیست.');
      return;
    }

    openVoiceDownloadPrompt(
      items,
      `دانلود یکجای کل آرشیو صوتی کارگاه (${items.length} فایل: محصولات، نکات طلایی و هواشناسی)`
    );
  };

  const handleUploadCustomVoiceClip = (params: {
    file: File;
    clipId: string;
    kind: 'product' | 'tip' | 'weather';
    targetId: string;
    scriptText: string;
    label: string;
  }) => {
    const { file, clipId, kind, targetId, scriptText, label } = params;
    setVoiceStudioErrorMsg(null);
    setVoiceStudioStatusMsg(null);

    if (file.size > 640 * 1024) {
      setVoiceStudioErrorMsg(`حجم فایل «${file.name}» بیش از ۶۴۰ کیلوبایت است. لطفاً فایل صوتی فشرده‌تر (مثلاً MP3 48-64kbps) انتخاب کنید.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const resultStr = String(reader.result || '');
        const commaIdx = resultStr.indexOf(',');
        const rawBase64 = commaIdx >= 0 ? resultStr.slice(commaIdx + 1) : resultStr;
        const mime = file.type || 'audio/mpeg';
        const clip = await saveUploadedVoiceClip({
          clipId,
          kind,
          targetId,
          scriptText,
          audioBase64: rawBase64,
          mimeType: mime,
        });

        if (kind === 'product') {
          const latestOverrides = loadProductOverrides();
          const updatedOverrides = {
            ...latestOverrides,
            [targetId]: {
              ...(latestOverrides[targetId] || {}),
              voiceIntroText: scriptText,
              voiceUpdatedAt: clip.updatedAt,
            },
          };
          setProductOverrides(updatedOverrides);
          await saveProductOverrides(updatedOverrides);
        }

        const updatedIdx = await fetchReadyVoiceClipIndex();
        setReadyVoiceClips(updatedIdx);
        setVoiceStudioStatusMsg(`فایل صوتی «${label}» با موفقیت از سیستم بارگذاری و ذخیره شد ✓`);
      } catch (err) {
        setVoiceStudioErrorMsg(err instanceof Error ? err.message : 'خطا در بارگذاری فایل صوتی');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateWeatherVoice = async () => {
    setIsGeneratingWeatherVoice(true);
    setVoiceStudioErrorMsg(null);
    setVoiceStudioStatusMsg(null);
    try {
      const clipId = buildWeatherVoiceClipId('general');
      const clip = await generateAndPersistVoiceClip({
        clipId,
        kind: 'weather',
        targetId: 'general',
        productName: 'گزارش صوتی هواشناسی کشاورزی',
        categoryLabel: 'هواشناسی و سمپاشی',
        customScriptText: weatherVoiceScript.trim(),
      });
      setWeatherVoiceScript(clip.scriptText);
      const updatedIdx = await fetchReadyVoiceClipIndex();
      setReadyVoiceClips(updatedIdx);
      setVoiceStudioStatusMsg('فایل صوتی گزارش هواشناسی تولید و در پایگاه داده ابری ذخیره شد ✓');
    } catch (err) {
      setVoiceStudioErrorMsg(err instanceof Error ? err.message : 'خطا در تولید صوت گزارش هواشناسی');
    } finally {
      setIsGeneratingWeatherVoice(false);
    }
  };

  const handleSuggestProductVoiceScript = async () => {
    if (!modalProdName.trim()) {
      setProductVoiceError('ابتدا نام محصول را وارد کنید.');
      return;
    }
    setIsGeneratingProductScript(true);
    setProductVoiceError(null);
    try {
      const resp = await fetch(resolveApiUrl('/api/ai/product-voice'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: editingProductId,
          productName: modalProdName.trim(),
          categoryLabel: modalProdCategoryLabel,
          tagline: modalProdTagline,
          description: modalProdDescription,
          highlights: modalHighlights.filter((h) => h.trim()),
          specs: modalSpecs.filter((s) => s.label.trim() && s.value.trim()),
          priceSummary: modalPackaging
            .filter((p) => !p.isOutOfStock)
            .slice(0, 3)
            .map((p) => `${p.weightOrVolume} برابر ${p.priceToman.toLocaleString('fa-IR')} تومان`)
            .join('، '),
          mode: 'script_only',
        }),
      });
      const parsed = await parseJsonResponseSafe<{ scriptText?: string; error?: string }>(
        resp,
        'خطا در پیشنهاد متن معرفی'
      );
      if (parsed.ok && parsed.data?.scriptText) {
        setModalProdVoiceText(parsed.data.scriptText);
        setProductVoiceMessage('متن معرفی اختصاصی این محصول با هوش مصنوعی تنظیم شد. می‌توانید ویرایش و سپس صدا را تولید کنید.');
      } else {
        const localScript = buildProductSpecificVoiceScript({
          ...(editingProduct as StoreProduct),
          name: modalProdName.trim(),
          category: modalProdCategory,
          categoryLabel: modalProdCategoryLabel,
          tagline: modalProdTagline,
          description: modalProdDescription,
          highlights: modalHighlights.filter((h) => h.trim()),
          specs: modalSpecs.filter((s) => s.label.trim() && s.value.trim()),
          packagingOptions: modalPackaging,
        });
        setModalProdVoiceText(localScript);
        setProductVoiceMessage('متن معرفی اختصاصی محصول بر اساس مشخصات فنی آماده شد. می‌توانید آن را ویرایش و سپس صدا را تولید کنید.');
      }
    } catch (err) {
      setProductVoiceError(err instanceof Error ? err.message : 'خطا در تولید متن پیشنهادی');
    } finally {
      setIsGeneratingProductScript(false);
    }
  };

  const handleGenerateAndSaveProductVoice = async () => {
    if (!editingProductId) return;
    if (!modalProdName.trim()) {
      setProductVoiceError('لطفاً نام محصول را وارد کنید.');
      return;
    }
    setIsGeneratingProductVoice(true);
    setProductVoiceError(null);
    setProductVoiceMessage(null);
    try {
      const scriptToSpeak =
        modalProdVoiceText.trim() ||
        buildProductSpecificVoiceScript({
          ...(editingProduct as StoreProduct),
          name: modalProdName.trim(),
          category: modalProdCategory,
          categoryLabel: modalProdCategoryLabel,
          tagline: modalProdTagline,
          description: modalProdDescription,
          highlights: modalHighlights.filter((h) => h.trim()),
          specs: modalSpecs.filter((s) => s.label.trim() && s.value.trim()),
          packagingOptions: modalPackaging,
        });
      const clipId = buildProductVoiceClipId(editingProductId);
      const clip = await generateAndPersistVoiceClip({
        clipId,
        kind: 'product',
        targetId: editingProductId,
        productName: modalProdName.trim(),
        categoryLabel: modalProdCategoryLabel,
        tagline: modalProdTagline,
        description: modalProdDescription,
        highlights: modalHighlights.filter((h) => h.trim()),
        specs: modalSpecs.filter((s) => s.label.trim() && s.value.trim()),
        customScriptText: scriptToSpeak,
      });
      setModalProdVoiceText(clip.scriptText);
      const latestOverrides = loadProductOverrides();
      const updatedOverrides = {
        ...latestOverrides,
        [editingProductId]: {
          ...(latestOverrides[editingProductId] || {}),
          voiceIntroText: clip.scriptText,
          voiceUpdatedAt: clip.updatedAt,
        },
      };
      setProductOverrides(updatedOverrides);
      await saveProductOverrides(updatedOverrides);
      setReadyVoiceClips((prev) => ({
        ...prev,
        [clip.id]: { kind: clip.kind, targetId: clip.targetId, scriptText: clip.scriptText, updatedAt: clip.updatedAt },
      }));
      setProductVoiceMessage('صدا و متن معرفی محصول با موفقیت تولید و برای پخش آنی مشتریان ذخیره شد ✓');
    } catch (err) {
      setProductVoiceError(err instanceof Error ? err.message : 'تولید فایل صوتی ناموفق بود.');
    } finally {
      setIsGeneratingProductVoice(false);
    }
  };

  const handleUploadProductVoiceAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProductId) return;
    setProductVoiceError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const resultStr = String(reader.result || '');
        const commaIdx = resultStr.indexOf(',');
        const rawBase64 = commaIdx >= 0 ? resultStr.slice(commaIdx + 1) : resultStr;
        const mime = file.type || 'audio/mpeg';
        const clipId = buildProductVoiceClipId(editingProductId);
        const scriptToSave = modalProdVoiceText.trim() || `معرفی اختصاصی محصول ${modalProdName.trim()}`;
        const clip = await saveUploadedVoiceClip({
          clipId,
          kind: 'product',
          targetId: editingProductId,
          scriptText: scriptToSave,
          audioBase64: rawBase64,
          mimeType: mime,
        });
        const latestOverrides = loadProductOverrides();
        const updatedOverrides = {
          ...latestOverrides,
          [editingProductId]: {
            ...(latestOverrides[editingProductId] || {}),
            voiceIntroText: scriptToSave,
            voiceUpdatedAt: clip.updatedAt,
          },
        };
        setProductOverrides(updatedOverrides);
        await saveProductOverrides(updatedOverrides);
        setReadyVoiceClips((prev) => ({
          ...prev,
          [clip.id]: { kind: clip.kind, targetId: clip.targetId, scriptText: clip.scriptText, updatedAt: clip.updatedAt },
        }));
        setProductVoiceMessage('فایل صوتی اختصاصی با موفقیت بارگذاری و برای پخش فوری مشتریان ثبت شد ✓');
      } catch (err) {
        setProductVoiceError(err instanceof Error ? err.message : 'خطا در بارگذاری فایل صوتی');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBatchGenerateProductVoices = async (onlyMissing: boolean) => {
    const targets = products.filter((p) => {
      if (!onlyMissing) return true;
      return !readyVoiceClips[buildProductVoiceClipId(p.id)];
    });
    if (targets.length === 0) {
      setVoiceStudioStatusMsg('فایل صوتی تمام محصولات هم‌اکنون آماده و در پایگاه داده تلگرام ذخیره است ✓');
      return;
    }
    batchVoiceCancelRef.current = false;
    setIsBatchGeneratingVoice(true);
    setVoiceStudioErrorMsg(null);
    setVoiceStudioStatusMsg(null);

    let successCount = 0;
    const failedNames: string[] = [];
    let haltedReason: string | null = null;
    const latestOverrides = loadProductOverrides();

    for (let i = 0; i < targets.length; i++) {
      if (batchVoiceCancelRef.current) break;
      const prod = targets[i];
      setBatchVoiceProgress({
        current: i + 1,
        total: targets.length,
        label: `محصول: ${prod.name}`,
      });

      let clip = null;
      let itemFatalStop = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (batchVoiceCancelRef.current) break;
        try {
          const script = buildProductSpecificVoiceScript(prod);
          clip = await generateAndPersistVoiceClip({
            clipId: buildProductVoiceClipId(prod.id),
            kind: 'product',
            targetId: prod.id,
            productName: prod.name,
            categoryLabel: prod.categoryLabel,
            tagline: prod.tagline,
            description: prod.description,
            highlights: prod.highlights,
            specs: prod.specs,
            customScriptText: script,
          });
          break;
        } catch (err: any) {
          const code = String(err?.code || '');
          const errMsg = err instanceof Error ? err.message : 'خطای سرور';
          const isUnrecoverable =
            code === 'API_KEY_INVALID' ||
            code === 'DAILY_QUOTA_EXCEEDED' ||
            /کلید API نامعتبر|سهمیه روزانه کلید رایگان/i.test(errMsg);

          if (isUnrecoverable) {
            haltedReason = `توقف روی «${prod.name}»: ${errMsg}`;
            itemFatalStop = true;
            break;
          }

          if (attempt < 2) {
            const waitSec = Math.min(14, Math.max(4, Number(err?.retryAfterSec || (attempt === 0 ? 5 : 9))));
            setBatchVoiceProgress({
              current: i + 1,
              total: targets.length,
              label: `مکث ${waitSec.toLocaleString('fa-IR')} ثانیه برای محدودیت سرعت سرویس روی «${prod.name}»...`,
            });
            await new Promise((r) => setTimeout(r, waitSec * 1000));
            continue;
          }

          failedNames.push(`${prod.name} (${errMsg})`);
        }
      }

      if (clip) {
        latestOverrides[prod.id] = {
          ...(latestOverrides[prod.id] || {}),
          voiceIntroText: clip.scriptText,
          voiceUpdatedAt: clip.updatedAt,
        };
        successCount++;
        // Update UI & Telegram DB immediately per completed item so progress is never lost
        setReadyVoiceClips((prev) => ({
          ...prev,
          [clip!.id]: {
            kind: clip!.kind,
            targetId: clip!.targetId,
            scriptText: clip!.scriptText,
            updatedAt: clip!.updatedAt,
            source: 'telegram',
          },
        }));
        setProductOverrides({ ...latestOverrides });
        await saveProductOverrides({ ...latestOverrides }).catch(() => null);
      }

      if (itemFatalStop || batchVoiceCancelRef.current) {
        break;
      }

      // Gentle 2.2s spacing between TTS generations to prevent hitting per-minute RPM rate limits
      if (i < targets.length - 1) {
        await new Promise((r) => setTimeout(r, 2200));
      }
    }

    const updatedIdx = await fetchReadyVoiceClipIndex(true);
    setReadyVoiceClips(updatedIdx);
    setIsBatchGeneratingVoice(false);
    setBatchVoiceProgress(null);

    if (haltedReason) {
      setVoiceStudioErrorMsg(haltedReason);
    } else if (failedNames.length > 0) {
      setVoiceStudioErrorMsg(
        `${failedNames.length.toLocaleString('fa-IR')} مورد پس از تلاش مجدد ناموفق بود: ${failedNames.slice(0, 3).join('، ')}`
      );
    }

    setVoiceStudioStatusMsg(
      batchVoiceCancelRef.current
        ? `عملیات متوقف شد (${successCount.toLocaleString('fa-IR')} فایل تولید و در پایگاه داده تلگرام ذخیره گردید).`
        : `${successCount.toLocaleString('fa-IR')} فایل معرفی صوتی محصولات با موفقیت تولید و به صورت آنی در تلگرام و مرورگر ذخیره شدند ✓`
    );
  };

  const handleBatchGenerateTipVoices = async (onlyMissing: boolean) => {
    const filteredTips = AGRICULTURAL_GOLDEN_TIPS.filter(
      (t) => voiceStudioCategory === 'all' || t.category === voiceStudioCategory
    );
    const targets = filteredTips.filter((t) => {
      if (!onlyMissing) return true;
      return !readyVoiceClips[buildTipVoiceClipId(t.id)];
    });
    if (targets.length === 0) {
      setVoiceStudioStatusMsg('صوت تمامی نکات طلایی این بخش هم‌اکنون تولید و ذخیره شده است ✓');
      return;
    }

    batchVoiceCancelRef.current = false;
    setIsBatchGeneratingVoice(true);
    setVoiceStudioErrorMsg(null);
    setVoiceStudioStatusMsg(null);

    let successCount = 0;
    const failedNames: string[] = [];
    let haltedReason: string | null = null;

    for (let i = 0; i < targets.length; i++) {
      if (batchVoiceCancelRef.current) break;
      const tip = targets[i];
      setBatchVoiceProgress({
        current: i + 1,
        total: targets.length,
        label: `نکته طلایی: ${tip.title}`,
      });

      let generatedClip = null;
      let itemFatalStop = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (batchVoiceCancelRef.current) break;
        try {
          generatedClip = await generateAndPersistVoiceClip({
            clipId: buildTipVoiceClipId(tip.id),
            kind: 'tip',
            targetId: tip.id,
            productName: tip.title,
            categoryLabel: tip.categoryLabel,
            description: tip.summary,
            customScriptText: buildTipVoiceScript(tip),
          });
          break;
        } catch (err: any) {
          const code = String(err?.code || '');
          const errMsg = err instanceof Error ? err.message : 'موقتاً شلوغ است';
          const isUnrecoverable =
            code === 'API_KEY_INVALID' ||
            code === 'DAILY_QUOTA_EXCEEDED' ||
            /کلید API نامعتبر|سهمیه روزانه کلید رایگان/i.test(errMsg);

          if (isUnrecoverable) {
            haltedReason = `توقف روی نکته «${tip.title}»: ${errMsg}`;
            itemFatalStop = true;
            break;
          }

          if (attempt < 2) {
            const waitSec = Math.min(14, Math.max(4, Number(err?.retryAfterSec || (attempt === 0 ? 5 : 9))));
            setBatchVoiceProgress({
              current: i + 1,
              total: targets.length,
              label: `مکث ${waitSec.toLocaleString('fa-IR')} ثانیه برای محدودیت سرعت سرویس روی «${tip.title}»...`,
            });
            await new Promise((r) => setTimeout(r, waitSec * 1000));
            continue;
          }

          failedNames.push(`${tip.title} (${errMsg})`);
        }
      }

      if (generatedClip) {
        successCount++;
        setReadyVoiceClips((prev) => ({
          ...prev,
          [generatedClip!.id]: {
            kind: generatedClip!.kind,
            targetId: generatedClip!.targetId,
            scriptText: generatedClip!.scriptText,
            updatedAt: generatedClip!.updatedAt,
            source: 'telegram',
          },
        }));
      }

      if (itemFatalStop || batchVoiceCancelRef.current) {
        break;
      }

      if (i < targets.length - 1) {
        await new Promise((r) => setTimeout(r, 2200));
      }
    }

    const updatedIdx = await fetchReadyVoiceClipIndex(true);
    setReadyVoiceClips(updatedIdx);
    setIsBatchGeneratingVoice(false);
    setBatchVoiceProgress(null);

    if (haltedReason) {
      setVoiceStudioErrorMsg(haltedReason);
    } else if (failedNames.length > 0) {
      setVoiceStudioErrorMsg(
        `${failedNames.length.toLocaleString('fa-IR')} نکته طلایی ناموفق بود: ${failedNames.slice(0, 3).join('، ')}`
      );
    }

    setVoiceStudioStatusMsg(
      batchVoiceCancelRef.current
        ? `تولید دسته‌ای متوقف شد (${successCount.toLocaleString('fa-IR')} نکته طلایی ذخیره شد).`
        : `${successCount.toLocaleString('fa-IR')} فایل صوتی نکات طلایی با موفقیت برای همیشه در پایگاه داده تلگرام ذخیره شدند ✓`
    );
  };

  const handleGenerateSingleProductVoice = async (prod: StoreProduct) => {
    setIsBatchGeneratingVoice(true);
    setBatchVoiceProgress({ current: 1, total: 1, label: prod.name });
    setVoiceStudioErrorMsg(null);
    setVoiceStudioStatusMsg(null);
    try {
      const script = buildProductSpecificVoiceScript(prod);
      const clip = await generateAndPersistVoiceClip({
        clipId: buildProductVoiceClipId(prod.id),
        kind: 'product',
        targetId: prod.id,
        productName: prod.name,
        categoryLabel: prod.categoryLabel,
        tagline: prod.tagline,
        description: prod.description,
        highlights: prod.highlights,
        specs: prod.specs,
        customScriptText: script,
      });
      const latestOverrides = loadProductOverrides();
      const updatedOverrides = {
        ...latestOverrides,
        [prod.id]: {
          ...(latestOverrides[prod.id] || {}),
          voiceIntroText: clip.scriptText,
          voiceUpdatedAt: clip.updatedAt,
        },
      };
      setProductOverrides(updatedOverrides);
      await saveProductOverrides(updatedOverrides);
      const updatedIdx = await fetchReadyVoiceClipIndex();
      setReadyVoiceClips(updatedIdx);
      setVoiceStudioStatusMsg(`صدای محصول «${prod.name}» با موفقیت تولید و ذخیره شد ✓`);
    } catch (err) {
      setVoiceStudioErrorMsg(err instanceof Error ? err.message : 'خطا در تولید صدای محصول');
    } finally {
      setIsBatchGeneratingVoice(false);
      setBatchVoiceProgress(null);
    }
  };

  const handleGenerateSingleTipVoice = async (tip: GoldenTipItem) => {
    setIsBatchGeneratingVoice(true);
    setBatchVoiceProgress({ current: 1, total: 1, label: tip.title });
    setVoiceStudioErrorMsg(null);
    try {
      await generateAndPersistVoiceClip({
        clipId: buildTipVoiceClipId(tip.id),
        kind: 'tip',
        targetId: tip.id,
        productName: tip.title,
        categoryLabel: tip.categoryLabel,
        description: tip.summary,
        customScriptText: buildTipVoiceScript(tip),
      });
      const updatedIdx = await fetchReadyVoiceClipIndex();
      setReadyVoiceClips(updatedIdx);
      setVoiceStudioStatusMsg(`صدای نکته «${tip.title}» تولید و در پایگاه داده ابری ذخیره شد ✓`);
    } catch (err) {
      setVoiceStudioErrorMsg(err instanceof Error ? err.message : 'خطا در تولید صدای نکته');
    } finally {
      setIsBatchGeneratingVoice(false);
      setBatchVoiceProgress(null);
    }
  };

  // Save Store Settings to Telegram Cloud DB & sync GitHub Pages live feed
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    isSavingSettingsRef.current = true;

    const resolvedSealMode = settings.invoiceSealMode || 'text_stamp';
    const payload: Partial<WorkshopStoreSettings> = {
      workshopName: settings.workshopName,
      appTagline: settings.appTagline || '',
      appLogoDataUrl: settings.appLogoDataUrl || '',
      pwaAppName: (settings.pwaAppName || '').trim().slice(0, 60),
      pwaAppIconDataUrl: settings.pwaAppIconDataUrl || '',
      useLogoAsInvoiceSeal: resolvedSealMode === 'logo',
      enableInvoiceSeal: settings.enableInvoiceSeal ?? true,
      invoiceSealMode: resolvedSealMode,
      invoiceSealImageDataUrl: settings.invoiceSealImageDataUrl || '',
      invoiceSealTitle: (settings.invoiceSealTitle || settings.workshopName || '').trim().slice(0, 80),
      invoiceSealSubtitle: (settings.invoiceSealSubtitle || 'مهر معتبر تایید فروش و بارگیری').trim().slice(0, 80),
      invoiceSealCode: (settings.invoiceSealCode || '').trim().slice(0, 50),
      invoiceSealColor: settings.invoiceSealColor || '#065f46',
      trustBadgeMode: settings.trustBadgeMode || 'app_logo',
      trustBadgeImageDataUrl: settings.trustBadgeImageDataUrl || '',
      trustBadgeTitle: (settings.trustBadgeTitle || 'نشان اعتبار و اصالت فروشگاه').trim().slice(0, 120),
      managerFullName: settings.managerFullName || '',
      managerTitle: settings.managerTitle || '',
      managerPhone: settings.managerPhone || '',
      managerEmail: settings.managerEmail || '',
      managerLicenseCode: settings.managerLicenseCode || '',
      managerProvince: adminWeatherLocation.province,
      managerCity: adminWeatherLocation.city,
      managerProvinceCity: `${adminWeatherLocation.province} / ${adminWeatherLocation.city}`,
      managerAddress: settings.managerAddress || '',
      managerBioNote: settings.managerBioNote || '',
      supportPhone: settings.supportPhone,
      salesAdvisorName: (settings.salesAdvisorName || 'مهندس اصغری').trim().slice(0, 80),
      agronomistName: settings.agronomistName,
      agronomistPhone: settings.agronomistPhone,
      agronomistTitle: settings.agronomistTitle,
      workshopAddress: settings.workshopAddress || '',
      workingHours: settings.workingHours || '',
      minOrderNotice: settings.minOrderNotice,
      storeHeroBadgeText: (settings.storeHeroBadgeText || 'تولید استاندارد ISIRI · ارسال مستقیم از کارگاه').trim().slice(0, 200),
      paymentCardNumber: normalizeDigits(settings.paymentCardNumber || '').trim().slice(0, 32),
      paymentIban: normalizeDigits(settings.paymentIban || '').toUpperCase().trim().slice(0, 36),
      paymentCardHolder: (settings.paymentCardHolder || '').trim().slice(0, 80),
      paymentBankName: (settings.paymentBankName || '').trim().slice(0, 60),
      paymentTermsNotice: settings.paymentTermsNotice || '',
      invoiceFooterNote: settings.invoiceFooterNote || '',
      shippingSmallFee: Number(settings.shippingSmallFee ?? 180000),
      shippingMediumBaseFee: Number(settings.shippingMediumBaseFee ?? 450000),
      shippingTonFee: Number(settings.shippingTonFee ?? 1500000),
      freeShippingThresholdToman: Number(settings.freeShippingThresholdToman ?? 0),
      enableCalculator: settings.enableCalculator ?? true,
      showStockCountToCustomers: settings.showStockCountToCustomers ?? true,
      autoRealtimeSync: settings.autoRealtimeSync,
      coreAppVersion: (settings.coreAppVersion || CORE_APP_VERSION).trim().slice(0, 40),
      coreUpdateSummary: (settings.coreUpdateSummary || '').trim().slice(0, 300),
      githubPagesEnabled: Boolean(settings.githubPagesEnabled),
      githubOwner: (settings.githubOwner || '').trim(),
      githubRepo: (settings.githubRepo || '').trim(),
      githubBranch: (settings.githubBranch || 'main').trim() || 'main',
      githubCustomDomain: (settings.githubCustomDomain || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, ''),
      githubApiBaseUrl: normalizeBaseUrl(settings.githubApiBaseUrl),
      telegramWebAppUrl: normalizeBaseUrl(settings.telegramWebAppUrl),
    };

    if (newAdminUser.trim()) {
      payload.adminUsername = newAdminUser.trim();
    }
    if (newAdminPass.trim()) {
      payload.adminPassword = newAdminPass.trim();
    }

    const res = await saveStoreSettings(payload);
    setSettings(res.settings);

    // Sync workshop name & manager profile into signatories and admin UserAccount in Firestore
    setSignatories((prev) => ({
      ...prev,
      workshopName: res.settings.workshopName || prev.workshopName,
      technicalManager: res.settings.managerFullName || prev.technicalManager,
      technicalTitle: res.settings.managerTitle || prev.technicalTitle,
    }));

    const resolvedSavedLoc = resolveManagerProvinceCity(res.settings, existingAdminLocationFallback());
    function existingAdminLocationFallback() {
      return currentUser?.role === 'admin' ? currentUser : null;
    }

    const existingAdmin =
      registeredUsers.find((u) => u.role === 'admin') ||
      (currentUser?.role === 'admin' ? currentUser : null);
    if (existingAdmin) {
      await saveUserAccount({
        ...existingAdmin,
        username: res.settings.adminUsername || existingAdmin.username,
        password: res.settings.adminPassword || existingAdmin.password,
        fullName: res.settings.managerFullName || existingAdmin.fullName,
        phoneNumber: res.settings.managerPhone
          ? normalizeDigits(res.settings.managerPhone) || existingAdmin.phoneNumber
          : existingAdmin.phoneNumber,
        province: resolvedSavedLoc.province || existingAdmin.province,
        city: resolvedSavedLoc.city || existingAdmin.city,
        address: res.settings.managerAddress || res.settings.workshopAddress || existingAdmin.address,
      });
    }

    setNewAdminPass('');
    setNewAdminUser('');
    setIsSettingsDirty(false);
    isSettingsDirtyRef.current = false;
    setIsSavingSettings(false);
    isSavingSettingsRef.current = false;
    setPendingSyncFlags(getPendingCloudSyncState());

    if (res.ok) {
      showSuccessToast('تنظیمات و اطلاعات واریز بانکی به‌صورت زنده در کل برنامه، ربات و مینی‌اپ تلگرام منتشر شد ✓');
    } else {
      showErrorToast('خطا در ذخیره تنظیمات: ' + (res.error || 'نامشخص'));
    }
  };

  const resolvedBackendApiUrl =
    normalizeBaseUrl(settings.githubApiBaseUrl) ||
    normalizeBaseUrl(githubServerStatus?.defaultApiBaseUrl) ||
    (typeof window !== 'undefined' && window.location.origin.startsWith('https://') && !window.location.hostname.endsWith('.github.io')
      ? normalizeBaseUrl(window.location.origin)
      : '');

  const computedGithubPagesUrl = buildGithubPagesUrl({
    owner: settings.githubOwner || githubServerStatus?.envOwner,
    repo: settings.githubRepo || githubServerStatus?.envRepo,
    customDomain: settings.githubCustomDomain,
  });

  const computedGithubPagesConnectedUrl = buildGithubPagesUrl({
    owner: settings.githubOwner || githubServerStatus?.envOwner,
    repo: settings.githubRepo || githubServerStatus?.envRepo,
    customDomain: settings.githubCustomDomain,
    apiBaseUrl: resolvedBackendApiUrl,
    includeApiQuery: Boolean(resolvedBackendApiUrl),
  });

  const handleCopyGithubText = (key: string, value: string) => {
    if (!value) return;
    try {
      navigator.clipboard.writeText(value);
      setCopiedGithubKey(key);
      setTimeout(() => setCopiedGithubKey(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCheckGithubPages = async () => {
    setGithubErrorMsg(null);
    setGithubFeedbackMsg(null);
    setIsCheckingGithub(true);
    try {
      const resp = await fetch(resolveApiUrl('/api/github/check'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: (settings.githubOwner || githubServerStatus?.envOwner || '').trim(),
          repo: (settings.githubRepo || githubServerStatus?.envRepo || '').trim(),
          branch: (settings.githubBranch || 'main').trim() || 'main',
          customDomain: (settings.githubCustomDomain || '').trim(),
          apiBaseUrl: resolvedBackendApiUrl,
        }),
      });
      const parsed = await parseJsonResponseSafe<any>(resp, 'خطا در بررسی مخزن گیت‌هاب');
      if (!parsed.ok || !parsed.data?.ok) {
        setGithubCheckResult(null);
        setGithubErrorMsg(parsed.data?.error || parsed.errorMessage || 'بررسی وضعیت گیت‌هاب ناموفق بود.');
        return;
      }
      setGithubCheckResult(parsed.data);
      setGithubFeedbackMsg(
        parsed.data.liveSiteReachable
          ? `مخزن ${parsed.data.repoFullName} و سایت GitHub Pages آنلاین و قابل دسترس است ✓`
          : `مخزن ${parsed.data.repoFullName} متصل است؛ وضعیت انتشار GitHub Pages بررسی شد.`
      );
    } catch (err: any) {
      setGithubErrorMsg(err?.message || 'خطا در ارتباط با سرور گیت‌هاب');
    } finally {
      setIsCheckingGithub(false);
    }
  };

  const handleTriggerGithubDeploy = async () => {
    setGithubErrorMsg(null);
    setGithubFeedbackMsg(null);
    setIsDeployingGithub(true);
    try {
      const resp = await fetch(resolveApiUrl('/api/github/deploy'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: (settings.githubOwner || githubServerStatus?.envOwner || '').trim(),
          repo: (settings.githubRepo || githubServerStatus?.envRepo || '').trim(),
          branch: (settings.githubBranch || 'main').trim() || 'main',
          customDomain: (settings.githubCustomDomain || '').trim(),
          apiBaseUrl: resolvedBackendApiUrl,
        }),
      });
      const parsed = await parseJsonResponseSafe<any>(resp, 'خطا در ارسال فرمان ساخت GitHub Pages');
      if (parsed.ok && parsed.data?.ok) {
        setGithubFeedbackMsg(parsed.data.message || 'فرمان انتشار با موفقیت به GitHub Actions ارسال شد ✓');
      } else {
        setGithubErrorMsg(parsed.data?.message || parsed.data?.error || parsed.errorMessage || 'ارسال فرمان انتشار انجام نشد.');
      }
    } catch (err: any) {
      setGithubErrorMsg(err?.message || 'خطا در ارتباط با سرور');
    } finally {
      setIsDeployingGithub(false);
    }
  };

  const handleDirectPublishGithubPages = async () => {
    setGithubErrorMsg(null);
    setGithubFeedbackMsg(null);
    setIsDeployingGithub(true);
    try {
      const resp = await fetch(resolveApiUrl('/api/github/publish-direct'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: (settings.githubOwner || githubServerStatus?.envOwner || '').trim(),
          repo: (settings.githubRepo || githubServerStatus?.envRepo || '').trim(),
          customDomain: (settings.githubCustomDomain || '').trim(),
          apiBaseUrl: resolvedBackendApiUrl,
        }),
      });
      const parsed = await parseJsonResponseSafe<any>(resp, 'خطا در ساخت و انتشار مستقیم GitHub Pages');
      if (parsed.ok && parsed.data?.ok) {
        setGithubFeedbackMsg(parsed.data.message || 'سایت با موفقیت روی شاخه gh-pages منتشر و فعال شد ✓');
        void handleCheckGithubPages();
      } else {
        setGithubErrorMsg(parsed.data?.error || parsed.errorMessage || 'انتشار مستقیم انجام نشد.');
      }
    } catch (err: any) {
      setGithubErrorMsg(err?.message || 'خطا در ارتباط با سرور');
    } finally {
      setIsDeployingGithub(false);
    }
  };

  const handleSyncGithubLiveDbNow = async () => {
    setGithubErrorMsg(null);
    setGithubFeedbackMsg(null);
    setIsSyncingGithubLiveDb(true);
    try {
      const resp = await fetch(resolveApiUrl('/api/github/sync-live-db'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: (settings.githubOwner || githubServerStatus?.envOwner || '').trim(),
          repo: (settings.githubRepo || githubServerStatus?.envRepo || '').trim(),
          customDomain: (settings.githubCustomDomain || '').trim(),
        }),
      });
      const parsed = await parseJsonResponseSafe<any>(resp, 'خطا در همگام‌سازی پایگاه داده سایت گیت‌هاب');
      if (parsed.ok && parsed.data?.ok) {
        setGithubServerStatus((prev) => ({
          ...(prev || { hasServerToken: true }),
          liveDbSyncedAt: parsed.data.syncedAt || new Date().toISOString(),
          liveDbError: null,
          liveDbUrl: parsed.data.liveDbUrl || prev?.liveDbUrl || null,
          pagesUrl: parsed.data.pagesUrl || prev?.pagesUrl || null,
        }));
        setGithubFeedbackMsg('قیمت‌ها، کالاها و تنظیمات با فایل زنده GitHub Pages (live-db.json) همگام شد ✓');
      } else {
        setGithubErrorMsg(parsed.data?.error || parsed.errorMessage || 'همگام‌سازی با GitHub Pages انجام نشد.');
      }
    } catch (err: any) {
      setGithubErrorMsg(err?.message || 'خطا در ارتباط با سرور گیت‌هاب');
    } finally {
      setIsSyncingGithubLiveDb(false);
    }
  };

  const handleDownloadGithubWorkflow = async () => {
    try {
      const branch = encodeURIComponent((settings.githubBranch || 'main').trim() || 'main');
      const resp = await fetch(resolveApiUrl(`/api/github/workflow-yaml?branch=${branch}`));
      const data = await resp.json().catch(() => null);
      if (!data?.content) return;
      const blob = new Blob([data.content], { type: 'text/yaml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'deploy-pages.yml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore download errors
    }
  };

  // Local Full App Backup & Restore Handlers (Maintains last 3 backups)
  const handleCreateLocalBackup = () => {
    setBackupErrorMsg(null);
    setBackupStatusMsg(null);
    try {
      const created = createLocalAppBackup(
        {
          config,
          checklist,
          cycles,
          signatories,
          lastUpdated: new Date().toISOString(),
        },
        undefined,
        localBackups
      );
      setLocalBackups(created.backups);
      setBackupStatusMsg(`نسخه پشتیبان کامل تاریخ ${created.backup.createdAtFa} با موفقیت ذخیره شد (حداکثر ۳ نسخه اخیر نگهداری می‌شود) ✓`);
    } catch (err) {
      setBackupErrorMsg(err instanceof Error ? err.message : 'خطا در ایجاد فایل پشتیبان');
    }
  };

  const handleRestoreLocalBackup = (snapshot: FullAppBackupSnapshot) => {
    setIsRestoringBackup(true);
    setBackupErrorMsg(null);
    setBackupStatusMsg(null);
    try {
      const res = restoreFullAppBackup(snapshot);
      if (!res.ok) {
        throw new Error(res.error || 'خطا در بازگردانی نسخه پشتیبان');
      }
      setSettings(res.settings || loadStoreSettings());
      setProductOverrides(loadProductOverrides());
      setOrders(loadCustomerOrders());
      setRegisteredUsers(loadUserAccounts());
      setPendingSyncFlags(getPendingCloudSyncState());
      setIsSettingsDirty(false);
      isSettingsDirtyRef.current = false;

      if (res.workshopState) {
        setConfig(res.workshopState.config);
        setChecklist(res.workshopState.checklist);
        setCycles(res.workshopState.cycles);
        setSignatories(res.workshopState.signatories);
      }

      void listLocalAppBackupsAsync().then((snaps) => {
        if (snaps.length > 0) setLocalBackups(snaps);
      });

      setBackupStatusMsg(`بازگردانی کامل داده‌های نسخه ${snapshot.createdAtFa} بدون خطا انجام شد و در پایگاه داده تلگرام همگام گردید ✓`);
      showSuccessToast('کل اطلاعات برنامه از نسخه پشتیبان بازگردانی شد ✓');
    } catch (err) {
      setBackupErrorMsg(err instanceof Error ? err.message : 'خطا در بازگردانی نسخه پشتیبان');
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleUploadBackupJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBackupErrorMsg(null);
    setBackupStatusMsg(null);
    try {
      const rawText = await (typeof file.text === 'function'
        ? file.text()
        : new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('خواندن فایل انتخاب‌شده امکان‌پذیر نبود.'));
            reader.readAsText(file, 'utf-8');
          }));
      const snap = parseUploadedBackupJson(rawText);
      handleRestoreLocalBackup(snap);
    } catch (err) {
      setBackupErrorMsg(err instanceof Error ? err.message : 'فایل انتخاب‌شده یک بک‌آپ معتبر سیستم صفری نیست.');
    }
  };

  const handleDeleteLocalBackup = (backupId: string) => {
    const remaining = deleteLocalAppBackup(backupId, localBackups);
    setLocalBackups(remaining);
    setBackupStatusMsg('نسخه پشتیبان انتخاب‌شده حذف شد.');
  };

  // Filtered orders
  const filteredOrders = orders.filter(o => {
    const matchStatus = orderFilterStatus === 'all' || o.status === orderFilterStatus;
    const matchSearch = !orderSearch.trim() || 
      o.orderNumber.includes(orderSearch.trim()) ||
      o.customerName.includes(orderSearch.trim()) ||
      o.phoneNumber.includes(orderSearch.trim()) ||
      o.city.includes(orderSearch.trim());
    return matchStatus && matchSearch;
  });

  // Order status badge styling
  const getStatusBadge = (st: OrderStatus) => {
    switch (st) {
      case 'registered':
        return { label: 'در انتظار بررسی', color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300' };
      case 'confirmed':
        return { label: 'تایید و صدور پیش‌فاکتور', color: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300' };
      case 'processing':
        return { label: 'در حال بارگیری', color: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300' };
      case 'shipped':
        return { label: 'ارسال شده (باربری)', color: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300' };
      case 'delivered':
        return { label: 'تحویل مشتری ✓', color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300' };
      case 'cancelled':
        return { label: 'لغو شده', color: 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-300' };
      default:
        return { label: 'نامشخص', color: 'bg-stone-100 text-stone-800 border-stone-300' };
    }
  };

  const pendingOrdersCount = useMemo(
    () => orders.filter((o) => o.status === 'registered').length,
    [orders]
  );
  const activeCatalogCount = useMemo(
    () => products.filter((p) => !p.isDisabled).length,
    [products]
  );

  const adminNavItems: {
    id: typeof adminTab;
    icon: string;
    label: string;
    badge?: string;
  }[] = [
    { id: 'orders', icon: '📦', label: 'مدیریت سفارشات', badge: orders.length.toLocaleString('fa-IR') },
    { id: 'products', icon: '🏷️', label: 'کاتالوگ و قیمت‌ها', badge: activeCatalogCount.toLocaleString('fa-IR') },
    { id: 'inventory', icon: '📊', label: 'کنترل موجودی انبار' },
    { id: 'production', icon: '🏭', label: 'سیستم‌عامل تولید', badge: 'کارگاه' },
    { id: 'settings', icon: '⚙️', label: 'تنظیمات و GitHub Pages' },
    { id: 'telegram', icon: '✈️', label: 'ربات تلگرام و مینی‌اپ' },
  ];

  return (
    <div className="space-y-5 text-right animate-fade-in" dir="rtl">
      
      {/* Executive Top Admin Header */}
      <div className="bg-stone-900 text-white rounded-2xl p-4 sm:p-5 border border-stone-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={resolveAssetOrApiUrl(settings.appLogoDataUrl, 'pwa-192x192.png')}
            alt={settings.workshopName}
            className="w-11 h-11 rounded-xl object-cover border border-emerald-500/40 bg-emerald-950 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-stone-50">پنل مدیریت یکپارچه کارگاه و فروشگاه</h1>
              <span className="text-stone-500 text-xs">·</span>
              <span className="text-xs text-amber-300 font-semibold">
                {settings.managerFullName || 'مهندس صفری / وفایی'}
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5 truncate">
              {settings.workshopName} — مدیریت سفارشات، کاتالوگ، خط تولید، ربات تلگرام و انتشار خودکار گیت‌هاب
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div
            className="px-3 py-1.5 rounded-xl bg-stone-800 border border-stone-700 text-emerald-200 font-mono tabular-nums text-[11px] flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title={`ساعت و تاریخ دستگاه شما: ${deviceClock.weekdayDateStr}`}
          >
            <span>🕒</span>
            <span>{deviceClock.timeWithSecStr}</span>
            <span className="text-stone-400 font-sans hidden xl:inline">· {deviceClock.weekdayDateStr}</span>
          </div>

          <button
            onClick={onPreviewCustomerApp}
            className="whitespace-nowrap shrink-0 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5"
            title="مشاهده نسخه مشتریان"
          >
            <span>📱</span>
            <span>فروشگاه مشتریان</span>
          </button>
        </div>
      </div>

      {/* Executive KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-3.5 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">کل سفارشات ثبت‌شده</div>
            <div className="text-lg font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums mt-0.5">
              {orders.length.toLocaleString('fa-IR')}
            </div>
          </div>
          <span className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-base">📦</span>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-3.5 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">در انتظار تایید مدیریت</div>
            <div className="text-lg font-extrabold text-amber-700 dark:text-amber-400 font-mono tabular-nums mt-0.5">
              {pendingOrdersCount.toLocaleString('fa-IR')}
            </div>
          </div>
          <span className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-base">⏳</span>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-3.5 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">کالاهای فعال کاتالوگ</div>
            <div className="text-lg font-extrabold text-emerald-800 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
              {activeCatalogCount.toLocaleString('fa-IR')}
            </div>
          </div>
          <span className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-base">🏷️</span>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-3.5 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">وضعیت دیتابیس زنده</div>
            <div className={`text-xs font-extrabold mt-1 truncate ${
              syncState.status === 'synced'
                ? 'text-emerald-700 dark:text-emerald-400'
                : syncState.status === 'syncing' || syncState.status === 'connecting'
                ? 'text-sky-700 dark:text-sky-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}>
              {syncState.status === 'synced'
                ? 'متصل · ریل‌تایم تلگرام ✓'
                : syncState.status === 'syncing'
                ? 'در حال ارسال آنی...'
                : syncState.status === 'connecting'
                ? 'در حال اتصال زنده...'
                : 'کش محلی / آفلاین'}
            </div>
          </div>
          <span className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center text-base shrink-0">✈️</span>
        </div>
      </div>

      {/* Global Realtime Sync Toast / Confirmation Banner */}
      {settingsSavedMessage && (
        <div className="p-3 bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-base">✓</span>
            <span>{settingsSavedMessage}</span>
          </div>
          <span className="text-[10px] bg-emerald-800 px-2.5 py-1 rounded-lg font-mono whitespace-nowrap shrink-0">
            همگام با تلگرام و گیت‌هاب ✈️
          </span>
        </div>
      )}

      {settingsErrorMessage && (
        <div className="p-3 bg-rose-700 text-white rounded-2xl text-xs font-bold flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>{settingsErrorMessage}</span>
          </div>
        </div>
      )}

      {/* Mobile / Tablet Horizontal Scrollable Tabs */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 text-xs font-bold border-b border-stone-200 dark:border-stone-800">
        {adminNavItems.map((item) => {
          const isActive = adminTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setAdminTab(item.id)}
              className={`whitespace-nowrap shrink-0 px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 border ${
                isActive
                  ? item.id === 'telegram'
                    ? 'bg-sky-700 border-sky-700 text-white'
                    : 'bg-emerald-800 border-emerald-800 text-white'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                  isActive ? 'bg-white/20 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop Two-Column Executive Workspace: Sticky Right Sidebar + Main Content */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <aside className="hidden lg:block w-64 shrink-0 sticky top-20 space-y-3">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-2.5 border border-stone-200 dark:border-stone-800 space-y-1">
            {adminNavItems.map((item) => {
              const isActive = adminTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAdminTab(item.id)}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-between gap-2 ${
                    isActive
                      ? item.id === 'telegram'
                        ? 'bg-sky-700 text-white'
                        : 'bg-emerald-800 text-white'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/80'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    <span>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {(githubServerStatus?.autoConfigured || settings.githubPagesEnabled) && computedGithubPagesUrl && (
            <div className="bg-white dark:bg-stone-900 rounded-2xl p-3.5 border border-stone-200 dark:border-stone-800 space-y-2 text-[11px]">
              <div className="font-bold text-stone-800 dark:text-stone-200 flex items-center justify-between gap-1">
                <span>🌐 سایت GitHub Pages</span>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">متصل ✓</span>
              </div>
              <p className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-relaxed">
                هر تغییر قیمت و محصول خودکار به نسخه گیت‌هاب ارسال می‌شود.
              </p>
              <a
                href={computedGithubPagesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center py-1.5 px-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 font-bold text-stone-800 dark:text-stone-200 transition-colors"
              >
                باز کردن فروشگاه گیت‌هاب ↗
              </a>
            </div>
          )}
        </aside>

        <div className="flex-1 min-w-0 w-full space-y-5">

      {/* ===================== TAB 1: ORDERS MANAGEMENT ===================== */}
      {adminTab === 'orders' && (
        <div className="space-y-4">
          
          {/* Order Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
              <div className="text-xs text-stone-500">کل سفارشات دریافتی</div>
              <div className="text-xl font-bold font-mono mt-1 text-stone-900 dark:text-stone-100">
                {orders.length}
              </div>
            </div>
            <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-sm">
              <div className="text-xs text-amber-700 dark:text-amber-400">در انتظار بررسی کارگاه</div>
              <div className="text-xl font-bold font-mono mt-1 text-amber-800 dark:text-amber-300">
                {orders.filter(o => o.status === 'registered').length}
              </div>
            </div>
            <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-purple-200 dark:border-purple-800 shadow-sm">
              <div className="text-xs text-purple-700 dark:text-purple-400">در حال بارگیری و حمل</div>
              <div className="text-xl font-bold font-mono mt-1 text-purple-800 dark:text-purple-300">
                {orders.filter(o => o.status === 'processing' || o.status === 'confirmed').length}
              </div>
            </div>
            <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-sm">
              <div className="text-xs text-emerald-700 dark:text-emerald-400">تحویل نهایی گردیده</div>
              <div className="text-xl font-bold font-mono mt-1 text-emerald-800 dark:text-emerald-300">
                {orders.filter(o => o.status === 'delivered').length}
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="جستجو با نام خریدار، شماره همراه، شهر، شماره سفارش..."
                className="px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs w-full md:w-80"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto text-xs font-semibold">
              <span className="text-stone-400 text-[11px] whitespace-nowrap">وضعیت:</span>
              {[
                { id: 'all', label: 'همه' },
                { id: 'registered', label: 'در انتظار' },
                { id: 'confirmed', label: 'تایید پیش‌فاکتور' },
                { id: 'processing', label: 'در حال بارگیری' },
                { id: 'shipped', label: 'ارسال شده' },
                { id: 'delivered', label: 'تحویل شد' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setOrderFilterStatus(st.id)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-xs transition-all ${
                    orderFilterStatus === st.id
                      ? 'bg-emerald-800 text-white font-bold'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-stone-50 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 border-b border-stone-200 dark:border-stone-800">
                  <tr>
                    <th className="p-3.5">عنوان سفارش (تاریخ)</th>
                    <th className="p-3.5">نام خریدار</th>
                    <th className="p-3.5">شماره همراه</th>
                    <th className="p-3.5">مقصد</th>
                    <th className="p-3.5">اقلام سفارش</th>
                    <th className="p-3.5">وزن بار</th>
                    <th className="p-3.5">مبلغ نهایی</th>
                    <th className="p-3.5">وضعیت</th>
                    <th className="p-3.5 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-stone-400">
                        سفارشی یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(order => {
                      const badge = getStatusBadge(order.status);
                      return (
                        <tr key={order.orderNumber} className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors">
                          <td className="p-3.5 font-bold text-stone-800 dark:text-stone-200">
                            <div>سفارش تاریخ {order.orderDate}</div>
                            <div className="text-[10px] text-stone-400 font-mono font-normal mt-0.5">{order.orderNumber}</div>
                          </td>
                          <td className="p-3.5 font-bold text-stone-900 dark:text-stone-100">
                            {order.customerName}
                          </td>
                          <td className="p-3.5 font-mono text-left" dir="ltr">
                            {order.phoneNumber}
                          </td>
                          <td className="p-3.5">
                            {order.city} ({order.province})
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold">{order.items.length} قلم:</span>{' '}
                            {order.items.map(it => `${it.product.name.slice(0, 16)}.. (×${it.quantity})`).join('، ')}
                          </td>
                          <td className="p-3.5 font-mono">
                            {order.totalWeightKg > 1000 
                              ? `${(order.totalWeightKg / 1000).toFixed(2)} تن`
                              : `${order.totalWeightKg} kg`}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                            {order.finalPayableToman.toLocaleString('fa-IR')} ت
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.color}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setEditStatus(order.status);
                                  setEditTracking(order.trackingNumber || '');
                                  setEditAdminNotes(order.adminNotes || '');
                                  setConfirmDeleteOrderNumber(null);
                                }}
                                className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-200"
                              >
                                مدیریت
                              </button>
                              <button
                                onClick={() => setInvoiceToPrint(order)}
                                className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-200 rounded-lg text-xs border border-stone-300"
                                title="چاپ پیش‌فاکتور فروش"
                              >
                                🖨️ فاکتور
                              </button>

                              {confirmDeleteOrderNumber === order.orderNumber ? (
                                <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-lg px-1.5 py-0.5">
                                  <button
                                    onClick={() => handleDeleteOrder(order.orderNumber)}
                                    disabled={isDeletingOrder}
                                    className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold disabled:opacity-60"
                                  >
                                    {isDeletingOrder ? '...' : 'حذف قطعی'}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteOrderNumber(null)}
                                    disabled={isDeletingOrder}
                                    className="px-1.5 py-0.5 text-stone-600 dark:text-stone-300 text-[10px] font-bold hover:underline"
                                  >
                                    لغو
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteOrderNumber(order.orderNumber)}
                                  className="px-2 py-1 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold border border-red-200 dark:border-red-800"
                                  title="حذف سفارش"
                                >
                                  🗑️ حذف
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: PRODUCTS & PRICING ===================== */}
      {adminTab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                کاتالوگ، تصاویر، وضعیت نمایش، بسته‌بندی و آنالیز فنی محصولات
              </h2>
              <p className="text-xs text-stone-500">
                ویرایش تصویر (آپلود یا هوش مصنوعی)، غیرفعال‌سازی موقت یا حذف کالا، و مدیریت کامل نرخ‌ها و آنالیز فنی.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {deletedProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDeletedProducts((v) => !v)}
                  className="px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold border border-stone-300 dark:border-stone-700 flex items-center gap-1.5"
                >
                  <span>♻️</span>
                  <span>کالاهای حذف‌شده ({deletedProducts.length})</span>
                </button>
              )}

              <button
                onClick={handleOpenCreateProduct}
                className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 shrink-0"
              >
                <span>➕</span>
                <span>افزودن محصول جدید به کاتالوگ</span>
              </button>
            </div>
          </div>

          {showDeletedProducts && deletedProducts.length > 0 && (
            <div className="bg-stone-100 dark:bg-stone-900/90 rounded-2xl p-4 border border-stone-300 dark:border-stone-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  ♻️ سطل بازیابی کالاهای حذف‌شده از کاتالوگ
                </h3>
                <button
                  onClick={() => setShowDeletedProducts(false)}
                  className="text-xs text-stone-500 hover:text-stone-800"
                >
                  بستن ✕
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {deletedProducts.map((dp) => (
                  <div
                    key={dp.id}
                    className="bg-white dark:bg-stone-800 rounded-xl p-2.5 border border-stone-200 dark:border-stone-700 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">{dp.name}</div>
                      <div className="text-[10px] text-stone-400">{dp.categoryLabel}</div>
                    </div>
                    <button
                      onClick={() => handleRestoreProduct(dp.id)}
                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-bold shrink-0"
                    >
                      بازگردانی ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(prod => {
              const unitPrice = prod.baseUnitPriceToman || resolveProductBaseUnitPrice(prod);
              const imgSrc = getProductImageSrc(prod);
              return (
                <div
                  key={prod.id}
                  className={`bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border shadow-sm flex flex-col justify-between transition-all ${
                    prod.isDisabled
                      ? 'border-amber-300 dark:border-amber-800 opacity-85'
                      : 'border-stone-200 dark:border-stone-800'
                  }`}
                >
                  <div>
                    {/* Product 4:3 Catalog Image Banner */}
                    <div className="relative w-full aspect-[4/3] bg-stone-100 dark:bg-stone-800 overflow-hidden border-b border-stone-200 dark:border-stone-800">
                      <img
                        src={imgSrc}
                        alt={prod.name}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-cover ${prod.isDisabled ? 'grayscale opacity-75' : ''}`}
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-100 backdrop-blur-xs">
                          {prod.categoryLabel}
                        </span>
                        {prod.isDisabled && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-stone-950 shadow-xs">
                            غیرفعال (مخفی برای مشتری)
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenEditProduct(prod, 'info')}
                        className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-stone-900/75 hover:bg-stone-900 text-white text-[10px] font-bold backdrop-blur-xs flex items-center gap-1 shadow-xs"
                        title="تغییر یا ویرایش هوشمند عکس محصول"
                      >
                        <span>🖼️</span>
                        <span>تغییر / AI عکس</span>
                      </button>
                    </div>

                    <div className="p-4 pb-0">
                      <div className="flex items-center justify-between mb-2 gap-1 flex-wrap">
                        <button
                          onClick={() => handleToggleProductDisabled(prod.id)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                            prod.isDisabled
                              ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-stone-200'
                          }`}
                          title={prod.isDisabled ? 'فعال‌سازی در فروشگاه مشتریان' : 'مخفی کردن از دید مشتریان بدون حذف'}
                        >
                          {prod.isDisabled ? '👁️ فعال‌سازی نمایش' : '🚫 غیرفعال کردن'}
                        </button>
                        <button
                          onClick={() => handleToggleStock(prod.id)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                            prod.inStock
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-red-100 text-red-800 border-red-300'
                          }`}
                        >
                          {prod.inStock ? 'موجود در انبار ✓' : 'اتمام موجودی ✕'}
                        </button>
                      </div>

                      <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                        {prod.name}
                      </h3>
                      <p className="text-[11px] text-stone-500 mt-1 line-clamp-2">
                        {prod.tagline}
                      </p>

                      {unitPrice > 0 && (
                        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800 font-mono">
                          <span>قیمت پایه هر {prod.baseUnitLabel || 'کیلوگرم'}:</span>
                          <span>{unitPrice.toLocaleString('fa-IR')} ت</span>
                        </div>
                      )}

                      {/* Packaging List preview */}
                      <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 space-y-1.5">
                        <div className="text-[10px] font-bold text-stone-400">بسته‌بندی‌ها و نرخ مصوب:</div>
                        {prod.packagingOptions.map(pkg => {
                          const refOrig = pkg.originalPriceToman && pkg.originalPriceToman > pkg.priceToman
                            ? pkg.originalPriceToman
                            : unitPrice > 0 && pkg.nominalWeightKg > 0 && unitPrice * pkg.nominalWeightKg > pkg.priceToman
                            ? Math.round(unitPrice * pkg.nominalWeightKg)
                            : 0;
                          const discPct = pkg.discountPercent || (refOrig > pkg.priceToman ? Math.round(((refOrig - pkg.priceToman) / refOrig) * 1000) / 10 : 0);

                          return (
                            <div key={pkg.id} className="flex justify-between items-center text-xs bg-stone-50 dark:bg-stone-800/60 p-1.5 rounded-lg gap-2">
                              <span className="text-stone-700 dark:text-stone-300 truncate">{pkg.title || pkg.weightOrVolume}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {discPct > 0 && (
                                  <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono">
                                    {discPct}٪ تخفیف
                                  </span>
                                )}
                                <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400">
                                  {pkg.priceToman.toLocaleString('fa-IR')} ت
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Specs quick summary */}
                      <div className="mt-2.5 text-[10px] text-stone-500 flex items-center justify-between">
                        <span>آنالیز فنی: <strong>{prod.specs.length}</strong> شاخص</span>
                        <button
                          onClick={() => handleOpenEditProduct(prod, 'specs')}
                          className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
                        >
                          ویرایش آنالیز فنی
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="m-4 mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-stone-400 font-mono">
                      موجودی: {prod.stockQuantity} {prod.stockUnit}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {confirmDeleteProdId === prod.id ? (
                        <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-xl px-1.5 py-1">
                          <button
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="px-2 py-0.5 bg-red-600 text-white rounded-lg text-[10px] font-bold"
                          >
                            حذف قطعی؟
                          </button>
                          <button
                            onClick={() => setConfirmDeleteProdId(null)}
                            className="px-1.5 py-0.5 text-stone-500 text-[10px] font-bold"
                          >
                            لغو
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteProdId(prod.id)}
                          className="px-2.5 py-1.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-700 dark:text-red-400 rounded-xl text-xs font-bold border border-red-200 dark:border-red-800"
                          title="حذف کالا از کاتالوگ"
                        >
                          🗑️ حذف
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEditProduct(prod, 'info')}
                        className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                      >
                        <span>✏️</span>
                        <span>ویرایش کامل</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== TAB 3: INVENTORY CONTROL ===================== */}
      {adminTab === 'inventory' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200 dark:border-stone-800 shadow-sm">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-1">
              کنترل فیزیکی موجودی انبار کارگاه صفری
            </h2>
            <p className="text-xs text-stone-500 mb-4">
              تمامی تغییرات نام، قیمت و موجودی انبار (تعداد کیسه، تن یا گالن) بلافاصله و به صورت ریل‌تایم در پایگاه داده تلگرام ثبت و در لحظه برای مشتریان وب‌اپ، ربات و مینی‌اپ منتشر می‌گردد.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                  <tr>
                    <th className="p-3">نام فرآورده</th>
                    <th className="p-3">دسته‌بندی</th>
                    <th className="p-3">واحد انبارداری</th>
                    <th className="p-3">تعداد / مقدار موجود</th>
                    <th className="p-3">وضعیت فروش و نمایش</th>
                    <th className="p-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {products.map(prod => (
                    <tr key={prod.id} className={`hover:bg-stone-50 dark:hover:bg-stone-800/40 ${prod.isDisabled ? 'opacity-70' : ''}`}>
                      <td className="p-3 font-bold text-stone-900 dark:text-stone-100">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={getProductImageSrc(prod)}
                            alt={prod.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-8 rounded-lg object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                          />
                          <div>
                            <div>{prod.name}</div>
                            {prod.isDisabled && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                                غیرفعال (مخفی برای مشتری)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                          {prod.categoryLabel}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-stone-600 dark:text-stone-400">
                        {prod.stockUnit || 'کیسه'}
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          value={stockDrafts[prod.id] !== undefined ? stockDrafts[prod.id] : prod.stockQuantity}
                          onChange={(e) => {
                            const cleaned = normalizeDigits(e.target.value).replace(/[^\d]/g, '');
                            handleUpdateStockQuantity(prod.id, cleaned === '' ? 0 : parseInt(cleaned, 10));
                          }}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => {
                            if (stockDebounceTimersRef.current[prod.id]) {
                              clearTimeout(stockDebounceTimersRef.current[prod.id]);
                              delete stockDebounceTimersRef.current[prod.id];
                              const val = stockDrafts[prod.id] !== undefined ? stockDrafts[prod.id] : prod.stockQuantity;
                              commitStockQuantity(prod.id, val);
                            }
                          }}
                          className="w-24 px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono font-bold text-xs text-center"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleToggleStock(prod.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                              prod.inStock
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-red-100 text-red-800 border-red-300'
                            }`}
                          >
                            {prod.inStock ? '✓ موجود' : '✕ ناموجود'}
                          </button>
                          <button
                            onClick={() => handleToggleProductDisabled(prod.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                              prod.isDisabled
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-stone-100 text-stone-700 border-stone-300'
                            }`}
                          >
                            {prod.isDisabled ? 'مخفی در فروشگاه' : 'نمایش عمومی'}
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleOpenEditProduct(prod)}
                          className="text-emerald-800 dark:text-emerald-400 hover:underline font-bold"
                        >
                          ویرایش جزییات
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 4: PRODUCTION & FORMULATION SUITE (Sub-module) ===================== */}
      {adminTab === 'production' && (
        <div className="space-y-4">
          {/* Station Sub-Navigation Pills */}
          <div className="bg-white dark:bg-stone-900 p-2 rounded-2xl border border-stone-200 dark:border-stone-800 flex items-center gap-1.5 overflow-x-auto text-xs font-semibold shadow-xs">
            {[
              { id: 'calculator', label: 'ماشین‌حساب بچ و فرمولاسیون', icon: '🧮' },
              { id: 'masoud', label: `ایستگاه ${signatories.precompostSupervisor.split(' ')[0]} (دپو ۵۵°)`, icon: '🔥' },
              { id: 'mohammad', label: `ایستگاه ${signatories.bedSupervisor.split(' ')[0]} (بستر کرم)`, icon: '🪱' },
              { id: 'certificate', label: 'شناسنامه و آنالیز ISIRI', icon: '📜' },
              { id: 'timeline', label: 'شبیه‌ساز دوره تولید', icon: '⏱️' },
              { id: 'troubleshoot', label: 'عیب‌یابی آفات بستر', icon: '⚠️' },
              { id: 'ai', label: 'دستیار هوش مصنوعی', icon: '🤖' },
              { id: 'science', label: 'دانشنامه بیوشیمی', icon: '📖' },
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setProdStation(st.id as any)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  prodStation === st.id
                    ? 'bg-emerald-800 text-white font-bold shadow-sm'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <span>{st.icon}</span>
                <span>{st.label}</span>
              </button>
            ))}
          </div>

          {/* Active Station View */}
          <div className="mt-2">
            {prodStation === 'calculator' && (
              <BatchCalculator
                config={config}
                setConfig={setConfig}
                formulation={formulation}
                onNavigateToMasoud={() => setProdStation('masoud')}
                onNavigateToMohammad={() => setProdStation('mohammad')}
                onOpenPersonnelModal={onOpenPersonnelModal}
              />
            )}

            {prodStation === 'masoud' && (
              <MasoudStation
                formulation={formulation}
                batchCode={config.batchCode}
                checklist={checklist}
                setChecklist={setChecklist}
                supervisorName={signatories.precompostSupervisor}
                onProceedToMohammad={() => setProdStation('mohammad')}
              />
            )}

            {prodStation === 'mohammad' && (
              <MohammadStation
                formulation={formulation}
                batchCode={config.batchCode}
                isMasoudApproved={checklist.isApproved}
                cycles={cycles}
                setCycles={setCycles}
                supervisorName={signatories.bedSupervisor}
                onNavigateToCertificate={() => setProdStation('certificate')}
                onNavigateToTroubleshoot={() => setProdStation('troubleshoot')}
              />
            )}

            {prodStation === 'certificate' && (
              <LabCertificate
                config={config}
                formulation={formulation}
                signatories={signatories}
                setSignatories={setSignatories}
                onPrint={onPrintCertificate}
              />
            )}

            {prodStation === 'timeline' && (
              <ProcessTimeline formulation={formulation} />
            )}

            {prodStation === 'troubleshoot' && (
              <TroubleshootingGuide />
            )}

            {prodStation === 'ai' && (
              <AiAssistant
                config={config}
                formulation={formulation}
              />
            )}

            {prodStation === 'science' && (
              <ScienceDeepDive />
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB 5: INTEGRATED SETTINGS & TELEGRAM REALTIME DB ===================== */}
      {adminTab === 'settings' && (
        <div className="space-y-4">
          {/* Structured 5 Sub-Tabs Navigation for Settings */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-2 border border-stone-200 dark:border-stone-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs font-bold">
            {[
              { id: 'branding' as const, icon: '🎨', label: 'هویت، لوگو و مهر' },
              { id: 'contacts' as const, icon: '👔', label: 'مدیریت، تماس و کارگاه' },
              { id: 'commerce' as const, icon: '🚚', label: 'فروش، حمل‌ونقل و پرداخت' },
              { id: 'cloud_github' as const, icon: '🌐', label: 'دیتابیس تلگرام و GitHub Pages' },
              { id: 'voice_backups' as const, icon: '🎙️', label: 'استودیو صوت و بکاپ' },
            ].map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSettingsSubTab(sub.id)}
                className={`whitespace-nowrap shrink-0 px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                  settingsSubTab === sub.id
                    ? 'bg-emerald-800 text-white'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <span>{sub.icon}</span>
                <span>{sub.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSaveSettings} className="bg-white dark:bg-stone-900 rounded-2xl p-5 sm:p-6 border border-stone-200 dark:border-stone-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
              <div>
                <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>⚙️</span>
                  <span>تنظیمات یکپارچه فروشگاه، امنیت و پایگاه داده زنده تلگرام</span>
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  کلیه تغییرات محصولات، قیمت‌ها، تنظیمات و سفارشات به صورت ریل‌تایم و بدون محدودیت در پایگاه داده تلگرام مدیر و نسخه GitHub Pages همگام می‌شوند.
                </p>
              </div>
              {isSettingsDirty && (
                <span className="px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 text-[11px] font-bold whitespace-nowrap shrink-0">
                  تغییرات ذخیره نشده — دکمه ذخیره را بزنید
                </span>
              )}
            </div>

            {settingsSavedMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                <span>✓</span>
                <span>{settingsSavedMessage}</span>
              </div>
            )}

            {/* Section 1: App Branding & Publish Logo */}
            {settingsSubTab === 'branding' && (
            <div className="space-y-4 pt-1">
              <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                <span>🎨</span>
                <span>۱. هویت بصری، عنوان و لوگوی برنامه (بخش انتشار / Publish)</span>
              </h3>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row items-center gap-4">
                <img
                  src={resolveAssetOrApiUrl(settings.appLogoDataUrl, 'pwa-192x192.png')}
                  alt="لوگوی برنامه"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-600/40 bg-emerald-950 shadow-md shrink-0"
                />
                <div className="flex-1 space-y-2 text-xs">
                  <div className="font-bold text-stone-900 dark:text-stone-100">
                    لوگوی اصلی سامانه، آیکون کل برنامه و مهر فروشگاه
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    این لوگو به صورت یکپارچه در نوار بالای سایت، پنجره‌های ورود و نصب، آیکون مرورگر/موبایل (PWA)، اپلیکیشن مشتریان و در صورت انتخاب به عنوان مهر فروشگاه در پیش‌فاکتورها نمایش داده می‌شود.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer px-3.5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors inline-flex items-center gap-1.5">
                      <span>📤</span>
                      <span>آپلود لوگوی جدید</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />
                    </label>
                    {settings.appLogoDataUrl && (
                      <button
                        type="button"
                        onClick={() => handleSettingChange('appLogoDataUrl', '')}
                        className="px-3 py-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 text-stone-700 dark:text-stone-200 font-bold rounded-xl text-xs"
                      >
                        بازگردانی به لوگوی پیش‌فرض Publish
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Editable Independent Store Seal Section (Not tied to app logo by default) */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/70 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                      <span>🔖</span>
                      <span>مهر معتبر فروشگاه در پیش‌فاکتورها (قابل ویرایش و مستقل از لوگو)</span>
                    </div>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400 mt-0.5">
                      می‌توانید عنوان، متن خط دوم، شناسه، رنگ جوهر یا تصویر مهر فروشگاه را به دلخواه بدون وابستگی به لوگوی برنامه ویرایش کنید.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-900 dark:text-emerald-200 bg-white dark:bg-stone-900 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 shrink-0">
                    <input
                      type="checkbox"
                      checked={settings.enableInvoiceSeal ?? true}
                      onChange={(e) => handleSettingChange('enableInvoiceSeal', e.target.checked)}
                      className="w-4 h-4 accent-emerald-700"
                    />
                    <span>درج مهر در فاکتورها</span>
                  </label>
                </div>

                {(settings.enableInvoiceSeal ?? true) && (
                  <div className="flex flex-col md:flex-row items-center gap-5 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                    {/* Live Preview */}
                    <div className="shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white dark:bg-stone-900 border border-emerald-200 dark:border-emerald-800">
                      <span className="text-[10px] font-bold text-stone-500">پیش‌نمایش زنده مهر</span>
                      <StoreSealBadge
                        settings={settings}
                        appLogoSrc={resolveAssetOrApiUrl(settings.appLogoDataUrl, 'pwa-192x192.png')}
                        size="md"
                      />
                    </div>

                    {/* Stamp Mode & Editable Fields */}
                    <div className="flex-1 w-full space-y-3 text-xs">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'text_stamp' as const, label: 'مهر نوشتاری قابل ویرایش (بدون لوگو)' },
                          { id: 'custom_image' as const, label: 'تصویر مهر اختصاصی آپلودی' },
                          { id: 'logo' as const, label: 'استفاده از لوگوی برنامه در مهر' },
                        ].map((m) => {
                          const currentMode = settings.invoiceSealMode || 'text_stamp';
                          const active = currentMode === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                handleSettingChange('invoiceSealMode', m.id);
                                handleSettingChange('useLogoAsInvoiceSeal', m.id === 'logo');
                              }}
                              className={`px-3 py-1.5 rounded-xl font-bold border transition-all text-[11px] ${
                                active
                                  ? 'bg-emerald-800 border-emerald-800 text-white shadow-xs'
                                  : 'bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50'
                              }`}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>

                      {(settings.invoiceSealMode || 'text_stamp') === 'custom_image' ? (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <label className="cursor-pointer px-3.5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs inline-flex items-center gap-1.5">
                            <span>📤</span>
                            <span>آپلود تصویر مهر اختصاصی</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleCustomSealImageUpload}
                              className="hidden"
                            />
                          </label>
                          {settings.invoiceSealImageDataUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                handleSettingChange('invoiceSealImageDataUrl', '');
                                handleSettingChange('invoiceSealMode', 'text_stamp');
                              }}
                              className="px-3 py-2 bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 font-bold rounded-xl text-xs"
                            >
                              حذف تصویر مهر
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                              عنوان اصلی داخل مهر
                            </label>
                            <input
                              type="text"
                              value={settings.invoiceSealTitle ?? settings.workshopName}
                              onChange={(e) => handleSettingChange('invoiceSealTitle', e.target.value)}
                              placeholder="گروه زیست‌فناوری مهندس صفری"
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                              متن خط دوم مهر
                            </label>
                            <input
                              type="text"
                              value={settings.invoiceSealSubtitle ?? 'مهر معتبر تایید فروش و بارگیری'}
                              onChange={(e) => handleSettingChange('invoiceSealSubtitle', e.target.value)}
                              placeholder="مهر معتبر تایید فروش و بارگیری"
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                              کد ثبت / شماره مجوز مهر
                            </label>
                            <input
                              type="text"
                              value={settings.invoiceSealCode ?? 'ISIRI 13724'}
                              onChange={(e) => handleSettingChange('invoiceSealCode', e.target.value)}
                              placeholder="ISIRI 13724"
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {(settings.invoiceSealMode || 'text_stamp') !== 'custom_image' && (
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-[10.5px] font-bold text-stone-600 dark:text-stone-400">رنگ جوهر مهر:</span>
                          {[
                            { hex: '#065f46', label: 'سبز تیره' },
                            { hex: '#1d4ed8', label: 'آبی اداری' },
                            { hex: '#9f1239', label: 'زرشکی' },
                            { hex: '#1c1917', label: 'مشکی' },
                          ].map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              onClick={() => handleSettingChange('invoiceSealColor', c.hex)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${
                                (settings.invoiceSealColor || '#065f46') === c.hex
                                  ? 'ring-2 ring-emerald-500 border-stone-900 dark:border-white bg-white dark:bg-stone-900'
                                  : 'bg-white/70 dark:bg-stone-800 border-stone-300 dark:border-stone-700'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full inline-block"
                                style={{ backgroundColor: c.hex }}
                              />
                              <span>{c.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Editable Storefront Trust Badge (Defaults to App Logo, customizable) */}
              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/70 space-y-4">
                <div>
                  <div className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>نشان اعتبار پایین صفحه محصولات (بخش نشان اعتبار و نصب اپلیکیشن)</span>
                  </div>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    به صورت پیش‌فرض لوگوی اصلی برنامه به عنوان نشان اعتبار نمایش داده می‌شود و در صورت نیاز می‌توانید تصویر دلخواه (مثل ای‌نماد یا لوگوی مجوز) یا مهر کارگاه را جایگزین کنید.
                  </p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-5 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                  {/* Live Trust Badge Preview */}
                  <div className="shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800 min-w-[128px]">
                    <span className="text-[10px] font-bold text-stone-500">پیش‌نمایش نشان اعتبار</span>
                    {(settings.trustBadgeMode || 'app_logo') === 'invoice_seal' ? (
                      <StoreSealBadge
                        settings={settings}
                        appLogoSrc={resolveAssetOrApiUrl(settings.appLogoDataUrl, 'pwa-192x192.png')}
                        size="sm"
                      />
                    ) : (
                      <img
                        src={
                          (settings.trustBadgeMode || 'app_logo') === 'custom_image' && settings.trustBadgeImageDataUrl
                            ? resolveAssetOrApiUrl(settings.trustBadgeImageDataUrl, 'pwa-192x192.png')
                            : resolveAssetOrApiUrl(settings.appLogoDataUrl, 'pwa-192x192.png')
                        }
                        alt={settings.trustBadgeTitle || 'نشان اعتبار و اصالت فروشگاه'}
                        className="w-16 h-16 rounded-2xl object-contain bg-white border border-stone-200 dark:border-stone-700 p-1 shadow-xs"
                      />
                    )}
                    <span className="text-[10px] font-bold text-stone-700 dark:text-stone-300 text-center max-w-[120px] truncate">
                      {settings.trustBadgeTitle || 'نشان اعتبار و اصالت فروشگاه'}
                    </span>
                  </div>

                  {/* Mode Selection & Upload Controls */}
                  <div className="flex-1 w-full space-y-3 text-xs">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'app_logo' as const, label: 'لوگوی برنامه (پیش‌فرض)' },
                        { id: 'custom_image' as const, label: 'آپلود تصویر نشان اختصاصی' },
                        { id: 'invoice_seal' as const, label: 'استفاده از مهر فاکتور کارگاه' },
                      ].map((m) => {
                        const active = (settings.trustBadgeMode || 'app_logo') === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSettingChange('trustBadgeMode', m.id)}
                            className={`px-3 py-1.5 rounded-xl font-bold border transition-all text-[11px] ${
                              active
                                ? 'bg-emerald-800 border-emerald-800 text-white shadow-xs'
                                : 'bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50'
                            }`}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                      <div>
                        <label className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                          عنوان زیر نشان اعتبار
                        </label>
                        <input
                          type="text"
                          maxLength={120}
                          value={settings.trustBadgeTitle ?? 'نشان اعتبار و اصالت فروشگاه'}
                          onChange={(e) => handleSettingChange('trustBadgeTitle', e.target.value)}
                          placeholder="نشان اعتبار و اصالت فروشگاه"
                          className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer px-3.5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs inline-flex items-center gap-1.5">
                          <span>📤</span>
                          <span>آپلود تصویر نشان اعتبار</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleTrustBadgeImageUpload}
                            className="hidden"
                          />
                        </label>
                        {settings.trustBadgeImageDataUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              handleSettingChange('trustBadgeImageDataUrl', '');
                              handleSettingChange('trustBadgeMode', 'app_logo');
                            }}
                            className="px-3 py-2 bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 font-bold rounded-xl text-xs"
                          >
                            بازگردانی به لوگو برنامه
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    نام کارگاه / عنوان اصلی برنامه
                  </label>
                  <input
                    type="text"
                    value={settings.workshopName}
                    onChange={(e) => handleSettingChange('workshopName', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    شعار و عنوان فرعی برنامه (Tagline)
                  </label>
                  <input
                    type="text"
                    value={settings.appTagline || ''}
                    onChange={(e) => handleSettingChange('appTagline', e.target.value)}
                    placeholder="سامانه جامع فروشگاه و کارگاه زیست‌فناوری"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    متن نوار استاندارد بالای فروشگاه مشتریان (نمایش در بنر کاتالوگ)
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={settings.storeHeroBadgeText ?? 'تولید استاندارد ISIRI · ارسال مستقیم از کارگاه'}
                    onChange={(e) => handleSettingChange('storeHeroBadgeText', e.target.value)}
                    placeholder="تولید استاندارد ISIRI · ارسال مستقیم از کارگاه"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>
              </div>

              {/* Installed App (PWA) Dedicated Name & Icon Settings */}
              <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/70 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-bold text-sky-950 dark:text-sky-200 flex items-center gap-1.5">
                    <span>📲</span>
                    <span>ویرایش نام و آیکون نسخه نصب‌شده برنامه (آیکون صفحه اصلی موبایل / PWA)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white dark:bg-stone-900 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-semibold">
                    نمای آیکون گوشی
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Live Home-Screen App Shortcut Mock Preview */}
                  <div className="shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/90 dark:bg-stone-900 border border-sky-200 dark:border-sky-800 min-w-[116px] shadow-xs">
                    <img
                      src={resolveAssetOrApiUrl(settings.pwaAppIconDataUrl || settings.appLogoDataUrl, 'pwa-192x192.png')}
                      alt="آیکون نسخه نصب‌شده"
                      className="w-14 h-14 rounded-2xl object-cover border border-stone-200 dark:border-stone-700 shadow-sm bg-emerald-950"
                    />
                    <span className="text-[10px] font-bold text-stone-800 dark:text-stone-200 max-w-[100px] truncate text-center">
                      {(settings.pwaAppName || settings.workshopName || 'ورمیکمپوست صفری').slice(0, 24)}
                    </span>
                  </div>

                  <div className="flex-1 w-full space-y-2.5">
                    <div>
                      <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                        نام نمایشی برنامه پس از نصب روی گوشی (زیر آیکون برنامه):
                      </label>
                      <input
                        type="text"
                        maxLength={60}
                        value={settings.pwaAppName || ''}
                        onChange={(e) => handleSettingChange('pwaAppName', e.target.value)}
                        placeholder="مثال: ورمیکمپوست صفری"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-sky-300 dark:border-sky-700"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer px-3.5 py-2 bg-sky-700 hover:bg-sky-600 text-white font-bold rounded-xl text-xs shadow-xs transition-colors inline-flex items-center gap-1.5">
                        <span>🖼️</span>
                        <span>آپلود آیکون اختصاصی نسخه نصب‌شده</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePwaIconFileUpload}
                          className="hidden"
                        />
                      </label>
                      {settings.pwaAppIconDataUrl && (
                        <button
                          type="button"
                          onClick={() => handleSettingChange('pwaAppIconDataUrl', '')}
                          className="px-3 py-2 bg-white dark:bg-stone-800 hover:bg-stone-100 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-bold rounded-xl text-xs"
                        >
                          همسان‌سازی با لوگوی اصلی برنامه
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Section 2 & 3: Complete Management Profile, Agronomist & Contact Details */}
            {settingsSubTab === 'contacts' && (
            <div className="space-y-6">
            <div className="space-y-3 pt-1">
              <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                <span>👔</span>
                <span>۱. ویرایش مشخصات کامل مدیریت کارگاه و فروشگاه</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    نام و نام خانوادگی مدیر عامل / صاحب امتیاز
                  </label>
                  <input
                    type="text"
                    value={settings.managerFullName || ''}
                    onChange={(e) => handleSettingChange('managerFullName', e.target.value)}
                    placeholder="مثال: مهندس علی وفایی / مهندس صفری"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    سمت و عنوان شغلی مدیریت
                  </label>
                  <input
                    type="text"
                    value={settings.managerTitle || ''}
                    onChange={(e) => handleSettingChange('managerTitle', e.target.value)}
                    placeholder="مدیریت کل مجموعه، نظارت کیفی و فروش"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    شماره تماس مستقیم مدیریت
                  </label>
                  <input
                    type="text"
                    value={settings.managerPhone || ''}
                    onChange={(e) => handleSettingChange('managerPhone', e.target.value)}
                    placeholder="09120000003"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    ایمیل / پست الکترونیک مدیریت
                  </label>
                  <input
                    type="email"
                    value={settings.managerEmail || ''}
                    onChange={(e) => handleSettingChange('managerEmail', e.target.value)}
                    placeholder="manager@domain.com"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    شماره پروانه بهره‌برداری / شناسه ملی / کد استاندارد
                  </label>
                  <input
                    type="text"
                    value={settings.managerLicenseCode || ''}
                    onChange={(e) => handleSettingChange('managerLicenseCode', e.target.value)}
                    placeholder="جهاد کشاورزی · ISIRI 13724"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                <div className="md:col-span-2 p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/70 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block font-bold text-stone-800 dark:text-stone-200">
                      استان و شهر استقرار مدیریت (مبنای خودکار بخش هواشناسی مدیر)
                    </label>
                    <span className="text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300">
                      📍 {adminWeatherLocation.province} / {adminWeatherLocation.city}
                    </span>
                  </div>
                  <IranLocationSelector
                    compact
                    province={adminWeatherLocation.province}
                    city={adminWeatherLocation.city}
                    onProvinceChange={(prov) => {
                      const nextProv = prov;
                      const nextCity = adminWeatherLocation.city || '';
                      setSettings((prev) => ({
                        ...prev,
                        managerProvince: nextProv,
                        managerProvinceCity: `${nextProv} / ${nextCity}`,
                      }));
                      setIsSettingsDirty(true);
                    }}
                    onCityChange={(cty) => {
                      const nextProv = adminWeatherLocation.province || '';
                      setSettings((prev) => ({
                        ...prev,
                        managerProvince: nextProv,
                        managerCity: cty,
                        managerProvinceCity: `${nextProv} / ${cty}`,
                      }));
                      setIsSettingsDirty(true);
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  آدرس دقیق دفتر / محل استقرار مدیریت
                </label>
                <input
                  type="text"
                  value={settings.managerAddress || ''}
                  onChange={(e) => handleSettingChange('managerAddress', e.target.value)}
                  placeholder="استان، شهر، خیابان، پلاک یا نشانی دقیق دفتر مدیریت..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  متن امضای مدیریت و تعهدنامه کیفی (درج در زیر فاکتورها و تاییدیه‌ها)
                </label>
                <input
                  type="text"
                  value={settings.managerBioNote || ''}
                  onChange={(e) => handleSettingChange('managerBioNote', e.target.value)}
                  placeholder="تضمین اصالت، آنالیز آزمایشگاهی و ارسال مستقیم از کارگاه"
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs"
                />
              </div>
            </div>

            {/* Section 3: Store, Agronomist & Contact Details */}
            <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
              <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                <span>📞</span>
                <span>۳. اطلاعات تماس، مشاور باغبانی و نشانی کارگاه</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    شماره تماس مستقیم مشاور کارگاه
                  </label>
                  <input
                    type="text"
                    value={settings.agronomistPhone}
                    onChange={(e) => handleSettingChange('agronomistPhone', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    شماره تماس پشتیبانی و فروش فروشگاه
                  </label>
                  <input
                    type="text"
                    value={settings.supportPhone}
                    onChange={(e) => handleSettingChange('supportPhone', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    نام مشاور واحد فروش و پشتیبانی (پایین صفحه محصولات)
                  </label>
                  <input
                    type="text"
                    value={settings.salesAdvisorName ?? 'مهندس اصغری'}
                    onChange={(e) => handleSettingChange('salesAdvisorName', e.target.value)}
                    placeholder="مهندس اصغری"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    نام مشاور اختصاصی باغبانی کارگاه
                  </label>
                  <input
                    type="text"
                    value={settings.agronomistName}
                    onChange={(e) => handleSettingChange('agronomistName', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    سمت و عنوان مشاور
                  </label>
                  <input
                    type="text"
                    value={settings.agronomistTitle}
                    onChange={(e) => handleSettingChange('agronomistTitle', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    ساعات پاسخگویی و بارگیری کارگاه
                  </label>
                  <input
                    type="text"
                    value={settings.workingHours || ''}
                    onChange={(e) => handleSettingChange('workingHours', e.target.value)}
                    placeholder="شنبه تا پنجشنبه، ۸:۰۰ تا ۱۸:۰۰"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    نشانی کارگاه (نمایش در پروفایل و فاکتور)
                  </label>
                  <input
                    type="text"
                    value={settings.workshopAddress || ''}
                    onChange={(e) => handleSettingChange('workshopAddress', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  پیام بنر بالای فروشگاه مشتریان (شرایط ارسال)
                </label>
                <textarea
                  rows={2}
                  value={settings.minOrderNotice}
                  onChange={(e) => handleSettingChange('minOrderNotice', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs"
                />
              </div>
            </div>
            </div>
            )}

            {/* Section 4 & 5: Shipping Rates, Payment, Checkout & Security */}
            {settingsSubTab === 'commerce' && (
            <div className="space-y-6">
            <div className="space-y-3 pt-1">
              <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                <span>🚚</span>
                <span>۱. تنظیمات فروش، تعرفه حمل‌ونقل، فاکتور و ماژول‌های مشتریان</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    کرایه بار سبک (&lt; ۱۰۰kg) - ت
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={settings.shippingSmallFee ?? 180000}
                    onChange={(e) => {
                      const cleaned = normalizeDigits(e.target.value).replace(/[^\d]/g, '');
                      handleSettingChange('shippingSmallFee', cleaned === '' ? 0 : parseInt(cleaned, 10));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    پایه حمل نیمه‌عمده (۱۰۰-۹۹۹kg)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={settings.shippingMediumBaseFee ?? 450000}
                    onChange={(e) => {
                      const cleaned = normalizeDigits(e.target.value).replace(/[^\d]/g, '');
                      handleSettingChange('shippingMediumBaseFee', cleaned === '' ? 0 : parseInt(cleaned, 10));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    تعرفه حمل هر تن بار عمده (تومان)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={settings.shippingTonFee ?? 1500000}
                    onChange={(e) => {
                      const cleaned = normalizeDigits(e.target.value).replace(/[^\d]/g, '');
                      handleSettingChange('shippingTonFee', cleaned === '' ? 0 : parseInt(cleaned, 10));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    سقف ارسال رایگان (۰ = غیرفعال)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={settings.freeShippingThresholdToman ?? 0}
                    onChange={(e) => {
                      const cleaned = normalizeDigits(e.target.value).replace(/[^\d]/g, '');
                      handleSettingChange('freeShippingThresholdToman', cleaned === '' ? 0 : parseInt(cleaned, 10));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-center"
                  />
                </div>
              </div>

              {/* Bank Card & Sheba Payment Configuration for Telegram Bot & Checkout */}
              <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/25 border border-sky-200 dark:border-sky-800/70 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="text-xs font-extrabold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                    <span>💳</span>
                    <span>اطلاعات واریز بانکی (شماره کارت و شبا برای نمایش در ربات تلگرام و فاکتور)</span>
                  </div>
                  <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300">
                    بلافاصله پس از ذخیره در دکمه «شماره کارت و شبا» ربات و سبد خرید نمایش داده می‌شود
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      شماره کارت ۱۶ رقمی
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      inputMode="numeric"
                      value={settings.paymentCardNumber || ''}
                      onChange={(e) => handleSettingChange('paymentCardNumber', e.target.value)}
                      placeholder="6037-9970-0000-0000"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-sky-200 dark:border-sky-800 font-mono text-left"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      شماره شبا (با پیشوند IR)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={settings.paymentIban || ''}
                      onChange={(e) => handleSettingChange('paymentIban', e.target.value.toUpperCase())}
                      placeholder="IR000170000000000000000000"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-sky-200 dark:border-sky-800 font-mono text-left"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      نام و نام خانوادگی صاحب کارت / حساب
                    </label>
                    <input
                      type="text"
                      value={settings.paymentCardHolder || ''}
                      onChange={(e) => handleSettingChange('paymentCardHolder', e.target.value)}
                      placeholder="مثلاً علی وفایی / مهندس صفری"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-sky-200 dark:border-sky-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      نام بانک صادرکننده
                    </label>
                    <input
                      type="text"
                      value={settings.paymentBankName || ''}
                      onChange={(e) => handleSettingChange('paymentBankName', e.target.value)}
                      placeholder="مثلاً بانک ملی / ملت / کشاورزی"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-sky-200 dark:border-sky-800"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    متن شرایط پرداخت در سبد خرید مشتریان و ربات
                  </label>
                  <textarea
                    rows={2}
                    value={settings.paymentTermsNotice || ''}
                    onChange={(e) => handleSettingChange('paymentTermsNotice', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    پاورقی و شماره استاندارد در پیش‌فاکتور فروش
                  </label>
                  <textarea
                    rows={2}
                    value={settings.invoiceFooterNote || ''}
                    onChange={(e) => handleSettingChange('invoiceFooterNote', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                <label className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 cursor-pointer">
                  <div>
                    <div className="font-bold text-stone-800 dark:text-stone-200">فعال بودن ماژول محاسبه‌گر هوشمند کود</div>
                    <div className="text-[10px] text-stone-500">نمایش تب محاسبه دوز کود بر اساس سن درخت برای مشتریان</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableCalculator ?? true}
                    onChange={(e) => handleSettingChange('enableCalculator', e.target.checked)}
                    className="w-4 h-4 accent-emerald-700"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 cursor-pointer">
                  <div>
                    <div className="font-bold text-stone-800 dark:text-stone-200">نمایش تعداد موجودی دقیق انبار به خریداران</div>
                    <div className="text-[10px] text-stone-500">اگر غیرفعال شود، فقط وضعیت «موجود» یا «ناموجود» نشان داده می‌شود</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showStockCountToCustomers ?? true}
                    onChange={(e) => handleSettingChange('showStockCountToCustomers', e.target.checked)}
                    className="w-4 h-4 accent-emerald-700"
                  />
                </label>
              </div>
            </div>

            {/* Section 5: Admin Security & Registered Customers Overview */}
            <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
              <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <span>🔒</span>
                <span>۵. امنیت دسترسی مدیریت و کاربران عضو سامانه ({registeredUsers.length} حساب)</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    نام کاربری جدید مدیریت (فعلی: <span className="font-mono">{settings.adminUsername}</span>)
                  </label>
                  <input
                    type="text"
                    value={newAdminUser}
                    onChange={(e) => {
                      isSettingsDirtyRef.current = true;
                      setIsSettingsDirty(true);
                      setNewAdminUser(e.target.value);
                    }}
                    placeholder="در صورت تمایل به تغییر، نام کاربری جدید را تایپ کنید"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    تغییر رمز عبور مدیریت
                  </label>
                  <input
                    type="password"
                    value={newAdminPass}
                    onChange={(e) => {
                      isSettingsDirtyRef.current = true;
                      setIsSettingsDirty(true);
                      setNewAdminPass(e.target.value);
                    }}
                    placeholder="رمز عبور جدید را وارد کنید"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {registeredUsers.filter(u => u.role === 'customer').length > 0 && (() => {
                const customerAccounts = registeredUsers.filter(u => u.role === 'customer');
                const tgConnectedCount = customerAccounts.filter((u) => {
                  const matched = tgEntryByPhone.get(normalizeDigits(u.phoneNumber));
                  return Boolean(u.telegramLinked || u.telegramUserId || u.telegramUsername || matched);
                }).length;

                return (
                  <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
                      <div className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                        خریداران ثبت‌نام‌شده در سامانه ابری ({customerAccounts.length.toLocaleString('fa-IR')} نفر):
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-[10px] font-bold flex items-center gap-1">
                        <span>✈️</span>
                        <span>مشتریان دارای تلگرام: {tgConnectedCount.toLocaleString('fa-IR')} نفر</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {customerAccounts.map((u) => {
                        const matchedTg = tgEntryByPhone.get(normalizeDigits(u.phoneNumber));
                        const hasTelegram = Boolean(
                          u.telegramLinked || u.telegramUserId || u.telegramUsername || matchedTg
                        );
                        const tgUsername = u.telegramUsername || matchedTg?.username;
                        return (
                          <span
                            key={u.id}
                            className={`px-2.5 py-1 rounded-lg border text-[10px] flex items-center gap-1.5 ${
                              hasTelegram
                                ? 'bg-sky-50/80 dark:bg-sky-950/35 border-sky-300 dark:border-sky-700/80'
                                : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700'
                            }`}
                          >
                            <span className="font-bold">{u.fullName}</span>
                            <span className="font-mono text-stone-500 dark:text-stone-400" dir="ltr">
                              {u.phoneNumber}
                            </span>
                            {u.city && (
                              <span className="text-emerald-700 dark:text-emerald-400">({u.city})</span>
                            )}
                            {hasTelegram && (
                              <span
                                className="px-1.5 py-0.5 rounded bg-sky-600 text-white font-bold text-[9.5px] flex items-center gap-1"
                                title={
                                  tgUsername
                                    ? `تلگرام متصل: @${tgUsername}`
                                    : u.telegramUserId || matchedTg?.telegramUserId
                                    ? `شناسه تلگرام: ${u.telegramUserId || matchedTg?.telegramUserId}`
                                    : 'متصل به تلگرام'
                                }
                              >
                                <span>✈️</span>
                                <span>تلگرام</span>
                                {tgUsername && (
                                  <span className="font-mono opacity-95" dir="ltr">
                                    @{tgUsername}
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            </div>
            )}

            {/* Section 6 & 7: Realtime Telegram Cloud DB + Auto GitHub Pages Sync */}
            {settingsSubTab === 'cloud_github' && (
            <div className="space-y-6">
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                    <span>✈️</span>
                    <span>۱. پایگاه داده زنده و ریل‌تایم تلگرام مدیر (بدون محدودیت و کاملاً مستقل)</span>
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                    تمام اطلاعات محصولات، قیمت‌ها، تنظیمات، سفارشات و فایل‌های صوتی به صورت لحظه‌ای (SSE) از پایگاه داده تلگرام منتقل شده و در سایت GitHub Pages نیز همگام‌سازی می‌شوند.
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                  syncState.status === 'synced'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                    : syncState.status === 'syncing' || syncState.status === 'connecting'
                    ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-stone-800 dark:text-rose-300 border-rose-300'
                }`}>
                  {syncState.status === 'synced'
                    ? 'پایگاه داده تلگرام ریل‌تایم · متصل ✓'
                    : syncState.status === 'syncing'
                    ? 'در حال ارسال لحظه‌ای...'
                    : syncState.status === 'connecting'
                    ? 'در حال اتصال زنده...'
                    : syncState.status === 'offline'
                    ? 'آفلاین'
                    : 'خطای اتصال'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-sky-50/50 dark:bg-sky-950/20 p-4 rounded-2xl border border-sky-200/60 dark:border-sky-900/40">
                <div>
                  <span className="text-stone-500 text-[11px] block">موتور اصلی پایگاه داده:</span>
                  <span className="font-mono font-bold text-stone-800 dark:text-stone-200">Telegram Cloud DB + SSE</span>
                </div>
                <div>
                  <span className="text-stone-500 text-[11px] block">وضعیت همگام‌سازی آنی:</span>
                  <div className="flex flex-wrap gap-1 mt-0.5 text-[10px] font-bold">
                    <span className="text-emerald-800 dark:text-emerald-300">همه تغییرات در لحظه منتشر می‌شوند ✓</span>
                  </div>
                </div>
                <div>
                  <span className="text-stone-500 text-[11px] block">آخرین همگام‌سازی موفق:</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-800 dark:text-emerald-300">
                    {syncState.lastSyncedAt || settings.lastSyncedAt || 'لحظه‌ای'}
                  </span>
                </div>

                <div className="md:col-span-3 pt-2 border-t border-sky-200/40 dark:border-sky-900/30 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-[11px] text-stone-600 dark:text-stone-400">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">✓ انتقال ریل‌تایم و خودکار:</span> هر تغییری در محصولات، قیمت‌ها، تنظیمات، شماره کارت، کارگاه و سفارشات بلافاصله در وب‌اپ، ربات، مینی‌اپ و سایت GitHub Pages اعمال می‌شود.
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: GitHub & GitHub Pages Hosting Integration */}
            <div className="space-y-4 pt-4 border-t border-stone-200 dark:border-stone-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                    <span>🐙</span>
                    <span>۲. اتصال خودکار گیت‌هاب و به‌روزرسانی زنده GitHub Pages</span>
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                    مخزن گیت‌هاب و فایل زنده <code className="font-mono">live-db.json</code> به‌طور خودکار با دیتابیس تلگرام متصل هستند تا سایت استاتیک GitHub Pages همیشه آنلاین و به‌روز باشد.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {githubServerStatus?.autoConfigured && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                      اتصال خودکار فعال ✓
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                      githubServerStatus?.workflowExists
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200'
                    }`}
                  >
                    {githubServerStatus?.workflowExists
                      ? 'Workflow آماده ✓'
                      : 'Workflow آماده دانلود'}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                      githubServerStatus?.hasServerToken
                        ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                    }`}
                  >
                    {githubServerStatus?.hasServerToken
                      ? 'همگام‌سازی خودکار گیت‌هاب فعال ✓'
                      : 'حالت اتصال مستقیم گیت‌هاب'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50/90 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 space-y-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-stone-700">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-stone-800 dark:text-stone-200">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.githubPagesEnabled)}
                      onChange={(e) => handleSettingChange('githubPagesEnabled', e.target.checked)}
                      className="w-4 h-4 accent-emerald-700"
                    />
                    <span>فعال‌سازی اتصال و نمایش آدرس سایت GitHub Pages در برنامه</span>
                  </label>
                  {computedGithubPagesUrl && (
                    <a
                      href={computedGithubPagesConnectedUrl || computedGithubPagesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold text-[11px] hover:opacity-90 transition-opacity inline-flex items-center gap-1"
                    >
                      <span>🌐</span>
                      <span>باز کردن سایت GitHub Pages ↗</span>
                    </a>
                  )}
                </div>

                {/* Quick Paste GitHub URL */}
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    جای‌گذاری سریع لینک مخزن گیت‌هاب (مثال: https://github.com/username/repo)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      value={githubRepoQuickInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGithubRepoQuickInput(val);
                        const parsed = parseGithubRepoInput(val);
                        if (parsed) {
                          setSettings((prev) => ({
                            ...prev,
                            githubOwner: parsed.owner,
                            githubRepo: parsed.repo,
                            githubPagesEnabled: true,
                          }));
                          setIsSettingsDirty(true);
                          isSettingsDirtyRef.current = true;
                        }
                      }}
                      placeholder="https://github.com/your-username/your-repo"
                      className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-mono text-left"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = parseGithubRepoInput(githubRepoQuickInput);
                        if (parsed) {
                          setSettings((prev) => ({
                            ...prev,
                            githubOwner: parsed.owner,
                            githubRepo: parsed.repo,
                            githubPagesEnabled: true,
                          }));
                          setIsSettingsDirty(true);
                          isSettingsDirtyRef.current = true;
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 text-stone-800 dark:text-stone-100 font-bold shrink-0"
                    >
                      استخراج خودکار مشخصات
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      نام کاربری / سازمان (Owner)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={settings.githubOwner ?? githubServerStatus?.envOwner ?? ''}
                      onChange={(e) => handleSettingChange('githubOwner', e.target.value)}
                      placeholder="username"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-mono text-left"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      نام مخزن گیت‌هاب (Repository)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={settings.githubRepo ?? githubServerStatus?.envRepo ?? ''}
                      onChange={(e) => handleSettingChange('githubRepo', e.target.value)}
                      placeholder="my-store-app"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-mono text-left"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      شاخه استقرار (Branch)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={settings.githubBranch ?? 'main'}
                      onChange={(e) => handleSettingChange('githubBranch', e.target.value)}
                      placeholder="main"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-mono text-left"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      دامنه اختصاصی (CNAME - اختیاری)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={settings.githubCustomDomain || ''}
                      onChange={(e) => handleSettingChange('githubCustomDomain', e.target.value)}
                      placeholder="shop.example.com"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-mono text-left"
                    />
                  </div>
                </div>

                {/* Single Unified Store & Telegram Bot WebApp URL */}
                <div className="p-3.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/25 border border-sky-200 dark:border-sky-800/70 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                    <label className="block font-bold text-sky-950 dark:text-sky-200">
                      🔗 آدرس واحد باز شدن فروشگاه و مینی‌اپ در ربات تلگرام (دکمه Open / فروشگاه و خرید سریع)
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {typeof window !== 'undefined' &&
                        window.location.origin.startsWith('https://') &&
                        !window.location.hostname.endsWith('.github.io') && (
                          <button
                            type="button"
                            onClick={() => handleSettingChange('telegramWebAppUrl', window.location.origin)}
                            className="text-[10.5px] font-bold text-sky-800 dark:text-sky-300 hover:underline"
                          >
                            ⚡ همین سرور فعلی
                          </button>
                        )}
                      {computedGithubPagesUrl && (
                        <button
                          type="button"
                          onClick={() => handleSettingChange('telegramWebAppUrl', computedGithubPagesUrl)}
                          className="text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300 hover:underline"
                        >
                          🐙 استفاده از GitHub Pages
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="url"
                    dir="ltr"
                    value={settings.telegramWebAppUrl || ''}
                    onChange={(e) => handleSettingChange('telegramWebAppUrl', e.target.value)}
                    placeholder={computedGithubPagesUrl || githubServerStatus?.defaultApiBaseUrl || 'https://ali136640.github.io/fertilierstore'}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-sky-300 dark:border-sky-700 font-mono text-left"
                  />
                  <p className="text-[10.5px] text-sky-900/80 dark:text-sky-300/80 leading-relaxed">
                    با ذخیره تنظیمات، تمام بخش‌های فروشگاه در ربات تلگرام (دکمه Open / فروشگاه منو و دکمه‌های کشویی خرید سریع محصولات) دقیقاً از همین آدرس واحد و به‌صورت تمام‌صفحه باز می‌شوند.
                  </p>
                </div>

                {/* Backend Server API Connection for Static GitHub Pages */}
                <div>
                  <div className="flex items-center justify-between flex-wrap gap-1.5 mb-1">
                    <label className="block font-bold text-stone-700 dark:text-stone-300">
                      آدرس سرور بک‌اند متصل برای دیتابیس زنده تلگرام و API (مورد نیاز سایت استاتیک GitHub Pages)
                    </label>
                    {typeof window !== 'undefined' &&
                      window.location.origin.startsWith('https://') &&
                      !window.location.hostname.endsWith('.github.io') && (
                        <button
                          type="button"
                          onClick={() => handleSettingChange('githubApiBaseUrl', window.location.origin)}
                          className="text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300 hover:underline"
                        >
                          ⚡ استفاده از آدرس همین سرور فعلی
                        </button>
                      )}
                  </div>
                  <input
                    type="url"
                    dir="ltr"
                    value={settings.githubApiBaseUrl || ''}
                    onChange={(e) => handleSettingChange('githubApiBaseUrl', e.target.value)}
                    placeholder={githubServerStatus?.defaultApiBaseUrl || 'https://your-backend-server.run.app'}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-mono text-left"
                  />
                </div>

                {/* Computed URLs & Quick Actions */}
                {computedGithubPagesUrl && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-emerald-200 dark:border-emerald-800/70 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[10.5px] font-bold text-stone-500 block">
                          آدرس عمومی سایت GitHub Pages:
                        </span>
                        <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300 break-all" dir="ltr">
                          {computedGithubPagesUrl}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyGithubText('pagesUrl', computedGithubPagesUrl)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-[10.5px] shrink-0"
                      >
                        {copiedGithubKey === 'pagesUrl' ? 'کپی شد ✓' : 'کپی آدرس سایت'}
                      </button>
                    </div>

                    {computedGithubPagesConnectedUrl !== computedGithubPagesUrl && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-stone-200/70 dark:border-stone-800">
                        <div className="min-w-0">
                          <span className="text-[10.5px] font-bold text-sky-700 dark:text-sky-300 block">
                            لینک اتصال خودکار سایت به دیتابیس زنده تلگرام (مناسب مینی‌اپ و اشتراک‌گذاری):
                          </span>
                          <span className="font-mono text-[10.5px] text-stone-600 dark:text-stone-400 break-all" dir="ltr">
                            {computedGithubPagesConnectedUrl}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyGithubText('connectedUrl', computedGithubPagesConnectedUrl)}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold text-[10.5px] shrink-0"
                        >
                          {copiedGithubKey === 'connectedUrl' ? 'کپی شد ✓' : 'کپی لینک متصل'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCheckGithubPages}
                    disabled={isCheckingGithub}
                    className="px-3.5 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 hover:opacity-90 disabled:opacity-50 text-white dark:text-stone-900 font-bold text-xs flex items-center gap-1.5"
                  >
                    <span>🔍</span>
                    <span>{isCheckingGithub ? 'در حال بررسی گیت‌هاب...' : 'بررسی وضعیت مخزن و سایت'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncGithubLiveDbNow}
                    disabled={isSyncingGithubLiveDb}
                    className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <span>🔄</span>
                    <span>{isSyncingGithubLiveDb ? 'در حال ارسال قیمت‌ها و کاتالوگ...' : 'همگام‌سازی فوری سایت گیت‌هاب'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectPublishGithubPages}
                    disabled={isDeployingGithub}
                    className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <span>⚡</span>
                    <span>{isDeployingGithub ? 'در حال بیلد و انتشار مستقیم...' : 'تنظیم و انتشار فوری (بدون صف Actions)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerGithubDeploy}
                    disabled={isDeployingGithub}
                    className="px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <span>🚀</span>
                    <span>{isDeployingGithub ? 'در حال ارسال...' : 'اجرای Workflow گیت‌هاب Actions'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadGithubWorkflow}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-stone-900 hover:bg-stone-100 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-bold text-xs flex items-center gap-1.5"
                  >
                    <span>📄</span>
                    <span>دانلود deploy-pages.yml</span>
                  </button>

                  {(settings.githubOwner || githubServerStatus?.envOwner) &&
                    (settings.githubRepo || githubServerStatus?.envRepo) && (
                      <a
                        href={`https://github.com/${(settings.githubOwner || githubServerStatus?.envOwner || '').trim()}/${(settings.githubRepo || githubServerStatus?.envRepo || '').trim()}/settings/pages`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold text-xs flex items-center gap-1.5"
                      >
                        <span>⚙️</span>
                        <span>تنظیمات Pages در گیت‌هاب ↗</span>
                      </a>
                    )}
                </div>

                {githubFeedbackMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold">
                    ✓ {githubFeedbackMsg}
                  </div>
                )}

                {githubErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold">
                    ⚠️ {githubErrorMsg}
                  </div>
                )}

                {githubCheckResult && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 space-y-3 text-[11px]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <span className="text-stone-500 block">مخزن متصل:</span>
                        <span className="font-mono font-bold text-stone-900 dark:text-stone-100" dir="ltr">
                          {githubCheckResult.repoFullName || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-500 block">وضعیت آخرین بیلد Actions:</span>
                        <span className="font-bold text-stone-900 dark:text-stone-100">
                          {githubCheckResult.latestRun
                            ? `${githubCheckResult.latestRun.status} (${githubCheckResult.latestRun.conclusion || 'در حال اجرا'})`
                            : 'هنوز اجرا نشده'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-500 block">وضعیت دسترسی سایت زنده:</span>
                        <span
                          className={`font-bold ${
                            githubCheckResult.diagnosis === 'healthy'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : githubCheckResult.liveSiteReachable
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {githubCheckResult.diagnosis === 'healthy'
                            ? `سالم و آنلاین (HTTP ${githubCheckResult.liveStatusCode}) ✓`
                            : githubCheckResult.liveSiteReachable
                              ? `نیازمند اصلاح تنظیم Pages (HTTP ${githubCheckResult.liveStatusCode})`
                              : 'در انتظار فعال‌سازی یا اولین انتشار'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-500 block">شاخه پیش‌فرض / دسترسی:</span>
                        <span className="font-mono font-bold text-stone-800 dark:text-stone-200" dir="ltr">
                          {githubCheckResult.defaultBranch} ({githubCheckResult.visibility})
                        </span>
                      </div>
                    </div>

                    {githubCheckResult.diagnosisMessage && (
                      <div
                        className={`p-2.5 rounded-xl border font-semibold leading-relaxed flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          githubCheckResult.diagnosis === 'healthy'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                        }`}
                      >
                        <span>{githubCheckResult.diagnosisMessage}</span>
                        {githubCheckResult.diagnosis !== 'healthy' && (
                          <button
                            type="button"
                            onClick={handleDirectPublishGithubPages}
                            disabled={isDeployingGithub}
                            className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[10.5px] shrink-0 whitespace-nowrap"
                          >
                            ⚡ اصلاح تنظیمات و انتشار فوری
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/70 text-[11px] text-amber-950 dark:text-amber-200 space-y-1 leading-relaxed">
                  <div className="font-bold">تنظیم خودکار و جلوگیری از صفحه سفید در گیت‌هاب:</div>
                  <div>۱. فایل <code className="font-mono px-1 bg-white/80 dark:bg-stone-900 rounded">.github/workflows/deploy-pages.yml</code> با مسیر نسبی خودکار (<code className="font-mono">./</code>) و همگام‌سازی خودکار <code className="font-mono">gh-pages</code> آماده است.</div>
                  <div>۲. در گیت‌هاب، هر تغییر در قیمت‌ها، کالاها و تنظیمات از طریق <code className="font-mono">live-db.json</code> به صورت خودکار و بدون نیاز به دخالت دستی در سایت GitHub Pages منعکس می‌شود (آخرین همگام‌سازی: <span className="font-mono tabular-nums">{githubServerStatus?.liveDbSyncedAt ? new Date(githubServerStatus.liveDbSyncedAt).toLocaleTimeString('fa-IR') : 'آماده'}</span>).</div>
                </div>
              </div>
            </div>
            </div>
            )}

            {settingsSubTab !== 'voice_backups' && (
            <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                {isSettingsDirty
                  ? '⚡ تغییرات جدید ثبت نشده — با ذخیره، بلافاصله برای تمامی کاربران، ربات و گیت‌هاب منتشر می‌شود.'
                  : '✓ تنظیمات بدون تغییر جدید است (دکمه ذخیره با تغییر در بخش‌های تنظیمات فعال می‌شود).'}
              </span>
              <button
                type="submit"
                disabled={isSavingSettings || !isSettingsDirty}
                className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-700 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-400 dark:disabled:text-stone-500 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>💾</span>
                <span>
                  {isSavingSettings ? 'در حال انتشار...' : 'ذخیره و انتشار آنی تنظیمات در تلگرام و گیت‌هاب'}
                </span>
              </button>
            </div>
            )}
          </form>

          {settingsSubTab === 'voice_backups' && (
          <>
          {/* Local Full System Backups Manager (Last 3 Backups + JSON Download/Restore) */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>🗄️</span>
                  <span>پشتیبان‌گیری کامل و بازگردانی کل اطلاعات برنامه (نگهداری تا ۳ نسخه قبلی)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  شامل تمام تنظیمات، لوگو، نام و آیکون برنامه، کالاها، قیمت و موجودی، سفارشات، کاربران و اطلاعات تولید کارگاه است. همیشه تا ۳ بک‌آپ اخیر روی دستگاه آماده بازگردانی نمایش داده می‌شود.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCreateLocalBackup}
                  className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5"
                >
                  <span>💾</span>
                  <span>ایجاد و ذخیره بک‌آپ جدید</span>
                </button>
                <label className="cursor-pointer px-3.5 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 font-bold rounded-xl text-xs flex items-center gap-1.5">
                  <span>📂</span>
                  <span>بازگردانی از فایل (.json)</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleUploadBackupJson}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {backupStatusMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                ✓ {backupStatusMsg}
              </div>
            )}
            {backupErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-bold">
                ⚠️ {backupErrorMsg}
              </div>
            )}

            {localBackups.length === 0 ? (
              <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-dashed border-stone-300 dark:border-stone-700 text-center text-xs text-stone-500">
                هنوز نسخه پشتیبانی ذخیره نشده است. برای ساخت اولین بک‌آپ کامل کل برنامه، دکمه «ایجاد و ذخیره بک‌آپ جدید» را بزنید.
              </div>
            ) : (
              <div className="space-y-2.5">
                {localBackups.map((snap, idx) => (
                  <div
                    key={snap.id}
                    className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={resolveAssetOrApiUrl(snap.data?.settings?.appLogoDataUrl, 'pwa-192x192.png')}
                        alt={snap.summary.workshopName}
                        className="w-10 h-10 rounded-xl object-cover border border-stone-300 dark:border-stone-600 bg-white shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-800 text-white font-mono text-[10px] font-bold">
                            نسخه #{(idx + 1).toLocaleString('fa-IR')}
                          </span>
                          <span className="font-bold text-stone-900 dark:text-stone-100">
                            {snap.summary.workshopName}
                          </span>
                          <span className="font-mono text-[10.5px] text-stone-500">
                            {snap.createdAtFa}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-stone-500 dark:text-stone-400 mt-1 flex flex-wrap gap-2">
                          <span>تغییرات کالا: <strong className="font-mono">{snap.summary.productOverridesCount}</strong></span> ·
                          <span>سفارشات: <strong className="font-mono">{snap.summary.ordersCount}</strong></span> ·
                          <span>کاربران: <strong className="font-mono">{snap.summary.usersCount}</strong></span> ·
                          <span>تنظیمات و لوگو ✓</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      <button
                        type="button"
                        disabled={isRestoringBackup}
                        onClick={() => handleRestoreLocalBackup(snap)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-[11px] shadow-2xs"
                      >
                        ♻️ بازگردانی این نسخه
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadBackupJsonFile(snap)}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 font-bold text-[11px] hover:bg-stone-100"
                      >
                        ⬇️ دانلود فایل (.json)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLocalBackup(snap.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold text-[11px] hover:bg-rose-100"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice Studio Card (AI Studio TTS + Local Upload + Download across All Sections) */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-stone-200 dark:border-stone-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>🎙️</span>
                  <span>۶. استودیو جامع ویس صوتی (تولید Google AI Studio، دانلود و بارگذاری از سیستم مدیر)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  در تمام بخش‌ها (معرفی محصولات، نکات طلایی باغبانی و گزارش صوتی هواشناسی) می‌توانید صوت حرفه‌ای با هوش مصنوعی تولید کنید، فایل صوتی را <strong>دانلود</strong> نمایید و یا فایل ضبط‌شده را مستقیماً از سیستم خود <strong>آپلود</strong> کنید.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] shrink-0 flex-wrap">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold">
                  محصولات: {products.filter((p) => Boolean(readyVoiceClips[buildProductVoiceClipId(p.id)])).length}/{products.length}
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold">
                  نکات طلایی: {AGRICULTURAL_GOLDEN_TIPS.filter((t) => Boolean(readyVoiceClips[buildTipVoiceClipId(t.id)])).length}/{AGRICULTURAL_GOLDEN_TIPS.length}
                </span>
                <button
                  type="button"
                  disabled={isBatchDownloadingVoice}
                  onClick={handleBatchDownloadAllVoiceArchive}
                  className="px-3 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-bold shadow-xs transition-colors"
                >
                  📦 دانلود یکجای کل آرشیو (محصولات + نکات طلایی + هواشناسی)
                </button>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="text-stone-700 dark:text-stone-300">
                <span>📂 آدرس / پوشه فعلی ذخیره‌سازی فایل‌ها: </span>
                <strong className="text-emerald-800 dark:text-emerald-300">
                  {savedVoiceDirHandle
                    ? `پوشه انتخاب‌شده سیستم (${savedVoiceDirHandle.name})`
                    : customDownloadPathInput.trim() || 'پوشه Downloads مرورگر (هنگام هر دانلود پرسیده می‌شود)'}
                </strong>
              </div>
              {savedVoiceDirHandle && (
                <button
                  type="button"
                  onClick={() => setSavedVoiceDirHandle(null)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 font-bold text-[10.5px]"
                >
                  تغییر در دانلود بعدی
                </button>
              )}
            </div>

            {voiceStudioStatusMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                ✓ {voiceStudioStatusMsg}
              </div>
            )}
            {voiceStudioErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-bold">
                ⚠️ {voiceStudioErrorMsg}
              </div>
            )}

            {isBatchGeneratingVoice && batchVoiceProgress && (
              <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-sky-900 dark:text-sky-200">
                  <span>در حال تولید و ذخیره دائمی: {batchVoiceProgress.label}</span>
                  <span className="font-mono">
                    {batchVoiceProgress.current} / {batchVoiceProgress.total}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-sky-200 dark:bg-sky-900 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${Math.round((batchVoiceProgress.current / batchVoiceProgress.total) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { batchVoiceCancelRef.current = true; }}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold"
                  >
                    توقف عملیات دسته‌ای
                  </button>
                </div>
              </div>
            )}

            {/* Dedicated Weather Briefing Audio Section (AI Generate / Local Upload / Download / Live Manager Weather) */}
            <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/25 border border-sky-200 dark:border-sky-800 space-y-3 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-0.5">
                  <div className="font-bold text-sky-950 dark:text-sky-200 flex items-center gap-1.5">
                    <span>🌤️</span>
                    <span>بخش هواشناسی کشاورزی و گزارش صوتی (شناسایی خودکار از استقرار مدیریت)</span>
                  </div>
                  <div className="text-[10.5px] text-sky-800 dark:text-sky-300 font-semibold">
                    📍 استان و شهر استقرار مدیریت: {adminWeatherLocation.province} — {adminWeatherLocation.city}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowAdminLiveWeather((v) => !v)}
                    className="px-3 py-1 rounded-xl bg-white dark:bg-stone-900 border border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-200 font-bold text-[10.5px] hover:bg-sky-100"
                  >
                    {showAdminLiveWeather ? 'بستن پیش‌بینی زنده ▴' : '🌤️ مشاهده پیش‌بینی زنده شهر مدیریت ▾'}
                  </button>
                  {readyVoiceClips[buildWeatherVoiceClipId('general')] ? (
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-700 text-white text-[10px] font-bold">
                      ✓ فایل صوتی آماده پخش و دانلود
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-bold">
                      صدای ثابت آپلود نشده (پخش زنده از سرور)
                    </span>
                  )}
                </div>
              </div>

              {showAdminLiveWeather && (
                <div className="pt-1">
                  <AgriculturalWeatherWidget
                    floating={false}
                    defaultProvince={adminWeatherLocation.province}
                    defaultCity={adminWeatherLocation.city}
                    locationSourceNote={`شناسایی خودکار از استان و شهر استقرار مدیریت (${adminWeatherLocation.province} - ${adminWeatherLocation.city})`}
                  />
                </div>
              )}

              <textarea
                rows={2}
                value={weatherVoiceScript}
                onChange={(e) => setWeatherVoiceScript(e.target.value)}
                placeholder="متن گزارش صوتی اختصاصی هواشناسی و سمپاشی..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-sky-300 dark:border-sky-700 text-xs leading-relaxed"
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isGeneratingWeatherVoice}
                  onClick={handleGenerateWeatherVoice}
                  className="px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white font-bold text-xs shadow-xs"
                >
                  {isGeneratingWeatherVoice ? 'در حال تولید با AI Studio...' : '🎙️ تولید صوت هواشناسی'}
                </button>

                <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs">
                  <span>📤 آپلود فایل صوتی از سیستم مدیر</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleUploadCustomVoiceClip({
                          file,
                          clipId: buildWeatherVoiceClipId('general'),
                          kind: 'weather',
                          targetId: 'general',
                          scriptText: weatherVoiceScript.trim() || 'گزارش صوتی هواشناسی کشاورزی',
                          label: 'گزارش هواشناسی کشاورزی',
                        });
                      }
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>

                {readyVoiceClips[buildWeatherVoiceClipId('general')] && (
                  <>
                    <button
                      type="button"
                      onClick={() => playAdminVoiceClip(buildWeatherVoiceClipId('general'))}
                      className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                    >
                      {playingVoiceClipId === buildWeatherVoiceClipId('general') ? '⏹️ توقف پخش' : '▶️ پیش‌شنیدن'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadVoiceClip(
                          buildWeatherVoiceClipId('general'),
                          buildPersianVoiceDownloadName('weather', 'گزارش-هواشناسی-کشاورزی'),
                          false,
                          'هواشناسی'
                        )
                      }
                      className="px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-200 font-bold text-xs hover:bg-sky-100"
                    >
                      ⬇️ دانلود فایل صوتی
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Batch Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Products Batch */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 space-y-3">
                <div className="font-bold text-stone-900 dark:text-stone-100">
                  تولید یک‌باره معرفی صوتی محصولات کاتالوگ
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  برای هر محصول متن اختصاصی همان کالا به صوت طبیعی تبدیل شده و در پیش‌بارگذاری مشتریان ذخیره می‌شود.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isBatchGeneratingVoice}
                    onClick={() => handleBatchGenerateProductVoices(true)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-xs"
                  >
                    ⚡ تولید صدای محصولات باقی‌مانده
                  </button>
                  <button
                    type="button"
                    disabled={isBatchGeneratingVoice}
                    onClick={() => handleBatchGenerateProductVoices(false)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-bold text-xs"
                  >
                    بازتولید همه محصولات
                  </button>
                </div>
              </div>

              {/* Golden Tips Batch */}
              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/70 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-stone-900 dark:text-stone-100">
                    تولید یک‌باره صدای نکات طلایی ({AGRICULTURAL_GOLDEN_TIPS.length} نکته)
                  </span>
                  <select
                    value={voiceStudioCategory}
                    onChange={(e) => setVoiceStudioCategory(e.target.value as 'all' | TipCategory)}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 text-[11px] font-bold"
                  >
                    {TIP_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isBatchGeneratingVoice}
                    onClick={() => handleBatchGenerateTipVoices(true)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-stone-950 font-bold text-xs shadow-xs"
                  >
                    🎙️ تولید صدای نکات آماده نشده این دسته
                  </button>
                  <button
                    type="button"
                    disabled={isBatchGeneratingVoice}
                    onClick={() => handleBatchGenerateTipVoices(false)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 text-stone-700 dark:text-stone-200 font-bold text-xs"
                  >
                    بازتولید این دسته
                  </button>
                </div>
              </div>
            </div>

            {/* Individual Products Voice Manager List (Select Single / All, Download with Persian Filename, Play, Generate, Upload) */}
            <div className="pt-2 space-y-2.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 p-3 rounded-2xl bg-sky-50/70 dark:bg-sky-950/25 border border-sky-200 dark:border-sky-800/70">
                <div className="space-y-0.5">
                  <div className="text-[11.5px] font-extrabold text-stone-900 dark:text-stone-100">
                    مدیریت فایل‌های صوتی محصولات (انتخاب تکی یا کلی و دانلود با نام فارسی):
                  </div>
                  <div className="text-[10.5px] text-stone-500 dark:text-stone-400">
                    فایل‌های صوتی با نام فارسی کامل محصول (مانند <span className="font-semibold text-stone-700 dark:text-stone-200">معرفی-صوتی-نام-محصول</span>) در دستگاه شما ذخیره می‌شوند.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={readyProductVoices.length === 0 || isBatchDownloadingVoice}
                    onClick={handleToggleSelectAllProductVoices}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-bold text-[11px] hover:bg-stone-100 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={
                        readyProductVoices.length > 0 &&
                        readySelectedProductVoiceCount === readyProductVoices.length
                      }
                      className="w-3.5 h-3.5 accent-emerald-700 pointer-events-none"
                    />
                    <span>
                      {readyProductVoices.length > 0 &&
                      readySelectedProductVoiceCount === readyProductVoices.length
                        ? 'لغو انتخاب همه'
                        : `انتخاب همه فایل‌های تولیدشده (${readyProductVoices.length})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={readySelectedProductVoiceCount === 0 || isBatchDownloadingVoice}
                    onClick={() => handleBatchDownloadProductVoices('selected')}
                    className="px-3 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-bold text-[11px] shadow-xs"
                  >
                    ⬇️ دانلود انتخاب‌شده‌ها ({readySelectedProductVoiceCount})
                  </button>

                  <button
                    type="button"
                    disabled={readyProductVoices.length === 0 || isBatchDownloadingVoice}
                    onClick={() => handleBatchDownloadProductVoices('all')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[11px] shadow-xs"
                  >
                    📦 دانلود کلی همه فایل‌ها ({readyProductVoices.length})
                  </button>
                </div>
              </div>

              {isBatchDownloadingVoice && batchDownloadProgress && (
                <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-sky-900 dark:text-sky-200">
                    <span>در حال دانلود با نام فارسی: {batchDownloadProgress.label}</span>
                    <span className="font-mono tabular-nums">
                      {batchDownloadProgress.current} / {batchDownloadProgress.total}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-sky-200 dark:bg-sky-900 overflow-hidden">
                    <div
                      className="h-full bg-sky-600 transition-all duration-200"
                      style={{
                        width: `${Math.round((batchDownloadProgress.current / batchDownloadProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        batchDownloadCancelRef.current = true;
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-bold"
                    >
                      توقف دانلود گروهی
                    </button>
                  </div>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {products.map((prod) => {
                  const cid = buildProductVoiceClipId(prod.id);
                  const isReady = Boolean(readyVoiceClips[cid]);
                  const isPlaying = playingVoiceClipId === cid;
                  const isSelected = isReady && selectedProductVoiceIds.includes(prod.id);
                  const persianDownloadName = buildPersianVoiceDownloadName('product', prod.name);
                  return (
                    <div
                      key={prod.id}
                      className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border text-[11px] transition-colors ${
                        isSelected
                          ? 'bg-sky-50/80 dark:bg-sky-950/30 border-sky-300 dark:border-sky-700'
                          : 'bg-stone-50 dark:bg-stone-800/50 border-stone-200/80 dark:border-stone-700'
                      }`}
                    >
                      <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          disabled={!isReady || isBatchDownloadingVoice}
                          checked={isSelected}
                          onChange={() => toggleProductVoiceSelection(prod.id)}
                          title={isReady ? `انتخاب صوت «${prod.name}» برای دانلود` : 'ابتدا باید فایل صوتی این محصول تولید یا آپلود شود'}
                          className="w-4 h-4 accent-emerald-700 shrink-0 disabled:opacity-40 cursor-pointer"
                        />
                        <span className="font-bold text-stone-800 dark:text-stone-200 truncate">
                          {prod.name}
                        </span>
                        <span className="text-[10px] text-stone-400 shrink-0">({prod.categoryLabel})</span>
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {isReady ? (
                          <>
                            <button
                              type="button"
                              onClick={() => playAdminVoiceClip(cid)}
                              className={`px-2 py-1 rounded-lg font-bold text-[10px] ${
                                isPlaying
                                  ? 'bg-amber-400 text-stone-950'
                                  : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {isPlaying ? '⏹️ توقف' : '▶️ پخش'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDownloadVoiceClip(cid, persianDownloadName, false, 'معرفی-محصولات')
                              }
                              className="px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold text-[10px] hover:bg-sky-100"
                              title={`دانلود با نام فارسی: ${persianDownloadName}`}
                            >
                              ⬇️ دانلود
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-stone-400 px-1.5">در انتظار صوت</span>
                        )}

                        <label className="cursor-pointer px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 font-bold text-[10px] hover:bg-amber-200">
                          <span>📤 آپلود</span>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleUploadCustomVoiceClip({
                                  file,
                                  clipId: cid,
                                  kind: 'product',
                                  targetId: prod.id,
                                  scriptText: prod.voiceIntroText || buildProductSpecificVoiceScript(prod),
                                  label: prod.name,
                                });
                              }
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          disabled={isBatchGeneratingVoice}
                          onClick={() => handleGenerateSingleProductVoice(prod)}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 font-bold text-[10px] hover:bg-stone-100"
                        >
                          {isReady ? 'بازتولید' : 'تولید صدا'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Individual Golden Tips Voice Manager List (Select Single / All, Download with Install Path & Persian Filename) */}
            <div className="pt-3 space-y-2.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/70">
                <div className="space-y-0.5">
                  <div className="text-[11.5px] font-extrabold text-stone-900 dark:text-stone-100">
                    مدیریت فایل‌های صوتی نکات طلایی (انتخاب تکی یا کلی و دانلود با نام فارسی):
                  </div>
                  <div className="text-[10.5px] text-stone-500 dark:text-stone-400">
                    فایل‌های صوتی نکات طلایی با نام فارسی (مانند <span className="font-semibold text-stone-700 dark:text-stone-200">نکته-طلایی-عنوان-نکته</span>) و انتخاب مسیر نصب ذخیره می‌شوند.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={readyVisibleTipVoices.length === 0 || isBatchDownloadingVoice}
                    onClick={handleToggleSelectAllTipVoices}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 text-stone-800 dark:text-stone-200 font-bold text-[11px] hover:bg-amber-50 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={
                        readyVisibleTipVoices.length > 0 &&
                        readySelectedTipVoiceCount === readyVisibleTipVoices.length
                      }
                      className="w-3.5 h-3.5 accent-amber-600 pointer-events-none"
                    />
                    <span>
                      {readyVisibleTipVoices.length > 0 &&
                      readySelectedTipVoiceCount === readyVisibleTipVoices.length
                        ? 'لغو انتخاب همه'
                        : `انتخاب همه نکات تولیدشده (${readyVisibleTipVoices.length})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={readySelectedTipVoiceCount === 0 || isBatchDownloadingVoice}
                    onClick={() => handleBatchDownloadTipVoices('selected')}
                    className="px-3 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-bold text-[11px] shadow-xs"
                  >
                    ⬇️ دانلود انتخاب‌شده‌ها ({readySelectedTipVoiceCount})
                  </button>

                  <button
                    type="button"
                    disabled={readyVisibleTipVoices.length === 0 || isBatchDownloadingVoice}
                    onClick={() => handleBatchDownloadTipVoices('all')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-bold text-[11px] shadow-xs"
                  >
                    📦 دانلود کلی همه نکات ({readyVisibleTipVoices.length})
                  </button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {visibleTipsInVoiceStudio.map((tip) => {
                  const cid = buildTipVoiceClipId(tip.id);
                  const isReady = Boolean(readyVoiceClips[cid]);
                  const isPlaying = playingVoiceClipId === cid;
                  const isSelected = isReady && selectedTipVoiceIds.includes(tip.id);
                  const persianTipName = buildPersianVoiceDownloadName('tip', tip.title);
                  return (
                    <div
                      key={tip.id}
                      className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border text-[11px] transition-colors ${
                        isSelected
                          ? 'bg-amber-50/90 dark:bg-amber-950/35 border-amber-300 dark:border-amber-700'
                          : 'bg-stone-50 dark:bg-stone-800/50 border-stone-200/80 dark:border-stone-700'
                      }`}
                    >
                      <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          disabled={!isReady || isBatchDownloadingVoice}
                          checked={isSelected}
                          onChange={() => toggleTipVoiceSelection(tip.id)}
                          title={
                            isReady
                              ? `انتخاب صوت «${tip.title}» برای دانلود`
                              : 'ابتدا باید فایل صوتی این نکته تولید یا آپلود شود'
                          }
                          className="w-4 h-4 accent-amber-600 shrink-0 disabled:opacity-40 cursor-pointer"
                        />
                        <span>{tip.icon}</span>
                        <span className="font-bold text-stone-800 dark:text-stone-200 truncate">
                          {tip.title}
                        </span>
                        <span className="text-[10px] text-stone-400 shrink-0">({tip.categoryLabel})</span>
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {isReady ? (
                          <>
                            <button
                              type="button"
                              onClick={() => playAdminVoiceClip(cid)}
                              className={`px-2 py-1 rounded-lg font-bold text-[10px] ${
                                isPlaying
                                  ? 'bg-amber-400 text-stone-950'
                                  : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {isPlaying ? '⏹️ توقف' : '▶️ پخش'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDownloadVoiceClip(cid, persianTipName, false, 'نکات-طلایی')
                              }
                              className="px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold text-[10px] hover:bg-sky-100"
                              title={`دانلود با نام فارسی: ${persianTipName}`}
                            >
                              ⬇️ دانلود
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-stone-400 px-1.5">در انتظار تولید</span>
                        )}

                        <label className="cursor-pointer px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 font-bold text-[10px] hover:bg-amber-200">
                          <span>📤 آپلود</span>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleUploadCustomVoiceClip({
                                  file,
                                  clipId: cid,
                                  kind: 'tip',
                                  targetId: tip.id,
                                  scriptText: buildTipVoiceScript(tip),
                                  label: tip.title,
                                });
                              }
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          disabled={isBatchGeneratingVoice}
                          onClick={() => handleGenerateSingleTipVoice(tip)}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 font-bold text-[10px] hover:bg-stone-100"
                        >
                          {isReady ? 'بازتولید' : 'تولید صدا'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* ===================== TAB 6: TELEGRAM STORE BOT & MINI APP ===================== */}
      {adminTab === 'telegram' && (
        <TelegramBotManagerPanel
          settings={settings}
          productOverrides={productOverrides}
          orders={orders}
          activeProductsCount={products.filter((p) => !p.isDisabled).length}
        />
      )}
        </div>
      </div>

      {/* Modal: Order Detail & Status Management */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs text-right animate-fade-in" dir="rtl">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>📦</span>
                  <span>سفارش تاریخ {selectedOrder.orderDate}</span>
                </h3>
                <p className="text-xs text-stone-400 font-mono mt-0.5">کد سفارش: {selectedOrder.orderNumber}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Buyer Details */}
            <div className="bg-stone-50 dark:bg-stone-800/60 p-4 rounded-2xl space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-stone-400">نام خریدار:</span>{' '}
                  <span className="font-bold text-stone-800 dark:text-stone-200">{selectedOrder.customerName}</span>
                </div>
                <div>
                  <span className="text-stone-400">شماره تماس:</span>{' '}
                  <span className="font-bold font-mono text-stone-800 dark:text-stone-200" dir="ltr">{selectedOrder.phoneNumber}</span>
                </div>
                <div>
                  <span className="text-stone-400">مقصد تحویل:</span>{' '}
                  <span className="font-bold">{selectedOrder.city} ({selectedOrder.province})</span>
                </div>
                <div>
                  <span className="text-stone-400">روش حمل:</span>{' '}
                  <span className="font-bold">{selectedOrder.deliveryMethod}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-stone-200 dark:border-stone-700">
                <span className="text-stone-400">آدرس دقیق:</span>{' '}
                <span className="text-stone-700 dark:text-stone-300">{selectedOrder.deliveryAddress}</span>
              </div>
            </div>

            {/* Order Items Table */}
            <div>
              <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">اقلام سفارش:</h4>
              <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden text-xs">
                {selectedOrder.items.map(item => (
                  <div key={item.id} className="p-3 border-b last:border-b-0 border-stone-100 dark:border-stone-800 flex justify-between items-center">
                    <div>
                      <div className="font-bold">{item.product.name}</div>
                      <div className="text-[11px] text-stone-400">{item.selectedPackage.weightOrVolume}</div>
                    </div>
                    <div className="text-left font-mono">
                      <div>× {item.quantity} عدد</div>
                      <div className="font-bold text-emerald-800 dark:text-emerald-400">{item.totalPrice.toLocaleString('fa-IR')} ت</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-right text-xs font-bold text-stone-700 dark:text-stone-300 flex justify-between">
                <span>مبلغ نهایی قابل دریافت:</span>
                <span className="font-mono text-emerald-800 dark:text-emerald-400">{selectedOrder.finalPayableToman.toLocaleString('fa-IR')} تومان</span>
              </div>
            </div>

            {/* Status Change Form */}
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-3">
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">بروزرسانی وضعیت سفارش و رهگیری</h4>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                  تغییر وضعیت:
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs font-semibold"
                >
                  <option value="registered">در انتظار بررسی کارگاه</option>
                  <option value="confirmed">تایید شد و صدور پیش‌فاکتور فروش</option>
                  <option value="processing">در حال آماده‌سازی و بارگیری کیسه‌ها در کارگاه</option>
                  <option value="shipped">تحویل راننده / باربری شد (در مسیر ارسال)</option>
                  <option value="delivered">تحویل نهایی مشتری گردید ✓</option>
                  <option value="cancelled">لغو سفارش</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                  کد رهگیری بارنامه یا مشخصات راننده:
                </label>
                <input
                  type="text"
                  value={editTracking}
                  onChange={(e) => setEditTracking(e.target.value)}
                  placeholder="مثال: بارنامه ۲۳۸۱۹ - راننده آقای حسنی"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                  یادداشت داخلی مدیریت:
                </label>
                <textarea
                  value={editAdminNotes}
                  onChange={(e) => setEditAdminNotes(e.target.value)}
                  rows={2}
                  placeholder="یادداشت‌های حسابداری، شماره کارت واریزی و غیره..."
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <button
                  onClick={() => handleUpdateOrderStatus(selectedOrder.orderNumber)}
                  className="flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow transition-all"
                >
                  ذخیره تغییرات سفارش در دیتابیس
                </button>
                <button
                  onClick={() => setInvoiceToPrint(selectedOrder)}
                  className="px-4 py-2.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-bold rounded-xl text-xs hover:bg-stone-100"
                >
                  🖨️ چاپ پیش‌فاکتور
                </button>

                {confirmDeleteOrderNumber === selectedOrder.orderNumber ? (
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-xl px-2.5 py-1.5">
                    <span className="text-[11px] font-bold text-red-700 dark:text-red-300">حذف شود؟</span>
                    <button
                      onClick={() => handleDeleteOrder(selectedOrder.orderNumber)}
                      disabled={isDeletingOrder}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[11px] disabled:opacity-60"
                    >
                      {isDeletingOrder ? 'در حال حذف...' : 'بله، حذف کن'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteOrderNumber(null)}
                      disabled={isDeletingOrder}
                      className="px-2 py-1 text-stone-600 dark:text-stone-300 text-[11px] font-bold"
                    >
                      انصراف
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteOrderNumber(selectedOrder.orderNumber)}
                    className="px-3.5 py-2.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 font-bold rounded-xl text-xs hover:bg-red-100"
                  >
                    🗑️ حذف سفارش
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit / Create Product Full Details (Info, Categories, Packaging & Unit Discount, Technical Specs) */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs text-right animate-fade-in" dir="rtl">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  {isCreatingProduct ? '➕ افزودن محصول جدید به کاتالوگ' : `✏️ ویرایش کامل محصول: ${editingProduct.name}`}
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  ویرایش اطلاعات، دسته‌بندی، بسته‌بندی‌ها، نرخ واحد و درصد تخفیف، و آنالیز فنی
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingProductId(null);
                  setIsCreatingProduct(false);
                }}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Modal Section Tabs */}
            <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setEditModalTab('info')}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  editModalTab === 'info'
                    ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                ۱. اطلاعات و دسته‌بندی
              </button>
              <button
                type="button"
                onClick={() => setEditModalTab('packaging')}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  editModalTab === 'packaging'
                    ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                ۲. بسته‌بندی و نرخ واحد ({modalPackaging.length})
              </button>
              <button
                type="button"
                onClick={() => setEditModalTab('specs')}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  editModalTab === 'specs'
                    ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                ۳. آنالیز فنی و ویژگی‌ها ({modalSpecs.length})
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* TAB 1: IMAGE STUDIO, BASIC INFO, CATEGORY, VISIBILITY & STOCK */}
              {editModalTab === 'info' && (
                <div className="space-y-3.5">
                  {/* Product Photo Preview + Upload + AI Studio Editor */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                          <span>🖼️</span>
                          <span>تصویر کاتالوگ محصول (آپلود یا ویرایش با هوش مصنوعی)</span>
                        </h4>
                        <p className="text-[10px] text-emerald-800 dark:text-emerald-400 mt-0.5">
                          می‌توانید عکس دلخواه را آپلود کنید یا با هوش مصنوعی تصویر فعلی را ارتقا داده و یا تصویر جدید بسازید.
                        </p>
                      </div>
                      {modalProdImageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setModalProdImageUrl('');
                            setAiImageError(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-[10px] font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 shrink-0"
                        >
                          ↺ بازنشانی به عکس پیش‌فرض
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                      {/* 4:3 Image Preview */}
                      <div className="sm:col-span-5">
                        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-stone-900 shadow-xs">
                          <img
                            src={
                              modalProdImageUrl.trim() ||
                              getProductImageSrc({
                                id: editingProductId || 'prod-vermicompost-grade-a',
                                category: modalProdCategory,
                                imageUrl: '',
                              })
                            }
                            alt={modalProdName || 'تصویر محصول'}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          {isProcessingAiImage && (
                            <div className="absolute inset-0 bg-stone-950/65 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-1.5">
                              <span className="text-xl animate-spin">✨</span>
                              <span className="text-[10px] font-bold">در حال پردازش هوشمند...</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Upload & AI Controls */}
                      <div className="sm:col-span-7 space-y-2.5">
                        <label className="w-full cursor-pointer px-3 py-2 rounded-xl bg-white dark:bg-stone-900 hover:bg-stone-50 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-bold text-[11px] flex items-center justify-center gap-2 transition-colors shadow-2xs">
                          <span>📤</span>
                          <span>آپلود تصویر از گالری یا کامپیوتر</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProductImageUpload}
                            className="hidden"
                          />
                        </label>

                        <div className="space-y-1.5 pt-1 border-t border-emerald-200/70 dark:border-emerald-800/60">
                          <label className="block text-[10px] font-bold text-emerald-900 dark:text-emerald-300">
                            دستور ویرایش یا طراحی تصویر به هوش مصنوعی:
                          </label>
                          <input
                            type="text"
                            value={aiImagePrompt}
                            onChange={(e) => setAiImagePrompt(e.target.value)}
                            placeholder="مثال: نور استودیویی گرم + برچسب درجه ۱ صادراتی صفری"
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-[11px]"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={handleAiEnhanceProductImage}
                              disabled={isProcessingAiImage}
                              className="px-2.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-[10.5px] flex items-center justify-center gap-1 shadow-2xs"
                            >
                              <span>✨</span>
                              <span>ویرایش و بهبود با هوش مصنوعی</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleAiGenerateProductImage}
                              disabled={isProcessingAiImage}
                              className="px-2.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-stone-950 font-bold text-[10.5px] flex items-center justify-center gap-1 shadow-2xs"
                            >
                              <span>🎨</span>
                              <span>طراحی تصویر جدید با AI</span>
                            </button>
                          </div>
                          {aiImageError && (
                            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[10px] text-red-700 dark:text-red-300 font-bold">
                              ⚠️ {aiImageError}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      نام کامل محصول
                    </label>
                    <input
                      type="text"
                      value={modalProdName}
                      onChange={(e) => setModalProdName(e.target.value)}
                      placeholder="مثال: ورمیکمپوست درجه ۱ صادراتی..."
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                        گروه / کلید دسته‌بندی کاتالوگ
                      </label>
                      <select
                        value={STANDARD_CATEGORIES.some(c => c.id === modalProdCategory) ? modalProdCategory : 'custom'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'custom') {
                            setModalProdCategory(`cat-${Date.now()}`);
                          } else {
                            setModalProdCategory(val);
                            const found = STANDARD_CATEGORIES.find(c => c.id === val);
                            if (found) {
                              setModalProdCategoryLabel(found.label.split('(')[0].trim());
                            }
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                      >
                        {STANDARD_CATEGORIES.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                        <option value="custom">دسته‌بندی سفارشی جدید...</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                        عنوان نمایشی دسته‌بندی در کاتالوگ
                      </label>
                      <input
                        type="text"
                        value={modalProdCategoryLabel}
                        onChange={(e) => setModalProdCategoryLabel(e.target.value)}
                        placeholder="مثال: بیوکود تخصصی / کود تقویتی"
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                        نشان ویژه (Badge) بالای کارت
                      </label>
                      <input
                        type="text"
                        value={modalProdBadge}
                        onChange={(e) => setModalProdBadge(e.target.value)}
                        placeholder="مثال: محصول ویژه کارگاه / پرفروش"
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                        زمان تحویل و ارسال
                      </label>
                      <input
                        type="text"
                        value={modalProdDeliveryDays}
                        onChange={(e) => setModalProdDeliveryDays(e.target.value)}
                        placeholder="۱ الی ۳ روز کاری"
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      شعار و معرفی کوتاه
                    </label>
                    <input
                      type="text"
                      value={modalProdTagline}
                      onChange={(e) => setModalProdTagline(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      توضیحات کامل محصول (نمایش در پنجره مشخصات و آنالیز)
                    </label>
                    <textarea
                      rows={3}
                      value={modalProdDescription}
                      onChange={(e) => setModalProdDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 leading-relaxed"
                    />
                  </div>

                  {/* Product-Specific Voice Intro Text + Pre-Generate / Upload Audio */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/70 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                        <span>🎙️</span>
                        <span>متن و صدای اختصاصی «معرفی محصول» برای مشتریان</span>
                      </div>
                      {editingProductId && readyVoiceClips[buildProductVoiceClipId(editingProductId)] ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-700 text-white font-bold">
                          ✓ فایل صوتی آماده پخش آنی
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                          فایل صوتی هنوز تولید نشده
                        </span>
                      )}
                    </div>

                    <textarea
                      rows={3}
                      value={modalProdVoiceText}
                      onChange={(e) => setModalProdVoiceText(e.target.value)}
                      placeholder="متن معرفی اختصاصی همین محصول را اینجا بنویسید یا دکمه پیشنهاد هوشمند را بزنید..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-700 leading-relaxed text-xs"
                    />

                    {productVoiceMessage && (
                      <div className="p-2 rounded-xl bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 text-[11px] font-bold">
                        {productVoiceMessage}
                      </div>
                    )}
                    {productVoiceError && (
                      <div className="p-2 rounded-xl bg-rose-100/80 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 text-[11px] font-bold">
                        ⚠️ {productVoiceError}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isGeneratingProductScript}
                        onClick={handleSuggestProductVoiceScript}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-bold text-[11px] hover:bg-stone-100"
                      >
                        {isGeneratingProductScript ? 'در حال نگارش...' : '✨ پیشنهاد متن اختصاصی با هوش مصنوعی'}
                      </button>

                      <button
                        type="button"
                        disabled={isGeneratingProductVoice}
                        onClick={handleGenerateAndSaveProductVoice}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-[11px] shadow-xs"
                      >
                        {isGeneratingProductVoice ? 'در حال تولید و ذخیره صدا...' : '🎙️ تولید و ذخیره صدا برای پخش آنی'}
                      </button>

                      <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-[11px]">
                        <span>📤 آپلود فایل صوتی (MP3)</span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleUploadProductVoiceAudio}
                          className="hidden"
                        />
                      </label>

                      {editingProductId && readyVoiceClips[buildProductVoiceClipId(editingProductId)] && (
                        <>
                          <button
                            type="button"
                            onClick={() => playAdminVoiceClip(buildProductVoiceClipId(editingProductId))}
                            className="px-3 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-bold text-[11px]"
                          >
                            {playingVoiceClipId === buildProductVoiceClipId(editingProductId) ? '⏹️ توقف پخش' : '▶️ پیش‌شنیدن صدا'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDownloadVoiceClip(
                                buildProductVoiceClipId(editingProductId),
                                buildPersianVoiceDownloadName('product', modalProdName || editingProduct?.name),
                                true,
                                'معرفی-محصولات'
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300 font-bold text-[11px] hover:bg-sky-50"
                          >
                            ⬇️ دانلود فایل صوتی با نام فارسی
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div>
                      <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                        نمایش در فروشگاه
                      </label>
                      <select
                        value={modalProdIsDisabled ? 'disabled' : 'active'}
                        onChange={(e) => setModalProdIsDisabled(e.target.value === 'disabled')}
                        className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-bold"
                      >
                        <option value="active">فعال (نمایش به مشتری)</option>
                        <option value="disabled">غیرفعال (مخفی برای مشتری)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                        وضعیت موجودی
                      </label>
                      <select
                        value={modalProdInStock ? 'true' : 'false'}
                        onChange={(e) => setModalProdInStock(e.target.value === 'true')}
                        className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                      >
                        <option value="true">موجود در انبار ✓</option>
                        <option value="false">اتمام موجودی ✕</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                        تعداد موجود
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        dir="ltr"
                        value={modalProdStockQty}
                        onChange={(e) => {
                          const cleaned = normalizeDigits(e.target.value).replace(/[^\d]/g, '');
                          setModalProdStockQty(cleaned === '' ? 0 : parseInt(cleaned, 10));
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                        واحد انبارداری
                      </label>
                      <input
                        type="text"
                        value={modalProdStockUnit}
                        onChange={(e) => setModalProdStockUnit(e.target.value)}
                        placeholder="کیسه / تن / گالن"
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PACKAGING TITLES, UNIT-PRICE BASE, NEW PACKAGE & AUTO DISCOUNT % */}
              {editModalTab === 'packaging' && (
                <div className="space-y-3">
                  {/* Base Unit Price Panel */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="font-bold text-emerald-900 dark:text-emerald-200">
                          نرخ پایه هر واحد (مبنای محاسبه خودکار تخفیف بسته‌بندی‌ها)
                        </div>
                        <p className="text-[10px] text-emerald-800 dark:text-emerald-400 mt-0.5">
                          با وارد کردن قیمت فروش بسته یا درصد تخفیف، قیمت واحد واقعی و درصد تخفیف هر بسته به صورت خودکار محاسبه می‌شود.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRecalcAllPackagesFromUnitPrice}
                        className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-xs"
                      >
                        🔄 بروزرسانی نرخ بسته‌ها با قیمت واحد
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-900 dark:text-emerald-300 mb-1">
                          قیمت پایه هر واحد (تومان)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          value={modalBaseUnitPrice}
                          onChange={(e) => {
                            const cleaned = normalizeDigits(e.target.value).replace(/[^\d]/g, '');
                            const val = cleaned === '' ? 0 : parseInt(cleaned, 10);
                            setModalBaseUnitPrice(val);
                            setModalPackaging((prev) =>
                              prev.map((p) => syncPackageMetricsFromPrice(p, p.priceToman, val))
                            );
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-700 font-mono font-bold text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-900 dark:text-emerald-300 mb-1">
                          نام واحد پایه (کیلوگرم / لیتر / عدد)
                        </label>
                        <input
                          type="text"
                          value={modalBaseUnitLabel}
                          onChange={(e) => setModalBaseUnitLabel(e.target.value)}
                          placeholder="کیلوگرم"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-700 font-bold text-center"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <h4 className="font-bold text-stone-700 dark:text-stone-300">
                      لیست بسته‌بندی‌ها و نرخ‌ها ({modalPackaging.length} مورد):
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultWeight = 10;
                        const refPrice = modalBaseUnitPrice > 0 ? modalBaseUnitPrice * defaultWeight : 240000;
                        setModalPackaging((prev) => [
                          ...prev,
                          {
                            id: `pkg-${Date.now()}`,
                            title: `بسته ${defaultWeight} ${modalBaseUnitLabel || 'کیلوگرم'} جدید`,
                            weightOrVolume: `${defaultWeight} ${modalBaseUnitLabel || 'کیلوگرم'}`,
                            nominalWeightKg: defaultWeight,
                            priceToman: refPrice,
                            originalPriceToman: refPrice,
                            discountToman: 0,
                            discountPercent: 0,
                          },
                        ]);
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-xl text-[11px] shadow-xs flex items-center gap-1"
                    >
                      <span>➕</span>
                      <span>افزودن بسته‌بندی و نرخ جدید</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {modalPackaging.map((pkg, idx) => {
                      const expectedRef =
                        modalBaseUnitPrice > 0 && pkg.nominalWeightKg > 0
                          ? Math.round(modalBaseUnitPrice * pkg.nominalWeightKg)
                          : pkg.originalPriceToman || pkg.priceToman;
                      const effectiveUnitRate =
                        pkg.nominalWeightKg > 0 ? Math.round(pkg.priceToman / pkg.nominalWeightKg) : 0;
                      const calcDiscToman = expectedRef > pkg.priceToman ? expectedRef - pkg.priceToman : (pkg.discountToman || 0);
                      const calcDiscPct =
                        expectedRef > pkg.priceToman
                          ? Math.round(((expectedRef - pkg.priceToman) / expectedRef) * 1000) / 10
                          : pkg.discountPercent || 0;
                      const pkgOut = Boolean(pkg.isOutOfStock);

                      return (
                        <div
                          key={pkg.id}
                          className={`p-3.5 rounded-2xl border space-y-2.5 transition-colors ${
                            pkgOut
                              ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                              : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
                                بسته / نرخ #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...modalPackaging];
                                  updated[idx] = { ...updated[idx], isOutOfStock: !pkgOut };
                                  setModalPackaging(updated);
                                }}
                                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                                  pkgOut
                                    ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                                    : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200'
                                }`}
                              >
                                {pkgOut ? '✕ عدم موجودی (ناموجود)' : '✓ موجود در این نرخ'}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1 text-[10px] font-bold text-stone-600 dark:text-stone-300 cursor-pointer">
                                <input
                                  type="radio"
                                  name="popularPkg"
                                  checked={Boolean(pkg.isPopular)}
                                  onChange={() => {
                                    setModalPackaging((prev) =>
                                      prev.map((item, i) => ({ ...item, isPopular: i === idx }))
                                    );
                                  }}
                                  className="accent-emerald-700"
                                />
                                <span>پیش‌فرض / محبوب</span>
                              </label>
                              {modalPackaging.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setModalPackaging((prev) => prev.filter((_, i) => i !== idx))}
                                  className="px-2 py-0.5 bg-red-50 text-red-700 rounded-lg text-[10px] font-bold border border-red-200 hover:bg-red-100"
                                >
                                  حذف بسته
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-stone-500 mb-0.5">
                                عنوان کامل بسته‌بندی
                              </label>
                              <input
                                type="text"
                                value={pkg.title}
                                onChange={(e) => {
                                  const updated = [...modalPackaging];
                                  updated[idx] = { ...updated[idx], title: e.target.value };
                                  setModalPackaging(updated);
                                }}
                                placeholder="مثال: کیسه ۲۵ کیلوگرمی لمینت"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-500 mb-0.5">
                                برچسب وزن / حجم نمایشی
                              </label>
                              <input
                                type="text"
                                value={pkg.weightOrVolume}
                                onChange={(e) => {
                                  const updated = [...modalPackaging];
                                  updated[idx] = { ...updated[idx], weightOrVolume: e.target.value };
                                  setModalPackaging(updated);
                                }}
                                placeholder="۲۵ کیلوگرم"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                            <div>
                              <label className="block text-[10px] text-stone-500 mb-0.5">
                                مقدار عددی ({modalBaseUnitLabel})
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                dir="ltr"
                                value={pkg.nominalWeightKg}
                                onChange={(e) => {
                                  const cleaned = normalizeDigits(e.target.value).replace(/[^\d.]/g, '');
                                  const num = cleaned === '' ? 0 : parseFloat(cleaned);
                                  const validNum = Number.isFinite(num) ? num : 0;
                                  const updated = [...modalPackaging];
                                  const nextPkg = { ...updated[idx], nominalWeightKg: validNum };
                                  updated[idx] = syncPackageMetricsFromPrice(nextPkg, nextPkg.priceToman, modalBaseUnitPrice);
                                  setModalPackaging(updated);
                                }}
                                onFocus={(e) => e.target.select()}
                                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs font-mono text-center"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-stone-500 mb-0.5">
                                قیمت فروش بسته (تومان)
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                dir="ltr"
                                value={pkg.priceToman}
                                onChange={(e) => {
                                  const cleaned = normalizeDigits(e.target.value).replace(/[^\d]/g, '');
                                  const newPrice = cleaned === '' ? 0 : parseInt(cleaned, 10);
                                  const updated = [...modalPackaging];
                                  updated[idx] = syncPackageMetricsFromPrice(updated[idx], newPrice, modalBaseUnitPrice);
                                  setModalPackaging(updated);
                                }}
                                onFocus={(e) => e.target.select()}
                                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-emerald-400 dark:border-emerald-700 text-xs font-mono font-bold text-center"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-stone-500 mb-0.5">
                                درصد تخفیف (%)
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                dir="ltr"
                                value={calcDiscPct}
                                onChange={(e) => {
                                  const cleaned = normalizeDigits(e.target.value).replace(/[^\d.]/g, '');
                                  const pct = cleaned === '' ? 0 : parseFloat(cleaned);
                                  const updated = [...modalPackaging];
                                  updated[idx] = syncPackageMetricsFromDiscountPct(
                                    updated[idx],
                                    Number.isFinite(pct) ? pct : 0,
                                    modalBaseUnitPrice
                                  );
                                  setModalPackaging(updated);
                                }}
                                onFocus={(e) => e.target.select()}
                                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 text-xs font-mono font-bold text-center text-amber-700 dark:text-amber-400"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-stone-500 mb-0.5">
                                نشان بسته (Badge)
                              </label>
                              <input
                                type="text"
                                value={pkg.badge || ''}
                                onChange={(e) => {
                                  const updated = [...modalPackaging];
                                  updated[idx] = { ...updated[idx], badge: e.target.value };
                                  setModalPackaging(updated);
                                }}
                                placeholder="پرفروش / تخفیف ویژه"
                                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                              />
                            </div>
                          </div>

                          {/* Live unit price & discount summary */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200 dark:border-stone-700 text-[10px]">
                            <div className="flex items-center gap-3 text-stone-600 dark:text-stone-300">
                              <span>
                                قیمت مرجع واحد: <strong className="font-mono">{expectedRef.toLocaleString('fa-IR')} ت</strong>
                              </span>
                              {effectiveUnitRate > 0 && (
                                <span className="text-emerald-800 dark:text-emerald-400">
                                  فی هر {modalBaseUnitLabel}: <strong className="font-mono">{effectiveUnitRate.toLocaleString('fa-IR')} ت</strong>
                                </span>
                              )}
                            </div>
                            {calcDiscToman > 0 ? (
                              <span className="font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded font-mono">
                                تخفیف: {calcDiscToman.toLocaleString('fa-IR')} ت ({calcDiscPct}٪)
                              </span>
                            ) : (
                              <span className="text-stone-400">بدون تخفیف (نرخ استاندارد واحد)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: TECHNICAL SPECS & HIGHLIGHTS EDITOR */}
              {editModalTab === 'specs' && (
                <div className="space-y-4">
                  {/* Technical Analysis Specs */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-stone-800 dark:text-stone-200">
                          جدول آنالیز آزمایشگاهی و مشخصات فنی محصول
                        </h4>
                        <p className="text-[10px] text-stone-500">
                          این مقادیر مستقیماً در بخش «آنالیز فنی» برنامه مشتریان نمایش داده می‌شوند.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalSpecs((prev) => [...prev, { label: '', value: '' }])}
                        className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold"
                      >
                        ➕ افزودن ردیف آنالیز
                      </button>
                    </div>

                    {modalSpecs.length === 0 ? (
                      <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800 text-center text-stone-400 text-xs">
                        هنوز ردیف آنالیز فنی ثبت نشده است.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {modalSpecs.map((spec, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-stone-50 dark:bg-stone-800/60 p-2 rounded-xl border border-stone-200 dark:border-stone-700">
                            <input
                              type="text"
                              value={spec.label}
                              onChange={(e) => {
                                const next = [...modalSpecs];
                                next[idx] = { ...next[idx], label: e.target.value };
                                setModalSpecs(next);
                              }}
                              placeholder="عنوان شاخص (مثلاً pH یا اسید هیومیک)"
                              className="col-span-5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs font-bold"
                            />
                            <input
                              type="text"
                              value={spec.value}
                              onChange={(e) => {
                                const next = [...modalSpecs];
                                next[idx] = { ...next[idx], value: e.target.value };
                                setModalSpecs(next);
                              }}
                              placeholder="مقدار / نتیجه آزمایش"
                              className="col-span-6 px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setModalSpecs((prev) => prev.filter((_, i) => i !== idx))}
                              className="col-span-1 py-1.5 text-red-600 hover:bg-red-50 rounded-lg font-bold text-center"
                              title="حذف ردیف"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Product Highlights */}
                  <div className="space-y-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-stone-800 dark:text-stone-200">
                        ویژگی‌های کلیدی و مزایای محصول
                      </h4>
                      <button
                        type="button"
                        onClick={() => setModalHighlights((prev) => [...prev, ''])}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl text-[11px] font-bold"
                      >
                        ➕ افزودن ویژگی
                      </button>
                    </div>

                    <div className="space-y-2">
                      {modalHighlights.map((hl, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <input
                            type="text"
                            value={hl}
                            onChange={(e) => {
                              const next = [...modalHighlights];
                              next[idx] = e.target.value;
                              setModalHighlights(next);
                            }}
                            placeholder="مزیت یا ویژگی کلیدی محصول..."
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setModalHighlights((prev) => prev.filter((_, i) => i !== idx))}
                            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  onClick={handleSaveProductEdit}
                  className="flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow transition-all"
                >
                  {isCreatingProduct ? 'ثبت محصول جدید در پیش‌نویس سیستم' : 'ذخیره تغییرات در پیش‌نویس سیستم'}
                </button>
                <button
                  onClick={() => {
                    setEditingProductId(null);
                    setIsCreatingProduct(false);
                  }}
                  className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold rounded-xl text-xs hover:bg-stone-200"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Proforma Invoice Print Modal */}
      {invoiceToPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs text-right animate-fade-in printable-modal-backdrop" dir="rtl">
          <div className="bg-white text-stone-900 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-8 shadow-2xl border border-stone-200 relative printable-invoice-sheet">
            <button
              onClick={() => setInvoiceToPrint(null)}
              className="absolute left-6 top-6 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 no-print"
            >
              ✕
            </button>

            {/* Invoice Header */}
            <div className="border-b-2 border-stone-900 pb-4 mb-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <img
                  src={resolveAssetOrApiUrl(settings.appLogoDataUrl, 'pwa-192x192.png')}
                  alt={settings.workshopName}
                  className="w-12 h-12 rounded-xl object-cover border border-stone-300 shrink-0"
                />
                <div>
                  <span className="text-xs font-bold text-emerald-800">پیش‌فاکتور فروش و بارگیری</span>
                  <h2 className="text-base font-bold mt-1">{settings.workshopName}</h2>
                  <p className="text-[11px] text-stone-500">
                    {settings.invoiceFooterNote || 'شماره استاندارد ملی ISIRI 13724 · پروانه بهره‌برداری جهاد کشاورزی'}
                  </p>
                </div>
              </div>
              <div className="text-left font-mono text-xs shrink-0">
                <div className="font-sans font-bold text-stone-900">عنوان: سفارش تاریخ {invoiceToPrint.orderDate}</div>
                <div className="mt-0.5">شماره پیگیری: <strong>{invoiceToPrint.orderNumber}</strong></div>
              </div>
            </div>

            {/* Buyer & Delivery Info */}
            <div className="grid grid-cols-2 gap-4 bg-stone-50 p-4 rounded-xl text-xs mb-4">
              <div>
                <div><strong>نام خریدار:</strong> {invoiceToPrint.customerName}</div>
                <div className="mt-1"><strong>شماره تماس:</strong> <span className="font-mono">{invoiceToPrint.phoneNumber}</span></div>
                <div className="mt-1"><strong>مقصد:</strong> {invoiceToPrint.province} - {invoiceToPrint.city}</div>
              </div>
              <div>
                <div><strong>روش حمل:</strong> {invoiceToPrint.deliveryMethod}</div>
                <div className="mt-1"><strong>کد رهگیری:</strong> {invoiceToPrint.trackingNumber || 'در حال بارگیری'}</div>
                <div className="mt-1"><strong>آدرس تخلیه:</strong> {invoiceToPrint.deliveryAddress}</div>
              </div>
            </div>

            {/* Invoice Table */}
            <table className="w-full text-xs text-right border-collapse mb-4">
              <thead>
                <tr className="border-b border-stone-300 bg-stone-100 font-bold">
                  <th className="p-2">ردیف</th>
                  <th className="p-2">شرح کالا</th>
                  <th className="p-2">بسته‌بندی</th>
                  <th className="p-2 text-center">تعداد</th>
                  <th className="p-2 text-left">قیمت واحد (تومان)</th>
                  <th className="p-2 text-left">مبلغ کل (تومان)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {invoiceToPrint.items.map((it, idx) => (
                  <tr key={it.id}>
                    <td className="p-2">{idx + 1}</td>
                    <td className="p-2 font-bold">{it.product.name}</td>
                    <td className="p-2">{it.selectedPackage.weightOrVolume}</td>
                    <td className="p-2 text-center font-mono">{it.quantity}</td>
                    <td className="p-2 text-left font-mono">{it.unitPrice.toLocaleString('fa-IR')}</td>
                    <td className="p-2 text-left font-mono font-bold">{it.totalPrice.toLocaleString('fa-IR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-6">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span>جمع اقلام:</span>
                  <span className="font-mono">{invoiceToPrint.subtotalToman.toLocaleString('fa-IR')} ت</span>
                </div>
                {invoiceToPrint.discountToman > 0 && (
                  <div className="flex justify-between text-amber-800">
                    <span>تخفیف همکاری:</span>
                    <span className="font-mono">- {invoiceToPrint.discountToman.toLocaleString('fa-IR')} ت</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>هزینه حمل و باربری (قیمت تخمینی):</span>
                  <span className="font-mono">{invoiceToPrint.shippingEstimateToman.toLocaleString('fa-IR')} ت</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-2 border-t border-stone-800 text-emerald-900">
                  <span>مبلغ قابل پرداخت:</span>
                  <span className="font-mono">{invoiceToPrint.finalPayableToman.toLocaleString('fa-IR')} تومان</span>
                </div>
              </div>
            </div>

            {/* Signatures & Store Logo Seal */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-stone-200 text-xs text-center items-center">
              <div className="flex flex-col items-center">
                <p className="font-bold mb-2">مهر معتبر فروشگاه و امور مالی</p>
                {(settings.enableInvoiceSeal ?? true) ? (
                  <StoreSealBadge
                    settings={settings}
                    appLogoSrc={resolveAssetOrApiUrl(settings.appLogoDataUrl, 'pwa-192x192.png')}
                    size="lg"
                  />
                ) : (
                  <div className="h-20 flex items-center justify-center text-stone-400 font-serif">
                    {settings.workshopName}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <p className="font-bold">
                  تاییدیه مدیریت: {settings.managerFullName || 'مهندس صفری / وفایی'}
                </p>
                {settings.managerTitle && (
                  <p className="text-[11px] text-stone-500">{settings.managerTitle}</p>
                )}
                {settings.managerPhone && (
                  <p className="text-[10px] font-mono text-stone-500" dir="ltr">
                    {settings.managerPhone}
                  </p>
                )}
                {settings.managerAddress && (
                  <p className="text-[10px] text-stone-500 leading-relaxed">
                    📍 دفتر مدیریت: {settings.managerAddress}
                  </p>
                )}
                <div className="pt-2 text-emerald-800 font-bold">
                  تایید و آماده بارگیری ✓
                </div>
                {settings.managerBioNote && (
                  <p className="text-[10px] text-stone-500 leading-relaxed">
                    {settings.managerBioNote}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow flex items-center gap-1.5"
              >
                <span>🖨️</span>
                <span>پرینت پیش‌فاکتور فروش</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install / Destination Save Path Modal for Single & Bulk Voice Downloads */}
      {pendingDownloadRequest && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs text-right animate-fade-in no-print"
          dir="rtl"
        >
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-lg w-full p-6 border border-stone-200 dark:border-stone-700 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>📂</span>
                  <span>تعیین آدرس نصب و مسیر ذخیره‌سازی فایل‌های صوتی</span>
                </h3>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                  {pendingDownloadRequest.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingDownloadRequest(null);
                  setDownloadPathModalNotice(null);
                }}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 flex items-center justify-center text-xs shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 p-3 space-y-1.5 text-[11px]">
              <div className="font-bold text-stone-700 dark:text-stone-300">
                پیش‌نمایش نام فارسی فایل‌ها ({pendingDownloadRequest.items.length} فایل):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pendingDownloadRequest.items.slice(0, 4).map((it) => (
                  <span
                    key={it.clipId}
                    className="px-2 py-0.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 truncate max-w-[200px]"
                  >
                    {it.fileBaseName}.mp3
                  </span>
                ))}
                {pendingDownloadRequest.items.length > 4 && (
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                    + {pendingDownloadRequest.items.length - 4} فایل دیگر
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  عنوان پوشه / برچسب مسیر دلخواه برای دسته‌بندی دانلود:
                </label>
                <input
                  type="text"
                  value={customDownloadPathInput}
                  onChange={(e) => setCustomDownloadPathInput(e.target.value)}
                  placeholder="مثلاً: صوت-کارگاه-صفری"
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs font-semibold"
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  در صورت دانلود استاندارد از مرورگر، این عنوان به‌همراه دسته‌بندی فایل در نام نهایی درج می‌شود تا پوشه دانلودهای شما مرتب بماند.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={organizeByCategoryFolders}
                  onChange={(e) => setOrganizeByCategoryFolders(e.target.checked)}
                  className="w-4 h-4 accent-emerald-700"
                />
                <span>تفکیک منظم بر اساس بخش (معرفی-محصولات / نکات-طلایی / هواشناسی)</span>
              </label>
            </div>

            {downloadPathModalNotice && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-semibold">
                ⓘ {downloadPathModalNotice}
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              {savedVoiceDirHandle && (
                <button
                  type="button"
                  onClick={() => executePendingVoiceDownloads('directory_handle')}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold text-xs shadow flex items-center justify-center gap-2"
                >
                  <span>💾</span>
                  <span>ذخیره مستقیم در پوشه انتخاب‌شده: «{savedVoiceDirHandle.name}»</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => executePendingVoiceDownloads('pick_directory')}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2"
              >
                <span>📂</span>
                <span>
                  {savedVoiceDirHandle
                    ? 'تغییر آدرس نصب و انتخاب پوشه جدید روی سیستم'
                    : 'انتخاب پوشه مقصد روی سیستم (تعیین آدرس نصب)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => executePendingVoiceDownloads('browser_downloads')}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100 font-bold text-xs border border-stone-300 dark:border-stone-600 flex items-center justify-center gap-2"
              >
                <span>⬇️</span>
                <span>دانلود مستقیم در پوشه پیش‌فرض مرورگر (Downloads)</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
