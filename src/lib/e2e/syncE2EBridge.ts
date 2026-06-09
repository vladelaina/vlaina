import { actions as providerActions } from '@/stores/ai/providerActions';
import { createChatActions } from '@/stores/ai/chatActions';
import { createAIChatSession, useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { desktopWindow } from '@/lib/desktop/window';
import { getElectronBridge } from '@/lib/electron/bridge';
import { TextSelection } from '@milkdown/kit/prose/state';
import { saveSessionJson } from '@/lib/storage/chatStorage';
import { flushPendingSave } from '@/lib/storage/unifiedStorage';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import {
  getImportedMarkdownThemesDirectoryPath,
  syncImportedMarkdownThemesFromDirectory,
} from '@/lib/markdown/theme-compatibility/importedThemeStorage';
import type { ImportedMarkdownThemeMetadata } from '@/lib/markdown/theme-compatibility/types';
import { getVaultSystemStorePath } from '@/stores/notes/systemStoragePaths';
import { flushStarredRegistry } from '@/stores/notes/starred';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import { getCurrentEditorView } from '@/components/Notes/features/Editor/utils/editorViewRegistry';
import { collectSelectableBlockTargets } from '@/components/Notes/features/Editor/plugins/cursor/blockUnitResolver';
import { dispatchBlockSelectionAction } from '@/components/Notes/features/Editor/plugins/cursor/blockSelectionPluginState';
import { floatingToolbarKey } from '@/components/Notes/features/Editor/plugins/floating-toolbar/floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '@/components/Notes/features/Editor/plugins/floating-toolbar/types';
import type { UnifiedData } from '@/lib/storage/unifiedStorageTypes';
import type { ChatMessage, ChatSession } from '@/lib/ai/types';
import type { NotesState, StarredEntry } from '@/stores/notes/types';
import type { ManagedBudgetStatus } from '@/lib/ai/managedService';
import type { VaultInfo } from '@/stores/useVaultStore';

const E2E_LOCAL_STORAGE_KEY = 'vlaina:e2e:enabled';

export interface E2EBridge {
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
  getImportedMarkdownThemesDirectoryPath(): Promise<string>;
  syncImportedMarkdownThemesFromDirectory(): Promise<{
    directoryPath: string;
    themes: ImportedMarkdownThemeMetadata[];
    activeThemeId: string | null;
  }>;
  setMarkdownImportedThemeId(importedThemeId: string | null): Promise<void>;
  createWindow(options?: { viewMode?: 'notes' | 'chat' | null }): Promise<void>;
  createNotesFixture(input?: { filename?: string; content?: string }): Promise<{
    vaultPath: string;
    notePath: string;
  }>;
  createVaultFixture(input?: { name?: string; filename?: string; content?: string }): Promise<{
    vaultPath: string;
    notePath: string;
  }>;
  createVaultFilesFixture(input: {
    name?: string;
    files: Array<{
      filename: string;
      content: string;
    }>;
  }): Promise<{
    vaultPath: string;
    notePaths: string[];
  }>;
  createChatFixture(input: {
    sessions: Array<{
      title: string;
      preloadMessages?: boolean;
      messages: Array<{
        role: ChatMessage['role'];
        content: string;
        modelId?: string;
      }>;
    }>;
    activeSessionIndex?: number;
  }): Promise<{
    sessionIds: string[];
    activeSessionId: string | null;
  }>;
  switchChatSession(id: string): Promise<void>;
  getChatState(): {
    currentSessionId: string | null;
    sessions: ChatSession[];
    messages: Record<string, ChatMessage[]>;
  };
  setAppViewMode(mode: 'notes' | 'chat'): Promise<void>;
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
  openAbsoluteNoteWithTiming(path: string): Promise<{
    totalMs: number;
    currentNoteContentLength: number;
    currentNotePath: string | null;
  }>;
  getNoteSelectableBlocks(): Array<{
    text: string;
    tagName: string;
    from: number;
    to: number;
  }>;
  selectEditorTextByText(text: string): Promise<{
    selected: boolean;
    from: number | null;
    to: number | null;
    selectedText: string;
  }>;
  getEditorSelectionSummary(): {
    from: number;
    to: number;
    empty: boolean;
    selectedText: string;
    docTextLength: number;
  } | null;
  focusCurrentEditor(): Promise<boolean>;
  editorTextHasMark(text: string, markName: string): boolean;
  getEditorToolbarDebugState(): {
    selection: ReturnType<typeof getEditorSelectionSummary>;
    activeElement: {
      tagName: string;
      className: string;
      isEditor: boolean;
    } | null;
    toolbarState: {
      isVisible: boolean;
      subMenu: string | null;
      copied: boolean;
    } | null;
    toolbarDom: {
      exists: boolean;
      className: string;
      text: string;
      rect: { x: number; y: number; width: number; height: number } | null;
    };
  };
  writeClipboardText(text: string): Promise<void>;
  flushCurrentEditorMarkdown(): Promise<boolean>;
  selectNoteBlocksByText(texts: string[]): Promise<number>;
  selectNoteBlocksByIndexes(indexes: number[]): Promise<number>;
  getNotesState(): Pick<NotesState, 'currentNote' | 'isDirty' | 'error' | 'openTabs'>;
  getNoteContentCacheEntry(path: string): {
    hasEntry: boolean;
    contentLength: number;
    contentPreview: string;
    freshUntil: number | null;
    modifiedAt: number | null;
    currentNotePath: string | null;
    openTabPaths: string[];
    cacheKeys: string[];
  };
  pruneNoteContentsCacheToOpenNotes(): void;
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

function findEditorTextRange(text: string): { from: number; to: number } | null {
  const view = getCurrentEditorView();
  if (!view || !text) return null;

  let range: { from: number; to: number } | null = null;
  view.state.doc.descendants((node, pos) => {
    if (range || !node.isText || typeof node.text !== 'string') {
      return;
    }

    const index = node.text.indexOf(text);
    if (index < 0) {
      return;
    }

    const from = pos + index;
    const to = from + text.length;
    if (view.state.doc.textBetween(from, to, '\n') === text) {
      range = { from, to };
    }
  });
  return range;
}

function getEditorSelectionSummary() {
  const view = getCurrentEditorView();
  if (!view) return null;

  const { from, to, empty } = view.state.selection;
  return {
    from,
    to,
    empty,
    selectedText: from < to ? view.state.doc.textBetween(from, to, '\n') : '',
    docTextLength: view.state.doc.textContent.length,
  };
}

function getEditorToolbarDebugState() {
  const view = getCurrentEditorView();
  const toolbarState = view ? floatingToolbarKey.getState(view.state) : null;
  const toolbar = document.querySelector<HTMLElement>('.floating-toolbar');
  const rect = toolbar?.getBoundingClientRect();
  const activeElement = document.activeElement;

  return {
    selection: getEditorSelectionSummary(),
    activeElement: activeElement instanceof HTMLElement
      ? {
          tagName: activeElement.tagName,
          className: activeElement.className,
          isEditor: activeElement === view?.dom || activeElement.closest('.ProseMirror') === view?.dom,
        }
      : null,
    toolbarState: toolbarState
      ? {
          isVisible: toolbarState.isVisible,
          subMenu: toolbarState.subMenu,
          copied: toolbarState.copied,
          selectionRange: toolbarState.selectionRange,
        }
      : null,
    toolbarDoms: Array.from(document.querySelectorAll<HTMLElement>('.floating-toolbar')).map((element) => {
      const elementRect = element.getBoundingClientRect();
      return {
        className: element.className,
        text: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200) ?? '',
        rect: {
          x: elementRect.x,
          y: elementRect.y,
          width: elementRect.width,
          height: elementRect.height,
        },
      };
    }),
    toolbarDom: {
      exists: Boolean(toolbar),
      className: toolbar?.className ?? '',
      text: toolbar?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200) ?? '',
      rect: rect
        ? {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          }
        : null,
    },
  };
}

