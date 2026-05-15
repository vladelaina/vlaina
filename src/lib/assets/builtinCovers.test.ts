import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getBuiltinCovers,
  getBuiltinCoverUrl,
  toBuiltinAssetPath,
} from './builtinCovers';

describe('builtin covers', () => {
  it('keeps the registry in sync with bundled cover files', () => {
    const covers = getBuiltinCovers();

    expect(covers.length).toBeGreaterThan(0);
    for (const cover of covers) {
      expect(existsSync(resolve(process.cwd(), 'public/covers', cover.path))).toBe(true);
    }
  });

  it('resolves legacy builtin cover urls from the registry', () => {
    const covers = getBuiltinCovers();

    for (const cover of covers) {
      expect(getBuiltinCoverUrl(toBuiltinAssetPath(cover))).toBe(`/covers/${cover.path}`);
    }
  });
});
