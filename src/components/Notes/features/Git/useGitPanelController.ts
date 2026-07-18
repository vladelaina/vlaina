import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToastStore } from '@/stores/useToastStore';
import { flushCurrentTitleCommit } from '../Editor/utils/titleCommitRegistry';
import { flushCurrentEditorSave } from '../Editor/utils/editorSaveRegistry';
import type {
  GitBridge,
  GitHistoryItem,
  GitPanelTab,
  GitStatus,
} from './gitUiTypes';
import { createLocalDateTimeValue } from './gitUiTypes';
import { useGitOperationRunner } from './useGitOperationRunner';
import { useGitWorkingDiff } from './useGitWorkingDiff';
import { useGitCommitDiff } from './useGitCommitDiff';

export function useGitPanelController({
  git,
  rootPath,
  open,
}: {
  git: GitBridge;
  rootPath: string;
  open: boolean;
}) {
  const { t } = useI18n();
  const addToast = useToastStore((state) => state.addToast);
  const rootPathRef = useRef(rootPath);
  const statusRef = useRef<GitStatus | null>(null);
  const statusRefreshInFlightRef = useRef(false);
  const remoteCheckPromiseRef = useRef<Promise<void> | null>(null);
  const openPreparationRef = useRef(0);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<GitPanelTab>('changes');
  const [history, setHistory] = useState<GitHistoryItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedCommitPaths, setSelectedCommitPaths] = useState<Set<string>>(new Set());
  const [panelReady, setPanelReady] = useState(false);

  rootPathRef.current = rootPath;

  const reportOperationFailure = useCallback(() => {
    addToast(t('git.operationFailed'), 'error');
  }, [addToast, t]);
  const saveBeforePanelOpen = useCallback(() => (
    flushCurrentTitleCommit().then(() => flushCurrentEditorSave()).catch(() => undefined)
  ), []);
  const workingDiff = useGitWorkingDiff({
    git, open: open && panelReady, reportFailure: reportOperationFailure, rootPath, status,
  });
  const {
    clear: clearCommitDiff,
    diff: selectedCommitDiff,
    loading: commitDiffLoading,
    select: selectCommit,
    selectedHash: selectedCommitHash,
  } = useGitCommitDiff({ git, reportFailure: reportOperationFailure, rootPath });

  const clearSelections = useCallback(() => {
    workingDiff.clear();
    clearCommitDiff();
  }, [clearCommitDiff, workingDiff.clear]);

  const applyMutationStatus = useCallback((requestRoot: string, nextStatus: GitStatus) => {
    if (rootPathRef.current !== requestRoot) return;
    statusRef.current = nextStatus;
    setStatus(nextStatus);
    setSelectedCommitPaths(new Set(nextStatus.changes.map((change) => change.path)));
    setHistory(null);
    clearSelections();
  }, [clearSelections]);
  const { operation, runMutation } = useGitOperationRunner({
    applyStatus: applyMutationStatus,
    reportFailure: reportOperationFailure,
    rootPath,
  });

  const applyRefreshedStatus = useCallback((requestRoot: string, nextStatus: GitStatus | null) => {
    if (rootPathRef.current !== requestRoot) return;
    const previousStatus = statusRef.current;
    if (JSON.stringify(previousStatus) === JSON.stringify(nextStatus)) return;
    statusRef.current = nextStatus;
    setStatus(nextStatus);
    setSelectedCommitPaths((current) => {
      const previousPaths = new Set(previousStatus?.changes.map((change) => change.path) ?? []);
      return new Set(nextStatus?.changes.filter((change) => (
        !previousPaths.has(change.path) || current.has(change.path)
      )).map((change) => change.path) ?? []);
    });
  }, []);

  const refreshStatus = useCallback(async (silent = false) => {
    if (statusRefreshInFlightRef.current) return;
    const requestRoot = rootPath;
    statusRefreshInFlightRef.current = true;
    if (!silent) setStatusLoading(true);
    try {
      const nextStatus = await git.status(requestRoot);
      applyRefreshedStatus(requestRoot, nextStatus);
    } catch {
      if (rootPathRef.current === requestRoot) reportOperationFailure();
    } finally {
      statusRefreshInFlightRef.current = false;
      if (!silent && rootPathRef.current === requestRoot) setStatusLoading(false);
    }
  }, [applyRefreshedStatus, git, reportOperationFailure, rootPath]);

  const loadHistory = useCallback(async () => {
    const requestRoot = rootPath;
    setHistoryLoading(true);
    try {
      const nextHistory = await git.history(requestRoot, 30);
      if (rootPathRef.current === requestRoot) setHistory(nextHistory);
    } catch {
      if (rootPathRef.current === requestRoot) reportOperationFailure();
    } finally {
      if (rootPathRef.current === requestRoot) setHistoryLoading(false);
    }
  }, [git, reportOperationFailure, rootPath]);

  useEffect(() => {
    statusRef.current = null;
    setStatus(null);
    setSelectedCommitPaths(new Set());
    setHistory(null);
    setActiveTab('changes');
    setPanelReady(false);
    clearSelections();
  }, [clearSelections, rootPath]);

  useEffect(() => {
    const requestId = ++openPreparationRef.current;
    if (!open) {
      setPanelReady(false);
      clearSelections();
      return;
    }
    const requestRoot = rootPath;
    setPanelReady(false);
    workingDiff.clear();
    void saveBeforePanelOpen().then(() => {
      if (openPreparationRef.current !== requestId) return;
      setPanelReady(true);
      if (remoteCheckPromiseRef.current) return;
      const remoteCheck = refreshStatus().then(async () => {
        try {
          const nextStatus = await git.fetch(requestRoot);
          applyRefreshedStatus(requestRoot, nextStatus);
        } catch {
          // Remote availability must not block local Git workflows.
        }
      }).finally(() => {
        if (remoteCheckPromiseRef.current === remoteCheck) remoteCheckPromiseRef.current = null;
      });
      remoteCheckPromiseRef.current = remoteCheck;
    });
    return () => {
      if (openPreparationRef.current === requestId) openPreparationRef.current += 1;
    };
  }, [applyRefreshedStatus, clearSelections, git, open, refreshStatus, rootPath, saveBeforePanelOpen, workingDiff.clear]);

  useEffect(() => {
    if (!open || !panelReady) return;
    const refreshOnFocus = () => void refreshStatus(true);
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') void refreshStatus(true);
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisibility);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, [open, panelReady, refreshStatus]);

  useEffect(() => {
    const historyVisible = activeTab === 'history' || status?.changes.length === 0;
    if (!open || !panelReady || !historyVisible || history !== null || historyLoading) return;
    void loadHistory();
  }, [activeTab, history, historyLoading, loadHistory, open, panelReady, status?.changes.length]);

  useEffect(() => {
    const historyVisible = activeTab === 'history' || status?.changes.length === 0;
    if (!open || !panelReady || !historyVisible || !history?.length || selectedCommitHash) return;
    selectCommit(history[0]);
  }, [activeTab, history, open, panelReady, selectCommit, selectedCommitHash, status?.changes.length]);

  const commit = useCallback(() => {
    const message = commitMessage.trim();
    const selectedChanges = status?.changes.filter((change) => selectedCommitPaths.has(change.path)) ?? [];
    const paths = Array.from(new Set(selectedChanges.flatMap((change) => (
      change.previousPath ? [change.previousPath, change.path] : [change.path]
    ))));
    if (!message || paths.length === 0) return;
    void runMutation('commit', true, (requestRoot) => git.commit(requestRoot, {
      message,
      paths,
    }), 'git.commitSuccess').then((committed) => {
      if (!committed) return;
      setCommitMessage('');
    });
  }, [commitMessage, git, runMutation, selectedCommitPaths, status?.changes]);

  const toggleCommitPath = useCallback((path: string) => {
    setSelectedCommitPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleAllCommitPaths = useCallback(() => {
    const changePaths = status?.changes.map((change) => change.path) ?? [];
    setSelectedCommitPaths((current) => (
      current.size === changePaths.length ? new Set() : new Set(changePaths)
    ));
  }, [status?.changes]);

  const pull = useCallback(() => {
    void runMutation('pull', true, async (requestRoot) => {
      await remoteCheckPromiseRef.current;
      return git.pull(requestRoot);
    }, 'git.pullSuccess');
  }, [git, runMutation]);

  const push = useCallback(() => {
    void runMutation('push', false, async (requestRoot) => {
      await remoteCheckPromiseRef.current;
      return git.push(requestRoot);
    }, 'git.pushSuccess');
  }, [git, runMutation]);

  return {
    status, statusLoading, operation, activeTab, setActiveTab, refreshStatus,
    workingDiffByPath: workingDiff.diffByPath, workingDiffLoading: workingDiff.loading,
    history: history ?? [], historyLoading, selectedCommitHash, selectedCommitDiff,
    commitDiffLoading, selectCommit, commitMessage, setCommitMessage,
    useCurrentTimeAsMessage: () => setCommitMessage(createLocalDateTimeValue()),
    selectedCommitPaths, toggleCommitPath, toggleAllCommitPaths,
    commit, pull, push,
  };
}
