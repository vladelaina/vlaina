import { describe, expect, it } from 'vitest';
import { renderMathEditorLivePreview } from './mathEditorLivePreview';

describe('mathEditorLivePreview', () => {
  it('updates the existing math anchor dom without requiring a document transaction', () => {
    const anchor = document.createElement('span');
    anchor.setAttribute('data-type', 'math-inline');
    anchor.dataset.latex = 'x';
    anchor.innerHTML = 'old';

    expect(renderMathEditorLivePreview({
      anchor,
      latex: 'x+1',
      displayMode: false,
    })).toBe(true);

    expect(anchor.dataset.latex).toBe('x+1');
    expect(anchor.innerHTML).not.toBe('old');
    expect(anchor.textContent).toContain('x');
  });

  it('returns false when no anchor is available', () => {
    expect(renderMathEditorLivePreview({
      anchor: null,
      latex: 'x',
      displayMode: false,
    })).toBe(false);
  });
});
