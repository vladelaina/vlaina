import { splitLeadingMermaidPrefix } from './mermaidFencePrefix';

const CLASSIC_FLOWCHART_NODE_PATTERN =
  /^\s*[\w-]+\s*=>\s*(?:start|end|operation|subroutine|condition|inputoutput|parallel)\s*:/i;
const CLASSIC_FLOWCHART_NODE_LINE_PATTERN =
  /^\s*([\w-]+)\s*=>\s*(start|end|operation|subroutine|condition|inputoutput|parallel)\s*:\s*([\s\S]*?)\s*$/i;
const CLASSIC_FLOWCHART_PATH_LINE_PATTERN =
  /^\s*[\w-]+(?:\([^)]*\))?(?:\s*->\s*[\w-]+(?:\([^)]*\))?)+\s*$/;
const MODERN_FLOWCHART_DIRECTIVE_LINE_PATTERN =
  /^\s*(flowchart(?:-elk)?|graph)\s+(BT|LR|RL|TB|TD)\s*$/i;
const CLASSIC_FLOWCHART_DIRECTION_HINTS = new Set(['bottom', 'left', 'right', 'top']);

export function startsWithClassicFlowchartNode(code: string) {
  const { body } = splitLeadingMermaidPrefix(code);
  const firstContentLine = body
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);
  return firstContentLine ? CLASSIC_FLOWCHART_NODE_PATTERN.test(firstContentLine) : false;
}

export function findLeadingFlowchartDirectiveLine(lines: readonly string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    return MODERN_FLOWCHART_DIRECTIVE_LINE_PATTERN.test(line) ? { index, line: line.trim() } : null;
  }

  return null;
}

export function hasClassicFlowchartSyntax(lines: readonly string[], skipIndex: number | null = null) {
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

export function normalizeClassicFlowchartCode(code: string) {
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
