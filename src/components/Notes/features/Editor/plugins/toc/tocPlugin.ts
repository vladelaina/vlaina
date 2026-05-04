import { $node, $command, $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { TocAttrs, TocItem } from './types';
import { isTocShortcutText } from './tocShortcut';

const tocViewPluginKey = new PluginKey('tocView');
const TOC_EMPTY_TEXT = 'No headings yet';

function extractHeadings(doc: any, maxLevel: number = 6): TocItem[] {
  const headings: TocItem[] = [];
  
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'heading') {
      const level = node.attrs.level as number;
      if (level <= maxLevel) {
        const text = node.textContent;
        const id = `heading-${pos}`;
        headings.push({ level, text, id, pos });
      }
    }
  });
  
  return headings;
}

function createHeadingsSignature(headings: readonly TocItem[]): string {
  return headings
    .map((heading) => `${heading.pos}:${heading.level}:${heading.text}`)
    .join('|');
}

function renderTocContent(contentEl: HTMLElement, headings: readonly TocItem[], maxLevel: number): void {
  const doc = contentEl.ownerDocument;
  const scopedHeadings = maxLevel < 6
    ? headings.filter((heading) => heading.level <= maxLevel)
    : headings;

  if (scopedHeadings.length === 0) {
    const empty = doc.createElement('div');
    empty.className = 'toc-empty';
    empty.textContent = TOC_EMPTY_TEXT;
    contentEl.replaceChildren(empty);
    return;
  }

  const nav = doc.createElement('nav');
  nav.className = 'toc-nav';
  const list = doc.createElement('ul');
  list.className = 'toc-list';
  nav.appendChild(list);

  for (const heading of scopedHeadings) {
    const item = doc.createElement('li');
    item.className = `toc-item toc-level-${heading.level}`;
    item.style.paddingLeft = `${(heading.level - 1) * 16}px`;

    const link = doc.createElement('a');
    link.className = 'toc-link';
    link.href = '#';
    link.dataset.headingPos = String(heading.pos);
    link.textContent = heading.text;

    item.appendChild(link);
    list.appendChild(item);
  }

  contentEl.replaceChildren(nav);
}

export const tocViewPlugin = $prose(() => {
  let lastDoc: object | null = null;
  let lastHeadingSignature = '';
  let lastTocCount = -1;
  
  return new Plugin({
    key: tocViewPluginKey,
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
          const { doc } = view.state;
          const tocElements = view.dom.querySelectorAll<HTMLElement>('.toc-block');
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

          tocElements.forEach((el) => {
            const maxLevel = parseInt(el.getAttribute('data-max-level') || '6', 10);
            const contentEl = el.querySelector<HTMLElement>('.toc-content');
            if (!contentEl) return;
            renderTocContent(contentEl, headings, maxLevel);
          });
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
      maxLevel: parseInt((dom as HTMLElement).dataset.maxLevel || '6', 10)
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as TocAttrs;
    return [
      'div',
      {
        'data-type': 'toc',
        'data-max-level': String(attrs.maxLevel),
        class: 'toc-block'
      },
      ['div', { class: 'toc-content' }, TOC_EMPTY_TEXT]
    ];
  },
  parseMarkdown: {
    match: (node) => {
      if (node.type === 'paragraph') {
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
