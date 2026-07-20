import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDiagnosticsLog, getDiagnosticsLogText } from '@/lib/diagnostics/diagnosticsLog';
import { GraphCanvas } from './GraphCanvas';
import { GraphCanvasScene } from './canvas/GraphCanvasScene';
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
  const match = element.closest('[data-graph-node-position]')?.getAttribute('transform')
    ?.match(/^translate\(([-+\d.e]+)[ ,]([-+\d.e]+)\)$/i);
  return {
    x: Number(match?.[1]),
    y: Number(match?.[2]),
  };
}

describe('GraphCanvas', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
    expect(canvas.querySelectorAll('.vlaina-graph-enter')).toHaveLength(1);
    expect(node).not.toHaveClass('vlaina-graph-node-enter');
    expect(Number(hitTarget.getAttribute('r'))).toBeGreaterThanOrEqual(16);
    expect(edge).toHaveAttribute('stroke', 'var(--vlaina-color-graph-edge)');
    expect(Number(edge.getAttribute('stroke-opacity'))).toBeGreaterThan(0);
    expect(edge).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();
    fireEvent.pointerDown(hitTarget, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    expect(visibleNode).toHaveClass('fill-[var(--vlaina-color-graph-node-active)]');
    expect(activeEdge).toHaveAttribute('opacity', '1');
    expect(activeEdge.getAttribute('d')).not.toBe('');
    fireEvent.pointerMove(canvas, { clientX: 140, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 140, clientY: 120, pointerId: 1 });
    expect(edge.getAttribute('d')).toContain('M140,120');

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

  it('keeps a local child edge attached without showing a stale base edge', () => {
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
    const child = screen.getByRole('button', { name: 'Beta, 1' });
    const hitTarget = child.querySelector('[data-graph-node-hit-target="Beta.md"]')!;
    const canvas = screen.getByRole('img', { name: 'app.viewGraph' });
    const baseEdge = canvas.querySelector('[data-graph-edge-layer="base"]')!;
    const activeEdge = canvas.querySelector('[data-graph-edge-layer="active"]')!;

    fireEvent.pointerDown(hitTarget, { button: 0, clientX: 300, clientY: 100, pointerId: 11 });
    expect(baseEdge).toHaveAttribute('stroke-opacity', '0');
    expect(activeEdge).toHaveAttribute('opacity', '1');
    fireEvent.pointerMove(canvas, { clientX: 340, clientY: 120, pointerId: 11 });
    fireEvent.pointerUp(canvas, { clientX: 340, clientY: 120, pointerId: 11 });

    expect(baseEdge).toHaveAttribute('stroke-opacity', '0.14');
    expect(baseEdge.getAttribute('d')).toContain('L340,120');
  });

  it('cancels an interrupted node drag without opening or committing it', () => {
    const onOpenPath = vi.fn();
    const onPositionCommit = vi.fn();
    render(
      <GraphCanvas
        graph={graph}
        positionOverrides={{}}
        selectedPath={null}
        onOpenPath={onOpenPath}
        onPositionCommit={onPositionCommit}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );
    const node = screen.getByRole('button', { name: 'Alpha, 1' });
    const hitTarget = node.querySelector('[data-graph-node-hit-target="Alpha.md"]')!;
    const canvas = screen.getByRole('img', { name: 'app.viewGraph' });

    fireEvent.pointerDown(hitTarget, { button: 0, clientX: 100, clientY: 100, pointerId: 10 });
    fireEvent.pointerCancel(canvas, { clientX: 0, clientY: 0, pointerId: 10 });

    expect(onOpenPath).not.toHaveBeenCalled();
    expect(onPositionCommit).not.toHaveBeenCalled();
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
    expect(visibleNode).not.toHaveClass('vlaina-graph-node-dot-enter');
    expect(gamma).not.toHaveClass('vlaina-graph-node-enter');
    expect(edge).toHaveAttribute('stroke', 'var(--vlaina-color-graph-edge)');
    expect(activeEdge).toHaveAttribute('d', '');
    expect(activeEdge).toHaveAttribute('opacity', '0');

    fireEvent.mouseEnter(alpha);

    expect(visibleNode).toHaveClass('fill-[var(--vlaina-color-graph-node-active)]');
    expect(screen.getByRole('button', { name: 'Beta, 1' }).querySelectorAll('circle')[1]).toHaveStyle({ opacity: '1' });
    expect(activeEdge).toHaveAttribute('stroke', 'var(--vlaina-color-graph-edge-active)');
    expect(activeEdge.getAttribute('d')).not.toBe('');
    expect(activeEdge).toHaveAttribute('opacity', '1');
  });

  it('shows hovered and directly connected labels below the global label zoom', () => {
    render(
      <svg>
        <GraphCanvasScene
          connectedToSelected={new Set()}
          dragPositionId={null}
          edges={graph.edges}
          hoveredPath="Alpha.md"
          labelsReady
          nodes={graph.nodes}
          onHoverChange={vi.fn()}
          onFocusChange={vi.fn()}
          onOpen={vi.fn()}
          onPositionCommit={vi.fn()}
          onSelect={vi.fn()}
          onStartDrag={vi.fn()}
          selectedPath={null}
          viewport={{ x: 0, y: 0, zoom: 0.5 }}
        />
      </svg>,
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();
  });

  it('shows high-degree overview labels at an intermediate zoom', () => {
    const overviewNodes = graph.nodes.map((node, index) => ({
      ...node,
      degree: [6, 3, 1][index]!,
    }));
    render(
      <svg>
        <GraphCanvasScene
          connectedToSelected={new Set()}
          dragPositionId={null}
          edges={[{ source: overviewNodes[0]!, target: overviewNodes[1]! }]}
          hoveredPath={null}
          labelsReady
          nodes={overviewNodes}
          onHoverChange={vi.fn()}
          onFocusChange={vi.fn()}
          onOpen={vi.fn()}
          onPositionCommit={vi.fn()}
          onSelect={vi.fn()}
          onStartDrag={vi.fn()}
          selectedPath={null}
          viewport={{ x: 0, y: 0, zoom: 0.6 }}
        />
      </svg>,
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();
  });

  it('focuses the selected node and its direct connections', () => {
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
    const alphaDot = screen.getByRole('button', { name: 'Alpha, 1' }).querySelectorAll('circle')[1]!;
    const betaDot = screen.getByRole('button', { name: 'Beta, 1' }).querySelectorAll('circle')[1]!;
    const gammaDot = screen.getByRole('button', { name: 'Gamma, 0' }).querySelectorAll('circle')[1]!;
    const baseEdge = canvas.querySelector('[data-graph-edge-layer="base"]')!;
    const activeEdge = canvas.querySelector('[data-graph-edge-layer="active"]')!;

    expect(Number(alphaDot.getAttribute('r'))).toBeGreaterThan(Number(gammaDot.getAttribute('r')));
    expect(alphaDot).toHaveClass('fill-[var(--vlaina-color-graph-node-active)]');
    expect(alphaDot).toHaveStyle({ opacity: '1' });
    expect(betaDot).toHaveStyle({ opacity: '1' });
    expect(gammaDot).toHaveStyle({ opacity: '0.16' });
    expect(baseEdge).toHaveAttribute('stroke-opacity', '0.14');
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

  it('holds the clustered force layout until the graph becomes active', async () => {
    const view = render(
      <GraphCanvas
        active={false}
        graph={graph}
        positionOverrides={{}}
        selectedPath={null}
        onOpenPath={vi.fn()}
        onPositionCommit={vi.fn()}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );

    const node = screen.getByRole('button', { name: 'Alpha, 1' });
    const hitTarget = node.querySelector('[data-graph-node-hit-target="Alpha.md"]')!;
    const clusteredPosition = readNodePosition(hitTarget);
    expect(clusteredPosition).not.toEqual({ x: 100, y: 100 });

    view.rerender(
      <GraphCanvas
        active
        graph={graph}
        positionOverrides={{}}
        selectedPath={null}
        onOpenPath={vi.fn()}
        onPositionCommit={vi.fn()}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );

    await waitFor(() => expect(readNodePosition(hitTarget)).not.toEqual(clusteredPosition));
  });

  it('moves saved nodes and their edges outward in the same animation frames', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const view = render(
      <GraphCanvas
        active={false}
        graph={graph}
        positionOverrides={{
          'Alpha.md': { x: 100, y: 100 },
          'Beta.md': { x: 300, y: 100 },
          'Gamma.md': { x: 500, y: 100 },
        }}
        selectedPath={null}
        onOpenPath={vi.fn()}
        onPositionCommit={vi.fn()}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );

    const alpha = screen.getByRole('button', { name: 'Alpha, 1' });
    const hitTarget = alpha.querySelector('[data-graph-node-hit-target="Alpha.md"]')!;
    const edge = screen.getByRole('img', { name: 'app.viewGraph' })
      .querySelector('[data-graph-edge-layer="base"]')!;
    const clusteredPosition = readNodePosition(hitTarget);
    const clusteredEdge = edge.getAttribute('d');
    expect(clusteredPosition).not.toEqual({ x: 100, y: 100 });

    view.rerender(
      <GraphCanvas
        active
        graph={graph}
        positionOverrides={{
          'Alpha.md': { x: 100, y: 100 },
          'Beta.md': { x: 300, y: 100 },
          'Gamma.md': { x: 500, y: 100 },
        }}
        selectedPath={null}
        onOpenPath={vi.fn()}
        onPositionCommit={vi.fn()}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );

    act(() => {
      const now = performance.now() + 100;
      frames.splice(0).forEach((callback) => callback(now));
    });
    expect(readNodePosition(hitTarget)).not.toEqual(clusteredPosition);
    expect(edge.getAttribute('d')).not.toBe(clusteredEdge);
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

  it('clears the selection when the canvas is clicked', () => {
    const onSelectPath = vi.fn();
    render(
      <GraphCanvas
        graph={graph}
        positionOverrides={{}}
        selectedPath="Alpha.md"
        onOpenPath={vi.fn()}
        onPositionCommit={vi.fn()}
        onPositionsCommit={vi.fn()}
        onSelectPath={onSelectPath}
      />,
    );

    const canvas = screen.getByRole('img', { name: 'app.viewGraph' });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 20, clientY: 20, pointerId: 8 });
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20, pointerId: 8 });

    expect(onSelectPath).toHaveBeenCalledWith(null);
  });

  it('clears temporary hover focus when a drag is released', () => {
    render(
      <GraphCanvas
        graph={graph}
        positionOverrides={{}}
        selectedPath={null}
        onOpenPath={vi.fn()}
        onPositionCommit={vi.fn()}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );

    const node = screen.getByRole('button', { name: 'Alpha, 1' });
    const hitTarget = node.querySelector('[data-graph-node-hit-target="Alpha.md"]')!;
    const canvas = screen.getByRole('img', { name: 'app.viewGraph' });
    const baseEdge = canvas.querySelector('[data-graph-edge-layer="base"]')!;
    fireEvent.mouseEnter(node);
    fireEvent.pointerDown(hitTarget, { button: 0, clientX: 100, clientY: 100, pointerId: 9 });
    fireEvent.pointerMove(canvas, { clientX: 140, clientY: 120, pointerId: 9 });
    fireEvent.pointerUp(canvas, { clientX: 140, clientY: 120, pointerId: 9 });

    expect(node.querySelectorAll('circle')[1]).toHaveStyle({ opacity: '1' });
    expect(node.querySelectorAll('circle')[1]).not.toHaveClass('fill-[var(--vlaina-color-graph-node-active)]');
    expect(baseEdge).toHaveAttribute('stroke-opacity', '0.82');
  });

  it('does not carry hover focus into a replacement graph', () => {
    const view = render(
      <GraphCanvas
        graph={graph}
        positionOverrides={{}}
        selectedPath={null}
        onOpenPath={vi.fn()}
        onPositionCommit={vi.fn()}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Alpha, 1' }));

    const replacementGraph: PositionedNoteGraph = {
      focusNodeId: 'Delta.md',
      nodes: [
        { id: 'Delta.md', label: 'Delta', degree: 1, x: 120, y: 120 },
        { id: 'Epsilon.md', label: 'Epsilon', degree: 1, x: 320, y: 120 },
      ],
      edges: [],
    };
    replacementGraph.edges = [{
      source: replacementGraph.nodes[0]!,
      target: replacementGraph.nodes[1]!,
    }];
    view.rerender(
      <GraphCanvas
        graph={replacementGraph}
        positionOverrides={{}}
        selectedPath={null}
        onOpenPath={vi.fn()}
        onPositionCommit={vi.fn()}
        onPositionsCommit={vi.fn()}
        onSelectPath={vi.fn()}
      />,
    );

    const dots = screen.getByRole('img', { name: 'app.viewGraph' })
      .querySelectorAll('.vlaina-graph-node-dot');
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveStyle({ opacity: '1' });
    expect(dots[1]).toHaveStyle({ opacity: '1' });
  });

});
