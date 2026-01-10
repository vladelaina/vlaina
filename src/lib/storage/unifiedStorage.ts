/**
 * Unified Storage - Unified storage architecture
 * 
 * Core concept: There is only one type of "item" (UnifiedTask)
 * - All items are stored in a single unified list
 * - Items with time properties appear in calendar view
 * - Items without time properties only appear in todo view
 * - Calendar and todo are just different views of the same data
 * 
 * Storage structure:
 * - .nekotick/data.json: Data source (JSON format, read/write by program)
 * - nekotick.md: Human-readable Markdown view (write-only, for backup and viewing)
 */

import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getAutoSyncManager } from '@/lib/sync/autoSyncManager';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import { useLicenseStore } from '@/stores/useLicenseStore';
import type { ItemColor } from '@/lib/colors';
import type { TimeView } from '@/lib/date';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_VIEW_MODE,
  DEFAULT_DAY_COUNT,
  DEFAULT_GROUP_ID,
  DEFAULT_GROUP_NAME,
} from '@/lib/config';

export interface UnifiedTask {
  id: string;
  content: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  order: number;
  groupId: string;
  parentId: string | null;
  collapsed: boolean;

  // Unified color system - Apple style colors
  color: ItemColor;

  // Time properties (with time = calendar event, without time = pure todo)
  startDate?: number;
  endDate?: number;
  isAllDay?: boolean;

  // Time tracking
  estimatedMinutes?: number;
  actualMinutes?: number;

  // Timer state
  timerState?: 'idle' | 'running' | 'paused';
  timerStartedAt?: number;
  timerAccumulated?: number;

  // Icon (Phosphor icon name, shared with Progress module)
  icon?: string;

  // Calendar related (optional)
  location?: string;
  description?: string;
}

export interface UnifiedGroup {
  id: string;
  name: string;
  pinned: boolean;
  createdAt: number;
  updatedAt?: number;
}

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

export interface UnifiedArchiveEntry {
  content: string;
  completedAt?: number;
  createdAt?: number;
  color?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  groupId: string;
}

export interface UnifiedArchiveSection {
  timestamp: number;
  tasks: UnifiedArchiveEntry[];
}

export interface UnifiedData {
  groups: UnifiedGroup[];
  tasks: UnifiedTask[];
  progress: UnifiedProgress[];
  archive: UnifiedArchiveSection[];
  settings: {
    timezone: number;
    viewMode: TimeView;
    dayCount: number;
    hourHeight?: number;
    use24Hour?: boolean;
    dayStartTime?: number;
  };
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
    basePath =
      appData.endsWith('\\') || appData.endsWith('/') ? appData.slice(0, -1) : appData;
  }
  return basePath;
}

async function ensureDirectories(): Promise<void> {
  const storage = getStorageAdapter();
  const base = await getBasePath();
  const metadataDir = await joinPath(base, '.nekotick');

  if (!(await storage.exists(metadataDir))) {
    await storage.mkdir(metadataDir, true);
  }
}

function getDefaultData(): UnifiedData {
  return {
    groups: [
      {
        id: DEFAULT_GROUP_ID,
        name: DEFAULT_GROUP_NAME,
        pinned: false,
        createdAt: Date.now(),
      },
    ],
    tasks: [],
    progress: [],
    archive: [],
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
    await ensureDirectories();
    const base = await getBasePath();
    const jsonPath = await joinPath(base, '.nekotick', 'data.json');

    if (await storage.exists(jsonPath)) {
      const content = await storage.readFile(jsonPath);
      const parsed = JSON.parse(content) as DataFile;

      if (parsed.version === 2 && parsed.data) {
        console.log('[UnifiedStorage] Loaded data from JSON');
        return parsed.data;
      }
    }

    console.log('[UnifiedStorage] No existing data, returning defaults');
    return getDefaultData();
  } catch (error) {
    console.error('[UnifiedStorage] Failed to load:', error);
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
      await ensureDirectories();
      const base = await getBasePath();
      const jsonPath = await joinPath(base, '.nekotick', 'data.json');
      const mdPath = await joinPath(base, 'nekotick.md');

      // Save JSON (source of truth)
      const dataFile: DataFile = {
        version: 2,
        lastModified: Date.now(),
        data: pendingData,
      };
      await storage.writeFile(jsonPath, JSON.stringify(dataFile, null, 2));

      // Save MD (human-readable view)
      const markdown = generateMarkdown(pendingData);
      await storage.writeFile(mdPath, markdown);

      console.log('[UnifiedStorage] Saved data');
      pendingData = null;

      // Trigger auto-sync for PRO users
      triggerAutoSyncIfEligible();
    } catch (error) {
      console.error('[UnifiedStorage] Failed to save:', error);
    }
  }, 300); // 300ms debounce
}

