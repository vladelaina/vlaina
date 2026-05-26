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
    const state = { selection: { from: 1, to: 7 } };
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
});
