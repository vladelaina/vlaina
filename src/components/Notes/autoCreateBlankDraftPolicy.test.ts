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
    vaultStoreHasInitialized: true,
    vaultInitializing: false,
    openTargetBusy: false,
    hasPendingStarredNavigation: false,
    autoCreateInFlight: false,
    hasPendingLaunchNote: false,
    currentVaultPath: '/vault',
    notesPath: '/vault',
    rootFolder: emptyRoot,
    rootFolderPath: '/vault',
    ...overrides,
  };
}

describe('shouldAutoCreateBlankDraft', () => {
  it('allows a blank draft for a fully initialized empty vault', () => {
    expect(shouldAutoCreateBlankDraft(createInput())).toEqual({
      shouldCreate: true,
      blockedReasons: [],
    });
  });

  it('waits until the vault store has resolved the persisted vault', () => {
    const result = shouldAutoCreateBlankDraft(createInput({
      currentVaultPath: null,
      notesPath: '',
      rootFolder: null,
      rootFolderPath: null,
      vaultStoreHasInitialized: false,
    }));

    expect(result.shouldCreate).toBe(false);
    expect(result.blockedReasons).toContain('vault-store-initializing');
  });

  it('blocks when the current vault tree has existing note files', () => {
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
    expect(result.blockedReasons).toContain('vault-has-files');
  });

  it('allows a blank draft when the current vault tree has folders but no note files', () => {
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
    expect(result.blockedReasons).not.toContain('vault-has-files');
  });

  it('blocks while a previous current note is still being restored', () => {
    const result = shouldAutoCreateBlankDraft(createInput({
      vaultInitializing: true,
    }));

    expect(result.shouldCreate).toBe(false);
    expect(result.blockedReasons).toContain('vault-initializing');
  });

  it('allows a scratch draft without a selected vault after vault initialization completes', () => {
    expect(shouldAutoCreateBlankDraft(createInput({
      currentVaultPath: null,
      notesPath: '',
      rootFolder: null,
      rootFolderPath: null,
      vaultStoreHasInitialized: true,
    }))).toEqual({
      shouldCreate: true,
      blockedReasons: [],
    });
  });
});
