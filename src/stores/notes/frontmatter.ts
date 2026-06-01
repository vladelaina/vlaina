import type { NoteCoverMetadata, NoteMetadataEntry } from './types';
import { normalizeNoteCoverMetadata } from './frontmatterCover';

const LINE_ENDING_PATTERN = /\r\n?/g;
const FRONTMATTER_DELIMITER = '---';
const MANAGED_FRONTMATTER_PREFIX = 'vlaina_';
const KEY_COVER = `${MANAGED_FRONTMATTER_PREFIX}cover`;
const KEY_COVER_X = `${MANAGED_FRONTMATTER_PREFIX}cover_x`;
const KEY_COVER_Y = `${MANAGED_FRONTMATTER_PREFIX}cover_y`;
const KEY_COVER_HEIGHT = `${MANAGED_FRONTMATTER_PREFIX}cover_height`;
const KEY_COVER_SCALE = `${MANAGED_FRONTMATTER_PREFIX}cover_scale`;
const KEY_ICON = `${MANAGED_FRONTMATTER_PREFIX}icon`;
const KEY_CREATED = `${MANAGED_FRONTMATTER_PREFIX}created`;
const KEY_UPDATED = `${MANAGED_FRONTMATTER_PREFIX}updated`;
const FRONTMATTER_TIMESTAMP_OFFSET_MINUTES = 8 * 60;

