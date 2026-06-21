import { useCallback, useEffect, useRef } from 'react';
import type { EditorView } from '@milkdown/kit/prose/view';
import { TextSelection } from '@milkdown/kit/prose/state';
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
import { themeUiFeedbackTokens } from '@/styles/themeTokens';

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
type CompositionStartSelection = {
  from: number;
  to: number;
  text: string;
};

const CONTENT_EDITING_KEYS = new Set([
  'Backspace',
  'Delete',
  'Enter',
  'Tab',
]);
const SELECTION_MOVEMENT_KEYS = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Escape',
  'Home',
  'PageDown',
  'PageUp',
]);
const COMPOSITION_APPEND_GUARD_MS = 10_000;
const MAX_COMPOSITION_REPAIR_LOOKBACK_CHARS = 160;
const MAX_COMPOSITION_REPAIR_TEXT_LENGTH = 128;
const ALLOW_SYNTHETIC_USER_EVENTS =
  import.meta.env.MODE === 'test' || Boolean(import.meta.env.VITEST);
interface PendingMarkdownAutosaveOptions {
  currentNotePath: string | undefined;
  currentNoteDiskRevision: number;
  currentNoteContent: string;
  updateContent: (content: string) => void;
  debouncedSave: () => void;
  onLocalMarkdownCommitted?: (content: string) => void;
}

function getContentCommitThrottleMs(): number {
  if (import.meta.env.MODE === 'test' || Boolean(import.meta.env.VITEST)) {
    const override = (globalThis as { __VL_TEST_CONTENT_COMMIT_THROTTLE_MS__?: number })
      .__VL_TEST_CONTENT_COMMIT_THROTTLE_MS__;
    return typeof override === 'number' ? override : themeUiFeedbackTokens.editorPendingMarkdownTestCommitThrottleMs;
  }
  return themeUiFeedbackTokens.editorPendingMarkdownCommitThrottleMs;
}

function publishLiveMarkdownPreview(path: string | undefined, content: string) {
  if (!path || typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('editor:note-markdown-preview', {
    detail: { path, content },
  }));
}

