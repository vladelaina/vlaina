import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { themeGraphTokens } from '@/styles/themeTokens';
import { useGraphViewportController } from './useGraphViewportController';

describe('useGraphViewportController', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  let svg: SVGSVGElement;

  const runFrames = (now: number) => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(now));
  };

  beforeEach(() => {
    frames = new Map();
    nextFrameId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = nextFrameId;
      nextFrameId += 1;
      frames.set(id, callback);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  it('eases an offscreen selected node into view', () => {
    const svgRef = { current: svg };
    const nodes = [{ id: 'Alpha.md', label: 'Alpha', degree: 0, x: 400, y: 300 }];
    const hook = renderHook(({ selectedPath }: { selectedPath: string | null }) => useGraphViewportController({
      nodeKey: 'graph',
      nodes,
      selectedPath,
      svgRef,
    }), { initialProps: { selectedPath: null as string | null } });
    act(() => runFrames(1000));
    act(() => hook.result.current.setViewport({ x: -1000, y: 0, zoom: 1 }));

    hook.rerender({ selectedPath: 'Alpha.md' });
    expect(hook.result.current.viewport.x).toBe(-1000);
    act(() => runFrames(1000 + themeGraphTokens.viewportAnimationDurationMs / 2));
    expect(hook.result.current.viewport.x).toBeGreaterThan(-1000);
    expect(hook.result.current.viewport.x).toBeLessThan(0);
    act(() => runFrames(1000 + themeGraphTokens.viewportAnimationDurationMs));
    expect(hook.result.current.viewport.x).toBeCloseTo(0);
  });

  it('cancels selected-node easing when wheel zoom takes over', () => {
    const svgRef = { current: svg };
    const nodes = [{ id: 'Alpha.md', label: 'Alpha', degree: 0, x: 400, y: 300 }];
    const hook = renderHook(({ selectedPath }: { selectedPath: string | null }) => useGraphViewportController({
      nodeKey: 'graph',
      nodes,
      selectedPath,
      svgRef,
    }), { initialProps: { selectedPath: null as string | null } });
    act(() => runFrames(1000));
    act(() => hook.result.current.setViewport({ x: -1000, y: 0, zoom: 1 }));
    hook.rerender({ selectedPath: 'Alpha.md' });
    const animationFrameId = nextFrameId - 1;
    const preventDefault = vi.fn();
    act(() => hook.result.current.handleWheel({
      clientX: 400,
      clientY: 300,
      currentTarget: svg,
      deltaY: -120,
      preventDefault,
    } as never));

    expect(preventDefault).toHaveBeenCalled();
    expect(frames.has(animationFrameId)).toBe(false);
    act(() => runFrames(1016));
    expect(hook.result.current.viewport.zoom).toBeGreaterThan(1);
  });

  it('centers the selected node immediately for reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const svgRef = { current: svg };
    const nodes = [{ id: 'Alpha.md', label: 'Alpha', degree: 0, x: 400, y: 300 }];
    const hook = renderHook(({ selectedPath }: { selectedPath: string | null }) => useGraphViewportController({
      nodeKey: 'graph',
      nodes,
      selectedPath,
      svgRef,
    }), { initialProps: { selectedPath: null as string | null } });
    act(() => runFrames(1000));
    act(() => hook.result.current.setViewport({ x: -1000, y: 0, zoom: 1 }));
    hook.rerender({ selectedPath: 'Alpha.md' });

    expect(hook.result.current.viewport.x).toBeCloseTo(0);
    expect(frames.size).toBe(0);
  });
});
