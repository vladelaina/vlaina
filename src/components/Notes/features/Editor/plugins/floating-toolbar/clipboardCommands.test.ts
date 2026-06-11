import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copySelectionToClipboard } from './clipboardCommands';
import { collapseSelectionAndHideFloatingToolbar } from '../clipboard/copyCleanup';
import { serializeSelectionToClipboardText } from '../clipboard/selectionSerialization';
import { writeTextToClipboard } from '../cursor/blockSelectionCommands';
import { serializeSelectedBlocksToText } from '../cursor/blockSelectionSerializer';
import { getCurrentMarkdownSerializer } from '../../utils/editorViewRegistry';

const blockSelectionMocks = vi.hoisted(() => ({
  clearBlockSelection: vi.fn(),
  selectedBlocks: [] as Array<{ from: number; to: number }>,
  serializeSelectedBlocksToText: vi.fn(),
}));

vi.mock('../clipboard/copyCleanup', () => ({
  collapseSelectionAndHideFloatingToolbar: vi.fn(),
}));

vi.mock('../clipboard/selectionSerialization', () => ({
  serializeSelectionToClipboardText: vi.fn(),
}));

vi.mock('../cursor/blockSelectionCommands', () => ({
  writeTextToClipboard: vi.fn(),
}));

vi.mock('../cursor/blockSelectionPluginState', () => ({
  clearBlockSelection: blockSelectionMocks.clearBlockSelection,
  getBlockSelectionPluginState: vi.fn(() => ({
    selectedBlocks: blockSelectionMocks.selectedBlocks,
  })),
}));

vi.mock('../cursor/blockSelectionSerializer', () => ({
  serializeSelectedBlocksToText: blockSelectionMocks.serializeSelectedBlocksToText,
}));

vi.mock('../../utils/editorViewRegistry', () => ({
  getCurrentMarkdownSerializer: vi.fn(),
}));

describe('floating toolbar clipboard commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    blockSelectionMocks.selectedBlocks = [];
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

  it('prefers the visible block selection over a stale text selection', async () => {
    const markdownSerializer = vi.fn();
    const selection = { empty: false, from: 1, to: 7, eq: vi.fn((next) => next === selection) };
    const doc = { eq: vi.fn((next) => next === doc) };
    const state = { selection, doc };
    const view: any = { state };
    blockSelectionMocks.selectedBlocks = [{ from: 20, to: 40 }];

    vi.mocked(getCurrentMarkdownSerializer).mockReturnValue(markdownSerializer);
    vi.mocked(serializeSelectionToClipboardText).mockReturnValue('Current text');
    vi.mocked(serializeSelectedBlocksToText).mockReturnValue('Stale block');
    vi.mocked(writeTextToClipboard).mockResolvedValue(true);

    const copied = await copySelectionToClipboard(view);

    expect(copied).toBe(true);
    expect(serializeSelectedBlocksToText).toHaveBeenCalledWith(
      state,
      blockSelectionMocks.selectedBlocks,
      { markdownSerializer },
    );
    expect(serializeSelectionToClipboardText).not.toHaveBeenCalled();
    expect(writeTextToClipboard).toHaveBeenCalledWith('Stale block');
  });

  it('falls back to plain selected text when selection serialization is empty', async () => {
    const markdownSerializer = vi.fn();
    const selection = { empty: false, from: 3, to: 15, eq: vi.fn((next) => next === selection) };
    const doc = {
      eq: vi.fn((next) => next === doc),
      textBetween: vi.fn(() => 'Plain target'),
    };
    const state = { selection, doc };
    const view: any = { state };

    vi.mocked(getCurrentMarkdownSerializer).mockReturnValue(markdownSerializer);
    vi.mocked(serializeSelectionToClipboardText).mockReturnValue('');
    vi.mocked(writeTextToClipboard).mockResolvedValue(true);

    const copied = await copySelectionToClipboard(view);

    expect(copied).toBe(true);
    expect(doc.textBetween).toHaveBeenCalledWith(3, 15, '\n');
    expect(writeTextToClipboard).toHaveBeenCalledWith('Plain target');
  });

  it('copies selected blocks when there is no active text selection', async () => {
    const markdownSerializer = vi.fn();
    const selection = { empty: true, from: 1, to: 1, eq: vi.fn((next) => next === selection) };
    const doc = { eq: vi.fn((next) => next === doc) };
    const state = { selection, doc };
    const view: any = { state };
    const selectedBlocks = [{ from: 20, to: 40 }];
    blockSelectionMocks.selectedBlocks = selectedBlocks;

    vi.mocked(getCurrentMarkdownSerializer).mockReturnValue(markdownSerializer);
    vi.mocked(serializeSelectedBlocksToText).mockReturnValue('Selected block');
    vi.mocked(writeTextToClipboard).mockResolvedValue(true);

    const copied = await copySelectionToClipboard(view);

    expect(copied).toBe(true);
    expect(serializeSelectedBlocksToText).toHaveBeenCalledWith(
      state,
      selectedBlocks,
      { markdownSerializer },
    );
    expect(serializeSelectionToClipboardText).not.toHaveBeenCalled();
    expect(writeTextToClipboard).toHaveBeenCalledWith('Selected block');
    expect(blockSelectionMocks.clearBlockSelection).toHaveBeenCalledWith(view);
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
