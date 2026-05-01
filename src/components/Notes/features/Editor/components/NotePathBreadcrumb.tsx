import { useEffect, useMemo, useState } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { useVaultStore } from '@/stores/useVaultStore';
import { useDisplayName } from '@/hooks/useTitleSync';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { getCachedDesktopHomePath, getDesktopHomePath } from '@/lib/desktop/homePath';
import { getParentPath, isAbsolutePath, normalizePath, relativePath } from '@/lib/storage/adapter';
import { getDraftNoteEntry, isDraftNotePath, resolveDraftNoteTitle } from '@/stores/notes/draftNote';
import { cn } from '@/lib/utils';
import { scheduleSidebarItemIntoView } from '@/components/Notes/features/common/sidebarScrollIntoView';

interface NotePathBreadcrumbProps {
  notePath: string;
}

interface FolderSegment {
  label: string;
  fullPath: string;
}

interface BreadcrumbDisplayPath {
  rootLabel: string;
  rootPath: string;
  displayPath: string;
  isAbsolute: boolean;
}

function toRelativePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function compressHomePath(path: string, homePath: string | null): string {
  if (!homePath) {
    return path;
  }

  const normalizedPath = toRelativePath(path);
  const normalizedHome = toRelativePath(homePath).replace(/\/+$/, '');
  if (normalizedPath === normalizedHome) {
    return '~';
  }
  if (normalizedPath.startsWith(`${normalizedHome}/`)) {
    return `~/${normalizedPath.slice(normalizedHome.length + 1)}`;
  }

  return path;
}

function resolveDisplayPath(
  notePath: string,
  notesPath: string | undefined,
  vaultName: string,
  homePath: string | null
): BreadcrumbDisplayPath {
  const normalizedNote = toRelativePath(notePath);
  if (isAbsolutePath(notePath)) {
    const compressedPath = compressHomePath(normalizedNote, homePath);
    const isHomeRelative = compressedPath === '~' || compressedPath.startsWith('~/');
    const rootLabel = isHomeRelative
      ? '~'
      : /^[a-zA-Z]:\//.test(compressedPath)
        ? compressedPath.slice(0, 2)
        : '/';
    const rootPath = isHomeRelative
      ? homePath ?? getParentPath(normalizedNote) ?? normalizedNote
      : rootLabel === '/'
        ? '/'
        : `${rootLabel}/`;
    const displayPath = isHomeRelative
      ? compressedPath === '~'
        ? ''
        : compressedPath.slice(2)
      : rootLabel === '/'
        ? compressedPath.replace(/^\/+/, '')
        : compressedPath.slice(rootLabel.length).replace(/^\/+/, '');

    return {
      rootLabel,
      rootPath,
      displayPath,
      isAbsolute: true,
    };
  }

  if (!notesPath) {
    return {
      rootLabel: vaultName,
      rootPath: '',
      displayPath: normalizedNote,
      isAbsolute: false,
    };
  }

  const normalizedBase = toRelativePath(notesPath).replace(/\/+$/, '');
  if (normalizedNote === normalizedBase) {
    return { rootLabel: vaultName, rootPath: '', displayPath: '', isAbsolute: false };
  }
  if (normalizedNote.startsWith(`${normalizedBase}/`)) {
    return {
      rootLabel: vaultName,
      rootPath: '',
      displayPath: normalizedNote.slice(normalizedBase.length + 1),
      isAbsolute: false,
    };
  }
  return {
    rootLabel: vaultName,
    rootPath: '',
    displayPath: normalizedNote,
    isAbsolute: false,
  };
}

function expandDisplayPath(displayPath: string, homePath: string | null): string {
  if (displayPath === '~') {
    return homePath ?? displayPath;
  }
  if (displayPath.startsWith('~/')) {
    return homePath ? `${homePath.replace(/\/+$/, '')}/${displayPath.slice(2)}` : displayPath;
  }
  return displayPath;
}

function resolveNotePathWithinDirectory(notePath: string, directoryPath: string): string | null {
  const normalizedNote = normalizePath(notePath, true);
  const normalizedDirectory = normalizePath(directoryPath, true).replace(/\/+$/, '');

  if (!normalizedDirectory || normalizedNote === normalizedDirectory) {
    return null;
  }

  const directoryPrefix = normalizedDirectory === '/' ? '/' : `${normalizedDirectory}/`;
  if (!normalizedNote.startsWith(directoryPrefix)) {
    return null;
  }

  return relativePath(normalizedDirectory, normalizedNote);
}

function buildFolderSegments(
  displayPath: string,
  isAbsolute: boolean,
  rootPath: string,
  homePath: string | null
): FolderSegment[] {
  const relativePath = toRelativePath(displayPath);
  const parts = relativePath.split('/').filter(Boolean);
  const folderParts = parts.slice(0, -1);

  return folderParts.map((label, index) => ({
    label,
    fullPath: isAbsolute
      ? expandDisplayPath(`${rootPath.replace(/\/+$/, '')}/${folderParts.slice(0, index + 1).join('/')}`, homePath)
      : folderParts.slice(0, index + 1).join('/'),
  }));
}

