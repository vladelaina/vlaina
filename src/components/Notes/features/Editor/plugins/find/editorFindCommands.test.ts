import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorFindMatch } from './editorFindMatches';

const { editorFindPluginKeyMock, revealEditorFindMatchMock } = vi.hoisted(() => ({
  editorFindPluginKeyMock: {
    getState: vi.fn((state: { __editorFindState?: unknown }) => state.__editorFindState),
  },
  revealEditorFindMatchMock: vi.fn(),
}));

vi.mock('./editorFindKey', () => ({
  editorFindPluginKey: editorFindPluginKeyMock,
}));

vi.mock('./editorFindReveal', () => ({
  revealEditorFindMatch: revealEditorFindMatchMock,
}));

import {
  replaceAllEditorFindMatches,
  replaceCurrentEditorFindMatch,
  setEditorFindActiveIndex,
  setEditorFindQuery,
  stepEditorFindMatch,
} from './editorFindCommands';
import {
  clearCurrentEditorBlockPositionSnapshot,
  setCurrentEditorBlockPositionSnapshot,
} from '../../utils/editorBlockPositionCache';

interface MockEditorFindState {
  query: string;
  matches: EditorFindMatch[];
  activeIndex: number;
}

function createMatch(from: number, to: number): EditorFindMatch {
  return {
    from,
    to,
    ranges: [{ from, to }],
  };
}

