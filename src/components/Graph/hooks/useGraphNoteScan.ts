import { useEffect, useRef, useState } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { collectNoteGraphPaths } from '../model/noteGraph';

export function useGraphNoteScan(args: {
  onPrimaryContentReady?: () => void;
  onStartupReady?: () => void;
}) {
  const rootFolder = useNotesStore((state) => state.rootFolder);
  const rootFolderPath = useNotesStore((state) => state.rootFolderPath);
  const notesPath = useNotesStore((state) => state.notesPath);
  const scanAllNotes = useNotesStore((state) => state.scanAllNotes);
  const currentNotesRootPath = useNotesRootStore((state) => state.currentNotesRoot?.path ?? null);
  const [loading, setLoading] = useState(false);
  const [completedScan, setCompletedScan] = useState<{
    currentNotesRootPath: string | null;
    notesPath: string;
    rootFolder: typeof rootFolder;
    rootFolderPath: string | null;
  } | null>(null);
  const readyReportedRef = useRef(false);
  const primaryContentReadyRef = useRef(args.onPrimaryContentReady);
  primaryContentReadyRef.current = args.onPrimaryContentReady;

  useEffect(() => {
    if (readyReportedRef.current) return;
    readyReportedRef.current = true;
    args.onStartupReady?.();
  }, [args.onStartupReady]);

  useEffect(() => {
    if (!rootFolder || !notesPath || rootFolderPath !== notesPath) {
      setLoading(false);
      primaryContentReadyRef.current?.();
      return;
    }

    const abortController = new AbortController();
    let primaryContentReported = false;
    const reportPrimaryContentReady = () => {
      if (abortController.signal.aborted || primaryContentReported) return;
      primaryContentReported = true;
      setCompletedScan({ currentNotesRootPath, notesPath, rootFolder, rootFolderPath });
      setLoading(false);
      primaryContentReadyRef.current?.();
    };
    setLoading(true);
    void scanAllNotes({
      background: true,
      signal: abortController.signal,
      priorityPaths: collectNoteGraphPaths(rootFolder.children),
      onPriorityPathsScanned: reportPrimaryContentReady,
    })
      .catch(() => undefined)
      .finally(() => {
        reportPrimaryContentReady();
      });

    return () => abortController.abort();
  }, [currentNotesRootPath, notesPath, rootFolder, rootFolderPath, scanAllNotes]);

  const scanPending = Boolean(
    rootFolder
    && notesPath
    && rootFolderPath === notesPath
    && (
      completedScan?.currentNotesRootPath !== currentNotesRootPath
      || completedScan?.notesPath !== notesPath
      || completedScan?.rootFolder !== rootFolder
      || completedScan?.rootFolderPath !== rootFolderPath
    )
  );

  return loading || scanPending;
}
