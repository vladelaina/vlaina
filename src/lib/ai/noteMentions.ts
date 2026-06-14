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
export const MAX_NOTE_MENTION_TITLE_RAW_CHARS = 4_096;
const EXPLICIT_MENTION_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const BACKSLASH_ESCAPED_MENTION_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*\\+:/;
const WINDOWS_DRIVE_MENTION_PATH_PATTERN = /^[A-Za-z]:[/\\]/;

function normalizeMentionText(value: unknown, maxRawChars: number): string {
  return typeof value === 'string' && value.length <= maxRawChars ? value.trim() : '';
}

function normalizeMentionPath(value: unknown): string {
  return normalizeMentionText(value, MAX_NOTE_MENTION_PATH_CHARS);
}

function normalizeMentionTitle(value: unknown): string {
  return normalizeMentionText(value, MAX_NOTE_MENTION_TITLE_RAW_CHARS);
}

export function isPotentiallyLoadableNoteMentionReference(
  mention: { path?: unknown },
  explicitKind?: NoteMentionReference['kind'],
): boolean {
  const path = normalizeMentionPath(mention.path);
  if (
    !path ||
    (
      EXPLICIT_MENTION_SCHEME_PATTERN.test(path) &&
      !WINDOWS_DRIVE_MENTION_PATH_PATTERN.test(path)
    ) ||
    BACKSLASH_ESCAPED_MENTION_SCHEME_PATTERN.test(path) ||
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
    const key = normalizeMentionPath(mention.path);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const title = normalizeMentionTitle(mention.title);
    next.push({
      path: key,
      title: (title || key).slice(0, MAX_NOTE_MENTION_TITLE_CHARS),
      kind: mention.kind === 'folder' ? 'folder' : 'note',
    });
  }
  return next;
}
