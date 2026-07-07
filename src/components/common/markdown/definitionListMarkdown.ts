import {
  isUnescapedMarkdownTextRange,
} from './delimitedMarkdown';
import { markEscapedMarkdownBlockSyntax } from './escapedBlockSyntax';
import {
  canTransformMarkdownAst,
  countMarkdownAstNodeList,
  countMarkdownAstNodes,
  createMarkdownAstGrowthBudget,
  type MarkdownAstGrowthBudget,
} from './markdownAstBudget';
import {
  createMarkdownTextSliceNode,
  createMarkdownTextSourceMap,
} from './markdownSourcePosition';
import {
  createDefinitionListNode,
  getDefinitionTermText,
  hasDefinitionDescriptionPrefix,
  isParagraph,
  type DefinitionListMdastNode,
} from './definitionListNodes';

export type { DefinitionListMdastNode } from './definitionListNodes';

function getDefinitionMarkerTextNode(
  node: DefinitionListMdastNode
): { node: DefinitionListMdastNode; index: number } | null {
  for (const child of node.children ?? []) {
    if (child.type !== 'text' || typeof child.value !== 'string') return null;
    const index = child.value.search(/\S/);
    if (index < 0) continue;
    return child.value[index] === ':' ? { node: child, index } : null;
  }

  return null;
}

function hasUnescapedDefinitionMarker(
  node: DefinitionListMdastNode,
  markdown = ''
): boolean {
  const marker = getDefinitionMarkerTextNode(node);
  return !!marker && isUnescapedMarkdownTextRange(marker.node.value || '', marker.index, 1, {
    markdown,
    position: marker.node.position,
  });
}

function hasEscapedDefinitionMarker(
  node: DefinitionListMdastNode,
  markdown = ''
): boolean {
  const marker = getDefinitionMarkerTextNode(node);
  return !!marker && !isUnescapedMarkdownTextRange(marker.node.value || '', marker.index, 1, {
    markdown,
    position: marker.node.position,
  });
}

function splitCombinedDefinitionParagraph(
  node: DefinitionListMdastNode,
  markdown = ''
): DefinitionListMdastNode | null {
  if (!isParagraph(node) || node.children?.length !== 1) return null;
  const child = node.children[0];
  if (child.type !== 'text' || typeof child.value !== 'string') return null;

  const match = /^([^\n]{1,79})\n:\s+([\s\S]+)$/.exec(child.value);
  if (!match) return null;
  if (!isUnescapedMarkdownTextRange(child.value, match[1].length + 1, 1, {
    markdown,
    position: child.position,
  })) {
    markEscapedMarkdownBlockSyntax(node, 'definitionListDescription');
    return null;
  }

  const sourceMap = markdown
    ? createMarkdownTextSourceMap(child.value, markdown, child.position)
    : null;
  const descStart = match[0].length - match[2].length;
  return createDefinitionListNode(
    [createMarkdownTextSliceNode(child, sourceMap, 0, match[1].length)],
    [createMarkdownTextSliceNode(child, sourceMap, descStart, match[0].length)],
    markdown
  );
}

export function applyDefinitionListsToTree(
  tree: DefinitionListMdastNode,
  markdown = '',
  growthBudget: MarkdownAstGrowthBudget = createMarkdownAstGrowthBudget(tree)
): void {
  if (!canTransformMarkdownAst(tree)) {
    return;
  }

  function visit(node: DefinitionListMdastNode): void {
    if (!node.children?.length) return;

    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      const combined = splitCombinedDefinitionParagraph(child, markdown);
      if (combined) {
        if (!growthBudget.consume(countMarkdownAstNodes(combined) - countMarkdownAstNodes(child))) {
          continue;
        }
        node.children.splice(index, 1, combined);
        continue;
      }

      const next = node.children[index + 1];
      const termText = isParagraph(child) ? getDefinitionTermText(child) : '';
      const hasDescriptionPrefix = hasDefinitionDescriptionPrefix(next);
      if (hasDescriptionPrefix && hasEscapedDefinitionMarker(next, markdown)) {
        markEscapedMarkdownBlockSyntax(next, 'definitionListDescription');
      }
      if (
        termText.length > 0 &&
        termText.length < 80 &&
        hasDescriptionPrefix &&
        hasUnescapedDefinitionMarker(next, markdown) &&
        child.children &&
        next?.children
      ) {
        const definitionList = createDefinitionListNode(child.children, next.children, markdown);
        if (!growthBudget.consume(
          countMarkdownAstNodes(definitionList) - countMarkdownAstNodeList([child, next])
        )) {
          continue;
        }
        node.children.splice(index, 2, definitionList);
        continue;
      }

      visit(child);
    }
  }

  visit(tree);
}

export function remarkDefinitionLists() {
  return (tree: DefinitionListMdastNode, file?: { value?: unknown }) => {
    applyDefinitionListsToTree(tree, typeof file?.value === 'string' ? file.value : '');
  };
}
