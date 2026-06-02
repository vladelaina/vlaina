import {
  isUnescapedMarkdownTextRange,
  type MarkdownSourcePosition,
} from './delimitedMarkdown';
import { markEscapedMarkdownBlockSyntax } from './escapedBlockSyntax';

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

const ABBR_DEF_REGEX = /^\*\[([^\]]+)\]:\s*(.+)$/gm;
const SKIPPED_ABBR_NODE_TYPES = new Set(['code', 'inlineCode', 'html']);

export interface ApplyAbbrDefinitionsOptions {
  markdown?: string;
  stripDefinitions?: boolean;
}

function escapeRegex(value: string): string {
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

export function extractAbbrDefinitionsFromText(
  text: string,
  options: Pick<ApplyAbbrDefinitionsOptions, 'markdown'> & { position?: MarkdownSourcePosition } = {}
): AbbrDefinition[] {
  const definitions: AbbrDefinition[] = [];
  let match: RegExpExecArray | null;

  ABBR_DEF_REGEX.lastIndex = 0;
  while ((match = ABBR_DEF_REGEX.exec(text)) !== null) {
    if (!isUnescapedMarkdownTextRange(text, match.index, 1, options)) continue;
    definitions.push({
      abbr: match[1],
      fullText: match[2].trim(),
    });
  }

  return definitions;
}

export function createAbbrUsagePattern(definitions: readonly AbbrDefinition[]): RegExp | null {
  if (definitions.length === 0) return null;
  const escapedAbbrs = [...definitions]
    .sort((a, b) => b.abbr.length - a.abbr.length)
    .map((definition) => escapeRegex(definition.abbr));
  return new RegExp(`(?<![\\p{L}\\p{N}_])(${escapedAbbrs.join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
}

function collectAbbrDefinitions(tree: AbbrMdastNode, markdown = ''): AbbrDefinition[] {
  const definitions: AbbrDefinition[] = [];

  function visit(node: AbbrMdastNode): void {
    if (SKIPPED_ABBR_NODE_TYPES.has(node.type)) return;

    if (node.type === 'text' && typeof node.value === 'string') {
      definitions.push(...extractAbbrDefinitionsFromText(node.value, {
        markdown,
        position: node.position,
      }));
    }

    for (const child of node.children ?? []) {
      visit(child);
    }
  }

  visit(tree);
  return definitions;
}

function isAbbrDefinitionLine(
  value: string,
  lineStart: number,
  line: string,
  options: Pick<ApplyAbbrDefinitionsOptions, 'markdown'> & { position?: MarkdownSourcePosition }
): boolean {
  let match: RegExpExecArray | null;

  ABBR_DEF_REGEX.lastIndex = 0;
  while ((match = ABBR_DEF_REGEX.exec(line)) !== null) {
    if (isUnescapedMarkdownTextRange(value, lineStart + match.index, 1, options)) {
      return true;
    }
  }

  return false;
}

function hasEscapedAbbrDefinitionText(
  value: string,
  options: Pick<ApplyAbbrDefinitionsOptions, 'markdown'> & { position?: MarkdownSourcePosition }
): boolean {
  let match: RegExpExecArray | null;

  ABBR_DEF_REGEX.lastIndex = 0;
  while ((match = ABBR_DEF_REGEX.exec(value)) !== null) {
    if (!isUnescapedMarkdownTextRange(value, match.index, 1, options)) {
      return true;
    }
  }

  return false;
}

function markEscapedAbbrDefinitionParagraphs(tree: AbbrMdastNode, markdown = ''): void {
  function visit(node: AbbrMdastNode): void {
    if (SKIPPED_ABBR_NODE_TYPES.has(node.type)) return;

    if (node.type === 'paragraph') {
      for (const child of node.children ?? []) {
        if (
          child.type === 'text' &&
          typeof child.value === 'string' &&
          hasEscapedAbbrDefinitionText(child.value, {
            markdown,
            position: child.position,
          })
        ) {
          markEscapedMarkdownBlockSyntax(node, 'abbrDefinition');
          break;
        }
      }
    }

    for (const child of node.children ?? []) {
      visit(child);
    }
  }

  visit(tree);
}

function stripAbbrDefinitionLines(
  value: string,
  options: Pick<ApplyAbbrDefinitionsOptions, 'markdown'> & { position?: MarkdownSourcePosition }
): string {
  const parts = value.split(/(\r?\n)/);
  let offset = 0;
  let output = '';

  for (let index = 0; index < parts.length; index += 2) {
    const line = parts[index] ?? '';
    const newline = parts[index + 1] ?? '';
    if (!isAbbrDefinitionLine(value, offset, line, options)) {
      output += line + newline;
    }
    offset += line.length + newline.length;
  }

  return output;
}

function stripAbbrDefinitionsFromTree(tree: AbbrMdastNode, markdown = ''): void {
  function visit(node: AbbrMdastNode): boolean {
    if (SKIPPED_ABBR_NODE_TYPES.has(node.type)) return false;

    if (node.children) {
      for (let childIndex = node.children.length - 1; childIndex >= 0; childIndex -= 1) {
        if (visit(node.children[childIndex])) {
          node.children.splice(childIndex, 1);
        }
      }
    }

    if (node.type === 'text' && typeof node.value === 'string') {
      node.value = stripAbbrDefinitionLines(node.value, {
        markdown,
        position: node.position,
      });
      return node.value.length === 0;
    }

    return node.type === 'paragraph' && (node.children?.length ?? 0) === 0;
  }

  visit(tree);
}

function isAbbrDefinitionText(
  value: string,
  options: Pick<ApplyAbbrDefinitionsOptions, 'markdown'> & { position?: MarkdownSourcePosition } = {}
): boolean {
  ABBR_DEF_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ABBR_DEF_REGEX.exec(value)) !== null) {
    if (isUnescapedMarkdownTextRange(value, match.index, 1, options)) {
      return true;
    }
  }
  return false;
}

function createAbbrNode(value: string, title: string): AbbrMdastNode {
  return {
    type: 'abbr',
    children: [{ type: 'text', value }],
    data: {
      hName: 'abbr',
      hProperties: {
        title,
        className: ['abbr'],
      },
    },
  };
}

export function applyAbbrDefinitionsToTree(
  tree: AbbrMdastNode,
  options: ApplyAbbrDefinitionsOptions = {}
): void {
  const markdown = options.markdown ?? '';
  markEscapedAbbrDefinitionParagraphs(tree, markdown);
  const definitions = collectAbbrDefinitions(tree, markdown);
  const usagePattern = createAbbrUsagePattern(definitions);
  if (options.stripDefinitions) {
    stripAbbrDefinitionsFromTree(tree, markdown);
  }
  if (!usagePattern) return;

  const activePattern = usagePattern;
  const definitionByAbbr = new Map(definitions.map((definition) => [definition.abbr, definition.fullText]));

  function visit(node: AbbrMdastNode, parent?: AbbrMdastNode, index?: number): void {
    if (SKIPPED_ABBR_NODE_TYPES.has(node.type)) return;

    if (node.children) {
      for (let childIndex = node.children.length - 1; childIndex >= 0; childIndex -= 1) {
        visit(node.children[childIndex], node, childIndex);
      }
    }

    if (node.type !== 'text' || !node.value || !parent || index === undefined) return;
    if (isAbbrDefinitionText(node.value, { markdown, position: node.position })) return;

    const nextNodes: AbbrMdastNode[] = [];
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    const pattern = activePattern;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(node.value)) !== null) {
      const abbr = match[1];
      const fullText = definitionByAbbr.get(abbr);
      if (!fullText) continue;
      if (!isUnescapedMarkdownTextRange(node.value, match.index, abbr.length, {
        markdown,
        position: node.position,
      })) {
        continue;
      }

      if (match.index > lastEnd) {
        nextNodes.push({ type: 'text', value: node.value.slice(lastEnd, match.index) });
      }
      nextNodes.push(createAbbrNode(abbr, fullText));
      lastEnd = match.index + abbr.length;
    }

    if (nextNodes.length === 0) return;
    if (lastEnd < node.value.length) {
      nextNodes.push({ type: 'text', value: node.value.slice(lastEnd) });
    }

    parent.children?.splice(index, 1, ...nextNodes);
  }

  visit(tree);
}

export function remarkAbbrDefinitions() {
  return (tree: AbbrMdastNode, file?: { value?: unknown }) => {
    applyAbbrDefinitionsToTree(tree, {
      markdown: typeof file?.value === 'string' ? file.value : '',
    });
  };
}
