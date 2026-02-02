import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getAutoSyncManager } from '@/lib/sync/autoSyncManager';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import { useProStatusStore } from '@/stores/useProStatusStore';
import type { TimeView } from '@/lib/date';
import type { NekoCalendar } from '@/lib/ics/types';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_VIEW_MODE,
  DEFAULT_DAY_COUNT,
} from '@/lib/config';

export interface UnifiedProgress {
  id: string;
  type: 'progress' | 'counter';
  title: string;
  icon?: string;
  direction?: 'increment' | 'decrement';
  total?: number;
  step: number;
  unit: string;
  current: number;
  todayCount: number;
  lastUpdateDate?: string;
  history?: Record<string, number>;
  frequency?: 'daily' | 'weekly' | 'monthly';
  resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'none';
  createdAt: number;
  archived?: boolean;
}

export interface CustomIcon {
  id: string;
  url: string;
  name: string;
  createdAt: number;
}

export interface UnifiedData {
  calendars: NekoCalendar[];
  progress: UnifiedProgress[];
  settings: {
    timezone: number;
    viewMode: TimeView;
    dayCount: number;
    hourHeight?: number;
    use24Hour?: boolean;
    dayStartTime?: number;
  };
  customIcons?: CustomIcon[];
}

interface DataFile {
  version: 2;
  lastModified: number;
  data: UnifiedData;
}

let basePath: string | null = null;

async function getBasePath(): Promise<string> {
  if (basePath === null) {
    const storage = getStorageAdapter();
    const appData = await storage.getBasePath();
    // Fix: Correctly escape backslash for Windows paths
    basePath =
      appData.endsWith(String.fromCharCode(92)) || appData.endsWith('/') ? appData.slice(0, -1) : appData;
  }
  return basePath;
}

function getDefaultData(): UnifiedData {
  return {
    calendars: [
      {
        id: 'main',
        name: 'Main',
        color: 'blue',
        visible: true,
      }
    ],
    progress: [],
    settings: {
      timezone: DEFAULT_TIMEZONE,
      viewMode: DEFAULT_VIEW_MODE,
      dayCount: DEFAULT_DAY_COUNT,
    },
  };
}

export async function loadUnifiedData(): Promise<UnifiedData> {
  try {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    const jsonPath = await joinPath(base, '.nekotick', 'data.json');

    if (await storage.exists(jsonPath)) {
      const content = await storage.readFile(jsonPath);
      const parsed = JSON.parse(content) as DataFile;

      if (parsed.version === 2 && parsed.data) {
        // Migration: ensure calendars exists
        if (!parsed.data.calendars || parsed.data.calendars.length === 0) {
            parsed.data.calendars = getDefaultData().calendars;
        }
        return parsed.data;
      }
    }

    return getDefaultData();
  } catch (error) {
    return getDefaultData();
  }
}

// Debounce save to avoid frequent writes
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingData: UnifiedData | null = null;

export async function saveUnifiedData(data: UnifiedData): Promise<void> {
  pendingData = data;

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(async () => {
    if (!pendingData) return;

    try {
      const storage = getStorageAdapter();
      const base = await getBasePath();
      const jsonPath = await joinPath(base, '.nekotick', 'data.json');
      // MD file generation removed as it relied on Tasks

      // Save JSON (source of truth)
      const dataFile: DataFile = {
        version: 2,
        lastModified: Date.now(),
        data: pendingData,
      };
      await storage.writeFile(jsonPath, JSON.stringify(dataFile, null, 2));

      pendingData = null;

      // Trigger auto-sync for PRO users
      triggerAutoSyncIfEligible();
    } catch (error) {
    }
  }, 300);
}

/**
 * Trigger auto-sync if user is eligible (PRO + connected to GitHub)
 */
function triggerAutoSyncIfEligible(): void {
  const syncState = useGithubSyncStore.getState();
  const proStatusState = useProStatusStore.getState();

  // Only trigger for PRO users connected to GitHub
  if (syncState.isConnected && proStatusState.isProUser) {
    const autoSyncManager = getAutoSyncManager();
    autoSyncManager.triggerSync();
  }
}

// Force immediate save (for critical operations)
export async function saveUnifiedDataImmediate(data: UnifiedData): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  pendingData = null;

  try {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    const jsonPath = await joinPath(base, '.nekotick', 'data.json');

    const dataFile: DataFile = {
      version: 2,
      lastModified: Date.now(),
      data,
    };
    await storage.writeFile(jsonPath, JSON.stringify(dataFile, null, 2));

  } catch (error) {
  }
}