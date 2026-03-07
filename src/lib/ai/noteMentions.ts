export interface NoteMentionReference {
  path: string;
  title: string;
}

export function dedupeNoteMentions(
  mentions: NoteMentionReference[]
): NoteMentionReference[] {
  const seen = new Set<string>();
  const next: NoteMentionReference[] = [];
  for (const mention of mentions) {
    const key = mention.path.trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push({
      path: key,
      title: mention.title.trim() || key,
    });
  }
  return next;
}
