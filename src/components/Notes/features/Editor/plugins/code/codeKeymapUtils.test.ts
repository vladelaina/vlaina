import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleCodeBlockEnter,
  handleEmptyCodeBlockBackspace,
  moveCursorAfterCodeBlock,
} from './codeKeymapUtils';

function createTransaction() {
  const tr = {
    doc: {
      content: { size: 30 },
      type: { schema: { nodes: { paragraph: { create: () => ({ type: 'paragraph' }) } } } },
      resolve: (pos: number) => ({ pos }),
    },
    replaceWith: vi.fn(() => tr),
    setSelection: vi.fn(() => tr),
    delete: vi.fn(() => tr),
    insert: vi.fn(() => tr),
    scrollIntoView: vi.fn(() => tr),
  };

  return tr;
}

describe('codeKeymapUtils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('converts fenced paragraphs using the shared language normalization path', () => {
    const selectionCreateSpy = vi
      .spyOn(TextSelection, 'create')
      .mockReturnValue({ type: 'selection' } as never);
    const tr = createTransaction();
    const codeBlockType = {
      create: vi.fn((attrs: unknown) => ({ attrs })),
    };
    const dispatch = vi.fn();
    const state = {
      selection: {
        empty: true,
        $from: {
          depth: 1,
          start: vi.fn(() => 5),
          end: vi.fn(() => 12),
          parent: { type: { name: 'paragraph' }, textContent: '```TS' },
        },
      },
      schema: {
        nodes: {
          code_block: codeBlockType,
        },
      },
      tr,
    };

    expect(handleCodeBlockEnter(state as never, dispatch)).toBe(true);
    expect(codeBlockType.create).toHaveBeenCalledWith({ language: 'ts' });
    expect(tr.replaceWith).toHaveBeenCalledWith(4, 13, { attrs: { language: 'ts' } });
    expect(selectionCreateSpy).toHaveBeenCalledWith(tr.doc, 5);
    expect(dispatch).toHaveBeenCalledWith(tr);
  });

  it('does not swallow Enter when there is an active text selection', () => {
    const dispatch = vi.fn();
    const state = {
      selection: {
        empty: false,
      },
    };

    expect(handleCodeBlockEnter(state as never, dispatch)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns false for fence conversion when the schema has no code block node', () => {
    const dispatch = vi.fn();
    const state = {
      selection: {
        empty: true,
        $from: {
          depth: 1,
          start: vi.fn(() => 5),
          end: vi.fn(() => 12),
          parent: { type: { name: 'paragraph' }, textContent: '```ts' },
        },
      },
      schema: {
        nodes: {},
      },
      tr: createTransaction(),
    };

    expect(handleCodeBlockEnter(state as never, dispatch)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('allows cursor escape checks without dispatching when already at code block end', () => {
    const state = {
      selection: {
        empty: true,
        $from: {
          before: vi.fn(() => 10),
          parent: {
            type: { name: 'code_block' },
            content: { size: 4 },
            nodeSize: 6,
          },
          parentOffset: 4,
        },
      },
      tr: createTransaction(),
    };

    expect(moveCursorAfterCodeBlock(state as never, undefined)).toBe(true);
  });

  it('removes empty code blocks on backspace', () => {
    const tr = createTransaction();
    const dispatch = vi.fn();
    const state = {
      selection: {
        empty: true,
        $from: {
          before: vi.fn(() => 10),
          after: vi.fn(() => 14),
          parent: { type: { name: 'code_block' }, textContent: '' },
        },
      },
      tr,
    };

    expect(handleEmptyCodeBlockBackspace(state as never, dispatch)).toBe(true);
    expect(tr.delete).toHaveBeenCalledWith(10, 14);
    expect(dispatch).toHaveBeenCalledWith(tr);
  });

  it('does not remove non-empty code blocks on backspace', () => {
    const tr = createTransaction();
    const dispatch = vi.fn();
    const state = {
      selection: {
        empty: true,
        $from: {
          before: vi.fn(() => 10),
          after: vi.fn(() => 14),
          parent: { type: { name: 'code_block' }, textContent: 'x' },
        },
      },
      tr,
    };

    expect(handleEmptyCodeBlockBackspace(state as never, dispatch)).toBe(false);
    expect(tr.delete).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('moves the cursor out of a code block when arrowing past the end', () => {
    const nearSpy = vi
      .spyOn(Selection, 'near')
      .mockReturnValue({ type: 'selection' } as never);
    const tr = createTransaction();
    const dispatch = vi.fn();
    const state = {
      selection: {
        empty: true,
        $from: {
          before: vi.fn(() => 10),
          parent: {
            type: { name: 'code_block' },
            content: { size: 4 },
            nodeSize: 6,
          },
          parentOffset: 4,
        },
      },
      tr,
    };

    expect(moveCursorAfterCodeBlock(state as never, dispatch)).toBe(true);
    expect(nearSpy).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(tr);
  });

  it('does not move the cursor when selection is not at the code block end', () => {
    const tr = createTransaction();
    const dispatch = vi.fn();
    const state = {
      selection: {
        empty: true,
        $from: {
          before: vi.fn(() => 10),
          parent: {
            type: { name: 'code_block' },
            content: { size: 4 },
            nodeSize: 6,
          },
          parentOffset: 2,
        },
      },
      tr,
    };

    expect(moveCursorAfterCodeBlock(state as never, dispatch)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
