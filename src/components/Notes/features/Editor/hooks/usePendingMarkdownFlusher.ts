import { useEffect, type RefObject } from 'react';
import { editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import { useNotesStore } from '@/stores/useNotesStore';
import {
  flushPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from '@/stores/notes/pendingEditorMarkdown';
import { hasCommittedCompositionText } from '../utils/compositionMarkdown';
import { serializeEditorMarkdownSnapshot } from '../utils/pendingMarkdownUpdate';

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

interface PendingMarkdownFlusherOptions {
  currentNotePath: string | undefined;
  pendingMarkdownUpdateFrameRef: RefObject<number | null>;
  pendingMarkdownApplyTimeoutRef: RefObject<ReturnType<typeof setTimeout> | null>;
  pendingRawMarkdownRef: RefObject<string | null>;
  pendingMarkdownRef: RefObject<string | null>;
  isCompositionActiveRef: RefObject<boolean>;
  deferredCompositionMarkdownRef: RefObject<string | null>;
  latestCompositionDataRef: RefObject<string | null>;
  hasCompositionEndedRef: RefObject<boolean>;
  hasEditorUserInputRef: RefObject<boolean>;
  currentNoteContentRef: RefObject<string>;
  getEditorRef: RefObject<EditorGetter | undefined>;
}

export function usePendingMarkdownFlusher({
  currentNotePath,
  pendingMarkdownUpdateFrameRef,
  pendingMarkdownApplyTimeoutRef,
  pendingRawMarkdownRef,
  pendingMarkdownRef,
  isCompositionActiveRef,
  deferredCompositionMarkdownRef,
  latestCompositionDataRef,
  hasCompositionEndedRef,
  hasEditorUserInputRef,
  currentNoteContentRef,
  getEditorRef,
}: PendingMarkdownFlusherOptions) {
  useEffect(() => {
    const flushPendingMarkdown = (options?: { allowFallbackSerialize?: boolean }) => {
      const allowFallbackSerialize = options?.allowFallbackSerialize ?? true;
      if (pendingMarkdownUpdateFrameRef.current !== null) {
        cancelAnimationFrame(pendingMarkdownUpdateFrameRef.current);
        pendingMarkdownUpdateFrameRef.current = null;
      }
      if (pendingMarkdownApplyTimeoutRef.current !== null) {
        clearTimeout(pendingMarkdownApplyTimeoutRef.current);
        pendingMarkdownApplyTimeoutRef.current = null;
      }
      let pendingMarkdown = pendingMarkdownRef.current;
      pendingMarkdownRef.current = null;
      const pendingRawMarkdown = pendingRawMarkdownRef.current;
      pendingRawMarkdownRef.current = null;
      if (isCompositionActiveRef.current) {
        const deferredCompositionMarkdown = deferredCompositionMarkdownRef.current;
        const latestCompositionData = latestCompositionDataRef.current;
        if (
          hasCompositionEndedRef.current &&
          hasCommittedCompositionText(deferredCompositionMarkdown, latestCompositionData)
        ) {
          const state = useNotesStore.getState();
          const latestCurrentNote = state.currentNote;
          let currentContent = state.noteContentsCache.get(currentNotePath ?? '')?.content
            ?? currentNoteContentRef.current;
          if (latestCurrentNote && latestCurrentNote.path === currentNotePath) {
            currentContent = latestCurrentNote.content;
          }
          pendingMarkdown = serializeEditorMarkdownSnapshot(deferredCompositionMarkdown, currentContent);
          deferredCompositionMarkdownRef.current = null;
          hasCompositionEndedRef.current = false;
        } else {
          return false;
        }
      }
      if (pendingMarkdown === null && pendingRawMarkdown !== null) {
        const state = useNotesStore.getState();
        const latestCurrentNote = state.currentNote;
        let currentContent = state.noteContentsCache.get(currentNotePath ?? '')?.content
          ?? currentNoteContentRef.current;
        if (latestCurrentNote && latestCurrentNote.path === currentNotePath) {
          currentContent = latestCurrentNote.content;
        }
        pendingMarkdown = serializeEditorMarkdownSnapshot(pendingRawMarkdown, currentContent);
      }
      if (pendingMarkdown === null) {
        if (allowFallbackSerialize && hasEditorUserInputRef.current) {
          try {
            const editor = getEditorRef.current?.();
            const view = editor?.ctx.get(editorViewCtx);
            const serializer = editor?.ctx.get(serializerCtx);
            if (view && serializer && !(view as { composing?: boolean }).composing) {
              const state = useNotesStore.getState();
              const latestCurrentNote = state.currentNote;
              let currentContent = state.noteContentsCache.get(currentNotePath ?? '')?.content
                ?? currentNoteContentRef.current;
              if (latestCurrentNote && latestCurrentNote.path === currentNotePath) {
                currentContent = latestCurrentNote.content;
              }
              const serialized = serializer(view.state.doc);
              pendingMarkdown = serializeEditorMarkdownSnapshot(serialized, currentContent);
            }
          } catch {
            pendingMarkdown = null;
          }
        }
      }
      return flushPendingEditorMarkdown(currentNotePath, pendingMarkdown);
    };

    setPendingEditorMarkdownFlusher(flushPendingMarkdown);

    return () => {
      flushPendingMarkdown({ allowFallbackSerialize: false });
      setPendingEditorMarkdownFlusher(null);
    };
  }, [
    currentNotePath,
    currentNoteContentRef,
    getEditorRef,
    hasEditorUserInputRef,
    isCompositionActiveRef,
    deferredCompositionMarkdownRef,
    latestCompositionDataRef,
    hasCompositionEndedRef,
    pendingMarkdownRef,
    pendingMarkdownApplyTimeoutRef,
    pendingRawMarkdownRef,
    pendingMarkdownUpdateFrameRef,
  ]);
}
