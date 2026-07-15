import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useSidebarLiveNoteContent } from './useSidebarLiveNoteContent';

const mocks = vi.hoisted(() => ({
  currentNote: null as { path: string; content: string } | null,
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: Object.assign(
    () => {
      throw new Error('Sidebar live content must not subscribe to note updates');
    },
    { getState: () => ({ currentNote: mocks.currentNote }) },
  ),
}));

beforeEach(() => {
  mocks.currentNote = null;
});

it('reads the current note once and follows throttled editor preview events', () => {
  mocks.currentNote = { path: 'alpha.md', content: 'Initial body' };

  const { result } = renderHook(() => useSidebarLiveNoteContent({
    active: true,
    currentNotePath: 'alpha.md',
  }));

  expect(result.current).toEqual({ path: 'alpha.md', content: 'Initial body' });

  act(() => {
    window.dispatchEvent(new CustomEvent('editor:note-markdown-preview', {
      detail: { path: 'alpha.md', content: 'Updated body' },
    }));
  });

  expect(result.current).toEqual({ path: 'alpha.md', content: 'Updated body' });
});

it('ignores preview events for another note', () => {
  mocks.currentNote = { path: 'alpha.md', content: 'Initial body' };

  const { result } = renderHook(() => useSidebarLiveNoteContent({
    active: true,
    currentNotePath: 'alpha.md',
  }));

  act(() => {
    window.dispatchEvent(new CustomEvent('editor:note-markdown-preview', {
      detail: { path: 'beta.md', content: 'Other body' },
    }));
  });

  expect(result.current).toEqual({ path: 'alpha.md', content: 'Initial body' });
});
