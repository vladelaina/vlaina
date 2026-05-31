import { describe, expect, it } from 'vitest';
import { collectSelectableBlockRanges, createBlockRectResolver } from './blockRectResolver';
import {
  createBlockRectYIndex,
  resolveIntersectedBlockRangesFromYIndex,
} from './blockSelectionUtils';
import {
  clearCurrentEditorBlockPositionSnapshot,
  getCurrentEditorBlockPositionSnapshot,
  getFreshCachedEditorBlockTargets,
  setCurrentEditorBlockPositionSnapshot,
} from '../../utils/editorBlockPositionCache';
import {
  isTypewriterInputEvent,
  isTypewriterKeyEvent,
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

  it('uses live DOM rects even when the global block position snapshot is stale', () => {
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

    const staleRect = {
      x: 60,
      y: 120,
      left: 60,
      top: 120,
      width: 10,
      height: 24,
      right: 70,
      bottom: 144,
      toJSON: () => ({}),
    } as DOMRect;

    setCurrentEditorBlockPositionSnapshot({
      version: 1,
      view: view as any,
      doc: doc as any,
      editorRoot: dom,
      scrollRoot: null,
      scrollLeft: 0,
      scrollTop: 0,
      blocks: [{
        from: 0,
        to: 3,
        element: paragraph,
        rect: staleRect,
        documentTop: 120,
        documentBottom: 144,
        tagName: 'P',
        headingLevel: null,
        headingId: null,
        headingText: null,
      }],
      headings: [],
    });

    try {
      const resolver = createBlockRectResolver({
        view: view as any,
        scrollRootSelector: '[data-note-scroll-root="true"]',
      });

      expect(resolver.getTopLevelBlockRects()[0]).toMatchObject({
        from: 0,
        to: 3,
        top: 40,
        bottom: 64,
      });
    } finally {
      clearCurrentEditorBlockPositionSnapshot();
    }
  });

  it('uses fresh cached target rects for drag-selection hit testing without text-boundary measurement', () => {
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

    setCurrentEditorBlockPositionSnapshot({
      version: 1,
      view: view as any,
      doc: doc as any,
      editorRoot: dom,
      scrollRoot: null,
      scrollLeft: 0,
      scrollTop: 0,
      blocks: [{
        from: 0,
        to: 3,
        element: paragraph,
        rect: paragraph.getBoundingClientRect(),
        documentTop: 40,
        documentBottom: 64,
        tagName: 'P',
        headingLevel: null,
        headingId: null,
        headingText: null,
      }],
      headings: [],
    });

    const originalCreateRange = document.createRange;
    document.createRange = () => {
      throw new Error('drag selection rects should not measure text ranges when a fresh cache exists');
    };

    try {
      expect(getCurrentEditorBlockPositionSnapshot()).not.toBeNull();
      expect(getFreshCachedEditorBlockTargets(view as any, null)).toHaveLength(1);

      const resolver = createBlockRectResolver({
        view: view as any,
        scrollRootSelector: '[data-note-scroll-root="true"]',
      });

      expect(resolver.getSelectionBlockRects()).toEqual([
        {
          from: 0,
          to: 3,
          left: 20,
          top: 40,
          right: 620,
          bottom: 64,
        },
      ]);
    } finally {
      document.createRange = originalCreateRange;
      clearCurrentEditorBlockPositionSnapshot();
    }
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

  it('selects consecutive ordered list item ranges when the drag box covers their rows', () => {
    const firstItem = createNode('list_item', 5, [createNode('paragraph', 3)]);
    const secondItem = createNode('list_item', 5, [createNode('paragraph', 3)]);
    const thirdItem = createNode('list_item', 5, [createNode('paragraph', 3)]);
    const orderedList = createNode('ordered_list', 17, [firstItem, secondItem, thirdItem]);
    const doc = {
      ...createDoc([orderedList]),
      resolve(pos: number) {
        return {
          nodeAfter:
            pos === 1 ? firstItem
              : pos === 6 ? secondItem
                : pos === 11 ? thirdItem
                  : null,
        };
      },
    };
    const dom = document.createElement('div');
    const list = document.createElement('ol');
    const items = [0, 1, 2].map((index) => {
      const item = document.createElement('li');
      const paragraph = document.createElement('p');
      paragraph.textContent = String(index + 1);
      item.append(paragraph);
      list.append(item);
      withRect(item, { left: 60, top: 40 + index * 24, width: 560, height: 20 });
      withRect(paragraph, { left: 100, top: 40 + index * 24, width: 520, height: 20 });
      return item;
    });
    dom.append(list);
    withRect(dom, { left: 20, top: 10, width: 600, height: 300 });

    const view = {
      dom,
      state: { doc },
      nodeDOM(pos: number) {
        if (pos === 1) return items[0];
        if (pos === 6) return items[1];
        if (pos === 11) return items[2];
        return null;
      },
      domAtPos(pos: number) {
        if (pos < 6) return { node: items[0].firstChild?.firstChild as Node };
        if (pos < 11) return { node: items[1].firstChild?.firstChild as Node };
        return { node: items[2].firstChild?.firstChild as Node };
      },
    };

    const resolver = createBlockRectResolver({
      view: view as any,
      scrollRootSelector: '[data-note-scroll-root="true"]',
    });
    const blockRects = resolver.getSelectionBlockRects();
    const selected = resolveIntersectedBlockRangesFromYIndex(
      createBlockRectYIndex(blockRects),
      {
        left: 0,
        right: 800,
        top: 39,
        bottom: 85,
      },
    );

    expect(blockRects.map(({ from, to }) => ({ from, to }))).toEqual([
      { from: 1, to: 6 },
      { from: 6, to: 11 },
      { from: 11, to: 16 },
    ]);
    expect(selected).toEqual([
      { from: 1, to: 6 },
      { from: 6, to: 11 },
    ]);
  });

  it('preserves wrapped list item line bounds for visual-line click detection', () => {
    const dom = document.createElement('div');
    const list = document.createElement('ul');
    const item = document.createElement('li');
    const paragraph = document.createElement('p');
    const text = document.createTextNode('wrapped text');
    paragraph.append(text);
    item.append(paragraph);
    list.append(item);
    dom.append(list);

    withRect(dom, { left: 20, top: 10, width: 600, height: 300 });
    withRect(item, { left: 60, top: 40, width: 560, height: 48 });
    withRect(paragraph, { left: 100, top: 40, width: 520, height: 48 });

    const paragraphNode = createNode('paragraph', 14);
    const listItemNode = createNode('list_item', 16, [paragraphNode]);
    const listNode = createNode('bullet_list', 18, [listItemNode]);
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
      getClientRects: () => [
        {
          x: 140,
          y: 44,
          left: 140,
          top: 44,
          width: 220,
          height: 16,
          right: 360,
          bottom: 60,
          toJSON: () => ({}),
        },
        {
          x: 140,
          y: 68,
          left: 140,
          top: 68,
          width: 80,
          height: 16,
          right: 220,
          bottom: 84,
          toJSON: () => ({}),
        },
      ],
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

      expect(resolver.getTopLevelBlockRects()[0]).toMatchObject({
        from: 1,
        to: 17,
        contentLeft: 140,
        contentRight: 360,
        contentLineRects: [
          { left: 140, top: 44, right: 360, bottom: 60 },
          { left: 140, top: 68, right: 220, bottom: 84 },
        ],
      });
    } finally {
      document.createRange = originalCreateRange;
    }
  });

  it('includes footnote reference chips in paragraph trailing click bounds', () => {
    const dom = document.createElement('div');
    const paragraph = document.createElement('p');
    const text = document.createTextNode('Text');
    const footnote = document.createElement('sup');
    const footnoteLabel = document.createElement('span');
    footnote.className = 'footnote-ref';
    footnote.setAttribute('contenteditable', 'false');
    footnoteLabel.className = 'footnote-ref-label';
    footnoteLabel.setAttribute('contenteditable', 'false');
    footnoteLabel.textContent = '[1]';
    footnote.append(footnoteLabel);
    paragraph.append(text, footnote);
    dom.append(paragraph);

    withRect(dom, { left: 20, top: 10, width: 600, height: 300 });
    withRect(paragraph, { left: 60, top: 40, width: 120, height: 24 });

    const doc = createDoc([createNode('paragraph', 4)]);
    const originalCreateRange = document.createRange;
    let selectedNode: Node | null = null;
    document.createRange = () => ({
      selectNodeContents: (node: Node) => {
        selectedNode = node;
      },
      getClientRects: () => {
        if (selectedNode === text) {
          return [{
            x: 60,
            y: 44,
            left: 60,
            top: 44,
            width: 36,
            height: 16,
            right: 96,
            bottom: 60,
            toJSON: () => ({}),
          }];
        }
        return [{
          x: 100,
          y: 36,
          left: 100,
          top: 36,
          width: 28,
          height: 12,
          right: 128,
          bottom: 48,
          toJSON: () => ({}),
        }];
      },
      detach: () => undefined,
    }) as any;

    try {
      const view = {
        dom,
        state: { doc },
        nodeDOM: () => paragraph,
        domAtPos: () => ({ node: text }),
      };

      const resolver = createBlockRectResolver({
        view: view as any,
        scrollRootSelector: '[data-note-scroll-root="true"]',
      });

      expect(resolver.getTopLevelBlockRects()).toEqual([
        {
          from: 0,
          to: 4,
          left: 20,
          top: 40,
          right: 620,
          bottom: 64,
          contentLeft: 60,
          contentRight: 128,
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

describe('isTypewriterKeyEvent', () => {
  it('centers after editing key events and shortcuts', () => {
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(true);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))).toBe(true);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'Delete' }))).toBe(true);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'Tab' }))).toBe(true);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))).toBe(true);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true }))).toBe(true);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }))).toBe(true);
  });

  it('does not center for navigation and non-editing key events', () => {
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(false);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'z' }))).toBe(false);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, altKey: true }))).toBe(false);
  });
});
