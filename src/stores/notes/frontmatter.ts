import type { NoteCoverMetadata, NoteMetadataEntry } from './types';

const LINE_ENDING_PATTERN = /\r\n?/g;
const FRONTMATTER_DELIMITER = '---';

const MANAGED_KEYS = new Set([
  'cover',
  'cover_x',
  'cover_y',
  'cover_height',
  'cover_scale',
  'icon',
  'created',
  'updated',
]);

interface FrontmatterSections {
  lines: string[];
  body: string;
  hasFrontmatter: boolean;
}

function normalizeLineEndings(value: string): string {
  return value.replace(LINE_ENDING_PATTERN, '\n');
}

function splitLeadingFrontmatter(markdown: string): FrontmatterSections {
  const normalized = normalizeLineEndings(markdown);
  const lines = normalized.split('\n');

  if ((lines[0] ?? '').trim() !== FRONTMATTER_DELIMITER) {
    return {
      lines: [],
      body: normalized,
      hasFrontmatter: false,
    };
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() !== FRONTMATTER_DELIMITER) {
      continue;
    }

    return {
      lines: lines.slice(1, index),
      body: lines.slice(index + 1).join('\n'),
      hasFrontmatter: true,
    };
  }

  return {
    lines: [],
    body: normalized,
    hasFrontmatter: false,
  };
}

function parseTopLevelKey(line: string): string | null {
  const match = /^([A-Za-z0-9_-]+)\s*:/.exec(line);
  return match?.[1] ?? null;
}

function parseYamlScalar(rawValue: string): string | number | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && trimmed === String(numeric)) {
    return numeric;
  }

  return trimmed;
}

function parseTimestamp(value: string | number | null): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function quoteYamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function normalizeCover(cover: NoteCoverMetadata | null | undefined): NoteCoverMetadata | undefined {
  if (!cover?.assetPath) {
    return undefined;
  }

  const normalized: NoteCoverMetadata = {
    assetPath: cover.assetPath,
  };

  if (cover.positionX !== undefined) normalized.positionX = cover.positionX;
  if (cover.positionY !== undefined) normalized.positionY = cover.positionY;
  if (cover.height !== undefined) normalized.height = cover.height;
  if (cover.scale !== undefined) normalized.scale = cover.scale;

  return normalized;
}

export function normalizeNoteMetadataEntry(
  entry: Partial<NoteMetadataEntry> | null | undefined
): NoteMetadataEntry {
  if (!entry) {
    return {};
  }

  const normalized: NoteMetadataEntry = {};

  if (typeof entry.icon === 'string' && entry.icon) {
    normalized.icon = entry.icon;
  }

  const cover = normalizeCover(entry.cover);
  if (cover) {
    normalized.cover = cover;
  }

  if (typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)) {
    normalized.createdAt = entry.createdAt;
  }

  if (typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)) {
    normalized.updatedAt = entry.updatedAt;
  }

  return normalized;
}

export function readNoteMetadataFromMarkdown(markdown: string): NoteMetadataEntry {
  const { lines } = splitLeadingFrontmatter(markdown);
  if (lines.length === 0) {
    return {};
  }

  const parsedValues = new Map<string, string | number | null>();

  for (const line of lines) {
    const key = parseTopLevelKey(line);
    if (!key || !MANAGED_KEYS.has(key)) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : '';
    parsedValues.set(key, parseYamlScalar(rawValue));
  }

  const coverValue = parsedValues.get('cover');
  const normalized: NoteMetadataEntry = {};

  if (typeof parsedValues.get('icon') === 'string') {
    normalized.icon = parsedValues.get('icon') as string;
  }

  if (typeof coverValue === 'string' && coverValue) {
    normalized.cover = normalizeCover({
      assetPath: coverValue,
      positionX:
        typeof parsedValues.get('cover_x') === 'number'
          ? (parsedValues.get('cover_x') as number)
          : undefined,
      positionY:
        typeof parsedValues.get('cover_y') === 'number'
          ? (parsedValues.get('cover_y') as number)
          : undefined,
      height:
        typeof parsedValues.get('cover_height') === 'number'
          ? (parsedValues.get('cover_height') as number)
          : undefined,
      scale:
        typeof parsedValues.get('cover_scale') === 'number'
          ? (parsedValues.get('cover_scale') as number)
          : undefined,
    });
  }

  const createdAt = parseTimestamp(parsedValues.get('created') ?? null);
  if (createdAt !== undefined) {
    normalized.createdAt = createdAt;
  }

  const updatedAt = parseTimestamp(parsedValues.get('updated') ?? null);
  if (updatedAt !== undefined) {
    normalized.updatedAt = updatedAt;
  }

  return normalizeNoteMetadataEntry(normalized);
}

export function writeNoteMetadataToMarkdown(
  markdown: string,
  entry: Partial<NoteMetadataEntry> | null | undefined
): string {
  const normalizedEntry = normalizeNoteMetadataEntry(entry);
  const { lines, body, hasFrontmatter } = splitLeadingFrontmatter(markdown);
  const preservedLines = lines.filter((line) => {
    const key = parseTopLevelKey(line);
    return !key || !MANAGED_KEYS.has(key);
  });

  const managedLines: string[] = [];
  const cover = normalizedEntry.cover;

  if (cover?.assetPath) {
    managedLines.push(`cover: ${quoteYamlString(cover.assetPath)}`);
    if (cover.positionX !== undefined) managedLines.push(`cover_x: ${cover.positionX}`);
    if (cover.positionY !== undefined) managedLines.push(`cover_y: ${cover.positionY}`);
    if (cover.height !== undefined) managedLines.push(`cover_height: ${cover.height}`);
    if (cover.scale !== undefined) managedLines.push(`cover_scale: ${cover.scale}`);
  }

  if (normalizedEntry.icon) {
    managedLines.push(`icon: ${quoteYamlString(normalizedEntry.icon)}`);
  }

  if (normalizedEntry.createdAt !== undefined) {
    managedLines.push(`created: ${quoteYamlString(new Date(normalizedEntry.createdAt).toISOString())}`);
  }

  if (normalizedEntry.updatedAt !== undefined) {
    managedLines.push(`updated: ${quoteYamlString(new Date(normalizedEntry.updatedAt).toISOString())}`);
  }

  const nextFrontmatterLines = [...preservedLines];
  if (preservedLines.length > 0 && managedLines.length > 0) {
    nextFrontmatterLines.push('');
  }
  nextFrontmatterLines.push(...managedLines);

  if (nextFrontmatterLines.length === 0) {
    return hasFrontmatter ? body : normalizeLineEndings(markdown);
  }

  const frontmatterBlock = [
    FRONTMATTER_DELIMITER,
    ...nextFrontmatterLines,
    FRONTMATTER_DELIMITER,
  ].join('\n');

  if (!body) {
    return frontmatterBlock;
  }

  return hasFrontmatter
    ? `${frontmatterBlock}\n${body}`
    : `${frontmatterBlock}\n\n${body}`;
}

export function updateNoteMetadataInMarkdown(
  markdown: string,
  updates: Partial<NoteMetadataEntry> | null | undefined
): { content: string; metadata: NoteMetadataEntry } {
  const current = readNoteMetadataFromMarkdown(markdown);
  const merged = normalizeNoteMetadataEntry({
    ...current,
    ...updates,
    cover:
      updates && 'cover' in updates
        ? updates.cover ?? undefined
        : current.cover,
  });
  const content = writeNoteMetadataToMarkdown(markdown, merged);
  return {
    content,
    metadata: readNoteMetadataFromMarkdown(content),
  };
}
