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
import { buildScopedModelId } from '@/lib/ai/utils';
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
import type { ChatMessage, ChatSession, MessageVersion } from '@/lib/ai/types';
import type { NotesState, StarredEntry } from '@/stores/notes/types';
import type { ManagedBudgetStatus } from '@/lib/ai/managedService';
import type { VaultInfo } from '@/stores/useVaultStore';

const E2E_LOCAL_STORAGE_KEY = 'vlaina:e2e:enabled';

export interface EditorDispatchProfileSummary {
  decorationPropTotalMs: number;
  dispatchCount: number;
  docChangedCount: number;
  insertedTextLength: number;
  maxDispatchMs: number;
  pluginApplyTotalMs: number;
  p95DispatchMs: number;
  totalDispatchMs: number;
  totalProfileMs: number;
  totalStepCount: number;
  updateStateCount: number;
  updateStateMaxMs: number;
  updateStateP95Ms: number;
  updateStateTotalMs: number;
  updateStateInnerCount: number;
  updateStateInnerMaxMs: number;
  updateStateInnerP95Ms: number;
  updateStateInnerTotalMs: number;
  slowestPluginApplies: Array<{
    count: number;
    key: string;
    maxMs: number;
    p95Ms: number;
    totalMs: number;
  }>;
  slowestDispatches: Array<{
    docChanged: boolean;
    durationMs: number;
    insertedTextLength: number;
    selectionSet: boolean;
    stepCount: number;
  }>;
  slowestDecorationProps: Array<{
    count: number;
    key: string;
    maxMs: number;
    p95Ms: number;
    totalMs: number;
  }>;
}

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
    endpointTypeCheckedAt?: number;
  }): Promise<string>;
  addModel(input: {
    providerId: string;
    apiModelId?: string;
    name?: string;
    enabled?: boolean;
    selected?: boolean;
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
        id?: string;
        role: ChatMessage['role'];
        content: string;
        modelId?: string;
        imageSources?: string[];
        apiTranscript?: ChatMessage['apiTranscript'];
        versions?: Array<{
          content: string;
          kind?: MessageVersion['kind'];
          createdAt?: number;
        }>;
        currentVersionIndex?: number;
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
  selectEditorTextByText(text: string, anchorText?: string): Promise<{
    selected: boolean;
    from: number | null;
    to: number | null;
    selectedText: string;
    timings?: Record<string, number>;
  }>;
  getEditorSelectionSummary(): {
    from: number;
    to: number;
    empty: boolean;
    selectedText: string;
    docTextLength: number;
  } | null;
  focusCurrentEditor(): Promise<boolean>;
  focusCurrentEditorAtEnd(): Promise<boolean>;
  startEditorDispatchProfile(): boolean;
  stopEditorDispatchProfile(): EditorDispatchProfileSummary | null;
  editorTextHasMark(text: string, markName: string, anchorText?: string): boolean;
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
    imageVaultSubfolderName: string;
    imageFilenameFormat: string;
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

function findEditorTextRange(text: string, anchorText?: string): { from: number; to: number } | null {
  const view = getCurrentEditorView();
  if (!view || !text) return null;

  const ranges: Array<{ from: number; to: number }> = [];
  view.state.doc.descendants((node, pos) => {
    if (!node.isText || typeof node.text !== 'string') {
      return undefined;
    }

    const index = node.text.indexOf(text);
    if (index < 0) {
      return undefined;
    }

    const from = pos + index;
    const to = from + text.length;
    if (view.state.doc.textBetween(from, to, '\n') === text) {
      ranges.push({ from, to });
      if (!anchorText) {
        return false;
      }
    }
    return undefined;
  });

  if (!ranges.length) {
    return null;
  }
  if (!anchorText) {
    return ranges[0] ?? null;
  }

  const docText = view.state.doc.textBetween(0, view.state.doc.content.size, '\n');
  const anchorDocIndex = docText.lastIndexOf(anchorText);
  if (anchorDocIndex < 0) {
    return ranges[0] ?? null;
  }

  let bestRange = ranges[0] ?? null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of ranges) {
    const prefix = view.state.doc.textBetween(0, candidate.from, '\n');
    const distance = Math.abs(prefix.length - anchorDocIndex);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRange = candidate;
    }
  }
  return bestRange;
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
    docTextLength: view.state.doc.content.size,
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

function editorTextHasMark(text: string, markName: string, anchorText?: string): boolean {
  const view = getCurrentEditorView();
  const range = findEditorTextRange(text, anchorText);
  if (!view || !range) return false;

  const markType = view.state.schema.marks[markName];
  if (!markType) return false;

  return view.state.doc.rangeHasMark(range.from, range.to, markType);
}

function normalizeE2EMessageVersions(
  message: {
    role: ChatMessage['role'];
    content: string;
    versions?: Array<{
      content: string;
      kind?: MessageVersion['kind'];
      createdAt?: number;
    }>;
    currentVersionIndex?: number;
  },
  fallbackCreatedAt: number,
): { versions: MessageVersion[]; currentVersionIndex: number; content: string } | null {
  if (!message.versions?.length && typeof message.currentVersionIndex !== 'number') {
    return null;
  }

  const sourceVersions = message.versions?.length
    ? message.versions
    : [{ content: message.content, kind: 'original' as const, createdAt: fallbackCreatedAt }];
  const versions = sourceVersions.map((version, index): MessageVersion => {
    const kind = version.kind ?? (
      index === 0
        ? 'original'
        : message.role === 'assistant'
          ? 'regeneration'
          : message.role === 'user'
            ? 'edit'
            : 'original'
    );
    return {
      content: version.content,
      createdAt: version.createdAt ?? fallbackCreatedAt + index,
      kind,
      subsequentMessages: [],
    };
  });
  const requestedIndex = Number.isInteger(message.currentVersionIndex)
    ? message.currentVersionIndex!
    : 0;
  const currentVersionIndex = Math.min(Math.max(requestedIndex, 0), versions.length - 1);
  return {
    versions,
    currentVersionIndex,
    content: versions[currentVersionIndex]?.content ?? message.content,
  };
}

async function focusCurrentEditor(): Promise<boolean> {
  const view = getCurrentEditorView();
  if (!view) return false;

  const hasEditorFocus = () => {
    const selection = document.getSelection();
    const selectionInEditor = Boolean(
      selection &&
      ((selection.anchorNode && view.dom.contains(selection.anchorNode)) ||
        (selection.focusNode && view.dom.contains(selection.focusNode)))
    );
    return (
      document.activeElement === view.dom ||
      view.dom.contains(document.activeElement) ||
      view.hasFocus() ||
      selectionInEditor
    );
  };

  window.focus();
  view.dom.focus({ preventScroll: true });
  view.focus();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return hasEditorFocus();
}

async function focusCurrentEditorAtEnd(): Promise<boolean> {
  const view = getCurrentEditorView();
  if (!view) return false;

  const hasEditorFocus = () => {
    const selection = document.getSelection();
    const selectionInEditor = Boolean(
      selection &&
      ((selection.anchorNode && view.dom.contains(selection.anchorNode)) ||
        (selection.focusNode && view.dom.contains(selection.focusNode)))
    );
    return (
      document.activeElement === view.dom ||
      view.dom.contains(document.activeElement) ||
      view.hasFocus() ||
      selectionInEditor
    );
  };

  if (document.activeElement instanceof HTMLElement && document.activeElement !== view.dom) {
    document.activeElement.blur();
  }
  window.focus();
  view.dom.focus({ preventScroll: true });
  view.focus();
  const { doc, schema } = view.state;
  const paragraph = schema.nodes.paragraph;
  let tr = view.state.tr;
  if (paragraph) {
    const insertPos = doc.content.size;
    tr = tr
      .insert(insertPos, paragraph.create())
      .setSelection(TextSelection.create(tr.doc, insertPos + 1));
  } else {
    tr = tr.setSelection(TextSelection.atEnd(tr.doc));
  }
  tr = tr
    .setMeta(floatingToolbarKey, { type: TOOLBAR_ACTIONS.HIDE })
    .setStoredMarks(null)
    .scrollIntoView();
  view.dispatch(tr);
  view.dom.focus({ preventScroll: true });
  view.focus();
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (!hasEditorFocus()) {
    view.dom.focus({ preventScroll: true });
    view.focus();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return hasEditorFocus();
}

type EditorDispatchProfileSample = {
  docChanged: boolean;
  durationMs: number;
  insertedTextLength: number;
  selectionSet: boolean;
  stepCount: number;
};

type ActiveEditorDispatchProfile = {
  decorationOriginals: Array<{
    originalDecorations: unknown;
    props: { decorations?: unknown };
  }>;
  decorationSamples: Map<string, number[]>;
  originalDispatch: unknown;
  originalUpdateState: unknown;
  originalUpdateStateInner: unknown;
  pluginOriginals: Array<{
    originalApply: unknown;
    stateSpec: { apply?: unknown };
  }>;
  pluginSamples: Map<string, number[]>;
  samples: EditorDispatchProfileSample[];
  startedAt: number;
  updateStateInnerSamples: number[];
  updateStateSamples: number[];
  view: NonNullable<ReturnType<typeof getCurrentEditorView>>;
};

let activeEditorDispatchProfile: ActiveEditorDispatchProfile | null = null;

function getTransactionInsertedTextLength(tr: unknown): number {
  const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
  let length = 0;

  for (const step of steps) {
    const content = (step as {
      slice?: {
        content?: {
          size?: number;
          textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string;
        };
      };
    }).slice?.content;
    if (!content || typeof content.size !== 'number') {
      continue;
    }
    if (typeof content.textBetween === 'function') {
      length += content.textBetween(0, content.size, '\n', '\ufffc').length;
    } else {
      length += content.size;
    }
  }

  return length;
}

function stopEditorDispatchProfile(): EditorDispatchProfileSummary | null {
  const profile = activeEditorDispatchProfile;
  if (!profile) return null;

  activeEditorDispatchProfile = null;
  (profile.view as any).dispatch = profile.originalDispatch;
  if (profile.originalUpdateState) {
    (profile.view as any).updateState = profile.originalUpdateState;
  }
  if (profile.originalUpdateStateInner) {
    (profile.view as any).updateStateInner = profile.originalUpdateStateInner;
  }
  for (const pluginOriginal of profile.pluginOriginals) {
    pluginOriginal.stateSpec.apply = pluginOriginal.originalApply;
  }
  for (const decorationOriginal of profile.decorationOriginals) {
    decorationOriginal.props.decorations = decorationOriginal.originalDecorations;
  }

  const samples = profile.samples;
  const sortedDurations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  const pick = (ratio: number) =>
    sortedDurations[Math.min(sortedDurations.length - 1, Math.max(0, Math.ceil(sortedDurations.length * ratio) - 1))] ?? 0;
  const round = (value: number) => Math.round(value * 10) / 10;
  const summarizeSamples = (values: number[]) => {
    const sortedValues = [...values].sort((a, b) => a - b);
    const pickValue = (ratio: number) =>
      sortedValues[Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * ratio) - 1))] ?? 0;
    return {
      count: values.length,
      maxMs: round(Math.max(0, ...values)),
      p95Ms: round(pickValue(0.95)),
      totalMs: round(values.reduce((sum, value) => sum + value, 0)),
    };
  };
  const pluginApplySummaries = Array.from(profile.pluginSamples.entries()).map(([key, pluginSamples]) => {
    const sortedPluginSamples = [...pluginSamples].sort((a, b) => a - b);
    const pickPlugin = (ratio: number) =>
      sortedPluginSamples[Math.min(sortedPluginSamples.length - 1, Math.max(0, Math.ceil(sortedPluginSamples.length * ratio) - 1))] ?? 0;
    return {
      count: pluginSamples.length,
      key,
      maxMs: round(Math.max(0, ...pluginSamples)),
      p95Ms: round(pickPlugin(0.95)),
      totalMs: round(pluginSamples.reduce((sum, value) => sum + value, 0)),
    };
  });
  const decorationPropSummaries = Array.from(profile.decorationSamples.entries()).map(([key, decorationSamples]) => {
    const sortedDecorationSamples = [...decorationSamples].sort((a, b) => a - b);
    const pickDecoration = (ratio: number) =>
      sortedDecorationSamples[Math.min(sortedDecorationSamples.length - 1, Math.max(0, Math.ceil(sortedDecorationSamples.length * ratio) - 1))] ?? 0;
    return {
      count: decorationSamples.length,
      key,
      maxMs: round(Math.max(0, ...decorationSamples)),
      p95Ms: round(pickDecoration(0.95)),
      totalMs: round(decorationSamples.reduce((sum, value) => sum + value, 0)),
    };
  });
  const updateStateSummary = summarizeSamples(profile.updateStateSamples);
  const updateStateInnerSummary = summarizeSamples(profile.updateStateInnerSamples);

  return {
    decorationPropTotalMs: round(decorationPropSummaries.reduce((sum, summary) => sum + summary.totalMs, 0)),
    dispatchCount: samples.length,
    docChangedCount: samples.filter((sample) => sample.docChanged).length,
    insertedTextLength: samples.reduce((sum, sample) => sum + sample.insertedTextLength, 0),
    maxDispatchMs: round(Math.max(0, ...samples.map((sample) => sample.durationMs))),
    pluginApplyTotalMs: round(pluginApplySummaries.reduce((sum, summary) => sum + summary.totalMs, 0)),
    p95DispatchMs: round(pick(0.95)),
    totalDispatchMs: round(samples.reduce((sum, sample) => sum + sample.durationMs, 0)),
    totalProfileMs: round(performance.now() - profile.startedAt),
    totalStepCount: samples.reduce((sum, sample) => sum + sample.stepCount, 0),
    updateStateCount: updateStateSummary.count,
    updateStateMaxMs: updateStateSummary.maxMs,
    updateStateP95Ms: updateStateSummary.p95Ms,
    updateStateTotalMs: updateStateSummary.totalMs,
    updateStateInnerCount: updateStateInnerSummary.count,
    updateStateInnerMaxMs: updateStateInnerSummary.maxMs,
    updateStateInnerP95Ms: updateStateInnerSummary.p95Ms,
    updateStateInnerTotalMs: updateStateInnerSummary.totalMs,
    slowestPluginApplies: pluginApplySummaries
      .sort((left, right) => right.totalMs - left.totalMs)
      .slice(0, 12),
    slowestDispatches: [...samples]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 8)
      .map((sample) => ({
        docChanged: sample.docChanged,
        durationMs: round(sample.durationMs),
        insertedTextLength: sample.insertedTextLength,
        selectionSet: sample.selectionSet,
        stepCount: sample.stepCount,
      })),
    slowestDecorationProps: decorationPropSummaries
      .sort((left, right) => right.totalMs - left.totalMs)
      .slice(0, 12),
  };
}

