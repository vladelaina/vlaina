import { useMemo } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { useVaultStore } from '@/stores/useVaultStore';
import { useDisplayName } from '@/hooks/useTitleSync';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { findNode } from '@/stores/notes/fileTreeUtils';
import { cn } from '@/lib/utils';

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

function scrollToFolder(path: string): void {
  const elements = document.querySelectorAll<HTMLElement>('[data-file-tree-path]');
  const target = Array.from(elements).find((element) => element.dataset.fileTreePath === path);
  target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function expandFolderChain(targetPath: string): void {
  const parts = targetPath.split('/').filter(Boolean);
  let current = '';

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const state = useNotesStore.getState();
    const root = state.rootFolder;
    if (!root) continue;

    const node = findNode(root.children, current);
    if (node?.isFolder && !node.expanded) {
      state.toggleFolder(current);
    }
  }
}

export function NotePathBreadcrumb({ notePath }: NotePathBreadcrumbProps) {
  const notesPath = useNotesStore((s) => s.notesPath);
  const vaultName = useVaultStore((s) => s.currentVault?.name ?? 'Root');
  const displayName = useDisplayName(notePath);

  const displayPath = useMemo(() => resolveDisplayPath(notePath, notesPath), [notePath, notesPath]);
  const folderSegments = useMemo(() => buildFolderSegments(displayPath), [displayPath]);
  const noteLabel = useMemo(() => {
    if (displayName?.trim()) return displayName.trim();
    return getNoteTitleFromPath(displayPath);
  }, [displayPath, displayName]);

  const setNotesSidebarView = useUIStore((s) => s.setNotesSidebarView);

  const handleFolderClick = (targetPath: string) => {
    setNotesSidebarView('workspace');
    expandFolderChain(targetPath);
    requestAnimationFrame(() => scrollToFolder(targetPath));
  };

  const handleRootClick = () => {
    setNotesSidebarView('workspace');
    const scrollRoot = document.querySelector<HTMLElement>('[data-notes-sidebar-scroll-root="true"]');
    if (scrollRoot) scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="h-4 flex items-center mb-1">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0 text-[12px] leading-none opacity-0 transition-opacity duration-150 group-hover/note-title:opacity-100 group-focus-within/note-title:opacity-100">
        <button
          type="button"
          onClick={handleRootClick}
          className={cn(
            'rounded px-1 py-0 text-[var(--neko-text-tertiary)] transition-colors hover:bg-[var(--neko-hover-filled)] hover:text-[var(--neko-text-primary)]'
          )}
        >
          {vaultName}
        </button>
        <span className="text-[var(--neko-text-disabled)]">/</span>

        {folderSegments.map((segment, index) => (
          <div key={segment.fullPath} className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleFolderClick(segment.fullPath)}
              className={cn(
                'rounded px-1 py-0 text-[var(--neko-text-tertiary)] transition-colors hover:bg-[var(--neko-hover-filled)] hover:text-[var(--neko-text-primary)]'
              )}
            >
              {segment.label}
            </button>
            <span className="text-[var(--neko-text-disabled)]">/</span>
            {index === folderSegments.length - 1 && (
              <span className="max-w-[360px] truncate text-[var(--neko-text-secondary)]">{noteLabel}</span>
            )}
          </div>
        ))}

        {folderSegments.length === 0 && (
          <span className="max-w-[360px] truncate text-[var(--neko-text-secondary)]">{noteLabel}</span>
        )}
      </div>
    </div>
  );
}
