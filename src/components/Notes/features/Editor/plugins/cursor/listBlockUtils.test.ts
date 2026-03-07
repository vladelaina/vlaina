import { describe, expect, it } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState } from '@milkdown/kit/prose/state';
import { buildDeleteRangesForBlockSelection } from './listBlockUtils';

interface TopLevelRange {
  from: number;
  to: number;
}

function createSchema() {
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

function createState(docJson: Record<string, unknown>): EditorState {
  const schema = createSchema();
  return EditorState.create({
    schema,
    doc: schema.nodeFromJSON(docJson),
  });
}

function getTopLevelRanges(state: EditorState): TopLevelRange[] {
  const ranges: TopLevelRange[] = [];
  state.doc.forEach((node, offset) => {
    ranges.push({
      from: offset,
      to: offset + node.nodeSize,
    });
  });
  return ranges;
}

function getListItemRanges(state: EditorState, listRange: TopLevelRange): Array<{ from: number; to: number }> {
  const listNode = state.doc.nodeAt(listRange.from);
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

describe('buildDeleteRangesForBlockSelection', () => {
  it('upgrades single selected list_item to full list-container range', () => {
    const state = createState({
      type: 'doc',
      content: [
        {
          type: 'bullet_list',
          content: [
            {
              type: 'list_item',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }],
            },
          ],
        },
      ],
    });

    const [listRange] = getTopLevelRanges(state);
    const [itemRange] = getListItemRanges(state, listRange);
    const deleteRanges = buildDeleteRangesForBlockSelection(state, [itemRange]);
    expect(deleteRanges).toEqual([listRange]);
  });

  it('keeps partial multi-item list selection at list_item granularity', () => {
    const state = createState({
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

    const [listRange] = getTopLevelRanges(state);
    const [firstItemRange] = getListItemRanges(state, listRange);
    const deleteRanges = buildDeleteRangesForBlockSelection(state, [firstItemRange]);
    expect(deleteRanges).toEqual([firstItemRange]);
  });

  it('normalizes mixed ranges with list containers and non-list blocks', () => {
    const state = createState({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'head' }] },
        {
          type: 'bullet_list',
          content: [
            {
              type: 'list_item',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }],
            },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'tail' }] },
      ],
    });

    const [firstParagraphRange, listRange] = getTopLevelRanges(state);
    const [itemRange] = getListItemRanges(state, listRange);
    const deleteRanges = buildDeleteRangesForBlockSelection(state, [itemRange, firstParagraphRange]);
    expect(deleteRanges).toEqual([firstParagraphRange, listRange]);
  });
});
