import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { clearDisplayIconSnapshotCacheForTests, useDisplayIcon, useDisplayName } from './useTitleSync';

describe('useDisplayName', () => {
  beforeEach(() => {
    useNotesStore.setState(useNotesStore.getInitialState(), true);
    useUIStore.setState(useUIStore.getInitialState(), true);
    clearDisplayIconSnapshotCacheForTests();
  });

  it('shows Untitled for an empty draft note instead of leaking its internal path', () => {
    act(() => {
      useNotesStore.setState({
        displayNames: new Map([['draft:blank', '']]),
        draftNotes: {
          'draft:blank': { parentPath: null, name: '' },
        },
      });
    });

    const { result } = renderHook(() => useDisplayName('draft:blank'));

    expect(result.current).toBe('Untitled');
  });

  it('uses the draft title when a draft note has been named', () => {
    act(() => {
      useNotesStore.setState({
        draftNotes: {
          'draft:named': { parentPath: null, name: 'Draft Title' },
        },
      });
    });

    const { result } = renderHook(() => useDisplayName('draft:named'));

    expect(result.current).toBe('Draft Title');
  });

  it('does not expose draft paths while draft metadata is unavailable', () => {
    const { result } = renderHook(() => useDisplayName('draft:pending'));

    expect(result.current).toBe('Untitled');
  });

  it('uses the live title preview for an untitled draft note', () => {
    act(() => {
      useNotesStore.setState({
        draftNotes: {
          'draft:blank': { parentPath: null, name: '' },
        },
      });
      useUIStore.getState().setNotesPreviewTitle('draft:blank', 'Live Draft');
    });

    const { result } = renderHook(() => useDisplayName('draft:blank'));

    expect(result.current).toBe('Live Draft');
  });
});

describe('useDisplayIcon', () => {
  beforeEach(() => {
    useNotesStore.setState(useNotesStore.getInitialState(), true);
    useUIStore.setState(useUIStore.getInitialState(), true);
    clearDisplayIconSnapshotCacheForTests();
  });

  it('uses current markdown frontmatter while note icon metadata is not loaded yet', () => {
    act(() => {
      useNotesStore.setState({
        currentNote: {
          path: 'notes/demo.md',
          content: [
            '---',
            'vlaina_icon: "assets/icons/demo.svg"',
            '---',
            '',
            '# Demo',
          ].join('\n'),
        },
        noteMetadata: { version: 2, notes: {} },
      });
    });

    const { result } = renderHook(() => useDisplayIcon('notes/demo.md'));

    expect(result.current).toBe('assets/icons/demo.svg');
  });

  it('does not restore a removed icon from current frontmatter after metadata explicitly loaded the note', () => {
    act(() => {
      useNotesStore.setState({
        currentNote: {
          path: 'notes/demo.md',
          content: [
            '---',
            'vlaina_icon: "assets/icons/stale.svg"',
            '---',
            '',
            '# Demo',
          ].join('\n'),
        },
        noteMetadata: {
          version: 2,
          notes: {
            'notes/demo.md': {},
          },
        },
      });
    });

    const { result } = renderHook(() => useDisplayIcon('notes/demo.md'));

    expect(result.current).toBeUndefined();
  });

  it('keeps the last loaded icon while a metadata refresh temporarily omits the note entry', () => {
    act(() => {
      useNotesStore.setState({
        noteMetadata: {
          version: 2,
          notes: {
            'notes/demo.md': { icon: '😁' },
          },
        },
      });
    });

    const { result } = renderHook(() => useDisplayIcon('notes/demo.md'));
    expect(result.current).toBe('😁');

    act(() => {
      useNotesStore.setState({
        noteMetadata: {
          version: 2,
          notes: {},
        },
      });
    });

    expect(result.current).toBe('😁');
  });

  it('clears the cached icon when metadata explicitly loads the note without one', () => {
    act(() => {
      useNotesStore.setState({
        noteMetadata: {
          version: 2,
          notes: {
            'notes/demo.md': { icon: '🌲' },
          },
        },
      });
    });

    const { result } = renderHook(() => useDisplayIcon('notes/demo.md'));
    expect(result.current).toBe('🌲');

    act(() => {
      useNotesStore.setState({
        noteMetadata: {
          version: 2,
          notes: {
            'notes/demo.md': {},
          },
        },
      });
    });

    expect(result.current).toBeUndefined();
  });

  it('does not reuse a temporarily missing icon cache across vaults for the same note path', () => {
    act(() => {
      useNotesStore.setState({
        notesPath: '/vault-a',
        noteMetadata: {
          version: 2,
          notes: {
            'notes/demo.md': { icon: '🌲' },
          },
        },
      });
    });

    const { result } = renderHook(() => useDisplayIcon('notes/demo.md'));
    expect(result.current).toBe('🌲');

    act(() => {
      useNotesStore.setState({
        notesPath: '/vault-b',
        noteMetadata: {
          version: 2,
          notes: {},
        },
      });
    });

    expect(result.current).toBeUndefined();
  });
});
