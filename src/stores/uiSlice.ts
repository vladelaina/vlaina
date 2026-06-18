import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEY_FONT_SIZE,
  STORAGE_KEY_NOTES_SIDEBAR_COLLAPSED,
} from '@/lib/config';
import {
  clampSidebarWidth,
  getDefaultSidebarWidth,
} from '@/lib/layout/sidebarWidth';
import { readWindowLaunchContext } from '@/lib/desktop/launchContext';
import { emitStorageAutoSyncEvent } from '@/lib/storage/storageAutoSync';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import {
  SYSTEM_LANGUAGE_PREFERENCE,
  normalizeAppLanguagePreference,
  type AppLanguagePreference,
} from '@/lib/i18n/languages';
import type { DesktopPlatformPreview } from '@/lib/desktop/platform';
export const UI_FONT_SIZE_DEFAULT = 17;
export const UI_FONT_SIZE_MIN = 14;
export const UI_FONT_SIZE_MAX = 28;
const STORAGE_KEY_SIDEBAR_WIDTH = 'vlaina_sidebar_width';
const STORAGE_KEY_IMAGE_STORAGE_MODE = 'vlaina_image_storage_mode';
const STORAGE_KEY_IMAGE_SUBFOLDER_NAME = 'vlaina_image_subfolder_name';
const STORAGE_KEY_IMAGE_VAULT_SUBFOLDER_NAME = 'vlaina_image_vault_subfolder_name';
const STORAGE_KEY_IMAGE_FILENAME_FORMAT = 'vlaina_image_filename_format';
const STORAGE_KEY_LANGUAGE_PREFERENCE = 'vlaina-language-preference';
const STORAGE_KEY_LAST_APP_VIEW_MODE = 'vlaina_last_app_view_mode';
const MAX_UI_SCALAR_STORAGE_CHARS = 256;
const MAX_IMAGE_SUBFOLDER_NAME_CHARS = 128;
const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
const UI_DECIMAL_STORAGE_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

export type AppViewMode = 'notes' | 'chat' | 'lab';
export type NotesSidebarView = 'workspace' | 'outline';

export type ImageStorageMode = 'vault' | 'vaultSubfolder' | 'currentFolder' | 'subfolder';

export type ImageFilenameFormat = 'original' | 'timestamp' | 'sequence';

export interface NotesChatFloatingSize {
  width: number;
  height: number;
}

export const NOTES_CHAT_FLOATING_DEFAULT_SIZE: NotesChatFloatingSize = {
  ...DEFAULT_SETTINGS.ui.notesChatFloatingSize,
};

export const NOTES_CHAT_FLOATING_MIN_SIZE: NotesChatFloatingSize = {
  width: 320,
  height: 420,
};

export const NOTES_CHAT_FLOATING_MAX_SIZE: NotesChatFloatingSize = {
  width: 760,
  height: 920,
};

interface PendingNotesChatComposerInsert {
  id: number;
  text: string;
}

type NotesChatComposerInsertTarget = 'side-panel' | 'floating';

const STORAGE_KEY_NOTES_CHAT_PANEL_COLLAPSED = 'vlaina_notes_chat_panel_collapsed';
const STORAGE_KEY_NOTES_CHAT_FLOATING_SIZE = 'vlaina_notes_chat_floating_size';

interface UIStore {
  appViewMode: AppViewMode;
  setAppViewMode: (mode: AppViewMode) => void;
  toggleAppViewMode: () => void;
  restoreLastAppViewMode: (mode: 'notes' | 'chat') => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  layoutPanelDragging: boolean;
  setLayoutPanelDragging: (dragging: boolean) => void;
  windowResizeActive: boolean;
  setWindowResizeActive: (active: boolean) => void;
  devPlatformPreview: DesktopPlatformPreview;
  setDevPlatformPreview: (platformPreview: DesktopPlatformPreview) => void;
  toggleDevPlatformPreview: () => void;

  sidebarHeaderHovered: boolean;
  setSidebarHeaderHovered: (hovered: boolean) => void;
  sidebarSearchOpen: boolean;
  setSidebarSearchOpen: (open: boolean) => void;
  toggleSidebarSearch: () => void;
  chatSidebarSearchOpen: boolean;
  setChatSidebarSearchOpen: (open: boolean) => void;
  toggleChatSidebarSearch: () => void;
  notesSidebarView: NotesSidebarView;
  setNotesSidebarView: (view: NotesSidebarView) => void;
  fontSize: number;
  setFontSize: (fontSize: number) => void;
  resetFontSize: () => void;
  languagePreference: AppLanguagePreference;
  setLanguagePreference: (language: AppLanguagePreference) => void;
  reloadPreferencesFromStorage: () => void;

