import { describe, expect, it } from 'vitest';
import { Schema, type Node as ProseNode } from '@milkdown/kit/prose/model';
import { EditorState, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  applyBlockMove,
  getDraggableBlockRanges,
  resolveBlockTargetByPos,
  resolveDropTarget,
} from './blockControlsInteractions';

interface MockNode {
  type: { name: string };
  nodeSize: number;
  forEach: (cb: (child: MockNode, offset: number) => void) => void;
}

function createNode(typeName: string, nodeSize: number, children: MockNode[] = []): MockNode {
  return {
    type: { name: typeName },
    nodeSize,
    forEach(cb) {
      let offset = 0;
      for (const child of children) {
        cb(child, offset);
        offset += child.nodeSize;
      }
    },
  };
}

function withRect(element: HTMLElement, rect: { top: number; left: number; width: number; height: number }) {
  const result = {
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => ({}),
  };
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => result,
  });
}

function createViewMock() {
  const dom = document.createElement('div');
  const paragraph = document.createElement('p');
  const list = document.createElement('ol');
  const itemOne = document.createElement('li');
  const itemTwo = document.createElement('li');
  paragraph.textContent = 'A';
  itemOne.textContent = 'B';
  itemTwo.textContent = 'C';
  list.append(itemOne, itemTwo);
  dom.append(paragraph, list);

  withRect(dom, { left: 20, top: 20, width: 600, height: 300 });
  withRect(paragraph, { left: 60, top: 40, width: 420, height: 24 });
  withRect(itemOne, { left: 80, top: 80, width: 380, height: 28 });
  withRect(itemTwo, { left: 80, top: 116, width: 380, height: 28 });

  const listItemOne = createNode('list_item', 8);
  const listItemTwo = createNode('list_item', 4);
  const paragraphNode = createNode('paragraph', 5);
  const listNode = createNode('ordered_list', 14, [listItemOne, listItemTwo]);
  const tailNode = createNode('paragraph', 6);
  const children = [paragraphNode, listNode, tailNode];
  const doc = {
    content: { size: 25 },
    forEach(cb: (child: MockNode, offset: number) => void) {
      let offset = 0;
      for (const child of children) {
        cb(child, offset);
        offset += child.nodeSize;
      }
    },
  };

  const view = {
    dom,
    state: { doc },
    posAtCoords() {
      return { pos: 10 };
    },
    nodeDOM(pos: number) {
      if (pos >= 14 && pos < 18) return itemTwo;
      if (pos >= 6 && pos < 14) return itemOne;
      return paragraph;
    },
    domAtPos(pos: number) {
      if (pos >= 15) return { node: itemTwo.firstChild as Node };
      if (pos >= 7) return { node: itemOne.firstChild as Node };
      return { node: paragraph.firstChild as Node };
    },
  };

  return { view: view as any, itemOne, itemTwo };
}

describe('getDraggableBlockRanges', () => {
  it('maps arbitrary ranges to selectable list-item ranges', () => {
    const { view } = createViewMock();
    const ranges = getDraggableBlockRanges(view, [
      { from: 6, to: 7 },
      { from: 12, to: 13 },
      { from: 15, to: 16 },
    ]);
    expect(ranges).toEqual([
      { from: 6, to: 14 },
      { from: 14, to: 18 },
    ]);
  });
});

describe('resolveBlockTargetByPos', () => {
  it('returns list-item handle target instead of whole list container', () => {
    const { view, itemOne } = createViewMock();
    const target = resolveBlockTargetByPos(view, 8);
    expect(target?.pos).toBe(6);
    expect(target?.rect).toEqual(itemOne.getBoundingClientRect());
  });
});

describe('resolveDropTarget', () => {
  it('uses list-item boundaries for drop insert positions', () => {
    const { view } = createViewMock();

    const beforeFirstHalf = resolveDropTarget(view, 100, 86);
    expect(beforeFirstHalf).toMatchObject({
      insertPos: 6,
      lineY: 80,
    });

    const afterFirstHalf = resolveDropTarget(view, 100, 102);
    expect(afterFirstHalf).toMatchObject({
      insertPos: 14,
      lineY: 108,
    });
  });
});

interface TopLevelRange {
  from: number;
  to: number;
  node: ProseNode;
}

function createMoveSchema() {
  return new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'text*' },
      text: { group: 'inline' },
      bullet_list: { group: 'block', content: 'list_item+' },
      ordered_list: { group: 'block', content: 'list_item+', attrs: { order: { default: 1 } } },
      list_item: { content: 'paragraph block*', attrs: { checked: { default: null } } },
    },
    marks: {},
  });
}

function createViewForMove(docJson: Record<string, unknown>) {
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
      node,
    });
  });
  return ranges;
}

function getListItemRanges(listRange: TopLevelRange): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  listRange.node.forEach((child, childOffset) => {
    if (child.type.name !== 'list_item') return;
    const from = listRange.from + 1 + childOffset;
    ranges.push({
      from,
      to: from + child.nodeSize,
    });
  });
  return ranges;
}

describe('applyBlockMove', () => {
  it('keeps ordered list semantics when moving item outside list container', () => {
    const view = createViewForMove({
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
        { type: 'paragraph', content: [{ type: 'text', text: 'tail' }] },
      ],
    });

    const before = getTopLevelRanges(view);
    const listItems = getListItemRanges(before[0]);
    const moved = applyBlockMove(view, [listItems[0]], before[1].from);
    expect(moved).toBe(true);

    expect(view.state.doc.toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'ordered_list',
          attrs: { order: 1 },
          content: [
            {
              type: 'list_item',
              attrs: { checked: null },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }],
            },
          ],
        },
        {
          type: 'ordered_list',
          attrs: { order: 1 },
          content: [
            {
              type: 'list_item',
              attrs: { checked: null },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }],
            },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'tail' }] },
      ],
    });
  });

  it('removes source list container when its only list item is moved away', () => {
    const view = createViewForMove({
      type: 'doc',
      content: [
        {
          type: 'ordered_list',
          attrs: { order: 1 },
          content: [
            {
              type: 'list_item',
              attrs: { checked: null },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }],
            },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'tail' }] },
      ],
    });

    const before = getTopLevelRanges(view);
    const listItems = getListItemRanges(before[0]);
    const moved = applyBlockMove(view, [listItems[0]], before[1].to);
    expect(moved).toBe(true);

    expect(view.state.doc.toJSON()).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'tail' }] },
        {
          type: 'ordered_list',
          attrs: { order: 1 },
          content: [
            {
              type: 'list_item',
              attrs: { checked: null },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }],
            },
          ],
        },
      ],
    });
  });

  it('preserves task-list checked attrs when moving item across containers', () => {
    const view = createViewForMove({
      type: 'doc',
      content: [
        {
          type: 'bullet_list',
          content: [
            {
              type: 'list_item',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }],
            },
            {
              type: 'list_item',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'todo' }] }],
            },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'tail' }] },
      ],
    });

    const before = getTopLevelRanges(view);
    const listItems = getListItemRanges(before[0]);
    const moved = applyBlockMove(view, [listItems[0]], before[1].from);
    expect(moved).toBe(true);

    expect(view.state.doc.toJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'bullet_list',
          content: [
            {
              type: 'list_item',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'todo' }] }],
            },
          ],
        },
        {
          type: 'bullet_list',
          content: [
            {
              type: 'list_item',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }],
            },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'tail' }] },
      ],
    });
  });
});
