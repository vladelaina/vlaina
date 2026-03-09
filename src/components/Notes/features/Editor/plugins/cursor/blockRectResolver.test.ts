import { describe, expect, it } from 'vitest';
import { collectSelectableBlockRanges } from './blockRectResolver';

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
  return {
    forEach(cb: (child: MockNode, offset: number) => void) {
      let offset = 0;
      for (const child of children) {
        cb(child, offset);
        offset += child.nodeSize;
      }
    },
  };
}

describe('collectSelectableBlockRanges', () => {
  it('splits top-level list into per-item block ranges', () => {
    const li1 = createNode('list_item', 8);
    const li2 = createNode('list_item', 4);
    const topParagraph = createNode('paragraph', 5);
    const list = createNode('bullet_list', 14, [li1, li2]);
    const tailParagraph = createNode('paragraph', 6);
    const doc = createDoc([topParagraph, list, tailParagraph]);

    const ranges = collectSelectableBlockRanges(doc as any);

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
