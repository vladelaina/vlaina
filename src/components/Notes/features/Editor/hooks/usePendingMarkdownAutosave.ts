import { useCallback, useEffect, useRef } from 'react';

import { useNotesStore } from '@/stores/useNotesStore';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { usePendingMarkdownFlusher } from './usePendingMarkdownFlusher';
import type {
  CompositionStartSelection,
  EditorGetter,
  PendingMarkdownAutosaveOptions,
} from './pendingMarkdownAutosaveTypes';
import { getContentCommitThrottleMs } from './pendingMarkdownAutosaveEvents';
import {
  publishLiveMarkdownPreview,
} from './pendingMarkdownLivePreview';
import { usePendingMarkdownListener } from './usePendingMarkdownListener';
import { usePendingMarkdownUserInputMarker } from './usePendingMarkdownUserInputMarker';

export {
  collapseCommittedCompositionSelection,
  replaceRecentCompositionText,
  replaceSelectedTextWithCommittedComposition,
} from './pendingMarkdownCompositionRepair';

export function usePendingMarkdownAutosave({
  currentNotePath,
  currentNoteDiskRevision,
  currentNoteContent,
  updateContent,
  debouncedSave,
  onLocalMarkdownCommitted,
}: PendingMarkdownAutosaveOptions) {
  const hasIgnoredInitNoise = useRef(false);
  const hasEditorUserInput = useRef(false);
  const userInputVersionRef = useRef(0);
  const handledUserInputVersionRef = useRef(0);
  const pendingUserInputVersionRef = useRef(0);
  const pendingMarkdownUpdateFrameRef = useRef<number | null>(null);
  const pendingMarkdownApplyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLivePreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLivePreviewRef = useRef<{ path: string | undefined; content: string } | null>(null);
  const pendingRawMarkdownRef = useRef<string | null>(null);
  const pendingMarkdownRef = useRef<string | null>(null);
  const isCompositionActiveRef = useRef(false);
  const compositionSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredCompositionMarkdownRef = useRef<string | null>(null);
  const deferredCompositionUserInputVersionRef = useRef(0);
  const latestCompositionDataRef = useRef<string | null>(null);
  const latestCompositionResidueDataRef = useRef<string | null>(null);
  const hasCompositionEndedRef = useRef(false);
  const compositionStartSelectionRef = useRef<CompositionStartSelection | null>(null);
  const compositionAppendPositionRef = useRef<number | null>(null);
  const lastCompositionAppendPositionRef = useRef<number | null>(null);
  const lastCompositionAppendAtRef = useRef(0);
  const lastCompositionCommitAtRef = useRef(0);
  const isCompositionSelectionRepairSuppressedRef = useRef(false);
  const allowDeferredCompositionMarkdownWithoutCommitRef = useRef(false);
  const currentNoteContentRef = useRef(currentNoteContent);
  const getEditorRef = useRef<EditorGetter | undefined>(undefined);

  const clearCompositionAppendGuard = useCallback(() => {
    compositionAppendPositionRef.current = null;
    lastCompositionAppendPositionRef.current = null;
    lastCompositionAppendAtRef.current = 0;
  }, []);

  useEffect(() => {
    hasIgnoredInitNoise.current = false;
    hasEditorUserInput.current = false;
    userInputVersionRef.current = 0;
    handledUserInputVersionRef.current = 0;
    pendingUserInputVersionRef.current = 0;
    pendingRawMarkdownRef.current = null;
    pendingMarkdownRef.current = null;
    isCompositionActiveRef.current = false;
    deferredCompositionMarkdownRef.current = null;
    deferredCompositionUserInputVersionRef.current = 0;
    latestCompositionDataRef.current = null;
    latestCompositionResidueDataRef.current = null;
    hasCompositionEndedRef.current = false;
    compositionStartSelectionRef.current = null;
    isCompositionSelectionRepairSuppressedRef.current = false;
    allowDeferredCompositionMarkdownWithoutCommitRef.current = false;
    lastCompositionCommitAtRef.current = 0;
    clearCompositionAppendGuard();
    if (compositionSettleTimeoutRef.current !== null) {
      clearTimeout(compositionSettleTimeoutRef.current);
      compositionSettleTimeoutRef.current = null;
    }
    if (pendingMarkdownUpdateFrameRef.current !== null) {
      cancelAnimationFrame(pendingMarkdownUpdateFrameRef.current);
      pendingMarkdownUpdateFrameRef.current = null;
    }
    if (pendingMarkdownApplyTimeoutRef.current !== null) {
      clearTimeout(pendingMarkdownApplyTimeoutRef.current);
      pendingMarkdownApplyTimeoutRef.current = null;
    }
    if (pendingLivePreviewTimeoutRef.current !== null) {
      clearTimeout(pendingLivePreviewTimeoutRef.current);
      pendingLivePreviewTimeoutRef.current = null;
    }
    pendingLivePreviewRef.current = null;
    return () => {
      if (compositionSettleTimeoutRef.current !== null) {
        clearTimeout(compositionSettleTimeoutRef.current);
        compositionSettleTimeoutRef.current = null;
      }
      if (pendingLivePreviewTimeoutRef.current !== null) {
        clearTimeout(pendingLivePreviewTimeoutRef.current);
        pendingLivePreviewTimeoutRef.current = null;
      }
      pendingLivePreviewRef.current = null;
    };
  }, [clearCompositionAppendGuard, currentNoteDiskRevision, currentNotePath]);

  useEffect(() => {
    currentNoteContentRef.current = currentNoteContent;
  }, [currentNoteContent]);

  usePendingMarkdownFlusher({
    currentNotePath,
    pendingMarkdownUpdateFrameRef,
    pendingMarkdownApplyTimeoutRef,
    pendingMarkdownRef,
    isCompositionActiveRef,
    deferredCompositionMarkdownRef,
    latestCompositionDataRef,
    hasCompositionEndedRef,
    allowDeferredCompositionMarkdownWithoutCommitRef,
    pendingRawMarkdownRef,
    hasEditorUserInputRef: hasEditorUserInput,
    currentNoteContentRef,
    getEditorRef,
  });

  const setEditorGetter = useCallback((getEditor: EditorGetter | undefined) => {
    getEditorRef.current = getEditor;
  }, []);

  const applyPendingMarkdown = useCallback(() => {
    pendingMarkdownApplyTimeoutRef.current = null;
    const pendingMarkdown = pendingMarkdownRef.current;
    pendingMarkdownRef.current = null;
    if (pendingMarkdown === null) {
      return;
    }

    const latestNote = useNotesStore.getState().currentNote;
    if (!latestNote || latestNote.path !== currentNotePath) {
      return;
    }

    const markdownToApply = pendingMarkdown;
    if (latestNote.content === markdownToApply) {
      return;
    }

    const latestNotesPath = useNotesStore.getState().notesPath;
    const latestIsDraftNote = isDraftNotePath(latestNote.path);
    onLocalMarkdownCommitted?.(markdownToApply);
    updateContent(markdownToApply);
    if (!latestIsDraftNote || latestNotesPath) {
      debouncedSave();
    }
  }, [currentNotePath, debouncedSave, onLocalMarkdownCommitted, updateContent]);

  const schedulePendingMarkdownApply = useCallback(() => {
    if (pendingMarkdownApplyTimeoutRef.current !== null) {
      return;
    }

    const throttleMs = getContentCommitThrottleMs();
    if (throttleMs <= 0) {
      applyPendingMarkdown();
      return;
    }

    pendingMarkdownApplyTimeoutRef.current = setTimeout(
      applyPendingMarkdown,
      throttleMs,
    );
  }, [applyPendingMarkdown]);

  const scheduleLiveMarkdownPreview = useCallback((path: string | undefined, content: string) => {
    const throttleMs = getContentCommitThrottleMs();
    if (throttleMs <= 0) {
      publishLiveMarkdownPreview(path, content);
      return;
    }

    pendingLivePreviewRef.current = { path, content };
    if (pendingLivePreviewTimeoutRef.current !== null) {
      return;
    }

    pendingLivePreviewTimeoutRef.current = setTimeout(() => {
      pendingLivePreviewTimeoutRef.current = null;
      const preview = pendingLivePreviewRef.current;
      pendingLivePreviewRef.current = null;
      if (!preview) {
        return;
      }
      publishLiveMarkdownPreview(preview.path, preview.content);
    }, throttleMs);
  }, []);

  const configureMarkdownListener = usePendingMarkdownListener({
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
  });

  const createUserInputMarker = usePendingMarkdownUserInputMarker({
    isCompositionActiveRef,
    compositionSettleTimeoutRef,
    deferredCompositionMarkdownRef,
    deferredCompositionUserInputVersionRef,
    latestCompositionDataRef,
    latestCompositionResidueDataRef,
    hasCompositionEndedRef,
    compositionStartSelectionRef,
    compositionAppendPositionRef,
    lastCompositionAppendPositionRef,
    lastCompositionAppendAtRef,
    lastCompositionCommitAtRef,
    isCompositionSelectionRepairSuppressedRef,
    allowDeferredCompositionMarkdownWithoutCommitRef,
    pendingRawMarkdownRef,
    pendingMarkdownRef,
    pendingMarkdownApplyTimeoutRef,
    hasEditorUserInput,
    userInputVersionRef,
    clearCompositionAppendGuard,
  });

  const shouldSerializeEditorMarkdown = useCallback(() => (
    hasEditorUserInput.current &&
    userInputVersionRef.current > handledUserInputVersionRef.current
  ), []);

  return {
    configureMarkdownListener,
    createUserInputMarker,
    setEditorGetter,
    shouldSerializeEditorMarkdown,
  };
}
