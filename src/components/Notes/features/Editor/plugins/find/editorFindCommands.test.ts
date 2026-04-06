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
  setEditorFindQuery,
  stepEditorFindMatch,
} from './editorFindCommands';

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
    expect(view.dispatch).toHaveBeenCalledWith(view.state.tr);
  });
});
