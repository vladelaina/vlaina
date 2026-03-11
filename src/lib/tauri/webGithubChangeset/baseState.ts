import type {
  ChangesetBaseState,
  WebGitCommitLookupResponse,
  WebGithubChangesetFetch,
  WebGitReferenceResponse,
  WebGitTreeResponse,
} from './types';

export async function loadChangesetBaseState(
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
