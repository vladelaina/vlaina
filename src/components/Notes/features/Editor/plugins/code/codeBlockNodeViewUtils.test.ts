import { TextSelection } from '@milkdown/kit/prose/state';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyCodeBlockCollapsedState,
  forwardCodeBlockUpdate,
} from './codeBlockNodeViewUtils';

describe('codeBlockNodeViewUtils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('skips redundant selection-only updates', () => {
    const view = {
      state: {
        selection: { from: 12, to: 14 },
        tr: {},
        doc: {
          nodeAt: vi.fn(() => ({
            textContent: 'abcd',
          })),
        },
      },
    };
    const update = {
      docChanged: false,
      state: {
        doc: {
          toString: () => 'abcd',
        },
        selection: {
          main: { from: 1, to: 3 },
        },
      },
    };

    expect(forwardCodeBlockUpdate(update as never, view as never, () => 10)).toBeNull();
  });

  it('forwards document changes and remaps selection back into ProseMirror', () => {
    const selectionCreateSpy = vi
      .spyOn(TextSelection, 'create')
      .mockReturnValue({ type: 'selection' } as never);
    const tr = {
      replaceWith: vi.fn(() => tr),
      delete: vi.fn(() => tr),
      setSelection: vi.fn(() => tr),
      doc: {
        nodeAt: vi.fn(() => ({
          textContent: 'anext',
        })),
      },
      mapping: {
        map: vi.fn((value: number) => value),
      },
    };
    const view = {
      state: {
        selection: { from: 0, to: 0 },
        tr,
        doc: {
          nodeAt: vi.fn(() => ({
            textContent: 'abc',
          })),
        },
        schema: {
          text: vi.fn((value: string) => ({ value })),
        },
      },
    };
    const update = {
      docChanged: true,
      state: {
        doc: {
          toString: () => 'abc',
        },
        selection: {
          main: { from: 1, to: 4 },
        },
      },
      changes: {
        iterChanges: (callback: (...args: unknown[]) => void) => {
          callback(1, 3, 1, 4, { length: 1, toString: () => 'next' });
        },
      },
    };

    expect(forwardCodeBlockUpdate(update as never, view as never, () => 10)).toBe(tr);
    expect(view.state.schema.text).toHaveBeenCalledWith('next');
    expect(tr.replaceWith).toHaveBeenCalledWith(12, 14, { value: 'next' });
    expect(selectionCreateSpy).toHaveBeenCalledWith(tr.doc, 12, 15);
    expect(tr.setSelection).toHaveBeenCalledWith({ type: 'selection' });
  });

  it('skips selection-only updates when CRLF-backed offsets already match the ProseMirror selection', () => {
    const view = {
      state: {
        selection: { from: 13, to: 13 },
        tr: {},
        doc: {
          nodeAt: vi.fn(() => ({
            textContent: 'ab\r\ncd',
          })),
        },
      },
    };
    const update = {
      docChanged: false,
      state: {
        doc: {
          toString: () => 'ab\ncd',
        },
        selection: {
          main: { from: 2, to: 2 },
        },
      },
    };

    expect(forwardCodeBlockUpdate(update as never, view as never, () => 10)).toBeNull();
  });

  it('maps CodeMirror offsets onto raw CRLF-backed ProseMirror content', () => {
    const selectionCreateSpy = vi
      .spyOn(TextSelection, 'create')
      .mockReturnValue({ type: 'selection' } as never);
    const tr = {
      replaceWith: vi.fn(() => tr),
      delete: vi.fn(() => tr),
      setSelection: vi.fn(() => tr),
      doc: {
        nodeAt: vi.fn(() => ({
          textContent: 'ab\r\ncd',
        })),
      },
      mapping: {
        map: vi.fn((value: number) => value),
      },
    };
    const view = {
      state: {
        selection: { from: 12, to: 12 },
        tr,
        doc: {
          nodeAt: vi.fn(() => ({
            textContent: 'ab\r\ncd',
          })),
        },
        schema: {
          text: vi.fn((value: string) => ({ value })),
        },
      },
    };
    const update = {
      docChanged: true,
      state: {
        doc: {
          toString: () => 'ab\ncd',
        },
        selection: {
          main: { from: 2, to: 2 },
        },
      },
      changes: {
        iterChanges: (callback: (...args: unknown[]) => void) => {
          callback(1, 2, 1, 1, { length: 0, toString: () => '' });
        },
      },
    };

    expect(forwardCodeBlockUpdate(update as never, view as never, () => 10)).toBe(tr);
    expect(tr.delete).toHaveBeenCalledWith(12, 13);
    expect(selectionCreateSpy).toHaveBeenCalledWith(tr.doc, 13, 13);
    expect(tr.setSelection).toHaveBeenCalledWith({ type: 'selection' });
  });

  it('maps replacements spanning across CRLF boundaries back into raw document offsets', () => {
    const selectionCreateSpy = vi
      .spyOn(TextSelection, 'create')
      .mockReturnValue({ type: 'selection' } as never);
    const tr = {
      replaceWith: vi.fn(() => tr),
      delete: vi.fn(() => tr),
      setSelection: vi.fn(() => tr),
      doc: {
        nodeAt: vi.fn(() => ({
          textContent: 'ab\r\nXYZ',
        })),
      },
      mapping: {
        map: vi.fn((value: number) => value),
      },
    };
    const view = {
      state: {
        selection: { from: 11, to: 11 },
        tr,
        doc: {
          nodeAt: vi.fn(() => ({
            textContent: 'ab\r\ncd',
          })),
        },
        schema: {
          text: vi.fn((value: string) => ({ value })),
        },
      },
    };
    const update = {
      docChanged: true,
      state: {
        doc: {
          toString: () => 'ab\nXYZ',
        },
        selection: {
          main: { from: 6, to: 6 },
        },
      },
      changes: {
        iterChanges: (callback: (...args: unknown[]) => void) => {
          callback(3, 5, 3, 6, { length: 1, toString: () => 'XYZ' });
        },
      },
    };

    expect(forwardCodeBlockUpdate(update as never, view as never, () => 10)).toBe(tr);
    expect(view.state.schema.text).toHaveBeenCalledWith('XYZ');
    expect(tr.replaceWith).toHaveBeenCalledWith(15, 17, { value: 'XYZ' });
    expect(selectionCreateSpy).toHaveBeenCalledWith(tr.doc, 18, 18);
  });

  it('applies collapsed accessibility state to the editable region', () => {
    const dom = document.createElement('div');
    const editorDOM = document.createElement('div');

    applyCodeBlockCollapsedState(dom, editorDOM, true);
    expect(dom.getAttribute('data-collapsed')).toBe('true');
    expect(editorDOM.style.display).toBe('none');
    expect(editorDOM.getAttribute('aria-hidden')).toBe('true');
    expect(editorDOM.tabIndex).toBe(-1);

    applyCodeBlockCollapsedState(dom, editorDOM, false);
    expect(dom.getAttribute('data-collapsed')).toBe('false');
    expect(editorDOM.style.display).toBe('');
    expect(editorDOM.hasAttribute('aria-hidden')).toBe(false);
    expect(editorDOM.hasAttribute('tabindex')).toBe(false);
  });
});
