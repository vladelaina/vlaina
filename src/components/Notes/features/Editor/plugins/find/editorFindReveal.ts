import type { EditorView } from '@milkdown/kit/prose/view';
import { toggleCodeBlockCollapsed } from '../code/codeBlockTransactions';
import { expandCollapsedHeadingSectionAtPos } from '../heading/collapse';
import type { EditorFindMatch } from './editorFindMatches';

export function findCollapsedCodeBlockPos(view: EditorView, pos: number): number | null {
  const $pos = view.state.doc.resolve(pos);

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.type.name !== 'code_block' || !node.attrs.collapsed) {
      continue;
    }

    return $pos.before(depth);
  }

  return null;
}

export function revealEditorFindMatch(view: EditorView, match: EditorFindMatch): boolean {
  const matchPos = match.ranges[0]?.from ?? match.from;
  let revealed = expandCollapsedHeadingSectionAtPos(view, matchPos);

  const codeBlockPos = findCollapsedCodeBlockPos(view, matchPos);
  if (codeBlockPos === null) {
    return revealed;
  }

  toggleCodeBlockCollapsed(view, codeBlockPos, true);
  revealed = true;
  return revealed;
}
