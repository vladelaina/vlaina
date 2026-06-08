import { describe, expect, it } from 'vitest';
import {
  hasInternalNoteAssetPathSegment,
  hasInternalNoteAssetUrlPathSegment,
} from './internalAssetPaths';

describe('internal asset paths', () => {
  it('detects internal filesystem path segments case-insensitively', () => {
    expect(hasInternalNoteAssetPathSegment('.vlaina/assets/a.png')).toBe(true);
    expect(hasInternalNoteAssetPathSegment('docs/.GIT/a.png')).toBe(true);
    expect(hasInternalNoteAssetPathSegment('docs/.notes/a.png')).toBe(false);
  });

  it('detects encoded internal URL path segments without blocking user dot folders', () => {
    expect(hasInternalNoteAssetUrlPathSegment('%2evlaina/assets/a.png')).toBe(true);
    expect(hasInternalNoteAssetUrlPathSegment('docs/%2Egit/a.png')).toBe(true);
    expect(hasInternalNoteAssetUrlPathSegment('docs/%252egit/a.png')).toBe(true);
    expect(hasInternalNoteAssetUrlPathSegment('docs/%25252egit/a.png')).toBe(true);
    expect(hasInternalNoteAssetUrlPathSegment('docs%2f.git%2fa.png')).toBe(true);
    expect(hasInternalNoteAssetUrlPathSegment('docs/%2Egit/a.png?cache=1')).toBe(true);
    expect(hasInternalNoteAssetUrlPathSegment('docs/%2Egit/a.png#preview')).toBe(true);
    expect(hasInternalNoteAssetUrlPathSegment('.notes/assets/a.png')).toBe(false);
    expect(hasInternalNoteAssetUrlPathSegment('%2enotes/assets/a.png')).toBe(false);
  });
});