function editorTextHasMark(text: string, markName: string): boolean {
  const view = getCurrentEditorView();
  const range = findEditorTextRange(text);
  if (!view || !range) return false;

  const markType = view.state.schema.marks[markName];
  if (!markType) return false;

  return view.state.doc.rangeHasMark(range.from, range.to, markType);
}

async function focusCurrentEditor(): Promise<boolean> {
  const view = getCurrentEditorView();
  if (!view) return false;

  window.focus();
  view.dom.focus({ preventScroll: true });
  view.focus();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return document.activeElement === view.dom || view.dom.contains(document.activeElement);
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
      const id = providerActions.addProvider({
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
      providerActions.deleteProvider(id);
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
    getImportedMarkdownThemesDirectoryPath,
    syncImportedMarkdownThemesFromDirectory,
    setMarkdownImportedThemeId: async (importedThemeId) => {
      useUnifiedStore.getState().setMarkdownImportedThemeId(importedThemeId);
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
    createVaultFilesFixture: async (input) => {
      const storage = getStorageAdapter();
      const basePath = await storage.getBasePath();
      const fixtureRoot = await joinPath(basePath, 'e2e-vaults');
      const vaultPath = await joinPath(
        fixtureRoot,
        `${input.name ?? 'vault-files'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      );
      await storage.mkdir(vaultPath, true);

      const notePaths: string[] = [];
      for (const file of input.files) {
        const notePath = await joinPath(vaultPath, file.filename);
        await storage.writeFile(notePath, file.content, { recursive: true });
        notePaths.push(notePath);
      }

      return { vaultPath, notePaths };
    },
    createChatFixture: async (input) => {
      const chatActions = createChatActions();
      const sessionIds: string[] = [];

      for (const session of input.sessions) {
        const sessionId = createAIChatSession(session.title);
        sessionIds.push(sessionId);

        for (const message of session.messages) {
          chatActions.addMessage(
            {
              role: message.role,
              content: message.content,
              modelId: message.modelId ?? '',
            },
            sessionId,
            {
              persistUnified: false,
              touchSession: true,
            },
          );
        }
      }

      const activeSessionId = sessionIds[input.activeSessionIndex ?? 0] ?? sessionIds[0] ?? null;
      if (activeSessionId) {
        await chatActions.switchSession(activeSessionId);
        const state = useUnifiedStore.getState();
        state.updateAIData({ currentSessionId: activeSessionId });
        useAIUIStore.getState().setChatSelection({
          currentSessionId: activeSessionId,
          temporaryChatEnabled: false,
        });
      }

      const ai = useUnifiedStore.getState().data.ai;
      await Promise.all(sessionIds.map((sessionId) => saveSessionJson(sessionId, ai?.messages[sessionId] ?? [])));
      const unloadedSessionIds = sessionIds.filter((sessionId, index) => {
        if (sessionId === activeSessionId) {
          return false;
        }
        return input.sessions[index]?.preloadMessages === false;
      });
      if (unloadedSessionIds.length > 0) {
        const latestAI = useUnifiedStore.getState().data.ai;
        const nextMessages = { ...(latestAI?.messages ?? {}) };
        unloadedSessionIds.forEach((sessionId) => {
          delete nextMessages[sessionId];
        });
        useUnifiedStore.getState().updateAIData({ messages: nextMessages }, true);
      }
      await flushPendingSave();
      return { sessionIds, activeSessionId };
    },
    switchChatSession: async (id) => {
      const chatActions = createChatActions();
      await chatActions.switchSession(id);
      useUnifiedStore.getState().updateAIData({ currentSessionId: id });
      useAIUIStore.getState().setChatSelection({
        currentSessionId: id,
        temporaryChatEnabled: false,
      });
      await flushPendingSave();
    },
    getChatState: () => {
      const ai = useUnifiedStore.getState().data.ai;
      return {
        currentSessionId: useAIUIStore.getState().currentSessionId,
        sessions: ai?.sessions.map((session) => ({ ...session })) ?? [],
        messages: Object.fromEntries(
          Object.entries(ai?.messages ?? {}).map(([sessionId, messages]) => [
            sessionId,
            messages.map((message) => ({
              ...message,
              versions: message.versions.map((version) => ({
                ...version,
                subsequentMessages: [...(version.subsequentMessages ?? [])],
              })),
            })),
          ]),
        ),
      };
    },
    setAppViewMode: async (mode) => {
      useUIStore.getState().setAppViewMode(mode);
      await flushPendingSave();
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
    openAbsoluteNoteWithTiming: async (path) => {
      const startedAt = performance.now();
      await useNotesStore.getState().openNoteByAbsolutePath(path, true);
      const state = useNotesStore.getState();
      return {
        totalMs: performance.now() - startedAt,
        currentNoteContentLength: state.currentNote?.content.length ?? 0,
        currentNotePath: state.currentNote?.path ?? null,
      };
    },
    getNoteSelectableBlocks: () => {
      const view = getCurrentEditorView();
      if (!view) return [];
      return collectSelectableBlockTargets(view).map((target) => ({
        text: target.element.textContent?.trim() ?? '',
        tagName: target.element.tagName,
        from: target.range.from,
        to: target.range.to,
      }));
    },
    selectEditorTextByText: async (text) => {
      const view = getCurrentEditorView();
      const range = findEditorTextRange(text);
      if (!view || !range) {
        return {
          selected: false,
          from: null,
          to: null,
          selectedText: '',
        };
      }

      window.focus();
      view.dom.focus({ preventScroll: true });
      view.dispatch(
        view.state.tr
          .setSelection(TextSelection.create(view.state.doc, range.from, range.to))
          .setMeta(floatingToolbarKey, {
            type: TOOLBAR_ACTIONS.SHOW,
            payload: {
              selectionRange: {
                from: range.from,
                to: range.to,
              },
            },
          })
          .scrollIntoView()
      );
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const summary = getEditorSelectionSummary();
      return {
        selected: summary?.selectedText === text,
        from: range.from,
        to: range.to,
        selectedText: summary?.selectedText ?? '',
      };
    },
    getEditorSelectionSummary,
    focusCurrentEditor,
    editorTextHasMark,
    getEditorToolbarDebugState,
    writeClipboardText: async (text) => {
      const desktopClipboard = getElectronBridge()?.clipboard;
      if (desktopClipboard?.writeText) {
        await desktopClipboard.writeText(text);
        return;
      }
      await navigator.clipboard.writeText(text);
    },
    flushCurrentEditorMarkdown: async () => {
      const flushed = flushCurrentPendingEditorMarkdown();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return flushed;
    },
    selectNoteBlocksByText: async (texts) => {
      const view = getCurrentEditorView();
      if (!view) return 0;
      const targets = collectSelectableBlockTargets(view);
      const ranges = texts.flatMap((text) => {
        const target = targets.find((candidate) => candidate.element.textContent?.includes(text));
        return target ? [target.range] : [];
      });
      dispatchBlockSelectionAction(view, ranges.length > 0
        ? { type: 'set-blocks', blocks: ranges }
        : { type: 'clear-blocks' });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return ranges.length;
    },
    selectNoteBlocksByIndexes: async (indexes) => {
      const view = getCurrentEditorView();
      if (!view) return 0;
      const targets = collectSelectableBlockTargets(view);
      const ranges = indexes.flatMap((index) => {
        const target = targets[index];
        return target ? [target.range] : [];
      });
      dispatchBlockSelectionAction(view, ranges.length > 0
        ? { type: 'set-blocks', blocks: ranges }
        : { type: 'clear-blocks' });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return ranges.length;
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
    getNoteContentCacheEntry: (path) => {
      const { currentNote, noteContentsCache, openTabs } = useNotesStore.getState();
      const entry = noteContentsCache.get(path);
      return {
        hasEntry: Boolean(entry),
        contentLength: entry?.content.length ?? 0,
        contentPreview: entry?.content.slice(0, 200) ?? '',
        freshUntil: entry?.freshUntil ?? null,
        modifiedAt: entry?.modifiedAt ?? null,
        currentNotePath: currentNote?.path ?? null,
        openTabPaths: openTabs.map((tab) => tab.path),
        cacheKeys: Array.from(noteContentsCache.keys()),
      };
    },
    pruneNoteContentsCacheToOpenNotes: () => {
      const store = useNotesStore.getState();
      store.cancelNoteContentScan();
      store.pruneNoteContentsCacheToOpenNotes();
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
