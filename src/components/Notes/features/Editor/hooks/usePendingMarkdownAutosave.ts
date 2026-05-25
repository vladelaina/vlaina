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

const CONTENT_EDITING_KEYS = new Set([
  'Backspace',
  'Delete',
  'Enter',
  'Tab',
]);
const ALLOW_SYNTHETIC_USER_EVENTS =
  import.meta.env.MODE === 'test' || Boolean(import.meta.env.VITEST);

interface PendingMarkdownAutosaveOptions {
  currentNotePath: string | undefined;
  currentNoteDiskRevision: number;
  currentNoteContent: string;
  updateContent: (content: string) => void;
  debouncedSave: () => void;
}

function isContentEditingUserEvent(event: Event): boolean {
  if (event.type.startsWith('vlaina:')) {
    return true;
  }
  if (!event.isTrusted && !ALLOW_SYNTHETIC_USER_EVENTS) {
    return false;
  }
  if (event instanceof KeyboardEvent) {
    if (ALLOW_SYNTHETIC_USER_EVENTS && event.key === '') return true;
    if (event.isComposing) return true;
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }
    return CONTENT_EDITING_KEYS.has(event.key) || event.key.length === 1;
  }
  return true;
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
  const userInputVersionRef = useRef(0);
  const handledUserInputVersionRef = useRef(0);
  const pendingUserInputVersionRef = useRef(0);
  const pendingMarkdownUpdateFrameRef = useRef<number | null>(null);
  const pendingRawMarkdownRef = useRef<string | null>(null);
  const pendingMarkdownRef = useRef<string | null>(null);
  const currentNotePathRef = useRef(currentNotePath);
  const currentNoteContentRef = useRef(currentNoteContent);
  const getEditorRef = useRef<EditorGetter | undefined>(undefined);

  useEffect(() => {
    hasIgnoredInitNoise.current = false;
    hasEditorUserInput.current = false;
    userInputVersionRef.current = 0;
    handledUserInputVersionRef.current = 0;
    pendingUserInputVersionRef.current = 0;
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
      const userInputVersion = userInputVersionRef.current;
      if (userInputVersion <= handledUserInputVersionRef.current) {
        return;
      }

      pendingRawMarkdownRef.current = markdown;
      pendingUserInputVersionRef.current = userInputVersion;
      if (pendingMarkdownUpdateFrameRef.current !== null) {
        return;
      }

      pendingMarkdownUpdateFrameRef.current = requestAnimationFrame(() => {
        pendingMarkdownUpdateFrameRef.current = null;
        const rawMarkdown = pendingRawMarkdownRef.current;
        const rawUserInputVersion = pendingUserInputVersionRef.current;
        pendingRawMarkdownRef.current = null;
        pendingUserInputVersionRef.current = 0;
        if (rawMarkdown === null) {
          return;
        }
        handledUserInputVersionRef.current = Math.max(handledUserInputVersionRef.current, rawUserInputVersion);
        hasEditorUserInput.current = userInputVersionRef.current > handledUserInputVersionRef.current;

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
        } catch {
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
    return (event: Event) => {
      if (!isContentEditingUserEvent(event)) {
        return;
      }
      hasEditorUserInput.current = true;
      userInputVersionRef.current += 1;
    };
  }, []);

  return {
    configureMarkdownListener,
    createUserInputMarker,
    setEditorGetter,
  };
}
