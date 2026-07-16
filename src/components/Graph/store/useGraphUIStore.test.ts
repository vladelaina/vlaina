import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRAPH_UI_STORAGE_KEY, useGraphUIStore } from './useGraphUIStore';

describe('useGraphUIStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useGraphUIStore.setState({
      mode: 'all',
      nodePositionsByRoot: {},
      searchQuery: '',
      selectedPath: null,
    });
  });

  it('tracks graph controls independently', () => {
    const store = useGraphUIStore.getState();

    store.setMode('local');
    store.setSearchQuery('linked note');
    store.setSelectedPath('/notes/linked.md');

    expect(useGraphUIStore.getState()).toMatchObject({
      mode: 'local',
      searchQuery: 'linked note',
      selectedPath: '/notes/linked.md',
    });
  });

  it('keeps node positions isolated by notes root', () => {
    const store = useGraphUIStore.getState();

    store.setNodePosition('/notes/alpha', 'first.md', { x: 120, y: 80 });
    store.setNodePosition('/notes/beta', 'first.md', { x: 460, y: 310 });

    expect(useGraphUIStore.getState().nodePositionsByRoot).toEqual({
      '/notes/alpha': { 'first.md': { x: 120, y: 80 } },
      '/notes/beta': { 'first.md': { x: 460, y: 310 } },
    });
  });

  it('replaces and clears positions for only the requested notes root', () => {
    const store = useGraphUIStore.getState();
    store.setNodePosition('/notes/alpha', 'stale.md', { x: 1, y: 2 });
    store.setNodePosition('/notes/beta', 'kept.md', { x: 3, y: 4 });

    store.setNodePositions('/notes/alpha', {
      'fresh.md': { x: 20, y: 30 },
    });
    expect(useGraphUIStore.getState().nodePositionsByRoot['/notes/alpha']).toEqual({
      'fresh.md': { x: 20, y: 30 },
    });

    useGraphUIStore.getState().clearNodePositions('/notes/alpha');
    expect(useGraphUIStore.getState().nodePositionsByRoot).toEqual({
      '/notes/beta': { 'kept.md': { x: 3, y: 4 } },
    });
  });

  it('persists positions without persisting transient controls', () => {
    const store = useGraphUIStore.getState();
    store.setMode('local');
    store.setSearchQuery('draft');
    store.setSelectedPath('/notes/alpha/draft.md');
    store.setNodePosition('/notes/alpha', 'draft.md', { x: 44, y: 55 });

    expect(JSON.parse(localStorage.getItem(GRAPH_UI_STORAGE_KEY) ?? '{}')).toEqual({
      state: {
        nodePositionsByRoot: {
          '/notes/alpha': { 'draft.md': { x: 44, y: 55 } },
        },
      },
      version: 0,
    });
  });

  it('hydrates persisted positions while restoring control defaults', async () => {
    localStorage.setItem(GRAPH_UI_STORAGE_KEY, JSON.stringify({
      state: {
        mode: 'local',
        nodePositionsByRoot: {
          '/notes/alpha': { 'saved.md': { x: 75, y: 95 } },
        },
        searchQuery: 'stale',
        selectedPath: '/notes/alpha/stale.md',
      },
      version: 0,
    }));
    vi.resetModules();

    const { useGraphUIStore: freshStore } = await import('./useGraphUIStore');

    expect(freshStore.getState()).toMatchObject({
      mode: 'all',
      nodePositionsByRoot: {
        '/notes/alpha': { 'saved.md': { x: 75, y: 95 } },
      },
      searchQuery: '',
      selectedPath: null,
    });
  });
});
