import type { CloudRepoStoreActions } from './types';
import type { CloudRepoStoreRuntime } from './storeRuntime';
import { type CloudRepoGet, type CloudRepoSet } from './storeSupport';
import { createCloudRepoDraftActions } from './draftActions';
import { createCloudRepoRemoteMutationActions } from './remoteMutationActions';
import { createCloudRepoRemoteNoteActions } from './remoteNoteActions';

export function createCloudRepoNoteActions(
  set: CloudRepoSet,
  get: CloudRepoGet,
  runtime: CloudRepoStoreRuntime
): Pick<
  CloudRepoStoreActions,
  | 'openRemoteNote'
  | 'createRemoteNote'
  | 'createRemoteFolder'
  | 'renameRemoteNode'
  | 'deleteRemoteNode'
  | 'saveDraft'
  | 'syncRepository'
> {
  return {
    ...createCloudRepoRemoteNoteActions(set, get, runtime),
    ...createCloudRepoRemoteMutationActions(set, runtime),
    ...createCloudRepoDraftActions(set, get, runtime),
  };
}
