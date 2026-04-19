import { useMemo } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { useVaultStore } from '@/stores/useVaultStore';
import { useDisplayName } from '@/hooks/useTitleSync';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
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

function toRelativePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function resolveDisplayPath(notePath: string, notesPath: string | undefined): string {
  const normalizedNote = toRelativePath(notePath);
  if (!notesPath) return normalizedNote;

  const normalizedBase = toRelativePath(notesPath).replace(/\/+$/, '');
  if (normalizedNote === normalizedBase) return '';
  if (normalizedNote.startsWith(`${normalizedBase}/`)) {
    return normalizedNote.slice(normalizedBase.length + 1);
  }
  return normalizedNote;
}

function buildFolderSegments(displayPath: string): FolderSegment[] {
  const relativePath = toRelativePath(displayPath);
  const parts = relativePath.split('/').filter(Boolean);
  const folderParts = parts.slice(0, -1);

  return folderParts.map((label, index) => ({
    label,
    fullPath: folderParts.slice(0, index + 1).join('/'),
  }));
}

export function NotePathBreadcrumb({ notePath }: NotePathBreadcrumbProps) {
  const notesPath = useNotesStore((s) => s.notesPath);
  const draftNotes = useNotesStore((s) => s.draftNotes);
  const revealFolder = useNotesStore((s) => s.revealFolder);
  const vaultName = useVaultStore((s) => s.currentVault?.name ?? 'Root');
  const displayName = useDisplayName(notePath);
  const draftNote = getDraftNoteEntry(draftNotes, notePath);
  const breadcrumbPath = draftNote?.parentPath
    ? `${draftNote.parentPath}/${resolveDraftNoteTitle(draftNote.name)}`
    : isDraftNotePath(notePath)
      ? resolveDraftNoteTitle(draftNote?.name)
      : notePath;

  const displayPath = useMemo(() => resolveDisplayPath(breadcrumbPath, notesPath), [breadcrumbPath, notesPath]);
  const folderSegments = useMemo(() => buildFolderSegments(displayPath), [displayPath]);
  const noteLabel = useMemo(() => {
    if (displayName?.trim()) return displayName.trim();
    return getNoteTitleFromPath(displayPath);
  }, [displayPath, displayName]);
  const isUnsavedDraft = Boolean(draftNote);

  const setNotesSidebarView = useUIStore((s) => s.setNotesSidebarView);

  const handleFolderClick = (targetPath: string) => {
    setNotesSidebarView('workspace');
    revealFolder(targetPath);
    scheduleSidebarItemIntoView(targetPath, 2);
  };

  const handleRootClick = () => {
    setNotesSidebarView('workspace');
    const revealPath = folderSegments[folderSegments.length - 1]?.fullPath ?? '';
    useNotesStore.getState().revealFolder(revealPath);
    requestAnimationFrame(() => {
      const scrollRoot = document.querySelector<HTMLElement>('[data-notes-sidebar-scroll-root="true"]');
      if (scrollRoot) scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

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
              {vaultName}
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
                {index === folderSegments.length - 1 && (
                  <span className="max-w-[360px] truncate text-[var(--vlaina-text-secondary)]">{noteLabel}</span>
                )}
              </div>
            ))}

            {folderSegments.length === 0 && (
              <span className="max-w-[360px] truncate text-[var(--vlaina-text-secondary)]">{noteLabel}</span>
            )}
          </>
        </div>
      ) : null}
    </div>
  );
}
