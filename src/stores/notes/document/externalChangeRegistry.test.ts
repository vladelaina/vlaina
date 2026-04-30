import { describe, expect, it } from 'vitest';
import {
  markExpectedExternalChange,
  shouldIgnoreExpectedExternalChange,
} from './externalChangeRegistry';

describe('externalChangeRegistry', () => {
  it('consumes an expected exact change after one ignored event', () => {
    markExpectedExternalChange('/vault/docs/a.md');

    expect(shouldIgnoreExpectedExternalChange('/vault/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/a.md')).toBe(false);
  });

  it('consumes an expected recursive change after one ignored descendant event', () => {
    markExpectedExternalChange('/vault/docs', true);

    expect(shouldIgnoreExpectedExternalChange('/vault/docs/a.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/b.md')).toBe(false);
  });
});
