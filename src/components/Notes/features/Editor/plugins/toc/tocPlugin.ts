import { $node, $command, $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { TocAttrs } from './types';
import { isTocShortcutText } from './tocShortcut';
import {
  createHeadingsSignature,
  extractHeadings,
  normalizeTocMaxLevel,
  renderTocContent,
  TOC_EMPTY_TEXT,
} from './tocViewUtils';
import { collectTocBlocks, docHasTocNode, stepSliceContainsToc } from './tocScan';

const tocViewPluginKey = new PluginKey<{ hasToc: boolean }>('tocView');

function transactionMayInsertToc(tr: unknown): boolean {
  const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
  return steps.some(stepSliceContainsToc);
}

export const tocViewPlugin = $prose(() => {
  let lastDoc: object | null = null;
  let lastHeadingSignature = '';
  let lastTocCount = -1;

  return new Plugin({
    key: tocViewPluginKey,
    state: {
      init(_config, state) {
        return { hasToc: docHasTocNode(state.doc) };
      },
      apply(tr, previous) {
        if (!tr.docChanged) {
          return previous;
        }
        if (!previous.hasToc && !transactionMayInsertToc(tr)) {
          return previous;
        }
        return { hasToc: docHasTocNode(tr.doc) };
      },
    },
    view(editorView) {
      const handleTocClick = (event: MouseEvent) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const link = target.closest('.toc-link[data-heading-pos]') as HTMLElement | null;
        if (!link || !editorView.dom.contains(link)) return;

        event.preventDefault();
        event.stopPropagation();

        const headingPos = Number(link.dataset.headingPos);
        if (!Number.isFinite(headingPos)) return;

        const { doc } = editorView.state;
        const safePos = Math.max(0, Math.min(headingPos + 1, doc.content.size));
        const tr = editorView.state.tr
          .setSelection(Selection.near(doc.resolve(safePos), 1))
          .scrollIntoView();
        editorView.dispatch(tr);
        editorView.focus();
      };

      editorView.dom.addEventListener('click', handleTocClick);

      return {
        update(view) {
          if (!tocViewPluginKey.getState(view.state)?.hasToc) {
            lastDoc = view.state.doc;
            lastHeadingSignature = '';
            lastTocCount = 0;
            return;
          }

          const { doc } = view.state;
          const tocElements = collectTocBlocks(view.dom);
          if (tocElements.length === 0) {
            lastDoc = doc;
            lastHeadingSignature = '';
            lastTocCount = 0;
            return;
          }

          const headings = extractHeadings(doc, 6);
          const headingSignature = createHeadingsSignature(headings);
          if (
            lastDoc === doc
            && lastHeadingSignature === headingSignature
            && lastTocCount === tocElements.length
          ) {
            return;
          }

          lastDoc = doc;
          lastHeadingSignature = headingSignature;
          lastTocCount = tocElements.length;

          for (const el of tocElements) {
            const maxLevel = parseInt(el.getAttribute('data-max-level') || '6', 10);
            const contentEl = el.querySelector<HTMLElement>('.toc-content');
            if (!contentEl) continue;
            renderTocContent(contentEl, headings, maxLevel);
          }
        },
        destroy() {
          editorView.dom.removeEventListener('click', handleTocClick);
        },
      };
    }
  });
});

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
        class: 'toc-block'
      },
      ['div', { class: 'toc-content' }, TOC_EMPTY_TEXT]
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
        return hProperties?.dataType === 'toc' || classes.includes('toc-block');
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

  if (!isTocShortcutText($from.parent.textContent)) {
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
  const tr = state.tr
    .replaceWith(paragraphPos, paragraphEnd, tocType.create({ maxLevel: 6 }))
    .scrollIntoView();

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
