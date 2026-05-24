import { useCallback, useEffect, useRef } from 'react';
import { serializerCtx } from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import { useNotesStore } from '@/stores/useNotesStore';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { hasTemporaryTailParagraph } from '../plugins/cursor/endBlankClickPlugin';
import { getCurrentEditorView } from '../utils/editorViewRegistry';
import {
  resolvePendingMarkdownUpdate,
  serializeEditorMarkdownSnapshot,
} from '../utils/pendingMarkdownUpdate';
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
  const pendingRawMarkdownRef = useRef<string | null>(null);
  const pendingMarkdownRef = useRef<string | null>(null);
  const currentNotePathRef = useRef(currentNotePath);
  const currentNoteContentRef = useRef(currentNoteContent);
  const getEditorRef = useRef<EditorGetter | undefined>(undefined);

  useEffect(() => {
    hasIgnoredInitNoise.current = false;
    hasEditorUserInput.current = false;
    pendingRawMarkdownRef.current = null;
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
    pendingRawMarkdownRef,
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
      const editorView = getCurrentEditorView();
      if (editorView && hasTemporaryTailParagraph(editorView.state)) {
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
      if (currentContent === markdown) {
        return;
      }

      if (!hasEditorUserInput.current) {
        return;
      }

      pendingRawMarkdownRef.current = markdown;
      if (pendingMarkdownUpdateFrameRef.current !== null) {
        return;
      }

      pendingMarkdownUpdateFrameRef.current = requestAnimationFrame(() => {
        pendingMarkdownUpdateFrameRef.current = null;
        const rawMarkdown = pendingRawMarkdownRef.current;
        pendingRawMarkdownRef.current = null;
        if (rawMarkdown === null) {
          return;
        }

        const latestNote = useNotesStore.getState().currentNote;
        if (!latestNote || latestNote.path !== currentNotePath) {
          return;
        }

        const nextMarkdown = serializeEditorMarkdownSnapshot(rawMarkdown, latestNote.content);
        if (latestNote.content === nextMarkdown) {
          return;
        }

        pendingMarkdownRef.current = nextMarkdown;
        const pendingMarkdown = pendingMarkdownRef.current;
        pendingMarkdownRef.current = null;
        if (pendingMarkdown === null) {
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
        }

        const resolvedUpdate = resolvePendingMarkdownUpdate({
          pendingMarkdown,
          latestNoteContent: latestNote.content,
          liveSerializedMarkdown,
        });
        const markdownToApply = resolvedUpdate.markdownToApply;
        if (latestNote.content === markdownToApply) {
          return;
        }

        const latestNotesPath = useNotesStore.getState().notesPath;
        const latestIsDraftNote = isDraftNotePath(latestNote.path);
        updateContent(markdownToApply);
        if (!latestIsDraftNote || latestNotesPath) {
          debouncedSave();
        }
      });
    };
  }, [currentNotePath, debouncedSave, updateContent]);

  const createUserInputMarker = useCallback((
    _view: EditorView,
    _liveSerializer: ((doc: unknown) => string) | null
  ) => {
    return (_event: Event) => {
      hasEditorUserInput.current = true;
    };
  }, [currentNotePath]);

  return {
    configureMarkdownListener,
    createUserInputMarker,
    setEditorGetter,
  };
}
