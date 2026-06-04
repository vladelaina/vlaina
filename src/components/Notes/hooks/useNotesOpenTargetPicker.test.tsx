import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messageDialog } from '@/lib/storage/dialog';
import { getElectronBridge } from '@/lib/electron/bridge';
import { onDesktopOpenMarkdownFile } from '@/lib/desktop/shortcuts';
import { useNotesOpenTargetPicker } from './useNotesOpenTargetPicker';

const mocks = vi.hoisted(() => ({
  setAppViewMode: vi.fn(),
  authorizePath: vi.fn(async () => ({
    name: 'guide.markdown',
    path: '/vault/guide.markdown',
    isDirectory: false,
    isFile: true,
  })),
  desktopOpenMarkdownFileCallback: null as null | ((path: string) => void),
  electronBridge: null as null | {
    dragDrop?: {
      authorizePath?: (path: string) => Promise<{
        name: string;
        path: string;
        isDirectory: boolean;
        isFile: boolean;
      }>;
    };
  },
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: { setAppViewMode: typeof mocks.setAppViewMode }) => unknown) =>
    selector({ setAppViewMode: mocks.setAppViewMode }),
}));

vi.mock('@/lib/desktop/shortcuts', () => ({
  onDesktopOpenMarkdownFileShortcut: vi.fn(() => () => {}),
  onDesktopOpenMarkdownFile: vi.fn((callback: (path: string) => void) => {
    mocks.desktopOpenMarkdownFileCallback = callback;
    return () => {
      mocks.desktopOpenMarkdownFileCallback = null;
    };
  }),
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: vi.fn(() => mocks.electronBridge),
}));

vi.mock('@/lib/storage/dialog', () => ({
  messageDialog: vi.fn(async () => undefined),
  openDialog: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../features/Editor/utils/titleCommitRegistry', () => ({
  flushCurrentTitleCommit: vi.fn(async () => undefined),
}));

function renderPicker(overrides: Partial<Parameters<typeof useNotesOpenTargetPicker>[0]> = {}) {
  const props = {
    active: true,
    currentVaultPath: '/vault',
    isOpenTargetBusy: false,
    openMarkdownTarget: vi.fn(async () => undefined),
    openFolderTarget: vi.fn(async () => undefined),
    ...overrides,
  };

  return {
    props,
    ...renderHook(() => useNotesOpenTargetPicker(props)),
  };
}

describe('useNotesOpenTargetPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.desktopOpenMarkdownFileCallback = null;
    mocks.authorizePath.mockResolvedValue({
      name: 'guide.markdown',
      path: '/vault/guide.markdown',
      isDirectory: false,
      isFile: true,
    });
    mocks.electronBridge = {
      dragDrop: {
        authorizePath: mocks.authorizePath,
      },
    };
  });

  it('rejects unsupported desktop file-open paths before authorizing them', async () => {
    const { props } = renderPicker();

    await act(async () => {
      await mocks.desktopOpenMarkdownFileCallback?.('/vault/image.png');
    });

    expect(mocks.setAppViewMode).toHaveBeenCalledWith('notes');
    expect(getElectronBridge).not.toHaveBeenCalled();
    expect(mocks.authorizePath).not.toHaveBeenCalled();
    expect(props.openMarkdownTarget).not.toHaveBeenCalled();
    expect(messageDialog).toHaveBeenCalledWith('notes.selectMarkdownFile', {
      title: 'notes.unsupportedFile',
      kind: 'warning',
    });
  });

  it('authorizes supported desktop Markdown file-open paths before opening them', async () => {
    const { props } = renderPicker();

    await act(async () => {
      await mocks.desktopOpenMarkdownFileCallback?.('/vault/guide.markdown');
    });

    expect(onDesktopOpenMarkdownFile).toHaveBeenCalledTimes(1);
    expect(mocks.authorizePath).toHaveBeenCalledWith('/vault/guide.markdown');
    expect(props.openMarkdownTarget).toHaveBeenCalledWith('/vault/guide.markdown');
    expect(messageDialog).not.toHaveBeenCalled();
  });

  it('does not open desktop Markdown files when authorization is unavailable', async () => {
    mocks.electronBridge = {};
    const { props } = renderPicker();

    await act(async () => {
      await mocks.desktopOpenMarkdownFileCallback?.('/vault/guide.md');
    });

    expect(props.openMarkdownTarget).not.toHaveBeenCalled();
    expect(messageDialog).toHaveBeenCalledWith('notes.openMarkdownFileFailed', {
      title: 'notes.openFailed',
      kind: 'error',
    });
  });

  it('does not open desktop Markdown paths that authorize as directories', async () => {
    mocks.authorizePath.mockResolvedValueOnce({
      name: 'guide.md',
      path: '/vault/guide.md',
      isDirectory: true,
      isFile: false,
    });
    const { props } = renderPicker();

    await act(async () => {
      await mocks.desktopOpenMarkdownFileCallback?.('/vault/guide.md');
    });

    expect(mocks.authorizePath).toHaveBeenCalledWith('/vault/guide.md');
    expect(props.openMarkdownTarget).not.toHaveBeenCalled();
    expect(messageDialog).toHaveBeenCalledWith('notes.openMarkdownFileFailed', {
      title: 'notes.openFailed',
      kind: 'error',
    });
  });
});
