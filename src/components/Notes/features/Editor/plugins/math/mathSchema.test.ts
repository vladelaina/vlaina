import { describe, expect, it, vi } from 'vitest';
import {
  parseMathAttrs,
  parseMathBlockFromMarkdown,
  parseMathInlineFromMarkdown,
  serializeMathBlockNode,
  serializeMathBlockToMarkdown,
  serializeMathInlineNode,
  serializeMathInlineToMarkdown,
} from './mathSchema';

describe('mathSchema', () => {
  it('parses latex attrs from wrapper dataset', () => {
    const dom = document.createElement('div');
    dom.dataset.latex = '\\frac{1}{2}';

    expect(parseMathAttrs(dom)).toEqual({
      latex: '\\frac{1}{2}',
    });
  });

  it('serializes block math with wrapper attrs', () => {
    const dom = serializeMathBlockNode({
      attrs: { latex: 'x^2' },
    } as never) as HTMLElement;

    expect(dom.tagName).toBe('DIV');
    expect(dom.dataset.type).toBe('math-block');
    expect(dom.dataset.latex).toBe('x^2');
    expect(dom.className).toBe('math-block-wrapper');
  });

  it('serializes inline math with wrapper attrs', () => {
    const dom = serializeMathInlineNode({
      attrs: { latex: 'x+y' },
    } as never) as HTMLElement;

    expect(dom.tagName).toBe('SPAN');
    expect(dom.dataset.type).toBe('math-inline');
    expect(dom.dataset.latex).toBe('x+y');
    expect(dom.className).toBe('math-inline-wrapper');
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
