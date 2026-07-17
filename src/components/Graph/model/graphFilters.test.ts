import { describe, expect, it } from 'vitest';
import type { NoteGraph } from './noteGraph';
import { filterNoteGraph, rankGraphNodes } from './graphFilters';

const graph: NoteGraph = {
  nodes: [
    { id: 'Alpha.md', label: 'Alpha', degree: 2 },
    { id: 'Beta.md', label: 'Beta', degree: 2 },
    { id: 'Gamma.md', label: 'Gamma', degree: 2 },
    { id: 'Delta.md', label: 'Delta', degree: 1 },
    { id: 'Echo.md', label: 'Echo', degree: 1 },
  ],
  edges: [
    { source: 'Alpha.md', target: 'Beta.md' },
    { source: 'Alpha.md', target: 'Echo.md' },
    { source: 'Beta.md', target: 'Gamma.md' },
    { source: 'Gamma.md', target: 'Delta.md' },
  ],
};

describe('filterNoteGraph', () => {
  it('returns the original graph for the all scope', () => {
    expect(filterNoteGraph(graph, { scope: 'all', focusNodeId: 'Alpha.md' })).toBe(graph);
  });

  it('keeps the focus and direct neighbors in a one-hop local graph', () => {
    expect(filterNoteGraph(graph, { scope: 'local', focusNodeId: 'Alpha.md' })).toEqual({
      nodes: [
        { id: 'Alpha.md', label: 'Alpha', degree: 2 },
        { id: 'Beta.md', label: 'Beta', degree: 1 },
        { id: 'Echo.md', label: 'Echo', degree: 1 },
      ],
      edges: [
        { source: 'Alpha.md', target: 'Beta.md' },
        { source: 'Alpha.md', target: 'Echo.md' },
      ],
    });
  });

  it('supports deeper local graphs and zero-hop focus isolation', () => {
    const twoHops = filterNoteGraph(graph, {
      scope: 'local',
      focusNodeId: 'Alpha.md',
      localDepth: 2,
    });
    expect(twoHops.nodes.map((node) => node.id)).toEqual([
      'Alpha.md',
      'Beta.md',
      'Gamma.md',
      'Echo.md',
    ]);
    expect(twoHops.edges).toHaveLength(3);

    expect(filterNoteGraph(graph, {
      scope: 'local',
      focusNodeId: 'Alpha.md',
      localDepth: 0,
    })).toEqual({
      nodes: [{ id: 'Alpha.md', label: 'Alpha', degree: 0 }],
      edges: [],
    });
  });

  it('returns an empty local graph when the focus does not exist', () => {
    expect(filterNoteGraph(graph, { scope: 'local', focusNodeId: 'Missing.md' })).toEqual({
      nodes: [],
      edges: [],
    });
  });

  it('shares an identical local graph between view consumers', () => {
    const options = { scope: 'local' as const, focusNodeId: 'Beta.md', localDepth: 1 };
    expect(filterNoteGraph(graph, options)).toBe(filterNoteGraph(graph, options));
  });
});

describe('rankGraphNodes', () => {
  const nodes: NoteGraph['nodes'] = [
    { id: 'archive/plan-history.md', label: 'Archive', degree: 8 },
    { id: 'Airplane.md', label: 'Airplane', degree: 2 },
    { id: 'Planning.md', label: 'Planning', degree: 1 },
    { id: 'Roadmap.md', label: 'Roadmap Plan', degree: 3 },
    { id: 'Plan.md', label: 'Plan', degree: 0 },
    { id: 'Product.md', label: 'Product Plan', degree: 7 },
  ];

  it('ranks exact, prefix, word-prefix, substring, then path matches', () => {
    expect(rankGraphNodes(nodes, ' PLAN ').map((node) => node.id)).toEqual([
      'Plan.md',
      'Planning.md',
      'Product.md',
      'Roadmap.md',
      'Airplane.md',
      'archive/plan-history.md',
    ]);
  });

  it('uses degree and label as stable tie breakers', () => {
    expect(rankGraphNodes([
      { id: 'Zulu.md', label: 'Topic Zulu', degree: 1 },
      { id: 'Alpha.md', label: 'Topic Alpha', degree: 1 },
      { id: 'Popular.md', label: 'Topic Popular', degree: 5 },
    ], 'topic').map((node) => node.id)).toEqual([
      'Popular.md',
      'Alpha.md',
      'Zulu.md',
    ]);
  });

  it('returns no results for empty or unmatched queries', () => {
    expect(rankGraphNodes(nodes, '   ')).toEqual([]);
    expect(rankGraphNodes(nodes, 'missing')).toEqual([]);
  });
});
