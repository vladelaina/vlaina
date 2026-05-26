import { describe, expect, it, vi } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { AllSelection, NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import { CellSelection } from '@milkdown/kit/prose/tables';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { EditorView } from '@milkdown/kit/prose/view';

import { getSelectionSlice, serializeSelectionToClipboardText } from './selectionSerialization';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import { mermaidPlugin } from '../mermaid';
import { codePlugin } from '../code';

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

function findListItemRange(doc: any, text: string): { from: number; to: number } {
  let resolved: { from: number; to: number } | null = null;

  doc.descendants((node: any, pos: number) => {
    if (resolved) return false;
    if (node.type?.name !== 'list_item') return;
    if (node.textContent !== text) return;

    resolved = {
      from: pos,
      to: pos + node.nodeSize,
    };
    return false;
  });

  if (!resolved) {
    throw new Error(`Unable to resolve list item range for "${text}"`);
  }

  return resolved;
}

function findListItemRangeContaining(doc: any, text: string): { from: number; to: number } {
  let resolved: { from: number; to: number } | null = null;

  doc.descendants((node: any, pos: number) => {
    if (resolved) return false;
    if (node.type?.name !== 'list_item') return;
    if (!String(node.textContent ?? '').startsWith(text)) return;

    resolved = {
      from: pos,
      to: pos + node.nodeSize,
    };
    return false;
  });

  if (!resolved) {
    throw new Error(`Unable to resolve list item range containing "${text}"`);
  }

  return resolved;
}

function findListItemRangesByText(doc: any, text: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];

  doc.descendants((node: any, pos: number) => {
    if (node.type?.name !== 'list_item') return;
    if (node.textContent !== text) return;

    ranges.push({
      from: pos,
      to: pos + node.nodeSize,
    });
  });

  if (ranges.length === 0) {
    throw new Error(`Unable to resolve list item ranges for "${text}"`);
  }

  return ranges;
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

function findTextSubstringRange(doc: any, text: string): { from: number; to: number } {
  let resolved: { from: number; to: number } | null = null;

  doc.descendants((node: any, pos: number) => {
    if (resolved) return false;
    if (!node.isText || typeof node.text !== 'string') return;

    const index = node.text.indexOf(text);
    if (index < 0) return;

    resolved = {
      from: pos + index,
      to: pos + index + text.length,
    };
    return false;
  });

  if (!resolved) {
    throw new Error(`Unable to resolve text substring range for "${text}"`);
  }

  return resolved;
}

function findTextRanges(doc: any, text: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];

  doc.descendants((node: any, pos: number) => {
    if (!node.isText || node.text !== text) return;

    ranges.push({
      from: pos,
      to: pos + text.length,
    });
  });

  if (ranges.length === 0) {
    throw new Error(`Unable to resolve text ranges for "${text}"`);
  }

  return ranges;
}

function findTableCellPos(doc: any, text: string): number {
  let resolved: number | null = null;

  doc.descendants((node: any, pos: number) => {
    if (resolved !== null) return false;
    if (node.type?.name !== 'table_cell' && node.type?.name !== 'table_header') return;
    if (node.textContent !== text) return;

    resolved = pos;
    return false;
  });

  if (resolved === null) {
    throw new Error(`Unable to resolve table cell position for "${text}"`);
  }

  return resolved;
}

