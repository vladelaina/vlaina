import {
  isMermaidFenceLanguage,
  normalizeMermaidFenceLanguage,
} from './mermaidLanguage';
import { parseStandaloneFencedCodeBlock } from '../clipboard/fencedCodePaste';

const MERMAID_DIAGRAM_DIRECTIVE_PATTERN = new RegExp(
  [
    '^\\s*',
    '(?:---\\r?\\n[\\s\\S]*?\\r?\\n---\\s*)?',
    '(?:(?:%%\\{[\\s\\S]*?\\}%%|%%[^\\r\\n]*)\\s*)*',
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
  ['flowchartv2', 'flowchart TD'],
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

const YAML_FRONTMATTER_PREFIX_PATTERN =
  /^(\s*---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$))/;
const MERMAID_PREFIX_LINE_PATTERN =
  /^(\s*(?:%%\{[\s\S]*?\}%%|%%[^\r\n]*)[ \t]*(?:\r?\n|$))/;

const FIRST_LINE_PATTERN = /^([ \t]*)([^\r\n]*?)([ \t]*)(\r?\n|$)/;
const FLOW_DIRECTION_TOKENS = new Set(['BT', 'LR', 'RL', 'TB', 'TD']);

function normalizeMermaidDirectiveAlias(directive: string) {
  return directive.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function splitLeadingMermaidPrefix(code: string) {
  const frontmatterMatch = YAML_FRONTMATTER_PREFIX_PATTERN.exec(code);
  let prefix = frontmatterMatch?.[1] ?? '';
  let body = prefix ? code.slice(prefix.length) : code;

  let mermaidPrefixLineMatch = MERMAID_PREFIX_LINE_PATTERN.exec(body);
  while (mermaidPrefixLineMatch?.[1]) {
    prefix += mermaidPrefixLineMatch[1];
    body = body.slice(mermaidPrefixLineMatch[1].length);
    mermaidPrefixLineMatch = MERMAID_PREFIX_LINE_PATTERN.exec(body);
  }

  return { prefix, body };
}

function normalizeLeadingDirectiveAlias(code: string) {
  const { prefix, body } = splitLeadingMermaidPrefix(code);
  const firstLineMatch = FIRST_LINE_PATTERN.exec(body);
  if (!firstLineMatch) {
    return code;
  }

  const [, indent = '', directive = '', trailingSpace = '', newline = ''] = firstLineMatch;
  const trimmedDirective = directive.trim();
  if (!trimmedDirective) {
    return code;
  }

  const directiveTokens = trimmedDirective.split(/\s+/);
  if (directiveTokens.length > 1) {
    const [aliasToken = '', directionToken = ''] = directiveTokens;
    const normalizedAlias = normalizeMermaidDirectiveAlias(aliasToken);
    const normalizedDirection = directionToken.toUpperCase();
    if (
      directiveTokens.length === 2
      && FLOW_DIRECTION_TOKENS.has(normalizedDirection)
      && (
        normalizedAlias === 'flow'
        || normalizedAlias === 'flowchartv2'
        || normalizedAlias === 'flowchartelk'
      )
    ) {
      const standardDirective =
        normalizedAlias === 'flow' || normalizedAlias === 'flowchartv2'
          ? `flowchart ${normalizedDirection}`
          : `flowchart-elk ${normalizedDirection}`;
      return `${prefix}${indent}${standardDirective}${trailingSpace}${newline}${body.slice(firstLineMatch[0].length)}`;
    }
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
    const { prefix, body } = splitLeadingMermaidPrefix(normalizedCode);
    return `${prefix}${standardDirective}\n${body}`;
  }

  return normalizedCode;
}

export function normalizeMermaidEditorCodeInput(input: string) {
  const fencedPayload = parseStandaloneFencedCodeBlock(input);
  if (!fencedPayload) {
    return normalizeMermaidFenceCode('mermaid', input);
  }

  const language = fencedPayload.language ?? '';
  if (!isMermaidFenceLanguage(language)) {
    return input;
  }

  return normalizeMermaidFenceCode(language, fencedPayload.code);
}