function getPluginProfileKey(plugin: unknown, index: number): string {
  const candidate = plugin as {
    key?: unknown;
    spec?: {
      key?: {
        key?: unknown;
      } | unknown;
    };
  };
  const key = typeof candidate.key === 'string'
    ? candidate.key
    : typeof candidate.spec?.key === 'object' && candidate.spec.key && 'key' in candidate.spec.key && typeof candidate.spec.key.key === 'string'
      ? candidate.spec.key.key
      : typeof candidate.spec?.key === 'string'
        ? candidate.spec.key
        : `plugin-${index}`;
  return key.replace(/\$\d+$/u, '');
}

function installPluginApplyProfilers(profile: ActiveEditorDispatchProfile): void {
  const fields = (profile.view.state as unknown as {
    config?: {
      fields?: readonly {
        apply?: unknown;
        name?: unknown;
      }[];
    };
  }).config?.fields;

  if (Array.isArray(fields)) {
    fields.forEach((field, index) => {
      if (typeof field.apply !== 'function') {
        return;
      }

      const originalApply = field.apply;
      const key = typeof field.name === 'string' ? field.name : `state-field-${index}`;
      profile.pluginOriginals.push({ originalApply, stateSpec: field });
      field.apply = function profiledStateFieldApply(this: unknown, ...args: unknown[]) {
        const startedAt = performance.now();
        try {
          return (originalApply as (...applyArgs: unknown[]) => unknown).apply(this, args);
        } finally {
          const samples = profile.pluginSamples.get(key) ?? [];
          samples.push(performance.now() - startedAt);
          profile.pluginSamples.set(key, samples);
        }
      };
    });
    return;
  }

  const plugins = profile.view.state.plugins as readonly unknown[];

  plugins.forEach((plugin, index) => {
    const stateSpec = (plugin as {
      spec?: {
        state?: {
          apply?: unknown;
        };
      };
    }).spec?.state;
    if (!stateSpec || typeof stateSpec.apply !== 'function') {
      return;
    }

    const originalApply = stateSpec.apply;
    const key = getPluginProfileKey(plugin, index);
    profile.pluginOriginals.push({ originalApply, stateSpec });
    stateSpec.apply = function profiledPluginApply(this: unknown, ...args: unknown[]) {
      const startedAt = performance.now();
      try {
        return (originalApply as (...applyArgs: unknown[]) => unknown).apply(this, args);
      } finally {
        const samples = profile.pluginSamples.get(key) ?? [];
        samples.push(performance.now() - startedAt);
        profile.pluginSamples.set(key, samples);
      }
    };
  });
}

