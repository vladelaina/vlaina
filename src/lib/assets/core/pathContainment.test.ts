import { describe, expect, it } from 'vitest';
import { normalizeContainedAssetPath } from './pathContainment';

describe('normalizeContainedAssetPath', () => {
  it('rejects relative paths that escape before re-entering the root', () => {
    expect(normalizeContainedAssetPath('../assets/secret.png', 'assets')).toBeNull();
    expect(normalizeContainedAssetPath('../../notesRoot/assets/secret.png', 'notesRoot/assets')).toBeNull();
  });

  it('preserves safe relative child normalization', () => {
    expect(normalizeContainedAssetPath('assets/./icons/../icon.png', 'assets')).toBe('assets/icon.png');
  });

  it('normalizes UNC child paths without losing the network share root', () => {
    expect(
      normalizeContainedAssetPath('\\\\server\\share\\docs\\..\\alpha.md', '\\\\server\\share'),
    ).toBe('\\\\server\\share\\alpha.md');
  });

  it('rejects UNC sibling shares after dot-segment normalization', () => {
    expect(
      normalizeContainedAssetPath('\\\\server\\other\\alpha.md', '\\\\server\\share'),
    ).toBeNull();
  });
});
