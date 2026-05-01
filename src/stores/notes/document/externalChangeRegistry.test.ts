import { describe, expect, it, vi } from 'vitest';
import {
  markExpectedExternalChange,
  shouldIgnoreExpectedExternalChange,
} from './externalChangeRegistry';

describe('externalChangeRegistry', () => {
  it('ignores repeated expected exact changes during the expected-change window', () => {
    markExpectedExternalChange('/vault/docs/a.md');

    expect(shouldIgnoreExpectedExternalChange('/vault/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/a.md')).toBe(false);
  });

  it('ignores repeated expected recursive changes during the expected-change window', () => {
    markExpectedExternalChange('/vault/docs', true);

    expect(shouldIgnoreExpectedExternalChange('/vault/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/b.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/c.md')).toBe(false);
  });

  it('merges repeated marks for the same expected path', () => {
    markExpectedExternalChange('/vault/docs/a.md');
    markExpectedExternalChange('/vault/docs/a.md');

    expect(shouldIgnoreExpectedExternalChange('/vault/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/a.md')).toBe(false);
  });

  it('expires expected changes before a later external write can be swallowed', () => {
    vi.useFakeTimers();
    try {
      markExpectedExternalChange('/vault/docs/a.md');
      vi.advanceTimersByTime(1001);
      expect(shouldIgnoreExpectedExternalChange('/vault/docs/a.md')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
