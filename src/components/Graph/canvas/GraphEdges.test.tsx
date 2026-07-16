import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { themeGraphTokens } from '@/styles/themeTokens';
import { GraphEdges } from './GraphEdges';
import type { PositionedGraphEdge, PositionedGraphNode } from '../model/graphLayout';

const alpha: PositionedGraphNode = { id: 'Alpha.md', label: 'Alpha', degree: 1, x: 0, y: 0 };
const beta: PositionedGraphNode = { id: 'Beta.md', label: 'Beta', degree: 1, x: 100, y: 0 };
const edges: PositionedGraphEdge[] = [{ source: alpha, target: beta }];

afterEach(() => vi.useRealTimers());

describe('GraphEdges', () => {
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
