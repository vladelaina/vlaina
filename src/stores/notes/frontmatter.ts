import type { NoteCoverMetadata, NoteMetadataEntry } from './types';
import { normalizeNoteCoverMetadata } from './frontmatterCover';
import { normalizeStandardNoteIconValue } from '@/lib/notes/iconValue';

const LINE_ENDING_PATTERN = /\r\n?/g;
const UTF8_BOM = '\uFEFF';
const FRONTMATTER_DELIMITER = '---';
const MAX_FRONTMATTER_DELIMITER_LINE_CHARS = 1024;
const MAX_FRONTMATTER_CHARS = 256 * 1024;
const MAX_FRONTMATTER_LINES = 2048;
const MANAGED_FRONTMATTER_PREFIX = 'vlaina_';
const KEY_COVER = `${MANAGED_FRONTMATTER_PREFIX}cover`;
const KEY_COVER_LAYOUT = `${MANAGED_FRONTMATTER_PREFIX}cover_layout`;
const KEY_COVER_X = `${MANAGED_FRONTMATTER_PREFIX}cover_x`;
const KEY_COVER_Y = `${MANAGED_FRONTMATTER_PREFIX}cover_y`;
const KEY_COVER_HEIGHT = `${MANAGED_FRONTMATTER_PREFIX}cover_height`;
const KEY_COVER_SCALE = `${MANAGED_FRONTMATTER_PREFIX}cover_scale`;
const KEY_ICON = `${MANAGED_FRONTMATTER_PREFIX}icon`;
const KEY_ICON_SIZE = `${MANAGED_FRONTMATTER_PREFIX}icon_size`;
const KEY_CREATED = `${MANAGED_FRONTMATTER_PREFIX}created`;
const KEY_UPDATED = `${MANAGED_FRONTMATTER_PREFIX}updated`;
const MIN_NOTE_ICON_SIZE = 20;
const MAX_NOTE_ICON_SIZE = 150;
const MAX_MANAGED_NUMBER_CHARS = 64;
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;
const MANAGED_DECIMAL_NUMBER_PATTERN = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;

const MANAGED_KEYS = new Set([
  KEY_COVER,
  KEY_COVER_LAYOUT,
  KEY_COVER_X,
  KEY_COVER_Y,
  KEY_COVER_HEIGHT,
  KEY_COVER_SCALE,
  KEY_ICON,
  KEY_ICON_SIZE,
  KEY_CREATED,
  KEY_UPDATED,
]);

interface FrontmatterSections {
  lines: string[];
  body: string;
  hasFrontmatter: boolean;
}

interface ReadLineResult {
  line: string;
  contentEnd: number;
  nextStart: number;
  truncated: boolean;
}

function normalizeLineEndings(value: string): string {
  return value.replace(LINE_ENDING_PATTERN, '\n');
}

function stripLeadingBom(value: string): string {
  return value.startsWith(UTF8_BOM) ? value.slice(1) : value;
}

function isFrontmatterDelimiterLine(line: string): boolean {
  return FRONTMATTER_DELIMITER_PATTERN.test(line);
}

function readLine(value: string, start: number, maxContentEnd = value.length): ReadLineResult {
  let index = start;
  while (
    index < value.length &&
    index < maxContentEnd &&
    value[index] !== '\n' &&
    value[index] !== '\r'
  ) {
    index += 1;
  }

  let nextStart = index;
  const truncated = index >= maxContentEnd && index < value.length && value[index] !== '\n' && value[index] !== '\r';
  if (!truncated && index < value.length) {
    nextStart = value[index] === '\r' && value[index + 1] === '\n'
      ? index + 2
      : index + 1;
  }

  return {
    line: value.slice(start, index),
    contentEnd: index,
    nextStart,
    truncated,
  };
}

function hasTrailingLineEnding(value: string): boolean {
  return value.endsWith('\n') || value.endsWith('\r');
}

