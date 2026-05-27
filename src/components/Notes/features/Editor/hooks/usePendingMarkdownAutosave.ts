import { useCallback, useEffect, useRef } from 'react';
import type { EditorView } from '@milkdown/kit/prose/view';
import { editorViewCtx } from '@milkdown/kit/core';
import { useNotesStore } from '@/stores/useNotesStore';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { hasTemporaryTailParagraph } from '../plugins/cursor/endBlankClickPlugin';
import { getCurrentEditorView } from '../utils/editorViewRegistry';
import {
  serializeEditorMarkdownSnapshot,
} from '../utils/pendingMarkdownUpdate';
import { hasCommittedCompositionText } from '../utils/compositionMarkdown';
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
const DEFAULT_CONTENT_COMMIT_THROTTLE_MS = 120;
const TEST_CONTENT_COMMIT_THROTTLE_MS = 0;
const COMPOSITION_SETTLE_MS = 220;

interface PendingMarkdownAutosaveOptions {
  currentNotePath: string | undefined;
  currentNoteDiskRevision: number;
  currentNoteContent: string;
  updateContent: (content: string) => void;
  debouncedSave: () => void;
}

function getContentCommitThrottleMs(): number {
  if (import.meta.env.MODE === 'test' || Boolean(import.meta.env.VITEST)) {
    const override = (globalThis as { __VL_TEST_CONTENT_COMMIT_THROTTLE_MS__?: number })
      .__VL_TEST_CONTENT_COMMIT_THROTTLE_MS__;
    return typeof override === 'number' ? override : TEST_CONTENT_COMMIT_THROTTLE_MS;
  }
  return DEFAULT_CONTENT_COMMIT_THROTTLE_MS;
}

function isContentEditingUserEvent(event: Event): boolean {
  if (event.type === 'compositionstart' || event.type === 'compositionend') {
    return true;
  }
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

function getEditorViewFromContext(ctx: MilkdownContext): EditorView | null {
  try {
    return ctx.get(editorViewCtx as never) as EditorView;
  } catch {
    return null;
  }
}

function isEditorComposing(view: EditorView | null | undefined): boolean {
  return Boolean(view?.composing);
}

function isInputEvent(event: Event): event is InputEvent {
  return typeof InputEvent !== 'undefined' && event instanceof InputEvent;
}

function isCompositionInputEvent(event: Event): boolean {
  return event.type === 'compositionstart' ||
    event.type === 'compositionend' ||
    (isInputEvent(event) && event.inputType === 'insertCompositionText') ||
    (event instanceof KeyboardEvent && event.isComposing);
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
  const pendingMarkdownApplyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRawMarkdownRef = useRef<string | null>(null);
  const pendingMarkdownRef = useRef<string | null>(null);
  const isCompositionActiveRef = useRef(false);
  const compositionSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredCompositionMarkdownRef = useRef<string | null>(null);
  const deferredCompositionUserInputVersionRef = useRef(0);
  const latestCompositionDataRef = useRef<string | null>(null);
  const hasCompositionEndedRef = useRef(false);
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
    isCompositionActiveRef.current = false;
    deferredCompositionMarkdownRef.current = null;
    deferredCompositionUserInputVersionRef.current = 0;
    latestCompositionDataRef.current = null;
    hasCompositionEndedRef.current = false;
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
    return () => {
      if (compositionSettleTimeoutRef.current !== null) {
        clearTimeout(compositionSettleTimeoutRef.current);
        compositionSettleTimeoutRef.current = null;
      }
    };
  }, [currentNoteDiskRevision, currentNotePath]);

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
    updateContent(markdownToApply);
    if (!latestIsDraftNote || latestNotesPath) {
      debouncedSave();
    }
  }, [currentNotePath, debouncedSave, updateContent]);

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

  const configureMarkdownListener = useCallback((ctx: MilkdownContext, initialContent: string) => {
    const initTime = Date.now();
    const INIT_PERIOD = 500;

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

        isCompositionActiveRef.current = false;
        const deferredMarkdown = deferredCompositionMarkdownRef.current;
        const deferredUserInputVersion = deferredCompositionUserInputVersionRef.current;
        deferredCompositionMarkdownRef.current = null;
        deferredCompositionUserInputVersionRef.current = 0;
        hasCompositionEndedRef.current = false;
        const latestCompositionData = latestCompositionDataRef.current;
        if (hasCommittedCompositionText(deferredMarkdown, latestCompositionData)) {
          processMarkdown(deferredMarkdown, deferredUserInputVersion);
        }
      }, COMPOSITION_SETTLE_MS);
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
  }, [currentNotePath, schedulePendingMarkdownApply]);

  const createUserInputMarker = useCallback((
    _view: EditorView,
    _liveSerializer: ((doc: unknown) => string) | null
  ) => {
    return (event: Event) => {
      if (event.type === 'compositionstart') {
        isCompositionActiveRef.current = true;
        if (compositionSettleTimeoutRef.current !== null) {
          clearTimeout(compositionSettleTimeoutRef.current);
          compositionSettleTimeoutRef.current = null;
        }
        deferredCompositionMarkdownRef.current = null;
        deferredCompositionUserInputVersionRef.current = 0;
        latestCompositionDataRef.current = null;
        hasCompositionEndedRef.current = false;
        pendingRawMarkdownRef.current = null;
        pendingMarkdownRef.current = null;
        return;
      }

      if (event.type === 'compositionend') {
        isCompositionActiveRef.current = true;
        hasCompositionEndedRef.current = true;
      }

      if (!isContentEditingUserEvent(event)) {
        return;
      }

      if (isInputEvent(event) && event.inputType === 'insertCompositionText') {
        latestCompositionDataRef.current = event.data ?? latestCompositionDataRef.current;
      }

      if (!isCompositionInputEvent(event) && pendingMarkdownApplyTimeoutRef.current !== null) {
        clearTimeout(pendingMarkdownApplyTimeoutRef.current);
        pendingMarkdownApplyTimeoutRef.current = null;
        pendingMarkdownRef.current = null;
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
