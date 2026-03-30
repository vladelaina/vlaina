import { describe, expect, it } from 'vitest';
import { isInvalidMoveTarget } from './moveValidation';

describe('moveValidation', () => {
  it('rejects moving an entry into itself', () => {
    expect(isInvalidMoveTarget('docs', 'docs')).toBe(true);
  });

  it('rejects moving a folder into its own descendant', () => {
    expect(isInvalidMoveTarget('docs', 'docs/nested')).toBe(true);
  });

  it('allows moving a child into its ancestor', () => {
    expect(isInvalidMoveTarget('docs/nested', 'docs')).toBe(false);
  });

  it('allows moving into an unrelated folder', () => {
    expect(isInvalidMoveTarget('docs', 'archive')).toBe(false);
  });
});
