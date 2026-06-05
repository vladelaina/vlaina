import { create } from 'zustand';
import {
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

export type AppViewMode = 'notes' | 'chat' | 'lab';
export type NotesSidebarView = 'workspace' | 'outline';

export type ImageStorageMode = 'vault' | 'vaultSubfolder' | 'currentFolder' | 'subfolder';

export type ImageFilenameFormat = 'original' | 'timestamp' | 'sequence';

interface PendingNotesChatComposerInsert {
  id: number;
  text: string;
}

const STORAGE_KEY_NOTES_CHAT_PANEL_COLLAPSED = 'vlaina_notes_chat_panel_collapsed';

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

  sidebarHeaderHovered: boolean;
  setSidebarHeaderHovered: (hovered: boolean) => void;
  sidebarSearchOpen: boolean;
  setSidebarSearchOpen: (open: boolean) => void;
  toggleSidebarSearch: () => void;
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
  pendingNotesChatComposerInsert: PendingNotesChatComposerInsert | null;
  queueNotesChatComposerInsert: (text: string) => void;
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
      const parsed = parseFloat(saved);
      return Number.isNaN(parsed) ? defaultValue : parsed;
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
  if (sanitized.length > MAX_IMAGE_SUBFOLDER_NAME_CHARS) {
    return null;
  }
  return sanitized;
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
  useUnifiedStore.getState().setLastAppViewMode(mode);
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
  sidebarHeaderHovered: false,
  setSidebarHeaderHovered: (hovered) => set({ sidebarHeaderHovered: hovered }),
  sidebarSearchOpen: false,
  setSidebarSearchOpen: (open) => set({ sidebarSearchOpen: open }),
  toggleSidebarSearch: () => set((state) => ({ sidebarSearchOpen: !state.sidebarSearchOpen })),
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
    set({ notesChatPanelCollapsed: collapsed });
  },
  toggleNotesChatPanel: () =>
    set((state) => {
      const next = !state.notesChatPanelCollapsed;
      savePreferenceString(STORAGE_KEY_NOTES_CHAT_PANEL_COLLAPSED, String(next));
      return { notesChatPanelCollapsed: next };
    }),
  pendingNotesChatComposerInsert: null,
  queueNotesChatComposerInsert: (text) =>
    {
      saveString(STORAGE_KEY_NOTES_CHAT_PANEL_COLLAPSED, 'false');
      set({
        pendingNotesChatComposerInsert: {
          id: Date.now(),
          text,
        },
        notesChatPanelCollapsed: false,
      });
    },
  consumePendingNotesChatComposerInsert: (id) =>
    set((state) =>
      state.pendingNotesChatComposerInsert?.id === id
        ? { pendingNotesChatComposerInsert: null }
        : {}
    ),
}));
