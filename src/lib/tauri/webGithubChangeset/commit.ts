import { loadChangesetBaseState } from './baseState';
import { detectChangesetConflicts } from './conflicts';
import { createChangesetCommit, createChangesetTreePayload, updateBranchReference } from './pipeline';
import type { CommitWebGithubChangesetParams, RepoChangesetCommitResult } from './types';
import { createEmptyCommitResult } from './types';

export async function commitWebGithubChangeset(
  params: CommitWebGithubChangesetParams
): Promise<RepoChangesetCommitResult> {
  const { githubFetch, owner, repo, branch, message, operations } = params;

  if (operations.length === 0) {
    return createEmptyCommitResult();
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
