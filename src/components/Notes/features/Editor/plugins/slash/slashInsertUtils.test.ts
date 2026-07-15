import { describe, expect, it, vi } from 'vitest';
import { isEditorInsertionContextCurrent } from './slashInsertUtils';

describe('isEditorInsertionContextCurrent', () => {
  it('accepts only the original document and selection', () => {
    const sourceDoc = { eq: vi.fn((other: unknown) => other === sourceDoc) };
    const sourceSelection = { eq: vi.fn((other: unknown) => other === sourceSelection) };
    const view = {
      state: {
        doc: sourceDoc,
        selection: sourceSelection,
      },
    };

    expect(isEditorInsertionContextCurrent(
      view as never,
      sourceDoc as never,
      sourceSelection as never,
    )).toBe(true);

    view.state.selection = { eq: vi.fn(() => false) };
    expect(isEditorInsertionContextCurrent(
      view as never,
      sourceDoc as never,
      sourceSelection as never,
    )).toBe(false);
  });
});
