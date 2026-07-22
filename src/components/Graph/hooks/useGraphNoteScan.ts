import { useEffect, useMemo, useRef, useState } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { createNoteGraphScanInput } from '../model/noteGraph';

export function useGraphNoteScan(args: {
  active?: boolean;
  onPrimaryContentReady?: () => void;
  onStartupReady?: () => void;
}) {
  const active = args.active ?? true;
  const rootFolder = useNotesStore((state) => active ? state.rootFolder : null);
  const rootFolderPath = useNotesStore((state) => active ? state.rootFolderPath : null);
  const notesPath = useNotesStore((state) => active ? state.notesPath : '');
  const scanAllNotes = useNotesStore((state) => state.scanAllNotes);
  const currentNotesRootPath = useNotesRootStore((state) => (
    active ? state.currentNotesRoot?.path ?? null : null
  ));
  const [loading, setLoading] = useState(false);
  const nextScanInput = useMemo(
    () => createNoteGraphScanInput(rootFolder?.children ?? []),
    [rootFolder],
  );
  const scanInputRef = useRef(nextScanInput);
  if (scanInputRef.current.key !== nextScanInput.key) {
    scanInputRef.current = nextScanInput;
  }
  const scanInput = scanInputRef.current;
  const [completedScan, setCompletedScan] = useState<{
    currentNotesRootPath: string | null;
    notesPath: string;
    scanKey: string;
    rootFolderPath: string | null;
  } | null>(null);
  const readyReportedRef = useRef(false);
  const primaryContentReadyRef = useRef(args.onPrimaryContentReady);
  primaryContentReadyRef.current = args.onPrimaryContentReady;

  useEffect(() => {
    if (!active) return;
    if (readyReportedRef.current) return;
    readyReportedRef.current = true;
    args.onStartupReady?.();
  }, [active, args.onStartupReady]);

  useEffect(() => {
    if (!active) {
      setLoading(false);
      return;
    }
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
      setCompletedScan({ currentNotesRootPath, notesPath, scanKey: scanInput.key, rootFolderPath });
      setLoading(false);
      primaryContentReadyRef.current?.();
    };
    setLoading(true);
    void scanAllNotes({
      background: true,
      signal: abortController.signal,
      priorityPaths: scanInput.priorityPaths,
      onPriorityPathsScanned: reportPrimaryContentReady,
    })
      .catch(() => undefined)
      .finally(() => {
        reportPrimaryContentReady();
      });

    return () => abortController.abort();
  }, [active, currentNotesRootPath, notesPath, rootFolderPath, scanAllNotes, scanInput]);

  const scanPending = Boolean(
    active
    && rootFolder
    && notesPath
    && rootFolderPath === notesPath
    && (
      completedScan?.currentNotesRootPath !== currentNotesRootPath
      || completedScan?.notesPath !== notesPath
      || completedScan?.scanKey !== scanInput.key
      || completedScan?.rootFolderPath !== rootFolderPath
    )
  );

  return loading || scanPending;
}
