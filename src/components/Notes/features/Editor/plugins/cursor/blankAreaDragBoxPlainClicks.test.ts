import { describe, expect, it, vi } from 'vitest';
import { resolveListParagraphEndPlainClick } from './listParagraphEndPlainClick';

function createHarness(nextContent: 'paragraph' | 'list' | 'none' = 'paragraph') {
  const editor = document.createElement('div');
  const list = document.createElement('ol');
  const item = document.createElement('li');
  const paragraph = document.createElement('p');
  paragraph.textContent = 'pasted log ending index.css';
  item.appendChild(paragraph);
  if (nextContent === 'paragraph') {
    const nextParagraph = document.createElement('p');
    nextParagraph.textContent = '8:08 next pasted log line';
    item.appendChild(nextParagraph);
  } else if (nextContent === 'list') {
    item.appendChild(document.createElement('ol'));
  }
  list.appendChild(item);
  editor.appendChild(list);
  document.body.appendChild(editor);

  const parentSize = paragraph.textContent.length;
  const resolved = {
    depth: 3,
    parent: {
      isTextblock: true,
      content: { size: parentSize },
      type: { name: 'paragraph' },
    },
    parentOffset: parentSize,
    before: vi.fn(() => 2),
  };
  const view = {
    dom: editor,
    posAtCoords: vi.fn(() => ({ pos: 30 })),
    coordsAtPos: vi.fn(() => ({ left: 480, right: 480, top: 40, bottom: 60 })),
    state: { doc: { resolve: vi.fn(() => resolved) } },
  } as any;
  const event = new MouseEvent('mousedown', {
    button: 0,
    clientX: 523,
    clientY: 52,
  });
  Object.defineProperty(event, 'target', { configurable: true, value: paragraph });

  return { editor, event, view };
}

describe('resolveListParagraphEndPlainClick', () => {
  it('targets the current paragraph end before a following pasted list paragraph', () => {
    const { editor, event, view } = createHarness();

    expect(resolveListParagraphEndPlainClick(view, event)).toEqual({
      targetPos: 30,
      bias: -1,
      blockFrom: 2,
    });

    editor.remove();
  });

  it.each(['none', 'list'] as const)('targets the paragraph end when followed by %s', (nextContent) => {
    const { editor, event, view } = createHarness(nextContent);

    expect(resolveListParagraphEndPlainClick(view, event)).toEqual({
      targetPos: 30,
      bias: -1,
      blockFrom: 2,
    });

    editor.remove();
  });

  it('leaves text clicks to native selection', () => {
    const finalParagraph = createHarness('none');
    Object.defineProperty(finalParagraph.event, 'clientX', { configurable: true, value: 484 });
    expect(resolveListParagraphEndPlainClick(finalParagraph.view, finalParagraph.event)).toBeNull();
    finalParagraph.editor.remove();
  });
});
