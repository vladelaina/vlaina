import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNotesStore } from '@/stores/useNotesStore';
import { useDisplayName } from './useTitleSync';

describe('useDisplayName', () => {
  beforeEach(() => {
    useNotesStore.setState(useNotesStore.getInitialState(), true);
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
});
