import { Slice } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { useToastStore } from '@/stores/useToastStore';
import { normalizeSerializedMarkdownSelection } from '../../clipboard/markdownSerializationUtils';
import { serializeSliceToText } from '../../clipboard/serializer';
import { getCurrentMarkdownParser } from '../../../utils/editorViewRegistry';
import type { AiSelectionSuggestion } from './selectionCommandTypes';

export function getSerializedSelectionText(view: EditorView): string {
  const { from, to } = view.state.selection;
  if (from >= to) {
    return '';
  }

  const serialized = normalizeSerializedMarkdownSelection(
    serializeSliceToText(view.state.doc.slice(from, to))
  );
  return serialized;
}

export interface SerializedSelectionContext {
  beforeContext: string;
  afterContext: string;
}

const SHORT_SELECTION_CONTEXT_CHARS = 600;
const MEDIUM_SELECTION_CONTEXT_CHARS = 400;
const LONG_SELECTION_CONTEXT_CHARS = 200;

function getSideContextLimit(selectedText: string): number {
  const length = selectedText.length;
  if (length < 200) {
    return SHORT_SELECTION_CONTEXT_CHARS;
  }
  if (length < 1000) {
    return MEDIUM_SELECTION_CONTEXT_CHARS;
  }
  return LONG_SELECTION_CONTEXT_CHARS;
}

function serializeDocumentRange(view: EditorView, from: number, to: number): string {
  if (from >= to) {
    return '';
  }

  return normalizeSerializedMarkdownSelection(
    serializeSliceToText(view.state.doc.slice(from, to))
  );
}

function cropStart(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const cropped = text.slice(text.length - maxLength);
  const boundaryAligned = cropped.replace(/^\S+\s+/, '').trimStart();
  return boundaryAligned.length > 0 ? boundaryAligned : cropped.trimStart();
}

function cropEnd(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const cropped = text.slice(0, maxLength);
  const boundaryAligned = cropped.replace(/\s+\S+$/, '').trimEnd();
  return boundaryAligned.length > 0 ? boundaryAligned : cropped.trimEnd();
}

function getCodeBlockRange(view: EditorView, from: number, to: number): { from: number; to: number } | null {
  try {
    const $from = view.state.doc.resolve(from);
    const $to = view.state.doc.resolve(to);
    const maxDepth = Math.min($from.depth, $to.depth);

    for (let depth = maxDepth; depth >= 0; depth -= 1) {
      if ($from.node(depth) !== $to.node(depth)) {
        continue;
      }

      if ($from.node(depth)?.type.name !== 'code_block') {
        continue;
      }

      return {
        from: $from.start(depth),
        to: $from.end(depth),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function getSerializedSelectionContext(
  view: EditorView,
  from: number,
  to: number,
  selectedText: string
): SerializedSelectionContext {
  const maxPos = view.state.doc.content.size;
  const nextFrom = Math.max(0, Math.min(from, maxPos));
  const nextTo = Math.max(nextFrom, Math.min(to, maxPos));
  const sideLimit = getSideContextLimit(selectedText);
  const searchLimit = sideLimit * 2;
  const codeBlockRange = getCodeBlockRange(view, nextFrom, nextTo);
  const minContextPos = codeBlockRange?.from ?? 0;
  const maxContextPos = codeBlockRange?.to ?? maxPos;

  const beforeFrom = Math.max(minContextPos, nextFrom - searchLimit);
  const afterTo = Math.min(maxContextPos, nextTo + searchLimit);

  return {
    beforeContext: cropStart(serializeDocumentRange(view, beforeFrom, nextFrom), sideLimit),
    afterContext: cropEnd(serializeDocumentRange(view, nextTo, afterTo), sideLimit),
  };
}

function parseMarkdownToSlice(
  view: EditorView,
  from: number,
  to: number,
  markdown: string
): Slice | null {
  const parser = getCurrentMarkdownParser();
  if (!parser) {
    return null;
  }

  try {
    const doc = parser(markdown);
    const parsedInlineContent = getSingleTextBlockContent(doc);
    if (parsedInlineContent && isInlineSelectionRange(view, from, to)) {
      return new Slice(parsedInlineContent as Slice['content'], 0, 0);
    }

    const currentSlice = view.state.doc.slice(from, to);
    return new Slice(doc.content as Slice['content'], currentSlice.openStart, currentSlice.openEnd);
  } catch (error) {
    return null;
  }
}

function isInlineSelectionRange(view: EditorView, from: number, to: number): boolean {
  try {
    const $from = view.state.doc.resolve(from);
    const $to = view.state.doc.resolve(to);
    return (
      $from.depth === $to.depth &&
      $from.parent === $to.parent &&
      Boolean($from.parent?.inlineContent)
    );
  } catch {
    return false;
  }
}

function getSingleTextBlockContent(doc: unknown): unknown | null {
  const maybeDoc = doc as {
    childCount?: number;
    child?: (index: number) => {
      isTextblock?: boolean;
      content?: unknown;
    };
  };

  if (maybeDoc.childCount !== 1 || typeof maybeDoc.child !== 'function') {
    return null;
  }

  const child = maybeDoc.child(0);
  if (!child?.isTextblock) {
    return null;
  }

  return child.content ?? null;
}

function replaceSelectionWithText(view: EditorView, from: number, to: number, text: string) {
  const parsedSlice = parseMarkdownToSlice(view, from, to, text);
  const tr = parsedSlice
    ? view.state.tr.replaceRange(from, to, parsedSlice).scrollIntoView()
    : view.state.tr.insertText(text, from, to).scrollIntoView();
  view.dispatch(tr);
  view.focus();
}

function isOriginalSelectionStillCurrent(
  view: EditorView,
  from: number,
  to: number,
  originalText: string
): boolean {
  return serializeDocumentRange(view, from, to) === originalText;
}

export function applyAiSelectionSuggestion(
  view: EditorView,
  suggestion: AiSelectionSuggestion
): boolean {
  const maxPos = view.state.doc.content.size;
  const from = Math.max(0, Math.min(suggestion.from, maxPos));
  const to = Math.max(from, Math.min(suggestion.to, maxPos));
  if (!isOriginalSelectionStillCurrent(view, from, to, suggestion.originalText)) {
    useToastStore.getState().addToast(
      'The selected text changed before the AI result was applied.',
      'warning'
    );
    return false;
  }

  replaceSelectionWithText(view, from, to, suggestion.suggestedText);
  return true;
}
