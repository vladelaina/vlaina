import { useCallback, useEffect, useRef } from 'react';
import { serializerCtx } from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import { useNotesStore } from '@/stores/useNotesStore';
import {
  compareLineBreakText,
  isNotesDebugLoggingEnabled,
  logLineBreakDebug,
  summarizeLineBreakText,
} from '@/stores/notes/lineBreakDebugLog';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import {
  normalizeSerializedMarkdownDocument,
  summarizeMarkdownNormalizationPipeline,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { hasTemporaryTailParagraph } from '../plugins/cursor/endBlankClickPlugin';
import { serializeLeadingFrontmatterMarkdown } from '../plugins/frontmatter/frontmatterMarkdown';
import { getCurrentEditorView } from '../utils/editorViewRegistry';
import { resolvePendingMarkdownUpdate } from '../utils/pendingMarkdownUpdate';
import { summarizeEditorState } from '../utils/editorDebugSummary';
import { usePendingMarkdownFlusher } from './usePendingMarkdownFlusher';

interface MilkdownToken<T> {
  readonly __milkdownType?: T;
}

interface MilkdownContext {
  get<T>(token: MilkdownToken<T>): T;
}

interface MilkdownEditorLike {
  ctx: MilkdownContext;
}

type EditorGetter = () => MilkdownEditorLike | null | undefined;

interface PendingMarkdownAutosaveOptions {
  currentNotePath: string | undefined;
  currentNoteDiskRevision: number;
  currentNoteContent: string;
  updateContent: (content: string) => void;
  debouncedSave: () => void;
}

export function usePendingMarkdownAutosave({
  currentNotePath,
  currentNoteDiskRevision,
  currentNoteContent,
  updateContent,
  debouncedSave,
}: PendingMarkdownAutosaveOptions) {
  const hasIgnoredInitNoise = useRef(false);
  const hasEditorUserInput = useRef(false);
  const pendingMarkdownUpdateFrameRef = useRef<number | null>(null);
  const pendingMarkdownRef = useRef<string | null>(null);
  const currentNotePathRef = useRef(currentNotePath);
  const currentNoteContentRef = useRef(currentNoteContent);
  const getEditorRef = useRef<EditorGetter | undefined>(undefined);

  useEffect(() => {
    hasIgnoredInitNoise.current = false;
    hasEditorUserInput.current = false;
    pendingMarkdownRef.current = null;
    if (pendingMarkdownUpdateFrameRef.current !== null) {
      cancelAnimationFrame(pendingMarkdownUpdateFrameRef.current);
      pendingMarkdownUpdateFrameRef.current = null;
    }
  }, [currentNoteDiskRevision, currentNotePath]);

  useEffect(() => {
    currentNotePathRef.current = currentNotePath;
    currentNoteContentRef.current = currentNoteContent;
  }, [currentNotePath, currentNoteContent]);

  usePendingMarkdownFlusher({
    currentNotePath,
    pendingMarkdownUpdateFrameRef,
    pendingMarkdownRef,
    hasEditorUserInputRef: hasEditorUserInput,
    currentNotePathRef,
    currentNoteContentRef,
    getEditorRef,
  });

  const setEditorGetter = useCallback((getEditor: EditorGetter | undefined) => {
    getEditorRef.current = getEditor;
  }, []);

  const configureMarkdownListener = useCallback((ctx: MilkdownContext, initialContent: string) => {
    const initTime = Date.now();
    const INIT_PERIOD = 500;

    return (markdown: string) => {
      const debugEnabled = isNotesDebugLoggingEnabled();
      const editorView = getCurrentEditorView();
      const liveDoc = debugEnabled && editorView
        ? summarizeEditorState(editorView, ctx.get(serializerCtx))
        : null;
      if (editorView && hasTemporaryTailParagraph(editorView.state)) {
        if (debugEnabled) {
          logLineBreakDebug('editor:markdown-update-skipped-temporary-tail', {
            currentNotePath: currentNotePath ?? null,
            raw: summarizeLineBreakText(markdown),
            liveDoc,
          });
        }
        return;
      }

      const isInitializing = Date.now() - initTime < INIT_PERIOD;
      if (
        isInitializing &&
        !hasIgnoredInitNoise.current &&
        initialContent.trim().length > 0 &&
        markdown.trim().length < 5
      ) {
        hasIgnoredInitNoise.current = true;
        return;
      }

      const currentContent = useNotesStore.getState().currentNote?.content ?? '';
      const normalizedMarkdown = normalizeSerializedMarkdownDocument(markdown);
      const nextMarkdown = serializeLeadingFrontmatterMarkdown(normalizedMarkdown, currentContent);
      if (!hasEditorUserInput.current) {
        if (debugEnabled) {
          logLineBreakDebug('editor:non-user-markdown-echo-skipped', {
            currentNotePath: currentNotePath ?? null,
            isInitializing,
            raw: summarizeLineBreakText(markdown),
            normalized: summarizeLineBreakText(normalizedMarkdown),
            normalizationPipeline: summarizeMarkdownNormalizationPipeline(markdown),
            next: summarizeLineBreakText(nextMarkdown),
            current: summarizeLineBreakText(currentContent),
            diffCurrentToNext: compareLineBreakText(currentContent, nextMarkdown),
            liveDoc,
          });
        }
        return;
      }
      if (debugEnabled) {
        logLineBreakDebug('editor:markdown-updated', {
          currentNotePath: currentNotePath ?? null,
          raw: summarizeLineBreakText(markdown),
          normalized: summarizeLineBreakText(normalizedMarkdown),
          normalizationPipeline: summarizeMarkdownNormalizationPipeline(markdown),
          next: summarizeLineBreakText(nextMarkdown),
          current: summarizeLineBreakText(currentContent),
          diffCurrentToNext: compareLineBreakText(currentContent, nextMarkdown),
          liveDoc,
        });
      }
      if (currentContent === nextMarkdown) {
        return;
      }

      pendingMarkdownRef.current = nextMarkdown;
      if (pendingMarkdownUpdateFrameRef.current !== null) {
        return;
      }

      pendingMarkdownUpdateFrameRef.current = requestAnimationFrame(() => {
        pendingMarkdownUpdateFrameRef.current = null;
        const pendingMarkdown = pendingMarkdownRef.current;
        pendingMarkdownRef.current = null;
        if (pendingMarkdown === null) {
          return;
        }

        const latestNote = useNotesStore.getState().currentNote;
        if (!latestNote || latestNote.path !== currentNotePath) {
          logLineBreakDebug('editor:raf-skip-update', {
            currentNotePath: currentNotePath ?? null,
            latestNotePath: latestNote?.path ?? null,
            latest: summarizeLineBreakText(latestNote?.content),
            pending: summarizeLineBreakText(pendingMarkdown),
          });
          return;
        }

        let liveSerializedMarkdown: string | null = null;
        try {
          const latestEditorView = getCurrentEditorView();
          if (latestEditorView) {
            const serializer = ctx.get(serializerCtx);
            liveSerializedMarkdown = serializer(latestEditorView.state.doc);
          }
        } catch (error) {
          logLineBreakDebug('editor:raf-live-doc-read-failed', {
            currentNotePath: currentNotePath ?? null,
            message: error instanceof Error ? error.message : String(error),
          });
        }

        const resolvedUpdate = resolvePendingMarkdownUpdate({
          pendingMarkdown,
          latestNoteContent: latestNote.content,
          liveSerializedMarkdown,
        });
        const markdownToApply = resolvedUpdate.markdownToApply;
        if (latestNote.content === markdownToApply) {
          logLineBreakDebug('editor:raf-skip-update', {
            currentNotePath: currentNotePath ?? null,
            latestNotePath: latestNote.path,
            latest: summarizeLineBreakText(latestNote.content),
          });
          return;
        }

        const latestNotesPath = useNotesStore.getState().notesPath;
        const latestIsDraftNote = isDraftNotePath(latestNote.path);
        logLineBreakDebug('editor:raf-apply-update', {
          currentNotePath,
          notesPath: latestNotesPath,
          isDraftNote: latestIsDraftNote,
          previous: summarizeLineBreakText(latestNote.content),
          next: summarizeLineBreakText(markdownToApply),
        });
        updateContent(markdownToApply);
        if (!latestIsDraftNote || latestNotesPath) {
          debouncedSave();
        }
      });
    };
  }, [currentNotePath, debouncedSave, updateContent]);

  const createUserInputMarker = useCallback((
    view: EditorView,
    liveSerializer: ((doc: unknown) => string) | null
  ) => {
    return (event: Event) => {
      const wasAlreadyMarked = hasEditorUserInput.current;
      hasEditorUserInput.current = true;
      const eventType = event.type;
      const inputType = event instanceof InputEvent ? event.inputType : null;
      const key = event instanceof KeyboardEvent ? event.key : null;
      if (isNotesDebugLoggingEnabled()) {
        logLineBreakDebug('editor:user-input-marked', {
          currentNotePath: currentNotePath ?? null,
          eventType,
          wasAlreadyMarked,
          inputType,
          key,
          isComposing: event instanceof KeyboardEvent || event instanceof InputEvent
            ? event.isComposing
            : null,
          storeCurrentPath: useNotesStore.getState().currentNote?.path ?? null,
          isDirty: useNotesStore.getState().isDirty,
          beforeDoc: liveSerializer ? summarizeEditorState(view, liveSerializer) : null,
        });
        requestAnimationFrame(() => {
          if (!isNotesDebugLoggingEnabled()) {
            return;
          }
          logLineBreakDebug('editor:user-input-after-frame', {
            currentNotePath: currentNotePath ?? null,
            eventType,
            inputType,
            key,
            storeCurrentPath: useNotesStore.getState().currentNote?.path ?? null,
            isDirty: useNotesStore.getState().isDirty,
            afterDoc: liveSerializer ? summarizeEditorState(view, liveSerializer) : null,
          });
        });
      }
    };
  }, [currentNotePath]);

  return {
    configureMarkdownListener,
    createUserInputMarker,
    setEditorGetter,
  };
}
