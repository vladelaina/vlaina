import {
  MAX_NOTE_MENTION_PATH_CHARS,
  MAX_NOTE_MENTION_SCAN_ITEMS,
  MAX_NOTE_MENTION_TITLE_CHARS,
  MAX_NOTE_MENTION_TITLE_RAW_CHARS,
  isPotentiallyLoadableNoteMentionReference,
  type NoteMentionReference,
} from '@/lib/ai/noteMentions';

function normalizeMentionText(value: unknown, maxRawChars: number): string {
  return typeof value === 'string' && value.length <= maxRawChars ? value.trim() : '';
}

function normalizeMentionPath(value: unknown): string {
  return normalizeMentionText(value, MAX_NOTE_MENTION_PATH_CHARS);
}

function normalizeMentionKind(value: unknown): NonNullable<NoteMentionReference['kind']> {
  return value === 'folder' ? 'folder' : 'note';
}

function normalizeOptionalMentionKind(value: unknown): NoteMentionReference['kind'] | undefined {
  return value === 'folder' || value === 'note' ? value : undefined;
}

export function normalizeMentionTitle(value: unknown, fallback: string): string {
  return (
    normalizeMentionText(value, MAX_NOTE_MENTION_TITLE_RAW_CHARS) || fallback
  ).slice(0, MAX_NOTE_MENTION_TITLE_CHARS);
}

function normalizeMentionReferenceForState(
  mention: Partial<NoteMentionReference> | null | undefined,
  defaultKind: boolean,
): NoteMentionReference | null {
  const path = normalizeMentionPath(mention?.path);
  if (!path) {
    return null;
  }

  const kind = defaultKind
    ? normalizeMentionKind(mention?.kind)
    : normalizeOptionalMentionKind(mention?.kind);
  if (!isPotentiallyLoadableNoteMentionReference({ path }, kind)) {
    return null;
  }

  const title = normalizeMentionTitle(mention?.title, path);
  if (!title) {
    return null;
  }

  return kind ? { path, title, kind } : { path, title };
}

export function normalizeMentionReferencesForState(
  nextMentions: readonly NoteMentionReference[],
  defaultKind: boolean,
): NoteMentionReference[] {
  const seenPaths = new Set<string>();
  const normalizedMentions: NoteMentionReference[] = [];
  const scanLimit = Math.min(nextMentions.length, MAX_NOTE_MENTION_SCAN_ITEMS);

  for (let index = 0; index < scanLimit; index += 1) {
    const mention = normalizeMentionReferenceForState(nextMentions[index], defaultKind);
    if (!mention || seenPaths.has(mention.path)) {
      continue;
    }
    seenPaths.add(mention.path);
    normalizedMentions.push(mention);
    if (normalizedMentions.length >= MAX_NOTE_MENTION_SCAN_ITEMS) {
      break;
    }
  }

  return normalizedMentions;
}