function isContentEditingUserEvent(event: Event): boolean {
  if (event.type === 'compositionstart' || event.type === 'compositionend') {
    return true;
  }
  if (event.type.startsWith('editor:')) {
    return true;
  }
  if (event.type === 'pointerdown' || event.type === 'mousedown') {
    return false;
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

function getEventData(event: Event): string | null {
  const data = (event as { data?: unknown }).data;
  return typeof data === 'string' && data.length > 0 ? data : null;
}

function getCompositionClockMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function hasNonAsciiText(text: string | null): text is string {
  return typeof text === 'string' && /[^\x00-\x7F]/.test(text);
}

function isCompositionInputEvent(event: Event): boolean {
  return event.type === 'compositionstart' ||
    event.type === 'compositionend' ||
    (isInputEvent(event) && (event.inputType === 'insertCompositionText' || event.isComposing)) ||
    (event instanceof KeyboardEvent && event.isComposing);
}

function shouldClearCompositionAppendGuard(event: Event): boolean {
  if (
    event.type === 'pointerdown' ||
    event.type === 'mousedown' ||
    event.type === 'paste' ||
    event.type === 'cut' ||
    event.type === 'drop'
  ) {
    return true;
  }

  if (isInputEvent(event)) {
    if (event.isComposing || event.inputType === 'insertCompositionText') {
      return false;
    }
    return event.inputType !== 'insertText';
  }

  if (event instanceof KeyboardEvent) {
    if (event.isComposing) {
      return false;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return true;
    }
    return event.key.length !== 1;
  }

  return false;
}

function shouldSuppressCompositionSelectionRepair(event: Event): boolean {
  if (event.type === 'pointerdown' || event.type === 'mousedown') {
    return true;
  }

  return event instanceof KeyboardEvent &&
    !event.isComposing &&
    SELECTION_MOVEMENT_KEYS.has(event.key);
}

function canCommitSuppressedCompositionEdit(event: Event): boolean {
  return isInputEvent(event) ||
    event.type === 'paste' ||
    event.type === 'cut' ||
    event.type === 'drop' ||
    event.type.startsWith('editor:');
}

export function replaceRecentCompositionText(
  view: EditorView,
  staleText: string | null,
  committedText: string,
): boolean {
  if (
    !staleText ||
    !committedText ||
    staleText === committedText ||
    staleText.length > MAX_COMPOSITION_REPAIR_TEXT_LENGTH
  ) {
    return false;
  }

  try {
    const { state } = view;
    const anchor = state.selection.from;
    const searchFrom = Math.max(0, anchor - staleText.length - MAX_COMPOSITION_REPAIR_LOOKBACK_CHARS);
    const searchTo = Math.min(
      state.doc.content.size,
      anchor + staleText.length + MAX_COMPOSITION_REPAIR_LOOKBACK_CHARS,
    );
    const match: { current: { from: number; to: number } | null } = { current: null };

    state.doc.nodesBetween(searchFrom, searchTo, (node, pos) => {
      if (match.current || !node.isText) return;
      const text = node.text ?? '';
      const fromOffset = Math.max(0, searchFrom - pos);
      const toOffset = Math.min(text.length, searchTo - pos);
      if (fromOffset >= toOffset) return;

      const index = text.slice(fromOffset, toOffset).lastIndexOf(staleText);
      if (index < 0) return;

      const from = pos + fromOffset + index;
      match.current = { from, to: from + staleText.length };
    });

    const matchRange = match.current;
    if (!matchRange) return false;
    view.dispatch(view.state.tr.insertText(committedText, matchRange.from, matchRange.to));
    return true;
  } catch {
    return false;
  }
}

export function collapseCommittedCompositionSelection(
  view: EditorView,
  committedText: string,
  collapseTo?: number,
): boolean {
  if (!committedText || committedText.length > MAX_COMPOSITION_REPAIR_TEXT_LENGTH) {
    return false;
  }

  try {
    const { state } = view;
    const { selection } = state;
    if (selection.empty) return false;

    const selectedText = state.doc.textBetween(selection.from, selection.to, '\n');
    if (selectedText !== committedText) return false;
    const selectionPos = typeof collapseTo === 'number'
      ? Math.max(0, Math.min(state.doc.content.size, collapseTo))
      : selection.to;

    view.dispatch(
      state.tr.setSelection(TextSelection.create(state.doc, selectionPos)),
    );
    syncDomSelectionAtPosition(view, selectionPos);
    return true;
  } catch {
    return false;
  }
}

export function replaceSelectedTextWithCommittedComposition(
  view: EditorView,
  committedText: string,
): boolean {
  if (!committedText || committedText.length > MAX_COMPOSITION_REPAIR_TEXT_LENGTH) {
    return false;
  }

  try {
    const { state } = view;
    const { selection } = state;
    if (selection.empty) return false;

    const selectedText = state.doc.textBetween(selection.from, selection.to, '\n');
    if (
      !selectedText ||
      selectedText === committedText ||
      selectedText.includes('\n') ||
      selectedText.length > MAX_COMPOSITION_REPAIR_TEXT_LENGTH
    ) {
      return false;
    }

    const tr = state.tr.insertText(committedText, selection.from, selection.to);
    const selectionPos = Math.min(tr.doc.content.size, selection.from + committedText.length);
    view.dispatch(
      tr.setSelection(TextSelection.create(tr.doc, selectionPos)),
    );
    syncDomSelectionAtPosition(view, selectionPos);
    return true;
  } catch {
    return false;
  }
}

function captureCompositionStartSelection(view: EditorView): CompositionStartSelection | null {
  try {
    const { selection } = view.state;
    if (selection.empty) return null;

    const selectedText = view.state.doc.textBetween(selection.from, selection.to, '\n');
    if (
      !selectedText ||
      selectedText.includes('\n') ||
      selectedText.length > MAX_COMPOSITION_REPAIR_TEXT_LENGTH
    ) {
      return null;
    }

    return {
      from: selection.from,
      to: selection.to,
      text: selectedText,
    };
  } catch {
    return null;
  }
}

function replaceCompositionStartSelectionWithCommittedText(
  view: EditorView,
  startSelection: CompositionStartSelection | null,
  committedText: string,
): boolean {
  if (
    !startSelection ||
    !committedText ||
    committedText.length > MAX_COMPOSITION_REPAIR_TEXT_LENGTH
  ) {
    return false;
  }

  try {
    const { state } = view;
    const from = Math.max(0, Math.min(state.doc.content.size, startSelection.from));
    const to = Math.max(from, Math.min(state.doc.content.size, startSelection.to));
    if (from === to) return false;

    const selectedText = state.doc.textBetween(from, to, '\n');
    if (selectedText !== startSelection.text || selectedText === committedText) {
      return false;
    }

    const tr = state.tr.insertText(committedText, from, to);
    const selectionPos = Math.min(tr.doc.content.size, from + committedText.length);
    view.dispatch(
      tr.setSelection(TextSelection.create(tr.doc, selectionPos)),
    );
    syncDomSelectionAtPosition(view, selectionPos);
    return true;
  } catch {
    return false;
  }
}

function getSelectedCompositionText(view: EditorView): string | null {
  try {
    const { state } = view;
    const { selection } = state;
    if (selection.empty) return null;

    const selectedText = state.doc.textBetween(selection.from, selection.to, '\n');
    return selectedText.length > 0 ? selectedText : null;
  } catch {
    return null;
  }
}

function getCompositionSelectionAppend(
  view: EditorView,
  event: Event,
  compositionEnded: boolean,
  committedText: string | null,
  appendPos: number | null,
): { pos: number; text: string } | null {
  if (
    !compositionEnded ||
    !isInputEvent(event) ||
    event.isComposing ||
    event.inputType !== 'insertText' ||
    !event.cancelable
  ) {
    return null;
  }

  const text = getEventData(event);
  if (!text) {
    return null;
  }

  if (appendPos !== null) {
    const { selection } = view.state;
    if (selection.empty) {
      return selection.from === appendPos ? { pos: appendPos, text } : null;
    }

    const selectedText = getSelectedCompositionText(view);
    if (
      selectedText &&
      !selectedText.includes('\n') &&
      selectedText.length <= MAX_COMPOSITION_REPAIR_TEXT_LENGTH &&
      (committedText === null || selectedText === committedText)
    ) {
      return { pos: appendPos, text };
    }

    return null;
  }

  const { selection } = view.state;
  if (selection.empty) {
    return null;
  }

  const selectedText = getSelectedCompositionText(view);
  if (
    !selectedText ||
    selectedText.includes('\n') ||
    selectedText.length > MAX_COMPOSITION_REPAIR_TEXT_LENGTH ||
    (committedText !== null && selectedText !== committedText)
  ) {
    return null;
  }

  return { pos: selection.to, text };
}

function insertCompositionAppendText(
  view: EditorView,
  append: { pos: number; text: string },
): number | null {
  try {
    const { pos, text } = append;
    const tr = view.state.tr.insertText(text, pos, pos);
    const selectionPos = Math.min(tr.doc.content.size, pos + text.length);
    view.dispatch(
      tr.setSelection(TextSelection.create(tr.doc, selectionPos)),
    );
    syncDomSelectionAtPosition(view, selectionPos);
    return selectionPos;
  } catch {
    return null;
  }
}

function splitBlockAfterCommittedCompositionSelection(
  view: EditorView,
  event: Event,
  committedText: string | null,
  collapseTo?: number,
): number | null {
  if (
    !(event instanceof KeyboardEvent) ||
    event.key !== 'Enter' ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  ) {
    return null;
  }

  const { selection } = view.state;
  if (selection.empty) {
    return null;
  }

  const selectedText = getSelectedCompositionText(view);
  if (
    !selectedText ||
    selectedText.includes('\n') ||
    selectedText.length > MAX_COMPOSITION_REPAIR_TEXT_LENGTH ||
    (committedText !== null && selectedText !== committedText)
  ) {
    return null;
  }

  const stateBeforeSplit = view.state;
  const selectionPos = typeof collapseTo === 'number'
    ? Math.max(0, Math.min(stateBeforeSplit.doc.content.size, collapseTo))
    : selection.to;
  if (event.cancelable) {
    event.preventDefault();
  }
  event.stopImmediatePropagation();

  try {
    let tr = stateBeforeSplit.tr.setSelection(TextSelection.create(stateBeforeSplit.doc, selectionPos));
    tr = tr.split(selectionPos);
    const mappedSelectionPos = tr.mapping.map(selectionPos, 1);
    tr = tr
      .setSelection(TextSelection.create(tr.doc, mappedSelectionPos))
      .scrollIntoView();
    view.dispatch(tr);
    view.focus();
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, mappedSelectionPos)),
    );
    syncDomSelectionAtPosition(view, mappedSelectionPos);
    return mappedSelectionPos;
  } catch {
    if (collapseSelectionAtPosition(view, selectionPos)) {
      return selectionPos;
    }
  }
  return selectionPos;
}

