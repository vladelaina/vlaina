import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTextEditorPopupElements,
  resizeTextEditorPopupTextareaToContent,
} from './textEditorPopupDom';

function stubPopupGeometry(args: {
  card: HTMLElement;
  textarea: HTMLTextAreaElement;
  cardTop: number;
  cardHeight: number;
  textareaHeight: number;
  scrollHeight: number;
}) {
  const { card, textarea, cardTop, cardHeight, textareaHeight, scrollHeight } = args;

  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 600,
    top: cardTop,
    bottom: cardTop + cardHeight,
    width: 600,
    height: cardHeight,
    x: 0,
    y: cardTop,
    toJSON: () => ({}),
  });
  vi.spyOn(textarea, 'getBoundingClientRect').mockReturnValue({
    left: 16,
    right: 584,
    top: cardTop + 16,
    bottom: cardTop + 16 + textareaHeight,
    width: 568,
    height: textareaHeight,
    x: 16,
    y: cardTop + 16,
    toJSON: () => ({}),
  });
  Object.defineProperty(textarea, 'scrollHeight', {
    value: scrollHeight,
    configurable: true,
  });
}

describe('textEditorPopupDom', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fits the textarea height to content when the popup can fit in the viewport', () => {
    vi.stubGlobal('innerHeight', 500);
    const { card, textarea } = createTextEditorPopupElements();
    stubPopupGeometry({
      card,
      textarea,
      cardTop: 100,
      cardHeight: 190,
      textareaHeight: 100,
      scrollHeight: 160,
    });

    resizeTextEditorPopupTextareaToContent({ card, textarea });

    expect(textarea.style.height).toBe('160px');
    expect(textarea.style.overflowY).toBe('hidden');
  });

  it('constrains the textarea and lets it scroll when content would exceed the viewport', () => {
    vi.stubGlobal('innerHeight', 500);
    const { card, textarea } = createTextEditorPopupElements();
    stubPopupGeometry({
      card,
      textarea,
      cardTop: 100,
      cardHeight: 190,
      textareaHeight: 100,
      scrollHeight: 400,
    });

    resizeTextEditorPopupTextareaToContent({ card, textarea });

    expect(textarea.style.height).toBe('298px');
    expect(textarea.style.overflowY).toBe('auto');
  });
});
