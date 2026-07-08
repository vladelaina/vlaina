interface ReferenceDefinition {
  destination: string;
  index: number;
  label: string;
  raw: string;
  title: string;
}

interface ReferenceUsage {
  definition: ReferenceDefinition;
  raw: string;
  text: string;
}

interface MarkdownLine {
  protected: boolean;
  text: string;
}

const REFERENCE_DEFINITION_PATTERN = /^(?: {0,3})\[([^\]\n]+)]:[ \t]*(.*)$/;
const FULL_OR_COLLAPSED_REFERENCE_LINK_PATTERN = /(^|[^!])\[([^\]\n]+)]\[([^\]\n]*)]/g;
const SHORTCUT_REFERENCE_LINK_PATTERN = /(^|[^!\]])\[([^\]\n]+)](?![[(])/g;
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;

export function restoreReferenceLinkStyleFromReference(
  markdown: string,
  referenceMarkdown?: string,
): string {
  if (!referenceMarkdown || !referenceMarkdown.includes(']:')) return markdown;

  const definitions = collectReferenceDefinitions(referenceMarkdown);
  if (definitions.size === 0) return markdown;

  const usages = collectReferenceUsages(referenceMarkdown, definitions);
  if (usages.length === 0) return markdown;

  const lines = collectMarkdownLines(markdown);
  const restoredDefinitions: ReferenceDefinition[] = [];

  for (const usage of usages) {
    if (replaceFirstInlineLink(lines, usage)) {
      restoredDefinitions.push(usage.definition);
    }
  }

  if (restoredDefinitions.length === 0) return markdown;

  const outputLines = lines.map((line) => line.text);
  insertMissingDefinitions(outputLines, restoredDefinitions, referenceMarkdown);
  const output = outputLines.join('\n');
  return output === markdown ? markdown : output;
}

function collectReferenceDefinitions(markdown: string): Map<string, ReferenceDefinition> {
  const definitions = new Map<string, ReferenceDefinition>();
  const lines = collectMarkdownLines(markdown);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || line.protected) continue;

    const match = REFERENCE_DEFINITION_PATTERN.exec(line.text);
    if (!match) continue;

    const parsed = parseDefinitionRest(match[2] ?? '');
    if (!parsed) continue;

    definitions.set(normalizeReferenceLabel(match[1] ?? ''), {
      destination: parsed.destination,
      index,
      label: match[1] ?? '',
      raw: line.text,
      title: parsed.title,
    });
  }

  return definitions;
}

function collectReferenceUsages(
  markdown: string,
  definitions: ReadonlyMap<string, ReferenceDefinition>,
): ReferenceUsage[] {
  const usages: ReferenceUsage[] = [];
  const lines = collectMarkdownLines(markdown);

  for (const line of lines) {
    if (line.protected || REFERENCE_DEFINITION_PATTERN.test(line.text)) continue;

    for (const match of line.text.matchAll(FULL_OR_COLLAPSED_REFERENCE_LINK_PATTERN)) {
      const raw = match[0].slice((match[1] ?? '').length);
      const text = match[2] ?? '';
      const label = match[3] || text;
      const definition = definitions.get(normalizeReferenceLabel(label));
      if (definition) usages.push({ definition, raw, text });
    }

    for (const match of line.text.matchAll(SHORTCUT_REFERENCE_LINK_PATTERN)) {
      const raw = match[0].slice((match[1] ?? '').length);
      if (raw.includes('][')) continue;

      const text = match[2] ?? '';
      const definition = definitions.get(normalizeReferenceLabel(text));
      if (definition) usages.push({ definition, raw, text });
    }
  }

  return usages;
}

function replaceFirstInlineLink(lines: MarkdownLine[], usage: ReferenceUsage): boolean {
  const candidates = createInlineLinkCandidates(usage);

  for (const line of lines) {
    if (line.protected) continue;

    for (const candidate of candidates) {
      const index = line.text.indexOf(candidate);
      if (index < 0 || isInsideInlineCode(line.text, index)) continue;

      line.text = `${line.text.slice(0, index)}${usage.raw}${line.text.slice(index + candidate.length)}`;
      return true;
    }
  }

  return false;
}

