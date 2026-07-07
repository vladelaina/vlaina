import {
  isUnescapedMarkdownTextRange,
} from './delimitedMarkdown';
import {
  canTransformMarkdownAst,
  countMarkdownAstNodeList,
  createMarkdownAstGrowthBudget,
  type MarkdownAstGrowthBudget,
} from './markdownAstBudget';
import {
  createMarkdownTextSliceNode,
  createMarkdownTextSourceMap,
} from './markdownSourcePosition';
import {
  collectAbbrDefinitions,
  isAbbrDefinitionText,
  markEscapedAbbrDefinitionParagraphs,
  stripAbbrDefinitionsFromTree,
} from './abbrMarkdownDefinitions';
import {
  MAX_ABBR_REPLACEMENTS_PER_TEXT_NODE,
  MAX_ABBR_USAGE_TEXT_NODE_CHARS,
  SKIPPED_ABBR_NODE_TYPES,
  escapeRegex,
  normalizeAbbrDefinitions,
  type AbbrDefinition,
  type AbbrMdastNode,
} from './abbrMarkdownShared';

export {
  MAX_ABBR_DEFINITIONS,
  MAX_ABBR_REPLACEMENTS_PER_TEXT_NODE,
  MAX_ABBR_USAGE_TEXT_NODE_CHARS,
  appendBoundedAbbrDefinitions,
  extractAbbrDefinitionsFromText,
  type AbbrDefinition,
  type AbbrMdastNode,
} from './abbrMarkdownShared';

export interface ApplyAbbrDefinitionsOptions {
  markdown?: string;
  stripDefinitions?: boolean;
  growthBudget?: MarkdownAstGrowthBudget;
}

export function createAbbrUsagePattern(definitions: readonly AbbrDefinition[]): RegExp | null {
  const normalizedDefinitions = normalizeAbbrDefinitions(definitions);
  if (normalizedDefinitions.length === 0) return null;
  const escapedAbbrs = normalizedDefinitions
    .sort((a, b) => b.abbr.length - a.abbr.length)
    .map((definition) => escapeRegex(definition.abbr));
  return new RegExp(`(?<![\\p{L}\\p{N}_])(${escapedAbbrs.join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
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
  if (!canTransformMarkdownAst(tree)) {
    return;
  }

  const markdown = options.markdown ?? '';
  const growthBudget = options.growthBudget ?? createMarkdownAstGrowthBudget(tree);
  markEscapedAbbrDefinitionParagraphs(tree, markdown);
  const definitions = normalizeAbbrDefinitions(collectAbbrDefinitions(tree, markdown));
  const usagePattern = createAbbrUsagePattern(definitions);
  if (options.stripDefinitions) {
    stripAbbrDefinitionsFromTree(tree, markdown, growthBudget);
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
    if (node.value.length > MAX_ABBR_USAGE_TEXT_NODE_CHARS) return;
    if (isAbbrDefinitionText(node.value, { markdown, position: node.position })) return;

    const nextNodes: AbbrMdastNode[] = [];
    const sourceMap = markdown
      ? createMarkdownTextSourceMap(node.value, markdown, node.position)
      : null;
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    const pattern = activePattern;
    pattern.lastIndex = 0;

    let replacementCount = 0;
    while (replacementCount < MAX_ABBR_REPLACEMENTS_PER_TEXT_NODE && (match = pattern.exec(node.value)) !== null) {
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
        nextNodes.push(createMarkdownTextSliceNode(node, sourceMap, lastEnd, match.index));
      }
      nextNodes.push(createAbbrNode(abbr, fullText));
      replacementCount += 1;
      lastEnd = match.index + abbr.length;
    }

    if (nextNodes.length === 0) return;
    if (lastEnd < node.value.length) {
      nextNodes.push(createMarkdownTextSliceNode(node, sourceMap, lastEnd, node.value.length));
    }

    if (!growthBudget.consume(countMarkdownAstNodeList(nextNodes) - 1)) return;
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
