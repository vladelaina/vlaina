import {
  isUnescapedMarkdownTextRange,
  type MarkdownSourcePosition,
} from './delimitedMarkdown';

export interface AbbrDefinition {
  abbr: string;
  fullText: string;
}

export interface AbbrMdastNode {
  type: string;
  value?: string;
  children?: AbbrMdastNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
    vlainaEscapedBlockSyntax?: string;
  };
  position?: MarkdownSourcePosition;
}

export const ABBR_DEF_REGEX = /^\*\[([^\]]+)\]:\s*(.+)$/gm;
export const SKIPPED_ABBR_NODE_TYPES = new Set(['code', 'inlineCode', 'html']);
export const MAX_ABBR_DEFINITIONS = 512;
export const MAX_ABBR_REPLACEMENTS_PER_TEXT_NODE = 2000;
export const MAX_ABBR_USAGE_TEXT_NODE_CHARS = 100_000;
const MAX_ABBR_TEXT_CHARS = 128;
const MAX_ABBR_TITLE_CHARS = 2048;

export function escapeRegex(value: string): string {
  let result = '';
  for (const char of value) {
    if ('.*+?^${}()|[]\\'.includes(char)) {
      result += '\\' + char;
    } else {
      result += char;
    }
  }
  return result;
}

function normalizeAbbrDefinitionFullText(value: string): string | null {
  if (value.length > MAX_ABBR_TITLE_CHARS) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_ABBR_TITLE_CHARS ? trimmed : null;
}

export function extractAbbrDefinitionsFromText(
  text: string,
  options: { markdown?: string; position?: MarkdownSourcePosition } = {}
): AbbrDefinition[] {
  if (text.length > MAX_ABBR_USAGE_TEXT_NODE_CHARS) {
    return [];
  }

  const definitionsByAbbr = new Map<string, string>();
  let match: RegExpExecArray | null;

  ABBR_DEF_REGEX.lastIndex = 0;
  while ((match = ABBR_DEF_REGEX.exec(text)) !== null) {
    if (!isUnescapedMarkdownTextRange(text, match.index, 1, options)) continue;
    const fullText = normalizeAbbrDefinitionFullText(match[2]);
    if (!fullText) continue;
    addBoundedAbbrDefinition(definitionsByAbbr, {
      abbr: match[1],
      fullText,
    });
  }

  return Array.from(definitionsByAbbr, ([abbr, fullText]) => ({ abbr, fullText }));
}

function isBoundedAbbrDefinition(definition: AbbrDefinition): boolean {
  return (
    definition.abbr.length > 0 &&
    definition.abbr.length <= MAX_ABBR_TEXT_CHARS &&
    definition.fullText.length > 0 &&
    definition.fullText.length <= MAX_ABBR_TITLE_CHARS
  );
}

function addBoundedAbbrDefinition(byAbbr: Map<string, string>, definition: AbbrDefinition): void {
  if (!isBoundedAbbrDefinition(definition)) {
    return;
  }

  if (byAbbr.size >= MAX_ABBR_DEFINITIONS && !byAbbr.has(definition.abbr)) {
    return;
  }
  byAbbr.set(definition.abbr, definition.fullText);
}

export function appendBoundedAbbrDefinitions(
  target: AbbrDefinition[],
  definitions: readonly AbbrDefinition[]
): void {
  const byAbbr = new Map(target.map((definition) => [definition.abbr, definition.fullText]));
  for (const definition of definitions) {
    addBoundedAbbrDefinition(byAbbr, definition);
  }

  target.length = 0;
  for (const [abbr, fullText] of byAbbr) {
    target.push({ abbr, fullText });
  }
}

export function normalizeAbbrDefinitions(definitions: readonly AbbrDefinition[]): AbbrDefinition[] {
  const normalized: AbbrDefinition[] = [];
  appendBoundedAbbrDefinitions(normalized, definitions);
  return normalized;
}
