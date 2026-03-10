import type {
  RepoChangeOperation,
  RepoChangesetCommitResult,
  RepoCommitConflict,
} from './githubRepoCommands';

interface WebGitReferenceResponse {
  object: {
    sha: string;
  };
}

interface WebGitCommitLookupResponse {
  tree: {
    sha: string;
  };
}

interface WebGitTreeResponse {
  sha: string;
  tree: Array<{
    path: string;
    size?: number | null;
    sha?: string | null;
    type: string;
  }>;
}

interface WebCreatedBlobResponse {
  sha: string;
}

interface WebCreatedTreeResponse {
  sha: string;
}

interface WebCreatedCommitResponse {
  sha: string;
  html_url?: string;
}

export interface WebGithubChangesetFetch {
  <T>(path: string, init?: RequestInit): Promise<T>;
}

interface ChangesetBaseState {
  headCommitSha: string;
  treeSha: string;
  currentShas: Map<string, string>;
}

interface CreatedTreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string | null;
}

interface CreatedTreePayload {
  updatedFiles: Array<{ path: string; sha: string }>;
  treeEntries: CreatedTreeEntry[];
}

export function detectChangesetConflicts(
  operations: RepoChangeOperation[],
  currentShas: Map<string, string>
): RepoCommitConflict[] {
  return operations.flatMap((operation) => {
    const currentSha = currentShas.get(operation.path) ?? null;
    const previousSha = operation.previousSha ?? null;
    if (currentSha === previousSha) return [];

    let reason: RepoCommitConflict['reason'] = 'created';
    if (previousSha && currentSha) reason = 'modified';
    else if (previousSha && !currentSha) reason = 'deleted';

    return [{ path: operation.path, reason }];
  });
}

async function loadChangesetBaseState(
  githubFetch: WebGithubChangesetFetch,
  owner: string,
  repo: string,
  branch: string
): Promise<ChangesetBaseState> {
  const reference = await githubFetch<WebGitReferenceResponse>(
    `/repos/${owner}/${repo}/git/ref/heads/${branch}`
  );
  const headCommitSha = reference.object.sha;

  const commitLookup = await githubFetch<WebGitCommitLookupResponse>(
    `/repos/${owner}/${repo}/git/commits/${headCommitSha}`
  );
  const tree = await githubFetch<WebGitTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${commitLookup.tree.sha}?recursive=1`
  );

  const currentShas = new Map<string, string>();
  for (const entry of tree.tree) {
    if (entry.type === 'blob' && entry.sha) {
      currentShas.set(entry.path, entry.sha);
    }
  }

  return {
    headCommitSha,
    treeSha: tree.sha,
    currentShas,
  };
}

async function createChangesetTreePayload(
  githubFetch: WebGithubChangesetFetch,
  owner: string,
  repo: string,
  operations: RepoChangeOperation[]
): Promise<CreatedTreePayload> {
  const updatedFiles: Array<{ path: string; sha: string }> = [];
  const treeEntries: CreatedTreeEntry[] = [];

  for (const operation of operations) {
    if (operation.operationType === 'upsert') {
      const blob = await githubFetch<WebCreatedBlobResponse>(`/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: operation.content ?? '',
          encoding: 'utf-8',
        }),
      });

      updatedFiles.push({ path: operation.path, sha: blob.sha });
      treeEntries.push({
        path: operation.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
      continue;
    }

    treeEntries.push({
      path: operation.path,
      mode: '100644',
      type: 'blob',
      sha: null,
    });
  }

  return { updatedFiles, treeEntries };
}

async function createChangesetCommit(
  githubFetch: WebGithubChangesetFetch,
  owner: string,
  repo: string,
  message: string,
  headCommitSha: string,
  treeSha: string,
  treeEntries: CreatedTreeEntry[]
): Promise<WebCreatedCommitResponse> {
  const createdTree = await githubFetch<WebCreatedTreeResponse>(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: treeSha,
      tree: treeEntries,
    }),
  });

  return githubFetch<WebCreatedCommitResponse>(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: createdTree.sha,
      parents: [headCommitSha],
    }),
  });
}

async function updateBranchReference(
  githubFetch: WebGithubChangesetFetch,
  owner: string,
  repo: string,
  branch: string,
  commitSha: string
): Promise<void> {
  await githubFetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sha: commitSha,
      force: false,
    }),
  });
}

export async function commitWebGithubChangeset(params: {
  githubFetch: WebGithubChangesetFetch;
  owner: string;
  repo: string;
  branch: string;
  message: string;
  operations: RepoChangeOperation[];
}): Promise<RepoChangesetCommitResult> {
  const { githubFetch, owner, repo, branch, message, operations } = params;

  if (operations.length === 0) {
    return {
      status: 'committed',
      commit: null,
      conflicts: [],
      updatedFiles: [],
    };
  }

  const baseState = await loadChangesetBaseState(githubFetch, owner, repo, branch);
  const conflicts = detectChangesetConflicts(operations, baseState.currentShas);
  if (conflicts.length > 0) {
    return {
      status: 'conflict',
      commit: null,
      conflicts,
      updatedFiles: [],
    };
  }

  const { updatedFiles, treeEntries } = await createChangesetTreePayload(
    githubFetch,
    owner,
    repo,
    operations
  );
  const createdCommit = await createChangesetCommit(
    githubFetch,
    owner,
    repo,
    message,
    baseState.headCommitSha,
    baseState.treeSha,
    treeEntries
  );

  await updateBranchReference(githubFetch, owner, repo, branch, createdCommit.sha);

  return {
    status: 'committed',
    commit: {
      sha: createdCommit.sha,
      message,
      htmlUrl: createdCommit.html_url,
    },
    conflicts: [],
    updatedFiles,
  };
}