function createInlineLinkCandidates(usage: ReferenceUsage): string[] {
  const title = usage.definition.title ? ` ${usage.definition.title}` : '';
  const textCandidates = Array.from(new Set([
    usage.text,
    usage.text.replace(/\\([[\]])/g, '$1'),
  ]));
  const destinationCandidates = createDestinationCandidates(usage.definition.destination);

  return textCandidates.flatMap((text) =>
    destinationCandidates.map((destination) => `[${text}](${destination}${title})`)
  );
}

function createDestinationCandidates(destination: string): string[] {
  const formatted = formatInlineDestination(destination);
  return Array.from(new Set([
    formatted,
    formatted.replace(/&/g, '\\&'),
  ]));
}

function insertMissingDefinitions(
  lines: string[],
  definitions: readonly ReferenceDefinition[],
  referenceMarkdown: string,
): void {
  const referenceLines = referenceMarkdown.replace(/\r\n?/g, '\n').split('\n');
  let inserted = 0;

  for (const definition of uniqueDefinitions(definitions)) {
    if (lines.includes(definition.raw)) continue;

    let insertIndex = Math.min(definition.index + inserted, lines.length);
    const referencePrevious = referenceLines[definition.index - 1] ?? null;
    if (
      referencePrevious !== null &&
      referencePrevious.trim() === '' &&
      insertIndex > 0 &&
      (lines[insertIndex - 1] ?? '').trim() !== ''
    ) {
      lines.splice(insertIndex, 0, '');
      inserted += 1;
      insertIndex += 1;
    }

    lines.splice(insertIndex, 0, definition.raw);
    inserted += 1;
  }
}

function uniqueDefinitions(definitions: readonly ReferenceDefinition[]): ReferenceDefinition[] {
  const seen = new Set<string>();
  const unique: ReferenceDefinition[] = [];

  for (const definition of definitions) {
    const key = normalizeReferenceLabel(definition.label);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(definition);
  }

  return unique.sort((left, right) => left.index - right.index);
}

function parseDefinitionRest(rest: string): { destination: string; title: string } | null {
  const trimmed = rest.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('<')) {
    const closeIndex = trimmed.indexOf('>');
    if (closeIndex < 0) return null;
    return {
      destination: trimmed.slice(1, closeIndex),
      title: trimmed.slice(closeIndex + 1).trim(),
    };
  }

  const match = /^(\S+)(?:[ \t]+(.+))?$/.exec(trimmed);
  if (!match) return null;

  return {
    destination: match[1] ?? '',
    title: (match[2] ?? '').trim(),
  };
}

function formatInlineDestination(destination: string): string {
  return /[\s()]/.test(destination) ? `<${destination}>` : destination;
}

function normalizeReferenceLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function collectMarkdownLines(markdown: string): MarkdownLine[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let activeFence: { marker: string; length: number } | null = null;
  let inLeadingFrontmatter = FRONTMATTER_DELIMITER_PATTERN.test(lines[0] ?? '');

  return lines.map((text, index) => {
    if (inLeadingFrontmatter) {
      const isClosingDelimiter = index > 0 && FRONTMATTER_DELIMITER_PATTERN.test(text);
      if (isClosingDelimiter) {
        inLeadingFrontmatter = false;
      }
      return { protected: true, text };
    }

    const fence = parseFenceLine(text);
    if (activeFence) {
      const isClosingFence = fence
        && fence.marker === activeFence.marker
        && fence.length >= activeFence.length
        && text.slice(fence.infoStart).trim() === '';
      if (isClosingFence) {
        activeFence = null;
      }
      return { protected: true, text };
    }

    if (fence) {
      activeFence = { marker: fence.marker, length: fence.length };
      return { protected: true, text };
    }

    return { protected: false, text };
  });
}

function isInsideInlineCode(line: string, index: number): boolean {
  let open = false;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (line[cursor] !== '`' || line[cursor - 1] === '\\') continue;
    open = !open;
  }
  return open;
}

function parseFenceLine(line: string): { infoStart: number; length: number; marker: string } | null {
  let cursor = 0;
  while (cursor < line.length && cursor <= 3 && line[cursor] === ' ') {
    cursor += 1;
  }
  if (cursor > 3) return null;

  const marker = line[cursor];
  if (marker !== '`' && marker !== '~') return null;

  let length = 0;
  while (line[cursor + length] === marker) {
    length += 1;
  }
  if (length < 3) return null;

  return { infoStart: cursor + length, length, marker };
}
