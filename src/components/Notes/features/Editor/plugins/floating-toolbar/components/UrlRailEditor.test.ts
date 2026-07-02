import { describe, expect, it, vi } from 'vitest';
import { renderUrlRailEditor } from './UrlRailEditor';

describe('renderUrlRailEditor', () => {
  it('does not submit or cancel while an IME composition keydown is active', () => {
    const container = document.createElement('div');
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const input = renderUrlRailEditor(container, {
      value: 'https://example.test',
      onSubmit,
      onCancel,
    });

    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      isComposing: true,
    }));
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      isComposing: true,
    }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does not submit while composition is active even if keydown is not marked composing', () => {
    const container = document.createElement('div');
    const onSubmit = vi.fn();
    const input = renderUrlRailEditor(container, {
      value: 'https://example.test',
      onSubmit,
      onCancel: vi.fn(),
    });

    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));

    expect(onSubmit).not.toHaveBeenCalled();

    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));

    expect(onSubmit).toHaveBeenCalledWith('https://example.test');
  });

  it('still submits ordinary Enter after composition has ended', () => {
    const container = document.createElement('div');
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const input = renderUrlRailEditor(container, {
      value: 'https://example.test',
      onSubmit,
      onCancel,
    });

    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));

    expect(onSubmit).toHaveBeenCalledWith('https://example.test');
    expect(onCancel).not.toHaveBeenCalled();
  });
});
