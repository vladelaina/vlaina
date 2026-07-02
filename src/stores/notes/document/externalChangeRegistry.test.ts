import { describe, expect, it, vi } from 'vitest';
import {
  MAX_EXPECTED_EXTERNAL_CHANGES,
  markExpectedExternalChange,
  shouldIgnoreExpectedExternalChange,
} from './externalChangeRegistry';

describe('externalChangeRegistry', () => {
  it('ignores repeated expected exact changes during the expected-change window', () => {
    markExpectedExternalChange('/notesRoot/docs/a.md');

    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/a.md')).toBe(false);
  });

  it('ignores repeated expected recursive changes during the expected-change window', () => {
    markExpectedExternalChange('/notesRoot/docs', true);

    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/b.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/c.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/d.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/c.md')).toBe(false);
  });

  it('merges repeated marks for the same expected path', () => {
    markExpectedExternalChange('/notesRoot/docs/a.md');
    markExpectedExternalChange('/notesRoot/docs/a.md');

    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/a.md')).toBe(false);
  });

  it('expires expected changes before a later external write can be swallowed', () => {
    vi.useFakeTimers();
    try {
      markExpectedExternalChange('/notesRoot/docs/a.md');
      vi.advanceTimersByTime(1001);
      expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/a.md')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('evicts oldest expected changes when the registry reaches its memory budget', () => {
    for (let index = 0; index <= MAX_EXPECTED_EXTERNAL_CHANGES; index += 1) {
      markExpectedExternalChange(`/notesRoot/docs/bulk-${index}.md`);
    }

    expect(shouldIgnoreExpectedExternalChange('/notesRoot/docs/bulk-0.md')).toBe(false);
    expect(shouldIgnoreExpectedExternalChange(`/notesRoot/docs/bulk-${MAX_EXPECTED_EXTERNAL_CHANGES}.md`)).toBe(true);
  });
});
