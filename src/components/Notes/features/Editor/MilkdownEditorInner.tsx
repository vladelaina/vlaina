import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  parserCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { tableBlock } from '@milkdown/kit/component/table-block';
import type { Ctx } from '@milkdown/kit/ctx';
import { Slice } from '@milkdown/kit/prose/model';
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
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import {
  normalizeAlternativeMathBlockFences,
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
  setCurrentEditorView,
  setCurrentMarkdownRuntime,
} from './utils/editorViewRegistry';
import {
  clearCurrentEditorBlockPositionSnapshot,
  createCurrentEditorBlockPositionController,
} from './utils/editorBlockPositionCache';
import { normalizeLeadingFrontmatterMarkdown } from './plugins/frontmatter/frontmatterMarkdown';
import { BodyLineNumberGutter } from './components/BodyLineNumberGutter';
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

export function replaceEditorMarkdown(ctx: Ctx, markdown: string): boolean {
  let view: EditorView;
  let doc: ReturnType<Parser>;

  try {
    view = ctx.get(editorViewCtx);
    const parser = ctx.get(parserCtx);
    doc = parser(markdown);
  } catch {
    return false;
  }

  if (!doc) {
    return false;
  }

  const { state } = view;
  view.dispatch(
    state.tr.replace(
      0,
      state.doc.content.size,
      new Slice(doc.content as never, 0, 0),
    ),
  );
  return true;
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
  const lastAppliedDiskRevisionRef = useRef(currentNoteDiskRevision);
  const isDraftNote = isDraftNotePath(currentNotePath);
  const onEditorViewReadyRef = useRef(onEditorViewReady);
  const activeRef = useRef(active);

  const hasAutoFocused = useRef(false);
  const hasScheduledAutoFocus = useRef(false);
  const activatedEditorRef = useRef<ActiveMilkdownEditor | null>(null);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const activationCleanupRef = useRef<(() => void) | null>(null);
  const [activatedRevision, setActivatedRevision] = useState(0);
  const { debouncedSave, flushSave } = useEditorSave(saveNote);
  const {
    configureMarkdownListener,
    createUserInputMarker,
    setEditorGetter,
  } = usePendingMarkdownAutosave({
    currentNotePath,
    currentNoteDiskRevision,
    currentNoteContent,
    updateContent,
    debouncedSave,
  });

  const initialContent = useMemo(() => {
    return normalizeAlternativeMathBlockFences(currentNoteContentRef.current);
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
    try {
      const view = editor.ctx.get(editorViewCtx) as EditorView;
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
        setCurrentEditorView(null);
        clearCurrentEditorBlockPositionSnapshot();
        clearCurrentMarkdownRuntime();
      };
    } catch {
      setCurrentEditorView(null);
      clearCurrentEditorBlockPositionSnapshot();
      clearCurrentMarkdownRuntime();
    }
  }, [
    cleanupActivatedEditor,
    createUserInputMarker,
  ]);

  const { get } = useEditor((root) => {
    const editor = Editor.make()
      .config((ctx) => {
        const normalizedFrontmatter = normalizeLeadingFrontmatterMarkdown(initialContent);
        const defaultValue = preserveMarkdownBlankLinesForEditor(
          normalizedFrontmatter
        );

        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, defaultValue);
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));

        const handleMarkdownUpdated = configureMarkdownListener(ctx, initialContent);
        ctx.get(listenerCtx)
          .markdownUpdated((_ctx, markdown) => {
            handleMarkdownUpdated(markdown);
          });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(configureTheme)
      .use(tableBlock)
      .use(customPlugins);

    const statusEditor = editor as unknown as ActiveMilkdownEditor;
    statusEditor.onStatusChange?.((status: string) => {
      if (status === 'Created') {
        onEditorViewReadyRef.current?.();
        activateEditor(statusEditor);
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
    if (lastAppliedDiskRevisionRef.current === currentNoteDiskRevision) {
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
      const scrollRoot = view.dom.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
      const scrollTop = scrollRoot?.scrollTop ?? null;
      const normalizedFrontmatter = normalizeLeadingFrontmatterMarkdown(
        normalizeAlternativeMathBlockFences(currentNoteContent)
      );
      const nextMarkdown = preserveMarkdownBlankLinesForEditor(normalizedFrontmatter);

      const replaced = runEditorAction((ctx) => replaceEditorMarkdown(ctx, nextMarkdown));
      if (!replaced) {
        return;
      }

      lastAppliedDiskRevisionRef.current = currentNoteDiskRevision;

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
  }, [activatedRevision, currentNoteContent, currentNoteDiskRevision, get]);

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
        setCurrentEditorView(null);
        clearCurrentEditorBlockPositionSnapshot();
        clearCurrentMarkdownRuntime();
        return;
      }
      if (activatedEditorRef.current !== editor) {
        activateEditor(editor);
      }
    } catch {
      setCurrentEditorView(null);
      clearCurrentEditorBlockPositionSnapshot();
      clearCurrentMarkdownRuntime();
      return;
    }
  }, [activateEditor, active, cleanupActivatedEditor, get, currentNotePath]);

  const isEmptyContent = useMemo(() => {
    const content = initialContent.trim();
    return content.length === 0 || /^#\s*$/.test(content);
  }, [initialContent]);

  const shouldFocusEmptyDraftBody = isDraftNote && !isNewlyCreated && isEmptyContent;

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
