import { useCallback, useEffect, useRef, useState } from 'react';
import type { GitBridge, GitStatus } from './gitUiTypes';

export function useGitWorkingDiff({
  git,
  open,
  reportFailure,
  rootPath,
  status,
}: {
  git: GitBridge;
  open: boolean;
  reportFailure: () => void;
  rootPath: string;
  status: GitStatus | null;
}) {
  const requestRef = useRef(0);
  const [diffByPath, setDiffByPath] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const clear = useCallback(() => {
    requestRef.current += 1;
    setDiffByPath({});
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open || !status) return;
    const requestId = ++requestRef.current;
    if (status.changes.length === 0) {
      clear();
      return;
    }

    setDiffByPath({});
    setLoading(true);
    const loadDiffs = async () => {
      const nextDiffByPath: Record<string, string> = {};
      for (let index = 0; index < status.changes.length; index += 4) {
        if (requestRef.current !== requestId) return;
        const batchChanges = status.changes.slice(index, index + 4);
        const batchDiffs = await Promise.all(batchChanges.map((change) => (
          git.workingDiff(rootPath, change.path)
        )));
        batchChanges.forEach((change, batchIndex) => {
          nextDiffByPath[change.path] = batchDiffs[batchIndex] ?? '';
        });
        if (requestRef.current === requestId) {
          setDiffByPath({ ...nextDiffByPath });
        }
      }
    };
    void loadDiffs().catch(() => {
      if (requestRef.current === requestId) reportFailure();
    }).finally(() => {
      if (requestRef.current === requestId) setLoading(false);
    });
    return () => {
      if (requestRef.current === requestId) requestRef.current += 1;
    };
  }, [clear, git, open, reportFailure, rootPath, status]);

  return { clear, diffByPath, loading };
}
