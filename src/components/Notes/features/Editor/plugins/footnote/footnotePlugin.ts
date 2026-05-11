import { $node, $inputRule, $prose } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { FootnoteDefAttrs, FootnoteRefAttrs } from './types';

export const footnoteInteractionPluginKey = new PluginKey('footnoteInteraction');

function resolveFootnoteRef(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const ref = target.closest('.footnote-ref[data-id], .footnote-ref[data-label]');
  return ref instanceof HTMLElement ? ref : null;
}

function findFootnoteDefinition(editorDom: HTMLElement, id: string): HTMLElement | null {
  const definitions = editorDom.querySelectorAll<HTMLElement>('.footnote-def[data-id], .footnote-def[data-label]');
  for (const definition of definitions) {
    if (definition.dataset.id === id || definition.dataset.label === id) {
      return definition;
    }
  }
  return null;
}

function findFootnoteDefinitionDepth(view: EditorView): number | null {
  const { selection } = view.state;
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const nodeName = $from.node(depth).type.name;
    if (nodeName === 'footnote_definition' || nodeName === 'footnote_def') {
      return depth;
    }
  }
  return null;
}

export function handleFootnoteModEnterExit(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  const paragraphType = state.schema.nodes.paragraph;
  if (!selection.empty || !paragraphType) {
    return false;
  }

  const footnoteDepth = findFootnoteDefinitionDepth(view);
  if (footnoteDepth === null) {
    return false;
  }

  const footnotePos = selection.$from.before(footnoteDepth);
  const footnoteNode = selection.$from.node(footnoteDepth);
  const insertPos = footnotePos + footnoteNode.nodeSize;
  let tr = state.tr.insert(insertPos, paragraphType.create());
  tr = tr.setSelection(TextSelection.create(tr.doc, insertPos + 1)).scrollIntoView();
  view.dispatch(tr);
  return true;
}

export const footnoteInteractionPlugin = $prose(() => {
  return new Plugin({
    key: footnoteInteractionPluginKey,
    props: {
      handleKeyDown(view, event) {
        if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey) || event.altKey || event.shiftKey || event.isComposing) {
          return false;
        }

        if (!handleFootnoteModEnterExit(view)) {
          return false;
        }

        event.preventDefault();
        return true;
      },
      handleDOMEvents: {
        click(view, event) {
          const ref = resolveFootnoteRef(event.target);
          if (!ref) return false;

          const id = ref.dataset.id || ref.dataset.label;
          if (!id) return false;

          const definition = findFootnoteDefinition(view.dom, id);
          if (!definition) return false;

          event.preventDefault();
          event.stopPropagation();
          definition.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return true;
        },
      },
    },
  });
});

export const footnoteRefSchema = $node('footnote_ref', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  attrs: {
    id: { default: '' }
  },
  parseDOM: [{
    tag: 'sup.footnote-ref',
    getAttrs: (dom) => ({
      id: (dom as HTMLElement).dataset.id || ''
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as FootnoteRefAttrs;
    const label = `[${attrs.id}]`;
    return [
      'sup',
      {
        class: 'footnote-ref',
        'data-id': attrs.id,
        'data-footnote-value': label,
        'aria-label': `Footnote ${attrs.id}`
      },
      ['span', { class: 'footnote-ref-label' }, label]
    ];
  },
  parseMarkdown: {
    match: (node) => node.type === 'footnoteReference',
    runner: (state, node, type) => {
      const id = (node.identifier as string) || (node.label as string) || '';
      state.addNode(type, { id });
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'footnote_ref',
    runner: (state, node) => {
      state.addNode('text', undefined, `[^${node.attrs.id}]`);
    }
  }
}));

export const footnoteDefSchema = $node('footnote_def', () => ({
  content: 'block+',
  group: 'block',
  defining: true,
  attrs: {
    id: { default: '' }
  },
  parseDOM: [{
    tag: 'div.footnote-def',
    getAttrs: (dom) => ({
      id: (dom as HTMLElement).dataset.id || ''
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as FootnoteDefAttrs;
    return [
      'div',
      {
        class: 'footnote-def',
        'data-id': attrs.id,
        id: `fn-${attrs.id}`
      },
      ['span', { class: 'footnote-def-label', contenteditable: 'false' }, `[${attrs.id}]:`],
      ['div', { class: 'footnote-def-content' }, 0]
    ];
  },
  parseMarkdown: {
    match: (node) => node.type === 'footnoteDefinition',
    runner: (state, node, type) => {
      const id = (node.identifier as string) || (node.label as string) || '';
      state.openNode(type, { id });
      state.next(node.children);
      state.closeNode();
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'footnote_def',
    runner: (state, node) => serializeFootnoteDefinitionToMarkdown(state, node)
  }
}));

export const footnoteRefInputRule = $inputRule(() => {
  return new InputRule(
    /\[\^([^\]]+)\]$/,
    (state, match, start, end) => {
      const id = match[1];
      if (!id) return null;

      const $pos = state.doc.resolve(start);
      const lineStart = $pos.start();
      const textBefore = state.doc.textBetween(lineStart, start);

      if (textBefore.trim() === '') return null;

      const { tr, schema } = state;
      const nodeType = schema.nodes.footnote_reference ?? schema.nodes.footnote_ref;
      if (!nodeType) return null;
      const attrs = nodeType.name === 'footnote_reference' ? { label: id } : { id };

      return tr
        .delete(start, end)
        .replaceSelectionWith(nodeType.create(attrs));
    }
  );
});

export const footnotePlugin = [
  footnoteRefSchema,
  footnoteDefSchema,
  footnoteRefInputRule,
  footnoteInteractionPlugin
];

export function serializeFootnoteDefinitionToMarkdown(
  state: {
    openNode: (...args: any[]) => any;
    next: (...args: any[]) => any;
    closeNode: (...args: any[]) => any;
  },
  node: {
    attrs: { id?: string };
    content: unknown;
  }
): void {
  state.openNode('footnoteDefinition', undefined, {
    label: node.attrs.id ?? '',
    identifier: node.attrs.id ?? '',
  });
  state.next(node.content);
  state.closeNode();
}
