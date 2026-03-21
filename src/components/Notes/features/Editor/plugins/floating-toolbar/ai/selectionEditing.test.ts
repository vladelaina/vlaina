import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCurrentMarkdownParser = vi.fn();
const mockNormalizeSerializedMarkdownSelection = vi.fn((value: string) => value);
const mockSerializeSliceToText = vi.fn((_value?: unknown) => 'serialized');
const mockLogAiSelectionDebug = vi.fn();

vi.mock('../../../utils/editorViewRegistry', () => ({
  getCurrentMarkdownParser: () => mockGetCurrentMarkdownParser(),
}));

vi.mock('../../clipboard/markdownSerializationUtils', () => ({
  normalizeSerializedMarkdownSelection: (value: string) =>
    mockNormalizeSerializedMarkdownSelection(value),
}));

vi.mock('../../clipboard/serializer', () => ({
  serializeSliceToText: (value: unknown) => mockSerializeSliceToText(value),
}));

vi.mock('./debug', () => ({
  logAiSelectionDebug: (message: string, details?: Record<string, unknown>) =>
    mockLogAiSelectionDebug(message, details),
}));

import { applyAiSelectionSuggestion } from './selectionEditing';

function createView() {
  const tr = {
    insertText: vi.fn(),
    replaceRange: vi.fn(),
    scrollIntoView: vi.fn(),
  };

  tr.insertText.mockReturnValue(tr);
  tr.replaceRange.mockReturnValue(tr);
  tr.scrollIntoView.mockReturnValue(tr);

  return {
    state: {
      selection: { from: 10, to: 20 },
      doc: {
        content: { size: 200 },
        slice: vi.fn(() => ({
          openStart: 1,
          openEnd: 1,
        })),
      },
      tr,
    },
    dispatch: vi.fn(),
    focus: vi.fn(),
  };
}

describe('selectionEditing', () => {
  beforeEach(() => {
    mockGetCurrentMarkdownParser.mockReset();
    mockNormalizeSerializedMarkdownSelection.mockClear();
    mockSerializeSliceToText.mockClear();
    mockLogAiSelectionDebug.mockClear();
  });

  it('replaces the selection with parsed markdown when runtime is available', () => {
    const parser = vi.fn(() => ({
      content: { size: 2 },
    }));
    mockGetCurrentMarkdownParser.mockReturnValue(parser);

    const view = createView();

    applyAiSelectionSuggestion(view as never, {
      requestKey: 'request',
      from: 12,
      to: 24,
      instruction: 'Edit the selected text.',
      commandId: null,
      toneId: null,
      originalText: '# Title\n\nBody',
      suggestedText: '# Updated title\n\nUpdated body',
    });

    expect(parser).toHaveBeenCalledWith('# Updated title\n\nUpdated body');
    expect(view.state.tr.replaceRange).toHaveBeenCalledTimes(1);
    const [, , slice] = view.state.tr.replaceRange.mock.calls[0];
    expect(slice).toMatchObject({
      content: { size: 2 },
    });
    expect(view.state.tr.insertText).not.toHaveBeenCalled();
    expect(view.dispatch).toHaveBeenCalledTimes(1);
    expect(view.focus).toHaveBeenCalledTimes(1);
  });

  it('falls back to plain text insertion when markdown runtime is unavailable', () => {
    mockGetCurrentMarkdownParser.mockReturnValue(null);

    const view = createView();

    applyAiSelectionSuggestion(view as never, {
      requestKey: 'request',
      from: 8,
      to: 14,
      instruction: 'Edit the selected text.',
      commandId: null,
      toneId: null,
      originalText: 'Body',
      suggestedText: 'Updated body',
    });

    expect(view.state.tr.insertText).toHaveBeenCalledWith('Updated body', 8, 14);
    expect(view.state.tr.replaceRange).not.toHaveBeenCalled();
    expect(view.dispatch).toHaveBeenCalledTimes(1);
    expect(view.focus).toHaveBeenCalledTimes(1);
  });
});
