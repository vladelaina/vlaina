import { isUnescapedMarkdownTextRange } from './delimitedMarkdown';
import { markEscapedMarkdownBlockSyntax } from './escapedBlockSyntax';
import {
  countMarkdownAstNodeList,
  createMarkdownAstGrowthBudget,
  type MarkdownAstGrowthBudget,
} from './markdownAstBudget';
import {
  createMarkdownTextSliceNode,
  createMarkdownTextSourceMap,
} from './markdownSourcePosition';
import {
  ABBR_DEF_REGEX,
  MAX_ABBR_USAGE_TEXT_NODE_CHARS,
  SKIPPED_ABBR_NODE_TYPES,
  appendBoundedAbbrDefinitions,
  extractAbbrDefinitionsFromText,
  type AbbrDefinition,
  type AbbrMdastNode,
} from './abbrMarkdownShared';
import type { ApplyAbbrDefinitionsOptions } from './abbrMarkdown';

export function collectAbbrDefinitions(tree: AbbrMdastNode, markdown = ''): AbbrDefinition[] {
  const definitions: AbbrDefinition[] = [];

  function visit(node: AbbrMdastNode): void {
    if (SKIPPED_ABBR_NODE_TYPES.has(node.type)) return;

    if (node.type === 'text' && typeof node.value === 'string') {
      appendBoundedAbbrDefinitions(
        definitions,
        extractAbbrDefinitionsFromText(node.value, {
          markdown,
          position: node.position,
        })
      );
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
  options: Pick<ApplyAbbrDefinitionsOptions, 'markdown'> & { position?: AbbrMdastNode['position'] }
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
  options: Pick<ApplyAbbrDefinitionsOptions, 'markdown'> & { position?: AbbrMdastNode['position'] }
): boolean {
  if (value.length > MAX_ABBR_USAGE_TEXT_NODE_CHARS) {
    return false;
  }

  let match: RegExpExecArray | null;

  ABBR_DEF_REGEX.lastIndex = 0;
  while ((match = ABBR_DEF_REGEX.exec(value)) !== null) {
    if (!isUnescapedMarkdownTextRange(value, match.index, 1, options)) {
      return true;
    }
  }

  return false;
}

export function markEscapedAbbrDefinitionParagraphs(tree: AbbrMdastNode, markdown = ''): void {
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

function stripAbbrDefinitionLineNodes(
  node: AbbrMdastNode,
  markdown: string
): AbbrMdastNode[] | null {
  const value = node.value || '';
  if (value.length > MAX_ABBR_USAGE_TEXT_NODE_CHARS) {
    return null;
  }

  const parts = value.split(/(\r?\n)/);
  let offset = 0;
  let removedLine = false;
  const ranges: Array<{ start: number; end: number }> = [];

  for (let index = 0; index < parts.length; index += 2) {
    const line = parts[index] ?? '';
    const newline = parts[index + 1] ?? '';
    const end = offset + line.length + newline.length;
    if (isAbbrDefinitionLine(value, offset, line, {
      markdown,
      position: node.position,
    })) {
      removedLine = true;
    } else if (end > offset) {
      const previous = ranges.at(-1);
      if (previous && previous.end === offset) {
        previous.end = end;
      } else {
        ranges.push({ start: offset, end });
      }
    }
    offset = end;
  }

  if (!removedLine) return null;

  const sourceMap = markdown
    ? createMarkdownTextSourceMap(value, markdown, node.position)
    : null;
  return ranges.map((range) => createMarkdownTextSliceNode(node, sourceMap, range.start, range.end));
}

export function stripAbbrDefinitionsFromTree(
  tree: AbbrMdastNode,
  markdown = '',
  growthBudget: MarkdownAstGrowthBudget = createMarkdownAstGrowthBudget(tree)
): void {
  function visit(node: AbbrMdastNode, preserveContent = false): boolean {
    if (SKIPPED_ABBR_NODE_TYPES.has(node.type)) return false;

    if (node.children) {
      for (let childIndex = node.children.length - 1; childIndex >= 0; childIndex -= 1) {
        const child = node.children[childIndex];
        if (!preserveContent && child.type === 'text' && typeof child.value === 'string') {
          const strippedNodes = stripAbbrDefinitionLineNodes(child, markdown);
          if (strippedNodes) {
            if (!growthBudget.consume(countMarkdownAstNodeList(strippedNodes) - 1)) {
              continue;
            }
            node.children.splice(childIndex, 1, ...strippedNodes);
          }
          continue;
        }

        const preserveChildContent = node.type === 'listItem' && childIndex === 0;
        if (visit(child, preserveChildContent)) {
          node.children.splice(childIndex, 1);
        }
      }
    }

    return node.type === 'paragraph' && (node.children?.length ?? 0) === 0;
  }

  visit(tree);
}

export function isAbbrDefinitionText(
  value: string,
  options: Pick<ApplyAbbrDefinitionsOptions, 'markdown'> & { position?: AbbrMdastNode['position'] } = {}
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
