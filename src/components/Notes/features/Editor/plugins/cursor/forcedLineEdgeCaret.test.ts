import type { EditorView } from '@milkdown/kit/prose/view';
import { describe, expect, it, vi } from 'vitest';
import {
  clearTextBlockCaretOverlay,
  MAX_FORCED_LINE_EDGE_TEXT_CHARS,
  MAX_TEXTBLOCK_CARET_OVERLAY_SCAN_ELEMENTS,
  resolveVisualLineEdgePos,
} from './forcedLineEdgeCaret';

describe('forcedLineEdgeCaret', () => {
  it('skips visual line edge measurement for oversized text blocks', () => {
    const view = {
      state: {
        doc: {
          nodeAt: vi.fn(() => ({
            nodeSize: MAX_FORCED_LINE_EDGE_TEXT_CHARS + 3,
            get textContent() {
              throw new Error('block textContent should not be read');
            },
          })),
        },
      },
      dom: {
        contains: vi.fn(),
        ownerDocument: {
          createTreeWalker: vi.fn(),
        },
      },
      nodeDOM: vi.fn(),
      domAtPos: vi.fn(),
    } as unknown as EditorView;

    expect(resolveVisualLineEdgePos(
      view,
      { blockFrom: 0, targetPos: 1, bias: -1 },
      200,
      20,
    )).toBeNull();
    expect(view.state.doc.nodeAt).toHaveBeenCalledWith(0);
    expect((view.dom.ownerDocument as Document).createTreeWalker).not.toHaveBeenCalled();
  });

  it('preserves the exact hard-break line target while refining its visual caret', () => {
    const editorRoot = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Final line';
    editorRoot.appendChild(paragraph);
    document.body.appendChild(editorRoot);
    const createRangeSpy = vi.spyOn(document, 'createRange').mockImplementation(() => ({
      selectNodeContents: vi.fn(),
      getClientRects: vi.fn().mockReturnValue([{
        left: 388,
        top: 792,
        right: 562,
        bottom: 827,
        width: 174,
        height: 35,
      }]),
      detach: vi.fn(),
    }) as any);
    const view = {
      state: {
        doc: {
          content: { size: 120 },
          nodeAt: vi.fn(() => ({ nodeSize: 6 })),
        },
      },
      dom: editorRoot,
      nodeDOM: vi.fn(() => paragraph),
      domAtPos: vi.fn(() => ({ node: paragraph.firstChild, offset: 0 })),
    } as unknown as EditorView;

    expect(resolveVisualLineEdgePos(
      view,
      { blockFrom: 106, targetPos: 112, bias: -1 },
      643,
      817,
    )?.pos).toBe(112);

    createRangeSpy.mockRestore();
    editorRoot.remove();
  });

  it('clears text block caret overlays without materializing selector results', () => {
    const editorRoot = document.createElement('div');
    editorRoot.classList.add('editor-textblock-caret-overlay-active');
    const overlay = document.createElement('div');
    overlay.className = 'editor-textblock-caret-overlay';
    document.body.append(editorRoot, overlay);
    const querySelectorAllSpy = vi.spyOn(document, 'querySelectorAll');
    const arrayFromSpy = vi.spyOn(Array, 'from').mockImplementation(() => {
      throw new Error('Array.from should not be used');
    });

    try {
      expect(clearTextBlockCaretOverlay({ dom: editorRoot } as unknown as EditorView)).toBe(1);
      expect(document.querySelector('.editor-textblock-caret-overlay')).toBeNull();
      expect(editorRoot.classList.contains('editor-textblock-caret-overlay-active')).toBe(false);
      expect(querySelectorAllSpy).not.toHaveBeenCalled();
    } finally {
      arrayFromSpy.mockRestore();
      querySelectorAllSpy.mockRestore();
      editorRoot.remove();
    }
  });

  it('caps text block caret overlay cleanup scans', () => {
    document.body.innerHTML = '';
    const editorRoot = document.createElement('div');
    document.body.appendChild(editorRoot);
    for (let index = 0; index < MAX_TEXTBLOCK_CARET_OVERLAY_SCAN_ELEMENTS + 1; index += 1) {
      document.body.appendChild(document.createElement('span'));
    }
    const lateOverlay = document.createElement('div');
    lateOverlay.className = 'editor-textblock-caret-overlay';
    document.body.appendChild(lateOverlay);

    expect(clearTextBlockCaretOverlay({ dom: editorRoot } as unknown as EditorView)).toBe(0);
    expect(lateOverlay.isConnected).toBe(true);
  });
});
