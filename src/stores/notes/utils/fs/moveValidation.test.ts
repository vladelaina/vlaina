import { describe, expect, it } from 'vitest';
import { isInvalidMoveTarget } from './moveValidation';

describe('isInvalidMoveTarget', () => {
  it('rejects moves into the same parent folder', () => {
    expect(isInvalidMoveTarget('NekoTick/设置.md', 'NekoTick')).toBe(true);
    expect(isInvalidMoveTarget('设置.md', '')).toBe(true);
  });

  it('rejects moves into the source folder itself', () => {
    expect(isInvalidMoveTarget('NekoTick', 'NekoTick')).toBe(true);
  });

  it('rejects moves into a descendant folder', () => {
    expect(isInvalidMoveTarget('NekoTick', 'NekoTick/archive')).toBe(true);
  });

  it('allows moves into a different folder', () => {
    expect(isInvalidMoveTarget('NekoTick/设置.md', 'Archive')).toBe(false);
  });
});
