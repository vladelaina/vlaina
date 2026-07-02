import { describe, expect, it, vi } from 'vitest';
import {
  hasUnsafeNotesRootPathSegment,
  isSafeNotesRootPathSegment,
  MAX_NOTES_ROOT_RELATIVE_PATH_CHARS,
  normalizeNotesRootRelativePath,
  resolveNotesRootRelativeFullPath,
} from './notesRootPathContainment';

vi.mock('@/lib/storage/adapter', () => ({
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
}));

describe('notesRootPathContainment', () => {
  it('accepts only single safe relative path segments', () => {
    expect(isSafeNotesRootPathSegment('alpha.md')).toBe(true);
    expect(isSafeNotesRootPathSegment('nested')).toBe(true);
    expect(isSafeNotesRootPathSegment('')).toBe(false);
    expect(isSafeNotesRootPathSegment('.')).toBe(false);
    expect(isSafeNotesRootPathSegment('..')).toBe(false);
    expect(isSafeNotesRootPathSegment('../secret.md')).toBe(false);
    expect(isSafeNotesRootPathSegment('docs/secret.md')).toBe(false);
    expect(isSafeNotesRootPathSegment('docs\\secret.md')).toBe(false);
    expect(isSafeNotesRootPathSegment('secret\0.md')).toBe(false);
    expect(isSafeNotesRootPathSegment('secret\u202Egnp.md')).toBe(false);
    expect(isSafeNotesRootPathSegment('secret\uFFFD.md')).toBe(false);
  });

  it('checks unsafe path segments in relative and absolute-style paths', () => {
    expect(hasUnsafeNotesRootPathSegment('docs/alpha.md')).toBe(false);
    expect(hasUnsafeNotesRootPathSegment('docs/secret\u202Egnp.md')).toBe(true);
    expect(hasUnsafeNotesRootPathSegment('../secret.md')).toBe(true);
    expect(hasUnsafeNotesRootPathSegment('../secret.md', { allowNavigationSegments: true })).toBe(false);
    expect(hasUnsafeNotesRootPathSegment('C:\\notesRoot\\alpha.md')).toBe(false);
    expect(hasUnsafeNotesRootPathSegment('C:\\notesRoot\\secret\u001F.md')).toBe(true);
  });

  it('normalizes safe notes-root-relative paths', () => {
    expect(normalizeNotesRootRelativePath('docs\\alpha.md')).toBe('docs/alpha.md');
    expect(normalizeNotesRootRelativePath('./docs//alpha.md')).toBe('docs/alpha.md');
    expect(normalizeNotesRootRelativePath('', { allowEmpty: true })).toBe('');
    expect(normalizeNotesRootRelativePath('.notes/alpha.md')).toBe('.notes/alpha.md');
  });

  it('rejects absolute and parent traversal paths', () => {
    expect(normalizeNotesRootRelativePath('/etc/passwd')).toBeNull();
    expect(normalizeNotesRootRelativePath('C:\\Users\\alpha.md')).toBeNull();
    expect(normalizeNotesRootRelativePath('../secret.md')).toBeNull();
    expect(normalizeNotesRootRelativePath('docs/../../secret.md')).toBeNull();
  });

  it('rejects URL-like paths before treating them as notes-root-relative paths', () => {
    expect(normalizeNotesRootRelativePath('https://example.test/alpha.md')).toBeNull();
    expect(normalizeNotesRootRelativePath('file:///etc/passwd.md')).toBeNull();
    expect(normalizeNotesRootRelativePath('https\\://example.test/alpha.md')).toBeNull();
    expect(normalizeNotesRootRelativePath('C:relative.md')).toBeNull();
  });

  it('rejects control and bidi characters in notes-root-relative paths', () => {
    expect(normalizeNotesRootRelativePath('docs/secret\0.md')).toBeNull();
    expect(normalizeNotesRootRelativePath('docs/secret\u001F.md')).toBeNull();
    expect(normalizeNotesRootRelativePath('docs/secret\u202Egnp.md')).toBeNull();
    expect(normalizeNotesRootRelativePath('docs/secret\u2066.md')).toBeNull();
    expect(normalizeNotesRootRelativePath('docs/secret\uFFFD.md')).toBeNull();
  });

  it('rejects oversized notes-root-relative paths before normalization', () => {
    const oversizedPath = `${'a'.repeat(MAX_NOTES_ROOT_RELATIVE_PATH_CHARS + 1)}.md`;

    expect(isSafeNotesRootPathSegment(oversizedPath)).toBe(false);
    expect(hasUnsafeNotesRootPathSegment(oversizedPath)).toBe(true);
    expect(normalizeNotesRootRelativePath(oversizedPath)).toBeNull();
  });

  it('resolves safe relative paths below the notesRoot root', async () => {
    await expect(resolveNotesRootRelativeFullPath('/notesRoot', 'docs/alpha.md')).resolves.toEqual({
      relativePath: 'docs/alpha.md',
      fullPath: '/notesRoot/docs/alpha.md',
    });
  });
});
