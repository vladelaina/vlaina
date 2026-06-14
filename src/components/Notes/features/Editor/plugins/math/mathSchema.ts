import { $node } from '@milkdown/kit/utils';
import { type DOMOutputSpec, type Node } from '@milkdown/kit/prose/model';
import type { MathBlockAttrs, MathInlineAttrs } from './types';
import { renderLatex } from './katex';

const MAX_LEGACY_MATH_DATA_LATEX_CHARS = 10000;
const mathElementLatex = new WeakMap<HTMLElement, string>();

export function normalizeMathLatexAttr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function emptyMathMarkup() {
  return '<span class="math-empty" aria-hidden="true">\u200b</span>';
}

function renderLatexIntoElement(element: HTMLElement, latex: string, displayMode: boolean) {
  const { html } = latex.trim()
    ? renderLatex(latex, displayMode)
    : { html: emptyMathMarkup() };
  element.innerHTML = html;
}

export function setMathElementLatex(element: HTMLElement, latex: string) {
  mathElementLatex.set(element, latex);
  delete element.dataset.latex;
}

export function getMathElementLatex(element: HTMLElement) {
  const latex = mathElementLatex.get(element);
  if (latex != null) return latex;

  const legacyLatex = element.dataset.latex ?? '';
  return legacyLatex.length > MAX_LEGACY_MATH_DATA_LATEX_CHARS
    ? legacyLatex.slice(0, MAX_LEGACY_MATH_DATA_LATEX_CHARS)
    : legacyLatex;
}

export function parseMathAttrs(dom: HTMLElement) {
  return {
    latex: getMathElementLatex(dom),
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
  setMathElementLatex(wrapper, latex);
  if (dataType === 'math-block') {
    wrapper.setAttribute('lang', 'math');
    wrapper.className = `${className} math mathjax-block md-math-block md-fences-math md-math-container md-diagram-panel-preview`;
  } else {
    wrapper.className = `${className} math`;
  }
  renderLatexIntoElement(wrapper, latex, displayMode);

  return wrapper;
}

export function serializeMathBlockNode(node: Node): DOMOutputSpec {
  const attrs = node.attrs as MathBlockAttrs;
  return createMathNodeDOM({
    tagName: 'div',
    dataType: 'math-block',
    className: 'math-block-wrapper',
    latex: normalizeMathLatexAttr(attrs.latex),
    displayMode: true,
  });
}

export function serializeMathInlineNode(node: Node): DOMOutputSpec {
  const attrs = node.attrs as MathInlineAttrs;
  return createMathNodeDOM({
    tagName: 'span',
    dataType: 'math-inline',
    className: 'math-inline-wrapper',
    latex: normalizeMathLatexAttr(attrs.latex),
    displayMode: false,
  });
}

export function parseMathBlockFromMarkdown(
  state: { addNode: (type: unknown, attrs: Record<string, unknown>) => void },
  node: { value?: string },
  type: unknown
) {
  state.addNode(type, { latex: normalizeMathLatexAttr(node.value) });
}

export function parseMathInlineFromMarkdown(
  state: { addNode: (type: unknown, attrs: Record<string, unknown>) => void },
  node: { value?: string },
  type: unknown
) {
  state.addNode(type, { latex: normalizeMathLatexAttr(node.value) });
}

export function serializeMathBlockToMarkdown(
  state: { addNode: (type: string, attrs: undefined, value: string) => void },
  node: { attrs?: Record<string, unknown> }
) {
  state.addNode('math', undefined, normalizeMathLatexAttr(node.attrs?.latex));
}

export function serializeMathInlineToMarkdown(
  state: { addNode: (type: string, attrs: undefined, value: string) => void },
  node: { attrs?: Record<string, unknown> }
) {
  state.addNode('inlineMath', undefined, normalizeMathLatexAttr(node.attrs?.latex));
}

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
