import {
  isUnescapedMarkdownTextRange,
  type MarkdownSourcePosition,
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
  replaceMarkdownTextNodeWithSlice,
  createMarkdownTextSourceMap,
} from './markdownSourcePosition';

export interface DefinitionListMdastNode {
  type: string;
  value?: string;
  children?: DefinitionListMdastNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
    vlainaEscapedBlockSyntax?: string;
  };
  position?: MarkdownSourcePosition;
}

const MAX_DEFINITION_TERM_CHARS = 80;
const MAX_DEFINITION_DESC_PREFIX_CHARS = 2;

function isParagraph(node: DefinitionListMdastNode | undefined): node is DefinitionListMdastNode {
  return node?.type === 'paragraph';
}

function getNodeTextPrefix(node: DefinitionListMdastNode, maxChars: number): string {
  const parts: string[] = [];
  const stack = [node];
  let remainingChars = maxChars;

  while (stack.length > 0 && remainingChars > 0) {
    const current = stack.pop()!;
    if (typeof current.value === 'string') {
      const value = current.value.slice(0, remainingChars);
      parts.push(value);
      remainingChars -= value.length;
      continue;
    }

    const children = current.children ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }

  return parts.join('');
}

function getTrimStartNodeTextPrefix(node: DefinitionListMdastNode, maxChars: number): string {
  const parts: string[] = [];
  const stack = [node];
  let remainingChars = maxChars;
  let trimming = true;

  while (stack.length > 0 && remainingChars > 0) {
    const current = stack.pop()!;
    if (typeof current.value === 'string') {
      const source = trimming ? current.value.trimStart() : current.value;
      if (source.length === 0) {
        continue;
      }

      trimming = false;
      const value = source.slice(0, remainingChars);
      parts.push(value);
      remainingChars -= value.length;
      continue;
    }

    const children = current.children ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }

  return parts.join('');
}

function getDefinitionTermText(node: DefinitionListMdastNode): string {
  return getNodeTextPrefix(node, MAX_DEFINITION_TERM_CHARS).trim();
}

function hasDefinitionDescriptionPrefix(node: DefinitionListMdastNode | undefined): node is DefinitionListMdastNode {
  return isParagraph(node) && getTrimStartNodeTextPrefix(node, MAX_DEFINITION_DESC_PREFIX_CHARS) === ': ';
}

function replaceTextNodeWithSlice(
  node: DefinitionListMdastNode,
  markdown: string,
  start: number,
  end: number
): void {
  const sourceMap = markdown
    ? createMarkdownTextSourceMap(node.value || '', markdown, node.position)
    : null;
  replaceMarkdownTextNodeWithSlice(node, sourceMap, start, end);
}

function stripDefinitionPrefix(
  children: readonly DefinitionListMdastNode[],
  markdown = ''
): DefinitionListMdastNode[] {
  const nextChildren = children.map((child) => ({ ...child }));

  let strippingPrefix = true;
  let strippingPostMarkerWhitespace = false;
  for (const child of nextChildren) {
    if (child.type !== 'text' || typeof child.value !== 'string') {
      if (strippingPostMarkerWhitespace) {
        strippingPostMarkerWhitespace = false;
      }
      continue;
    }

    if (strippingPrefix) {
      const markerMatch = /^(\s*):/.exec(child.value);
      if (!markerMatch) {
        if (/^\s*$/.test(child.value)) {
          replaceTextNodeWithSlice(child, markdown, child.value.length, child.value.length);
          continue;
        }
        return nextChildren;
      }

      replaceTextNodeWithSlice(child, markdown, markerMatch[0].length, child.value.length);
      strippingPrefix = false;
      strippingPostMarkerWhitespace = true;
    }

    if (strippingPostMarkerWhitespace) {
      const whitespaceLength = child.value.match(/^\s*/)?.[0].length ?? 0;
      if (whitespaceLength > 0) {
        replaceTextNodeWithSlice(child, markdown, whitespaceLength, child.value.length);
      }
      if (child.value.length > 0) {
        strippingPostMarkerWhitespace = false;
      }
    }
  }
  return nextChildren;
}

function createDefinitionListNode(
  termChildren: readonly DefinitionListMdastNode[],
  descChildren: readonly DefinitionListMdastNode[],
  markdown = ''
): DefinitionListMdastNode {
  return {
    type: 'definitionList',
    data: {
      hName: 'dl',
      hProperties: { className: ['definition-list'] },
    },
    children: [
      {
        type: 'definitionTerm',
        data: {
          hName: 'dt',
          hProperties: { className: ['definition-term'] },
        },
        children: [...termChildren],
      },
      {
        type: 'definitionDescription',
        data: {
          hName: 'dd',
          hProperties: { className: ['definition-desc'] },
        },
        children: [{
          type: 'paragraph',
          children: stripDefinitionPrefix(descChildren, markdown),
        }],
      },
    ],
  };
}

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
