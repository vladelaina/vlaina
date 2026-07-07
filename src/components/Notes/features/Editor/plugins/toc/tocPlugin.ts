import { $node, $command, $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { TocAttrs } from './types';
import { isTocShortcutText } from './tocShortcut';
import {
  findInsertedNodePos,
  moveSelectionAfterInsertedNode,
} from '../shared/insertedNodeSelection';
import {
  getTocEmptyText,
  normalizeTocMaxLevel,
} from './tocViewUtils';
import { tocViewPlugin } from './tocViewPlugin';

export { tocViewPlugin } from './tocViewPlugin';

const MAX_TOC_SHORTCUT_TEXT_CHARS = 32;

export const tocSchema = $node('toc', () => ({
  group: 'block',
  atom: true,
  selectable: true,
  attrs: {
    maxLevel: { default: 6 }
  },
  parseDOM: [{
    tag: 'div[data-type="toc"]',
    getAttrs: (dom) => ({
      maxLevel: normalizeTocMaxLevel((dom as HTMLElement).dataset.maxLevel)
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as TocAttrs;
    const maxLevel = normalizeTocMaxLevel(attrs.maxLevel);
    return [
      'div',
      {
        'data-type': 'toc',
        'data-max-level': String(maxLevel),
        class: 'toc-block md-toc'
      },
      ['div', { class: 'toc-content md-toc-content' }, getTocEmptyText()]
    ];
  },
  parseMarkdown: {
    match: (node) => {
      if (node.type === 'container') {
        const hProperties = (node as {
          data?: {
            hName?: string;
            hProperties?: {
              className?: unknown;
              dataType?: unknown;
            };
          };
        }).data?.hProperties;
        const className = hProperties?.className;
        const classes = Array.isArray(className) ? className : [];
        return hProperties?.dataType === 'toc' || classes.includes('toc-block') || classes.includes('md-toc');
      }

      if (node.type === 'paragraph') {
        if ((node as { data?: { vlainaEscapedTocShortcut?: unknown } }).data?.vlainaEscapedTocShortcut) {
          return false;
        }
        const children = node.children as Array<{ type: string; value?: string }> | undefined;
        if (children?.length === 1 && children[0].type === 'text') {
          const text = children[0].value || '';
          return isTocShortcutText(text);
        }
      }
      return false;
    },
    runner: (state, _node, type) => {
      state.addNode(type, { maxLevel: 6 });
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'toc',
    runner: (state) => {
      state.addNode('paragraph', undefined, undefined, {
        children: [{ type: 'text', value: '[TOC]' }]
      });
    }
  }
}));

export const insertTocCommand = $command('insertToc', () => () => {
  return (state: any, dispatch?: ((tr: any) => void) | null) => {
    const { schema } = state;
    const tocType = schema.nodes.toc;
    
    if (!tocType) return false;
    
    if (dispatch) {
      const node = tocType.create({ maxLevel: 6 });
      const tr = state.tr.replaceSelectionWith(node);
      const preferredPos = typeof tr.mapping?.map === 'function'
        ? tr.mapping.map(state.selection.from, -1)
        : state.selection.from;
      const tocPos = findInsertedNodePos({
        doc: tr.doc,
        preferredPos,
        nodeTypeName: 'toc',
      });
      moveSelectionAfterInsertedNode({
        tr,
        nodePos: tocPos,
        insertedNodeFallback: node,
        paragraphType: schema.nodes.paragraph,
      });
      dispatch(tr.scrollIntoView());
    }
    
    return true;
  };
});

export function handleTocShortcutEnter(view: EditorView): boolean {
  const { state } = view;
  const { selection, schema } = state;
  const { $from } = selection;
  const tocType = schema.nodes.toc;

  if (!selection.empty || !tocType) {
    return false;
  }

  if ($from.parent.type.name !== 'paragraph') {
    return false;
  }

  if ($from.parentOffset !== $from.parent.content.size) {
    return false;
  }

  if ($from.parent.attrs?.vlainaEscapedBlockSyntax === 'toc') {
    return false;
  }

  if ($from.parent.content.size > MAX_TOC_SHORTCUT_TEXT_CHARS) {
    return false;
  }

  const shortcutText = $from.parent.textBetween(0, $from.parent.content.size, '', '');
  if (!isTocShortcutText(shortcutText)) {
    return false;
  }

  const parentDepth = $from.depth - 1;
  if (parentDepth < 0) {
    return false;
  }

  const container = $from.node(parentDepth);
  const index = $from.index(parentDepth);
  if (typeof container.canReplaceWith === 'function' && !container.canReplaceWith(index, index + 1, tocType)) {
    return false;
  }

  const paragraphPos = $from.before();
  const paragraphEnd = paragraphPos + $from.parent.nodeSize;
  const tocNode = tocType.create({ maxLevel: 6 });
  const tr = state.tr
    .replaceWith(paragraphPos, paragraphEnd, tocNode)
    .scrollIntoView();
  moveSelectionAfterInsertedNode({
    tr,
    nodePos: paragraphPos,
    insertedNodeFallback: tocNode,
    paragraphType: schema.nodes.paragraph,
  });

  view.dispatch(tr);
  return true;
}

export const tocEnterPlugin = $prose(() => {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        if (event.key !== 'Enter') {
          return false;
        }

        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) {
          return false;
        }

        if (!handleTocShortcutEnter(view)) {
          return false;
        }

        event.preventDefault();
        return true;
      },
    },
  });
});

export const tocPlugin = [
  tocSchema,
  insertTocCommand,
  tocViewPlugin,
  tocEnterPlugin,
];
