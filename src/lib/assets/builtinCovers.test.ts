import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getBuiltinCoverAssetEntries,
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

  it('derives asset entries and urls from the same registry', () => {
    const covers = getBuiltinCovers();
    const entries = getBuiltinCoverAssetEntries();

    expect(entries.map((entry) => entry.filename).sort()).toEqual(
      covers.map((cover) => toBuiltinAssetPath(cover)).sort(),
    );

    for (const cover of covers) {
      expect(getBuiltinCoverUrl(toBuiltinAssetPath(cover))).toBe(`/covers/${cover.path}`);
    }
  });
});
