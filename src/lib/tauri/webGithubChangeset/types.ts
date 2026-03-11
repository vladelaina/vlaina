import type {
  RepoChangeOperation,
  RepoChangesetCommitResult,
  RepoCommitConflict,
} from '../githubRepoCommands';

export type {
  RepoChangeOperation,
  RepoChangesetCommitResult,
  RepoCommitConflict,
};

export interface WebGitReferenceResponse {
  object: {
    sha: string;
  };
}

export interface WebGitCommitLookupResponse {
  tree: {
    sha: string;
  };
}

export interface WebGitTreeResponse {
  sha: string;
  tree: Array<{
    path: string;
    size?: number | null;
    sha?: string | null;
    type: string;
  }>;
}

export interface WebCreatedBlobResponse {
  sha: string;
}

export interface WebCreatedTreeResponse {
  sha: string;
}

export interface WebCreatedCommitResponse {
  sha: string;
  html_url?: string;
}

export interface WebGithubChangesetFetch {
  <T>(path: string, init?: RequestInit): Promise<T>;
}

export interface ChangesetBaseState {
  headCommitSha: string;
  treeSha: string;
  currentShas: Map<string, string>;
}

export interface CreatedTreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string | null;
}

export interface CreatedTreePayload {
  updatedFiles: Array<{ path: string; sha: string }>;
  treeEntries: CreatedTreeEntry[];
}

export interface CommitWebGithubChangesetParams {
  githubFetch: WebGithubChangesetFetch;
  owner: string;
  repo: string;
  branch: string;
  message: string;
  operations: RepoChangeOperation[];
}

export function createEmptyCommitResult(): RepoChangesetCommitResult {
  return {
    status: 'committed',
    commit: null,
    conflicts: [],
    updatedFiles: [],
  };
}
