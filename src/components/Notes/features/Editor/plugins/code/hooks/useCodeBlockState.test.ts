import { act, renderHook } from '@testing-library/react';
import { Selection } from '@milkdown/kit/prose/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeTextToClipboard } from '../../cursor/blockSelectionCommands';
import { useCodeBlockState } from './useCodeBlockState';

vi.mock('../../cursor/blockSelectionCommands', () => ({
  writeTextToClipboard: vi.fn(),
}));

const writeTextToClipboardMock = vi.mocked(writeTextToClipboard);

function createMockMouseEvent() {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as any;
}

function createMockView(options: {
  getPos: number;
  docSize: number;
  nodeSize: number;
  currentNodeAttrs: Record<string, unknown>;
  selection: { from: number; to: number };
}) {
  const paragraphNode = { type: 'paragraph' };
  const tr: any = {
    doc: {
      content: { size: options.docSize },
      type: { schema: { nodes: { paragraph: { create: () => paragraphNode } } } },
      resolve: (pos: number) => ({ pos }),
    },
    setNodeMarkup: vi.fn(() => tr),
    setSelection: vi.fn(() => tr),
    insert: vi.fn(() => tr),
    scrollIntoView: vi.fn(() => tr),
  };

  const currentNode = {
    attrs: options.currentNodeAttrs,
    nodeSize: options.nodeSize,
  };

  const view: any = {
    state: {
      doc: {
        nodeAt: vi.fn((pos: number) => (pos === options.getPos ? currentNode : null)),
      },
      selection: {
        from: options.selection.from,
        to: options.selection.to,
      },
      tr,
    },
    dispatch: vi.fn(),
  };

  return { view, tr, paragraphNode };
}

