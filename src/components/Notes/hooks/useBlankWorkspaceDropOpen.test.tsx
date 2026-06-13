import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBlankWorkspaceDropOpen } from './useBlankWorkspaceDropOpen';

const mocks = vi.hoisted(() => ({
  messageDialog: vi.fn(),
}));

vi.mock('@/lib/storage/dialog', () => ({
  messageDialog: mocks.messageDialog,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => null,
}));

vi.mock('../features/FileTree/hooks/externalDragPreview', () => ({
  createExternalDragPreview: vi.fn(() => ({
    updatePaths: vi.fn(),
    updatePosition: vi.fn(),
    dispose: vi.fn(),
  })),
}));

function createDropEvent(dataTransfer: { files?: File[]; types?: string[] }) {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files: dataTransfer.files ?? [],
      types: dataTransfer.types ?? [],
    },
    configurable: true,
  });
  return event;
}

describe('useBlankWorkspaceDropOpen', () => {
  const originalElementsFromPoint = document.elementsFromPoint;

  beforeEach(() => {
    vi.clearAllMocks();
    document.elementsFromPoint = vi.fn(() => []);
    mocks.messageDialog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.elementsFromPoint = originalElementsFromPoint;
  });

  it('isolates rejected empty-path drop dialogs', async () => {
    mocks.messageDialog.mockRejectedValueOnce(new Error('dialog failed'));
    const openMarkdownTarget = vi.fn(async () => undefined);
    const openVault = vi.fn(async () => true);

    renderHook(() => useBlankWorkspaceDropOpen({
      enabled: true,
      openMarkdownTarget,
      openVault,
    }));

    await act(async () => {
      window.dispatchEvent(createDropEvent({ types: ['Files'] }));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mocks.messageDialog).toHaveBeenCalledWith('notes.droppedPathReadFailed', {
        title: 'notes.openFailed',
        kind: 'error',
      });
    });
    expect(openMarkdownTarget).not.toHaveBeenCalled();
    expect(openVault).not.toHaveBeenCalled();
  });
});
