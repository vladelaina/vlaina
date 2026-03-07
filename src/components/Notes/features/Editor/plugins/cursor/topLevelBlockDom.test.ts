import { describe, expect, it } from 'vitest';
import {
  normalizeTopLevelBlockPos,
  resolveBlockElementAtPos,
  resolveTopLevelBlockElement,
} from './topLevelBlockDom';

function createViewMock() {
  const dom = document.createElement('div');
  const first = document.createElement('p');
  const second = document.createElement('h2');
  first.appendChild(document.createTextNode('A'));
  second.appendChild(document.createTextNode('B'));
  dom.appendChild(first);
  dom.appendChild(second);

  const doc = {
    content: { size: 12 },
    childCount: 2,
    resolve(pos: number) {
      return {
        index(depth: number) {
          if (depth !== 0) return 0;
          if (pos >= 12) return 2;
          if (pos >= 6) return 1;
          return 0;
        },
        posAtIndex(index: number, depth: number) {
          if (depth !== 0) return 0;
          return index <= 0 ? 0 : 6;
        },
      };
    },
  };

  const view = {
    dom,
    state: { doc },
    domAtPos(pos: number) {
      if (pos >= 7) return { node: second.firstChild as Node };
      return { node: first.firstChild as Node };
    },
    nodeDOM(pos: number) {
      return pos >= 6 ? second : first;
    },
  };

  return { view: view as any, first, second };
}

describe('normalizeTopLevelBlockPos', () => {
  it('maps position to top-level block start and clamps at doc end', () => {
    const { view } = createViewMock();
    expect(normalizeTopLevelBlockPos(view, 2)).toBe(0);
    expect(normalizeTopLevelBlockPos(view, 8)).toBe(6);
    expect(normalizeTopLevelBlockPos(view, 99)).toBe(6);
  });

  it('returns null when document is empty or resolve throws', () => {
    const { view } = createViewMock();
    const emptyView = {
      ...view,
      state: {
        doc: {
          ...view.state.doc,
          content: { size: 0 },
        },
      },
    };
    expect(normalizeTopLevelBlockPos(emptyView as any, 1)).toBeNull();

    const brokenView = {
      ...view,
      state: {
        doc: {
          ...view.state.doc,
          resolve() {
            throw new Error('boom');
          },
        },
      },
    };
    expect(normalizeTopLevelBlockPos(brokenView as any, 1)).toBeNull();
  });
});

describe('resolveTopLevelBlockElement', () => {
  it('resolves top-level block from domAtPos', () => {
    const { view, first, second } = createViewMock();
    expect(resolveTopLevelBlockElement(view, 0)).toBe(first);
    expect(resolveTopLevelBlockElement(view, 6)).toBe(second);
  });

  it('falls back to nodeDOM when domAtPos fails', () => {
    const { view, second } = createViewMock();
    const fallbackView = {
      ...view,
      domAtPos() {
        throw new Error('domAtPos failed');
      },
    };
    expect(resolveTopLevelBlockElement(fallbackView as any, 10)).toBe(second);
  });
});

describe('resolveBlockElementAtPos', () => {
  it('returns nodeDOM element when inside editor', () => {
    const { view, first } = createViewMock();
    expect(resolveBlockElementAtPos(view, 0)).toBe(first);
  });

  it('returns parent element when nodeDOM is text node', () => {
    const { view, second } = createViewMock();
    const textNodeView = {
      ...view,
      nodeDOM() {
        return second.firstChild;
      },
    };
    expect(resolveBlockElementAtPos(textNodeView as any, 9)).toBe(second);
  });

  it('uses domAtPos fallback and returns null for outside elements', () => {
    const { view, second } = createViewMock();
    const fallbackView = {
      ...view,
      nodeDOM() {
        return null;
      },
    };
    expect(resolveBlockElementAtPos(fallbackView as any, 9)).toBe(second);

    const outside = document.createElement('div');
    const outsideView = {
      ...view,
      nodeDOM() {
        return outside;
      },
      domAtPos() {
        return { node: outside };
      },
    };
    expect(resolveBlockElementAtPos(outsideView as any, 9)).toBeNull();
  });
});
