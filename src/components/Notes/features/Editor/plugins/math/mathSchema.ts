import { $node, $nodeAttr } from '@milkdown/kit/utils';
import { type DOMOutputSpec, type Node } from '@milkdown/kit/prose/model';
import type { MathBlockAttrs, MathInlineAttrs } from './types';

function emptyMathMarkup() {
  return '<span class="math-empty" aria-hidden="true">\u200b</span>';
}

function renderLatexIntoElement(element: HTMLElement, latex: string, displayMode: boolean) {
  if (!latex.trim()) {
    element.innerHTML = emptyMathMarkup();
    return;
  }

  const renderKey = `${displayMode ? 'block' : 'inline'}\u0000${latex}`;
  element.dataset.renderKey = renderKey;
  element.innerHTML = emptyMathMarkup();

  void import('./katex').then(({ renderLatex }) => {
    if (element.dataset.renderKey !== renderKey || element.dataset.latex !== latex) {
      return;
    }

    const { html } = renderLatex(latex, displayMode);
    element.innerHTML = html;
  });
}

export function parseMathAttrs(dom: HTMLElement) {
  return {
    latex: dom.dataset.latex || '',
  };
}

export function createMathNodeDOM(args: {
  tagName: 'div' | 'span';
  dataType: 'math-block' | 'math-inline';
  className: 'math-block-wrapper' | 'math-inline-wrapper';
  latex: string;
  displayMode: boolean;
}): DOMOutputSpec {
  const { tagName, dataType, className, latex, displayMode } = args;

  const wrapper = document.createElement(tagName);
  wrapper.setAttribute('data-type', dataType);
  wrapper.setAttribute('data-latex', latex);
  wrapper.className = className;
  renderLatexIntoElement(wrapper, latex, displayMode);

  return wrapper;
}

export function serializeMathBlockNode(node: Node): DOMOutputSpec {
  const attrs = node.attrs as MathBlockAttrs;
  return createMathNodeDOM({
    tagName: 'div',
    dataType: 'math-block',
    className: 'math-block-wrapper',
    latex: attrs.latex,
    displayMode: true,
  });
}

export function serializeMathInlineNode(node: Node): DOMOutputSpec {
  const attrs = node.attrs as MathInlineAttrs;
  return createMathNodeDOM({
    tagName: 'span',
    dataType: 'math-inline',
    className: 'math-inline-wrapper',
    latex: attrs.latex,
    displayMode: false,
  });
}

export function parseMathBlockFromMarkdown(
  state: { addNode: (type: unknown, attrs: Record<string, unknown>) => void },
  node: { value?: string },
  type: unknown
) {
  state.addNode(type, { latex: node.value || '' });
}

export function parseMathInlineFromMarkdown(
  state: { addNode: (type: unknown, attrs: Record<string, unknown>) => void },
  node: { value?: string },
  type: unknown
) {
  state.addNode(type, { latex: node.value || '' });
}

export function serializeMathBlockToMarkdown(
  state: { addNode: (type: string, attrs: undefined, value: string) => void },
  node: { attrs?: Record<string, unknown> }
) {
  state.addNode('math', undefined, String(node.attrs?.latex || ''));
}

export function serializeMathInlineToMarkdown(
  state: { addNode: (type: string, attrs: undefined, value: string) => void },
  node: { attrs?: Record<string, unknown> }
) {
  state.addNode('inlineMath', undefined, String(node.attrs?.latex || ''));
}

export const mathBlockIdAttr = $nodeAttr('math_block', () => ({
  latex: {
    default: '',
    get: (dom: HTMLElement) => dom.dataset.latex || '',
    set: (value: string) => ({ 'data-latex': value }),
  },
}));

export const mathInlineIdAttr = $nodeAttr('math_inline', () => ({
  latex: {
    default: '',
    get: (dom: HTMLElement) => dom.dataset.latex || '',
    set: (value: string) => ({ 'data-latex': value }),
  },
}));

export const mathBlockSchema = $node('math_block', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  marks: '',
  attrs: {
    latex: { default: '' },
  },
  parseDOM: [
    {
      tag: 'div[data-type="math-block"]',
      getAttrs: (dom) => parseMathAttrs(dom as HTMLElement),
    },
  ],
  toDOM: serializeMathBlockNode,
  parseMarkdown: {
    match: (node) => node.type === 'math',
    runner: parseMathBlockFromMarkdown,
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_block',
    runner: serializeMathBlockToMarkdown,
  },
}));

export const mathInlineSchema = $node('math_inline', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  attrs: {
    latex: { default: '' },
  },
  parseDOM: [
    {
      tag: 'span[data-type="math-inline"]',
      getAttrs: (dom) => parseMathAttrs(dom as HTMLElement),
    },
  ],
  toDOM: serializeMathInlineNode,
  parseMarkdown: {
    match: (node) => node.type === 'inlineMath',
    runner: parseMathInlineFromMarkdown,
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_inline',
    runner: serializeMathInlineToMarkdown,
  },
}));
