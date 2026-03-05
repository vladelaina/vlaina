import { act, renderHook } from '@testing-library/react';
import { Selection } from '@milkdown/kit/prose/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCodeBlockState } from './useCodeBlockState';

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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('commits collapsed attr and moves selection out when collapsing with cursor inside code block', () => {
    const nearSpy = vi
      .spyOn(Selection, 'near')
      .mockImplementation((resolvedPos: any, bias?: number) => ({ resolvedPos, bias }) as any);
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWrite },
      configurable: true,
    });

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
      }),
    );

    act(() => {
      result.current.toggleCollapse(createMockMouseEvent());
    });

    expect(tr.setNodeMarkup).toHaveBeenCalledWith(10, undefined, {
      language: 'ts',
      collapsed: true,
    });
    expect(tr.insert).toHaveBeenCalledWith(20, { type: 'paragraph' });
    expect(nearSpy).toHaveBeenCalledWith({ pos: 21 }, 1);
    expect(view.dispatch).toHaveBeenCalledWith(tr);
  });

  it('does not force cursor move when collapsing and selection is outside code block', () => {
    const nearSpy = vi
      .spyOn(Selection, 'near')
      .mockImplementation((resolvedPos: any, bias?: number) => ({ resolvedPos, bias }) as any);

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
      }),
    );

    act(() => {
      result.current.toggleCollapse(createMockMouseEvent());
    });

    expect(tr.setNodeMarkup).toHaveBeenCalledTimes(1);
    expect(tr.setSelection).not.toHaveBeenCalled();
    expect(tr.insert).not.toHaveBeenCalled();
    expect(nearSpy).not.toHaveBeenCalled();
  });

  it('shows copied state then resets after timeout when user clicks copy', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWrite },
      configurable: true,
    });

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
      }),
    );

    await act(async () => {
      result.current.handleCopy(createMockMouseEvent());
      await Promise.resolve();
    });

    expect(clipboardWrite).toHaveBeenCalledWith('const copied = true;');
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copied).toBe(false);
  });
});
