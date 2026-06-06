import { $node, $inputRule, $prose } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { FootnoteDefAttrs, FootnoteRefAttrs } from './types';
import { markEditorUserInput } from '../shared/userInputEvents';
import { normalizeFootnoteLabel, normalizeFootnotePreview } from './footnoteLabels';
import {
  collectFootnoteElements,
  docHasFootnoteNodes,
  isFootnoteDefinitionElement,
  isFootnoteReferenceElement,
  isFootnoteReferenceNodeName,
  MAX_SYNCED_FOOTNOTE_DEFS,
  MAX_SYNCED_FOOTNOTE_REFS,
  stepSliceContainsFootnote,
} from './footnoteScan';

type UndoableInputRule = InputRule & { undoable?: boolean };

export const footnoteInteractionPluginKey = new PluginKey('footnoteInteraction');

interface FootnoteInteractionPluginState {
  hasFootnotes: boolean;
}

function resolveFootnoteRef(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const ref = target.closest('.footnote-ref[data-id], .footnote-ref[data-label]');
  return ref instanceof HTMLElement ? ref : null;
}

function findFootnoteDefinition(editorDom: HTMLElement, id: string): HTMLElement | null {
  id = normalizeFootnoteLabel(id);
  if (!id) return null;

  return collectFootnoteElements(
    editorDom,
    (definition) => isFootnoteDefinitionElement(definition)
      && (
        normalizeFootnoteLabel(definition.dataset.id) === id
        || normalizeFootnoteLabel(definition.dataset.label) === id
      ),
    1
  )[0] ?? null;
}

function getFootnoteDefinitionPreview(definition: HTMLElement): string {
  const content = definition.querySelector('.footnote-def-content');
  const text = normalizeFootnotePreview(content?.textContent ?? definition.textContent ?? '');
  const label = normalizeFootnoteLabel(definition.dataset.id || definition.dataset.label);
  const labelPrefix = label ? `[${label}]:` : '';
  return labelPrefix && text.startsWith(labelPrefix)
    ? normalizeFootnotePreview(text.slice(labelPrefix.length))
    : text;
}

function collectFootnoteDefinitionPreviews(editorDom: HTMLElement): Map<string, string> {
  const previews = new Map<string, string>();
  const definitions = collectFootnoteElements(editorDom, isFootnoteDefinitionElement, MAX_SYNCED_FOOTNOTE_DEFS);

  for (const definition of definitions) {
    const id = normalizeFootnoteLabel(definition.dataset.id || definition.dataset.label);
    if (!id || previews.has(id)) continue;
    previews.set(id, getFootnoteDefinitionPreview(definition));
  }

  return previews;
}

export function syncFootnoteReferencePreviews(editorDom: HTMLElement): void {
  const refs = collectFootnoteElements(editorDom, isFootnoteReferenceElement, MAX_SYNCED_FOOTNOTE_REFS);
  const definitionPreviews = collectFootnoteDefinitionPreviews(editorDom);

  for (const ref of refs) {
    const id = normalizeFootnoteLabel(ref.dataset.id || ref.dataset.label);
    if (!id) continue;

    const preview = definitionPreviews.get(id) ?? '';
    ref.dataset.footnoteValue = preview || `[${id}]`;
  }
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

function transactionMayInsertFootnote(tr: unknown): boolean {
  const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
  return steps.some(stepSliceContainsFootnote);
}

export function handleFootnoteArrowNavigation(view: EditorView, event: KeyboardEvent): boolean {
  if (
    (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    || event.metaKey
    || event.ctrlKey
    || event.altKey
    || event.shiftKey
    || event.isComposing
    || !view.state.selection.empty
  ) {
    return false;
  }

  const { $from } = view.state.selection;
  const adjacentNode = event.key === 'ArrowRight' ? $from.nodeAfter : $from.nodeBefore;
  if (!adjacentNode || !isFootnoteReferenceNodeName(adjacentNode.type.name)) {
    return false;
  }

  const nextPos = event.key === 'ArrowRight'
    ? $from.pos + adjacentNode.nodeSize
    : $from.pos - adjacentNode.nodeSize;

  event.preventDefault();
  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, nextPos))
      .scrollIntoView()
  );
  return true;
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
  markEditorUserInput(view);
  view.dispatch(tr);
  return true;
}

