import { $prose } from '@milkdown/kit/utils';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { frontmatterSchema } from './frontmatterSchema';
import { FrontmatterNodeView } from './FrontmatterNodeView';
import { isFrontmatterShortcutText } from './frontmatterMarkdown';

export function handleFrontmatterShortcutEnter(view: EditorView): boolean {
  const { state } = view;
  const { selection, schema } = state;
  const { $from } = selection;
  const frontmatterType = schema.nodes.frontmatter;
  const paragraphType = schema.nodes.paragraph;

  if (!selection.empty || !frontmatterType || !paragraphType) {
    return false;
  }

  if ($from.parent.type !== paragraphType) {
    return false;
  }

  if ($from.parentOffset !== $from.parent.content.size) {
    return false;
  }

  if (!isFrontmatterShortcutText($from.parent.textContent)) {
    return false;
  }

  const parentDepth = $from.depth - 1;
  if (parentDepth < 0) {
    return false;
  }

  const container = $from.node(parentDepth);
  const index = $from.index(parentDepth);
  if (parentDepth !== 0 || index !== 0) {
    return false;
  }

  if (typeof container.canReplaceWith === 'function' && !container.canReplaceWith(index, index + 1, frontmatterType)) {
    return false;
  }

  const paragraphPos = $from.before();
  const paragraphEnd = paragraphPos + $from.parent.nodeSize;
  const tr = state.tr.replaceWith(paragraphPos, paragraphEnd, frontmatterType.create());
  tr.setSelection(TextSelection.create(tr.doc, paragraphPos + 1)).scrollIntoView();

  view.dispatch(tr);
  return true;
}

export const frontmatterNodeViewPlugin = $prose(() => {
  return new Plugin({
    props: {
      nodeViews: {
        frontmatter: (node, view, getPos) => new FrontmatterNodeView(node, view, getPos),
      },
    },
  });
});

export const frontmatterEnterPlugin = $prose(() => {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        if (event.key !== 'Enter') {
          return false;
        }

        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) {
          return false;
        }

        if (!handleFrontmatterShortcutEnter(view)) {
          return false;
        }

        event.preventDefault();
        return true;
      },
    },
  });
});

export const frontmatterPlugin = [
  frontmatterSchema,
  frontmatterNodeViewPlugin,
  frontmatterEnterPlugin,
];
