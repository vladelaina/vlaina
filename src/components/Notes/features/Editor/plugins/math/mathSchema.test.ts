import { describe, expect, it, vi } from 'vitest';
import {
  getMathElementLatex,
  normalizeMathLatexAttr,
  parseMathAttrs,
  parseMathBlockFromMarkdown,
  parseMathInlineFromMarkdown,
  serializeMathBlockNode,
  serializeMathBlockToMarkdown,
  serializeMathInlineNode,
  serializeMathInlineToMarkdown,
} from './mathSchema';

describe('mathSchema', () => {
  it('parses legacy latex attrs from wrapper dataset', () => {
    const dom = document.createElement('div');
    dom.dataset.latex = '\\frac{1}{2}';

    expect(parseMathAttrs(dom)).toEqual({
      latex: '\\frac{1}{2}',
    });
  });

  it('normalizes leaked editor blank-line comments out of math attrs', () => {
    expect(normalizeMathLatexAttr([
      '<!--vlaina-markdown-blank-line-->',
      'hi',
      '<!--vlaina-markdown-blank-line-->',
    ].join('\n'))).toBe('hi');

    expect(normalizeMathLatexAttr([
      'a = b',
      '<!--vlaina-markdown-blank-line-->',
      'c = d',
    ].join('\n'))).toBe(['a = b', '', 'c = d'].join('\n'));

    expect(normalizeMathLatexAttr([
      '<!--vlaina-rendered-html-boundary-blank-line-->',
      'x',
      '<!--vlaina-markdown-tight-heading-->',
    ].join('\n'))).toBe('x');
  });

  it('bounds legacy latex attrs parsed from wrapper dataset', () => {
    const dom = document.createElement('div');
    dom.dataset.latex = 'x'.repeat(10001);

    expect(parseMathAttrs(dom)).toEqual({
      latex: 'x'.repeat(10000),
    });
  });

  it('serializes block math without leaking source latex into wrapper attrs', () => {
    const latex = 'x% hidden_secret_marker';
    const dom = serializeMathBlockNode({
      attrs: { latex },
    } as never) as HTMLElement;

    expect(dom.tagName).toBe('DIV');
    expect(dom.dataset.type).toBe('math-block');
    expect(dom.dataset.latex).toBeUndefined();
    expect(dom.classList.contains('math-block-wrapper')).toBe(true);
    expect(dom.classList.contains('math')).toBe(true);
    expect(dom.classList.contains('mathjax-block')).toBe(true);
    expect(dom.classList.contains('md-math-block')).toBe(true);
    expect(dom.classList.contains('md-fences-math')).toBe(true);
    expect(dom.classList.contains('md-math-container')).toBe(true);
    expect(dom.classList.contains('md-diagram-panel-preview')).toBe(true);
    expect(dom.getAttribute('lang')).toBe('math');
    expect(getMathElementLatex(dom)).toBe(latex);
    expect(dom.outerHTML).not.toContain('data-latex');
    expect(dom.outerHTML).not.toContain('hidden_secret_marker');
  });

  it('serializes non-string math attrs as empty without coercion', () => {
    const latex = {
      toString() {
        throw new Error('latex coercion');
      },
    };
    const blockDom = serializeMathBlockNode({
      attrs: { latex },
    } as never) as HTMLElement;
    const addNode = vi.fn();

    serializeMathInlineToMarkdown(
      { addNode },
      { attrs: { latex } } as never
    );

    expect(getMathElementLatex(blockDom)).toBe('');
    expect(addNode).toHaveBeenCalledWith('inlineMath', undefined, '');
  });

  it('serializes inline math without leaking source latex into wrapper attrs', () => {
    const latex = 'x% inline_hidden_marker';
    const dom = serializeMathInlineNode({
      attrs: { latex },
    } as never) as HTMLElement;

    expect(dom.tagName).toBe('SPAN');
    expect(dom.dataset.type).toBe('math-inline');
    expect(dom.dataset.latex).toBeUndefined();
    expect(dom.classList.contains('math-inline-wrapper')).toBe(true);
    expect(dom.classList.contains('math')).toBe(true);
    expect(getMathElementLatex(dom)).toBe(latex);
    expect(dom.outerHTML).not.toContain('data-latex');
    expect(dom.outerHTML).not.toContain('inline_hidden_marker');
  });

  it('parses block math markdown nodes into math_block attrs', () => {
    const addNode = vi.fn();

    parseMathBlockFromMarkdown(
      { addNode },
      { value: '\\int_0^1 x dx' },
      'math_block_type'
    );

    expect(addNode).toHaveBeenCalledWith('math_block_type', {
      latex: '\\int_0^1 x dx',
    });
  });

  it('parses inline math markdown nodes into math_inline attrs', () => {
    const addNode = vi.fn();

    parseMathInlineFromMarkdown(
      { addNode },
      { value: 'a+b' },
      'math_inline_type'
    );

    expect(addNode).toHaveBeenCalledWith('math_inline_type', {
      latex: 'a+b',
    });
  });

  it('serializes block math nodes back to markdown math nodes', () => {
    const addNode = vi.fn();

    serializeMathBlockToMarkdown(
      { addNode },
      { attrs: { latex: '\\sum_{i=1}^n i' } } as never
    );

    expect(addNode).toHaveBeenCalledWith('math', undefined, '\\sum_{i=1}^n i');
  });

  it('serializes inline math nodes back to markdown inlineMath nodes', () => {
    const addNode = vi.fn();

    serializeMathInlineToMarkdown(
      { addNode },
      { attrs: { latex: 'x_1' } } as never
    );

    expect(addNode).toHaveBeenCalledWith('inlineMath', undefined, 'x_1');
  });
});
