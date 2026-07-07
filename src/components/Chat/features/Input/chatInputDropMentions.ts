import { authorizeExternalNoteMentionPath } from '@/lib/ai/authorizedExternalNoteMentions';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { isSupportedMarkdownPath, stripSupportedMarkdownExtension } from '@/lib/notes/markdownFile';
import { getDroppedExternalPaths } from '@/components/Notes/hooks/externalDropPayload';
import { normalizeNotesRootRelativePath } from '@/stores/notes/utils/fs/notesRootPathContainment';

const CHAT_DROP_REGION_SELECTOR = '[data-chat-view-mode],[data-notes-chat-panel="true"],[data-chat-input="true"]';

function normalizeDroppedPathForCompare(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized === '/' ? normalized : normalized.replace(/\/+$/, '');
}

function compareDroppedPath(path: string): string {
  return /^[A-Za-z]:/.test(path) || path.startsWith('//') ? path.toLowerCase() : path;
}

function getDroppedNotesRootRelativePath(absolutePath: string, notesRootPath: string): string | null {
  const containedPath = normalizeContainedAssetPath(absolutePath, notesRootPath);
  if (!containedPath) {
    return null;
  }

  const rootPath = normalizeDroppedPathForCompare(notesRootPath);
  const candidatePath = normalizeDroppedPathForCompare(containedPath);
  const rootComparePath = compareDroppedPath(rootPath);
  const candidateComparePath = compareDroppedPath(candidatePath);
  if (candidateComparePath === rootComparePath) {
    return null;
  }
  if (!candidateComparePath.startsWith(`${rootComparePath === '/' ? '' : rootComparePath}/`)) {
    return null;
  }

  const relativePath = rootPath === '/'
    ? candidatePath.slice(1)
    : candidatePath.slice(rootPath.length + 1);
  return normalizeNotesRootRelativePath(relativePath);
}

function getDroppedExternalMarkdownTitle(path: string): string {
  const name = path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path;
  return stripSupportedMarkdownExtension(name);
}

export function buildDroppedNoteMentions(
  dataTransfer: DataTransfer | null | undefined,
  notesRootPath: string,
  getDisplayName: (path: string) => string,
): NoteMentionReference[] {
  const seenPaths = new Set<string>();
  const mentions: NoteMentionReference[] = [];
  for (const absolutePath of getDroppedExternalPaths(dataTransfer)) {
    const relativePath = notesRootPath ? getDroppedNotesRootRelativePath(absolutePath, notesRootPath) : null;
    const mentionPath = relativePath ?? absolutePath;
    if (!isSupportedMarkdownPath(mentionPath) || seenPaths.has(mentionPath)) {
      continue;
    }
    seenPaths.add(mentionPath);
    if (!relativePath) {
      authorizeExternalNoteMentionPath(absolutePath);
    }
    mentions.push({
      path: mentionPath,
      title: relativePath ? getDisplayName(relativePath) : getDroppedExternalMarkdownTitle(absolutePath),
      kind: 'note',
    });
  }
  return mentions;
}

export function isInsideChatDropRegion(event: DragEvent): boolean {
  if (
    event.target instanceof Element &&
    event.target.closest(CHAT_DROP_REGION_SELECTOR)
  ) {
    return true;
  }

  const elements = document.elementsFromPoint?.(event.clientX, event.clientY) ?? [];
  return elements.some((element) => (
    element instanceof Element &&
    element.closest(CHAT_DROP_REGION_SELECTOR)
  ));
}