describe('useCodeBlockState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    writeTextToClipboardMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('commits collapsed attr and moves selection out when collapsing with cursor inside code block', () => {
    const nearSpy = vi
      .spyOn(Selection, 'near')
      .mockImplementation((resolvedPos: any, bias?: number) => ({ resolvedPos, bias }) as any);

    const node = {
      attrs: { language: 'ts', collapsed: false },
      textContent: 'const a = 1;',
    } as any;

    const { view, tr } = createMockView({
      getPos: 10,
      docSize: 20,
      nodeSize: 10,
      currentNodeAttrs: { language: 'ts', collapsed: false },
      selection: { from: 12, to: 12 },
    });

    const { result } = renderHook(() =>
      useCodeBlockState({
        node,
        view,
        getPos: () => 10,
        getNode: () => node,
      }),
    );

    act(() => {
      result.current.toggleCollapse(createMockMouseEvent());
    });

    expect(tr.setNodeMarkup).toHaveBeenCalledWith(10, undefined, {
      language: 'ts',
      collapsed: true,
    });
    expect(nearSpy).toHaveBeenCalled();
    expect(view.dispatch).toHaveBeenCalledWith(tr);
  });

  it('does not force cursor move when collapsing and selection is outside code block', () => {
    const node = {
      attrs: { language: 'ts', collapsed: false },
      textContent: 'const a = 1;',
    } as any;

    const { view, tr } = createMockView({
      getPos: 10,
      docSize: 100,
      nodeSize: 10,
      currentNodeAttrs: { language: 'ts', collapsed: false },
      selection: { from: 2, to: 2 },
    });

    const { result } = renderHook(() =>
      useCodeBlockState({
        node,
        view,
        getPos: () => 10,
        getNode: () => node,
      }),
    );

    act(() => {
      result.current.toggleCollapse(createMockMouseEvent());
    });

    expect(tr.setNodeMarkup).toHaveBeenCalledTimes(1);
    expect(view.dispatch).toHaveBeenCalledWith(tr);
  });

  it('shows copied state then resets after timeout when user clicks copy', async () => {
    writeTextToClipboardMock.mockResolvedValue(true);

    const node = {
      attrs: { language: 'ts', collapsed: false },
      textContent: 'const copied = true;',
    } as any;

    const { view } = createMockView({
      getPos: 10,
      docSize: 100,
      nodeSize: 10,
      currentNodeAttrs: { language: 'ts', collapsed: false },
      selection: { from: 12, to: 12 },
    });

    const { result } = renderHook(() =>
      useCodeBlockState({
        node,
        view,
        getPos: () => 10,
        getNode: () => node,
      }),
    );

    await act(async () => {
      result.current.handleCopy(createMockMouseEvent());
      await Promise.resolve();
    });

    expect(writeTextToClipboardMock).toHaveBeenCalledWith('const copied = true;');
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copied).toBe(false);
  });

  it('does not show copied state when clipboard write fails', async () => {
    writeTextToClipboardMock.mockResolvedValue(false);

    const node = {
      attrs: { language: 'ts', collapsed: false },
      textContent: 'const copied = false;',
    } as any;

    const { view } = createMockView({
      getPos: 10,
      docSize: 100,
      nodeSize: 10,
      currentNodeAttrs: { language: 'ts', collapsed: false },
      selection: { from: 12, to: 12 },
    });

    const { result } = renderHook(() =>
      useCodeBlockState({
        node,
        view,
        getPos: () => 10,
        getNode: () => node,
      }),
    );

    await act(async () => {
      result.current.handleCopy(createMockMouseEvent());
      await Promise.resolve();
    });

    expect(writeTextToClipboardMock).toHaveBeenCalledWith('const copied = false;');
    expect(result.current.copied).toBe(false);
  });

  it('updates language using current node attrs from editor state instead of stale hook props', () => {
    const node = {
      attrs: { language: 'ts', collapsed: false, wrap: false, lineNumbers: true },
      textContent: 'const a = 1;',
    } as any;

    const { view, tr } = createMockView({
      getPos: 10,
      docSize: 100,
      nodeSize: 10,
      currentNodeAttrs: { language: 'ts', collapsed: true, wrap: true, lineNumbers: false },
      selection: { from: 12, to: 12 },
    });

    const { result } = renderHook(() =>
      useCodeBlockState({
        node,
        view,
        getPos: () => 10,
        getNode: () => node,
      }),
    );

    act(() => {
      result.current.updateLanguage('javascript');
    });

    expect(tr.setNodeMarkup).toHaveBeenCalledWith(10, undefined, {
      language: 'ecmascript',
      collapsed: true,
      wrap: true,
      lineNumbers: false,
    });
  });

  it('copies the latest code text from getNode instead of a stale prop snapshot', async () => {
    writeTextToClipboardMock.mockResolvedValue(true);

    const currentNode = {
      attrs: { language: 'ts', collapsed: false },
      textContent: 'const first = true;',
    } as any;

    const { view } = createMockView({
      getPos: 10,
      docSize: 100,
      nodeSize: 10,
      currentNodeAttrs: { language: 'ts', collapsed: false },
      selection: { from: 12, to: 12 },
    });

    const { result } = renderHook(() =>
      useCodeBlockState({
        node: currentNode,
        view,
        getPos: () => 10,
        getNode: () => currentNode,
      }),
    );

    currentNode.textContent = 'const latest = true;';

    await act(async () => {
      result.current.handleCopy(createMockMouseEvent());
      await Promise.resolve();
    });

    expect(writeTextToClipboardMock).toHaveBeenCalledWith('const latest = true;');
  });

  it('does nothing when language updates cannot resolve a current position', () => {
    const node = {
      attrs: { language: 'ts', collapsed: false, wrap: false, lineNumbers: true },
      textContent: 'const a = 1;',
    } as any;

    const { view, tr } = createMockView({
      getPos: 10,
      docSize: 100,
      nodeSize: 10,
      currentNodeAttrs: { language: 'ts', collapsed: false, wrap: false, lineNumbers: true },
      selection: { from: 12, to: 12 },
    });

    const { result } = renderHook(() =>
      useCodeBlockState({
        node,
        view,
        getPos: () => undefined,
        getNode: () => node,
      }),
    );

    act(() => {
      result.current.updateLanguage('javascript');
      result.current.toggleCollapse(createMockMouseEvent());
    });

    expect(tr.setNodeMarkup).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it('clears the copy timer during unmount', async () => {
    writeTextToClipboardMock.mockResolvedValue(true);

    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const node = {
      attrs: { language: 'ts', collapsed: false },
      textContent: 'const copied = true;',
    } as any;

    const { view } = createMockView({
      getPos: 10,
      docSize: 100,
      nodeSize: 10,
      currentNodeAttrs: { language: 'ts', collapsed: false },
      selection: { from: 12, to: 12 },
    });

    const { result, unmount } = renderHook(() =>
      useCodeBlockState({
        node,
        view,
        getPos: () => 10,
        getNode: () => node,
      }),
    );

    await act(async () => {
      result.current.handleCopy(createMockMouseEvent());
      await Promise.resolve();
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
  it('defaults unlabeled blocks to txt and resolves the display label from the catalog', () => {
    const node = {
      attrs: { collapsed: false },
      textContent: 'plain text',
    } as any;

    const { view } = createMockView({
      getPos: 10,
      docSize: 100,
      nodeSize: 10,
      currentNodeAttrs: { collapsed: false },
      selection: { from: 12, to: 12 },
    });

    const { result } = renderHook(() =>
      useCodeBlockState({
        node,
        view,
        getPos: () => 10,
        getNode: () => node,
      }),
    );

    expect(result.current.language).toBe('txt');
    expect(result.current.displayName).toBe('TXT');
  });
});
