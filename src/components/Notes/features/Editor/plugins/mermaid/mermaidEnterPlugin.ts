import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { createOpenMermaidEditorState } from './mermaidEditorState';
import { mermaidEditorPluginKey } from './mermaidEditorPluginKey';
import { createMermaidFenceStarterCode } from './mermaidFenceCode';
import { parseMermaidFenceLanguage } from './mermaidLanguage';
import { themeDomStyleTokens } from '@/styles/themeTokens';

const MAX_MERMAID_FENCE_SHORTCUT_TEXT_CHARS = 128;

function markMermaidUserInput(view: EditorView): void {
  view.dom?.dispatchEvent?.(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

function getMermaidEnterViewportPosition(view: EditorView) {
  try {
    const coords = view.coordsAtPos(view.state.selection.from);
    return {
      x: coords.left,
      y: coords.bottom + themeDomStyleTokens.editorPopupAnchorOffsetPx,
    };
  } catch {
    return {
      x: themeDomStyleTokens.editorPopupFallbackX,
      y: themeDomStyleTokens.editorPopupFallbackY,
    };
  }
}

function scheduleMermaidEditorOpen(
  view: EditorView,
  meta: ReturnType<typeof createOpenMermaidEditorState>
): void {
  const openEditor = () => {
    try {
      if (typeof view.state.doc?.nodeAt === 'function') {
        const currentNode = view.state.doc.nodeAt(meta.nodePos);
        if (!currentNode || currentNode.type.name !== 'mermaid') {
          return;
        }
      }

      view.dispatch(
        view.state.tr
          .setMeta(mermaidEditorPluginKey, meta)
          .setMeta('addToHistory', false)
      );
    } catch {
    }
  };

  if (typeof queueMicrotask === 'function') {
    queueMicrotask(openEditor);
    return;
  }

  void Promise.resolve().then(openEditor).catch(() => undefined);
}

export function handleMermaidFenceEnter(view: EditorView): boolean {
  const { state } = view;
  const { selection, schema } = state;
  const { $from } = selection;

  if (!selection.empty) {
    return false;
  }

  const mermaidType = schema.nodes.mermaid;
  if (!mermaidType) {
    return false;
  }

  if ($from.parent.type.name !== 'paragraph') {
    return false;
  }

  if ($from.parentOffset !== $from.parent.content.size) {
    return false;
  }

  if ($from.parent.content.size > MAX_MERMAID_FENCE_SHORTCUT_TEXT_CHARS) {
    return false;
  }

  const shortcutText = $from.parent.textBetween(0, $from.parent.content.size, '', '');
  const fenceLanguage = parseMermaidFenceLanguage(shortcutText);
  if (fenceLanguage === null) {
    return false;
  }
  const starterCode = createMermaidFenceStarterCode(fenceLanguage);

  const parentDepth = $from.depth - 1;
  if (parentDepth < 0) {
    return false;
  }

  const container = $from.node(parentDepth);
  const index = $from.index(parentDepth);
  if (typeof container.canReplaceWith === 'function' && !container.canReplaceWith(index, index + 1, mermaidType)) {
    return false;
  }

  const paragraphPos = $from.before();
  const paragraphEnd = paragraphPos + $from.parent.nodeSize;
  const openEditorMeta = createOpenMermaidEditorState({
    code: starterCode,
    position: getMermaidEnterViewportPosition(view),
    nodePos: paragraphPos,
    openSource: 'new-empty-block',
  });
  const tr = state.tr.replaceWith(
    paragraphPos,
    paragraphEnd,
    mermaidType.create({ code: starterCode })
  );

  markMermaidUserInput(view);
  view.dispatch(tr);
  scheduleMermaidEditorOpen(view, openEditorMeta);
  return true;
}

export const mermaidEnterPlugin = $prose(() => {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        if (event.key !== 'Enter') {
          return false;
        }

        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) {
          return false;
        }

        if (!handleMermaidFenceEnter(view)) {
          return false;
        }

        event.preventDefault();
        return true;
      },
    },
  });
});
