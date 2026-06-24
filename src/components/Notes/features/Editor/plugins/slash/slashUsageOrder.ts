const SLASH_USAGE_ORDER = [
  'heading-1',
  'heading-2',
  'heading-3',
  'task-list',
  'bullet-list',
  'ordered-list',
  'quote',
  'code-block',
  'table',
  'image',
  'emoji',
  'divider',
  'callout',
  'heading-4',
  'heading-5',
  'heading-6',
  'inline-math',
  'equation',
  'toc',
  'mermaid',
  'footnote',
  'footnote-definition',
  'frontmatter',
  'video',
  'abbreviation',
] as const;

const SLASH_USAGE_RANK = new Map<string, number>(
  SLASH_USAGE_ORDER.map((commandId, index) => [commandId, index])
);

export function getSlashUsageRank(commandId: string) {
  return SLASH_USAGE_RANK.get(commandId) ?? SLASH_USAGE_ORDER.length;
}