function rect(top: number, bottom: number, width = 320): DOMRect {
  return {
    bottom,
    height: bottom - top,
    left: 0,
    right: width,
    top,
    width,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function createView(options?: {
  selectionFrom?: number;
  editorFindState?: MockEditorFindState;
}) {
  const tr: {
    __lastMeta?: unknown;
    insertText: ReturnType<typeof vi.fn>;
    setMeta: ReturnType<typeof vi.fn>;
  } = {
    insertText: vi.fn(() => tr),
    setMeta: vi.fn((_key, meta) => {
      tr.__lastMeta = meta;
      return tr;
    }),
  };

  const view = {
    state: {
      selection: {
        from: options?.selectionFrom ?? 1,
      },
      tr,
      __editorFindState: options?.editorFindState,
    },
    dispatch: vi.fn((nextTr: { __lastMeta?: { type: string; query?: string; activeIndex?: number } }) => {
      const meta = nextTr.__lastMeta;
      const currentState = view.state.__editorFindState;
      if (!meta || !currentState) {
        return;
      }

      if (meta.type === 'set-query' && typeof meta.query === 'string') {
        view.state.__editorFindState = {
          ...currentState,
          query: meta.query,
        };
        return;
      }

      if (meta.type === 'set-active-index' && typeof meta.activeIndex === 'number') {
        view.state.__editorFindState = {
          ...currentState,
          activeIndex: meta.activeIndex,
        };
      }
    }),
    coordsAtPos: vi.fn((pos: number) => ({
      top: 200 + pos,
      bottom: 216 + pos,
      left: 0,
      right: 0,
    })),
    dom: {
      closest: vi.fn(() => null),
      dispatchEvent: vi.fn(),
    },
  };

  return view;
}

describe('editorFindCommands', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('scrollBy', vi.fn());
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });
  });

  afterEach(() => {
    clearCurrentEditorBlockPositionSnapshot();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('starts a new query from the beginning of the document', () => {
    const view = createView({
      selectionFrom: 14,
      editorFindState: {
        query: '',
        matches: [],
        activeIndex: -1,
      },
    });

    setEditorFindQuery(view as never, 'beta');

    expect(view.state.tr.setMeta).toHaveBeenCalledWith(editorFindPluginKeyMock, {
      type: 'set-query',
      query: 'beta',
      preferredFrom: 0,
    });
    expect(view.dispatch).toHaveBeenCalledWith(view.state.tr);
  });

  it('keeps refining the query from the current active match', () => {
    const view = createView({
      selectionFrom: 99,
      editorFindState: {
        query: 'be',
        matches: [createMatch(2, 4), createMatch(10, 12)],
        activeIndex: 1,
      },
    });

    setEditorFindQuery(view as never, 'beta');

    expect(view.state.tr.setMeta).toHaveBeenCalledWith(editorFindPluginKeyMock, {
      type: 'set-query',
      query: 'beta',
      preferredFrom: 10,
    });
    expect(view.dispatch).toHaveBeenCalledWith(view.state.tr);
  });

  it('steps from the active match when navigating', () => {
    const view = createView({
      editorFindState: {
        query: 'beta',
        matches: [createMatch(2, 6), createMatch(10, 14)],
        activeIndex: 0,
      },
    });

    stepEditorFindMatch(view as never, 1);

    expect(view.state.tr.setMeta).toHaveBeenCalledWith(editorFindPluginKeyMock, {
      type: 'set-active-index',
      activeIndex: 1,
    });
    expect(revealEditorFindMatchMock).toHaveBeenCalledWith(view, createMatch(10, 14));
    expect(view.dispatch).toHaveBeenCalledWith(view.state.tr);
  });

  it('jumps to an explicit active match index', () => {
    const view = createView({
      editorFindState: {
        query: 'beta',
        matches: [createMatch(2, 6), createMatch(10, 14), createMatch(20, 24)],
        activeIndex: 0,
      },
    });

    setEditorFindActiveIndex(view as never, 2);

    expect(view.state.tr.setMeta).toHaveBeenCalledWith(editorFindPluginKeyMock, {
      type: 'set-active-index',
      activeIndex: 2,
    });
    expect(revealEditorFindMatchMock).toHaveBeenCalledWith(view, createMatch(20, 24));
    expect(view.dispatch).toHaveBeenCalledWith(view.state.tr);
  });

  it('uses live block geometry instead of stale snapshot document top when scrolling to a match', () => {
    const scrollRoot = document.createElement('div');
    scrollRoot.setAttribute('data-note-scroll-root', 'true');
    scrollRoot.getBoundingClientRect = () => rect(0, 300, 640);
    Object.defineProperty(scrollRoot, 'clientHeight', {
      configurable: true,
      value: 300,
    });
    const scrollTo = vi.fn();
    scrollRoot.scrollTo = scrollTo;

    const editorRoot = document.createElement('div');
    const block = document.createElement('p');
    block.getBoundingClientRect = () => rect(260, 320, 640);
    editorRoot.append(block);
    scrollRoot.append(editorRoot);
    document.body.append(scrollRoot);

    const match = createMatch(10, 14);
    const doc = { content: { size: 20 } };
    const tr: {
      __lastMeta?: unknown;
      setMeta: ReturnType<typeof vi.fn>;
    } = {
      setMeta: vi.fn((_key, meta) => {
        tr.__lastMeta = meta;
        return tr;
      }),
    };
    const view = {
      state: {
        doc,
        selection: { from: 1 },
        tr,
        __editorFindState: {
          query: 'beta',
          matches: [match],
          activeIndex: 0,
        },
      },
      dispatch: vi.fn(),
      coordsAtPos: vi.fn(() => ({
        top: 330,
        bottom: 346,
        left: 0,
        right: 0,
      })),
      dom: editorRoot,
    };
    view.dispatch = vi.fn((nextTr: { __lastMeta?: { type: string; activeIndex?: number } }) => {
      const meta = nextTr.__lastMeta;
      if (meta?.type === 'set-active-index' && typeof meta.activeIndex === 'number') {
        view.state.__editorFindState = {
          ...view.state.__editorFindState,
          activeIndex: meta.activeIndex,
        };
      }
    });

    const staleBlock = {
      from: 0,
      to: 20,
      element: block,
      rect: rect(40, 100, 640),
      documentTop: 40,
      documentBottom: 100,
      tagName: 'P',
      headingLevel: null,
      headingId: null,
      headingText: null,
    };
    setCurrentEditorBlockPositionSnapshot({
      version: 1,
      view: view as never,
      doc: doc as never,
      editorRoot,
      scrollRoot,
      scrollLeft: 0,
      scrollTop: 0,
      blocks: [staleBlock],
      blockIndex: new Map([['0:20', staleBlock]]),
      headings: [],
    });

    setEditorFindActiveIndex(view as never, 0, 'instant');

    expect(tr.setMeta).toHaveBeenCalledWith(editorFindPluginKeyMock, {
      type: 'set-active-index',
      activeIndex: 0,
    });
    expect(scrollTo).toHaveBeenCalledWith({
      top: 182,
      behavior: 'auto',
    });

    scrollRoot.remove();
  });

  it('replaces the active match and refreshes the query from the replacement end', () => {
    const view = createView({
      editorFindState: {
        query: 'beta',
        matches: [createMatch(2, 6), createMatch(10, 14)],
        activeIndex: 1,
      },
    });

    const replaced = replaceCurrentEditorFindMatch(view as never, 'updated');

    expect(replaced).toBe(true);
    expect(view.state.tr.insertText).toHaveBeenCalledWith('updated', 10, 14);
    expect(view.state.tr.setMeta).toHaveBeenCalledWith(editorFindPluginKeyMock, {
      type: 'set-query',
      query: 'beta',
      preferredFrom: 17,
    });
    expect(view.dom.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'editor:block-user-input',
    }));
    expect(view.dispatch).toHaveBeenCalledWith(view.state.tr);
  });

  it('returns false when there is no active match to replace', () => {
    const view = createView({
      editorFindState: {
        query: 'beta',
        matches: [createMatch(2, 6)],
        activeIndex: -1,
      },
    });

    const replaced = replaceCurrentEditorFindMatch(view as never, 'updated');

    expect(replaced).toBe(false);
    expect(view.state.tr.insertText).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it('replaces all matches from the end of the document and keeps the query active', () => {
    const view = createView({
      editorFindState: {
        query: 'beta',
        matches: [createMatch(2, 6), createMatch(10, 14), createMatch(20, 24)],
        activeIndex: 0,
      },
    });

    const replacedCount = replaceAllEditorFindMatches(view as never, 'x');

    expect(replacedCount).toBe(3);
    expect(view.state.tr.insertText.mock.calls).toEqual([
      ['x', 20, 24],
      ['x', 10, 14],
      ['x', 2, 6],
    ]);
    expect(view.state.tr.setMeta).toHaveBeenCalledWith(editorFindPluginKeyMock, {
      type: 'set-query',
      query: 'beta',
      preferredFrom: 2,
    });
    expect(view.dom.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'editor:block-user-input',
    }));
    expect(view.dispatch).toHaveBeenCalledWith(view.state.tr);
  });
});
