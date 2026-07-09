import { useCallback } from 'react';
import type { MutableRefObject } from 'react';

import { themeUiFeedbackTokens } from '@/styles/themeTokens';
import { useNotesStore } from '@/stores/useNotesStore';
import { hasTemporaryTailParagraph } from '../plugins/cursor/endBlankClickPlugin';
import { getCurrentEditorView } from '../utils/editorViewRegistry';
import {
  serializeEditorMarkdownSnapshot,
} from '../utils/pendingMarkdownUpdate';
import { hasCommittedCompositionText } from '../utils/compositionMarkdown';
import {
  getCompositionClockMs,
  getEditorViewFromContext,
  isEditorComposing,
} from './pendingMarkdownAutosaveEvents';
import type { MilkdownContext, PendingMarkdownSnapshot } from './pendingMarkdownAutosaveTypes';
import { collapseSelectionAtPosition } from './pendingMarkdownCompositionRepair';
import { getLiveMarkdownPreviewContent } from './pendingMarkdownLivePreview';

interface PendingMarkdownListenerOptions {
  currentNotePath: string | undefined;
  hasIgnoredInitNoise: MutableRefObject<boolean>;
  hasEditorUserInput: MutableRefObject<boolean>;
  userInputVersionRef: MutableRefObject<number>;
  handledUserInputVersionRef: MutableRefObject<number>;
  pendingUserInputVersionRef: MutableRefObject<number>;
  pendingMarkdownUpdateFrameRef: MutableRefObject<number | null>;
  pendingRawMarkdownRef: MutableRefObject<PendingMarkdownSnapshot | null>;
  pendingMarkdownRef: MutableRefObject<PendingMarkdownSnapshot | null>;
  isCompositionActiveRef: MutableRefObject<boolean>;
  compositionSettleTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  deferredCompositionMarkdownRef: MutableRefObject<string | null>;
  deferredCompositionUserInputVersionRef: MutableRefObject<number>;
  latestCompositionDataRef: MutableRefObject<string | null>;
  hasCompositionEndedRef: MutableRefObject<boolean>;
  allowDeferredCompositionMarkdownWithoutCommitRef: MutableRefObject<boolean>;
  compositionAppendPositionRef: MutableRefObject<number | null>;
  lastCompositionAppendAtRef: MutableRefObject<number>;
  scheduleLiveMarkdownPreview: (path: string | undefined, content: string) => void;
  schedulePendingMarkdownApply: () => void;
}

