import { create } from 'zustand';
import type { CloudRepoStore } from './types';
import { createCloudRepoStoreActions } from './storeActions';
import { createCloudRepoStoreRuntime } from './storeRuntime';

export const useGithubReposStore = create<CloudRepoStore>((set, get) => {
  const runtime = createCloudRepoStoreRuntime(set, get);

  return {
    repositories: [],
    isLoadingRepos: false,
    expandedRepos: new Set(),
    repoTrees: new Map(),
    loadedRepoTrees: new Set(),
    fileCache: new Map(),
    drafts: new Map(),
    syncStatus: new Map(),
    error: null,
    sectionExpanded: false,
    hydratedRepos: new Set(),
    ...createCloudRepoStoreActions(set, get, runtime),
  };
});