export const footnoteInteractionPlugin = $prose(() => {
  return new Plugin<FootnoteInteractionPluginState>({
    key: footnoteInteractionPluginKey,
    state: {
      init(_config, state) {
        return { hasFootnotes: docHasFootnoteNodes(state.doc) };
      },
      apply(tr, previous) {
        if (!tr.docChanged) {
          return previous;
        }
        if (!previous.hasFootnotes && !transactionMayInsertFootnote(tr)) {
          return previous;
        }
        return { hasFootnotes: docHasFootnoteNodes(tr.doc) };
      },
    },
    view(view) {
      let lastSyncedDoc: object | null = null;
      if (footnoteInteractionPluginKey.getState(view.state)?.hasFootnotes) {
        syncFootnoteReferencePreviews(view.dom);
        lastSyncedDoc = view.state.doc;
      }
      return {
        update(nextView) {
          if (!footnoteInteractionPluginKey.getState(nextView.state)?.hasFootnotes) {
            lastSyncedDoc = null;
            return;
          }
          if (lastSyncedDoc === nextView.state.doc) {
            return;
          }
          syncFootnoteReferencePreviews(nextView.dom);
          lastSyncedDoc = nextView.state.doc;
        },
      };
    },
    props: {
      handleKeyDown(view, event) {
        if (handleFootnoteArrowNavigation(view, event)) {
          return true;
        }

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
      id: normalizeFootnoteLabel((dom as HTMLElement).dataset.id)
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as FootnoteRefAttrs;
    const id = normalizeFootnoteLabel(attrs.id);
    const label = `[${id}]`;
    return [
      'sup',
      {
        class: 'footnote-ref',
        'data-id': id,
        'data-footnote-value': label,
        'aria-label': `Footnote ${id}`,
        contenteditable: 'false'
      },
      ['span', { class: 'footnote-ref-label', contenteditable: 'false' }, label]
    ];
  },
  parseMarkdown: {
    match: (node) => node.type === 'footnoteReference',
    runner: (state, node, type) => {
      const id = normalizeFootnoteLabel((node.identifier as string) || (node.label as string));
      if (!id) return;
      state.addNode(type, { id });
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'footnote_ref',
    runner: (state, node) => {
      const id = normalizeFootnoteLabel(node.attrs.id);
      if (!id) return;
      state.addNode('text', undefined, `[^${id}]`);
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
      id: normalizeFootnoteLabel((dom as HTMLElement).dataset.id)
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as FootnoteDefAttrs;
    const id = normalizeFootnoteLabel(attrs.id);
    return [
      'div',
      {
        class: 'footnote-def',
        'data-id': id,
        id: `fn-${id}`
      },
      ['span', { class: 'footnote-def-label', contenteditable: 'false' }, `[${id}]:`],
      ['div', { class: 'footnote-def-content' }, 0]
    ];
  },
  parseMarkdown: {
    match: (node) => node.type === 'footnoteDefinition',
    runner: (state, node, type) => {
      const id = normalizeFootnoteLabel((node.identifier as string) || (node.label as string));
      if (!id) return;
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
  const rule = new InputRule(
    /\[\^([^\]]+)\]$/,
    (state, match, start, end) => {
      const id = normalizeFootnoteLabel(match[1]);
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
  (rule as UndoableInputRule).undoable = false;
  return rule;
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
  const id = normalizeFootnoteLabel(node.attrs.id);
  if (!id) return;

  state.openNode('footnoteDefinition', undefined, {
    label: id,
    identifier: id,
  });
  state.next(node.content);
  state.closeNode();
}
