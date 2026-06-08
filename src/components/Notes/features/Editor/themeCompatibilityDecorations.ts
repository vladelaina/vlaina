import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Plugin } from '@milkdown/kit/prose/state';
import { DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT } from './plugins/shared/boundedProseNodeScan';
import { listContainsTaskItems } from './themeCompatibilityDecorations/typoraBlockAttrs';
import { buildTyporaCompatibilityDecorations } from './themeCompatibilityDecorations/typoraDecorations';

export { listContainsTaskItems };

export const MAX_THEME_COMPATIBILITY_DECORATIONS = 6000;
export const MAX_THEME_COMPATIBILITY_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;

const THEME_COMPATIBILITY_SAFE_CONTENT_NODES = new Set(['code_block', 'frontmatter']);

export function buildCompatibilityDecorations(doc: any): DecorationSet {
  return buildTyporaCompatibilityDecorations(doc, {
    maxDecorations: MAX_THEME_COMPATIBILITY_DECORATIONS,
    maxScanNodes: MAX_THEME_COMPATIBILITY_DOC_SCAN_NODES,
  });
}

function rangeIsInsideThemeCompatibilitySafeContent(
  doc: ProseNode,
  from: number,
  to: number
): boolean {
  const start = Math.max(0, Math.min(from, doc.content.size));
  const end = Math.max(start, Math.min(to, doc.content.size));
  const $start = doc.resolve(start);

  for (let depth = $start.depth; depth > 0; depth -= 1) {
    const node = $start.node(depth);
    if (!THEME_COMPATIBILITY_SAFE_CONTENT_NODES.has(node.type.name)) {
      continue;
    }

    const contentStart = $start.before(depth) + 1;
    const contentEnd = $start.after(depth) - 1;
    return start >= contentStart && end <= contentEnd;
  }

  return false;
}

export function docChangeMayAffectThemeCompatibilityDecorations(
  prevDoc: ProseNode,
  nextDoc: ProseNode
): boolean {
  const diffStart = prevDoc.content.findDiffStart(nextDoc.content);
  if (diffStart === null) return false;

  const diffEnd = prevDoc.content.findDiffEnd(nextDoc.content);
  if (!diffEnd) return true;

  return !(
    rangeIsInsideThemeCompatibilitySafeContent(prevDoc, diffStart, diffEnd.a) &&
    rangeIsInsideThemeCompatibilitySafeContent(nextDoc, diffStart, diffEnd.b)
  );
}

export const themeCompatibilityDecorationsPlugin = $prose(() => {
  return new Plugin({
    state: {
      init(_config, state) {
        return buildCompatibilityDecorations(state.doc);
      },
      apply(tr, previous, _oldState, newState) {
        if (!tr.docChanged) return previous.map(tr.mapping, tr.doc);
        if (!docChangeMayAffectThemeCompatibilityDecorations(_oldState.doc, newState.doc)) {
          return previous.map(tr.mapping, newState.doc);
        }
        return buildCompatibilityDecorations(newState.doc);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state) ?? DecorationSet.empty;
      },
    },
  });
});
