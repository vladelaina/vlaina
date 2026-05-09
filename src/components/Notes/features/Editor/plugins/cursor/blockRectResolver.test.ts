import { describe, expect, it } from 'vitest';
import { collectSelectableBlockRanges, createBlockRectResolver } from './blockRectResolver';
import {
  isTypewriterInputEvent,
  resolveTypewriterScrollTop,
  shouldCenterTypewriterSelection,
} from './typewriterModePlugin';

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

  it('includes frontmatter blocks in exported selectable ranges', () => {
    const doc = createDoc([
      createNode('frontmatter', 5),
      createNode('paragraph', 4),
      createNode('paragraph', 6),
    ]);

    const ranges = collectSelectableBlockRanges(doc as any);

    expect(ranges).toEqual([
      { from: 0, to: 5 },
      { from: 5, to: 9 },
      { from: 9, to: 15 },
    ]);
  });
});

describe('createBlockRectResolver', () => {
  it('uses editor horizontal bounds for block selection hit testing', () => {
    const dom = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = '1';
    dom.append(paragraph);
    withRect(dom, { left: 20, top: 10, width: 600, height: 300 });
    withRect(paragraph, { left: 60, top: 40, width: 10, height: 24 });

    const doc = createDoc([createNode('paragraph', 3)]);
    const view = {
      dom,
      state: { doc },
      nodeDOM: () => paragraph,
      domAtPos: () => ({ node: paragraph.firstChild as Node }),
    };

    const resolver = createBlockRectResolver({
      view: view as any,
      scrollRootSelector: '[data-note-scroll-root="true"]',
    });

    expect(resolver.getTopLevelBlockRects()).toEqual([
      {
        from: 0,
        to: 3,
        left: 20,
        top: 40,
        right: 620,
        bottom: 64,
        contentLeft: 60,
        contentRight: 70,
      },
    ]);
  });

  it('uses list item text bounds for plain click edge detection', () => {
    const dom = document.createElement('div');
    const list = document.createElement('ul');
    const item = document.createElement('li');
    const paragraph = document.createElement('p');
    const text = document.createTextNode('short');
    paragraph.append(text);
    item.append(paragraph);
    list.append(item);
    dom.append(list);

    withRect(dom, { left: 20, top: 10, width: 600, height: 300 });
    withRect(item, { left: 60, top: 40, width: 560, height: 24 });
    withRect(paragraph, { left: 100, top: 40, width: 520, height: 24 });

    const paragraphNode = createNode('paragraph', 5);
    const listItemNode = createNode('list_item', 7, [paragraphNode]);
    const listNode = createNode('bullet_list', 9, [listItemNode]);
    const doc = {
      ...createDoc([listNode]),
      resolve(pos: number) {
        return {
          nodeAfter: pos === 1 ? listItemNode : null,
        };
      },
    };
    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: () => undefined,
      getClientRects: () => [{
        x: 140,
        y: 44,
        left: 140,
        top: 44,
        width: 50,
        height: 16,
        right: 190,
        bottom: 60,
        toJSON: () => ({}),
      }],
      detach: () => undefined,
    }) as any;

    try {
      const view = {
        dom,
        state: { doc },
        nodeDOM: () => item,
        domAtPos: () => ({ node: text }),
      };

      const resolver = createBlockRectResolver({
        view: view as any,
        scrollRootSelector: '[data-note-scroll-root="true"]',
      });

      expect(resolver.getTopLevelBlockRects()).toEqual([
        {
          from: 1,
          to: 8,
          left: 20,
          top: 40,
          right: 620,
          bottom: 64,
          contentLeft: 140,
          contentRight: 190,
          allowInsideTrailingClick: true,
        },
      ]);
    } finally {
      document.createRange = originalCreateRange;
    }
  });
});

describe('resolveTypewriterScrollTop', () => {
  it('centers the cursor in the scroll root', () => {
    expect(resolveTypewriterScrollTop({
      scrollTop: 100,
      scrollHeight: 1000,
      clientHeight: 400,
      rootRect: { top: 0, bottom: 400 },
      cursorRect: { top: 280, bottom: 300 },
    })).toBe(190);
  });

  it('clamps the target scroll range', () => {
    expect(resolveTypewriterScrollTop({
      scrollTop: 20,
      scrollHeight: 500,
      clientHeight: 400,
      rootRect: { top: 0, bottom: 400 },
      cursorRect: { top: 800, bottom: 820 },
    })).toBe(100);
  });
});

describe('shouldCenterTypewriterSelection', () => {
  it('centers only collapsed cursor selections', () => {
    expect(shouldCenterTypewriterSelection({ empty: true })).toBe(true);
    expect(shouldCenterTypewriterSelection({ empty: false })).toBe(false);
  });
});

describe('isTypewriterInputEvent', () => {
  it('centers after text insertion and deletion input events', () => {
    expect(isTypewriterInputEvent(new InputEvent('beforeinput', { inputType: 'insertText' }))).toBe(true);
    expect(isTypewriterInputEvent(new InputEvent('beforeinput', { inputType: 'insertParagraph' }))).toBe(true);
    expect(isTypewriterInputEvent(new InputEvent('beforeinput', { inputType: 'deleteContentBackward' }))).toBe(true);
  });

  it('does not center for non-editing input events', () => {
    expect(isTypewriterInputEvent(new InputEvent('beforeinput', { inputType: 'historyUndo' }))).toBe(false);
    expect(isTypewriterInputEvent(new InputEvent('beforeinput', { inputType: 'formatBold' }))).toBe(false);
  });
});