function installDecorationPropProfilers(profile: ActiveEditorDispatchProfile): void {
  const plugins = profile.view.state.plugins as readonly unknown[];

  plugins.forEach((plugin, index) => {
    const props = (plugin as {
      props?: {
        decorations?: unknown;
      };
    }).props;
    if (!props || typeof props.decorations !== 'function') {
      return;
    }

    const originalDecorations = props.decorations;
    const key = getPluginProfileKey(plugin, index);
    profile.decorationOriginals.push({ originalDecorations, props });
    props.decorations = function profiledDecorations(this: unknown, ...args: unknown[]) {
      const startedAt = performance.now();
      try {
        return (originalDecorations as (...decorationsArgs: unknown[]) => unknown).apply(this, args);
      } finally {
        const samples = profile.decorationSamples.get(key) ?? [];
        samples.push(performance.now() - startedAt);
        profile.decorationSamples.set(key, samples);
      }
    };
  });
}

function startEditorDispatchProfile(): boolean {
  const view = getCurrentEditorView();
  if (!view) return false;

  stopEditorDispatchProfile();

  const originalDispatch = view.dispatch;
  const originalUpdateState = (view as any).updateState;
  const originalUpdateStateInner = (view as any).updateStateInner;
  const profile: ActiveEditorDispatchProfile = {
    decorationOriginals: [],
    decorationSamples: new Map(),
    originalDispatch,
    originalUpdateState,
    originalUpdateStateInner,
    pluginOriginals: [],
    pluginSamples: new Map(),
    samples: [],
    startedAt: performance.now(),
    updateStateInnerSamples: [],
    updateStateSamples: [],
    view,
  };

  installPluginApplyProfilers(profile);
  installDecorationPropProfilers(profile);

  if (typeof originalUpdateState === 'function') {
    (view as any).updateState = function profiledUpdateState(this: unknown, ...args: unknown[]) {
      const startedAt = performance.now();
      try {
        return originalUpdateState.apply(this, args);
      } finally {
        profile.updateStateSamples.push(performance.now() - startedAt);
      }
    };
  }

  if (typeof originalUpdateStateInner === 'function') {
    (view as any).updateStateInner = function profiledUpdateStateInner(this: unknown, ...args: unknown[]) {
      const startedAt = performance.now();
      try {
        return originalUpdateStateInner.apply(this, args);
      } finally {
        profile.updateStateInnerSamples.push(performance.now() - startedAt);
      }
    };
  }

  (view as any).dispatch = function profiledDispatch(this: unknown, tr: unknown) {
    const startedAt = performance.now();
    try {
      return (originalDispatch as (this: unknown, tr: unknown) => unknown).call(this, tr);
    } finally {
      profile.samples.push({
        docChanged: Boolean((tr as { docChanged?: boolean }).docChanged),
        durationMs: performance.now() - startedAt,
        insertedTextLength: getTransactionInsertedTextLength(tr),
        selectionSet: Boolean((tr as { selectionSet?: boolean }).selectionSet),
        stepCount: (tr as { steps?: readonly unknown[] }).steps?.length ?? 0,
      });
    }
  };
  activeEditorDispatchProfile = profile;

  return true;
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
        ...(typeof input.endpointTypeCheckedAt === 'number' ? { endpointTypeCheckedAt: input.endpointTypeCheckedAt } : {}),
        apiHost: input.apiHost ?? 'https://example.invalid/v1',
        apiKey: input.apiKey ?? '',
        enabled: input.enabled ?? true,
      });
      await flushPendingSave();
      return id;
    },
    addModel: async (input) => {
      const apiModelId = input.apiModelId ?? `e2e-model-${Date.now().toString(36)}`;
      providerActions.addModel({
        providerId: input.providerId,
        apiModelId,
        id: buildScopedModelId(input.providerId, apiModelId),
        name: input.name ?? apiModelId,
        enabled: input.enabled ?? true,
      });
      const modelId = buildScopedModelId(input.providerId, apiModelId);
      if (input.selected !== false) {
        providerActions.selectModel(modelId);
      }
      await flushPendingSave();
      return modelId;
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
          const messageId = chatActions.addMessage(
            {
              id: message.id,
              role: message.role,
              content: message.content,
              imageSources: message.imageSources,
              apiTranscript: message.apiTranscript,
              modelId: message.modelId ?? '',
            },
            sessionId,
            {
              persistUnified: false,
              touchSession: true,
            },
          );
          if (!messageId) {
            continue;
          }

          const normalizedVersions = normalizeE2EMessageVersions(message, Date.now());
          if (!normalizedVersions) {
            continue;
          }

          const state = useUnifiedStore.getState();
          const ai = state.data.ai;
          const sessionMessages = ai?.messages[sessionId] ?? [];
          state.updateAIData({
            messages: {
              ...(ai?.messages ?? {}),
              [sessionId]: sessionMessages.map((existingMessage) =>
                existingMessage.id === messageId
                  ? {
                      ...existingMessage,
                      content: normalizedVersions.content,
                      versions: normalizedVersions.versions,
                      currentVersionIndex: normalizedVersions.currentVersionIndex,
                    }
                  : existingMessage
              ),
            },
          }, true);
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
    selectEditorTextByText: async (text, anchorText) => {
      const startedAt = performance.now();
      const view = getCurrentEditorView();
      const viewResolvedAt = performance.now();
      const range = findEditorTextRange(text, anchorText);
      const rangeResolvedAt = performance.now();
      if (!view || !range) {
        return {
          selected: false,
          from: null,
          to: null,
          selectedText: '',
          timings: {
            totalMs: Math.round((performance.now() - startedAt) * 10) / 10,
            viewMs: Math.round((viewResolvedAt - startedAt) * 10) / 10,
            rangeMs: Math.round((rangeResolvedAt - viewResolvedAt) * 10) / 10,
            focusMs: 0,
            dispatchMs: 0,
            rafMs: 0,
            summaryMs: 0,
          },
        };
      }

      window.focus();
      view.dom.focus({ preventScroll: true });
      const focusResolvedAt = performance.now();
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
      const dispatchedAt = performance.now();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const rafSettledAt = performance.now();
      const summary = getEditorSelectionSummary();
      const summaryResolvedAt = performance.now();
      return {
        selected: summary?.selectedText === text,
        from: range.from,
        to: range.to,
        selectedText: summary?.selectedText ?? '',
        timings: {
          totalMs: Math.round((summaryResolvedAt - startedAt) * 10) / 10,
          viewMs: Math.round((viewResolvedAt - startedAt) * 10) / 10,
          rangeMs: Math.round((rangeResolvedAt - viewResolvedAt) * 10) / 10,
          focusMs: Math.round((focusResolvedAt - rangeResolvedAt) * 10) / 10,
          dispatchMs: Math.round((dispatchedAt - focusResolvedAt) * 10) / 10,
          rafMs: Math.round((rafSettledAt - dispatchedAt) * 10) / 10,
          summaryMs: Math.round((summaryResolvedAt - rafSettledAt) * 10) / 10,
        },
      };
    },
    getEditorSelectionSummary,
    focusCurrentEditor,
    focusCurrentEditorAtEnd,
    startEditorDispatchProfile,
    stopEditorDispatchProfile,
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
        imageVaultSubfolderName,
        imageFilenameFormat,
        notesChatPanelCollapsed,
      } = useUIStore.getState();
      return {
        fontSize,
        languagePreference,
        sidebarWidth,
        imageStorageMode,
        imageSubfolderName,
        imageVaultSubfolderName,
        imageFilenameFormat,
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
