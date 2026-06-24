import { describe, expect, it, vi } from 'vitest';
import {
  handleListGapPlaceholderPointerDown,
  isListGapPlaceholderParagraph,
  MAX_LIST_GAP_PLACEHOLDER_TEXT_CHARS,
  MAX_LIST_GAP_TEXT_HIT_CHARS,
  resolvePointInsideActualText,
  resolvePointOnActualTextLine,
  shouldResolveNearbyListGapPlaceholder,
} from './listGapPlaceholder';

describe('listGapPlaceholder', () => {
  function mockTextRect(rect: DOMRect) {
    return vi.spyOn(document, 'createRange').mockImplementation(() => ({
      selectNodeContents: vi.fn(),
      getClientRects: vi.fn(() => [rect]),
      detach: vi.fn(),
    }) as unknown as Range);
  }

  function createMouseDown(target: HTMLElement, clientX: number, clientY: number): MouseEvent {
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX,
      clientY,
    });
    Object.defineProperty(event, 'target', {
      configurable: true,
      value: target,
    });
    return event;
  }

  function createView(dom: HTMLElement) {
    return { dom } as any;
  }

  const textRect = {
    left: 72,
    top: 22,
    right: 112,
    bottom: 42,
    width: 40,
    height: 20,
    x: 72,
    y: 22,
    toJSON: () => undefined,
  } as DOMRect;

  it('skips text hit measurement for oversized blocks without reading aggregate text', () => {
    const root = document.createElement('p');
    root.append(document.createTextNode('a'.repeat(MAX_LIST_GAP_TEXT_HIT_CHARS + 1)));
    const createRangeSpy = vi.spyOn(document, 'createRange');
    Object.defineProperty(root, 'textContent', {
      configurable: true,
      get() {
        throw new Error('aggregate textContent should not be read');
      },
    });

    expect(resolvePointInsideActualText(root, 0, 0)).toBeNull();
    expect(createRangeSpy).not.toHaveBeenCalled();

    createRangeSpy.mockRestore();
  });

  it('detects clicks that are on a text line but past the text end', () => {
    const root = document.createElement('p');
    root.append(document.createTextNode('1'));
    const createRangeSpy = mockTextRect(textRect);

    expect(resolvePointInsideActualText(root, 220, 32)).toBe(false);
    expect(resolvePointOnActualTextLine(root, 32)).toBe(true);

    createRangeSpy.mockRestore();
  });

  it('does not resolve a nearby list gap when clicking the previous item line end', () => {
    const editor = document.createElement('div');
    const listItem = document.createElement('li');
    const paragraph = document.createElement('p');
    paragraph.append(document.createTextNode('1'));
    listItem.append(paragraph);
    editor.append(listItem);
    const createRangeSpy = mockTextRect(textRect);

    expect(shouldResolveNearbyListGapPlaceholder(createView(editor), createMouseDown(paragraph, 220, 32))).toBe(false);
    expect(shouldResolveNearbyListGapPlaceholder(createView(editor), createMouseDown(paragraph, 220, 80))).toBe(true);

    createRangeSpy.mockRestore();
  });

  it('does not accept a direct list gap coordinate mapping from a real text line click', () => {
    const editor = document.createElement('div');
    const listItem = document.createElement('li');
    const paragraph = document.createElement('p');
    paragraph.append(document.createTextNode('1'));
    listItem.append(paragraph);
    editor.append(listItem);
    const createRangeSpy = mockTextRect(textRect);
    const posAtCoords = vi.fn(() => ({ pos: 100, inside: 99 }));
    const view = {
      dom: editor,
      posAtCoords,
    } as any;

    expect(handleListGapPlaceholderPointerDown(view, createMouseDown(paragraph, 220, 32))).toBe(false);
    expect(posAtCoords).not.toHaveBeenCalled();

    createRangeSpy.mockRestore();
  });

  it('still allows direct placeholder gap clicks to resolve', () => {
    const editor = document.createElement('div');
    const listItem = document.createElement('li');
    listItem.className = 'editor-list-gap-placeholder-item';
    const paragraph = document.createElement('p');
    paragraph.append(document.createTextNode('\u2800'));
    listItem.append(paragraph);
    editor.append(listItem);
    const createRangeSpy = mockTextRect(textRect);

    expect(shouldResolveNearbyListGapPlaceholder(createView(editor), createMouseDown(paragraph, 220, 32))).toBe(true);

    createRangeSpy.mockRestore();
  });

  it('checks placeholder paragraphs without reading aggregate ProseMirror text', () => {
    const node = {
      type: { name: 'paragraph' },
      content: { size: 1 },
      textBetween: vi.fn(() => '\u2800'),
      get textContent() {
        throw new Error('aggregate textContent should not be read');
      },
    };

    expect(isListGapPlaceholderParagraph(node)).toBe(true);
    expect(node.textBetween).toHaveBeenCalledWith(0, 1, '', '');
  });

  it('skips oversized placeholder paragraph candidates', () => {
    const node = {
      type: { name: 'paragraph' },
      content: { size: MAX_LIST_GAP_PLACEHOLDER_TEXT_CHARS + 1 },
      textBetween: vi.fn(() => '\u2800'),
    };

    expect(isListGapPlaceholderParagraph(node)).toBe(false);
    expect(node.textBetween).not.toHaveBeenCalled();
  });
});
