import {
  isMermaidFenceLanguage,
  normalizeMermaidFenceLanguage,
} from './mermaidLanguage';

const MERMAID_DIAGRAM_DIRECTIVE_PATTERN = new RegExp(
  [
    '^\\s*',
    '(?:---\\r?\\n[\\s\\S]*?\\r?\\n---\\s*)?',
    '(?:architecture(?:-beta)?|block(?:-beta)?|c4(?:context|container|component|dynamic|deployment)?|classDiagram(?:-v2)?|erDiagram|flowchart(?:-elk)?|gantt|gitGraph|graph|info|ishikawa(?:-beta)?|journey|kanban|mindmap|packet(?:-beta)?|pie|quadrantChart|radar(?:-beta)?|requirementDiagram|sankey(?:-beta)?|sequenceDiagram|stateDiagram(?:-v2)?|timeline|treeView(?:-beta)?|treemap(?:-beta)?|venn(?:-beta)?|wardley(?:-beta)?|xychart(?:-beta)?|zenuml)\\b',
  ].join(''),
  'i'
);

const STANDARD_DIRECTIVE_BY_LANGUAGE = new Map<string, string>([
  ['info', 'info'],
  ['c4', 'C4Context'],
  ['c4context', 'C4Context'],
  ['c4container', 'C4Container'],
  ['c4component', 'C4Component'],
  ['c4dynamic', 'C4Dynamic'],
  ['c4deployment', 'C4Deployment'],
  ['flow', 'flowchart TD'],
  ['flowchart', 'flowchart TD'],
  ['flowchartelk', 'flowchart-elk TD'],
  ['graph', 'graph TD'],
  ['sequence', 'sequenceDiagram'],
  ['sequencediagram', 'sequenceDiagram'],
  ['class', 'classDiagram'],
  ['classdiagram', 'classDiagram'],
  ['classdiagramv2', 'classDiagram-v2'],
  ['state', 'stateDiagram-v2'],
  ['statediagram', 'stateDiagram'],
  ['statediagramv2', 'stateDiagram-v2'],
  ['er', 'erDiagram'],
  ['erdiagram', 'erDiagram'],
  ['gantt', 'gantt'],
  ['pie', 'pie'],
  ['journey', 'journey'],
  ['gitgraph', 'gitGraph'],
  ['mindmap', 'mindmap'],
  ['timeline', 'timeline'],
  ['treeview', 'treeView-beta'],
  ['treeviewbeta', 'treeView-beta'],
  ['quadrant', 'quadrantChart'],
  ['quadrantchart', 'quadrantChart'],
  ['xychart', 'xychart'],
  ['xychartbeta', 'xychart-beta'],
  ['requirement', 'requirementDiagram'],
  ['requirementdiagram', 'requirementDiagram'],
  ['sankey', 'sankey'],
  ['sankeybeta', 'sankey-beta'],
  ['packet', 'packet'],
  ['packetbeta', 'packet-beta'],
  ['radar', 'radar-beta'],
  ['radarbeta', 'radar-beta'],
  ['block', 'block-beta'],
  ['blockbeta', 'block-beta'],
  ['architecture', 'architecture'],
  ['architecturebeta', 'architecture-beta'],
  ['kanban', 'kanban'],
  ['ishikawa', 'ishikawa'],
  ['ishikawabeta', 'ishikawa-beta'],
  ['venn', 'venn-beta'],
  ['vennbeta', 'venn-beta'],
  ['treemap', 'treemap'],
  ['treemapbeta', 'treemap-beta'],
  ['wardley', 'wardley-beta'],
  ['wardleybeta', 'wardley-beta'],
  ['zenuml', 'zenuml'],
]);

const MERMAID_FENCED_INPUT_OPENING_PATTERN = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/;
const MERMAID_FENCED_INPUT_CLOSING_PATTERN = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

const YAML_FRONTMATTER_PREFIX_PATTERN =
  /^(\s*---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$))/;

const FIRST_LINE_PATTERN = /^([ \t]*)([^\r\n]*?)([ \t]*)(\r?\n|$)/;

function normalizeMermaidDirectiveAlias(directive: string) {
  return directive.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function trimBlankEdgeLines(lines: string[]) {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim().length === 0) {
    start += 1;
  }

  while (end > start && lines[end - 1].trim().length === 0) {
    end -= 1;
  }

  return lines.slice(start, end);
}

function normalizeLeadingDirectiveAlias(code: string) {
  const frontmatterMatch = YAML_FRONTMATTER_PREFIX_PATTERN.exec(code);
  const prefix = frontmatterMatch?.[1] ?? '';
  const body = prefix ? code.slice(prefix.length) : code;
  const firstLineMatch = FIRST_LINE_PATTERN.exec(body);
  if (!firstLineMatch) {
    return code;
  }

  const [, indent = '', directive = '', trailingSpace = '', newline = ''] = firstLineMatch;
  const trimmedDirective = directive.trim();
  if (!trimmedDirective || /\s/.test(trimmedDirective)) {
    return code;
  }

  const standardDirective = STANDARD_DIRECTIVE_BY_LANGUAGE.get(
    normalizeMermaidDirectiveAlias(trimmedDirective)
  );
  if (!standardDirective || standardDirective === trimmedDirective) {
    return code;
  }

  return `${prefix}${indent}${standardDirective}${trailingSpace}${newline}${body.slice(firstLineMatch[0].length)}`;
}

export function createMermaidFenceStarterCode(language: string | null | undefined) {
  const standardDirective = STANDARD_DIRECTIVE_BY_LANGUAGE.get(
    normalizeMermaidFenceLanguage(language)
  );
  return standardDirective ? `${standardDirective}\n` : '';
}

export function normalizeMermaidFenceCode(language: string | null | undefined, code: string) {
  const normalizedLanguage = normalizeMermaidFenceLanguage(language);
  const normalizedCode = normalizeLeadingDirectiveAlias(code);

  if (!normalizedCode.trim() || MERMAID_DIAGRAM_DIRECTIVE_PATTERN.test(normalizedCode)) {
    return normalizedCode;
  }

  const standardDirective = STANDARD_DIRECTIVE_BY_LANGUAGE.get(normalizedLanguage);
  if (standardDirective) {
    return `${standardDirective}\n${normalizedCode}`;
  }

  return normalizedCode;
}

export function normalizeMermaidEditorCodeInput(input: string) {
  const lines = trimBlankEdgeLines(input.replace(/\r\n?/g, '\n').split('\n'));
  if (lines.length < 2) {
    return normalizeMermaidFenceCode('mermaid', input);
  }

  const openingMatch = lines[0].match(MERMAID_FENCED_INPUT_OPENING_PATTERN);
  const closingMatch = lines[lines.length - 1].match(MERMAID_FENCED_INPUT_CLOSING_PATTERN);
  if (!openingMatch || !closingMatch) {
    return normalizeMermaidFenceCode('mermaid', input);
  }

  const openingFence = openingMatch[1] ?? '';
  const closingFence = closingMatch[1] ?? '';
  if (
    !closingFence
    || closingFence[0] !== openingFence[0]
    || closingFence.length < openingFence.length
  ) {
    return normalizeMermaidFenceCode('mermaid', input);
  }

  const infoString = openingMatch[2] ?? '';
  if (openingFence[0] === '`' && infoString.includes('`')) {
    return normalizeMermaidFenceCode('mermaid', input);
  }

  const language = infoString.trim().split(/\s+/)[0] ?? '';
  if (!isMermaidFenceLanguage(language)) {
    return input;
  }

  const code = lines.slice(1, -1).join('\n');
  return normalizeMermaidFenceCode(language, code);
}
