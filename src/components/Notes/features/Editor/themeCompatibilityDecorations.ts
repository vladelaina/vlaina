import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { themeUiFeedbackTokens } from '@/styles/themeTokens';
import { DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT } from './plugins/shared/boundedProseNodeScan';
import { listContainsTaskItems } from './themeCompatibilityDecorations/typoraBlockAttrs';
import { buildTyporaCompatibilityDecorations } from './themeCompatibilityDecorations/typoraDecorations';

export { listContainsTaskItems };

export const MAX_THEME_COMPATIBILITY_DECORATIONS = 6000;
export const MAX_THEME_COMPATIBILITY_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const DEFAULT_THEME_COMPATIBILITY_DECORATION_DEBOUNCE_MS =
  themeUiFeedbackTokens.editorThemeCompatibilityDecorationDebounceMs;
export const themeCompatibilityDecorationsPluginKey = new PluginKey<DecorationSet>('themeCompatibilityDecorations');

const THEME_COMPATIBILITY_SAFE_CONTENT_NODES = new Set(['code_block', 'frontmatter']);
const REBUILD_THEME_COMPATIBILITY_DECORATIONS_META = { type: 'rebuild' } as const;

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

export function createThemeCompatibilityDecorationRebuildController({
  delayMs = DEFAULT_THEME_COMPATIBILITY_DECORATION_DEBOUNCE_MS,
  dispatchRebuild,
}: {
  delayMs?: number;
  dispatchRebuild: () => void;
}) {
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const clearPendingTimer = () => {
    if (pendingTimer === null) {
      return;
    }
    clearTimeout(pendingTimer);
    pendingTimer = null;
  };

  const flush = () => {
    clearPendingTimer();
    if (destroyed) {
      return;
    }
    dispatchRebuild();
  };

  const schedule = () => {
    if (destroyed) {
      return;
    }
    clearPendingTimer();
    pendingTimer = setTimeout(flush, Math.max(0, delayMs));
  };

  const destroy = () => {
    destroyed = true;
    clearPendingTimer();
  };

  return {
    destroy,
    flush,
    schedule,
  };
}

export const themeCompatibilityDecorationsPlugin = $prose(() => {
  return new Plugin({
    key: themeCompatibilityDecorationsPluginKey,
    state: {
      init(_config, state) {
        return buildCompatibilityDecorations(state.doc);
      },
      apply(tr, previous, _oldState, newState) {
        if (tr.getMeta(themeCompatibilityDecorationsPluginKey)?.type === 'rebuild') {
          return buildCompatibilityDecorations(newState.doc);
        }
        if (!tr.docChanged) return previous.map(tr.mapping, tr.doc);
        if (!docChangeMayAffectThemeCompatibilityDecorations(_oldState.doc, newState.doc)) {
          return previous.map(tr.mapping, newState.doc);
        }
        return previous.map(tr.mapping, newState.doc);
      },
    },
    view(editorView: EditorView) {
      let currentView = editorView;
      const controller = createThemeCompatibilityDecorationRebuildController({
        dispatchRebuild: () => {
          currentView.dispatch(
            currentView.state.tr
              .setMeta(themeCompatibilityDecorationsPluginKey, REBUILD_THEME_COMPATIBILITY_DECORATIONS_META)
              .setMeta('addToHistory', false)
          );
        },
      });

      return {
        update(nextView, prevState) {
          currentView = nextView;
          if (prevState.doc.eq(nextView.state.doc)) {
            return;
          }
          if (!docChangeMayAffectThemeCompatibilityDecorations(prevState.doc, nextView.state.doc)) {
            return;
          }
          controller.schedule();
        },
        destroy() {
          controller.destroy();
        },
      };
    },
    props: {
      decorations(state) {
        return themeCompatibilityDecorationsPluginKey.getState(state) ?? DecorationSet.empty;
      },
    },
  });
});
