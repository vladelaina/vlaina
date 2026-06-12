import { describe, expect, it } from 'vitest';
import { __testing__ } from './slashFileCommands';

describe('slashFileCommands security helpers', () => {
  it('only treats image paths as insertable images', () => {
    expect(__testing__.isInsertableImagePath('/vault/assets/cover.png')).toBe(true);
    expect(__testing__.isInsertableImagePath('/vault/assets/secret.md')).toBe(false);
  });

  it('limits picked image size while allowing unknown size for bounded reads', () => {
    expect(__testing__.isInsertableImageSize(50 * 1024 * 1024)).toBe(true);
    expect(__testing__.isInsertableImageSize(51 * 1024 * 1024)).toBe(false);
    expect(__testing__.isInsertableImageSize(null)).toBe(true);
    expect(__testing__.isInsertableImageSize(undefined)).toBe(true);
    expect(__testing__.isInsertableImageSize(-1)).toBe(false);
    expect(__testing__.isInsertableImageSize(Number.NaN)).toBe(false);
    expect(__testing__.isInsertableImageSize(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