export function NotePathBreadcrumb({ notePath }: NotePathBreadcrumbProps) {
  const notesPath = useNotesStore((s) => s.notesPath);
  const draftNotes = useNotesStore((s) => s.draftNotes);
  const revealFolder = useNotesStore((s) => s.revealFolder);
  const setPendingStarredNavigation = useNotesStore((s) => s.setPendingStarredNavigation);
  const vaultName = useVaultStore((s) => s.currentVault?.name ?? 'Root');
  const openVault = useVaultStore((s) => s.openVault);
  const [homePath, setHomePath] = useState(() => getCachedDesktopHomePath());
  const displayName = useDisplayName(notePath);
  const draftNote = getDraftNoteEntry(draftNotes, notePath);
  const breadcrumbPath = draftNote?.parentPath
    ? `${draftNote.parentPath}/${resolveDraftNoteTitle(draftNote.name)}`
    : isDraftNotePath(notePath)
      ? resolveDraftNoteTitle(draftNote?.name)
      : notePath;

  useEffect(() => {
    if (!isAbsolutePath(notePath)) {
      return;
    }

    let cancelled = false;
    void getDesktopHomePath().then((path) => {
      if (!cancelled) {
        setHomePath(path);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [notePath]);

  const displayInfo = useMemo(
    () => resolveDisplayPath(breadcrumbPath, notesPath, vaultName, homePath),
    [breadcrumbPath, homePath, notesPath, vaultName]
  );
  const displayPath = displayInfo.displayPath;
  const folderSegments = useMemo(
    () => buildFolderSegments(displayPath, displayInfo.isAbsolute, displayInfo.rootPath, homePath),
    [displayInfo.isAbsolute, displayInfo.rootPath, displayPath, homePath]
  );
  const noteLabel = useMemo(() => {
    if (displayName?.trim()) return displayName.trim();
    return getNoteTitleFromPath(displayPath);
  }, [displayPath, displayName]);
  const isUnsavedDraft = Boolean(draftNote);

  const setNotesSidebarView = useUIStore((s) => s.setNotesSidebarView);

  const openAbsoluteDirectoryInSidebar = async (targetPath: string) => {
    setNotesSidebarView('workspace');

    const relativeNotePath = resolveNotePathWithinDirectory(notePath, targetPath);
    if (relativeNotePath) {
      setPendingStarredNavigation({
        vaultPath: targetPath,
        kind: 'note',
        relativePath: relativeNotePath,
        skipWorkspaceRestore: true,
      });
    }

    const opened = await openVault(targetPath);
    if (!opened && relativeNotePath) {
      setPendingStarredNavigation(null);
    }
  };

  const handleFolderClick = (targetPath: string) => {
    setNotesSidebarView('workspace');
    if (displayInfo.isAbsolute) {
      void openAbsoluteDirectoryInSidebar(targetPath);
      return;
    }

    revealFolder(targetPath);
    scheduleSidebarItemIntoView(targetPath, 2, 'start');
  };

  const handleRootClick = () => {
    setNotesSidebarView('workspace');
    if (displayInfo.isAbsolute) {
      void openAbsoluteDirectoryInSidebar(displayInfo.rootPath || getParentPath(notePath) || notePath);
      return;
    }

    const revealPath = folderSegments[folderSegments.length - 1]?.fullPath ?? '';
    useNotesStore.getState().revealFolder(revealPath);
    requestAnimationFrame(() => {
      const scrollRoot = document.querySelector<HTMLElement>('[data-notes-sidebar-scroll-root="true"]');
      if (scrollRoot) scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleNoteClick = () => {
    setNotesSidebarView('workspace');

    if (displayInfo.isAbsolute) {
      const relativeNotePath = notesPath ? resolveNotePathWithinDirectory(notePath, notesPath) : null;
      if (relativeNotePath) {
        revealFolder(relativeNotePath);
        scheduleSidebarItemIntoView(relativeNotePath, 2);
        return;
      }

      const parentPath = getParentPath(notePath);
      if (parentPath) {
        void openAbsoluteDirectoryInSidebar(parentPath);
      }
      return;
    }

    revealFolder(notePath);
    scheduleSidebarItemIntoView(notePath, 2);
  };

  const noteButton = (
    <button
      type="button"
      onClick={handleNoteClick}
      className="max-w-[360px] truncate rounded px-1 py-0 text-[var(--vlaina-text-secondary)] transition-colors hover:bg-[var(--vlaina-hover-filled)] hover:text-[var(--vlaina-text-primary)]"
    >
      {noteLabel}
    </button>
  );

  return (
    <div className="h-4 flex items-center mb-1">
      {!isUnsavedDraft ? (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0 text-[12px] leading-none opacity-0 transition-opacity duration-150 group-hover/note-title:opacity-100 group-focus-within/note-title:opacity-100">
          <>
            <button
              type="button"
              onClick={handleRootClick}
              className={cn(
                'rounded px-1 py-0 text-[var(--vlaina-text-tertiary)] transition-colors hover:bg-[var(--vlaina-hover-filled)] hover:text-[var(--vlaina-text-primary)]'
              )}
            >
              {displayInfo.rootLabel}
            </button>
            <span className="text-[var(--vlaina-text-disabled)]">/</span>

            {folderSegments.map((segment, index) => (
              <div key={segment.fullPath} className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleFolderClick(segment.fullPath)}
                  className={cn(
                    'rounded px-1 py-0 text-[var(--vlaina-text-tertiary)] transition-colors hover:bg-[var(--vlaina-hover-filled)] hover:text-[var(--vlaina-text-primary)]'
                  )}
                >
                  {segment.label}
                </button>
                <span className="text-[var(--vlaina-text-disabled)]">/</span>
                {index === folderSegments.length - 1 && noteButton}
              </div>
            ))}

            {folderSegments.length === 0 && noteButton}
          </>
        </div>
      ) : null}
    </div>
  );
}
