import { describe, expect, it } from 'vitest';
import { themeGraphTokens } from '@/styles/themeTokens';
import { layoutNoteGraph } from './graphLayout';
import type { NoteGraph } from './noteGraph';

describe('layoutNoteGraph', () => {
  it('centers the focus, keeps neighbors close, and spreads remaining nodes deterministically', () => {
    const graph: NoteGraph = {
      nodes: Array.from({ length: 18 }, (_, index) => ({
        id: `note-${index}.md`,
        label: `Note ${index}`,
        degree: index === 0 ? 2 : 1,
      })),
      edges: [
        { source: 'note-0.md', target: 'note-1.md' },
        { source: 'note-0.md', target: 'note-2.md' },
      ],
    };

    const first = layoutNoteGraph(graph, 'note-0.md');
    const second = layoutNoteGraph(graph, 'note-0.md');
    const focus = first.nodes.find((node) => node.id === 'note-0.md')!;
    const neighbor = first.nodes.find((node) => node.id === 'note-1.md')!;
    const outer = first.nodes.filter((node) => node.id !== focus.id && node.id !== 'note-1.md' && node.id !== 'note-2.md');

    expect(focus).toMatchObject({
      x: themeGraphTokens.viewBoxWidthPx / 2,
      y: themeGraphTokens.viewBoxHeightPx / 2,
    });
    expect(Math.hypot(neighbor.x - focus.x, neighbor.y - focus.y)).toBeLessThan(themeGraphTokens.outerStartRadiusPx);
    expect(new Set(outer.map((node) => `${node.x},${node.y}`)).size).toBe(outer.length);
    expect(second.nodes).toEqual(first.nodes);
  });
});