  notesPreviewTitle: { path: string; title: string } | null;
  setNotesPreviewTitle: (path: string | null, title: string | null) => void;

  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;

  universalPreviewTarget: string | null;
  universalPreviewIcon: string | null;
  universalPreviewColor: string | null;
  universalPreviewTone: number | null;
  universalPreviewIconSize: number | null;

  setUniversalPreview: (targetId: string | null, state: {
    icon?: string | null;
    color?: string | null;
    tone?: number | null;
    size?: number | null;
  }) => void;

  imageStorageMode: ImageStorageMode;
  imageSubfolderName: string;
  setImageStorageMode: (mode: ImageStorageMode) => void;
  setImageSubfolderName: (name: string) => void;
  imageVaultSubfolderName: string;
  setImageVaultSubfolderName: (name: string) => void;
  imageFilenameFormat: ImageFilenameFormat;
  setImageFilenameFormat: (format: ImageFilenameFormat) => void;

  notesChatPanelCollapsed: boolean;
  setNotesChatPanelCollapsed: (collapsed: boolean) => void;
  toggleNotesChatPanel: () => void;
  notesChatFloatingOpen: boolean;
  setNotesChatFloatingOpen: (open: boolean) => void;
  notesChatFloatingSize: NotesChatFloatingSize;
  setNotesChatFloatingSize: (size: NotesChatFloatingSize) => void;
  restoreNotesChatFloatingSize: (size: NotesChatFloatingSize) => void;
  resetNotesChatFloatingSize: () => void;
  pendingNotesChatComposerInsert: PendingNotesChatComposerInsert | null;
  queueNotesChatComposerInsert: (text: string, target?: NotesChatComposerInsertTarget) => void;
  consumePendingNotesChatComposerInsert: (id: number) => void;
}

type UIPreferenceState = Pick<
  UIStore,
  | 'sidebarCollapsed'
  | 'sidebarWidth'
  | 'fontSize'
  | 'languagePreference'
  | 'imageStorageMode'
  | 'imageSubfolderName'
  | 'imageVaultSubfolderName'
  | 'imageFilenameFormat'
  | 'notesChatPanelCollapsed'
  | 'notesChatFloatingSize'
>;

function loadScalarString(key: string): string | null {
  const saved = localStorage.getItem(key);
  if (saved !== null && saved.length > MAX_UI_SCALAR_STORAGE_CHARS) {
    return null;
  }
  return saved;
}

function loadBoolean(key: string, defaultValue: boolean): boolean {
  try {
    const saved = loadScalarString(key);
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {
  }
  return defaultValue;
}

function saveString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
}

function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
  }
}

function emitUIPreferencesSync(): void {
  emitStorageAutoSyncEvent({ kind: 'ui-preferences' });
}

function savePreferenceString(key: string, value: string): void {
  saveString(key, value);
  emitUIPreferencesSync();
}

function removePreferenceString(key: string): void {
  removeStorageItem(key);
  emitUIPreferencesSync();
}

function loadNumber(key: string, defaultValue: number): number {
  try {
    const saved = loadScalarString(key);
    if (saved !== null) {
      const trimmed = saved.trim();
      const parsed = UI_DECIMAL_STORAGE_PATTERN.test(trimmed) ? Number(trimmed) : Number.NaN;
      return Number.isFinite(parsed) ? parsed : defaultValue;
    }
  } catch {
  }
  return defaultValue;
}

function loadFontSize(): number {
  const value = loadNumber(STORAGE_KEY_FONT_SIZE, UI_FONT_SIZE_DEFAULT);
  if (!Number.isFinite(value)) {
    return UI_FONT_SIZE_DEFAULT;
  }
  return Math.max(UI_FONT_SIZE_MIN, Math.min(UI_FONT_SIZE_MAX, Math.round(value)));
}

function loadImageStorageMode(): ImageStorageMode {
  try {
    const saved = loadScalarString(STORAGE_KEY_IMAGE_STORAGE_MODE);
    if (saved === 'vault' || saved === 'vaultSubfolder' || saved === 'currentFolder' || saved === 'subfolder') {
      return saved;
    }
  } catch {
  }
  return 'subfolder';
}