function syncDomSelectionAtPosition(view: EditorView, pos: number): void {
  try {
    const ownerDocument = view.dom.ownerDocument;
    const selection = ownerDocument.getSelection();
    if (!selection) {
      return;
    }

    const { node, offset } = view.domAtPos(pos);
    const range = ownerDocument.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {
    // Native selection sync is best-effort; ProseMirror state remains authoritative.
  }
}

function collapseSelectionAtPosition(view: EditorView, pos: number): boolean {
  try {
    const selectionPos = Math.max(0, Math.min(view.state.doc.content.size, pos));
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, selectionPos)),
    );
    syncDomSelectionAtPosition(view, selectionPos);
    return true;
  } catch {
    return false;
  }
}

function finalizeCompositionCommit(
  view: EditorView,
  staleCompositionData: string | null,
  committedCompositionData: string,
  startSelection: CompositionStartSelection | null,
): void {
  const repaired = replaceRecentCompositionText(view, staleCompositionData, committedCompositionData);
  const replacedStartSelection = repaired
    ? false
    : replaceCompositionStartSelectionWithCommittedText(view, startSelection, committedCompositionData);
  const replacedSelection = repaired || replacedStartSelection
    ? false
    : replaceSelectedTextWithCommittedComposition(view, committedCompositionData);
  if (!repaired && !replacedStartSelection && !replacedSelection) {
    collapseCommittedCompositionSelection(view, committedCompositionData);
  }
}

