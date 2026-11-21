import {
  BatchConfig,
  BioassayChecklist,
  FeedingCycleLog,
  LabSignatories,
  WorkshopAppState,
} from '../types/vermicompost';
import {
  DEFAULT_BATCH_CONFIG,
  DEFAULT_SIGNATORIES,
  DEFAULT_RAW_MATERIALS,
  DEFAULT_PERSONNEL,
  getCurrentPersianDate,
} from '../data/vermicompostData';

// Local cache key backed by Telegram Cloud DB
const STORAGE_KEY = 'safari_biotech_os_v4';
const WORKSHOP_WRITE_TS_KEY = 'safari_workshop_write_ts_v4';

export const DEFAULT_FEEDING_CYCLES = (feedKg: number): FeedingCycleLog[] => [
  { cycleNumber: 1, targetDay: 1, feedKg, layerThicknessCm: 6, isApplied: true, textureChecked: true, dateApplied: 'روز ۱' },
  { cycleNumber: 2, targetDay: 12, feedKg, layerThicknessCm: 6, isApplied: true, textureChecked: true, dateApplied: 'روز ۱۲' },
  { cycleNumber: 3, targetDay: 23, feedKg, layerThicknessCm: 6, isApplied: false, textureChecked: false },
  { cycleNumber: 4, targetDay: 35, feedKg, layerThicknessCm: 6, isApplied: false, textureChecked: false },
  { cycleNumber: 5, targetDay: 47, feedKg, layerThicknessCm: 6, isApplied: false, textureChecked: false },
  { cycleNumber: 6, targetDay: 59, feedKg, layerThicknessCm: 6, isApplied: false, textureChecked: false },
];

export const DEFAULT_CHECKLIST: BioassayChecklist = {
  tempBelow25: true,
  odorClean: true,
  moistureTested: true,
  wormBioassay24h: true,
  operatorNotes: 'توده کاملاً یکدست است و هیچ گرمایی حس نمی‌شود.',
  signedBy: 'مسعود رادمهر',
  isApproved: false,
};

export function normalizeWorkshopState(raw: Partial<WorkshopAppState> | null | undefined): WorkshopAppState {
  const parsed = raw || {};
  const signatories = { ...DEFAULT_SIGNATORIES, ...(parsed.signatories || {}) };
  if (!signatories.workshopName || signatories.workshopName.includes('پارس')) {
    signatories.workshopName = 'گروه تولیدی و زیست فناوری مهندس صفری';
  }

  return {
    config: {
      ...DEFAULT_BATCH_CONFIG,
      startDate: parsed.config?.startDate || getCurrentPersianDate(),
      ...(parsed.config || {}),
      rawMaterials:
        parsed.config?.rawMaterials && parsed.config.rawMaterials.length > 0
          ? parsed.config.rawMaterials
          : DEFAULT_RAW_MATERIALS,
      personnelList:
        parsed.config?.personnelList && parsed.config.personnelList.length > 0
          ? parsed.config.personnelList
          : DEFAULT_PERSONNEL,
    },
    checklist: { ...DEFAULT_CHECKLIST, ...(parsed.checklist || {}) },
    cycles:
      Array.isArray(parsed.cycles) && parsed.cycles.length > 0
        ? parsed.cycles
        : DEFAULT_FEEDING_CYCLES(Math.round(2400 / 6)),
    signatories,
    lastUpdated: parsed.lastUpdated || new Date().toISOString(),
  };
}

export function loadWorkshopData(): WorkshopAppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeWorkshopState(JSON.parse(raw));
    }
  } catch (err) {
    console.warn('Could not load workshop state from localStorage:', err);
  }

  return normalizeWorkshopState(null);
}

export function saveWorkshopData(state: WorkshopAppState): boolean {
  try {
    const payload = {
      ...state,
      lastUpdated: state.lastUpdated || new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('Failed to save workshop state to localStorage:', err);
    return false;
  }
}

export function getLastWorkshopWriteMs(): number {
  try {
    return Number(localStorage.getItem(WORKSHOP_WRITE_TS_KEY) || '0') || 0;
  } catch {
    return 0;
  }
}

export function setLastWorkshopWriteMs(ts: number): void {
  try {
    localStorage.setItem(WORKSHOP_WRITE_TS_KEY, String(ts));
  } catch {
    // ignore
  }
}

export function exportWorkshopBackup(state: WorkshopAppState) {
  const jsonStr = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = state.config.startDate ? state.config.startDate.replace(/\//g, '-') : 'today';
  a.href = url;
  a.download = `safari-biotech-backup-${state.config.batchCode}-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function clearWorkshopData(): WorkshopAppState {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('safari_vermi_workshop_data_v3');
    localStorage.removeItem('vermi_workshop_data_v2');
  } catch {
    // ignore
  }
  return normalizeWorkshopState(null);
}
