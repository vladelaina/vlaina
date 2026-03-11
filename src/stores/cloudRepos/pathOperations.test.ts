import { describe, expect, it } from 'vitest';
import {
  CLOUD_FOLDER_KEEP_FILE,
  createFolderKeepFilePath,
  createRenamedPath,
  createUniqueFolderPath,
  createUniqueNotePath,
  getCloudBaseName,
  getCloudParentPath,
  joinCloudRelativePath,
  normalizeCloudRelativePath,
  remapCloudPathPrefix,
} from './pathOperations';

describe('cloud repo path operations', () => {
  it('normalizes slashes and trims redundant separators', () => {
    expect(normalizeCloudRelativePath('//docs\\\\nested///note.md/')).toBe('docs/nested/note.md');
  });

  it('joins parent and child segments consistently', () => {
    expect(joinCloudRelativePath('docs/', '/note.md')).toBe('docs/note.md');
    expect(joinCloudRelativePath('', 'note.md')).toBe('note.md');
  });

  it('returns parent and base names from normalized paths', () => {
    expect(getCloudParentPath('docs/note.md')).toBe('docs');
    expect(getCloudBaseName('docs/note.md')).toBe('note.md');
  });

  it('creates unique note paths and preserves markdown extension', () => {
    const result = createUniqueNotePath(
      new Set(['docs/Untitled.md', 'docs/Untitled 2.md']),
      'docs',
      'Untitled'
    );

    expect(result).toBe('docs/Untitled 3.md');
  });

  it('creates unique folder paths and keep-file placeholders', () => {
    const folderPath = createUniqueFolderPath(
      new Set(['docs/New Folder', 'docs/New Folder 2']),
      'docs',
      'New Folder'
    );

    expect(folderPath).toBe('docs/New Folder 3');
    expect(createFolderKeepFilePath(folderPath)).toBe(`docs/New Folder 3/${CLOUD_FOLDER_KEEP_FILE}`);
  });

  it('renames file and folder paths and remaps nested prefixes', () => {
    expect(createRenamedPath('docs/note.md', 'file', 'renamed')).toBe('docs/renamed.md');
    expect(createRenamedPath('docs/folder', 'folder', 'renamed')).toBe('docs/renamed');
    expect(remapCloudPathPrefix('docs/folder/note.md', 'docs/folder', 'docs/renamed')).toBe(
      'docs/renamed/note.md'
    );
  });
});
