import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { themeGraphTokens } from '@/styles/themeTokens';
import { GraphEdges } from './GraphEdges';
import { applyGraphPositions } from './applyGraphPositions';
import type { PositionedGraphEdge, PositionedGraphNode } from '../model/graphLayout';

const alpha: PositionedGraphNode = { id: 'Alpha.md', label: 'Alpha', degree: 1, x: 0, y: 0 };
const beta: PositionedGraphNode = { id: 'Beta.md', label: 'Beta', degree: 1, x: 100, y: 0 };
const edges: PositionedGraphEdge[] = [{ source: alpha, target: beta }];

afterEach(() => vi.useRealTimers());

describe('GraphEdges', () => {
  it('updates active edge endpoints without rebuilding the base edge layer', () => {
    const view = render(
      <svg>
        <GraphEdges edges={edges} hoveredPath="Alpha.md" />
        <g data-graph-node-position="Alpha.md" />
        <g data-graph-node-position="Beta.md" />
      </svg>,
    );
    const svg = view.container.querySelector('svg')!;
    const baseEdge = svg.querySelector('[data-graph-edge-layer="base"]')!;
    const activeEdge = svg.querySelector('[data-graph-edge-layer="active"]')!;
    const basePath = baseEdge.getAttribute('d');

    applyGraphPositions(svg, {
      'Alpha.md': { x: 40, y: 20 },
      'Beta.md': { x: 160, y: 60 },
    }, 'active');

    expect(baseEdge).toHaveAttribute('d', basePath);
    expect(activeEdge).toHaveAttribute('d', 'M40,20L160,60');
  });

  it('keeps the active path mounted while its opacity fades out', () => {
    vi.useFakeTimers();
    const view = render(<svg><GraphEdges edges={edges} hoveredPath="Alpha.md" /></svg>);
    const activeEdge = view.container.querySelector('[data-graph-edge-layer="active"]')!;
    expect(activeEdge.getAttribute('d')).not.toBe('');
    expect(activeEdge).toHaveAttribute('opacity', '1');

    view.rerender(<svg><GraphEdges edges={edges} hoveredPath={null} /></svg>);
    expect(activeEdge.getAttribute('d')).not.toBe('');
    expect(activeEdge).toHaveAttribute('opacity', '0');

    act(() => vi.advanceTimersByTime(themeGraphTokens.edgeHighlightFadeDurationMs));
    expect(activeEdge).toHaveAttribute('d', '');
  });
});
