import { describe, expect, it, vi } from 'vitest';
import { copySelectionToClipboard, setTextAlignment } from './commands';

describe('floating toolbar commands', () => {
  it('updates paragraph alignment for the current block selection', () => {
    const paragraphNode = {
      type: { name: 'paragraph' },
      attrs: { align: 'left' },
    };

    const tr = {
      setNodeMarkup: vi.fn(),
    };

    const view: any = {
      state: {
        selection: {
          from: 5,
          to: 9,
          $from: {
            parent: paragraphNode,
            before: vi.fn(() => 4),
          },
        },
        tr,
        doc: {
          nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
            callback(paragraphNode, 4, { type: { name: 'doc' } });
          }),
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    setTextAlignment(view, 'center');

    expect(tr.setNodeMarkup).toHaveBeenCalledWith(4, undefined, {
      align: 'center',
    });
    expect(view.dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('updates every selected paragraph and heading outside lists', () => {
    const paragraphNode = {
      type: { name: 'paragraph' },
      attrs: { align: 'left' },
    };
    const headingNode = {
      type: { name: 'heading' },
      attrs: { level: 2, align: 'left' },
    };

    const tr = {
      setNodeMarkup: vi.fn(),
    };

    const view: any = {
      state: {
        selection: {
          from: 2,
          to: 20,
          $from: {
            parent: paragraphNode,
            before: vi.fn(() => 1),
            node: vi.fn(() => ({ type: { name: 'doc' } })),
          },
        },
        tr,
        doc: {
          nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
            callback(paragraphNode, 1, { type: { name: 'doc' } });
            callback(headingNode, 10, { type: { name: 'doc' } });
          }),
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    setTextAlignment(view, 'right');

    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(1, 1, undefined, {
      align: 'right',
    });
    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(2, 10, undefined, {
      level: 2,
      align: 'right',
    });
    expect(view.dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('updates list item paragraphs', () => {
    const paragraphNode = {
      type: { name: 'paragraph' },
      attrs: { align: 'left' },
    };

    const tr = {
      setNodeMarkup: vi.fn(),
    };

    const view: any = {
      state: {
        selection: {
          from: 5,
          to: 9,
          $from: {
            parent: paragraphNode,
            before: vi.fn(() => 4),
            node: vi.fn(() => ({ type: { name: 'list_item' } })),
          },
        },
        tr,
        doc: {
          nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
            callback(paragraphNode, 4, { type: { name: 'list_item' } });
          }),
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    setTextAlignment(view, 'center');

    expect(tr.setNodeMarkup).toHaveBeenCalledWith(4, undefined, {
      align: 'center',
    });
    expect(view.dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('updates task list item paragraphs', () => {
    const paragraphNode = {
      type: { name: 'paragraph' },
      attrs: { align: 'left' },
    };

    const tr = {
      setNodeMarkup: vi.fn(),
    };

    const view: any = {
      state: {
        selection: {
          from: 5,
          to: 9,
          $from: {
            parent: paragraphNode,
            before: vi.fn(() => 4),
            node: vi.fn(() => ({ type: { name: 'list_item' } })),
          },
        },
        tr,
        doc: {
          nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
            callback(paragraphNode, 4, { type: { name: 'list_item' } });
          }),
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    setTextAlignment(view, 'right');

    expect(tr.setNodeMarkup).toHaveBeenCalledWith(4, undefined, {
      align: 'right',
    });
    expect(view.dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('does not update table cell paragraphs', () => {
    const paragraphNode = {
      type: { name: 'paragraph' },
      attrs: { align: 'left' },
    };

    const tr = {
      setNodeMarkup: vi.fn(),
    };

    const view: any = {
      state: {
        selection: {
          from: 5,
          to: 9,
          $from: {
            parent: paragraphNode,
            before: vi.fn(() => 4),
            node: vi.fn(() => ({ type: { name: 'table_cell' } })),
          },
        },
        tr,
        doc: {
          nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
            callback(paragraphNode, 4, { type: { name: 'table_cell' } });
          }),
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    setTextAlignment(view, 'center');

    expect(tr.setNodeMarkup).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
    expect(view.focus).not.toHaveBeenCalled();
  });

  it('only updates alignable blocks in mixed custom-block selections', () => {
    const paragraphNode = {
      type: { name: 'paragraph' },
      attrs: { align: 'left' },
    };
    const headingNode = {
      type: { name: 'heading' },
      attrs: { level: 3, align: 'left' },
    };
    const codeBlockNode = {
      type: { name: 'code_block' },
      attrs: {},
    };
    const imageNode = {
      type: { name: 'image' },
      attrs: { src: 'demo.png' },
    };

    const tr = {
      setNodeMarkup: vi.fn(),
    };

    const view: any = {
      state: {
        selection: {
          from: 2,
          to: 30,
          $from: {
            parent: paragraphNode,
            before: vi.fn(() => 1),
            node: vi.fn(() => ({ type: { name: 'doc' } })),
          },
        },
        tr,
        doc: {
          nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
            callback(paragraphNode, 1, { type: { name: 'doc' } });
            callback(codeBlockNode, 8, { type: { name: 'doc' } });
            callback(imageNode, 18, { type: { name: 'doc' } });
            callback(headingNode, 22, { type: { name: 'doc' } });
          }),
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    setTextAlignment(view, 'center');

    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(1, 1, undefined, {
      align: 'center',
    });
    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(2, 22, undefined, {
      level: 3,
      align: 'center',
    });
    expect(tr.setNodeMarkup).toHaveBeenCalledTimes(2);
    expect(view.dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('copies normalized selected text to clipboard', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWrite },
      configurable: true,
    });

    const view: any = {
      state: {
        selection: {
          from: 1,
          to: 8,
        },
        doc: {
          slice: vi.fn(() => ({
            content: {
              forEach: (callback: (node: any) => void) => {
                callback({
                  isText: true,
                  text: 'Hello',
                  marks: [],
                  type: { name: 'text' },
                });
              },
            },
          })),
        },
      },
      focus: vi.fn(),
    };

    const copied = await copySelectionToClipboard(view);

    expect(copied).toBe(true);
    expect(clipboardWrite).toHaveBeenCalledWith('Hello');
    expect(view.focus).toHaveBeenCalled();
  });

  it('returns false when there is no selection to copy', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWrite },
      configurable: true,
    });

    const view: any = {
      state: {
        selection: {
          from: 3,
          to: 3,
        },
      },
      focus: vi.fn(),
    };

    const copied = await copySelectionToClipboard(view);

    expect(copied).toBe(false);
    expect(clipboardWrite).not.toHaveBeenCalled();
    expect(view.focus).not.toHaveBeenCalled();
  });
});
