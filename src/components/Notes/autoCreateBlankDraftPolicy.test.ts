import { describe, expect, it } from 'vitest';
import type { FolderNode } from '@/stores/notes/types';
import { shouldAutoCreateBlankDraft, type AutoCreateBlankDraftPolicyInput } from './autoCreateBlankDraftPolicy';

const emptyRoot: FolderNode = {
  id: '',
  name: 'Notes',
  path: '',
  isFolder: true,
  children: [],
  expanded: true,
};

function createInput(overrides: Partial<AutoCreateBlankDraftPolicyInput> = {}): AutoCreateBlankDraftPolicyInput {
  return {
    active: true,
    currentNotePath: null,
    openTabCount: 0,
    hasPresentedNote: false,
    notesLoading: false,
    notesRootStoreHasInitialized: true,
    notesRootInitializing: false,
    openTargetBusy: false,
    hasPendingStarredNavigation: false,
    autoCreateInFlight: false,
    hasPendingLaunchNote: false,
    currentNotesRootPath: '/notesRoot',
    notesPath: '/notesRoot',
    rootFolder: emptyRoot,
    rootFolderPath: '/notesRoot',
    ...overrides,
  };
}

describe('shouldAutoCreateBlankDraft', () => {
  it('allows a blank draft for a fully initialized empty notesRoot', () => {
    expect(shouldAutoCreateBlankDraft(createInput())).toEqual({
      shouldCreate: true,
      blockedReasons: [],
    });
  });

  it('waits until the notesRoot store has resolved the persisted notesRoot', () => {
    const result = shouldAutoCreateBlankDraft(createInput({
      currentNotesRootPath: null,
      notesPath: '',
      rootFolder: null,
      rootFolderPath: null,
      notesRootStoreHasInitialized: false,
    }));

    expect(result.shouldCreate).toBe(false);
    expect(result.blockedReasons).toContain('notes-root-store-initializing');
  });

  it('blocks when the opened folder tree has existing note files', () => {
    const result = shouldAutoCreateBlankDraft(createInput({
      rootFolder: {
        ...emptyRoot,
        children: [
          {
            id: 'docs/alpha.md',
            name: 'alpha.md',
            path: 'docs/alpha.md',
            isFolder: false,
          },
        ],
      },
    }));

    expect(result.shouldCreate).toBe(false);
    expect(result.blockedReasons).toContain('notes-root-has-files');
  });

  it('allows a blank draft when the opened folder tree has folders but no note files', () => {
    const result = shouldAutoCreateBlankDraft(createInput({
      rootFolder: {
        ...emptyRoot,
        children: [
          {
            id: 'docs',
            name: 'docs',
            path: 'docs',
            isFolder: true,
            children: [],
            expanded: false,
          },
        ],
      },
    }));

    expect(result.shouldCreate).toBe(true);
    expect(result.blockedReasons).not.toContain('notes-root-has-files');
  });

  it('allows a blank draft when the opened folder contains only images', () => {
    const result = shouldAutoCreateBlankDraft(createInput({
      rootFolder: {
        ...emptyRoot,
        children: [
          {
            id: 'images/cover.png',
            name: 'cover.png',
            path: 'images/cover.png',
            isFolder: false,
            kind: 'image',
          },
        ],
      },
    }));

    expect(result.shouldCreate).toBe(true);
    expect(result.blockedReasons).not.toContain('notes-root-has-files');
  });

  it('does not auto-create a blank draft when the file tree scan budget is exhausted', () => {
    const result = shouldAutoCreateBlankDraft(createInput({
      rootFolder: {
        ...emptyRoot,
        children: Array.from({ length: 20_001 }, (_value, index) => ({
          id: `folder-${index}`,
          name: `folder-${index}`,
          path: `folder-${index}`,
          isFolder: true as const,
          children: [],
          expanded: false,
        })),
      },
    }));

    expect(result.shouldCreate).toBe(false);
    expect(result.blockedReasons).toContain('notes-root-tree-scan-budget');
  });

  it('blocks while a previous current note is still being restored', () => {
    const result = shouldAutoCreateBlankDraft(createInput({
      notesRootInitializing: true,
    }));

    expect(result.shouldCreate).toBe(false);
    expect(result.blockedReasons).toContain('notes-root-initializing');
  });

  it('allows a scratch draft without a selected folder after notesRoot initialization completes', () => {
    expect(shouldAutoCreateBlankDraft(createInput({
      currentNotesRootPath: null,
      notesPath: '',
      rootFolder: null,
      rootFolderPath: null,
      notesRootStoreHasInitialized: true,
    }))).toEqual({
      shouldCreate: true,
      blockedReasons: [],
    });
  });
});