async function createMarkdownEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm);

  await editor.create();
  return {
    editor,
    view: editor.ctx.get(editorViewCtx),
    serializer: editor.ctx.get(serializerCtx),
  };
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

  it('does not expose internal user break markers when copying serialized selections', () => {
    const slice = {
      content: { size: 1 },
    };
    const serializer = vi.fn(() => ['Line one', '<br data-vlaina-user-br="true" />', 'Line two'].join('\n'));
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

    expect(serializeSelectionToClipboardText(state, serializer)).toBe(['Line one\\', 'Line two'].join('\n'));
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

  it('preserves blank paragraphs in fallback slice serialization', () => {
    const createParagraph = (text: string) => ({
      type: { name: 'paragraph' },
      isBlock: true,
      isTextblock: true,
      content: {
        size: text.length,
        forEach(callback: (node: unknown) => void) {
          if (text.length === 0) return;
          callback({
            isText: true,
            text,
            marks: [],
            type: { name: 'text' },
          });
        },
      },
    });
    const slice = {
      content: {
        size: 3,
        forEach(callback: (node: unknown) => void) {
          callback(createParagraph('Before'));
          callback(createParagraph(''));
          callback(createParagraph('After'));
        },
      },
    };
    const state: any = {
      selection: {
        from: 1,
        to: 20,
        content: () => slice,
      },
    };

    expect(serializeSelectionToClipboardText(state)).toBe('Before\n\nAfter');
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

  it('preserves blank lines inside editor-created code blocks when copying a full selection', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '```ts\nconst a = 1;\n\nconsole.log(a);\n\n```');
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

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe(
      '```ts\nconst a = 1;\n\nconsole.log(a);\n\n```'
    );

    await editor.destroy();
  });

  it('copies selected diagram blocks as fenced Mermaid markdown text', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, [
          '```sequence',
          'Alice->Bob: Hello Bob',
          'Bob-->Alice: Hi Alice',
          '```',
        ].join('\n'));
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(mermaidPlugin)
      .use(codePlugin);

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    expect(view.state.doc.firstChild?.type.name).toBe('mermaid');

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe([
      '```mermaid',
      'sequenceDiagram',
      'Alice->Bob: Hello Bob',
      'Bob-->Alice: Hi Alice',
      '```',
    ].join('\n'));

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

  it.each([
    {
      name: 'ordered',
      markdown: '1. only ordered',
      expected: 'only ordered',
    },
    {
      name: 'bullet',
      markdown: '- only bullet',
      expected: 'only bullet',
    },
    {
      name: 'task',
      markdown: '- [ ] only task',
      expected: 'only task',
    },
  ])('copies a single editor-created $name list item without list syntax', async ({ markdown, expected }) => {
    const { editor, view, serializer } = await createMarkdownEditor(markdown);
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe(expected);

    await editor.destroy();
  });

  it.each([
    {
      name: 'ordered',
      markdown: '1. alpha beta',
      selected: 'alpha',
    },
    {
      name: 'bullet',
      markdown: '- alpha beta',
      selected: 'alpha',
    },
    {
      name: 'task',
      markdown: '- [ ] alpha beta',
      selected: 'alpha',
    },
  ])('copies partial text inside a top-level $name list item without list syntax', async ({ markdown, selected }) => {
    const { editor, view, serializer } = await createMarkdownEditor(markdown);
    const range = findTextSubstringRange(view.state.doc, selected);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe(selected);

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
    const { editor, view, serializer } = await createMarkdownEditor('- [ ] 1\n  - [ ] nested');
    const range = findTextRange(view.state.doc, 'nested');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe('nested');

    await editor.destroy();
  });

  it.each([
    {
      name: 'ordered',
      markdown: '1. parent\n   1. nested ordered',
      selected: 'nested ordered',
    },
    {
      name: 'bullet',
      markdown: '- parent\n  - nested bullet',
      selected: 'nested bullet',
    },
    {
      name: 'task',
      markdown: '- [ ] parent\n  - [ ] nested task',
      selected: 'nested task',
    },
  ])('copies text selected inside a nested $name list item without ancestor list syntax', async ({ markdown, selected }) => {
    const { editor, view, serializer } = await createMarkdownEditor(markdown);
    const range = findTextRange(view.state.doc, selected);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe(selected);

    await editor.destroy();
  });

  it('copies ordinary selected paragraph text as visible plain text instead of escaped markdown', async () => {
    const expected = [
      '  Pro:   $76.80 / year',
      '  Max:   $191.90 / year',
      '  Ultra: $575.90 / year',
    ].join('\n');
    const slice = {
      content: {
        size: expected.length,
        forEach(callback: (node: unknown) => void) {
          expected.split('\n').forEach((line) => {
            callback({
              type: { name: 'paragraph' },
              isBlock: true,
              content: {
                size: line.length,
                forEach(textCallback: (node: unknown) => void) {
                  textCallback({
                    isText: true,
                    text: line,
                    marks: [],
                    type: { name: 'text' },
                  });
                },
              },
            });
          });
        },
      },
    };
    const selection = Object.create(TextSelection.prototype);
    Object.defineProperties(selection, {
      from: { value: 1 },
      to: { value: expected.length + 1 },
      empty: { value: false },
      content: { value: () => slice },
    });
    const serializer = vi.fn(() => [
      '&#x20; Pro:   \\$76.80 / year',
      '',
      '&#x20; Max:   \\$191.90 / year',
      '',
      '&#x20; Ultra: \\$575.90 / year',
    ].join('\n'));
    const state: any = {
      selection,
      doc: {
        slice: vi.fn(() => slice),
      },
      schema: {
        topNodeType: {
          createAndFill: vi.fn(() => ({ type: 'doc' })),
        },
      },
    };

    const copied = serializeSelectionToClipboardText(state, serializer);

    expect(copied).not.toContain('&#x20;');
    expect(copied).not.toContain('\\$');
    expect(copied).toBe(expected);
    expect(serializer).not.toHaveBeenCalled();
  });

  it('copies ordinary selected link text as visible text instead of markdown link syntax', async () => {
    const { editor, view, serializer } = await createMarkdownEditor('[Example](https://example.com) costs $5');
    const from = findTextRange(view.state.doc, 'Example').from;
    const to = findTextRange(view.state.doc, ' costs $5').to;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));

    const copied = serializeSelectionToClipboardText(view.state, serializer);

    expect(copied).toBe('Example costs $5');
    expect(copied).not.toContain('[Example]');
    expect(copied).not.toContain('(https://example.com)');
    expect(copied).not.toContain('\\$');

    await editor.destroy();
  });

  it('preserves blank paragraphs when copying a text selection across paragraph gaps', async () => {
    const { editor, view, serializer } = await createMarkdownEditor('Before\n\nAfter');
    const firstParagraphEnd = (view.state.doc.firstChild?.nodeSize ?? 2) - 1;

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, firstParagraphEnd)));
    pressEnter(view);
    const before = findTextRange(view.state.doc, 'Before');
    const after = findTextRange(view.state.doc, 'After');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, before.from, after.to)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe('Before\n\nAfter');

    await editor.destroy();
  });

  it('preserves an editor-created leading blank paragraph in a full selection', async () => {
    const { editor, view, serializer } = await createMarkdownEditor('Before');
    const before = findTextRange(view.state.doc, 'Before');

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, before.from)));
    pressEnter(view);
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe('\nBefore');

    await editor.destroy();
  });

  it('preserves an editor-created trailing blank paragraph in a full selection', async () => {
    const { editor, view, serializer } = await createMarkdownEditor('Before');
    const before = findTextRange(view.state.doc, 'Before');

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, before.to)));
    pressEnter(view);
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe('Before\n');

    await editor.destroy();
  });

  it('copies ordinary selected marked text without markdown escape artifacts', async () => {
    const { editor, view, serializer } = await createMarkdownEditor('**Bold $5** and `code \\ value` and angle < tag');
    const from = findTextRange(view.state.doc, 'Bold $5').from;
    const to = findTextRange(view.state.doc, ' and angle < tag').to;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));

    const copied = serializeSelectionToClipboardText(view.state, serializer);

    expect(copied).toBe('Bold $5 and code \\ value and angle < tag');
    expect(copied).not.toContain('**');
    expect(copied).not.toContain('`');
    expect(copied).not.toContain('\\$');
    expect(copied).not.toContain('&lt;');

    await editor.destroy();
  });

  it('copies ordinary selected heading text without heading markdown syntax', async () => {
    const { editor, view, serializer } = await createMarkdownEditor('## Revenue $5');
    const range = findTextRange(view.state.doc, 'Revenue $5');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to)));

    const copied = serializeSelectionToClipboardText(view.state, serializer);

    expect(copied).toBe('Revenue $5');
    expect(copied).not.toContain('##');
    expect(copied).not.toContain('\\$');

    await editor.destroy();
  });

  it('copies a single selected table cell as cell text instead of a one-column markdown table', async () => {
    const { editor, view, serializer } = await createMarkdownEditor([
      '| newapi | 状态 |',
      '| --- | --- |',
      '| 启动 | 正常 |',
    ].join('\n'));
    const cellPos = findTableCellPos(view.state.doc, '启动');
    const cellSelection = new CellSelection(
      view.state.doc.resolve(cellPos),
      view.state.doc.resolve(cellPos)
    );
    view.dispatch(view.state.tr.setSelection(cellSelection as never));

    const copied = serializeSelectionToClipboardText(view.state, serializer);

    expect(copied).toBe('启动');
    expect(copied).not.toContain('| newapi |');
    expect(copied).not.toContain('| - |');

    await editor.destroy();
  });

  it('copies a single-cell table slice as cell text instead of header-only table markdown', async () => {
    const { editor, view, serializer } = await createMarkdownEditor([
      '| sds |',
      '| :-- |',
    ].join('\n'));
    const table = view.state.doc.firstChild;
    if (!table || table.type.name !== 'table') {
      throw new Error('Expected a table document');
    }
    const slice = view.state.doc.slice(0, table.nodeSize);
    const state: any = {
      ...view.state,
      selection: {
        from: 0,
        to: table.nodeSize,
        content: () => slice,
      },
    };

    const copied = serializeSelectionToClipboardText(state, serializer);

    expect(copied).toBe('sds');
    expect(copied).not.toContain('| sds |');
    expect(copied).not.toContain('| :-- |');

    await editor.destroy();
  });

  it.each([
    {
      name: 'ordered',
      markdown: ['2. s', '   1. 1', '', '      1. 2', '   2. 3'].join('\n'),
      expected: ['1. 2', '2. 3'].join('\n'),
    },
    {
      name: 'bullet',
      markdown: ['- s', '  - 1', '', '    - 2', '  - 3'].join('\n'),
      expected: ['- 2', '- 3'].join('\n'),
    },
    {
      name: 'task',
      markdown: ['- [ ] s', '  - [ ] 1', '', '    - [ ] 2', '  - [ ] 3'].join('\n'),
      expected: ['- [ ] 2', '- [ ] 3'].join('\n'),
    },
  ])('does not include an unselected parent item when copying a nested $name item and the next sibling item', async ({ markdown, expected }) => {
    const { editor, view, serializer } = await createMarkdownEditor(markdown);
    const nestedTextRange = findTextRange(view.state.doc, '2');
    const siblingTextRange = findTextRange(view.state.doc, '3');
    const slice = view.state.doc.slice(nestedTextRange.from, siblingTextRange.to);
    const state: any = {
      ...view.state,
      schema: view.state.schema,
      selection: {
        $from: view.state.doc.resolve(nestedTextRange.from),
        $to: view.state.doc.resolve(siblingTextRange.to),
        from: nestedTextRange.from,
        to: siblingTextRange.to,
        content: () => slice,
      },
    };

    expect(serializeSelectionToClipboardText(state, serializer)).toBe(expected);

    await editor.destroy();
  });

  it.each([
    {
      name: 'ordered',
      markdown: ['##', '', '1. 1', '   1. 2', '2. 3', '3. s', '   1. 1', '', '      1. 2', '   2. 3'].join('\n'),
      expected: ['1. 1', '   1. 2', '2. 3'].join('\n'),
    },
    {
      name: 'bullet',
      markdown: ['##', '', '- 1', '  - 2', '- 3', '- s', '  - 1', '', '    - 2', '  - 3'].join('\n'),
      expected: ['- 1', '  - 2', '- 3'].join('\n'),
    },
    {
      name: 'task',
      markdown: ['##', '', '- [ ] 1', '  - [ ] 2', '- [ ] 3', '- [ ] s', '  - [ ] 1', '', '    - [ ] 2', '  - [ ] 3'].join('\n'),
      expected: ['- [ ] 1', '  - [ ] 2', '- [ ] 3'].join('\n'),
    },
  ])('does not keep an internal blank gap when copying a selected parent $name item with its nested item and next sibling', async ({ markdown, expected }) => {
    const { editor, view, serializer } = await createMarkdownEditor(markdown);
    const bottomOneItemRange = findListItemRangesByText(view.state.doc, '12').at(-1);
    const bottomThreeTextRange = findTextRanges(view.state.doc, '3').at(-1);
    if (!bottomOneItemRange || !bottomThreeTextRange) {
      throw new Error('Unable to resolve bottom list text ranges');
    }

    const slice = view.state.doc.slice(bottomOneItemRange.from, bottomThreeTextRange.to);
    const state: any = {
      ...view.state,
      schema: view.state.schema,
      selection: {
        $from: view.state.doc.resolve(bottomOneItemRange.from),
        $to: view.state.doc.resolve(bottomThreeTextRange.to),
        from: bottomOneItemRange.from,
        to: bottomThreeTextRange.to,
        content: () => slice,
      },
    };

    expect(serializeSelectionToClipboardText(state, serializer)).toBe(expected);

    await editor.destroy();
  });

  it('normalizes the real editor selection when copying a selected parent ordered item with its nested item and next sibling', async () => {
    const { editor, view, serializer } = await createMarkdownEditor([
      '##',
      '',
      '1. 1',
      '   1. 2',
      '2. 3',
      '3. s',
      '   1. 1',
      '',
      '      1. 2',
      '   2. 3',
    ].join('\n'));
    const bottomOneTextRange = findTextRanges(view.state.doc, '1').at(-1);
    const bottomThreeTextRange = findTextRanges(view.state.doc, '3').at(-1);
    if (!bottomOneTextRange || !bottomThreeTextRange) {
      throw new Error('Unable to resolve bottom list text ranges');
    }

    view.dispatch(view.state.tr.setSelection(
      TextSelection.create(view.state.doc, bottomOneTextRange.from, bottomThreeTextRange.to)
    ));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe([
      '1. 1',
      '   1. 2',
      '2. 3',
    ].join('\n'));

    await editor.destroy();
  });

  it.each([
    {
      name: 'ordered',
      markdown: '1. parent\n   1. nested ordered',
      selected: 'nested ordered',
    },
    {
      name: 'bullet',
      markdown: '- parent\n  - nested bullet',
      selected: 'nested bullet',
    },
    {
      name: 'task',
      markdown: '- [ ] parent\n  - [ ] nested task',
      selected: 'nested task',
    },
  ])('copies a nested $name list item from its item boundary without ancestor list syntax', async ({ markdown, selected }) => {
    const { editor, view, serializer } = await createMarkdownEditor(markdown);
    const itemRange = findListItemRange(view.state.doc, selected);
    const textRange = findTextRange(view.state.doc, selected);
    const slice = view.state.doc.slice(itemRange.from, textRange.to);
    const state: any = {
      ...view.state,
      selection: {
        from: itemRange.from,
        to: textRange.to,
        content: () => slice,
      },
    };

    expect(serializeSelectionToClipboardText(state, serializer)).toBe(selected);

    await editor.destroy();
  });

  it.each([
    {
      name: 'ordered',
      markdown: '1. first ordered\n2. second ordered',
      first: 'first ordered',
      second: 'second ordered',
      expected: '1. first ordered\n2. second ordered',
    },
    {
      name: 'bullet',
      markdown: '- first bullet\n- second bullet',
      first: 'first bullet',
      second: 'second bullet',
      expected: '- first bullet\n- second bullet',
    },
    {
      name: 'task',
      markdown: '- [ ] first task\n- [ ] second task',
      first: 'first task',
      second: 'second task',
      expected: '- [ ] first task\n- [ ] second task',
    },
  ])('keeps markdown syntax when copying two $name list items', async ({ markdown, first, second, expected }) => {
    const { editor, view, serializer } = await createMarkdownEditor(markdown);
    const firstItemRange = findListItemRange(view.state.doc, first);
    const secondTextRange = findTextRange(view.state.doc, second);
    const slice = view.state.doc.slice(firstItemRange.from, secondTextRange.to);
    const state: any = {
      ...view.state,
      schema: view.state.schema,
      selection: {
        $from: view.state.doc.resolve(firstItemRange.from),
        $to: view.state.doc.resolve(secondTextRange.to),
        from: firstItemRange.from,
        to: secondTextRange.to,
        content: () => slice,
      },
    };

    expect(serializeSelectionToClipboardText(state, serializer)).toBe(expected);

    await editor.destroy();
  });

  it.each([
    {
      name: 'ordered',
      markdown: '1. parent\n   1. nested ordered',
      first: 'parent',
      second: 'nested ordered',
      expected: '1. parent\n   1. nested ordered',
    },
    {
      name: 'bullet',
      markdown: '- parent\n  - nested bullet',
      first: 'parent',
      second: 'nested bullet',
      expected: '- parent\n  - nested bullet',
    },
    {
      name: 'task',
      markdown: '- [ ] parent\n  - [ ] nested task',
      first: 'parent',
      second: 'nested task',
      expected: '- [ ] parent\n  - [ ] nested task',
    },
  ])('keeps markdown syntax when copying parent and nested $name list items', async ({ markdown, first, second, expected }) => {
    const { editor, view, serializer } = await createMarkdownEditor(markdown);
    const parentItemRange = findListItemRangeContaining(view.state.doc, first);
    const nestedTextRange = findTextRange(view.state.doc, second);
    const slice = view.state.doc.slice(parentItemRange.from, nestedTextRange.to);
    const state: any = {
      ...view.state,
      schema: view.state.schema,
      selection: {
        $from: view.state.doc.resolve(parentItemRange.from),
        $to: view.state.doc.resolve(nestedTextRange.to),
        from: parentItemRange.from,
        to: nestedTextRange.to,
        content: () => slice,
      },
    };

    expect(serializeSelectionToClipboardText(state, serializer)).toBe(expected);

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
