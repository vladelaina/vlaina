import type { RepoChangeOperation, RepoCommitConflict } from './types';

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
