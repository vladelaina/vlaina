// Math plugin for LaTeX support
import { $node, $inputRule, $remark, $nodeAttr } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { renderLatex } from '../../utils/katex';
import type { MathBlockAttrs, MathInlineAttrs } from './types';
import remarkMath from 'remark-math';

// Math block node schema
export const mathBlockIdAttr = $nodeAttr('math_block', () => ({
  latex: {
    default: '',
    get: (dom: HTMLElement) => dom.dataset.latex || '',
    set: (value: string) => ({ 'data-latex': value })
  }
}));

export const mathBlockSchema = $node('math_block', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  marks: '',
  attrs: {
    latex: { default: '' }
  },
  parseDOM: [{
    tag: 'div[data-type="math-block"]',
    getAttrs: (dom) => ({
      latex: (dom as HTMLElement).dataset.latex || ''
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as MathBlockAttrs;
    const { html } = renderLatex(attrs.latex, true);
    
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-type', 'math-block');
    wrapper.setAttribute('data-latex', attrs.latex);
    wrapper.className = 'math-block-wrapper';
    wrapper.innerHTML = html;
    
    return wrapper;
  },
  parseMarkdown: {
    match: (node) => node.type === 'math',
    runner: (state, node, type) => {
      const value = node.value as string || '';
      state.addNode(type, { latex: value });
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_block',
    runner: (state, node) => {
      state.addNode('math', undefined, node.attrs.latex);
    }
  }
}));

// Math inline node schema
export const mathInlineIdAttr = $nodeAttr('math_inline', () => ({
  latex: {
    default: '',
    get: (dom: HTMLElement) => dom.dataset.latex || '',
    set: (value: string) => ({ 'data-latex': value })
  }
}));

export const mathInlineSchema = $node('math_inline', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  attrs: {
    latex: { default: '' }
  },
  parseDOM: [{
    tag: 'span[data-type="math-inline"]',
    getAttrs: (dom) => ({
      latex: (dom as HTMLElement).dataset.latex || ''
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as MathInlineAttrs;
    const { html } = renderLatex(attrs.latex, false);
    
    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-type', 'math-inline');
    wrapper.setAttribute('data-latex', attrs.latex);
    wrapper.className = 'math-inline-wrapper';
    wrapper.innerHTML = html;
    
    return wrapper;
  },
  parseMarkdown: {
    match: (node) => node.type === 'inlineMath',
    runner: (state, node, type) => {
      const value = node.value as string || '';
      state.addNode(type, { latex: value });
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_inline',
    runner: (state, node) => {
      state.addNode('inlineMath', undefined, node.attrs.latex);
    }
  }
}));

// Input rule for block math: $$...$$ followed by space or newline
export const mathBlockInputRule = $inputRule(() => {
  return new InputRule(
    /^\$\$([^$]+)\$\$\s$/,
    (state, match, start, end) => {
      const latex = match[1] || '';
      const { tr, schema } = state;
      const mathBlockType = schema.nodes.math_block;
      
      if (!mathBlockType) return null;
      
      return tr
        .delete(start, end)
        .replaceSelectionWith(mathBlockType.create({ latex }));
    }
  );
});

// Input rule for inline math: $...$ (not preceded by $, not followed by $)
export const mathInlineInputRule = $inputRule(() => {
  return new InputRule(
    /(?<!\$)\$([^$\s][^$]*[^$\s]|[^$\s])\$$/,
    (state, match, start, end) => {
      const latex = match[1] || '';
      const { tr, schema } = state;
      const mathInlineType = schema.nodes.math_inline;
      
      if (!mathInlineType) return null;
      
      return tr
        .delete(start, end)
        .replaceSelectionWith(mathInlineType.create({ latex }));
    }
  );
});

// Remark plugin for math parsing
export const remarkMathPlugin = $remark('remarkMath', () => remarkMath);

// Combined math plugin - flatten the array for proper plugin registration
export const mathPlugin = [
  remarkMathPlugin,
  mathBlockIdAttr,
  mathBlockSchema,
  mathInlineIdAttr,
  mathInlineSchema,
  mathBlockInputRule,
  mathInlineInputRule
].flat();
