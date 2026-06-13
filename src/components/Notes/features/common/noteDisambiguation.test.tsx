import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from '@/stores/uiSlice';
import { useNotesStore } from '@/stores/useNotesStore';
import { useNoteLabelDescriptor } from './noteDisambiguation';

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => (key === 'notes.untitled' ? 'Untitled' : key),
  }),
}));

describe('useNoteLabelDescriptor', () => {
  beforeEach(() => {
    useNotesStore.setState(useNotesStore.getInitialState(), true);
    useUIStore.setState(useUIStore.getInitialState(), true);
  });

  it('uses the live title preview for an untitled draft instead of keeping the placeholder', () => {
    act(() => {
      useNotesStore.setState({
        draftNotes: {
          'draft:blank': { parentPath: null, name: '' },
        },
      });
      useUIStore.getState().setNotesPreviewTitle('draft:blank', 'Live Draft');
    });

    const { result } = renderHook(() => useNoteLabelDescriptor('draft:blank', ''));

    expect(result.current.title).toBe('Live Draft');
    expect(result.current.isUntitledPlaceholder).toBe(false);
  });
});
