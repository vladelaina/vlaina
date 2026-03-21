import { describe, expect, it } from 'vitest';
import {
  createMathEditorElements,
  renderMathEditorPreview,
} from './mathEditorPopupDom';

describe('mathEditorPopupDom', () => {
  it('creates a split math editor card with an input, preview, and actions', () => {
    const { card, content, textarea, preview, actions, cancelButton, saveButton } =
      createMathEditorElements();

    expect(card.className).toBe('math-editor-card');
    expect(content.className).toBe('math-editor-content');
    expect(textarea.className).toBe('math-editor-textarea');
    expect(preview.className).toBe('math-editor-preview');
    expect(actions.className).toBe('math-editor-footer');
    expect(cancelButton.getAttribute('aria-label')).toBe('Cancel');
    expect(saveButton.getAttribute('aria-label')).toBe('Apply');
    expect(cancelButton.querySelector('svg')).not.toBeNull();
    expect(saveButton.querySelector('svg')).not.toBeNull();
  });

  it('renders preview content and errors in the preview half', () => {
    const { preview } = createMathEditorElements();

    renderMathEditorPreview({
      preview,
      html: '<span>x+1</span>',
      error: 'Unexpected EOF',
      errorDetails: {
        rawMessage: 'KaTeX parse error: Unexpected EOF',
        summary: 'Unexpected EOF',
        position: 6,
        line: 2,
        column: 6,
        locationLabel: 'Line 2, column 6',
        context: '2 | x+1+\\fra',
        pointer: '         ^',
      },
      displayMode: false,
    });

    expect(preview.querySelector('.math-editor-preview-content')?.textContent).toBe('x+1');
    expect(preview.querySelector('.math-editor-error-summary')?.textContent).toBe('Unexpected EOF');
    expect(preview.querySelector('.math-editor-error-location')?.textContent).toBe('Line 2, column 6');
    expect(preview.querySelector('.math-editor-error-context')?.textContent).toContain('^');
    expect(preview.querySelector('.math-editor-error-raw')?.textContent).toContain('KaTeX parse error');
  });

  it('marks display-mode preview content when rendering block formulas', () => {
    const { preview } = createMathEditorElements();

    renderMathEditorPreview({
      preview,
      html: '<span>x^2</span>',
      error: null,
      errorDetails: null,
      displayMode: true,
    });

    expect(preview.querySelector('.math-editor-preview-content')?.classList.contains('display-mode')).toBe(true);
  });
});
