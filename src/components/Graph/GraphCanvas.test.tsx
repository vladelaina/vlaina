import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDiagnosticsLog, getDiagnosticsLogText } from '@/lib/diagnostics/diagnosticsLog';
import { GraphCanvas } from './GraphCanvas';
import type { PositionedNoteGraph } from './model/graphLayout';

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const graph: PositionedNoteGraph = {
  focusNodeId: 'Alpha.md',
  nodes: [
    { id: 'Alpha.md', label: 'Alpha', degree: 1, x: 100, y: 100 },
    { id: 'Beta.md', label: 'Beta', degree: 1, x: 300, y: 100 },
    { id: 'Gamma.md', label: 'Gamma', degree: 0, x: 500, y: 100 },
  ],
  edges: [],
};
graph.edges = [{ source: graph.nodes[0]!, target: graph.nodes[1]! }];

function readNodePosition(element: Element) {
  const match = element.parentElement?.getAttribute('transform')
    ?.match(/^translate\(([-+\d.e]+)[ ,]([-+\d.e]+)\)$/i);
  return {
    x: Number(match?.[1]),
    y: Number(match?.[2]),
  };
}

describe('GraphCanvas', () => {
  beforeEach(() => {
    clearDiagnosticsLog();
    Object.defineProperty(SVGSVGElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(SVGSVGElement.prototype, 'hasPointerCapture', {
      configurable: true,
      value: vi.fn(() => true),
    });
    Object.defineProperty(SVGSVGElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
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

  it('drags a node without opening it', () => {
    const onOpenPath = vi.fn();
    const onPositionCommit = vi.fn();
    render(
      <GraphCanvas
        graph={graph}
        positionOverrides={{}}
        selectedPath="Alpha.md"
        onOpenPath={onOpenPath}
        onPositionCommit={onPositionCommit}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );

    const node = screen.getByRole('button', { name: 'Alpha, 1' });
    const hitTarget = node.querySelector('[data-graph-node-hit-target="Alpha.md"]')!;
    const canvas = screen.getByRole('img', { name: 'app.viewGraph' });
    const edge = canvas.querySelector('[data-graph-edge-layer="base"]')!;
    const activeEdge = canvas.querySelector('[data-graph-edge-layer="active"]')!;
    const visibleNode = node.querySelectorAll('circle')[1]!;
    const enteringNodes = canvas.querySelectorAll('[data-graph-node-position]');
    expect(enteringNodes[0]).toHaveClass('vlaina-graph-node-enter');
    expect(enteringNodes[0]).toHaveStyle({ '--vlaina-graph-enter-index': '0' });
    expect(enteringNodes[1]).toHaveStyle({ '--vlaina-graph-enter-index': '1' });
    expect(edge.parentElement).toHaveClass('vlaina-graph-edge-enter');
    expect(Number(hitTarget.getAttribute('r'))).toBeGreaterThanOrEqual(16);
    expect(edge).toHaveAttribute('stroke', 'var(--vlaina-color-graph-edge)');
    expect(Number(edge.getAttribute('stroke-opacity'))).toBeGreaterThan(0);
    expect(edge).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    fireEvent.pointerDown(hitTarget, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    expect(visibleNode).toHaveClass('fill-[var(--vlaina-color-graph-node-active)]');
    expect(activeEdge).toHaveAttribute('opacity', '1');
    expect(activeEdge.getAttribute('d')).not.toBe('');
    fireEvent.pointerMove(canvas, { clientX: 140, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 140, clientY: 120, pointerId: 1 });

    expect(onPositionCommit).toHaveBeenCalledWith('Alpha.md', expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
    }));
    expect(onOpenPath).not.toHaveBeenCalled();
    const diagnostics = getDiagnosticsLogText();
    expect(diagnostics).toContain('pointer-drag-start');
    expect(diagnostics).toContain('pointer-drag-release');
    expect(diagnostics).toContain('force-release');
  });

  it('coalesces repeated pointer moves into one animation frame', () => {
    render(
      <GraphCanvas
        graph={graph}
        positionOverrides={{}}
        selectedPath="Alpha.md"
        onOpenPath={vi.fn()}
        onPositionCommit={vi.fn()}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );
    let scheduledFrame: FrameRequestCallback | null = null;
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      scheduledFrame = callback;
      return 42;
    });
    const node = screen.getByRole('button', { name: 'Alpha, 1' });
    const hitTarget = node.querySelector('[data-graph-node-hit-target="Alpha.md"]')!;
    const canvas = screen.getByRole('img', { name: 'app.viewGraph' });

    fireEvent.pointerDown(hitTarget, { button: 0, clientX: 100, clientY: 100, pointerId: 4 });
    for (let offset = 1; offset <= 20; offset += 1) {
      fireEvent.pointerMove(canvas, { clientX: 100 + offset, clientY: 100, pointerId: 4 });
    }

    expect(requestFrame).toHaveBeenCalledTimes(1);
    act(() => scheduledFrame?.(performance.now()));
    expect(readNodePosition(hitTarget).x).toBeGreaterThan(100);
  });

  it('opens on click and supports keyboard nudging', () => {
    const onOpenPath = vi.fn();
    const onPositionCommit = vi.fn();
    render(
      <GraphCanvas
        graph={graph}
        positionOverrides={{}}
        selectedPath="Alpha.md"
        onOpenPath={onOpenPath}
        onPositionCommit={onPositionCommit}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );

    const node = screen.getByRole('button', { name: 'Alpha, 1' });
    const hitTarget = node.querySelector('[data-graph-node-hit-target="Alpha.md"]')!;
    const canvas = screen.getByRole('img', { name: 'app.viewGraph' });
    fireEvent.pointerDown(hitTarget, { button: 0, clientX: 100, clientY: 100, pointerId: 5 });
    fireEvent.pointerUp(canvas, { clientX: 100, clientY: 100, pointerId: 5 });
    expect(onOpenPath).toHaveBeenCalledWith('Alpha.md');

    const currentPosition = node.querySelector('[data-graph-node-hit-target="Alpha.md"]')!;
    const { x: currentX, y: currentY } = readNodePosition(currentPosition);
    fireEvent.keyDown(node, { key: 'ArrowRight' });
    expect(onPositionCommit).toHaveBeenCalledWith('Alpha.md', {
      x: currentX + 2,
      y: currentY,
    });
  });

  it('highlights a hovered node and its incident edges', () => {
    render(
      <GraphCanvas
        graph={graph}
        positionOverrides={{}}
        selectedPath="Gamma.md"
        onOpenPath={vi.fn()}
        onPositionCommit={vi.fn()}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );

    const alpha = screen.getByRole('button', { name: 'Alpha, 1' });
    const gamma = screen.getByRole('button', { name: 'Gamma, 0' });
    const visibleNode = alpha.querySelectorAll('circle')[1]!;
    const canvas = screen.getByRole('img', { name: 'app.viewGraph' });
    const edge = canvas.querySelector('[data-graph-edge-layer="base"]')!;
    const activeEdge = canvas.querySelector('[data-graph-edge-layer="active"]')!;
    expect(visibleNode).toHaveClass('fill-[var(--vlaina-color-graph-node)]');
    expect(visibleNode).toHaveClass('vlaina-graph-node-dot-enter');
    expect(gamma).toHaveStyle({ '--vlaina-graph-enter-index': '0' });
    expect(edge).toHaveAttribute('stroke', 'var(--vlaina-color-graph-edge)');
    expect(activeEdge).toHaveAttribute('d', '');
    expect(activeEdge).toHaveAttribute('opacity', '0');

    fireEvent.mouseEnter(alpha);

    expect(visibleNode).toHaveClass('fill-[var(--vlaina-color-graph-node-active)]');
    expect(activeEdge).toHaveAttribute('stroke', 'var(--vlaina-color-graph-edge-active)');
    expect(activeEdge.getAttribute('d')).not.toBe('');
    expect(activeEdge).toHaveAttribute('opacity', '1');
  });

  it('keeps a partial saved position fixed during initial stabilization', () => {
    render(
      <GraphCanvas
        graph={graph}
        positionOverrides={{ 'Alpha.md': { x: 180, y: 160 } }}
        selectedPath="Alpha.md"
        onOpenPath={vi.fn()}
        onPositionCommit={vi.fn()}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );

    const node = screen.getByRole('button', { name: 'Alpha, 1' });
    const position = node.querySelector('[data-graph-node-hit-target="Alpha.md"]')!;
    expect(readNodePosition(position)).toEqual({ x: 180, y: 160 });
  });

  it('pans the canvas and zooms around the pointer', () => {
    render(
      <GraphCanvas
        graph={graph}
        positionOverrides={{}}
        selectedPath="Alpha.md"
        onOpenPath={vi.fn()}
        onPositionCommit={vi.fn()}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );

    const canvas = screen.getByRole('img', { name: 'app.viewGraph' });
    const content = canvas.querySelector('g')!;
    const before = content.getAttribute('transform');
    fireEvent.pointerDown(canvas, { button: 0, clientX: 20, clientY: 20, pointerId: 2 });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 60, pointerId: 2 });
    fireEvent.pointerUp(canvas, { clientX: 80, clientY: 60, pointerId: 2 });
    expect(content.getAttribute('transform')).not.toBe(before);

    const afterPan = content.getAttribute('transform');
    const zoomFrames: FrameRequestCallback[] = [];
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      zoomFrames.push(callback);
      return 84 + zoomFrames.length;
    });
    fireEvent.wheel(canvas, { clientX: 400, clientY: 300, deltaY: -120 });
    const framesAfterFirstWheel = requestFrame.mock.calls.length;
    fireEvent.wheel(canvas, { clientX: 400, clientY: 300, deltaY: -120 });
    expect(requestFrame).toHaveBeenCalledTimes(framesAfterFirstWheel);
    act(() => zoomFrames.forEach((callback) => callback(performance.now())));
    expect(content.getAttribute('transform')).not.toBe(afterPan);
  });
});
