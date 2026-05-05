import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCurrentMarkdownParser = vi.fn();
const mockNormalizeSerializedMarkdownSelection = vi.fn((value: string) => value);
const mockSerializeSliceToText = vi.fn((_value?: unknown) => 'serialized');
const mockAddToast = vi.fn();
const mockCollapseSelectionAfterToolbarApply = vi.fn();

vi.mock('../../../utils/editorViewRegistry', () => ({
  getCurrentMarkdownParser: () => mockGetCurrentMarkdownParser(),
}));

vi.mock('@/lib/notes/markdown/markdownSerializationUtils', () => ({
  normalizeSerializedMarkdownSelection: (value: string) =>
    mockNormalizeSerializedMarkdownSelection(value),
}));

vi.mock('../../clipboard/serializer', () => ({
  serializeSliceToText: (value: unknown) => mockSerializeSliceToText(value),
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: mockAddToast,
    }),
  },
}));

vi.mock('../selectionCollapse', () => ({
  collapseSelectionAfterToolbarApply: (...args: unknown[]) => mockCollapseSelectionAfterToolbarApply(...args),
}));

import {
  applyAiSelectionSuggestion,
  getSerializedSelectionContext,
} from './selectionEditing';

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
        paragraph: { inlineContent: true },
        resolve: vi.fn(() => ({
          depth: 1,
          parent: { inlineContent: false },
        })),
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
    mockAddToast.mockClear();
    mockCollapseSelectionAfterToolbarApply.mockClear();
  });

  it('replaces the selection with parsed markdown when runtime is available', () => {
    const parser = vi.fn(() => ({
      content: { size: 2 },
    }));
    mockGetCurrentMarkdownParser.mockReturnValue(parser);

    const view = createView();
    mockSerializeSliceToText.mockReturnValueOnce('# Title\n\nBody');

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
    expect(mockCollapseSelectionAfterToolbarApply).toHaveBeenCalledWith(view);
  });

  it('falls back to plain text insertion when markdown runtime is unavailable', () => {
    mockGetCurrentMarkdownParser.mockReturnValue(null);

    const view = createView();
    mockSerializeSliceToText.mockReturnValueOnce('Body');

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
    expect(mockCollapseSelectionAfterToolbarApply).toHaveBeenCalledWith(view);
  });

  it('uses parsed inline content when replacing text inside one paragraph', () => {
    const inlineContent = { size: 3 };
    const paragraph = {
      isTextblock: true,
      content: inlineContent,
    };
    const parser = vi.fn(() => ({
      childCount: 1,
      child: vi.fn(() => paragraph),
      content: { size: 10 },
    }));
    mockGetCurrentMarkdownParser.mockReturnValue(parser);

    const view = createView();
    mockSerializeSliceToText.mockReturnValueOnce('(1)');
    view.state.doc.resolve.mockReturnValue({
      depth: 1,
      parent: view.state.doc.paragraph,
    });

    applyAiSelectionSuggestion(view as never, {
      requestKey: 'request',
      from: 12,
      to: 15,
      instruction: 'Edit the selected text.',
      commandId: null,
      toneId: null,
      originalText: '(1)',
      suggestedText: '(2)',
    });

    expect(parser).toHaveBeenCalledWith('(2)');
    expect(view.state.tr.replaceRange).toHaveBeenCalledTimes(1);
    const [, , slice] = view.state.tr.replaceRange.mock.calls[0];
    expect(slice).toMatchObject({
      content: inlineContent,
      openStart: 0,
      openEnd: 0,
    });
    expect(view.state.tr.insertText).not.toHaveBeenCalled();
    expect(view.dispatch).toHaveBeenCalledTimes(1);
  });

  it('keeps block content when the replacement range spans different parents', () => {
    const inlineContent = { size: 3 };
    const parsedDocContent = { size: 10 };
    const paragraph = {
      isTextblock: true,
      content: inlineContent,
    };
    const parser = vi.fn(() => ({
      childCount: 1,
      child: vi.fn(() => paragraph),
      content: parsedDocContent,
    }));
    mockGetCurrentMarkdownParser.mockReturnValue(parser);

    const view = createView();
    mockSerializeSliceToText.mockReturnValueOnce('First\n\nSecond');
    view.state.doc.resolve
      .mockReturnValueOnce({
        depth: 1,
        parent: { inlineContent: true },
      })
      .mockReturnValueOnce({
        depth: 1,
        parent: { inlineContent: true },
      });

    applyAiSelectionSuggestion(view as never, {
      requestKey: 'request',
      from: 12,
      to: 24,
      instruction: 'Edit the selected text.',
      commandId: null,
      toneId: null,
      originalText: 'First\n\nSecond',
      suggestedText: 'Updated',
    });

    const [, , slice] = view.state.tr.replaceRange.mock.calls[0];
    expect(slice).toMatchObject({
      content: parsedDocContent,
      openStart: 1,
      openEnd: 1,
    });
  });

  it('serializes bounded context around the selected range', () => {
    const view = createView();
    mockSerializeSliceToText
      .mockReturnValueOnce(`${'a'.repeat(700)} before`)
      .mockReturnValueOnce(`after ${'b'.repeat(700)}`);

    const context = getSerializedSelectionContext(view as never, 100, 103, '(1)');

    expect(view.state.doc.slice).toHaveBeenNthCalledWith(1, 0, 100);
    expect(view.state.doc.slice).toHaveBeenNthCalledWith(2, 103, 200);
    expect(context.beforeContext.length).toBeLessThanOrEqual(600);
    expect(context.beforeContext).toContain('before');
    expect(context.afterContext.length).toBeLessThanOrEqual(600);
    expect(context.afterContext).toContain('after');
  });

  it('keeps no-space context when cropping long text', () => {
    const view = createView();
    mockSerializeSliceToText
      .mockReturnValueOnce('x'.repeat(700))
      .mockReturnValueOnce('y'.repeat(700));

    const context = getSerializedSelectionContext(view as never, 100, 103, '(1)');

    expect(context.beforeContext).toBe('x'.repeat(600));
    expect(context.afterContext).toBe('y'.repeat(600));
  });

  it('does not apply stale suggestions after the original range changed', () => {
    mockGetCurrentMarkdownParser.mockReturnValue(vi.fn());
    mockSerializeSliceToText.mockReturnValueOnce('Changed text');
    const view = createView();

    const applied = applyAiSelectionSuggestion(view as never, {
      requestKey: 'request',
      from: 8,
      to: 14,
      instruction: 'Edit the selected text.',
      commandId: null,
      toneId: null,
      originalText: 'Original text',
      suggestedText: 'Updated text',
    });

    expect(applied).toBe(false);
    expect(view.state.tr.replaceRange).not.toHaveBeenCalled();
    expect(view.state.tr.insertText).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
    expect(mockAddToast).toHaveBeenCalledWith(
      'The selected text changed before the AI result was applied.',
      'warning'
    );
  });
});
