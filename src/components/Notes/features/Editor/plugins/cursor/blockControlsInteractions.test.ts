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

function createNestedListViewMock() {
  const dom = document.createElement('div');
  const paragraph = document.createElement('p');
  const list = document.createElement('ol');
  const itemOne = document.createElement('li');
  const itemOneText = document.createElement('p');
  const nested = document.createElement('ol');
  const nestedItem = document.createElement('li');
  const nestedText = document.createElement('p');
  const itemTwo = document.createElement('li');
  paragraph.textContent = 'A';
  itemOneText.textContent = 'Parent';
  nestedText.textContent = 'Child';
  itemTwo.textContent = 'Sibling';
  nestedItem.append(nestedText);
  nested.append(nestedItem);
  itemOne.append(itemOneText, nested);
  list.append(itemOne, itemTwo);
  dom.append(paragraph, list);

  withRect(dom, { left: 20, top: 20, width: 600, height: 300 });
  withRect(paragraph, { left: 60, top: 40, width: 420, height: 24 });
  withRect(itemOne, { left: 80, top: 80, width: 420, height: 28 });
  withRect(itemOneText, { left: 92, top: 82, width: 360, height: 20 });
  withRect(nested, { left: 116, top: 108, width: 360, height: 24 });
  withRect(itemTwo, { left: 80, top: 144, width: 420, height: 28 });

  const nestedListItem = createNode('list_item', 5);
  const nestedList = createNode('ordered_list', 7, [nestedListItem]);
  const listItemOne = createNode('list_item', 14, [createNode('paragraph', 5), nestedList]);
  const listItemTwo = createNode('list_item', 4);
  const paragraphNode = createNode('paragraph', 5);
  const listNode = createNode('ordered_list', 20, [listItemOne, listItemTwo]);
  const tailNode = createNode('paragraph', 6);
  const children = [paragraphNode, listNode, tailNode];
  const doc = {
    content: { size: 31 },
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
    posAtDOM(node: Node, offset: number) {
      if (node === nested && offset === nested.childNodes.length) return 18;
      if (node === itemOne && offset === itemOne.childNodes.length) return 19;
      return 12;
    },
    nodeDOM(pos: number) {
      if (pos >= 20 && pos < 24) return itemTwo;
      if (pos >= 13 && pos < 19) return nestedItem;
      if (pos >= 6 && pos < 20) return itemOne;
      return paragraph;
    },
    domAtPos(pos: number) {
      if (pos >= 13 && pos < 19) return { node: nestedText.firstChild as Node };
      if (pos >= 7 && pos < 20) return { node: itemOneText.firstChild as Node };
      if (pos >= 20 && pos < 24) return { node: itemTwo.firstChild as Node };
      return { node: paragraph.firstChild as Node };
    },
  };

  return { view: view as any };
}

