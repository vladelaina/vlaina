import { describe, expect, it, vi } from 'vitest';
import { CODE_BLOCK_SELECTION_SYNC_EVENT } from '../code/codeBlockSelectionSync';
import { collapseSelectionAndHideFloatingToolbar } from './copyCleanup';

describe('copyCleanup', () => {
  it('notifies embedded CodeMirror node views after collapsing a copied selection', () => {
    const ownerDocument = document.implementation.createHTMLDocument('copy-cleanup');
    const dom = ownerDocument.createElement('div');
    const dispatchEventSpy = vi.spyOn(ownerDocument, 'dispatchEvent');
    const transaction = {
      setSelection: vi.fn(() => transaction),
      setMeta: vi.fn(() => transaction),
    };
    const view = {
      dom,
      state: {
        selection: {
          empty: false,
          to: 4,
        },
        doc: {
          content: { size: 10 },
          resolve: vi.fn(() => ({ pos: 4 })),
        },
        tr: transaction,
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    collapseSelectionAndHideFloatingToolbar(view as never);

    expect(view.dispatch).toHaveBeenCalledWith(transaction);
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: CODE_BLOCK_SELECTION_SYNC_EVENT,
    }));
    expect(view.focus).toHaveBeenCalledTimes(1);
  });
});
