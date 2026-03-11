import type {
  CreatedTreeEntry,
  CreatedTreePayload,
  RepoChangeOperation,
  WebCreatedBlobResponse,
  WebCreatedCommitResponse,
  WebCreatedTreeResponse,
  WebGithubChangesetFetch,
} from './types';

export async function createChangesetTreePayload(
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

export async function createChangesetCommit(
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

export async function updateBranchReference(
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