function createFrontmatterViewMock() {
  const dom = document.createElement('div');
  const frontmatter = document.createElement('div');
  const paragraph = document.createElement('p');
  frontmatter.textContent = 'title: note';
  paragraph.textContent = 'Body';
  dom.append(frontmatter, paragraph);

  withRect(dom, { left: 20, top: 20, width: 600, height: 300 });
  withRect(frontmatter, { left: 60, top: 40, width: 420, height: 56 });
  withRect(paragraph, { left: 60, top: 112, width: 420, height: 24 });

  const children = [
    createNode('frontmatter', 5),
    createNode('paragraph', 6),
  ];
  const doc = {
    content: { size: 11 },
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
    nodeDOM(pos: number) {
      if (pos >= 5) return paragraph;
      return frontmatter;
    },
    domAtPos(pos: number) {
      if (pos >= 6) return { node: paragraph.firstChild as Node };
      return { node: frontmatter.firstChild as Node };
    },
  };

  return { view: view as any };
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

  it('keeps frontmatter ranges in draggable block mapping', () => {
    const { view } = createFrontmatterViewMock();
    const ranges = getDraggableBlockRanges(view, [
      { from: 0, to: 5 },
    ]);

    expect(ranges).toEqual([
      { from: 0, to: 5 },
    ]);
  });

  it('keeps frontmatter and regular blocks draggable when selected together', () => {
    const { view } = createFrontmatterViewMock();
    const ranges = getDraggableBlockRanges(view, [
      { from: 0, to: 5 },
      { from: 5, to: 11 },
    ]);

    expect(ranges).toEqual([
      { from: 0, to: 5 },
      { from: 5, to: 11 },
    ]);
  });

  it('keeps hard-break paragraph line ranges draggable as line blocks', () => {
    const paragraph = createNode('paragraph', 12, [
      createNode('text', 5),
      createNode('hardbreak', 1),
      createNode('text', 4),
    ]);
    const doc = {
      content: { size: 12 },
      forEach(cb: (child: MockNode, offset: number) => void) {
        cb(paragraph, 0);
      },
    };
    const dom = document.createElement('div');
    const paragraphEl = document.createElement('p');
    paragraphEl.textContent = 'A B';
    dom.append(paragraphEl);
    const view = {
      dom,
      state: { doc },
    };

    expect(getDraggableBlockRanges(view as any, [{ from: 1, to: 7 }])).toEqual([{ from: 1, to: 7 }]);
  });

  // doc: bullet_list(14)[ list_item(12)[ paragraph(4), code_block(6) ] ]
  // Range A (hover para): { from:1, to:12 }
  // Range B (hover code): { from:6, to:12 }
  // When Range B is selected alone, getDraggableBlockRanges should keep it draggable by itself.
  it('keeps a code-block-inside-list-item range draggable by itself', () => {
    const codeBlock = createNode('code_block', 6);
    const para = createNode('paragraph', 4);
    const listItem = createNode('list_item', 12, [para, codeBlock]);
    const list = createNode('bullet_list', 14, [listItem]);
    const children = [list];
    const docSize = 14;

    // pos=6 is at the boundary: inside list_item, nodeAfter=code_block, parent=list_item
    const resolveResult = {
      nodeAfter: codeBlock,  // not a list_item
      parent: listItem,       // is a list_item
      depth: 2,
      before: (_depth: number) => 1,  // itemFrom = 1
    };

    const doc = {
      content: { size: docSize },
      forEach(cb: (child: MockNode, offset: number) => void) {
        let offset = 0;
        for (const child of children) {
          cb(child, offset);
          offset += child.nodeSize;
        }
      },
      resolve(_pos: number) {
        return resolveResult;
      },
    };

    const dom = document.createElement('div');
    const liEl = document.createElement('li');
    const codeEl = document.createElement('pre');
    liEl.appendChild(codeEl);
    dom.appendChild(liEl);
    withRect(dom, { left: 20, top: 20, width: 600, height: 200 });
    withRect(liEl, { left: 60, top: 40, width: 400, height: 80 });
    withRect(codeEl, { left: 60, top: 60, width: 400, height: 60 });

    const view = {
      dom,
      state: { doc },
      nodeDOM(_pos: number) { return liEl; },
      domAtPos(_pos: number) { return { node: liEl.firstChild as Node }; },
    };

    // Range B selected (user hovered over code block)
    const ranges = getDraggableBlockRanges(view as any, [{ from: 6, to: 12 }]);
    expect(ranges).toEqual([{ from: 6, to: 12 }]);
  });

  it.each([
    ['math_block', 1],
    ['mermaid', 1],
    ['table', 6],
    ['video', 1],
    ['toc', 1],
  ])('keeps a leading %s inside a list item draggable by itself', (typeName, nodeSize) => {
    const previewBlock = createNode(typeName, nodeSize);
    const listItem = createNode('list_item', nodeSize + 2, [previewBlock]);
    const list = createNode('bullet_list', nodeSize + 4, [listItem]);
    const children = [list];
    const docSize = nodeSize + 4;

    const doc = {
      content: { size: docSize },
      forEach(cb: (child: MockNode, offset: number) => void) {
        let offset = 0;
        for (const child of children) {
          cb(child, offset);
          offset += child.nodeSize;
        }
      },
      resolve(_pos: number) {
        return {
          nodeAfter: previewBlock,
          parent: listItem,
          depth: 2,
          before: (_depth: number) => 1,
        };
      },
    };

    const dom = document.createElement('div');
    const liEl = document.createElement('li');
    const blockEl = document.createElement('div');
    liEl.appendChild(blockEl);
    dom.appendChild(liEl);
    withRect(dom, { left: 20, top: 20, width: 600, height: 200 });
    withRect(liEl, { left: 60, top: 40, width: 400, height: 80 });
    withRect(blockEl, { left: 60, top: 60, width: 400, height: 60 });

    const view = {
      dom,
      state: { doc },
      nodeDOM(_pos: number) { return blockEl; },
      domAtPos(_pos: number) { return { node: blockEl }; },
    };

    const ranges = getDraggableBlockRanges(view as any, [{ from: 2, to: 2 + nodeSize }]);
    expect(ranges).toEqual([{ from: 2, to: 2 + nodeSize }]);
  });
});

describe('resolveBlockTargetByPos', () => {
  it('returns list-item handle target instead of whole list container', () => {
    const { view, itemOne } = createViewMock();
    const target = resolveBlockTargetByPos(view, 8);
    expect(target?.pos).toBe(6);
    expect(target?.rect).toEqual(itemOne.getBoundingClientRect());
  });

  it('resolves a handle target for frontmatter blocks', () => {
    const { view } = createFrontmatterViewMock();
    const target = resolveBlockTargetByPos(view, 0);
    expect(target?.pos).toBe(0);
    expect(target?.isListItem).toBe(false);
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

  it('supports child placement for list items when pointer is to the right of text start', () => {
    const { view } = createNestedListViewMock();
    const childTarget = resolveDropTarget(view, 180, 102);
    expect(childTarget).toMatchObject({
      insertPos: 18,
      lineY: 102,
    });
    expect((childTarget?.lineLeft ?? 0) > 100).toBe(true);
  });

  it('keeps drop target active when pointer is in horizontal blank area', () => {
    const { view } = createViewMock();

    const leftBlankTarget = resolveDropTarget(view, 8, 86);
    expect(leftBlankTarget).toMatchObject({
      insertPos: 6,
      lineY: 80,
    });

    const rightBlankTarget = resolveDropTarget(view, 760, 102);
    expect(rightBlankTarget).toMatchObject({
      insertPos: 14,
      lineY: 108,
    });
  });

  it('keeps the drop indicator width tied to the target block plus selection bleed', () => {
    const { view } = createViewMock();

    const paragraphTarget = resolveDropTarget(view, 100, 50);

    expect(paragraphTarget).toMatchObject({
      insertPos: 0,
      lineY: 40,
      lineLeft: 50,
      lineWidth: 440,
    });
  });
});
