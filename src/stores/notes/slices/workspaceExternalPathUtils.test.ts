import { describe, expect, it } from 'vitest';
import { isKnownNoteFilePath } from './workspaceExternalPathUtils';

function createInput(rootFolder: Parameters<typeof isKnownNoteFilePath>[0]['rootFolder']) {
  return {
    currentNote: null,
    openTabs: [],
    recentNotes: [],
    noteContentsCache: new Map(),
    noteMetadata: null,
    notesPath: '/notesRoot',
    rootFolder,
    starredEntries: [],
  };
}

describe('isKnownNoteFilePath', () => {
  it('recognizes markdown leaves as notes', () => {
    expect(isKnownNoteFilePath(createInput({
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [{
        id: 'alpha.md',
        name: 'alpha',
        path: 'alpha.md',
        isFolder: false,
      }],
    }), 'alpha.md')).toBe(true);
  });

  it('does not treat image leaves as notes', () => {
    expect(isKnownNoteFilePath(createInput({
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [{
        id: 'cover.png',
        name: 'cover.png',
        path: 'cover.png',
        isFolder: false,
        kind: 'image',
      }],
    }), 'cover.png')).toBe(false);
  });
});
