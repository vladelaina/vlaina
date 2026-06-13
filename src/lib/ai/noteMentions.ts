import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import { hasUnsafeVaultPathSegment } from '@/stores/notes/utils/fs/vaultPathContainment';

export interface NoteMentionReference {
  path: string;
  title: string;
  kind?: 'note' | 'folder';
}

export const MAX_NOTE_MENTION_SCAN_ITEMS = 1_000;
export const MAX_NOTE_MENTION_PATH_CHARS = 2_048;
export const MAX_NOTE_MENTION_TITLE_CHARS = 512;
const URL_LIKE_MENTION_PATH_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:[/\\]/;
const WINDOWS_DRIVE_MENTION_PATH_PATTERN = /^[A-Za-z]:[/\\]/;

function normalizeMentionText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isPotentiallyLoadableNoteMentionReference(
  mention: { path?: unknown },
  explicitKind?: NoteMentionReference['kind'],
): boolean {
  const path = normalizeMentionText(mention.path);
  if (
    !path ||
    path.length > MAX_NOTE_MENTION_PATH_CHARS ||
    (
      URL_LIKE_MENTION_PATH_PATTERN.test(path) &&
      !WINDOWS_DRIVE_MENTION_PATH_PATTERN.test(path)
    ) ||
    hasUnsafeVaultPathSegment(path) ||
    hasInternalNotePathSegment(path)
  ) {
    return false;
  }

  return explicitKind !== 'note' || isSupportedMarkdownPath(path);
}

export function dedupeNoteMentions(
  mentions: unknown
): NoteMentionReference[] {
  if (!Array.isArray(mentions)) {
    return [];
  }

  const seen = new Set<string>();
  const next: NoteMentionReference[] = [];
  const scanLimit = Math.min(mentions.length, MAX_NOTE_MENTION_SCAN_ITEMS);
  for (let index = 0; index < scanLimit; index += 1) {
    const mention = mentions[index];
    if (!mention) {
      continue;
    }
    const key = normalizeMentionText(mention.path);
    if (!key || key.length > MAX_NOTE_MENTION_PATH_CHARS || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const title = normalizeMentionText(mention.title);
    next.push({
      path: key,
      title: (title || key).slice(0, MAX_NOTE_MENTION_TITLE_CHARS),
      kind: mention.kind === 'folder' ? 'folder' : 'note',
    });
  }
  return next;
}
