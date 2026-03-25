import { create } from 'zustand';
import {
  STORAGE_KEY_NOTES_SIDEBAR_COLLAPSED,
} from '@/lib/config';
import { getDefaultSidebarWidth } from '@/lib/layout/sidebarWidth';
const STORAGE_KEY_SIDEBAR_WIDTH = 'vlaina_sidebar_width';
const STORAGE_KEY_IMAGE_STORAGE_MODE = 'vlaina_image_storage_mode';
const STORAGE_KEY_IMAGE_SUBFOLDER_NAME = 'vlaina_image_subfolder_name';
const STORAGE_KEY_IMAGE_VAULT_SUBFOLDER_NAME = 'vlaina_image_vault_subfolder_name';
const STORAGE_KEY_IMAGE_FILENAME_FORMAT = 'vlaina_image_filename_format';
const STORAGE_KEY_TAG_FILTER = 'vlaina_tag_filter';

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
  notesSidebarView: NotesSidebarView;
  setNotesSidebarView: (view: NotesSidebarView) => void;

  notesPreviewTitle: { path: string; title: string } | null;
  setNotesPreviewTitle: (path: string | null, title: string | null) => void;

  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;

  notesSidebarSearchOpen: boolean;
  setNotesSidebarSearchOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;

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

function loadBoolean(key: string, defaultValue: boolean): boolean {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {
  }
  return defaultValue;
}

function loadNumber(key: string, defaultValue: number): number {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      return Number.isNaN(parsed) ? defaultValue : parsed;
    }
  } catch {
  }
  return defaultValue;
}

function loadTagFilter(): string | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TAG_FILTER);
    if (!saved) return null;
    const value = saved.trim();
    return value.length > 0 ? value : null;
  } catch {
  }
  return null;
}

function saveTagFilter(tag: string | null): void {
  if (!tag) {
    localStorage.removeItem(STORAGE_KEY_TAG_FILTER);
    return;
  }
  localStorage.setItem(STORAGE_KEY_TAG_FILTER, tag);
}

function loadImageStorageMode(): ImageStorageMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_IMAGE_STORAGE_MODE);
    if (saved === 'vault' || saved === 'vaultSubfolder' || saved === 'currentFolder' || saved === 'subfolder') {
      return saved;
    }
  } catch {
  }
  return 'subfolder';
}

function loadImageSubfolderName(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_IMAGE_SUBFOLDER_NAME);
    if (saved) return saved;
  } catch {
  }
  return 'assets';
}

function loadImageVaultSubfolderName(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_IMAGE_VAULT_SUBFOLDER_NAME);
    if (saved) return saved;
  } catch {
  }
  return 'assets';
}

function loadImageFilenameFormat(): ImageFilenameFormat {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_IMAGE_FILENAME_FORMAT);
    if (saved === 'original' || saved === 'timestamp' || saved === 'sequence') {
      return saved;
    }
  } catch {
  }
  return 'original';
}

function loadNotesChatPanelCollapsed(): boolean {
  return loadBoolean(STORAGE_KEY_NOTES_CHAT_PANEL_COLLAPSED, false);
}
export const useUIStore = create<UIStore>()((set) => ({
  appViewMode: 'notes' as AppViewMode,
  setAppViewMode: (mode) => set({ appViewMode: mode }),
  toggleAppViewMode: () => set((state) => ({
    appViewMode: state.appViewMode === 'chat' ? 'notes' : 'chat'
  })),

  sidebarCollapsed: loadBoolean(STORAGE_KEY_NOTES_SIDEBAR_COLLAPSED, false),
  toggleSidebar: () => set((state) => {
    const next = !state.sidebarCollapsed;
    localStorage.setItem(STORAGE_KEY_NOTES_SIDEBAR_COLLAPSED, String(next));
    return { sidebarCollapsed: next };
  }),
  sidebarWidth: loadNumber(STORAGE_KEY_SIDEBAR_WIDTH, getDefaultSidebarWidth()),
  setSidebarWidth: (width) => {
    localStorage.setItem(STORAGE_KEY_SIDEBAR_WIDTH, String(width));
    set({ sidebarWidth: width });
  },
  layoutPanelDragging: false,
  setLayoutPanelDragging: (dragging) => set({ layoutPanelDragging: dragging }),
  windowResizeActive: false,
  setWindowResizeActive: (active) => set({ windowResizeActive: active }),
  sidebarHeaderHovered: false,
  setSidebarHeaderHovered: (hovered) => set({ sidebarHeaderHovered: hovered }),
  notesSidebarView: 'workspace',
  setNotesSidebarView: (view) => set({ notesSidebarView: view }),

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

  notesSidebarSearchOpen: false,
  setNotesSidebarSearchOpen: (open) => set({ notesSidebarSearchOpen: open }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  selectedTag: loadTagFilter(),
  setSelectedTag: (tag) => {
    saveTagFilter(tag);
    set({ selectedTag: tag });
  },

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

  imageStorageMode: loadImageStorageMode(),
  imageSubfolderName: loadImageSubfolderName(),
  setImageStorageMode: (mode) => {
    localStorage.setItem(STORAGE_KEY_IMAGE_STORAGE_MODE, mode);
    set({ imageStorageMode: mode });
  },
  setImageSubfolderName: (name) => {
    const sanitized = name.replace(/[<>:"/\\|?*]/g, '').trim();
    localStorage.setItem(STORAGE_KEY_IMAGE_SUBFOLDER_NAME, sanitized);
    set({ imageSubfolderName: sanitized });
  },
  imageVaultSubfolderName: loadImageVaultSubfolderName(),
  setImageVaultSubfolderName: (name) => {
    const sanitized = name.replace(/[<>:"/\\|?*]/g, '').trim();
    localStorage.setItem(STORAGE_KEY_IMAGE_VAULT_SUBFOLDER_NAME, sanitized);
    set({ imageVaultSubfolderName: sanitized });
  },
  imageFilenameFormat: loadImageFilenameFormat(),
  setImageFilenameFormat: (format) => {
    localStorage.setItem(STORAGE_KEY_IMAGE_FILENAME_FORMAT, format);
    set({ imageFilenameFormat: format });
  },

  notesChatPanelCollapsed: loadNotesChatPanelCollapsed(),
  setNotesChatPanelCollapsed: (collapsed) => {
    localStorage.setItem(STORAGE_KEY_NOTES_CHAT_PANEL_COLLAPSED, String(collapsed));
    set({ notesChatPanelCollapsed: collapsed });
  },
  toggleNotesChatPanel: () =>
    set((state) => {
      const next = !state.notesChatPanelCollapsed;
      localStorage.setItem(STORAGE_KEY_NOTES_CHAT_PANEL_COLLAPSED, String(next));
      return { notesChatPanelCollapsed: next };
    }),
  pendingNotesChatComposerInsert: null,
  queueNotesChatComposerInsert: (text) =>
    {
      localStorage.setItem(STORAGE_KEY_NOTES_CHAT_PANEL_COLLAPSED, 'false');
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