function scheduleCompositionCommitFinalization(
  view: EditorView,
  staleCompositionData: string | null,
  committedCompositionData: string,
  startSelection: CompositionStartSelection | null,
): void {
  const finalize = () => {
    finalizeCompositionCommit(view, staleCompositionData, committedCompositionData, startSelection);
  };

  setTimeout(finalize, 0);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      requestAnimationFrame(finalize);
    });
  }
  setTimeout(finalize, 80);
}

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

  const configureMarkdownListener = useCallback((ctx: MilkdownContext, initialContent: string) => {
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

      scheduleLiveMarkdownPreview(currentNotePath, markdown);
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
  }, [currentNotePath, scheduleLiveMarkdownPreview, schedulePendingMarkdownApply]);

  const createUserInputMarker = useCallback((
    view: EditorView,
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
        compositionStartSelectionRef.current = captureCompositionStartSelection(view);
        lastCompositionCommitAtRef.current = 0;
        isCompositionSelectionRepairSuppressedRef.current = false;
        allowDeferredCompositionMarkdownWithoutCommitRef.current = false;
        clearCompositionAppendGuard();
        pendingRawMarkdownRef.current = null;
        pendingMarkdownRef.current = null;
        return;
      }

      if (event.type === 'compositionend') {
        isCompositionActiveRef.current = true;
        hasCompositionEndedRef.current = true;
        isCompositionSelectionRepairSuppressedRef.current = false;
        allowDeferredCompositionMarkdownWithoutCommitRef.current = false;
        clearCompositionAppendGuard();
        const compositionEndData = getEventData(event) ??
          (hasNonAsciiText(latestCompositionDataRef.current) ? latestCompositionDataRef.current : null) ??
          getSelectedCompositionText(view);
        if (compositionEndData) {
          const staleCompositionData = latestCompositionDataRef.current;
          const committedCompositionData = compositionEndData;
          const startSelection = compositionStartSelectionRef.current;
          latestCompositionDataRef.current = committedCompositionData;
          lastCompositionCommitAtRef.current = getCompositionClockMs();
          finalizeCompositionCommit(view, staleCompositionData, committedCompositionData, startSelection);
          scheduleCompositionCommitFinalization(view, staleCompositionData, committedCompositionData, startSelection);
        }
      }

      const isCompositionEvent = isCompositionInputEvent(event);
      const isContentEditingEvent = isContentEditingUserEvent(event);
      const markUserInputVersion = () => {
        hasEditorUserInput.current = true;
        userInputVersionRef.current += 1;
      };
      const clearPendingApplyForFreshInput = () => {
        if (pendingMarkdownApplyTimeoutRef.current === null) {
          return;
        }
        clearTimeout(pendingMarkdownApplyTimeoutRef.current);
        pendingMarkdownApplyTimeoutRef.current = null;
        pendingMarkdownRef.current = null;
      };
      const now = getCompositionClockMs();
      const activeAppendPosition = compositionAppendPositionRef.current !== null &&
        now - lastCompositionAppendAtRef.current <= COMPOSITION_APPEND_GUARD_MS
        ? compositionAppendPositionRef.current
        : null;
      if (compositionAppendPositionRef.current !== null && activeAppendPosition === null) {
        clearCompositionAppendGuard();
      }
      const hasRecentCompositionCommit = latestCompositionDataRef.current !== null &&
        lastCompositionCommitAtRef.current > 0 &&
        now - lastCompositionCommitAtRef.current <= COMPOSITION_APPEND_GUARD_MS;
      const shouldClearAppendGuard = shouldClearCompositionAppendGuard(event);
      const shouldSuppressSelectionRepair = shouldSuppressCompositionSelectionRepair(event);
      const compositionSelectionAppend = isContentEditingEvent
        && !isCompositionSelectionRepairSuppressedRef.current
        ? getCompositionSelectionAppend(
          view,
          event,
          hasCompositionEndedRef.current || activeAppendPosition !== null,
          latestCompositionDataRef.current,
          activeAppendPosition,
        )
        : null;

      if (compositionSelectionAppend) {
        clearPendingApplyForFreshInput();
        markUserInputVersion();
        const nextAppendPosition = insertCompositionAppendText(view, compositionSelectionAppend);
        if (nextAppendPosition !== null) {
          compositionAppendPositionRef.current = nextAppendPosition;
          lastCompositionAppendPositionRef.current = nextAppendPosition;
          lastCompositionAppendAtRef.current = getCompositionClockMs();
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }

      let compositionSelectionSplitPosition: number | null = null;
      if (
        event instanceof KeyboardEvent &&
        event.key === 'Enter' &&
        isContentEditingEvent &&
        !isCompositionSelectionRepairSuppressedRef.current &&
        (hasCompositionEndedRef.current || activeAppendPosition !== null || hasRecentCompositionCommit)
      ) {
        clearPendingApplyForFreshInput();
        markUserInputVersion();
        compositionSelectionSplitPosition = splitBlockAfterCommittedCompositionSelection(
          view,
          event,
          latestCompositionDataRef.current,
          activeAppendPosition ?? undefined,
        );
      }

      if (compositionSelectionSplitPosition !== null) {
        isCompositionActiveRef.current = false;
        compositionAppendPositionRef.current = compositionSelectionSplitPosition;
        lastCompositionAppendPositionRef.current = compositionSelectionSplitPosition;
        lastCompositionAppendAtRef.current = getCompositionClockMs();
        return;
      }

      const shouldRepairCompositionSelection = isCompositionActiveRef.current ||
        hasCompositionEndedRef.current ||
        activeAppendPosition !== null ||
        lastCompositionAppendPositionRef.current !== null;
      if (
        !isCompositionEvent &&
        shouldRepairCompositionSelection &&
        !isCompositionSelectionRepairSuppressedRef.current
      ) {
        const recentAppendPosition = lastCompositionAppendPositionRef.current;
        const selectedCompositionText = recentAppendPosition !== null
          ? getSelectedCompositionText(view)
          : null;
        const collapsedKnownComposition = collapseCommittedCompositionSelection(
          view,
          latestCompositionDataRef.current ?? selectedCompositionText ?? '',
          activeAppendPosition ?? recentAppendPosition ?? undefined,
        );
        if (collapsedKnownComposition && recentAppendPosition !== null) {
          lastCompositionAppendPositionRef.current = null;
        }
        if (!collapsedKnownComposition && (isCompositionActiveRef.current || hasCompositionEndedRef.current)) {
          const selectedCompositionText = getSelectedCompositionText(view);
          if (
            selectedCompositionText &&
            selectedCompositionText.length <= MAX_COMPOSITION_REPAIR_TEXT_LENGTH
          ) {
            collapseCommittedCompositionSelection(view, selectedCompositionText);
          }
        }
      }

      if (shouldSuppressSelectionRepair) {
        isCompositionSelectionRepairSuppressedRef.current = true;
      }
      if (shouldClearAppendGuard) {
        clearCompositionAppendGuard();
      }

      if (isInputEvent(event)) {
        const inputData = getEventData(event);
        if (
          inputData &&
          (
            event.inputType === 'insertCompositionText' ||
            event.isComposing ||
            (isCompositionActiveRef.current && !hasCompositionEndedRef.current)
          )
        ) {
          latestCompositionDataRef.current = inputData;
        }
      }

      if (!isContentEditingEvent) {
        return;
      }

      if (
        isCompositionSelectionRepairSuppressedRef.current &&
        !isCompositionEvent &&
        canCommitSuppressedCompositionEdit(event)
      ) {
        deferredCompositionMarkdownRef.current = null;
        deferredCompositionUserInputVersionRef.current = 0;
        allowDeferredCompositionMarkdownWithoutCommitRef.current = true;
      }

      if (!isCompositionEvent) {
        clearPendingApplyForFreshInput();
      }
      markUserInputVersion();
    };
  }, [clearCompositionAppendGuard]);

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
