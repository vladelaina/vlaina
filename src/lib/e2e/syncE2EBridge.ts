import { actions as aiActions } from '@/stores/ai/providerActions';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { desktopWindow } from '@/lib/desktop/window';
import { flushPendingSave } from '@/lib/storage/unifiedStorage';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getVaultSystemStorePath } from '@/stores/notes/systemStoragePaths';
import { flushStarredRegistry } from '@/stores/notes/starred';
import type { UnifiedData } from '@/lib/storage/unifiedStorageTypes';
import type { NotesState, StarredEntry } from '@/stores/notes/types';
import type { ManagedBudgetStatus } from '@/lib/ai/managedService';
import type { VaultInfo } from '@/stores/useVaultStore';

const E2E_LOCAL_STORAGE_KEY = 'vlaina:e2e:enabled';

export interface VlainaE2EBridge {
  waitForUnifiedLoaded(): Promise<void>;
  getUnifiedData(): UnifiedData;
  reloadUnified(): Promise<void>;
  flushUnifiedSave(): Promise<void>;
  addProvider(input: {
    name: string;
    apiHost?: string;
    apiKey?: string;
    enabled?: boolean;
  }): Promise<string>;
  deleteProvider(id: string): Promise<void>;
  setTimezone(offset: number, city: string): Promise<void>;
  setMarkdownLineNumbers(showLineNumbers: boolean): Promise<void>;
  createWindow(options?: { viewMode?: 'notes' | 'chat' | null }): Promise<void>;
  createNotesFixture(input?: { filename?: string; content?: string }): Promise<{
    vaultPath: string;
    notePath: string;
  }>;
  createVaultFixture(input?: { name?: string; filename?: string; content?: string }): Promise<{
    vaultPath: string;
    notePath: string;
  }>;
  initializeVaultStore(): Promise<void>;
  openVault(path: string, name?: string): Promise<boolean>;
  getVaultState(): {
    currentVault: VaultInfo | null;
    recentVaults: VaultInfo[];
    error: string | null;
    isLoading: boolean;
  };
  removeRecentVault(id: string): Promise<boolean>;
  readVaultConfig(path: string): Promise<unknown>;
  openAbsoluteNote(path: string): Promise<void>;
  getNotesState(): Pick<NotesState, 'currentNote' | 'isDirty' | 'error' | 'openTabs'>;
  getNotesPreferences(): Pick<NotesState, 'noteIconSize' | 'recentNotes'>;
  getStarredState(): Pick<
    NotesState,
    'notesPath' | 'starredEntries' | 'starredNotes' | 'starredFolders' | 'starredLoaded'
  >;
  loadStarred(vaultPath: string): Promise<void>;
  toggleStarred(path: string): Promise<void>;
  removeStarredEntry(id: string): Promise<void>;
  updateCurrentNoteContent(content: string): Promise<void>;
  saveCurrentNote(): Promise<void>;
  syncCurrentNoteFromDisk(options?: { force?: boolean }): Promise<string>;
  setGlobalNoteIconSize(size: number): Promise<void>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  getUIState(): {
    fontSize: number;
    languagePreference: string;
    sidebarWidth: number;
    imageStorageMode: string;
    imageSubfolderName: string;
    notesChatPanelCollapsed: boolean;
  };
  setUIPreferences(input: {
    fontSize?: number;
    languagePreference?: string;
    sidebarWidth?: number;
    imageStorageMode?: 'vault' | 'vaultSubfolder' | 'currentFolder' | 'subfolder';
    imageSubfolderName?: string;
    notesChatPanelCollapsed?: boolean;
  }): Promise<void>;
  getManagedBudgetState(): Pick<
    ReturnType<typeof useManagedAIStore.getState>,
    'budget' | 'lastBudgetSyncAt' | 'budgetError' | 'isRefreshingBudget'
  >;
  applyManagedBudgetSnapshot(budget: ManagedBudgetStatus): Promise<void>;
  clearManagedBudget(): Promise<void>;
}

