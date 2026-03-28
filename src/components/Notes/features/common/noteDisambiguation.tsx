import { useMemo } from 'react';
import { useDisplayName } from '@/hooks/useTitleSync';
import { useNotesStore, type FolderNode, type NoteFile } from '@/stores/useNotesStore';
import { getNoteTitleFromPath, normalizeNotePathKey } from '@/lib/notes/displayName';
import { buildDuplicateLabelRegistry } from '@/lib/labels/disambiguation';
import { cn } from '@/lib/utils';

interface NoteDisambiguatedTitleProps {
  path: string;
  fallbackName?: string;
  className?: string;
  titleClassName?: string;
  hintClassName?: string;
}

interface NoteLabelDescriptor {
  title: string;
  disambiguation: string | null;
}

const duplicateHintCache = new WeakMap<
  FolderNode,
  WeakMap<Map<string, string>, Map<string, string>>
>();

function collectNoteCandidates(
  nodes: readonly (FolderNode | NoteFile)[],
  displayNames: Map<string, string>,
  candidates: Array<{ id: string; label: string; hintSegments: string[] }>
) {
  for (const node of nodes) {
    if (node.isFolder) {
      collectNoteCandidates(node.children, displayNames, candidates);
      continue;
    }

    candidates.push({
      id: node.path,
      label: (displayNames.get(node.path)?.trim() || getNoteTitleFromPath(node.path)).trim(),
      hintSegments: getParentSegments(node.path),
    });
  }
}

function getParentSegments(path: string) {
  const normalizedPath = normalizeNotePathKey(path) ?? path;
  const segments = normalizedPath.split('/').filter(Boolean).slice(0, -1);
  return segments.length > 0 ? segments : ['Root'];
}

function buildDuplicateHintRegistry(rootFolder: FolderNode, displayNames: Map<string, string>) {
  const cachedDisplayNames = duplicateHintCache.get(rootFolder);
  const cached = cachedDisplayNames?.get(displayNames);
  if (cached) {
    return cached;
  }

  const candidates: Array<{ id: string; label: string; hintSegments: string[] }> = [];
  collectNoteCandidates(rootFolder.children, displayNames, candidates);
  const registry = buildDuplicateLabelRegistry(candidates);

  const nextDisplayNamesCache = cachedDisplayNames ?? new WeakMap<Map<string, string>, Map<string, string>>();
  nextDisplayNamesCache.set(displayNames, registry);
  if (!cachedDisplayNames) {
    duplicateHintCache.set(rootFolder, nextDisplayNamesCache);
  }

  return registry;
}

export function useNoteLabelDescriptor(path: string, fallbackName?: string): NoteLabelDescriptor {
  const displayName = useDisplayName(path);
  const rootFolder = useNotesStore((state) => state.rootFolder);
  const displayNames = useNotesStore((state) => state.displayNames);

  return useMemo(() => {
    const title = displayName?.trim() || fallbackName?.trim() || getNoteTitleFromPath(path);
    if (!rootFolder) {
      return { title, disambiguation: null };
    }

    const registry = buildDuplicateHintRegistry(rootFolder, displayNames);
    return {
      title,
      disambiguation: registry.get(path) ?? null,
    };
  }, [displayName, displayNames, fallbackName, path, rootFolder]);
}

export function NoteDisambiguatedTitle({
  path,
  fallbackName,
  className,
  titleClassName,
  hintClassName,
}: NoteDisambiguatedTitleProps) {
  const { title, disambiguation } = useNoteLabelDescriptor(path, fallbackName);

  return (
    <span className={cn('block truncate', className)}>
      <span className={titleClassName}>{title}</span>
      {disambiguation ? (
        <span className={cn('text-[11px]', hintClassName)}>{` · ${disambiguation}`}</span>
      ) : null}
    </span>
  );
}