const MANAGED_KEYS = new Set([
  KEY_COVER,
  KEY_COVER_X,
  KEY_COVER_Y,
  KEY_COVER_HEIGHT,
  KEY_COVER_SCALE,
  KEY_ICON,
  KEY_CREATED,
  KEY_UPDATED,
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

function trimTrailingBlankLines(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1]?.trim() === '') {
    end -= 1;
  }
  return lines.slice(0, end);
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

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatNoteFrontmatterTimestamp(timestamp: number): string {
  const date = new Date(timestamp + FRONTMATTER_TIMESTAMP_OFFSET_MINUTES * 60 * 1000);
  const timezoneOffsetMinutes = FRONTMATTER_TIMESTAMP_OFFSET_MINUTES;
  const offsetSign = '+';
  const absoluteOffsetMinutes = timezoneOffsetMinutes;
  const offsetHours = Math.floor(absoluteOffsetMinutes / 60);
  const offsetMinutes = absoluteOffsetMinutes % 60;

  return [
    `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`,
    `${padDatePart(date.getUTCHours())}:${padDatePart(date.getUTCMinutes())}:${padDatePart(date.getUTCSeconds())}`,
    `${offsetSign}${padDatePart(offsetHours)}:${padDatePart(offsetMinutes)}`,
  ].join(' ');
}

function normalizeCover(cover: NoteCoverMetadata | null | undefined): NoteCoverMetadata | undefined {
  return normalizeNoteCoverMetadata(cover);
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

  const coverValue = parsedValues.get(KEY_COVER);
  const normalized: NoteMetadataEntry = {};

  if (typeof parsedValues.get(KEY_ICON) === 'string') {
    normalized.icon = parsedValues.get(KEY_ICON) as string;
  }

  if (typeof coverValue === 'string' && coverValue) {
    normalized.cover = normalizeCover({
      assetPath: coverValue,
      positionX:
        typeof parsedValues.get(KEY_COVER_X) === 'number'
          ? (parsedValues.get(KEY_COVER_X) as number)
          : undefined,
      positionY:
        typeof parsedValues.get(KEY_COVER_Y) === 'number'
          ? (parsedValues.get(KEY_COVER_Y) as number)
          : undefined,
      height:
        typeof parsedValues.get(KEY_COVER_HEIGHT) === 'number'
          ? (parsedValues.get(KEY_COVER_HEIGHT) as number)
          : undefined,
      scale:
        typeof parsedValues.get(KEY_COVER_SCALE) === 'number'
          ? (parsedValues.get(KEY_COVER_SCALE) as number)
          : undefined,
    });
  }

  const createdAt = parseTimestamp(parsedValues.get(KEY_CREATED) ?? null);
  if (createdAt !== undefined) {
    normalized.createdAt = createdAt;
  }

  const updatedAt = parseTimestamp(parsedValues.get(KEY_UPDATED) ?? null);
  if (updatedAt !== undefined) {
    normalized.updatedAt = updatedAt;
  }

  return normalizeNoteMetadataEntry(normalized);
}

export function stripManagedFrontmatter(markdown: string): string {
  const { lines, body, hasFrontmatter } = splitLeadingFrontmatter(markdown);
  if (!hasFrontmatter) {
    return normalizeLineEndings(markdown);
  }

  const visibleFrontmatterLines = trimTrailingBlankLines(
    lines.filter((line) => {
      const key = parseTopLevelKey(line);
      return !key || !key.startsWith(MANAGED_FRONTMATTER_PREFIX);
    }),
  );

  if (visibleFrontmatterLines.length === 0) {
    const bodyLines = body.split('\n');
    return bodyLines[0]?.trim() === ''
      ? bodyLines.slice(1).join('\n')
      : body;
  }

  return [
    FRONTMATTER_DELIMITER,
    ...visibleFrontmatterLines,
    FRONTMATTER_DELIMITER,
    body,
  ].join('\n');
}

export function stripUpdatedFrontmatter(markdown: string): string {
  const { lines, body, hasFrontmatter } = splitLeadingFrontmatter(markdown);
  if (!hasFrontmatter) {
    return normalizeLineEndings(markdown);
  }

  const comparableFrontmatterLines = trimTrailingBlankLines(
    lines.filter((line) => parseTopLevelKey(line) !== KEY_UPDATED),
  );

  if (comparableFrontmatterLines.length === 0) {
    const bodyLines = body.split('\n');
    return bodyLines[0]?.trim() === ''
      ? bodyLines.slice(1).join('\n')
      : body;
  }

  return [
    FRONTMATTER_DELIMITER,
    ...comparableFrontmatterLines,
    FRONTMATTER_DELIMITER,
    body,
  ].join('\n');
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
    managedLines.push(`${KEY_COVER}: ${quoteYamlString(cover.assetPath)}`);
    if (cover.positionX !== undefined) managedLines.push(`${KEY_COVER_X}: ${cover.positionX}`);
    if (cover.positionY !== undefined) managedLines.push(`${KEY_COVER_Y}: ${cover.positionY}`);
    if (cover.height !== undefined) managedLines.push(`${KEY_COVER_HEIGHT}: ${cover.height}`);
    if (cover.scale !== undefined) managedLines.push(`${KEY_COVER_SCALE}: ${cover.scale}`);
  }

  if (normalizedEntry.icon) {
    managedLines.push(`${KEY_ICON}: ${quoteYamlString(normalizedEntry.icon)}`);
  }

  if (normalizedEntry.createdAt !== undefined) {
    managedLines.push(`${KEY_CREATED}: ${formatNoteFrontmatterTimestamp(normalizedEntry.createdAt)}`);
  }

  if (normalizedEntry.updatedAt !== undefined) {
    managedLines.push(`${KEY_UPDATED}: ${formatNoteFrontmatterTimestamp(normalizedEntry.updatedAt)}`);
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
    return normalizedMarkdownHasBodySeparator(markdown) ? `${frontmatterBlock}\n` : frontmatterBlock;
  }

  return hasFrontmatter
    ? `${frontmatterBlock}\n${body}`
    : `${frontmatterBlock}\n\n${body}`;
}

function normalizedMarkdownHasBodySeparator(markdown: string): boolean {
  const normalized = normalizeLineEndings(markdown);
  if (!normalized.endsWith('\n')) return false;

  const { hasFrontmatter } = splitLeadingFrontmatter(normalized);
  return hasFrontmatter;
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
