import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copySelectionToClipboard } from './clipboardCommands';
import { collapseSelectionAndHideFloatingToolbar } from '../clipboard/copyCleanup';
import { serializeSelectionToClipboardText } from '../clipboard/selectionSerialization';
import { writeTextToClipboard } from '../cursor/blockSelectionCommands';
import { getCurrentMarkdownSerializer } from '../../utils/editorViewRegistry';

vi.mock('../clipboard/copyCleanup', () => ({
  collapseSelectionAndHideFloatingToolbar: vi.fn(),
}));

vi.mock('../clipboard/selectionSerialization', () => ({
  serializeSelectionToClipboardText: vi.fn(),
}));

vi.mock('../cursor/blockSelectionCommands', () => ({
  writeTextToClipboard: vi.fn(),
}));

vi.mock('../../utils/editorViewRegistry', () => ({
  getCurrentMarkdownSerializer: vi.fn(),
}));

describe('floating toolbar clipboard commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the shared selection serializer with the current markdown serializer', async () => {
    const markdownSerializer = vi.fn();
    const selection = { from: 1, to: 7, eq: vi.fn((next) => next === selection) };
    const doc = { eq: vi.fn((next) => next === doc) };
    const state = { selection, doc };
    const view: any = { state };

    vi.mocked(getCurrentMarkdownSerializer).mockReturnValue(markdownSerializer);
    vi.mocked(serializeSelectionToClipboardText).mockReturnValue('Before\n\nAfter');
    vi.mocked(writeTextToClipboard).mockResolvedValue(true);

    const copied = await copySelectionToClipboard(view);

    expect(copied).toBe(true);
    expect(serializeSelectionToClipboardText).toHaveBeenCalledWith(state, markdownSerializer);
    expect(writeTextToClipboard).toHaveBeenCalledWith('Before\n\nAfter');
    expect(collapseSelectionAndHideFloatingToolbar).toHaveBeenCalledWith(view);
  });

  it('does not collapse a newer selection after async copy resolves', async () => {
    let resolveWrite: (value: boolean) => void = () => {
      throw new Error('clipboard write promise was not created');
    };
    const markdownSerializer = vi.fn();
    const selection = { from: 1, to: 7, eq: vi.fn((next) => next === selection) };
    const nextSelection = { from: 8, to: 12 };
    const doc = { eq: vi.fn((next) => next === doc) };
    const state = { selection, doc };
    const view: any = { state };

    vi.mocked(getCurrentMarkdownSerializer).mockReturnValue(markdownSerializer);
    vi.mocked(serializeSelectionToClipboardText).mockReturnValue('Before\n\nAfter');
    vi.mocked(writeTextToClipboard).mockImplementation(() => new Promise((resolve) => {
      resolveWrite = resolve;
    }));

    const copyPromise = copySelectionToClipboard(view);
    view.state = { selection: nextSelection, doc };
    resolveWrite(true);

    await expect(copyPromise).resolves.toBe(true);
    expect(collapseSelectionAndHideFloatingToolbar).not.toHaveBeenCalled();
  });
});
