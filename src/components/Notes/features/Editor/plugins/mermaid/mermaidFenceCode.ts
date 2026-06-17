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
    '(?:architecture(?:-beta)?|block(?:-beta)?|c4(?:context|container|component|dynamic|deployment)?|classDiagram(?:-v2)?|erDiagram|eventModeling|flowchart(?:-elk)?|gantt|gitGraph|graph|info|ishikawa(?:-beta)?|journey|kanban|mindmap|packet(?:-beta)?|pie|quadrantChart|radar(?:-beta)?|requirementDiagram|sankey(?:-beta)?|sequenceDiagram|stateDiagram(?:-v2)?|timeline|treeView(?:-beta)?|treemap(?:-beta)?|venn(?:-beta)?|wardley(?:-beta)?|xychart(?:-beta)?|zenuml)\\b',
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
  ['eventmodeling', 'eventModeling'],
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
const CLASSIC_FLOWCHART_NODE_PATTERN =
  /^\s*[\w-]+\s*=>\s*(?:start|end|operation|subroutine|condition|inputoutput|parallel)\s*:/i;
const CLASSIC_FLOWCHART_NODE_LINE_PATTERN =
  /^\s*([\w-]+)\s*=>\s*(start|end|operation|subroutine|condition|inputoutput|parallel)\s*:\s*([\s\S]*?)\s*$/i;
const CLASSIC_FLOWCHART_PATH_LINE_PATTERN =
  /^\s*[\w-]+(?:\([^)]*\))?(?:\s*->\s*[\w-]+(?:\([^)]*\))?)+\s*$/;
const MODERN_FLOWCHART_DIRECTIVE_LINE_PATTERN =
  /^\s*(flowchart(?:-elk)?|graph)\s+(BT|LR|RL|TB|TD)\s*$/i;
const CLASSIC_FLOWCHART_DIRECTION_HINTS = new Set(['bottom', 'left', 'right', 'top']);

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

function startsWithClassicFlowchartNode(code: string) {
  const { body } = splitLeadingMermaidPrefix(code);
  const firstContentLine = body
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);
  return firstContentLine ? CLASSIC_FLOWCHART_NODE_PATTERN.test(firstContentLine) : false;
}

function findLeadingFlowchartDirectiveLine(lines: readonly string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    return MODERN_FLOWCHART_DIRECTIVE_LINE_PATTERN.test(line) ? { index, line: line.trim() } : null;
  }

  return null;
}

function hasClassicFlowchartSyntax(lines: readonly string[], skipIndex: number | null = null) {
  return lines.some((line, index) => {
    if (index === skipIndex || !line.trim()) {
      return false;
    }

    return CLASSIC_FLOWCHART_NODE_PATTERN.test(line) || CLASSIC_FLOWCHART_PATH_LINE_PATTERN.test(line);
  });
}

function escapeMermaidQuotedText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '#quot;');
}

function formatClassicFlowchartNode(id: string, type: string, label: string) {
  const escapedLabel = escapeMermaidQuotedText(label.trim());
  switch (type.toLowerCase()) {
    case 'start':
    case 'end':
      return `${id}(["${escapedLabel}"])`;
    case 'condition':
      return `${id}{"${escapedLabel}"}`;
    case 'subroutine':
      return `${id}[["${escapedLabel}"]]`;
    case 'inputoutput':
      return `${id}[/"${escapedLabel}"/]`;
    case 'parallel':
    case 'operation':
    default:
      return `${id}["${escapedLabel}"]`;
  }
}

function parseClassicFlowchartPathTerm(term: string) {
  const match = /^\s*([\w-]+)(?:\(([^)]*)\))?\s*$/.exec(term);
  if (!match) {
    return null;
  }

  const [, id = '', modifier = ''] = match;
  return {
    id,
    label: CLASSIC_FLOWCHART_DIRECTION_HINTS.has(modifier.trim().toLowerCase())
      ? ''
      : modifier.trim(),
  };
}

function formatClassicFlowchartPath(line: string) {
  const terms = line.split(/\s*->\s*/).map(parseClassicFlowchartPathTerm);
  if (terms.some((term) => term === null)) {
    return null;
  }

  const pathTerms = terms as Array<{ id: string; label: string }>;
  const edges: string[] = [];
  for (let index = 0; index < pathTerms.length - 1; index += 1) {
    const from = pathTerms[index];
    const to = pathTerms[index + 1];
    const connector = from.label ? ` -- "${escapeMermaidQuotedText(from.label)}" --> ` : ' --> ';
    edges.push(`${from.id}${connector}${to.id}`);
  }

  return edges;
}

function normalizeClassicFlowchartCode(code: string) {
  const { prefix, body } = splitLeadingMermaidPrefix(code);
  const inputLines = body.split(/\r?\n/);
  const leadingDirective = findLeadingFlowchartDirectiveLine(inputLines);
  const outputLines: string[] = [leadingDirective?.line ?? 'graph TD'];

  for (const [index, line] of inputLines.entries()) {
    if (leadingDirective && index === leadingDirective.index) {
      continue;
    }
    if (!line.trim()) {
      continue;
    }

    const nodeMatch = CLASSIC_FLOWCHART_NODE_LINE_PATTERN.exec(line);
    if (nodeMatch) {
      const [, id = '', type = '', label = ''] = nodeMatch;
      outputLines.push(formatClassicFlowchartNode(id, type, label));
      continue;
    }

    if (CLASSIC_FLOWCHART_PATH_LINE_PATTERN.test(line)) {
      const edges = formatClassicFlowchartPath(line);
      if (edges) {
        outputLines.push(...edges);
        continue;
      }
    }

    outputLines.push(line.trim());
  }

  return `${prefix}${outputLines.join('\n')}`;
}

export function normalizeMermaidCodeForRender(code: string) {
  const normalizedCode = normalizeMermaidEditorCodeInput(code);
  const { body } = splitLeadingMermaidPrefix(normalizedCode);
  const lines = body.split(/\r?\n/);
  const leadingDirective = findLeadingFlowchartDirectiveLine(lines);

  if (startsWithClassicFlowchartNode(normalizedCode)) {
    return normalizeClassicFlowchartCode(normalizedCode);
  }

  if (leadingDirective && hasClassicFlowchartSyntax(lines, leadingDirective.index)) {
    return normalizeClassicFlowchartCode(normalizedCode);
  }

  return normalizedCode;
}

function addMermaidDirectiveAfterPrefix(code: string, directive: string) {
  const { prefix, body } = splitLeadingMermaidPrefix(code);
  return `${prefix}${directive}\n${body}`;
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
    return addMermaidDirectiveAfterPrefix(normalizedCode, standardDirective);
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
