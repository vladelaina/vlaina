import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  parserCtx,
  prosePluginsCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { tableBlock } from '@milkdown/kit/component/table-block';
import type { Ctx } from '@milkdown/kit/ctx';
import { Slice, type Node as ProseNode, type Schema } from '@milkdown/kit/prose/model';
import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { Parser } from '@milkdown/kit/transformer';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import {
  selectMarkdownImportedThemeId,
  selectMarkdownTypewriterModeEnabled,
} from '@/stores/unified/settings/markdownSettings';
import { useImportedMarkdownThemePlatform } from '@/components/markdown-theme/useImportedMarkdownThemePlatform';
import { cn } from '@/lib/utils';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { stripManagedFrontmatter } from '@/stores/notes/frontmatter';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import {
  normalizeAlternativeMathBlockFences,
  normalizeEditorStateMarkdownDocument,
  preserveMarkdownBlankLinesForEditor,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { themeEditorLayoutTokens } from '@/styles/themeTokens';
import { configureTheme } from './theme';
import { customPlugins } from './config/plugins';
import { notesRemarkStringifyOptions } from './config/stringifyOptions';
import { useEditorSave } from './hooks/useEditorSave';
import { usePendingMarkdownAutosave } from './hooks/usePendingMarkdownAutosave';
import {
  clearCurrentMarkdownRuntime,
  getCurrentEditorView,
  setCurrentEditorView,
  setCurrentMarkdownRuntime,
} from './utils/editorViewRegistry';
import {
  clearCurrentEditorBlockPositionSnapshot,
  createCurrentEditorBlockPositionController,
} from './utils/editorBlockPositionCache';
import {
  normalizeLeadingFrontmatterMarkdown,
} from './plugins/frontmatter/frontmatterMarkdown';
import { createDeferredMarkdownUpdatePlugin } from './utils/deferredMarkdownUpdatePlugin';
import { serializeEditorMarkdownSnapshot } from './utils/pendingMarkdownUpdate';
import { createDocumentStartTextSelection } from './utils/editorSelection';
import { BodyLineNumberGutter } from './components/BodyLineNumberGutter';
import {
  blankAreaDragBoxPluginKey,
  CLEAR_BLOCKS_ACTION,
} from './plugins/cursor/blockSelectionPluginState';
import {
  applyMarkdownThemeRuntimeAttributes,
  resolveMarkdownThemeRuntimeColorScheme,
  resolveMarkdownThemeViewport,
  resolveTyporaRuntimePlatformClasses,
} from './markdownThemeRuntime';

interface MilkdownEditorInnerProps {
  active?: boolean;
  showBodyLineNumbers?: boolean;
  onEditorViewReady?: () => void;
}

export function MilkdownEditorRuntime({
  active = true,
  showBodyLineNumbers = false,
  onEditorViewReady,
}: MilkdownEditorInnerProps) {
  return (
    <MilkdownProvider>
      <MilkdownEditorInner
        active={active}
        showBodyLineNumbers={showBodyLineNumbers}
        onEditorViewReady={onEditorViewReady}
      />
    </MilkdownProvider>
  );
}

type ActiveMilkdownEditor = {
  ctx: {
    get: (slice: unknown) => unknown;
  };
  action?: <T>(action: (ctx: Ctx) => T) => T;
  onStatusChange?: (onChange: (status: string) => void) => unknown;
};

type ProseMirrorJSONNode = {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  content?: ProseMirrorJSONNode[];
};

type MilkdownDefaultValue =
  | string
  | {
      type: 'json';
      value: ProseMirrorJSONNode;
    };

function logE2EMilkdownTiming(label: string, detail: Record<string, unknown>): void {
  if (
    typeof window === 'undefined' ||
    !(window as { __vlainaE2E?: unknown }).__vlainaE2E
  ) {
    return;
  }

  console.info(`[notes-milkdown-timing:${label}]`, {
    ...detail,
    atMs: Math.round(performance.now()),
  });
}

const LARGE_PLAIN_MARKDOWN_FAST_PARSE_MIN_LENGTH = 1_000_000;
const MARKDOWN_BLANK_LINE_COMMENT = '<!--vlaina-markdown-blank-line-->';
const FAST_PARSE_DISALLOWED_TEXT_PATTERN = /[`*_~[\]()<>\\|&]/;
const FAST_PARSE_GFM_AUTOLINK_TEXT_PATTERN = /(?:https?:\/\/|www\.|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i;
const FAST_PARSE_HEADING_PATTERN = /^(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/;
const FAST_PARSE_STRUCTURAL_LINE_PATTERN = /^(?: {0,3})(?:[-+*]\s+|\d+[.)]\s+|:\s+|(?:[-*_][ \t]*){3,}$|=+[ \t]*$)/;

function needsFullMarkdownInlineParsing(text: string): boolean {
  return FAST_PARSE_DISALLOWED_TEXT_PATTERN.test(text) || FAST_PARSE_GFM_AUTOLINK_TEXT_PATTERN.test(text);
}

export function shouldUseLazyBlockVisibility(markdown: string): boolean {
  return createLargePlainMarkdownDocJSON(markdown) !== null;
}

export function createLargePlainMarkdownDocJSON(markdown: string): ProseMirrorJSONNode | null {
  if (markdown.length < LARGE_PLAIN_MARKDOWN_FAST_PARSE_MIN_LENGTH || markdown.includes('\r')) {
    return null;
  }

  const content: ProseMirrorJSONNode[] = [];
  let lineStart = 0;
  let previousLineWasParagraph = false;
  while (lineStart < markdown.length) {
    const nextBreak = markdown.indexOf('\n', lineStart);
    const lineEnd = nextBreak === -1 ? markdown.length : nextBreak;
    const line = markdown.slice(lineStart, lineEnd);
    const trimmed = line.trim();
    if (!trimmed) {
      previousLineWasParagraph = false;
      if (nextBreak === -1) {
        break;
      }
      lineStart = nextBreak + 1;
      continue;
    }

    if (trimmed === MARKDOWN_BLANK_LINE_COMMENT) {
      content.push({
        type: 'html_block',
        attrs: { value: MARKDOWN_BLANK_LINE_COMMENT },
      });
      previousLineWasParagraph = false;
      if (nextBreak === -1) {
        break;
      }
      lineStart = nextBreak + 1;
      continue;
    }

    const headingMatch = FAST_PARSE_HEADING_PATTERN.exec(line);
    if (headingMatch) {
      const text = (headingMatch[2] ?? '').replace(/(?:^|[ \t]+)#+[ \t]*$/, '').trimEnd();
      if (!text || needsFullMarkdownInlineParsing(text)) {
        return null;
      }
      content.push({
        type: 'heading',
        attrs: { level: Math.min(6, headingMatch[1]?.length ?? 1) },
        content: [{ type: 'text', text: text.trimEnd() }],
      });
      previousLineWasParagraph = false;
      if (nextBreak === -1) {
        break;
      }
      lineStart = nextBreak + 1;
      continue;
    }

    if (
      /^\s/.test(line)
      || FAST_PARSE_STRUCTURAL_LINE_PATTERN.test(line)
      || needsFullMarkdownInlineParsing(line)
    ) {
      return null;
    }

    if (previousLineWasParagraph) {
      return null;
    }

    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    });
    previousLineWasParagraph = true;

    if (nextBreak === -1) {
      break;
    }
    lineStart = nextBreak + 1;
  }

  return content.length > 0 ? { type: 'doc', content } : null;
}

function createLargePlainMarkdownDoc(schema: Schema, markdown: string): ProseNode | null {
  const json = createLargePlainMarkdownDocJSON(markdown);
  if (!json) {
    return null;
  }

  try {
    return schema.nodeFromJSON(json);
  } catch {
    return null;
  }
}

interface ReplaceEditorMarkdownOptions {
  resetSelection?: boolean;
}

function canPreserveSelection(
  doc: unknown,
  selection: unknown,
): doc is ProseNode {
  return Boolean(
    doc &&
    typeof (doc as { resolve?: unknown }).resolve === 'function' &&
    selection &&
    typeof (selection as { from?: unknown }).from === 'number' &&
    typeof (selection as { to?: unknown }).to === 'number'
  );
}

function createInlineTextSelection(doc: ProseNode, from: number, to = from): TextSelection | null {
  try {
    const $from = doc.resolve(from);
    const $to = doc.resolve(to);
    if (!$from.parent.inlineContent || !$to.parent.inlineContent) {
      return null;
    }
    return TextSelection.create(doc, from, to);
  } catch {
    return null;
  }
}

function createPreservedEditorSelection(doc: ProseNode, previousSelection: Selection): Selection {
  const maxPos = doc.content.size;
  const clampPos = (pos: number) => Math.max(0, Math.min(maxPos, pos));

  if (previousSelection.empty) {
    const pos = clampPos(previousSelection.from);
    const textSelection = createInlineTextSelection(doc, pos);
    if (textSelection) {
      return textSelection;
    }
    try {
      return Selection.near(doc.resolve(pos), previousSelection.from >= maxPos ? -1 : 1);
    } catch {
      return createDocumentStartTextSelection(doc);
    }
  }

  const from = clampPos(previousSelection.from);
  const to = clampPos(previousSelection.to);
  if (from < to) {
    const textSelection = createInlineTextSelection(doc, from, to);
    if (textSelection) {
      return textSelection;
    }
  }

  try {
    return Selection.near(doc.resolve(from), 1);
  } catch {
    return createDocumentStartTextSelection(doc);
  }
}

export function normalizeInitialEditorSelection(view: EditorView): boolean {
  const nextSelection = createDocumentStartTextSelection(view.state.doc);
  if (!(nextSelection instanceof TextSelection) || nextSelection.eq(view.state.selection)) {
    return false;
  }

  view.dispatch(
    view.state.tr
      .setSelection(nextSelection)
      .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION)
  );
  return true;
}

export function replaceEditorMarkdown(
  ctx: Ctx,
  markdown: string,
  options: ReplaceEditorMarkdownOptions = {},
): boolean {
  let view: EditorView;
  let doc: ReturnType<Parser> | ProseNode | null;

  try {
    view = ctx.get(editorViewCtx);
    const fastDocStartedAt = performance.now();
    doc = createLargePlainMarkdownDoc(view.state.schema, markdown);
    if (doc) {
      logE2EMilkdownTiming('replace-fast-doc', {
        inputLength: markdown.length,
        durationMs: Math.round(performance.now() - fastDocStartedAt),
      });
    } else {
      const parser = ctx.get(parserCtx);
      doc = parser(markdown);
    }
  } catch {
    return false;
  }

  if (!doc) {
    return false;
  }

  const { state } = view;
  const previousSelection = state.selection;
  let tr = state.tr.replace(
    0,
    state.doc.content.size,
    new Slice(doc.content as never, 0, 0),
  );

  if (options.resetSelection) {
    tr = tr
      .setSelection(createDocumentStartTextSelection(tr.doc))
      .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  } else if (canPreserveSelection(tr.doc, previousSelection)) {
    tr = tr.setSelection(createPreservedEditorSelection(tr.doc, previousSelection));
  }

  view.dispatch(tr);
  return true;
}

function normalizeComparableEditorMarkdown(markdown: string): string {
  return normalizeEditorStateMarkdownDocument(stripManagedFrontmatter(markdown));
}

export function isEditorMarkdownEquivalentToNoteContent(
  editorMarkdown: string,
  noteContent: string,
): boolean {
  const serializedEditorMarkdown = serializeEditorMarkdownSnapshot(editorMarkdown, noteContent);
  return (
    normalizeComparableEditorMarkdown(serializedEditorMarkdown) ===
    normalizeComparableEditorMarkdown(noteContent)
  );
}

export const MilkdownEditorInner = React.memo(function MilkdownEditorInner({
  active = true,
  showBodyLineNumbers = false,
  onEditorViewReady,
}: MilkdownEditorInnerProps) {
  const updateContent = useNotesStore(s => s.updateContent);
  const saveNote = useNotesStore(s => s.saveNote);
  const isNewlyCreated = useNotesStore(s => s.isNewlyCreated);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const currentNoteContent = useNotesStore(s => s.currentNote?.content ?? '');
  const currentNoteDiskRevision = useNotesStore(s => s.currentNoteDiskRevision);
  const importedMarkdownThemeId = useUnifiedStore(selectMarkdownImportedThemeId);
  const typewriterMode = useUnifiedStore(selectMarkdownTypewriterModeEnabled);
  const { resolvedTheme } = useTheme();
  const appMarkdownThemeColorScheme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const importedMarkdownThemePlatform = useImportedMarkdownThemePlatform(importedMarkdownThemeId);
  const [markdownThemeViewport, setMarkdownThemeViewport] = useState(() =>
    resolveMarkdownThemeViewport(typeof window === 'undefined' ? 1024 : window.innerWidth)
  );
  const currentNoteContentRef = useRef(useNotesStore.getState().currentNote?.content ?? '');
  const lastAppliedNoteRef = useRef({
    path: currentNotePath,
    diskRevision: currentNoteDiskRevision,
    content: currentNoteContentRef.current,
  });
  const isDraftNote = isDraftNotePath(currentNotePath);
  const onEditorViewReadyRef = useRef(onEditorViewReady);
  const activeRef = useRef(active);

  const hasAutoFocused = useRef(false);
  const hasScheduledAutoFocus = useRef(false);
  const activatedEditorRef = useRef<ActiveMilkdownEditor | null>(null);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const activationCleanupRef = useRef<(() => void) | null>(null);
  const lazyBlockVisibilityRef = useRef<{
    content: string;
    diskRevision: number;
    path: string | undefined;
    value: boolean;
  } | null>(null);
  const [activatedRevision, setActivatedRevision] = useState(0);
  const { debouncedSave, flushSave } = useEditorSave(saveNote);
  const markLocalMarkdownCommitted = useCallback((content: string) => {
    lastAppliedNoteRef.current = {
      path: currentNotePath,
      diskRevision: currentNoteDiskRevision,
      content,
    };
  }, [currentNoteDiskRevision, currentNotePath]);
  const {
    configureMarkdownListener,
    createUserInputMarker,
    setEditorGetter,
    shouldSerializeEditorMarkdown,
  } = usePendingMarkdownAutosave({
    currentNotePath,
    currentNoteDiskRevision,
    currentNoteContent,
    updateContent,
    debouncedSave,
    onLocalMarkdownCommitted: markLocalMarkdownCommitted,
  });

  const initialContent = useMemo(() => {
    const startedAt = performance.now();
    const normalized = normalizeAlternativeMathBlockFences(currentNoteContentRef.current);
    logE2EMilkdownTiming('initial-content', {
      notePath: currentNotePath,
      inputLength: currentNoteContentRef.current.length,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return normalized;
  }, []);
  const typoraRuntimePlatformClasses = useMemo(() => {
    return importedMarkdownThemePlatform === 'typora'
      ? resolveTyporaRuntimePlatformClasses().join(' ')
      : '';
  }, [importedMarkdownThemePlatform]);
  const markdownThemeRuntimeColorScheme = useMemo(() => {
    return resolveMarkdownThemeRuntimeColorScheme({
      importedThemeId: importedMarkdownThemeId,
      importedThemePlatform: importedMarkdownThemePlatform,
      appColorScheme: appMarkdownThemeColorScheme,
    });
  }, [
    appMarkdownThemeColorScheme,
    importedMarkdownThemeId,
    importedMarkdownThemePlatform,
  ]);

  useEffect(() => {
    onEditorViewReadyRef.current = onEditorViewReady;
  }, [onEditorViewReady]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    currentNoteContentRef.current = currentNoteContent;
  }, [currentNoteContent]);

  useEffect(() => {
    const updateViewport = () => {
      setMarkdownThemeViewport(resolveMarkdownThemeViewport(window.innerWidth));
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const shell = editorShellRef.current;
    if (!shell) return;

    const root = shell.querySelector<HTMLElement>('[data-markdown-theme-root="true"], #write, .ProseMirror');
    for (const element of [shell, root].filter((element): element is HTMLElement => Boolean(element))) {
      applyMarkdownThemeRuntimeAttributes(element, {
        importedThemeId: importedMarkdownThemeId,
        importedThemePlatform: importedMarkdownThemePlatform,
        colorScheme: markdownThemeRuntimeColorScheme.colorScheme,
        colorSchemeMode: markdownThemeRuntimeColorScheme.mode,
        viewport: markdownThemeViewport,
        typewriterMode,
      });
    }
  }, [
    activatedRevision,
    importedMarkdownThemeId,
    importedMarkdownThemePlatform,
    markdownThemeRuntimeColorScheme,
    markdownThemeViewport,
    typewriterMode,
  ]);

  useEffect(() => {
    const handleBlur = () => {
      flushCurrentPendingEditorMarkdown();
      flushSave();
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [flushSave]);

  const cleanupActivatedEditor = useCallback(() => {
    activationCleanupRef.current?.();
    activationCleanupRef.current = null;
    activatedEditorRef.current = null;
  }, []);

  const activateEditor = useCallback((editor: ActiveMilkdownEditor) => {
    if (activatedEditorRef.current === editor) {
      return;
    }

    cleanupActivatedEditor();
    let activatedView: EditorView | null = null;
    try {
      const view = editor.ctx.get(editorViewCtx) as EditorView;
      activatedView = view;
      let parser: Parser | null = null;
      let liveSerializer: ((doc: unknown) => string) | null = null;
      try {
        parser = editor.ctx.get(parserCtx) as Parser;
      } catch {
        parser = null;
      }
      try {
        liveSerializer = editor.ctx.get(serializerCtx) as (doc: unknown) => string;
      } catch {
        liveSerializer = null;
      }

      if (!activeRef.current) {
        return;
      }

      setCurrentEditorView(view);
      try {
        normalizeInitialEditorSelection(view);
      } catch {
        // Keep editor activation alive even if a plugin rejects the startup selection normalization.
      }
      setActivatedRevision((revision) => revision + 1);

      const markUserInput = createUserInputMarker(view, liveSerializer);
      view.dom.addEventListener('beforeinput', markUserInput, { capture: true });
      view.dom.addEventListener('keydown', markUserInput, { capture: true });
      view.dom.addEventListener('compositionstart', markUserInput, { capture: true });
      view.dom.addEventListener('compositionend', markUserInput, { capture: true });
      view.dom.addEventListener('editor:image-user-input', markUserInput);
      view.dom.addEventListener('editor:block-user-input', markUserInput);
      view.dom.addEventListener('paste', markUserInput);
      view.dom.addEventListener('cut', markUserInput);
      view.dom.addEventListener('drop', markUserInput);
      const blockPositionController = createCurrentEditorBlockPositionController(view);
      setCurrentMarkdownRuntime({ parser, serializer: liveSerializer });
      activatedEditorRef.current = editor;
      activationCleanupRef.current = () => {
        view.dom.removeEventListener('beforeinput', markUserInput, { capture: true });
        view.dom.removeEventListener('keydown', markUserInput, { capture: true });
        view.dom.removeEventListener('compositionstart', markUserInput, { capture: true });
        view.dom.removeEventListener('compositionend', markUserInput, { capture: true });
        view.dom.removeEventListener('editor:image-user-input', markUserInput);
        view.dom.removeEventListener('editor:block-user-input', markUserInput);
        view.dom.removeEventListener('paste', markUserInput);
        view.dom.removeEventListener('cut', markUserInput);
        view.dom.removeEventListener('drop', markUserInput);
        blockPositionController.destroy();
        if (getCurrentEditorView() === view) {
          setCurrentEditorView(null);
          clearCurrentEditorBlockPositionSnapshot();
          clearCurrentMarkdownRuntime();
        }
      };
    } catch {
      if (activatedView && getCurrentEditorView() === activatedView) {
        setCurrentEditorView(null);
        clearCurrentEditorBlockPositionSnapshot();
        clearCurrentMarkdownRuntime();
      }
    }
  }, [
    cleanupActivatedEditor,
    createUserInputMarker,
  ]);

  const { get } = useEditor((root) => {
    const editorFactoryStartedAt = performance.now();
    const editor = Editor.make()
      .config((ctx) => {
        const configStartedAt = performance.now();
        const normalizedFrontmatter = normalizeLeadingFrontmatterMarkdown(initialContent);
        const blankLineStartedAt = performance.now();
        const defaultMarkdown = preserveMarkdownBlankLinesForEditor(
          normalizedFrontmatter
        );
        const defaultJsonStartedAt = performance.now();
        const defaultJson = createLargePlainMarkdownDocJSON(defaultMarkdown);
        const defaultValue: MilkdownDefaultValue = defaultJson
          ? { type: 'json', value: defaultJson }
          : defaultMarkdown;
        if (defaultJson) {
          logE2EMilkdownTiming('default-json', {
            notePath: currentNotePath,
            inputLength: defaultMarkdown.length,
            blockCount: defaultJson.content?.length ?? 0,
            durationMs: Math.round(performance.now() - defaultJsonStartedAt),
          });
        }
        logE2EMilkdownTiming('default-value', {
          notePath: currentNotePath,
          inputLength: initialContent.length,
          outputLength: defaultMarkdown.length,
          valueType: typeof defaultValue === 'string' ? 'markdown' : defaultValue.type,
          durationMs: Math.round(performance.now() - blankLineStartedAt),
        });

        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, defaultValue as never);
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));

        const handleMarkdownUpdated = configureMarkdownListener(ctx, initialContent);
        ctx.update(prosePluginsCtx, (plugins) => plugins.concat(
          createDeferredMarkdownUpdatePlugin(ctx, handleMarkdownUpdated, {
            shouldSerialize: shouldSerializeEditorMarkdown,
          })
        ));
        logE2EMilkdownTiming('config', {
          notePath: currentNotePath,
          durationMs: Math.round(performance.now() - configStartedAt),
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(configureTheme)
      .use(tableBlock)
      .use(customPlugins);

    const statusEditor = editor as unknown as ActiveMilkdownEditor;
    statusEditor.onStatusChange?.((status: string) => {
      if (status === 'Created') {
        logE2EMilkdownTiming('created', {
          notePath: currentNotePath,
          totalSinceFactoryMs: Math.round(performance.now() - editorFactoryStartedAt),
        });
        activateEditor(statusEditor);
        onEditorViewReadyRef.current?.();
      }
      if (status === 'OnDestroy' || status === 'Destroyed') {
        if (activatedEditorRef.current === statusEditor) {
          cleanupActivatedEditor();
        }
      }
    });

    return editor;
  }, []);

  useEffect(() => {
    hasAutoFocused.current = false;
    hasScheduledAutoFocus.current = false;
  }, [currentNotePath]);

  useEffect(() => {
    setEditorGetter(get);
  }, [get, setEditorGetter]);

  useEffect(() => {
    const lastAppliedNote = lastAppliedNoteRef.current;
    if (
      lastAppliedNote.path === currentNotePath &&
      lastAppliedNote.diskRevision === currentNoteDiskRevision &&
      lastAppliedNote.content === currentNoteContent
    ) {
      return;
    }

    let restoreFrame = 0;
    let restoreTimeout = 0;

    try {
      const editor = get?.() as ActiveMilkdownEditor | undefined;
      const runEditorAction = editor?.action;
      if (!editor || !runEditorAction) {
        return;
      }

      const view = editor.ctx.get(editorViewCtx) as EditorView;
      const isSameNotePath = lastAppliedNote.path === currentNotePath;
      let liveSerializer: ((doc: unknown) => string) | null = null;
      let shouldPreserveSameRevisionWithoutReplace = false;
      try {
        liveSerializer = editor.ctx.get(serializerCtx) as (doc: unknown) => string;
      } catch {
        liveSerializer = null;
      }
      if (liveSerializer && isSameNotePath) {
        try {
          const serializedCurrentDoc = liveSerializer(view.state.doc);
          if (isEditorMarkdownEquivalentToNoteContent(serializedCurrentDoc, currentNoteContent)) {
            lastAppliedNoteRef.current = {
              path: currentNotePath,
              diskRevision: currentNoteDiskRevision,
              content: currentNoteContent,
            };
            return;
          }
        } catch {
          shouldPreserveSameRevisionWithoutReplace = true;
        }
      }
      if (
        isSameNotePath &&
        lastAppliedNote.diskRevision === currentNoteDiskRevision &&
        (!liveSerializer || shouldPreserveSameRevisionWithoutReplace)
      ) {
        lastAppliedNoteRef.current = {
          path: currentNotePath,
          diskRevision: currentNoteDiskRevision,
          content: currentNoteContent,
        };
        return;
      }
      const scrollRoot = view.dom.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
      const scrollTop = isSameNotePath ? scrollRoot?.scrollTop ?? null : null;
      const prepareStartedAt = performance.now();
      const normalizedFrontmatter = normalizeLeadingFrontmatterMarkdown(
        normalizeAlternativeMathBlockFences(currentNoteContent)
      );
      const nextMarkdown = preserveMarkdownBlankLinesForEditor(normalizedFrontmatter);
      logE2EMilkdownTiming('replace-prepare', {
        notePath: currentNotePath,
        inputLength: currentNoteContent.length,
        outputLength: nextMarkdown.length,
        durationMs: Math.round(performance.now() - prepareStartedAt),
      });

      const replaceStartedAt = performance.now();
      const replaced = runEditorAction((ctx) => replaceEditorMarkdown(ctx, nextMarkdown, {
        resetSelection: !isSameNotePath,
      }));
      logE2EMilkdownTiming('replace-dispatch', {
        notePath: currentNotePath,
        replaced,
        durationMs: Math.round(performance.now() - replaceStartedAt),
      });
      if (!replaced) {
        return;
      }

      lastAppliedNoteRef.current = {
        path: currentNotePath,
        diskRevision: currentNoteDiskRevision,
        content: currentNoteContent,
      };
      onEditorViewReadyRef.current?.();

      if (scrollRoot && scrollTop !== null) {
        const restoreScroll = () => {
          scrollRoot.scrollTop = scrollTop;
        };
        restoreFrame = requestAnimationFrame(restoreScroll);
        restoreTimeout = window.setTimeout(
          restoreScroll,
          themeEditorLayoutTokens.restoreScrollFallbackDelayMs
        );
      }
    } catch {
    }

    return () => {
      cancelAnimationFrame(restoreFrame);
      window.clearTimeout(restoreTimeout);
    };
  }, [activatedRevision, currentNoteContent, currentNoteDiskRevision, currentNotePath, get]);

  useEffect(() => {
    return () => {
      cleanupActivatedEditor();
    };
  }, [cleanupActivatedEditor, currentNotePath]);

  useEffect(() => {
    if (!active) {
      cleanupActivatedEditor();
      return;
    }

    try {
      const editor = get?.() as ActiveMilkdownEditor | undefined;
      if (!editor) {
        cleanupActivatedEditor();
        return;
      }
      if (activatedEditorRef.current !== editor) {
        activateEditor(editor);
      }
    } catch {
      cleanupActivatedEditor();
      return;
    }
  }, [activateEditor, active, cleanupActivatedEditor, get, currentNotePath]);

  const isEmptyContent = useMemo(() => {
    const content = currentNoteContent.trim();
    return content.length === 0 || /^#\s*$/.test(content);
  }, [currentNoteContent]);

  const shouldFocusEmptyDraftBody = isDraftNote && !isNewlyCreated && isEmptyContent;
  if (
    lazyBlockVisibilityRef.current?.path !== currentNotePath ||
    lazyBlockVisibilityRef.current?.diskRevision !== currentNoteDiskRevision ||
    lazyBlockVisibilityRef.current?.content !== currentNoteContent
  ) {
    lazyBlockVisibilityRef.current = {
      content: currentNoteContent,
      diskRevision: currentNoteDiskRevision,
      path: currentNotePath,
      value: shouldUseLazyBlockVisibility(currentNoteContent),
    };
  }
  const useLazyBlockVisibility = lazyBlockVisibilityRef.current.value;

  const focusEditorBody = useCallback(() => {
    try {
      const editor = get?.();
      if (!editor) {
        return false;
      }

      const view = editor.ctx.get(editorViewCtx);
      if (!view) {
        return false;
      }

      view.focus();
      return true;
    } catch {
      return false;
    }
  }, [get]);

  useEffect(() => {
    if (!active || !get || hasAutoFocused.current || hasScheduledAutoFocus.current) return;
    const blockedReason = isNewlyCreated
      ? 'new-note-title-autofocus'
      : !isEmptyContent
        ? 'non-empty-content'
        : null;
    if (blockedReason) {
      return;
    }

    hasScheduledAutoFocus.current = true;

    const timer = setTimeout(() => {
      const focused = focusEditorBody();
      hasScheduledAutoFocus.current = false;
      if (focused) {
        hasAutoFocused.current = true;
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      hasScheduledAutoFocus.current = false;
    };
  }, [active, currentNotePath, focusEditorBody, get, isDraftNote, isNewlyCreated, isEmptyContent]);

  useEffect(() => {
    if (!active || !shouldFocusEmptyDraftBody || hasAutoFocused.current) return;
    const frame = requestAnimationFrame(() => {
      if (!shouldFocusEmptyDraftBody || hasAutoFocused.current) return;
      const focused = focusEditorBody();
      if (focused) {
        hasAutoFocused.current = true;
      }
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active, currentNotePath, focusEditorBody, shouldFocusEmptyDraftBody]);

  return (
    <div
      ref={editorShellRef}
      className={cn(
        "milkdown-editor",
        showBodyLineNumbers && 'markdown-body-line-numbers',
        !importedMarkdownThemeId && 'theme-vlaina',
        importedMarkdownThemeId && 'theme-external-markdown',
        importedMarkdownThemePlatform === 'typora' && 'theme-typora typora-export typora-export-content typora-node',
        typoraRuntimePlatformClasses,
        importedMarkdownThemePlatform === 'obsidian' && 'theme-obsidian',
        markdownThemeRuntimeColorScheme.colorScheme === 'dark' && 'theme-dark',
        markdownThemeRuntimeColorScheme.colorScheme === 'light' && 'theme-light',
        'is-live-preview',
        'max',
        'is-readable-line-width',
        markdownThemeViewport === 'mobile' && 'is-mobile',
        markdownThemeViewport === 'tablet' && 'is-tablet',
        markdownThemeViewport === 'desktop' && 'is-desktop',
        typewriterMode && 'ty-on-typewriter-mode',
        EDITOR_LAYOUT_CLASS
      )}
      data-note-content-root="true"
      data-note-lazy-block-visibility={useLazyBlockVisibility ? 'true' : undefined}
      data-markdown-theme-root="true"
      data-markdown-theme-platform={importedMarkdownThemeId ? importedMarkdownThemePlatform ?? 'external' : 'vlaina'}
      data-markdown-compat={importedMarkdownThemeId ? 'external' : 'native'}
      data-markdown-compat-layer={importedMarkdownThemeId ? 'external' : 'native'}
      data-markdown-imported-theme={importedMarkdownThemeId ?? undefined}
      data-markdown-theme-color-scheme={markdownThemeRuntimeColorScheme.colorScheme}
      data-markdown-theme-color-scheme-mode={markdownThemeRuntimeColorScheme.mode}
      data-theme={markdownThemeRuntimeColorScheme.colorScheme}
    >
      {showBodyLineNumbers && (
        <BodyLineNumberGutter
          markdown={currentNoteContent}
          shellRef={editorShellRef}
          revision={activatedRevision}
        />
      )}
      <Milkdown />
    </div>
  );
});
