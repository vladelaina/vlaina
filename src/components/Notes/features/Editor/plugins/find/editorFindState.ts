import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorFindMatch } from './editorFindMatches';
import { normalizeEditorFindActiveIndex } from './editorFindMatches';

export interface EditorFindPluginState {
  query: string;
  matches: EditorFindMatch[];
  activeIndex: number;
  decorations: DecorationSet;
}

export type EditorFindPluginMeta =
  | { type: 'clear' }
  | { type: 'set-query'; query: string; preferredFrom: number }
  | { type: 'set-active-index'; activeIndex: number };

export interface EditorFindSnapshot {
  query: string;
  matches: readonly EditorFindMatch[];
  activeIndex: number;
  view: EditorView | null;
  version: number;
}

export const EMPTY_MATCHES: readonly EditorFindMatch[] = [];
export const EMPTY_DECORATIONS = DecorationSet.empty;
export const EMPTY_STATE: EditorFindPluginState = {
  query: '',
  matches: [],
  activeIndex: -1,
  decorations: EMPTY_DECORATIONS,
};

function createEditorFindDecorations(
  doc: ProseNode,
  matches: EditorFindMatch[],
  activeIndex: number,
): DecorationSet {
  if (matches.length === 0) {
    return EMPTY_DECORATIONS;
  }

  const decorations = matches.flatMap((match, index) =>
    match.ranges.map((range) =>
      Decoration.inline(range.from, range.to, {
        class:
          index === activeIndex
            ? 'vlaina-editor-find-match vlaina-editor-find-match-active'
            : 'vlaina-editor-find-match',
      }),
    ),
  );

  return DecorationSet.create(doc, decorations);
}

export function createEditorFindState(
  doc: ProseNode,
  query: string,
  matches: EditorFindMatch[],
  activeIndex: number,
): EditorFindPluginState {
  const normalizedActiveIndex =
    matches.length === 0 ? -1 : normalizeEditorFindActiveIndex(activeIndex, matches.length);

  return {
    query,
    matches,
    activeIndex: normalizedActiveIndex,
    decorations: createEditorFindDecorations(doc, matches, normalizedActiveIndex),
  };
}
