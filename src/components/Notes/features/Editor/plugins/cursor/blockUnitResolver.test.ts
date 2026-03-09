import { describe, expect, it } from 'vitest';
import {
  collectSelectableBlockRanges,
  mapRangesToSelectableBlocks,
  resolveSelectableBlockRange,
} from './blockUnitResolver';

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

function createDoc(children: MockNode[]) {
  const size = children.reduce((total, node) => total + node.nodeSize, 0);
  return {
    content: { size },
    forEach(cb: (child: MockNode, offset: number) => void) {
      let offset = 0;
      for (const child of children) {
        cb(child, offset);
        offset += child.nodeSize;
      }
    },
  };
}

function createStructuredDoc() {
  const li1 = createNode('list_item', 8);
  const li2 = createNode('list_item', 4);
  const paragraph = createNode('paragraph', 5);
  const list = createNode('ordered_list', 14, [li1, li2]);
  const tailParagraph = createNode('paragraph', 6);
  return createDoc([paragraph, list, tailParagraph]);
}

describe('collectSelectableBlockRanges', () => {
  it('splits top-level list containers into list-item ranges', () => {
    const ranges = collectSelectableBlockRanges(createStructuredDoc() as any);
    expect(ranges).toEqual([
      { from: 0, to: 5 },
      { from: 6, to: 14 },
      { from: 14, to: 18 },
      { from: 19, to: 25 },
    ]);
  });

  it('splits parent list item header from nested list items', () => {
    const parentWithNestedChildren = createNode('list_item', 12, [
      createNode('paragraph', 4),
      createNode('ordered_list', 6, [createNode('list_item', 4)]),
    ]);
    const sibling = createNode('list_item', 4);
    const ordered = createNode('ordered_list', 18, [parentWithNestedChildren, sibling]);
    const doc = createDoc([ordered]);

    const ranges = collectSelectableBlockRanges(doc as any);
    expect(ranges).toEqual([
      { from: 1, to: 6 },
      { from: 7, to: 11 },
      { from: 13, to: 17 },
    ]);
  });
});

describe('resolveSelectableBlockRange', () => {
  it('maps document positions to the nearest selectable block range', () => {
    const doc = createStructuredDoc() as any;
    expect(resolveSelectableBlockRange(doc, 0)).toEqual({ from: 0, to: 5 });
    expect(resolveSelectableBlockRange(doc, 5)).toEqual({ from: 6, to: 14 });
    expect(resolveSelectableBlockRange(doc, 12)).toEqual({ from: 6, to: 14 });
    expect(resolveSelectableBlockRange(doc, 14)).toEqual({ from: 14, to: 18 });
    expect(resolveSelectableBlockRange(doc, 99)).toEqual({ from: 19, to: 25 });
  });
});

describe('mapRangesToSelectableBlocks', () => {
  it('normalizes arbitrary ranges into deduplicated selectable blocks', () => {
    const mapped = mapRangesToSelectableBlocks(
      createStructuredDoc() as any,
      [
        { from: 6, to: 7 },
        { from: 12, to: 13 },
        { from: 15, to: 16 },
        { from: 15, to: 17 },
      ],
    );
    expect(mapped).toEqual([
      { from: 6, to: 14 },
      { from: 14, to: 18 },
    ]);
  });
});