export function usePendingMarkdownListener({
  currentNotePath,
  hasIgnoredInitNoise,
  hasEditorUserInput,
  userInputVersionRef,
  handledUserInputVersionRef,
  pendingUserInputVersionRef,
  pendingMarkdownUpdateFrameRef,
  pendingRawMarkdownRef,
  pendingMarkdownRef,
  isCompositionActiveRef,
  compositionSettleTimeoutRef,
  deferredCompositionMarkdownRef,
  deferredCompositionUserInputVersionRef,
  latestCompositionDataRef,
  hasCompositionEndedRef,
  allowDeferredCompositionMarkdownWithoutCommitRef,
  compositionAppendPositionRef,
  lastCompositionAppendAtRef,
  scheduleLiveMarkdownPreview,
  schedulePendingMarkdownApply,
}: PendingMarkdownListenerOptions) {
  return useCallback((ctx: MilkdownContext, initialContent: string) => {
    const initTime = Date.now();
    const INIT_PERIOD = themeUiFeedbackTokens.editorInitNoiseWindowMs;

    const processMarkdown = (
      markdown: string,
      rawUserInputVersion = userInputVersionRef.current,
    ) => {
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
      const userInputVersion = rawUserInputVersion;
      if (userInputVersion <= handledUserInputVersionRef.current) {
        return;
      }

      const previewMarkdown = getLiveMarkdownPreviewContent(markdown, currentContent);
      if (currentContent === previewMarkdown) {
        return;
      }

      scheduleLiveMarkdownPreview(currentNotePath, previewMarkdown);
      pendingRawMarkdownRef.current = {
        baseContent: currentContent,
        markdown,
      };
      pendingUserInputVersionRef.current = userInputVersion;
      if (pendingMarkdownUpdateFrameRef.current !== null) {
        return;
      }

      pendingMarkdownUpdateFrameRef.current = requestAnimationFrame(() => {
        pendingMarkdownUpdateFrameRef.current = null;
        const rawSnapshot = pendingRawMarkdownRef.current;
        const rawUserInputVersion = pendingUserInputVersionRef.current;
        pendingRawMarkdownRef.current = null;
        pendingUserInputVersionRef.current = 0;
        if (rawSnapshot === null) {
          return;
        }
        handledUserInputVersionRef.current = Math.max(handledUserInputVersionRef.current, rawUserInputVersion);
        hasEditorUserInput.current = userInputVersionRef.current > handledUserInputVersionRef.current;

        const latestNote = useNotesStore.getState().currentNote;
        if (!latestNote || latestNote.path !== currentNotePath) {
          return;
        }
        if (latestNote.content !== rawSnapshot.baseContent) {
          return;
        }

        const nextMarkdown = serializeEditorMarkdownSnapshot(rawSnapshot.markdown, latestNote.content);
        if (latestNote.content === nextMarkdown) {
          return;
        }

        pendingMarkdownRef.current = {
          baseContent: latestNote.content,
          markdown: nextMarkdown,
        };
        schedulePendingMarkdownApply();
      });
    };

    const scheduleCompositionSettle = () => {
      if (compositionSettleTimeoutRef.current !== null) {
        clearTimeout(compositionSettleTimeoutRef.current);
      }
      compositionSettleTimeoutRef.current = setTimeout(() => {
        compositionSettleTimeoutRef.current = null;
        if (!hasCompositionEndedRef.current) {
          scheduleCompositionSettle();
          return;
        }
        if (
          compositionAppendPositionRef.current !== null &&
          getCompositionClockMs() - lastCompositionAppendAtRef.current < themeUiFeedbackTokens.editorCompositionSettleMs
        ) {
          scheduleCompositionSettle();
          return;
        }

        isCompositionActiveRef.current = false;
        const finalAppendPosition = compositionAppendPositionRef.current;
        if (finalAppendPosition !== null) {
          const editorView = getCurrentEditorView() ?? getEditorViewFromContext(ctx);
          if (editorView) {
            collapseSelectionAtPosition(editorView, finalAppendPosition);
          }
        }
        const deferredMarkdown = deferredCompositionMarkdownRef.current;
        const deferredUserInputVersion = deferredCompositionUserInputVersionRef.current;
        deferredCompositionMarkdownRef.current = null;
        deferredCompositionUserInputVersionRef.current = 0;
        hasCompositionEndedRef.current = false;
        const allowDeferredWithoutCommit = allowDeferredCompositionMarkdownWithoutCommitRef.current;
        allowDeferredCompositionMarkdownWithoutCommitRef.current = false;
        const latestCompositionData = latestCompositionDataRef.current;
        if (
          deferredMarkdown !== null &&
          (
            allowDeferredWithoutCommit ||
            hasCommittedCompositionText(deferredMarkdown, latestCompositionData)
          )
        ) {
          processMarkdown(deferredMarkdown, deferredUserInputVersion);
        }
      }, themeUiFeedbackTokens.editorCompositionSettleMs);
    };

    return (markdown: string) => {
      const editorView = getCurrentEditorView();
      const contextEditorView = editorView ?? getEditorViewFromContext(ctx);
      if (contextEditorView && hasTemporaryTailParagraph(contextEditorView.state)) {
        return;
      }

      if (isCompositionActiveRef.current || isEditorComposing(contextEditorView)) {
        pendingRawMarkdownRef.current = null;
        pendingMarkdownRef.current = null;
        deferredCompositionMarkdownRef.current = markdown;
        deferredCompositionUserInputVersionRef.current = userInputVersionRef.current;
        scheduleCompositionSettle();
        return;
      }

      processMarkdown(markdown);
    };
  }, [
    currentNotePath,
    scheduleLiveMarkdownPreview,
    schedulePendingMarkdownApply,
  ]);
}
