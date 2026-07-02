import { describe, expect, it } from 'vitest';
import {
  getExternalPathMutationRevision,
  markExternalPathDeletion,
  markExternalPathRename,
  wasPathExternallyMutatedSince,
} from './externalPathMutationRegistry';

describe('externalPathMutationRegistry', () => {
  it('matches relative paths after slash normalization', () => {
    const revision = getExternalPathMutationRevision();

    markExternalPathDeletion('docs\\alpha.md');

    expect(wasPathExternallyMutatedSince('docs/alpha.md', revision)).toBe(true);
    expect(wasPathExternallyMutatedSince('docs/beta.md', revision)).toBe(false);
  });

  it('matches Windows absolute paths case-insensitively', () => {
    const revision = getExternalPathMutationRevision();

    markExternalPathRename('C:\\NotesRoot\\Docs');

    expect(wasPathExternallyMutatedSince('c:/notesRoot/docs/alpha.md', revision)).toBe(true);
    expect(wasPathExternallyMutatedSince('D:/notesRoot/docs/alpha.md', revision)).toBe(false);
  });

  it('treats truncated mutation history as a possible mutation', () => {
    const revision = getExternalPathMutationRevision();

    markExternalPathDeletion('target.md');
    for (let index = 0; index < 300; index += 1) {
      markExternalPathDeletion(`other-${index}.md`);
    }

    expect(wasPathExternallyMutatedSince('target.md', revision)).toBe(true);
  });
});
