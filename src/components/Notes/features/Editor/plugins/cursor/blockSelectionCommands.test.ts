import { describe, expect, it, vi } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Serializer } from '@milkdown/kit/transformer';
import { deleteSelectedBlocks, serializeSelectedBlocksToText } from './blockSelectionCommands';

function createMockState(): EditorState {
  const doc = {
    cut(from: number, to: number) {
      return { range: `${from}-${to}` };
    },
    slice(from: number, to: number) {
      const text = `plain-${from}-${to}`;
      return {
        content: {
          forEach(callback: (node: { isText: boolean; text: string }) => void) {
            callback({ isText: true, text });
          },
        },
      };
    },
  };

  return { doc } as unknown as EditorState;
}

interface TopLevelRange {
  from: number;
  to: number;
}

function createMoveSchema() {
  return new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'text*' },
      text: { group: 'inline' },
      bullet_list: { group: 'block', content: 'list_item+' },
      ordered_list: { group: 'block', content: 'list_item+', attrs: { order: { default: 1 } } },
      list_item: { content: 'paragraph block*' },
    },
    marks: {},
  });
}

function createViewForDelete(docJson: Record<string, unknown>) {
  const schema = createMoveSchema();
  const initialState = EditorState.create({
    schema,
    doc: schema.nodeFromJSON(docJson),
  });

  const view = {
    state: initialState,
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr);
    },
    focus() {},
  };

  return view as unknown as EditorView & { state: EditorState };
}

function getTopLevelRanges(view: EditorView): TopLevelRange[] {
  const ranges: TopLevelRange[] = [];
  view.state.doc.forEach((node, offset) => {
    ranges.push({
      from: offset,
      to: offset + node.nodeSize,
    });
  });
  return ranges;
}

function getListItemRanges(view: EditorView, listRange: TopLevelRange): Array<{ from: number; to: number }> {
  const listNode = view.state.doc.nodeAt(listRange.from);
  if (!listNode) return [];
  const ranges: Array<{ from: number; to: number }> = [];
  listNode.forEach((child, childOffset) => {
    if (child.type.name !== 'list_item') return;
    const from = listRange.from + 1 + childOffset;
    ranges.push({
      from,
      to: from + child.nodeSize,
    });
  });
  return ranges;
}

describe('serializeSelectedBlocksToText', () => {
  it('prefers markdown serializer and keeps markdown syntax text', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn((doc: any) => `## ${doc.range}`);

    const result = serializeSelectedBlocksToText(
      state,
      [
        { from: 5, to: 8 },
        { from: 1, to: 4 },
      ],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('## 1-4\n## 5-8');
    expect(markdownSerializer.mock.calls.map(([doc]) => (doc as { range: string }).range)).toEqual([
      '1-4',
      '5-8',
    ]);
  });

  it('falls back to plain text when markdown serializer throws', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn(() => {
      throw new Error('serializer unavailable');
    });

    const result = serializeSelectedBlocksToText(
      state,
      [{ from: 2, to: 6 }],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('plain-2-6');
  });

  it('normalizes empty markdown block serialized as <br /> to empty text', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn(() => '<br />');

    const result = serializeSelectedBlocksToText(
      state,
      [{ from: 3, to: 4 }],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('\n');
  });

  it('keeps empty block gaps when copying multiple markdown blocks', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn((doc: any) => {
      if (doc.range === '1-2') return '# Title';
      if (doc.range === '3-4') return '<br />';
      return '- item';
    });

    const result = serializeSelectedBlocksToText(
      state,
      [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
        { from: 5, to: 6 },
      ],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('# Title\n\n- item');
  });
});

describe('deleteSelectedBlocks', () => {
  it('removes whole list container when deleting the only list item block', () => {
    const view = createViewForDelete({
      type: 'doc',
      content: [
        {
          type: 'bullet_list',
          content: [
            {
              type: 'list_item',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'todo' }] }],
            },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'tail' }] },
      ],
    });

    const [listRange] = getTopLevelRanges(view);
    const [itemRange] = getListItemRanges(view, listRange);
    const deleted = deleteSelectedBlocks(view, [itemRange], (tr) => tr);
    expect(deleted).toBe(true);

    expect(view.state.doc.toJSON()).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'tail' }] }],
    });
  });

  it('keeps ordered list semantics when deleting one item from multi-item ordered list', () => {
    const view = createViewForDelete({
      type: 'doc',
      content: [
        {
          type: 'ordered_list',
          attrs: { order: 1 },
          content: [
            {
              type: 'list_item',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }],
            },
            {
              type: 'list_item',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }],
            },
          ],
        },
      ],
    });

    const [listRange] = getTopLevelRanges(view);
    const [itemRange] = getListItemRanges(view, listRange);
    const deleted = deleteSelectedBlocks(view, [itemRange], (tr) => tr);
    expect(deleted).toBe(true);

    expect(view.state.doc.toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'ordered_list',
          attrs: { order: 1 },
          content: [
            {
              type: 'list_item',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }],
            },
          ],
        },
      ],
    });
  });
});
