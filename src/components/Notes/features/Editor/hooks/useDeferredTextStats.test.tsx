import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeferredTextStats } from './useDeferredTextStats';

describe('useDeferredTextStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates small documents immediately', () => {
    const { result, rerender } = renderHook(
      ({ text }) => useDeferredTextStats('alpha.md', text),
      { initialProps: { text: 'one two' } },
    );

    expect(result.current.wordCount).toBe(2);

    rerender({ text: 'one two three' });

    expect(result.current.wordCount).toBe(3);
  });

  it('defers large document stats while the user is typing', () => {
    const initialText = `${'a'.repeat(20_001)} tail`;
    const nextText = `${initialText} next`;
    const { result, rerender } = renderHook(
      ({ text }) => useDeferredTextStats('large.md', text),
      { initialProps: { text: initialText } },
    );

    const initialWordCount = result.current.wordCount;

    rerender({ text: nextText });

    expect(result.current.wordCount).toBe(initialWordCount);

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(result.current.wordCount).toBe(initialWordCount + 1);
  });
});
