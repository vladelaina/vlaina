import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messageDialog } from '@/lib/storage/dialog';
import { useNotesOpenMarkdownTarget } from './useNotesOpenMarkdownTarget';

const mocks = vi.hoisted(() => ({
  notesState: {
    notesPath: '/notesRoot',
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
    currentNotesRootPath: '/notesRoot',
    notesPath: '/notesRoot',
    currentNotePath: 'daily/today.md',
    isDirty: false,
    saveNote: vi.fn(async () => undefined),
    openNote: vi.fn(async (path: string) => {
      mocks.notesState.currentNote = { path, content: '' };
      mocks.notesState.notesPath = '/notesRoot';
    }),
    openNoteByAbsolutePath: vi.fn(async (path: string) => {
      mocks.notesState.currentNote = { path, content: '' };
    }),
    adoptAbsoluteNoteIntoNotesRoot: vi.fn(() => false),
    openNotesRoot: vi.fn(async () => true),
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
    mocks.notesState.notesPath = '/notesRoot';
    mocks.notesState.currentNote = { path: 'daily/today.md', content: '' };
  });

  it('opens absolute markdown targets inside the opened folder as notes-root-relative notes', async () => {
    const { props, result } = renderTargetHook();
    let opened = false;

    await act(async () => {
      opened = await result.current.openMarkdownTarget('/notesRoot/daily/guide/setup.md');
    });

    expect(opened).toBe(true);
    expect(props.openNote).toHaveBeenCalledWith('daily/guide/setup.md');
    expect(props.openNotesRoot).not.toHaveBeenCalled();
    expect(props.openNoteByAbsolutePath).not.toHaveBeenCalled();
    expect(messageDialog).not.toHaveBeenCalled();
  });

  it('rejects non-markdown targets before saving or opening anything', async () => {
    const { props, result } = renderTargetHook({
      isDirty: true,
    });
    let opened = true;

    await act(async () => {
      opened = await result.current.openMarkdownTarget('/notesRoot/daily/image.png');
    });

    expect(opened).toBe(false);
    expect(props.saveNote).not.toHaveBeenCalled();
    expect(props.openNote).not.toHaveBeenCalled();
    expect(props.openNotesRoot).not.toHaveBeenCalled();
    expect(props.openNoteByAbsolutePath).not.toHaveBeenCalled();
    expect(messageDialog).toHaveBeenCalledWith('notes.selectMarkdownFile', {
      title: 'notes.unsupportedFile',
      kind: 'warning',
    });
  });

  it('rejects markdown targets with unsafe path characters before saving or opening anything', async () => {
    const { props, result } = renderTargetHook({
      isDirty: true,
    });

    await act(async () => {
      await result.current.openMarkdownTarget('/notesRoot/daily/secret\u202Egnp.md');
    });

    expect(props.saveNote).not.toHaveBeenCalled();
    expect(props.openNote).not.toHaveBeenCalled();
    expect(props.openNotesRoot).not.toHaveBeenCalled();
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
    expect(props.openNotesRoot).not.toHaveBeenCalled();
    expect(props.openNoteByAbsolutePath).not.toHaveBeenCalled();
    expect(messageDialog).toHaveBeenCalledWith('Selected file path must be absolute', {
      title: 'notes.openFailed',
      kind: 'error',
    });
  });

  it('keeps external markdown targets on the notes-root-switch path', async () => {
    const { props, result } = renderTargetHook();

    await act(async () => {
      await result.current.openMarkdownTarget('/external/docs/setup.md');
    });

    expect(props.openNotesRoot).toHaveBeenCalledWith('/external/docs', undefined, {
      preserveSidebarTree: false,
    });
    expect(props.openNote).not.toHaveBeenCalled();
    expect(props.openNoteByAbsolutePath).not.toHaveBeenCalled();
  });

  it('falls back to opening the selected file when its parent folder cannot be opened as a notesRoot', async () => {
    const { props, result } = renderTargetHook({
      openNotesRoot: vi.fn(async () => false),
    });

    await act(async () => {
      await result.current.openMarkdownTarget('/external/docs/setup.md');
    });

    expect(props.openNotesRoot).toHaveBeenCalledWith('/external/docs', undefined, {
      preserveSidebarTree: false,
    });
    expect(props.openNoteByAbsolutePath).toHaveBeenCalledWith('/external/docs/setup.md');
    expect(messageDialog).not.toHaveBeenCalledWith('notesRoot.openFailed', expect.anything());
  });

  it('reopens the target notesRoot when the notesRoot store is ahead of the notes path', async () => {
    const { props, result } = renderTargetHook({
      currentNotesRootPath: '/external/docs/',
      notesPath: '/notesRoot',
    });

    await act(async () => {
      await result.current.openMarkdownTarget('/external/docs/setup.md');
    });

    expect(props.openNotesRoot).toHaveBeenCalledWith('/external/docs', undefined, {
      preserveSidebarTree: false,
    });
    expect(props.openNote).not.toHaveBeenCalled();
    expect(props.openNoteByAbsolutePath).not.toHaveBeenCalled();
  });

  it('waits for the target notes path before opening the pending file as a relative note', async () => {
    const props = {
      active: true,
      currentNotesRootPath: '/external/docs',
      notesPath: '/notesRoot',
      currentNotePath: 'daily/today.md',
      isDirty: false,
      saveNote: vi.fn(async () => undefined),
      openNote: vi.fn(async (path: string) => {
        mocks.notesState.currentNote = { path, content: '' };
        mocks.notesState.notesPath = '/external/docs';
      }),
      openNoteByAbsolutePath: vi.fn(async (path: string) => {
        mocks.notesState.currentNote = { path, content: '' };
      }),
      adoptAbsoluteNoteIntoNotesRoot: vi.fn(() => false),
      openNotesRoot: vi.fn(async () => true),
    };
    mocks.notesState.notesPath = '/notesRoot';

    const { result, rerender } = renderHook(
      (hookProps: typeof props) => useNotesOpenMarkdownTarget(hookProps),
      { initialProps: props },
    );

    await act(async () => {
      await result.current.openMarkdownTarget('/external/docs/setup.md');
    });

    expect(props.openNote).not.toHaveBeenCalled();
    expect(props.openNoteByAbsolutePath).not.toHaveBeenCalled();

    mocks.notesState.notesPath = '/external/docs';
    rerender({
      ...props,
      notesPath: '/external/docs',
    });

    await act(async () => undefined);

    expect(props.openNote).toHaveBeenCalledWith('setup.md');
    expect(props.openNoteByAbsolutePath).not.toHaveBeenCalledWith('/external/docs/setup.md');
  });
});
