export interface NoteMentionReference {
  path: string;
  title: string;
  kind?: 'note' | 'folder';
}

export const MAX_NOTE_MENTION_SCAN_ITEMS = 1_000;
export const MAX_NOTE_MENTION_PATH_CHARS = 2_048;
export const MAX_NOTE_MENTION_TITLE_CHARS = 512;

export function dedupeNoteMentions(
  mentions: NoteMentionReference[]
): NoteMentionReference[] {
  const seen = new Set<string>();
  const next: NoteMentionReference[] = [];
  const scanLimit = Math.min(mentions.length, MAX_NOTE_MENTION_SCAN_ITEMS);
  for (let index = 0; index < scanLimit; index += 1) {
    const mention = mentions[index];
    if (!mention) {
      continue;
    }
    const key = mention.path.trim();
    if (!key || key.length > MAX_NOTE_MENTION_PATH_CHARS || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const title = mention.title.trim();
    next.push({
      path: key,
      title: (title || key).slice(0, MAX_NOTE_MENTION_TITLE_CHARS),
      kind: mention.kind === 'folder' ? 'folder' : 'note',
    });
  }
  return next;
}