/**
 * Trigger auto-sync if user is eligible (PRO + connected to GitHub)
 */
function triggerAutoSyncIfEligible(): void {
  const syncState = useGithubSyncStore.getState();
  const licenseState = useLicenseStore.getState();

  // Only trigger for PRO users connected to GitHub
  if (syncState.isConnected && licenseState.isProUser) {
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
    await ensureDirectories();
    const base = await getBasePath();
    const jsonPath = await joinPath(base, '.nekotick', 'data.json');
    const mdPath = await joinPath(base, 'nekotick.md');

    const dataFile: DataFile = {
      version: 2,
      lastModified: Date.now(),
      data,
    };
    await storage.writeFile(jsonPath, JSON.stringify(dataFile, null, 2));

    const markdown = generateMarkdown(data);
    await storage.writeFile(mdPath, markdown);

    console.log('[UnifiedStorage] Saved data (immediate)');
  } catch (error) {
    console.error('[UnifiedStorage] Failed to save:', error);
  }
}

function generateMarkdown(data: UnifiedData): string {
  const lines: string[] = [];

  // Unified Items Section - Tasks and Calendar events are the same data
  lines.push('# Items');
  lines.push('');

  for (const group of data.groups) {
    const groupTasks = data.tasks.filter((t) => t.groupId === group.id);
    if (groupTasks.length === 0 && group.id !== DEFAULT_GROUP_ID) continue;

    lines.push(`## ${group.name}`);
    lines.push('');

    // Render top-level tasks with time info inline
    const topLevel = groupTasks.filter((t) => !t.parentId).sort((a, b) => a.order - b.order);

    for (const task of topLevel) {
      renderTaskUnified(task, groupTasks, lines, '');
    }

    if (topLevel.length > 0) lines.push('');
  }

  // Progress Section
  lines.push('# Progress');
  lines.push('');

  const activeProgress = data.progress.filter((p) => !p.archived);
  const archivedProgress = data.progress.filter((p) => p.archived);

  for (const item of activeProgress) {
    const icon = item.icon || '○';
    const resetInfo = item.resetFrequency === 'daily' ? ' (↻)' : '';

    if (item.type === 'progress') {
      const percent = item.total ? Math.round((item.current / item.total) * 100) : 0;
      lines.push(`## ${icon} ${item.title}${resetInfo}`);
      lines.push(`${item.current} / ${item.total} ${item.unit} (${percent}%)`);
    } else {
      lines.push(`## ${icon} ${item.title}${resetInfo}`);
      lines.push(`${item.current} ${item.unit}`);
    }
    lines.push('');
  }

  if (archivedProgress.length > 0) {
    lines.push('### Archived');
    for (const item of archivedProgress) {
      const icon = item.icon || '○';
      lines.push(`- ~~${icon} ${item.title}~~`);
    }
    lines.push('');
  }

  // Archive Section
  if (data.archive.length > 0) {
    lines.push('# Archive');
    lines.push('');

    for (const section of data.archive) {
      const date = new Date(section.timestamp).toISOString().split('T')[0];
      lines.push(`## ${date}`);
      for (const task of section.tasks) {
        lines.push(`- [x] ${task.content}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Render a task with unified format
 * - Items with time show: `- [ ] 09:00-10:00 content [color]`
 * - Items without time show: `- [ ] content [color]`
 */
function renderTaskUnified(
  task: UnifiedTask,
  allTasks: UnifiedTask[],
  lines: string[],
  indent: string
): void {
  const checkbox = task.completed ? '[x]' : '[ ]';
  const color = task.color && task.color !== 'default' ? ` [${task.color}]` : '';

  // Build time string if task has time properties
  let timeStr = '';
  if (task.startDate !== undefined) {
    const start = new Date(task.startDate);
    if (task.isAllDay) {
      timeStr = `[${start.toISOString().split('T')[0]}] `;
    } else {
      const end = task.endDate ? new Date(task.endDate) : start;
      const dateStr = start.toISOString().split('T')[0];
      timeStr = `[${dateStr} ${formatTime(start)}-${formatTime(end)}] `;
    }
  }

  lines.push(`${indent}- ${checkbox} ${timeStr}${task.content}${color}`);

  // Render children
  const children = allTasks.filter((t) => t.parentId === task.id).sort((a, b) => a.order - b.order);

  for (const child of children) {
    renderTaskUnified(child, allTasks, lines, indent + '  ');
  }
}

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
