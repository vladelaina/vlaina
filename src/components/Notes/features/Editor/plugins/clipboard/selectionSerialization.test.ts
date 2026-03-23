import { describe, expect, it, vi } from 'vitest';

import { getSelectionSlice, serializeSelectionToClipboardText } from './selectionSerialization';

describe('selectionSerialization', () => {
  it('prefers selection.content for structured selections', () => {
    const slice = {
      content: { size: 1 },
    };
    const docSlice = vi.fn();
    const state: any = {
      selection: {
        from: 10,
        to: 20,
        content: () => slice,
      },
      doc: {
        slice: docSlice,
      },
    };

    expect(getSelectionSlice(state)).toBe(slice);
    expect(docSlice).not.toHaveBeenCalled();
  });

  it('serializes structured selections with the markdown serializer', () => {
    const slice = {
      content: { size: 1 },
    };
    const createAndFill = vi.fn(() => ({ type: 'doc' }));
    const serializer = vi.fn(() => '| a | b |\n| --- | --- |\n| 1 | 2 |\n');
    const state: any = {
      selection: {
        from: 10,
        to: 20,
        content: () => slice,
      },
      doc: {
        slice: vi.fn(),
      },
      schema: {
        topNodeType: {
          createAndFill,
        },
      },
    };

    expect(serializeSelectionToClipboardText(state, serializer)).toBe(
      '| a | b |\n| --- | --- |\n| 1 | 2 |'
    );
    expect(createAndFill).toHaveBeenCalledWith(undefined, slice.content);
  });

  it('copies a single bullet list item without list syntax', () => {
    const slice = {
      content: {
        size: 1,
        forEach(callback: (node: unknown) => void) {
          callback({
            type: { name: 'bullet_list' },
            content: {
              forEach(listCallback: (node: unknown) => void) {
                listCallback({
                  type: { name: 'list_item' },
                  content: {
                    forEach(itemCallback: (node: unknown) => void) {
                      itemCallback({
                        type: { name: 'paragraph' },
                        isBlock: true,
                        content: {
                          size: 1,
                          forEach(textCallback: (node: unknown) => void) {
                            textCallback({
                              isText: true,
                              text: 'Only item',
                              marks: [],
                              type: { name: 'text' },
                            });
                          },
                        },
                      });
                    },
                  },
                });
              },
            },
          });
        },
      },
    };
    const serializer = vi.fn(() => '- Only item\n');
    const state: any = {
      selection: {
        from: 10,
        to: 20,
        content: () => slice,
      },
      doc: {
        slice: vi.fn(),
      },
      schema: {
        topNodeType: {
          createAndFill: vi.fn(() => ({ type: 'doc' })),
        },
      },
    };

    expect(serializeSelectionToClipboardText(state, serializer)).toBe('Only item');
    expect(serializer).not.toHaveBeenCalled();
  });

  it('keeps markdown syntax for multi-item lists', () => {
    const slice = {
      content: { size: 1 },
    };
    const serializer = vi.fn(() => '- First\n- Second\n');
    const state: any = {
      selection: {
        from: 10,
        to: 20,
        content: () => slice,
      },
      doc: {
        slice: vi.fn(),
      },
      schema: {
        topNodeType: {
          createAndFill: vi.fn(() => ({ type: 'doc' })),
        },
      },
    };

    expect(serializeSelectionToClipboardText(state, serializer)).toBe('- First\n- Second');
    expect(serializer).toHaveBeenCalled();
  });

  it('falls back to plain-text slice serialization', () => {
    const slice = {
      content: {
        size: 1,
        forEach(callback: (node: unknown) => void) {
          callback({
            isText: true,
            text: 'Hello',
            marks: [],
            type: { name: 'text' },
          });
        },
      },
    };
    const state: any = {
      selection: {
        from: 1,
        to: 6,
      },
      doc: {
        slice: vi.fn(() => slice),
      },
      schema: {
        topNodeType: {
          createAndFill: vi.fn(() => null),
        },
      },
    };

    expect(serializeSelectionToClipboardText(state)).toBe('Hello');
  });

  it('returns empty text for empty selections', () => {
    const state: any = {
      selection: {
        from: 3,
        to: 3,
      },
      doc: {
        slice: vi.fn(() => ({
          content: {
            size: 0,
          },
        })),
      },
      schema: {
        topNodeType: {
          createAndFill: vi.fn(() => null),
        },
      },
    };

    expect(serializeSelectionToClipboardText(state)).toBe('');
  });
});
