import type {
  RepoChangeOperation,
  RepoChangesetCommitResult,
  RepoCommitConflict,
} from './githubRepoCommands';

export type WebGithubChangesetFetch = <T>(
  path: string,
  init?: RequestInit
) => Promise<T>;

interface GitRefResponse {
  object?: {
    sha?: string;
  };
}

interface GitCommitResponse {
  sha?: string;
  tree?: {
    sha?: string;
  };
  html_url?: string;
}

interface GitTreeEntry {
  path?: string;
  sha?: string | null;
  type?: string;
}

interface GitTreeResponse {
  sha?: string;
  tree?: GitTreeEntry[];
}

interface CommitWebGithubChangesetArgs {
  githubFetch: WebGithubChangesetFetch;
  owner: string;
  repo: string;
  branch: string;
  message: string;
  operations: RepoChangeOperation[];
}

interface GitTreeWriteEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string | null;
}

function buildRepoPath(owner: string, repo: string, suffix: string): string {
  return `/repos/${owner}/${repo}${suffix}`;
}

function normalizeTreeShaMap(entries: GitTreeEntry[] | undefined): Map<string, string> {
  const currentShas = new Map<string, string>();
  for (const entry of entries ?? []) {
    if (entry.type !== 'blob') continue;
    const path = typeof entry.path === 'string' ? entry.path : '';
    const sha = typeof entry.sha === 'string' ? entry.sha : '';
    if (!path || !sha) continue;
    currentShas.set(path, sha);
  }
  return currentShas;
}

export function detectChangesetConflicts(
  operations: RepoChangeOperation[],
  currentShas: Map<string, string>
): RepoCommitConflict[] {
  const conflicts: RepoCommitConflict[] = [];

  for (const operation of operations) {
    const previousSha = operation.previousSha ?? null;
    const currentSha = currentShas.get(operation.path) ?? null;

    if (previousSha) {
      if (!currentSha) {
        conflicts.push({ path: operation.path, reason: 'deleted' });
        continue;
      }
      if (currentSha !== previousSha) {
        conflicts.push({ path: operation.path, reason: 'modified' });
      }
      continue;
    }

    if (currentSha) {
      conflicts.push({ path: operation.path, reason: 'created' });
    }
  }

  return conflicts;
}

async function createBlob(
  githubFetch: WebGithubChangesetFetch,
  owner: string,
  repo: string,
  content: string
): Promise<string> {
  const payload = await githubFetch<{ sha?: string }>(
    buildRepoPath(owner, repo, '/git/blobs'),
    {
      method: 'POST',
      body: JSON.stringify({
        content,
        encoding: 'utf-8',
      }),
    }
  );
  const sha = typeof payload.sha === 'string' ? payload.sha : '';
  if (!sha) {
    throw new Error('GitHub blob response missing sha');
  }
  return sha;
}

export async function commitWebGithubChangeset({
  githubFetch,
  owner,
  repo,
  branch,
  message,
  operations,
}: CommitWebGithubChangesetArgs): Promise<RepoChangesetCommitResult> {
  const refPayload = await githubFetch<GitRefResponse>(
    buildRepoPath(owner, repo, `/git/ref/heads/${branch}`)
  );
  const headSha = refPayload.object?.sha?.trim() || '';
  if (!headSha) {
    throw new Error('GitHub ref response missing commit sha');
  }

  const commitPayload = await githubFetch<GitCommitResponse>(
    buildRepoPath(owner, repo, `/git/commits/${headSha}`)
  );
  const baseTreeSha = commitPayload.tree?.sha?.trim() || '';
  if (!baseTreeSha) {
    throw new Error('GitHub commit response missing tree sha');
  }

  const treePayload = await githubFetch<GitTreeResponse>(
    buildRepoPath(owner, repo, `/git/trees/${baseTreeSha}?recursive=1`)
  );
  const currentShas = normalizeTreeShaMap(treePayload.tree);
  const conflicts = detectChangesetConflicts(operations, currentShas);
  if (conflicts.length > 0) {
    return {
      status: 'conflict',
      commit: null,
      conflicts,
      updatedFiles: [],
    };
  }

  const nextTree: GitTreeWriteEntry[] = [];
  const updatedFiles: RepoChangesetCommitResult['updatedFiles'] = [];

  for (const operation of operations) {
    if (operation.operationType === 'delete') {
      nextTree.push({
        path: operation.path,
        mode: '100644',
        type: 'blob',
        sha: null,
      });
      continue;
    }

    const blobSha = await createBlob(
      githubFetch,
      owner,
      repo,
      operation.content ?? ''
    );
    nextTree.push({
      path: operation.path,
      mode: '100644',
      type: 'blob',
      sha: blobSha,
    });
    updatedFiles.push({
      path: operation.path,
      sha: blobSha,
    });
  }

  const createdTree = await githubFetch<{ sha?: string }>(
    buildRepoPath(owner, repo, '/git/trees'),
    {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: nextTree,
      }),
    }
  );
  const nextTreeSha = typeof createdTree.sha === 'string' ? createdTree.sha : '';
  if (!nextTreeSha) {
    throw new Error('GitHub tree response missing sha');
  }

  const createdCommit = await githubFetch<GitCommitResponse>(
    buildRepoPath(owner, repo, '/git/commits'),
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: nextTreeSha,
        parents: [headSha],
      }),
    }
  );
  const nextCommitSha = createdCommit.sha?.trim() || '';
  if (!nextCommitSha) {
    throw new Error('GitHub commit create response missing sha');
  }

  await githubFetch(
    buildRepoPath(owner, repo, `/git/refs/heads/${branch}`),
    {
      method: 'PATCH',
      body: JSON.stringify({
        sha: nextCommitSha,
        force: false,
      }),
    }
  );

  return {
    status: 'committed',
    commit: {
      sha: nextCommitSha,
      message,
      htmlUrl: createdCommit.html_url,
    },
    conflicts: [],
    updatedFiles,
  };
}
