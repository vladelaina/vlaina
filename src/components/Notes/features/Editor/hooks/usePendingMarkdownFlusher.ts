import { useEffect, type RefObject } from 'react';
import { editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import { useNotesStore } from '@/stores/useNotesStore';
import {
  flushPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from '@/stores/notes/pendingEditorMarkdown';
import {
  normalizeSerializedMarkdownDocument,
  restoreMathBlockFenceStylesFromReference,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { serializeLeadingFrontmatterMarkdown } from '../plugins/frontmatter/frontmatterMarkdown';

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
  pendingRawMarkdownRef: RefObject<string | null>;
  pendingMarkdownRef: RefObject<string | null>;
  hasEditorUserInputRef: RefObject<boolean>;
  currentNotePathRef: RefObject<string | undefined>;
  currentNoteContentRef: RefObject<string>;
  getEditorRef: RefObject<EditorGetter | undefined>;
}

export function usePendingMarkdownFlusher({
  currentNotePath,
  pendingMarkdownUpdateFrameRef,
  pendingRawMarkdownRef,
  pendingMarkdownRef,
  hasEditorUserInputRef,
  currentNotePathRef,
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
      let pendingMarkdown = pendingMarkdownRef.current;
      pendingMarkdownRef.current = null;
      const pendingRawMarkdown = pendingRawMarkdownRef.current;
      pendingRawMarkdownRef.current = null;
      if (pendingMarkdown === null && pendingRawMarkdown !== null) {
        const state = useNotesStore.getState();
        const latestCurrentNote = state.currentNote;
        let currentContent = state.noteContentsCache.get(currentNotePath ?? '')?.content
          ?? currentNoteContentRef.current;
        if (latestCurrentNote && latestCurrentNote.path === currentNotePath) {
          currentContent = latestCurrentNote.content;
        }
        const normalizedMarkdown = normalizeSerializedMarkdownDocument(pendingRawMarkdown);
        const styledMarkdown = restoreMathBlockFenceStylesFromReference(
          normalizedMarkdown,
          currentContent,
        );
        pendingMarkdown = serializeLeadingFrontmatterMarkdown(
          styledMarkdown,
          currentContent,
        );
      }
      if (pendingMarkdown === null) {
        if (!allowFallbackSerialize) {
        } else if (!hasEditorUserInputRef.current) {
        } else {
          try {
            const editor = getEditorRef.current?.();
            const view = editor?.ctx.get(editorViewCtx);
            const serializer = editor?.ctx.get(serializerCtx);
            if (view && serializer) {
              const state = useNotesStore.getState();
              const latestCurrentNote = state.currentNote;
              let currentContent = state.noteContentsCache.get(currentNotePath ?? '')?.content
                ?? currentNoteContentRef.current;
              if (latestCurrentNote && latestCurrentNote.path === currentNotePath) {
                currentContent = latestCurrentNote.content;
              }
              const serialized = serializer(view.state.doc);
              const normalizedSerialized = normalizeSerializedMarkdownDocument(serialized);
              const styledSerialized = restoreMathBlockFenceStylesFromReference(
                normalizedSerialized,
                currentContent,
              );
              pendingMarkdown = serializeLeadingFrontmatterMarkdown(
                styledSerialized,
                currentContent,
              );
            }
          } catch (error) {
            pendingMarkdown = null;
          }
        }
      }
      const flushed = flushPendingEditorMarkdown(currentNotePath, pendingMarkdown);
      return flushed;
    };

    setPendingEditorMarkdownFlusher(flushPendingMarkdown);

    return () => {
      flushPendingMarkdown({ allowFallbackSerialize: false });
      setPendingEditorMarkdownFlusher(null);
    };
  }, [
    currentNotePath,
    currentNoteContentRef,
    currentNotePathRef,
    getEditorRef,
    hasEditorUserInputRef,
    pendingMarkdownRef,
    pendingRawMarkdownRef,
    pendingMarkdownUpdateFrameRef,
  ]);
}
