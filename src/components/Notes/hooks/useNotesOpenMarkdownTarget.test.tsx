import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messageDialog } from '@/lib/storage/dialog';
import { useNotesOpenMarkdownTarget } from './useNotesOpenMarkdownTarget';

const mocks = vi.hoisted(() => ({
  notesState: {
    notesPath: '/vault',
    currentNote: { path: 'daily/today.md', content: '' } as { path: string; content: string } | null,
  },
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: {
    getState: () => mocks.notesState,
  },
}));

vi.mock('@/lib/storage/dialog', () => ({
  messageDialog: vi.fn(async () => undefined),
}));

vi.mock('../features/Editor/utils/titleCommitRegistry', () => ({
  flushCurrentTitleCommit: vi.fn(async () => undefined),
}));

vi.mock('./useNotesOpenTargetPicker', () => ({
  useNotesOpenTargetPicker: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

function renderTargetHook(overrides: Partial<Parameters<typeof useNotesOpenMarkdownTarget>[0]> = {}) {
  const props = {
    active: true,
    currentVaultPath: '/vault',
    notesPath: '/vault',
    currentNotePath: 'daily/today.md',
    isDirty: false,
    saveNote: vi.fn(async () => undefined),
    openNote: vi.fn(async (path: string) => {
      mocks.notesState.currentNote = { path, content: '' };
      mocks.notesState.notesPath = '/vault';
    }),
    openNoteByAbsolutePath: vi.fn(async (path: string) => {
      mocks.notesState.currentNote = { path, content: '' };
    }),
    adoptAbsoluteNoteIntoVault: vi.fn(() => false),
    openVault: vi.fn(async () => true),
    ...overrides,
  };

  return {
    props,
    ...renderHook(() => useNotesOpenMarkdownTarget(props)),
  };
}

describe('useNotesOpenMarkdownTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notesState.notesPath = '/vault';
    mocks.notesState.currentNote = { path: 'daily/today.md', content: '' };
  });

  it('opens absolute markdown targets inside the current vault as vault-relative notes', async () => {
    const { props, result } = renderTargetHook();

    await act(async () => {
      await result.current.openMarkdownTarget('/vault/daily/guide/setup.md');
    });

    expect(props.openNote).toHaveBeenCalledWith('daily/guide/setup.md');
    expect(props.openVault).not.toHaveBeenCalled();
    expect(props.openNoteByAbsolutePath).not.toHaveBeenCalled();
    expect(messageDialog).not.toHaveBeenCalled();
  });

  it('rejects non-markdown targets before saving or opening anything', async () => {
    const { props, result } = renderTargetHook({
      isDirty: true,
    });

    await act(async () => {
      await result.current.openMarkdownTarget('/vault/daily/image.png');
    });

    expect(props.saveNote).not.toHaveBeenCalled();
    expect(props.openNote).not.toHaveBeenCalled();
    expect(props.openVault).not.toHaveBeenCalled();
    expect(props.openNoteByAbsolutePath).not.toHaveBeenCalled();
    expect(messageDialog).toHaveBeenCalledWith('notes.selectMarkdownFile', {
      title: 'notes.unsupportedFile',
      kind: 'warning',
    });
  });

  it('rejects relative markdown targets before saving or opening anything', async () => {
    const { props, result } = renderTargetHook({
      isDirty: true,
    });

    await act(async () => {
      await result.current.openMarkdownTarget('daily/guide/setup.md');
    });

    expect(props.saveNote).not.toHaveBeenCalled();
    expect(props.openNote).not.toHaveBeenCalled();
    expect(props.openVault).not.toHaveBeenCalled();
    expect(props.openNoteByAbsolutePath).not.toHaveBeenCalled();
    expect(messageDialog).toHaveBeenCalledWith('Selected file path must be absolute', {
      title: 'notes.openFailed',
      kind: 'error',
    });
  });

  it('keeps external markdown targets on the vault-switch path', async () => {
    const { props, result } = renderTargetHook();

    await act(async () => {
      await result.current.openMarkdownTarget('/external/docs/setup.md');
    });

    expect(props.openVault).toHaveBeenCalledWith('/external/docs', undefined, {
      preserveSidebarTree: false,
    });
    expect(props.openNote).not.toHaveBeenCalled();
    expect(props.openNoteByAbsolutePath).not.toHaveBeenCalled();
  });

  it('waits when the vault store is already on the normalized target vault', async () => {
    const { props, result } = renderTargetHook({
      currentVaultPath: '/external/docs/',
      notesPath: '/vault',
    });

    await act(async () => {
      await result.current.openMarkdownTarget('/external/docs/setup.md');
    });

    expect(props.openVault).not.toHaveBeenCalled();
    expect(props.openNote).not.toHaveBeenCalled();
    expect(props.openNoteByAbsolutePath).not.toHaveBeenCalled();
  });
});
