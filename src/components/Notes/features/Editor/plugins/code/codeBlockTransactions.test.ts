import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as selectionUtils from './codeBlockSelectionUtils';
import { toggleCodeBlockCollapsed, updateCodeBlockLanguage } from './codeBlockTransactions';

function createMockView(options: {
  nodeAt: { attrs: Record<string, unknown>; nodeSize: number } | null;
  selection?: { from: number; to: number };
}) {
  const tr: any = {
    setNodeMarkup: vi.fn(() => tr),
  };

  const view: any = {
    state: {
      doc: {
        nodeAt: vi.fn(() => options.nodeAt),
      },
      selection: options.selection ?? { from: 0, to: 0 },
      tr,
    },
    dispatch: vi.fn(),
  };

  return { view, tr };
}

describe('codeBlockTransactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves existing attrs when updating code block language', () => {
    const { view, tr } = createMockView({
      nodeAt: {
        attrs: { language: 'ts', collapsed: true, wrap: true, lineNumbers: false },
        nodeSize: 8,
      },
    });

    updateCodeBlockLanguage(view, 10, 'JavaScript');

    expect(tr.setNodeMarkup).toHaveBeenCalledWith(10, undefined, {
      language: 'ecmascript',
      collapsed: true,
      wrap: true,
      lineNumbers: false,
    });
    expect(view.dispatch).toHaveBeenCalledWith(tr);
  });

  it('does nothing when language updates target a missing node', () => {
    const { view, tr } = createMockView({
      nodeAt: null,
    });

    updateCodeBlockLanguage(view, 10, 'ts');

    expect(tr.setNodeMarkup).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it('collapses a code block and moves the selection out when the cursor is inside it', () => {
    const moveSelectionAfterNodeSpy = vi
      .spyOn(selectionUtils, 'moveSelectionAfterNode')
      .mockImplementation((transaction) => transaction);
    const { view, tr } = createMockView({
      nodeAt: {
        attrs: { language: 'ts', collapsed: false, wrap: false, lineNumbers: true },
        nodeSize: 8,
      },
      selection: { from: 11, to: 11 },
    });

    toggleCodeBlockCollapsed(view, 10, false);

    expect(tr.setNodeMarkup).toHaveBeenCalledWith(10, undefined, {
      language: 'ts',
      collapsed: true,
      wrap: false,
      lineNumbers: true,
    });
    expect(moveSelectionAfterNodeSpy).toHaveBeenCalledWith(tr, 10, 8);
    expect(view.dispatch).toHaveBeenCalledWith(tr);
  });

  it('does not move the selection when expanding a collapsed block', () => {
    const moveSelectionAfterNodeSpy = vi
      .spyOn(selectionUtils, 'moveSelectionAfterNode')
      .mockImplementation((transaction) => transaction);
    const { view, tr } = createMockView({
      nodeAt: {
        attrs: { language: 'ts', collapsed: true, wrap: false, lineNumbers: true },
        nodeSize: 8,
      },
      selection: { from: 11, to: 11 },
    });

    toggleCodeBlockCollapsed(view, 10, true);

    expect(tr.setNodeMarkup).toHaveBeenCalledWith(10, undefined, {
      language: 'ts',
      collapsed: false,
      wrap: false,
      lineNumbers: true,
    });
    expect(moveSelectionAfterNodeSpy).not.toHaveBeenCalled();
    expect(view.dispatch).toHaveBeenCalledWith(tr);
  });

  it('does nothing when collapse toggles target a missing node', () => {
    const moveSelectionAfterNodeSpy = vi
      .spyOn(selectionUtils, 'moveSelectionAfterNode')
      .mockImplementation((transaction) => transaction);
    const { view, tr } = createMockView({
      nodeAt: null,
    });

    toggleCodeBlockCollapsed(view, 10, false);

    expect(tr.setNodeMarkup).not.toHaveBeenCalled();
    expect(moveSelectionAfterNodeSpy).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
  });
});