function isE2EBridgeEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('e2e') === '1') {
    try {
      window.localStorage.setItem(E2E_LOCAL_STORAGE_KEY, '1');
    } catch {
    }
    return true;
  }

  try {
    return window.localStorage.getItem(E2E_LOCAL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

async function waitForUnifiedLoaded(): Promise<void> {
  if (useUnifiedStore.getState().loaded) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      unsubscribe();
      reject(new Error('Timed out waiting for unified store to load'));
    }, 10000);

    const unsubscribe = useUnifiedStore.subscribe((state) => {
      if (!state.loaded) {
        return;
      }

      window.clearTimeout(timeoutId);
      unsubscribe();
      resolve();
    });
  });
}

export function installSyncE2EBridge(): void {
  if (!isE2EBridgeEnabled() || window.__vlainaE2E) {
    return;
  }

  window.__vlainaE2E = {
    waitForUnifiedLoaded,
    getUnifiedData: () => structuredClone(useUnifiedStore.getState().data),
    reloadUnified: async () => {
      await useUnifiedStore.getState().reloadFromDisk();
    },
    flushUnifiedSave: flushPendingSave,
    addProvider: async (input) => {
      const id = aiActions.addProvider({
        name: input.name,
        type: 'newapi',
        endpointType: 'openai',
        apiHost: input.apiHost ?? 'https://example.invalid/v1',
        apiKey: input.apiKey ?? '',
        enabled: input.enabled ?? true,
      });
      await flushPendingSave();
      return id;
    },
    deleteProvider: async (id) => {
      aiActions.deleteProvider(id);
      await flushPendingSave();
    },
    setTimezone: async (offset, city) => {
      useUnifiedStore.getState().setTimezone(offset, city);
      await flushPendingSave();
    },
    setMarkdownLineNumbers: async (showLineNumbers) => {
      useUnifiedStore.getState().setMarkdownCodeBlockLineNumbers(showLineNumbers);
      await flushPendingSave();
    },
    createWindow: async (options) => {
      await desktopWindow.create(options);
    },
    createNotesFixture: async (input) => {
      const storage = getStorageAdapter();
      const basePath = await storage.getBasePath();
      const fixtureRoot = await joinPath(basePath, 'e2e-notes');
      const vaultPath = await joinPath(
        fixtureRoot,
        `vault-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      );
      await storage.mkdir(vaultPath, true);

      const notePath = await joinPath(vaultPath, input?.filename ?? 'shared.md');
      await storage.writeFile(notePath, input?.content ?? '# Shared\n\nInitial\n', { recursive: true });
      return { vaultPath, notePath };
    },
    createVaultFixture: async (input) => {
      const storage = getStorageAdapter();
      const basePath = await storage.getBasePath();
      const fixtureRoot = await joinPath(basePath, 'e2e-vaults');
      const vaultPath = await joinPath(
        fixtureRoot,
        `${input?.name ?? 'vault'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      );
      await storage.mkdir(vaultPath, true);

      const notePath = await joinPath(vaultPath, input?.filename ?? 'starred.md');
      await storage.writeFile(notePath, input?.content ?? '# Starred\n\nInitial\n', { recursive: true });
      return { vaultPath, notePath };
    },
    initializeVaultStore: async () => {
      await useVaultStore.getState().initialize();
    },
    openVault: async (path, name) => {
      return useVaultStore.getState().openVault(path, name, { preserveSidebarTree: false });
    },
    getVaultState: () => {
      const { currentVault, recentVaults, error, isLoading } = useVaultStore.getState();
      return {
        currentVault: currentVault ? { ...currentVault } : null,
        recentVaults: recentVaults.map((vault) => ({ ...vault })),
        error,
        isLoading,
      };
    },
    removeRecentVault: async (id) => {
      return useVaultStore.getState().removeFromRecent(id);
    },
    readVaultConfig: async (path) => {
      const configPath = await getVaultSystemStorePath(path, 'config.json');
      return JSON.parse(await getStorageAdapter().readFile(configPath));
    },
    openAbsoluteNote: async (path) => {
      await useNotesStore.getState().openNoteByAbsolutePath(path, true);
    },
    getNotesState: () => {
      const { currentNote, isDirty, error, openTabs } = useNotesStore.getState();
      return {
        currentNote: currentNote ? { ...currentNote } : null,
        isDirty,
        error,
        openTabs: openTabs.map((tab) => ({ ...tab })),
      };
    },
    getNotesPreferences: () => {
      const { noteIconSize, recentNotes } = useNotesStore.getState();
      return { noteIconSize, recentNotes: [...recentNotes] };
    },
    getStarredState: () => {
      const { notesPath, starredEntries, starredNotes, starredFolders, starredLoaded } = useNotesStore.getState();
      return {
        notesPath,
        starredEntries: starredEntries.map((entry: StarredEntry) => ({ ...entry })),
        starredNotes: [...starredNotes],
        starredFolders: [...starredFolders],
        starredLoaded,
      };
    },
    loadStarred: async (vaultPath) => {
      await useNotesStore.getState().loadStarred(vaultPath);
    },
    toggleStarred: async (path) => {
      useNotesStore.getState().toggleStarred(path);
      await flushStarredRegistry();
    },
    removeStarredEntry: async (id) => {
      useNotesStore.getState().removeStarredEntry(id);
      await flushStarredRegistry();
    },
    updateCurrentNoteContent: async (content) => {
      useNotesStore.getState().updateContent(content);
    },
    saveCurrentNote: async () => {
      await useNotesStore.getState().saveNote({ explicit: true });
    },
    syncCurrentNoteFromDisk: async (options) => {
      return useNotesStore.getState().syncCurrentNoteFromDisk(options);
    },
    setGlobalNoteIconSize: async (size) => {
      useNotesStore.getState().setGlobalIconSize(size);
    },
    readTextFile: async (path) => {
      return getStorageAdapter().readFile(path);
    },
    writeTextFile: async (path, content) => {
      await getStorageAdapter().writeFile(path, content, { recursive: true });
    },
    getUIState: () => {
      const {
        fontSize,
        languagePreference,
        sidebarWidth,
        imageStorageMode,
        imageSubfolderName,
        notesChatPanelCollapsed,
      } = useUIStore.getState();
      return {
        fontSize,
        languagePreference,
        sidebarWidth,
        imageStorageMode,
        imageSubfolderName,
        notesChatPanelCollapsed,
      };
    },
    setUIPreferences: async (input) => {
      const store = useUIStore.getState();
      if (typeof input.fontSize === 'number') {
        store.setFontSize(input.fontSize);
      }
      if (input.languagePreference) {
        store.setLanguagePreference(input.languagePreference as never);
      }
      if (typeof input.sidebarWidth === 'number') {
        store.setSidebarWidth(input.sidebarWidth);
      }
      if (input.imageStorageMode) {
        store.setImageStorageMode(input.imageStorageMode);
      }
      if (typeof input.imageSubfolderName === 'string') {
        store.setImageSubfolderName(input.imageSubfolderName);
      }
      if (typeof input.notesChatPanelCollapsed === 'boolean') {
        store.setNotesChatPanelCollapsed(input.notesChatPanelCollapsed);
      }
    },
    getManagedBudgetState: () => {
      const { budget, lastBudgetSyncAt, budgetError, isRefreshingBudget } = useManagedAIStore.getState();
      return { budget, lastBudgetSyncAt, budgetError, isRefreshingBudget };
    },
    applyManagedBudgetSnapshot: async (budget) => {
      useManagedAIStore.getState().applyBudgetSnapshot(budget);
    },
    clearManagedBudget: async () => {
      useManagedAIStore.getState().clearBudget();
    },
  };
}