function removeLeadingBlankLine(value: string): string {
  const newlineIndex = value.indexOf('\n');
  const firstLine = newlineIndex >= 0 ? value.slice(0, newlineIndex) : value;
  if (firstLine.trim() !== '') {
    return value;
  }
  return newlineIndex >= 0 ? value.slice(newlineIndex + 1) : '';
}

function splitLeadingFrontmatter(markdown: string, options?: { includeBody?: boolean }): FrontmatterSections {
  const source = stripLeadingBom(markdown);
  const firstLine = readLine(source, 0, MAX_FRONTMATTER_DELIMITER_LINE_CHARS + 1);

  if (firstLine.truncated || !isFrontmatterDelimiterLine(firstLine.line)) {
    return {
      lines: [],
      body: options?.includeBody ? normalizeLineEndings(source) : '',
      hasFrontmatter: false,
    };
  }

  const lines: string[] = [];
  let cursor = firstLine.nextStart;
  const frontmatterBudgetEnd = firstLine.nextStart + MAX_FRONTMATTER_CHARS + 1;

  while (cursor < source.length && lines.length < MAX_FRONTMATTER_LINES) {
    const line = readLine(source, cursor, frontmatterBudgetEnd);
    if (line.truncated || line.contentEnd - firstLine.nextStart > MAX_FRONTMATTER_CHARS) {
      break;
    }

    if (isFrontmatterDelimiterLine(line.line)) {
      return {
        lines,
        body: options?.includeBody ? normalizeLineEndings(source.slice(line.nextStart)) : '',
        hasFrontmatter: true,
      };
    }

    lines.push(line.line);
    cursor = line.nextStart;
  }

  return {
    lines: [],
    body: options?.includeBody ? normalizeLineEndings(source) : '',
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

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\(["\\])/g, '$1');
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && trimmed === String(numeric)) {
    return numeric;
  }

  return trimmed;
}

function quoteInlineFieldValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function normalizeCover(cover: NoteCoverMetadata | null | undefined): NoteCoverMetadata | undefined {
  return normalizeNoteCoverMetadata(cover);
}

interface LeadingInlineValue {
  value: string;
  fields: Map<string, string>;
}

function parseInlineFields(value: string | number | null | undefined): Map<string, string> {
  const fields = new Map<string, string>();
  if (typeof value !== 'string') {
    return fields;
  }

  let index = 0;
  while (index < value.length) {
    while (index < value.length && /[\s,;]/.test(value[index] ?? '')) {
      index += 1;
    }
    const nameStart = index;
    while (index < value.length && /[A-Za-z0-9_-]/.test(value[index] ?? '')) {
      index += 1;
    }
    if (index === nameStart || value[index] !== '=') {
      while (index < value.length && !/[\s,;]/.test(value[index] ?? '')) {
        index += 1;
      }
      continue;
    }

    const name = value.slice(nameStart, index).toLowerCase();
    index += 1;
    let parsedValue = '';
    const quote = value[index];
    if (quote === '"' || quote === "'") {
      index += 1;
      while (index < value.length) {
        const character = value[index];
        if (character === quote) {
          index += 1;
          break;
        }
        if (quote === '"' && character === '\\' && index + 1 < value.length) {
          parsedValue += value[index + 1];
          index += 2;
          continue;
        }
        parsedValue += character;
        index += 1;
      }
    } else {
      const valueStart = index;
      while (index < value.length && !/[\s,;]/.test(value[index] ?? '')) {
        index += 1;
      }
      parsedValue = value.slice(valueStart, index);
    }

    fields.set(name, parsedValue);
  }

  return fields;
}

function getInlineNumber(fields: Map<string, string>, key: string): number | undefined {
  const value = fields.get(key);
  if (value === undefined) {
    return undefined;
  }
  return parseManagedDecimalNumber(value);
}

function parseLeadingInlineValue(value: string | number | null | undefined): LeadingInlineValue | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  let index = 0;
  let parsedValue = '';
  const quote = trimmed[index];
  if (quote === '"' || quote === "'") {
    index += 1;
    let closed = false;
    while (index < trimmed.length) {
      const character = trimmed[index];
      if (character === quote) {
        if (quote === "'" && trimmed[index + 1] === "'") {
          parsedValue += "'";
          index += 2;
          continue;
        }
        index += 1;
        closed = true;
        break;
      }
      if (quote === '"' && character === '\\' && index + 1 < trimmed.length) {
        parsedValue += trimmed[index + 1];
        index += 2;
        continue;
      }
      parsedValue += character;
      index += 1;
    }
    if (!closed) {
      return undefined;
    }
  } else {
    const valueStart = index;
    while (index < trimmed.length && !/[\s,;]/.test(trimmed[index] ?? '')) {
      index += 1;
    }
    parsedValue = trimmed.slice(valueStart, index);
  }

  if (!parsedValue.trim()) {
    return undefined;
  }

  return {
    value: parsedValue,
    fields: parseInlineFields(trimmed.slice(index)),
  };
}

function parseManagedDecimalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (
    !trimmed
    || trimmed.length > MAX_MANAGED_NUMBER_CHARS
    || !MANAGED_DECIMAL_NUMBER_PATTERN.test(trimmed)
  ) {
    return undefined;
  }

  const numberValue = Number(trimmed);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function formatCoverLayout(cover: NoteCoverMetadata): string | null {
  const parts = [quoteInlineFieldValue(cover.assetPath)];

  if (cover.positionX !== undefined) parts.push(`x=${cover.positionX}`);
  if (cover.positionY !== undefined) parts.push(`y=${cover.positionY}`);
  if (cover.height !== undefined) parts.push(`height=${cover.height}`);
  if (cover.scale !== undefined) parts.push(`scale=${cover.scale}`);

  return parts.join(' ');
}

function formatIconValue(icon: string, iconSize: number | undefined): string {
  const parts = [quoteInlineFieldValue(icon)];
  if (iconSize !== undefined) {
    parts.push(`size=${iconSize}`);
  }
  return parts.join(' ');
}

function normalizeStoredIcon(icon: unknown): string | undefined {
  return normalizeStandardNoteIconValue(icon) ?? undefined;
}

function normalizeIconSize(size: unknown): number | undefined {
  let value = Number.NaN;
  if (typeof size === 'number') {
    value = size;
  } else if (typeof size === 'string' && size.length <= 64) {
    const trimmed = size.trim();
    value = /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  }
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(MAX_NOTE_ICON_SIZE, Math.max(MIN_NOTE_ICON_SIZE, value));
}

export function normalizeNoteMetadataEntry(
  entry: Partial<NoteMetadataEntry> | null | undefined
): NoteMetadataEntry {
  if (!entry) {
    return {};
  }

  const normalized: NoteMetadataEntry = {};
  const icon = normalizeStoredIcon(entry.icon);

  if (icon) {
    normalized.icon = icon;
    const iconSize = normalizeIconSize(entry.iconSize);
    if (iconSize !== undefined) {
      normalized.iconSize = iconSize;
    }
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
  const rawValues = new Map<string, string>();

  for (const line of lines) {
    const key = parseTopLevelKey(line);
    if (!key || !MANAGED_KEYS.has(key)) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : '';
    parsedValues.set(key, parseYamlScalar(rawValue));
    rawValues.set(key, rawValue);
  }

  const coverValue = parsedValues.get(KEY_COVER);
  const normalized: NoteMetadataEntry = {};

  const rawIconValue = parsedValues.get(KEY_ICON);
  const rawIconSource = rawValues.get(KEY_ICON) ?? '';
  if (!/^\s*value\s*=/.test(rawIconSource)) {
    const inlineIcon = parseLeadingInlineValue(rawIconSource);
    const iconValue = inlineIcon?.value ?? rawIconValue;
    const icon = normalizeStoredIcon(iconValue);
    if (icon) {
      normalized.icon = icon;
      const iconSize = normalizeIconSize(
        inlineIcon ? getInlineNumber(inlineIcon.fields, 'size') : undefined
      );
      if (iconSize !== undefined) {
        normalized.iconSize = iconSize;
      }
    }
  }

  if (
    typeof coverValue === 'string'
    && coverValue
    && !/^\s*asset\s*=/.test(rawValues.get(KEY_COVER) ?? '')
  ) {
    const inlineCover = parseLeadingInlineValue(rawValues.get(KEY_COVER));
    const coverLayout = {
      positionX: inlineCover ? getInlineNumber(inlineCover.fields, 'x') : undefined,
      positionY: inlineCover ? getInlineNumber(inlineCover.fields, 'y') : undefined,
      height: inlineCover ? getInlineNumber(inlineCover.fields, 'height') : undefined,
      scale: inlineCover ? getInlineNumber(inlineCover.fields, 'scale') : undefined,
    };
    if (inlineCover?.value) {
      normalized.cover = normalizeCover({
        assetPath: inlineCover.value,
        positionX: coverLayout.positionX,
        positionY: coverLayout.positionY,
        height: coverLayout.height,
        scale: coverLayout.scale,
      });
    }
  }

  return normalizeNoteMetadataEntry(normalized);
}

export function stripManagedFrontmatter(markdown: string): string {
  const { lines, body, hasFrontmatter } = splitLeadingFrontmatter(markdown, { includeBody: true });
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
    return removeLeadingBlankLine(body);
  }

  return [
    FRONTMATTER_DELIMITER,
    ...visibleFrontmatterLines,
    FRONTMATTER_DELIMITER,
    body,
  ].join('\n');
}

export function stripUpdatedFrontmatter(markdown: string): string {
  const { lines, body, hasFrontmatter } = splitLeadingFrontmatter(markdown, { includeBody: true });
  if (!hasFrontmatter) {
    return normalizeLineEndings(markdown);
  }

  const comparableFrontmatterLines = trimTrailingBlankLines(
    lines.filter((line) => {
      const key = parseTopLevelKey(line);
      return key !== KEY_CREATED && key !== KEY_UPDATED;
    }),
  );

  if (comparableFrontmatterLines.length === 0) {
    return removeLeadingBlankLine(body);
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
  const { lines, body, hasFrontmatter } = splitLeadingFrontmatter(markdown, { includeBody: true });
  const preservedLines = trimTrailingBlankLines(
    lines.filter((line) => {
      const key = parseTopLevelKey(line);
      return !key || !MANAGED_KEYS.has(key);
    }),
  );

  const managedLines: string[] = [];
  const cover = normalizedEntry.cover;

  if (cover?.assetPath) {
    managedLines.push(`${KEY_COVER}: ${formatCoverLayout(cover)}`);
  }

  if (normalizedEntry.icon) {
    managedLines.push(`${KEY_ICON}: ${formatIconValue(normalizedEntry.icon, normalizedEntry.iconSize)}`);
  }

  const nextFrontmatterLines = [...preservedLines];
  if (preservedLines.length > 0 && managedLines.length > 0) {
    nextFrontmatterLines.push('');
  }
  nextFrontmatterLines.push(...managedLines);

  if (nextFrontmatterLines.length === 0) {
    return hasFrontmatter ? removeLeadingBlankLine(body) : normalizeLineEndings(markdown);
  }

  const frontmatterBlock = [
    FRONTMATTER_DELIMITER,
    ...nextFrontmatterLines,
    FRONTMATTER_DELIMITER,
  ].join('\n');

  if (!body) {
    return hasFrontmatter && hasTrailingLineEnding(markdown) ? `${frontmatterBlock}\n` : frontmatterBlock;
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