function sanitizeImageSubfolderPreference(name: string | null | undefined): string | null {
  const sanitized = (name || '').replace(/[<>:"/\\|?*]/g, '').trim();
  if (
    sanitized === '.' ||
    sanitized === '..' ||
    CONTROL_OR_BIDI_PATTERN.test(sanitized)
  ) {
    return null;
  }

  return sanitized.length > MAX_IMAGE_SUBFOLDER_NAME_CHARS ? null : sanitized;
}

function loadImageSubfolderName(): string {
  try {
    return sanitizeImageSubfolderPreference(loadScalarString(STORAGE_KEY_IMAGE_SUBFOLDER_NAME)) || 'assets';
  } catch {
  }
  return 'assets';
}

function loadImageVaultSubfolderName(): string {
  try {
    return sanitizeImageSubfolderPreference(loadScalarString(STORAGE_KEY_IMAGE_VAULT_SUBFOLDER_NAME)) || 'assets';
  } catch {
  }
  return 'assets';
}

function loadImageFilenameFormat(): ImageFilenameFormat {
  try {
    const saved = loadScalarString(STORAGE_KEY_IMAGE_FILENAME_FORMAT);
    if (saved === 'original' || saved === 'timestamp' || saved === 'sequence') {
      return saved;
    }
  } catch {
  }
  return 'original';
}

function loadNotesChatPanelCollapsed(): boolean {
  return loadBoolean(STORAGE_KEY_NOTES_CHAT_PANEL_COLLAPSED, true);
}

function clampNotesChatFloatingSize(size: NotesChatFloatingSize): NotesChatFloatingSize {
  return {
    width: Math.max(
      NOTES_CHAT_FLOATING_MIN_SIZE.width,
      Math.min(NOTES_CHAT_FLOATING_MAX_SIZE.width, Math.round(size.width))
    ),
    height: Math.max(
      NOTES_CHAT_FLOATING_MIN_SIZE.height,
      Math.min(NOTES_CHAT_FLOATING_MAX_SIZE.height, Math.round(size.height))
    ),
  };
}

function parseNotesChatFloatingSize(value: string | null): NotesChatFloatingSize | null {
  if (!value || value.length > MAX_UI_SCALAR_STORAGE_CHARS) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<NotesChatFloatingSize>;
    if (typeof parsed.width !== 'number' || typeof parsed.height !== 'number') {
      return null;
    }
    if (!Number.isFinite(parsed.width) || !Number.isFinite(parsed.height)) {
      return null;
    }
    return clampNotesChatFloatingSize({
      width: parsed.width,
      height: parsed.height,
    });
  } catch {
    return null;
  }
}

function loadNotesChatFloatingSize(): NotesChatFloatingSize {
  return parseNotesChatFloatingSize(loadScalarString(STORAGE_KEY_NOTES_CHAT_FLOATING_SIZE))
    ?? NOTES_CHAT_FLOATING_DEFAULT_SIZE;
}

function loadLastAppViewMode(): Extract<AppViewMode, 'notes' | 'chat'> {
  try {
    const saved = loadScalarString(STORAGE_KEY_LAST_APP_VIEW_MODE);
    if (saved === 'notes' || saved === 'chat') {
      return saved;
    }
  } catch {
  }
  return 'notes';
}

function saveLastAppViewMode(mode: AppViewMode): void {
  if (mode !== 'notes' && mode !== 'chat') return;
  saveString(STORAGE_KEY_LAST_APP_VIEW_MODE, mode);
  useUnifiedStore.getState().setLastAppViewMode(mode, true);
}

function loadLanguagePreference(): AppLanguagePreference {
  try {
    const saved = loadScalarString(STORAGE_KEY_LANGUAGE_PREFERENCE);
    const normalized = normalizeAppLanguagePreference(saved);
    if (normalized) {
      return normalized;
    }
  } catch {
  }
  return SYSTEM_LANGUAGE_PREFERENCE;
}

function getInitialAppViewMode(): AppViewMode {
  const launchViewMode = readWindowLaunchContext().viewMode;
  if (!import.meta.env.DEV && launchViewMode === 'lab') {
    return 'notes';
  }
  return launchViewMode ?? loadLastAppViewMode();
}

function normalizeAppViewMode(mode: AppViewMode): AppViewMode {
  if (!import.meta.env.DEV && mode === 'lab') {
    return 'notes';
  }
  return mode;
}

function normalizeDevPlatformPreview(platformPreview: DesktopPlatformPreview): DesktopPlatformPreview {
  if (!import.meta.env.DEV) return 'system';
  return platformPreview === 'macos' ? 'macos' : 'system';
}

function loadUIPreferencesFromStorage(): UIPreferenceState {
  return {
    sidebarCollapsed: loadBoolean(STORAGE_KEY_NOTES_SIDEBAR_COLLAPSED, false),
    sidebarWidth: clampSidebarWidth(loadNumber(STORAGE_KEY_SIDEBAR_WIDTH, getDefaultSidebarWidth())),
    fontSize: loadFontSize(),
    languagePreference: loadLanguagePreference(),
    imageStorageMode: loadImageStorageMode(),
    imageSubfolderName: loadImageSubfolderName(),
    imageVaultSubfolderName: loadImageVaultSubfolderName(),
    imageFilenameFormat: loadImageFilenameFormat(),
    notesChatPanelCollapsed: loadNotesChatPanelCollapsed(),
    notesChatFloatingSize: loadNotesChatFloatingSize(),
  };
}

export const useUIStore = create<UIStore>()((set) => ({
  appViewMode: getInitialAppViewMode(),
  setAppViewMode: (mode) => {
    const next = normalizeAppViewMode(mode);
    saveLastAppViewMode(next);
    set({ appViewMode: next });
  },
  toggleAppViewMode: () => set((state) => {
    const next = state.appViewMode === 'chat' ? 'notes' : 'chat';
    saveLastAppViewMode(next);
    return { appViewMode: next };
  }),
  restoreLastAppViewMode: (mode) => set((state) => {
    if (state.appViewMode === 'lab') return {};
    if (state.appViewMode === mode) return {};
    saveString(STORAGE_KEY_LAST_APP_VIEW_MODE, mode);
    return { appViewMode: mode };
  }),

  toggleSidebar: () => set((state) => {
    const next = !state.sidebarCollapsed;
    savePreferenceString(STORAGE_KEY_NOTES_SIDEBAR_COLLAPSED, String(next));
    return { sidebarCollapsed: next };
  }),
  setSidebarWidth: (width) => {
    const next = clampSidebarWidth(width);
    savePreferenceString(STORAGE_KEY_SIDEBAR_WIDTH, String(next));
    set({ sidebarWidth: next });
  },
  layoutPanelDragging: false,
  setLayoutPanelDragging: (dragging) => set({ layoutPanelDragging: dragging }),
  windowResizeActive: false,
  setWindowResizeActive: (active) => set({ windowResizeActive: active }),
  devPlatformPreview: 'system',
  setDevPlatformPreview: (platformPreview) =>
    set({ devPlatformPreview: normalizeDevPlatformPreview(platformPreview) }),
  toggleDevPlatformPreview: () =>
    set((state) => ({
      devPlatformPreview: normalizeDevPlatformPreview(
        state.devPlatformPreview === 'macos' ? 'system' : 'macos',
      ),
    })),
  sidebarHeaderHovered: false,
  setSidebarHeaderHovered: (hovered) => set({ sidebarHeaderHovered: hovered }),
  sidebarSearchOpen: false,
  setSidebarSearchOpen: (open) => set({ sidebarSearchOpen: open }),
  toggleSidebarSearch: () => set((state) => ({ sidebarSearchOpen: !state.sidebarSearchOpen })),
  chatSidebarSearchOpen: false,
  setChatSidebarSearchOpen: (open) => set({ chatSidebarSearchOpen: open }),
  toggleChatSidebarSearch: () =>
    set((state) => ({ chatSidebarSearchOpen: !state.chatSidebarSearchOpen })),
  notesSidebarView: 'workspace',
  setNotesSidebarView: (view) => set({ notesSidebarView: view }),
  ...loadUIPreferencesFromStorage(),
  setFontSize: (fontSize) => set((state) => {
    const next = Math.max(UI_FONT_SIZE_MIN, Math.min(UI_FONT_SIZE_MAX, Math.round(fontSize)));
    if (state.fontSize === next) {
      return state;
    }
    savePreferenceString(STORAGE_KEY_FONT_SIZE, String(next));
    return { fontSize: next };
  }),
  resetFontSize: () => {
    removePreferenceString(STORAGE_KEY_FONT_SIZE);
    set({ fontSize: UI_FONT_SIZE_DEFAULT });
  },
  setLanguagePreference: (language) => {
    savePreferenceString(STORAGE_KEY_LANGUAGE_PREFERENCE, language);
    set({ languagePreference: language });
  },
  reloadPreferencesFromStorage: () => set(loadUIPreferencesFromStorage()),

  notesPreviewTitle: null,
  setNotesPreviewTitle: (path, title) => {
    if (path && title) {
      set({ notesPreviewTitle: { path, title } });
    } else {
      set({ notesPreviewTitle: null });
    }
  },

  drawerOpen: false,
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),

  universalPreviewTarget: null,
  universalPreviewIcon: null,
  universalPreviewColor: null,
  universalPreviewTone: null,
  universalPreviewIconSize: null,

  setUniversalPreview: (targetId, { icon, color, tone, size }) => set((state) => ({
    universalPreviewTarget: targetId,
    universalPreviewIcon: icon !== undefined ? icon : state.universalPreviewIcon,
    universalPreviewColor: color !== undefined ? color : state.universalPreviewColor,
    universalPreviewTone: tone !== undefined ? tone : state.universalPreviewTone,
    universalPreviewIconSize: size !== undefined ? size : state.universalPreviewIconSize,
  })),

  setImageStorageMode: (mode) => {
    savePreferenceString(STORAGE_KEY_IMAGE_STORAGE_MODE, mode);
    set({ imageStorageMode: mode });
  },
  setImageSubfolderName: (name) => {
    const sanitized = sanitizeImageSubfolderPreference(name) ?? 'assets';
    savePreferenceString(STORAGE_KEY_IMAGE_SUBFOLDER_NAME, sanitized);
    set({ imageSubfolderName: sanitized });
  },
  setImageVaultSubfolderName: (name) => {
    const sanitized = sanitizeImageSubfolderPreference(name) ?? 'assets';
    savePreferenceString(STORAGE_KEY_IMAGE_VAULT_SUBFOLDER_NAME, sanitized);
    set({ imageVaultSubfolderName: sanitized });
  },
  setImageFilenameFormat: (format) => {
    savePreferenceString(STORAGE_KEY_IMAGE_FILENAME_FORMAT, format);
    set({ imageFilenameFormat: format });
  },

  setNotesChatPanelCollapsed: (collapsed) => {
    savePreferenceString(STORAGE_KEY_NOTES_CHAT_PANEL_COLLAPSED, String(collapsed));
    set({
      notesChatPanelCollapsed: collapsed,
      ...(collapsed ? {} : { notesChatFloatingOpen: false }),
    });
  },
  toggleNotesChatPanel: () =>
    set((state) => {
      const next = !state.notesChatPanelCollapsed;
      savePreferenceString(STORAGE_KEY_NOTES_CHAT_PANEL_COLLAPSED, String(next));
      return {
        notesChatPanelCollapsed: next,
        ...(next ? {} : { notesChatFloatingOpen: false }),
      };
    }),
  notesChatFloatingOpen: false,
  setNotesChatFloatingOpen: (open) => set({ notesChatFloatingOpen: open }),
  setNotesChatFloatingSize: (size) => {
    const next = clampNotesChatFloatingSize(size);
    savePreferenceString(STORAGE_KEY_NOTES_CHAT_FLOATING_SIZE, JSON.stringify(next));
    useUnifiedStore.getState().setNotesChatFloatingSize(next);
    set({ notesChatFloatingSize: next });
  },
  restoreNotesChatFloatingSize: (size) => {
    const next = clampNotesChatFloatingSize(size);
    saveString(STORAGE_KEY_NOTES_CHAT_FLOATING_SIZE, JSON.stringify(next));
    set({ notesChatFloatingSize: next });
  },
  resetNotesChatFloatingSize: () => {
    removePreferenceString(STORAGE_KEY_NOTES_CHAT_FLOATING_SIZE);
    useUnifiedStore.getState().setNotesChatFloatingSize(NOTES_CHAT_FLOATING_DEFAULT_SIZE);
    set({ notesChatFloatingSize: NOTES_CHAT_FLOATING_DEFAULT_SIZE });
  },
  pendingNotesChatComposerInsert: null,
  queueNotesChatComposerInsert: (text, target = 'side-panel') =>
    {
      const openFloating = target === 'floating';
      saveString(STORAGE_KEY_NOTES_CHAT_PANEL_COLLAPSED, openFloating ? 'true' : 'false');
      set({
        pendingNotesChatComposerInsert: {
          id: Date.now(),
          text,
        },
        notesChatPanelCollapsed: openFloating,
        notesChatFloatingOpen: openFloating,
      });
    },
  consumePendingNotesChatComposerInsert: (id) =>
    set((state) =>
      state.pendingNotesChatComposerInsert?.id === id
        ? { pendingNotesChatComposerInsert: null }
        : {}
    ),
}));
