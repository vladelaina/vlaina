import { describe, expect, it } from 'vitest';
import { isCurrentNoteInsideFolder } from './FolderItem';

describe('isCurrentNoteInsideFolder', () => {
  it('matches direct and nested files inside the folder', () => {
    expect(isCurrentNoteInsideFolder('docs/a.md', 'docs')).toBe(true);
    expect(isCurrentNoteInsideFolder('docs/guides/a.md', 'docs')).toBe(true);
  });

  it('does not match the file itself or same-prefix sibling folders', () => {
    expect(isCurrentNoteInsideFolder('docs.md', 'docs')).toBe(false);
    expect(isCurrentNoteInsideFolder('docs-old/a.md', 'docs')).toBe(false);
    expect(isCurrentNoteInsideFolder('docs/a.md', 'doc')).toBe(false);
  });
});
