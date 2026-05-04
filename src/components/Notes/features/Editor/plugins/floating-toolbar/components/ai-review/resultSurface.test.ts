import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderResultSurfaceAppliedPreview } from './resultSurface';

const textLayoutMocks = vi.hoisted(() => ({
  measureTextBlockHeight: vi.fn(() => 123),
  resolveElementTextLayoutMetrics: vi.fn(() => ({
    font: '400 13.5px Inter',
    fontSize: 13.5,
    lineHeight: 22,
    paddingBlock: 0,
  })),
}));

const selectionEditingMocks = vi.hoisted(() => ({
  createAppliedAiSelectionPreviewState: vi.fn(() => ({ doc: {}, schema: {} })),
}));

const appliedPreviewMocks = vi.hoisted(() => ({
  renderAppliedPreviewDocument: vi.fn((state, sourceDom, ownerDocument) => {
    void state;
    void sourceDom;
    const element = ownerDocument.createElement('div');
    element.className = 'applied-preview';
    return element;
  }),
}));

vi.mock('@/lib/text-layout', () => ({
  measureTextBlockHeight: textLayoutMocks.measureTextBlockHeight,
  resolveElementTextLayoutMetrics: textLayoutMocks.resolveElementTextLayoutMetrics,
}));

vi.mock('../../ai/selectionEditing', () => ({
  createAppliedAiSelectionPreviewState: selectionEditingMocks.createAppliedAiSelectionPreviewState,
}));

vi.mock('../../appliedPreviewState', () => ({
  renderAppliedPreviewDocument: appliedPreviewMocks.renderAppliedPreviewDocument,
}));

function createSuggestion() {
  return {
    requestKey: 'review-1',
    instruction: 'Rewrite',
    commandId: 'rewrite',
    toneId: null,
    from: 1,
    to: 4,
    originalText: 'old',
    suggestedText: 'first line\n\nsecond line',
  };
}

describe('AI review result surface', () => {
  beforeEach(() => {
    textLayoutMocks.measureTextBlockHeight.mockReset();
    textLayoutMocks.measureTextBlockHeight.mockReturnValue(123);
    textLayoutMocks.resolveElementTextLayoutMetrics.mockClear();
    selectionEditingMocks.createAppliedAiSelectionPreviewState.mockReset();
    selectionEditingMocks.createAppliedAiSelectionPreviewState.mockReturnValue({ doc: {}, schema: {} });
    appliedPreviewMocks.renderAppliedPreviewDocument.mockClear();
  });

  it('reserves result height with Pretext before rendering the applied preview document', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 280 });
    element.style.paddingLeft = '8px';
    element.style.paddingRight = '4px';
    const view = { dom: document.createElement('div') } as never;

    renderResultSurfaceAppliedPreview(element, view, createSuggestion());

    expect(textLayoutMocks.resolveElementTextLayoutMetrics).toHaveBeenCalledWith(element);
    expect(textLayoutMocks.measureTextBlockHeight).toHaveBeenCalledWith(
      'first line\n\nsecond line',
      268,
      expect.objectContaining({
        font: '400 13.5px Inter',
        lineHeight: 22,
        minHeight: 48,
        maxHeight: 320,
        prepareOptions: { whiteSpace: 'pre-wrap' },
      })
    );
    expect(element.style.getPropertyValue('--ai-review-result-predicted-height')).toBe('123px');
    expect(element.querySelector('.applied-preview')).toBeInstanceOf(HTMLElement);
  });

  it('keeps rendering the applied preview if Pretext height prediction fails', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 280 });
    textLayoutMocks.measureTextBlockHeight.mockImplementationOnce(() => {
      throw new Error('measurement unavailable');
    });

    renderResultSurfaceAppliedPreview(element, { dom: document.createElement('div') } as never, createSuggestion());

    expect(element.style.getPropertyValue('--ai-review-result-predicted-height')).toBe('');
    expect(element.querySelector('.applied-preview')).toBeInstanceOf(HTMLElement);
  });

  it('clears the reserved result height when the applied preview cannot be created', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 280 });
    element.style.setProperty('--ai-review-result-predicted-height', '120px');
    selectionEditingMocks.createAppliedAiSelectionPreviewState.mockReturnValueOnce(null as never);

    renderResultSurfaceAppliedPreview(element, { dom: document.createElement('div') } as never, createSuggestion());

    expect(textLayoutMocks.measureTextBlockHeight).not.toHaveBeenCalled();
    expect(element.style.getPropertyValue('--ai-review-result-predicted-height')).toBe('');
    expect(element.querySelector('.ai-review-error')).toBeInstanceOf(HTMLElement);
  });
});
