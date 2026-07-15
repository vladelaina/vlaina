import { describe, expect, it } from 'vitest';
import { collectOpenedFolderImagePaths, getImagePathRelativeToNote } from './slashImageLibraryPaths';

describe('slash image library paths', () => {
  it('collects nested image nodes while excluding notes', () => {
    expect(collectOpenedFolderImagePaths([
      { id: 'alpha.md', name: 'alpha', path: 'alpha.md', isFolder: false },
      { id: 'cover.webp', name: 'cover.webp', path: 'cover.webp', isFolder: false, kind: 'image' },
      {
        id: 'assets',
        name: 'assets',
        path: 'assets',
        isFolder: true,
        expanded: true,
        children: [{
          id: 'assets/animation.gif',
          name: 'animation.gif',
          path: 'assets/animation.gif',
          isFolder: false,
          kind: 'image',
        }],
      },
    ])).toEqual(['cover.webp', 'assets/animation.gif']);
  });

  it('creates paths relative to the current note directory', () => {
    expect(getImagePathRelativeToNote('docs/assets/cover.webp', 'docs/note.md')).toBe('assets/cover.webp');
    expect(getImagePathRelativeToNote('assets/cover.webp', 'docs/note.md')).toBe('../assets/cover.webp');
    expect(getImagePathRelativeToNote('assets/cover.webp', 'note.md')).toBe('assets/cover.webp');
  });
});
