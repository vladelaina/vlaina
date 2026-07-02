import { useEffect, useRef, useState } from 'react';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { suppressNextCurrentNoteSidebarReveal } from '../common/sidebarScrollIntoView';
import type { NotesSidebarSearchResult } from './notesSidebarSearchResults';
import type { NotesSidebarTagPath } from './notesSidebarTags';

type CurrentEditorView = Awaited<
  ReturnType<typeof import('../Editor/utils/editorViewRegistry')['getCurrentEditorView']>
>;

interface PendingNavigation {
  path: string;
  query: string;
  contentMatchOrdinal: number | null;
  previousView: CurrentEditorView;
}

export function useSidebarContentNavigation({
  active,
  currentNotePath,
  deferredSearchQuery,
  effectiveSearchOpen,
  effectiveSearchQuery,
  openNote,
  openNoteByAbsolutePath,
  searchResults,
}: {
  active: boolean;
  currentNotePath?: string | null;
  deferredSearchQuery: string;
  effectiveSearchOpen: boolean;
  effectiveSearchQuery: string;
  openNote: (path: string) => Promise<unknown>;
  openNoteByAbsolutePath: (path: string) => Promise<unknown>;
  searchResults: NotesSidebarSearchResult[];
}) {
  const previousSearchQueryRef = useRef(effectiveSearchQuery);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [activeSearchResultId, setActiveSearchResultId] = useState<string | null>(null);
  const [selectedSearchResultIndex, setSelectedSearchResultIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (previousSearchQueryRef.current !== effectiveSearchQuery) {
      previousSearchQueryRef.current = effectiveSearchQuery;
      setActiveSearchResultId(null);
      setSelectedSearchResultIndex(0);
    }

    if (effectiveSearchOpen && effectiveSearchQuery.trim().length > 0) {
      return;
    }

    void import('./sidebarSearchNavigation').then((mod) => {
      mod.clearSidebarSearchHighlights();
      mod.clearSidebarSearchNavigationPending();
    }).catch(() => undefined);
    setPendingNavigation(null);
    setActiveSearchResultId(null);
    setSelectedSearchResultIndex(0);
  }, [active, effectiveSearchOpen, effectiveSearchQuery]);

  useEffect(() => {
    if (!activeSearchResultId) {
      return;
    }

    if (!searchResults.some((result) => result.id === activeSearchResultId)) {
      setActiveSearchResultId(null);
    }
  }, [activeSearchResultId, searchResults]);

  useEffect(() => {
    setSelectedSearchResultIndex((current) => {
      if (!active || searchResults.length === 0) {
        return 0;
      }

      return Math.min(current, searchResults.length - 1);
    });
  }, [active, searchResults.length]);

  useEffect(() => {
    if (!pendingNavigation || currentNotePath !== pendingNavigation.path) {
      return;
    }

    let cancelled = false;

    void import('./sidebarSearchNavigation')
      .then((mod) => mod.applySidebarSearchNavigation({
        path: pendingNavigation.path,
        query: pendingNavigation.query,
        contentMatchOrdinal: pendingNavigation.contentMatchOrdinal,
        previousView: pendingNavigation.previousView,
        shouldContinue: () => !cancelled,
      }))
      .finally(() => {
        if (!cancelled) {
          setPendingNavigation((current) =>
            current === pendingNavigation ? null : current,
          );
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [currentNotePath, pendingNavigation]);

  const handleOpenSearchResult = (result: NotesSidebarSearchResult) => {
    const targetPath = result.openPath ?? result.path;
    const isSameNote = currentNotePath === targetPath;
    void Promise.all([
      import('../Editor/utils/editorViewRegistry'),
      import('./sidebarSearchNavigation'),
    ]).then(([editorViewRegistry, searchNavigation]) => {
      const previousView = isSameNote ? null : editorViewRegistry.getCurrentEditorView();
      const nextNavigation = {
        path: targetPath,
        query: deferredSearchQuery,
        contentMatchOrdinal: result.contentMatchOrdinal,
        previousView,
      };

      if (!isSameNote) {
        searchNavigation.markSidebarSearchNavigationPending(targetPath);
      }
      setPendingNavigation(nextNavigation);
      setActiveSearchResultId(result.id);

      if (isSameNote) {
        return;
      }

      const openPromise = result.isExternal
        ? openNoteByAbsolutePath(targetPath)
        : openNote(targetPath);

      void openPromise.catch(() => {
        searchNavigation.clearSidebarSearchNavigationPending(targetPath);
        setActiveSearchResultId((current) => (current === result.id ? null : current));
        setPendingNavigation((current) =>
          current === nextNavigation ? null : current,
        );
      });
    }).catch(() => undefined);
  };

  const handleOpenTagPath = (target: NotesSidebarTagPath) => {
    const isSameNote = currentNotePath === target.path;
    if (!isSameNote && !isAbsolutePath(target.path)) {
      suppressNextCurrentNoteSidebarReveal(target.path);
    }

    void Promise.all([
      import('../Editor/utils/editorViewRegistry'),
      import('./sidebarSearchNavigation'),
    ]).then(([editorViewRegistry, searchNavigation]) => {
      const previousView = isSameNote ? null : editorViewRegistry.getCurrentEditorView();
      const nextNavigation = {
        path: target.path,
        query: target.query,
        contentMatchOrdinal: target.contentMatchOrdinal,
        previousView,
      };

      if (!isSameNote) {
        searchNavigation.markSidebarSearchNavigationPending(target.path);
      }
      setPendingNavigation(nextNavigation);

      if (isSameNote) {
        return;
      }

      const openPromise = isAbsolutePath(target.path)
        ? openNoteByAbsolutePath(target.path)
        : openNote(target.path);

      void openPromise.catch(() => {
        searchNavigation.clearSidebarSearchNavigationPending(target.path);
        setPendingNavigation((current) =>
          current === nextNavigation ? null : current,
        );
      });
    });
  };

  const selectPreviousSearchResult = () => {
    setSelectedSearchResultIndex((current) => {
      if (searchResults.length === 0) {
        return 0;
      }

      return (current - 1 + searchResults.length) % searchResults.length;
    });
  };

  const selectNextSearchResult = () => {
    setSelectedSearchResultIndex((current) => {
      if (searchResults.length === 0) {
        return 0;
      }

      return (current + 1) % searchResults.length;
    });
  };

  return {
    activeSearchResultId,
    handleOpenSearchResult,
    handleOpenTagPath,
    selectedSearchResult: searchResults[selectedSearchResultIndex] ?? null,
    selectNextSearchResult,
    selectPreviousSearchResult,
  };
}
