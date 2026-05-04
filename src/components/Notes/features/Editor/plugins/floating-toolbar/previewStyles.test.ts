import { describe, expect, it } from 'vitest';
import { applyBlockPreview, clearFormatPreview } from './previewStyles';

describe('previewStyles', () => {
  it('previews a multi-paragraph code block selection as one code block', () => {
    const first = document.createElement('p');
    first.innerHTML = '<strong>first paragraph</strong>';
    const blank = document.createElement('p');
    blank.innerHTML = '<br>';
    const second = document.createElement('p');
    second.textContent = 'second paragraph';
    document.body.append(first, blank, second);

    const codeText = 'first paragraph\n\nsecond paragraph';
    const tr = {
      setMeta: () => tr,
    };
    const entries = [
      { node: { type: { name: 'paragraph' } }, pos: 1, dom: first },
      { node: { type: { name: 'paragraph' } }, pos: 18, dom: blank },
      { node: { type: { name: 'paragraph' } }, pos: 20, dom: second },
    ];
    const view = {
      dom: { querySelector: () => null },
      state: {
        selection: {
          from: 1,
          to: 36,
          empty: false,
          $from: {
            before: () => 1,
          },
        },
        doc: {
          textBetween: () => codeText,
          nodesBetween: (_from: number, _to: number, callback: (node: unknown, pos: number) => void) => {
            entries.forEach((entry) => callback(entry.node, entry.pos));
          },
        },
        tr,
      },
      dispatch: () => undefined,
      nodeDOM: (pos: number) => entries.find((entry) => entry.pos === pos)?.dom ?? null,
    } as never;

    applyBlockPreview(view, 'codeBlock');

    expect(first.dataset.previewBlockType).toBe('codeBlock');
    expect(first.textContent).toBe(codeText);
    expect(first.style.whiteSpace).toBe('pre');
    expect(first.style.overflowX).toBe('auto');
    expect(blank.style.display).toBe('none');
    expect(second.style.display).toBe('none');

    clearFormatPreview(view);

    expect(first.innerHTML).toBe('<strong>first paragraph</strong>');
    expect(first.dataset.previewBlockType).toBeUndefined();
    expect(first.style.whiteSpace).toBe('');
    expect(blank.style.display).toBe('');
    expect(second.style.display).toBe('');
  });
});
