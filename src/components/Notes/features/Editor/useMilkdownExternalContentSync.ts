import { useEffect } from 'react';
import { editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  normalizeAlternativeMathBlockFences,
  preserveMarkdownBlankLinesForEditor,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { themeEditorLayoutTokens } from '@/styles/themeTokens';
import { normalizeLeadingFrontmatterMarkdown } from './plugins/frontmatter/frontmatterMarkdown';
import type { ActiveMilkdownEditor } from './MilkdownEditorInnerTypes';
import {
  isEditorMarkdownEquivalentToNoteContent,
  isSameVisibleNoteContentIgnoringManagedFrontmatter,
  replaceEditorMarkdown,
} from './milkdownEditorMarkdownReplacement';
import { logE2EMilkdownTiming } from './milkdownE2ETiming';

export function useMilkdownExternalContentSync(args: {
  activatedRevision: number;
  currentNoteContent: string;
  currentNoteDiskRevision: number;
  currentNotePath: string | undefined;
  get: (() => unknown) | undefined;
  hasLocalMarkdownCommitRef: React.MutableRefObject<boolean>;
  lastAppliedNoteRef: React.MutableRefObject<{
    path: string | undefined;
    diskRevision: number;
    content: string;
  }>;
  reportEditorReady: (editor: ActiveMilkdownEditor) => void;
}) {
  const {
    activatedRevision,
    currentNoteContent,
    currentNoteDiskRevision,
    currentNotePath,
    get,
    hasLocalMarkdownCommitRef,
    lastAppliedNoteRef,
    reportEditorReady,
  } = args;

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
      if (
        isSameNotePath &&
        hasLocalMarkdownCommitRef.current &&
        lastAppliedNote.content === currentNoteContent
      ) {
        lastAppliedNoteRef.current = {
          path: currentNotePath,
          diskRevision: currentNoteDiskRevision,
          content: currentNoteContent,
        };
        return;
      }
      if (
        isSameNotePath &&
        lastAppliedNote.content !== currentNoteContent &&
        isSameVisibleNoteContentIgnoringManagedFrontmatter(lastAppliedNote.content, currentNoteContent)
      ) {
        lastAppliedNoteRef.current = {
          path: currentNotePath,
          diskRevision: currentNoteDiskRevision,
          content: currentNoteContent,
        };
        return;
      }
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
      reportEditorReady(editor);

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
  }, [activatedRevision, currentNoteContent, currentNoteDiskRevision, currentNotePath, get, reportEditorReady]);

}
