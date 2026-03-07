import { describe, expect, it } from 'vitest';
import {
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
