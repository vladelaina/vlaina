import type { CloudRepoStoreActions } from './types';
import type { CloudRepoStoreRuntime } from './storeRuntime';
import {
  type CloudRepoGet,
  type CloudRepoSet,
} from './storeSupport';
import { createCloudRepoRepositoryActions } from './repositoryActions';
import { createCloudRepoNoteActions } from './noteActions';

export function createCloudRepoStoreActions(
  set: CloudRepoSet,
  get: CloudRepoGet,
  runtime: CloudRepoStoreRuntime
): CloudRepoStoreActions {
  return {
    ...createCloudRepoRepositoryActions(set, get, runtime),
    ...createCloudRepoNoteActions(set, get, runtime),
  };
}
