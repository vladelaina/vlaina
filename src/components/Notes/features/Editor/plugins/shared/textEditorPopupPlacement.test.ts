import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTextEditorPopupPlacement } from './textEditorPopupPlacement';

function stubRect(
  element: HTMLElement,
  rect: { left: number; top?: number; width: number; height?: number }
) {
  const top = rect.top ?? 0;
  const height = rect.height ?? 100;
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(rect.left, top, rect.width, height)
  );
}

describe('textEditorPopupPlacement', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the readable markdown root width when imported theme padding narrows #write', () => {
    const contentRoot = document.createElement('section');
    contentRoot.dataset.noteContentRoot = 'true';
    contentRoot.style.paddingLeft = '96px';
    contentRoot.style.paddingRight = '96px';

    const editor = document.createElement('div');
    editor.id = 'write';
    editor.style.paddingLeft = '40px';
    editor.style.paddingRight = '20px';

    contentRoot.append(editor);
    document.body.append(contentRoot);
    stubRect(contentRoot, { left: 100, width: 900 });
    stubRect(editor, { left: 196, width: 708 });

    const placement = resolveTextEditorPopupPlacement({
      editorView: { dom: editor },
      positionRoot: contentRoot,
      viewportPosition: { x: 220, y: 300 },
    });

    expect(placement).toEqual({
      x: 136,
      y: 300,
      width: 648,
    });
  });

  it('falls back to the note content root when the markdown root has no measurable width', () => {
    const contentRoot = document.createElement('section');
    contentRoot.dataset.noteContentRoot = 'true';
    contentRoot.style.paddingLeft = '96px';
    contentRoot.style.paddingRight = '96px';

    const editor = document.createElement('div');

    contentRoot.append(editor);
    document.body.append(contentRoot);
    stubRect(contentRoot, { left: 100, width: 900 });
    stubRect(editor, { left: 196, width: 0 });

    const placement = resolveTextEditorPopupPlacement({
      editorView: { dom: editor },
      positionRoot: contentRoot,
      viewportPosition: { x: 220, y: 300 },
    });

    expect(placement).toEqual({
      x: 96,
      y: 300,
      width: 708,
    });
  });

  it('keeps fixed popups aligned to the readable editor bounds without a position root', () => {
    vi.stubGlobal('innerWidth', 1200);
    const editor = document.createElement('div');
    editor.style.paddingLeft = '50px';
    editor.style.paddingRight = '30px';
    document.body.append(editor);
    stubRect(editor, { left: 200, width: 800 });

    const placement = resolveTextEditorPopupPlacement({
      editorView: { dom: editor },
      positionRoot: null,
      viewportPosition: { x: 220, y: 300 },
    });

    expect(placement).toEqual({
      x: 250,
      y: 300,
      width: 720,
    });
  });
});
