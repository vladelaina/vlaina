import { describe, expect, it, vi } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { AllSelection, TextSelection } from '@milkdown/kit/prose/state';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { EditorView } from '@milkdown/kit/prose/view';

import { getSelectionSlice, serializeSelectionToClipboardText } from './selectionSerialization';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';

function pressEnter(view: EditorView): void {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  });

  let handled = false;
  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    handled = handleKeyDown(view, event) || handled;
  });

  expect(handled).toBe(true);
}

function findTaskItemRange(doc: any, text: string): { from: number; to: number } {
  let resolved: { from: number; to: number } | null = null;

  doc.descendants((node: any, pos: number) => {
    if (resolved) return false;
    if (node.type?.name !== 'list_item' || node.attrs?.checked == null) return;
    if (node.textContent !== text) return;

    resolved = {
      from: pos,
      to: pos + node.nodeSize,
    };
    return false;
  });

  if (!resolved) {
    throw new Error(`Unable to resolve task item range for "${text}"`);
  }

  return resolved;
}

function findTextRange(doc: any, text: string): { from: number; to: number } {
  let resolved: { from: number; to: number } | null = null;

  doc.descendants((node: any, pos: number) => {
    if (resolved) return false;
    if (!node.isText || node.text !== text) return;

    resolved = {
      from: pos,
      to: pos + text.length,
    };
    return false;
  });

  if (!resolved) {
    throw new Error(`Unable to resolve text range for "${text}"`);
  }

  return resolved;
}

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

  it('strips placeholder br tags from nested copied task lists', () => {
    const slice = {
      content: { size: 1 },
    };
    const serializer = vi.fn(() => '- [ ] todo\n  - [ ] 1\n    - [ ] <br />\n');
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

    expect(serializeSelectionToClipboardText(state, serializer)).toBe(
      '- [ ] todo\n  - [ ] 1\n    - [ ]'
    );
  });

  it('serializes leading frontmatter back to markdown fences', () => {
    const slice = {
      content: { size: 1 },
    };
    const serializer = vi.fn(
      () => '```yaml-frontmatter\ntitle: demo\nsummary: test\n```\n\nBody\n'
    );
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

    expect(serializeSelectionToClipboardText(state, serializer)).toBe(
      '---\ntitle: demo\nsummary: test\n---\n\nBody'
    );
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

  it('keeps a single blank line gap when copying a full document selection', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '1\n\n2');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe('1\n\n2');

    await editor.destroy();
  });

  it('copies a single task item without task markdown syntax', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '- [ ] todo');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe('todo');

    await editor.destroy();
  });

  it('copies a single nested task item without markdown syntax', () => {
    const slice = {
      content: {
        size: 1,
        forEach(callback: (node: unknown) => void) {
          callback({
            type: { name: 'list_item' },
            attrs: { checked: false },
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
                        text: '2',
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
    };
    const serializer = vi.fn(() => '- - [ ] 2\n');
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

    expect(serializeSelectionToClipboardText(state, serializer)).toBe('2');
    expect(serializer).not.toHaveBeenCalled();
  });

  it('copies an editor-created nested task item slice without markdown syntax', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '- [ ] 1\n  - [ ] 2');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const range = findTaskItemRange(view.state.doc, '2');
    const slice = view.state.doc.slice(range.from, range.to);
    const state: any = {
      ...view.state,
      selection: {
        from: range.from,
        to: range.to,
        content: () => slice,
      },
    };

    expect(serializeSelectionToClipboardText(state, serializer)).toBe('2');

    await editor.destroy();
  });

  it('copies text selected inside a nested task item without markdown syntax', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '- [ ] 1\n  - [ ] nested');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const range = findTextRange(view.state.doc, 'nested');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe('nested');

    await editor.destroy();
  });

  it('keeps a single blank line gap when copying an editor-created empty paragraph', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '1\n\n2');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const firstParagraphEnd = (view.state.doc.firstChild?.nodeSize ?? 2) - 1;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, firstParagraphEnd)));
    pressEnter(view);
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe('1\n\n2');

    await editor.destroy();
  });

  it('preserves two editor-created blank lines between paragraphs', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '1\n\n2');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    const firstParagraphEnd = (view.state.doc.firstChild?.nodeSize ?? 2) - 1;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, firstParagraphEnd)));
    pressEnter(view);
    pressEnter(view);
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe('1\n\n\n2');

    await editor.destroy();
  });
});
