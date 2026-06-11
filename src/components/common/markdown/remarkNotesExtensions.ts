import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';
import { applyAbbrDefinitionsToTree } from './abbrMarkdown';
import { applyAlignmentCommentsToTree } from './blockAlignment';
import { applyDefinitionListsToTree } from './definitionListMarkdown';
import { applyTocShortcutsToTree } from './tocMarkdown';
import { consumeLeadingCalloutEmoji } from './calloutEmoji';
import {
  createBgColorMdastNode,
  createTextColorMdastNode,
  createUnderlineMdastNode,
  containsRawHtmlTag,
  extractCssColorDeclaration,
  replaceInlineColorHtmlMark,
  replaceUnderlineMarkdown,
} from './colorMarkdown';
import { findDelimitedTextMatches } from './delimitedMarkdown';
import {
  canTransformMarkdownAst,
  countMarkdownAstNodeList,
  createMarkdownAstGrowthBudget,
  type MarkdownAstGrowthBudget,
} from './markdownAstBudget';
import {
  createMarkdownTextSliceNode,
  createMarkdownTextSourceMap,
  replaceMarkdownTextNodeWithSlice,
} from './markdownSourcePosition';

export interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
}

export interface RemarkNotesInlineExtensionsOptions {
  stripAbbrDefinitions?: boolean;
}

const MAX_CALLOUT_ICON_VALUE_CHARS = 2048;
const MAX_CALLOUT_ICON_MARKER_CHARS = 4096;
export const MAX_INLINE_HTML_CONTAINER_CHILDREN = 1024;
const CALLOUT_ICON_TEXT_PREFIX = '[!callout-icon:';
const CALLOUT_ICON_TEXT_SUFFIX = ']';
const CALLOUT_ICON_COMMENT_PREFIX = '<!--callout-icon:';
const CALLOUT_ICON_COMMENT_SUFFIX = '-->';
const INLINE_HTML_CONTAINER_SEARCH_EXCEEDED = -2;

function iconDataFromCalloutValue(value: string | null | undefined) {
  return value && value.length <= MAX_CALLOUT_ICON_VALUE_CHARS ? value : '💡';
}

function normalizeDecodedCalloutIconValue(value: string): string | null {
  return value && value.length <= MAX_CALLOUT_ICON_VALUE_CHARS ? value : null;
}

function decodeCalloutIconMarkerValue(value: string): string | null {
  if (value.length > MAX_CALLOUT_ICON_MARKER_CHARS) {
    return null;
  }

  try {
    return normalizeDecodedCalloutIconValue(decodeURIComponent(value));
  } catch {
    return null;
  }
}

function findBoundedCalloutIconTextSuffix(value: string, markerStart: number): number {
  const markerWindow = value.slice(
    markerStart,
    markerStart + MAX_CALLOUT_ICON_MARKER_CHARS + CALLOUT_ICON_TEXT_SUFFIX.length
  );
  const suffixOffset = markerWindow.indexOf(CALLOUT_ICON_TEXT_SUFFIX);
  return suffixOffset >= 0 ? markerStart + suffixOffset : -1;
}

function decodeCalloutIconComment(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith(CALLOUT_ICON_TEXT_PREFIX)) {
    const markerStart = CALLOUT_ICON_TEXT_PREFIX.length;
    const suffixIndex = findBoundedCalloutIconTextSuffix(trimmed, markerStart);
    if (suffixIndex > markerStart) {
      return decodeCalloutIconMarkerValue(trimmed.slice(markerStart, suffixIndex));
    }
  }

  if (!trimmed.startsWith(CALLOUT_ICON_COMMENT_PREFIX) || !trimmed.endsWith(CALLOUT_ICON_COMMENT_SUFFIX)) {
    return null;
  }

  return decodeCalloutIconMarkerValue(trimmed.slice(
    CALLOUT_ICON_COMMENT_PREFIX.length,
    -CALLOUT_ICON_COMMENT_SUFFIX.length
  ));
}

function getLeadingCalloutIconMarkerRestStart(value: string): number | null {
  const prefixIndex = value.search(/\S/u);
  if (prefixIndex < 0 || !value.startsWith(CALLOUT_ICON_TEXT_PREFIX, prefixIndex)) {
    return null;
  }

  const markerStart = prefixIndex + CALLOUT_ICON_TEXT_PREFIX.length;
  const suffixIndex = findBoundedCalloutIconTextSuffix(value, markerStart);
  if (suffixIndex <= markerStart) {
    return null;
  }

  const afterMarker = suffixIndex + CALLOUT_ICON_TEXT_SUFFIX.length;
  return afterMarker + (value.slice(afterMarker).match(/^\s*/u)?.[0].length ?? 0);
}

function getCalloutIconFromBlockquote(node: MdastNode): string | null {
  if (node.type !== 'blockquote') return null;

  const firstChild = node.children?.[0];
  const iconComment = firstChild?.type === 'html'
    ? decodeCalloutIconComment(firstChild.value || '')
    : null;
  if (iconComment) return iconComment;

  if (!firstChild || firstChild.type !== 'paragraph') return null;

  const text = firstChild.children?.[0];
  if (!text || text.type !== 'text') return null;

  const markerIcon = decodeCalloutIconComment(text.value || '');
  if (markerIcon) return markerIcon;

  return consumeLeadingCalloutEmoji(text.value || '')?.icon ?? null;
}

function transformCalloutBlockquotes(
  tree: MdastNode,
  markdown = '',
  growthBudget: MarkdownAstGrowthBudget = createMarkdownAstGrowthBudget(tree)
) {
  const stack = [{ node: tree, visited: false }];

  while (stack.length > 0) {
    const frame = stack.pop()!;
    const { node } = frame;
    if (!frame.visited) {
      stack.push({ node, visited: true });
      for (let index = (node.children?.length ?? 0) - 1; index >= 0; index -= 1) {
        stack.push({ node: node.children![index], visited: false });
      }
      continue;
    }

    const icon = getCalloutIconFromBlockquote(node);
    if (!icon) continue;
    if (!growthBudget.consume(3)) continue;

    const children = node.children ? [...node.children] : [];
    const firstChild = children[0];
    if (firstChild?.type === 'html' && decodeCalloutIconComment(firstChild.value || '')) {
      children.shift();
    } else if (firstChild?.type === 'paragraph') {
      const firstText = firstChild.children?.[0];
      if (firstText?.type === 'text') {
        const markerIcon = decodeCalloutIconComment(firstText.value || '');
        const consumedEmoji = markerIcon ? null : consumeLeadingCalloutEmoji(firstText.value || '');
        const remainingTextStart = markerIcon
          ? getLeadingCalloutIconMarkerRestStart(firstText.value || '')
          : consumedEmoji
            ? (firstText.value || '').length - consumedEmoji.rest.length
            : null;
        if (remainingTextStart !== null && remainingTextStart < (firstText.value || '').length) {
          const sourceMap = typeof firstText.value === 'string' && firstText.value.length > 0
            ? createMarkdownTextSourceMap(firstText.value, markdown, firstText.position)
            : null;
          replaceMarkdownTextNodeWithSlice(firstText, sourceMap, remainingTextStart, firstText.value?.length ?? 0);
        } else if (remainingTextStart !== null) {
          firstChild.children?.shift();
        } else {
          firstChild.children?.shift();
        }
      }
    }

    node.type = 'container';
    node.children = [
      {
        type: 'container',
        data: { hName: 'div', hProperties: { className: ['callout-icon'] } },
        children: [{ type: 'text', value: iconDataFromCalloutValue(icon) }],
      },
      {
        type: 'container',
        data: { hName: 'div', hProperties: { className: ['callout-content'] } },
        children,
      },
    ];
    node.data = {
      hName: 'div',
      hProperties: {
        className: ['callout', 'callout-yellow'],
        dataType: 'callout',
      },
    };
  }
}

function createInlineElementNode(type: string, children: MdastNode[]): MdastNode {
  if (type === 'highlight') {
    return {
      type,
      children,
      data: { hName: 'mark', hProperties: { className: ['highlight'] } },
    };
  }

  if (type === 'superscript') {
    return {
      type,
      children,
      data: { hName: 'sup', hProperties: { className: ['superscript'] } },
    };
  }

  if (type === 'subscript') {
    return {
      type,
      children,
      data: { hName: 'sub', hProperties: { className: ['subscript'] } },
    };
  }

  if (type === 'underline') {
    return createUnderlineMdastNode(children) as MdastNode;
  }

  return { type, children };
}

function findClosingHtmlChildIndex(
  children: readonly MdastNode[],
  startIndex: number,
  tagName: string
): number {
  const closePattern = new RegExp(`^</${tagName}>$`, 'i');
  const maxIndex = Math.min(children.length - 1, startIndex + MAX_INLINE_HTML_CONTAINER_CHILDREN + 1);

  for (let index = startIndex + 1; index <= maxIndex; index += 1) {
    const candidate = children[index];
    if (
      candidate.type === 'html' &&
      typeof candidate.value === 'string' &&
      closePattern.test(candidate.value.trim())
    ) {
      return index;
    }
  }

  if (maxIndex < children.length - 1) {
    return INLINE_HTML_CONTAINER_SEARCH_EXCEEDED;
  }

  return -1;
}

function replaceInlineColorHtmlContainerMark(tree: MdastNode) {
  function visit(node: MdastNode): void {
    if (!node.children?.length) return;

    const missingCloseTags = new Set<string>();
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (child.type !== 'html' || typeof child.value !== 'string') {
        visit(child);
        continue;
      }

      const trimmed = child.value.trim();
      const textColorOpen = trimmed.match(/^<span\b[^>]*\bstyle=["']([^"']+)["'][^>]*>$/i);
      const bgColorOpen = trimmed.match(/^<mark\b[^>]*\bstyle=["']([^"']+)["'][^>]*>$/i);
      const underlineOpen = /^<u>$/i.test(trimmed);
      const tagName = textColorOpen ? 'span' : bgColorOpen ? 'mark' : underlineOpen ? 'u' : null;
      if (!tagName) continue;
      if (missingCloseTags.has(tagName)) continue;

      const closeIndex = findClosingHtmlChildIndex(node.children, index, tagName);
      if (closeIndex === INLINE_HTML_CONTAINER_SEARCH_EXCEEDED) {
        continue;
      }
      if (closeIndex === -1) {
        missingCloseTags.add(tagName);
        continue;
      }
      if (closeIndex <= index + 1) continue;

      const content = node.children.slice(index + 1, closeIndex);
      const canCollapseToColorMark = content.every((contentNode) => (
        contentNode.type === 'text' &&
        typeof contentNode.value === 'string' &&
        !containsRawHtmlTag(contentNode.value)
      ));
      if (!canCollapseToColorMark && (textColorOpen || bgColorOpen)) {
        continue;
      }

      let nextNode: MdastNode | null = null;
      if (textColorOpen) {
        const color = extractCssColorDeclaration(textColorOpen[1], 'color');
        if (color) nextNode = createTextColorMdastNode(color, content) as MdastNode;
      } else if (bgColorOpen) {
        const color = extractCssColorDeclaration(bgColorOpen[1], 'background-color');
        if (color) nextNode = createBgColorMdastNode(color, content) as MdastNode;
      } else if (underlineOpen) {
        nextNode = createUnderlineMdastNode(content) as MdastNode;
      }

      if (nextNode) {
        node.children.splice(index, closeIndex - index + 1, nextNode);
      }
    }
  }

  visit(tree);
}

function replaceDelimitedTextMark(
  tree: MdastNode,
  type: string,
  regex: RegExp,
  markdown: string,
  delimiterLength: number,
  growthBudget: MarkdownAstGrowthBudget = createMarkdownAstGrowthBudget(tree)
) {
  function visit(node: MdastNode, parent?: MdastNode, index?: number): void {
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        visit(node.children[i], node, i);
      }
    }

    if (node.type !== 'text' || !node.value || !parent || index === undefined) return;

    const matches = findDelimitedTextMatches(node.value, regex, {
      markdown,
      position: node.position,
      openDelimiterLength: delimiterLength,
    });
    if (matches.length === 0) return;

    const sourceMap = markdown
      ? createMarkdownTextSourceMap(node.value, markdown, node.position)
      : null;
    const nextChildren: MdastNode[] = [];
    let lastEnd = 0;

    for (const item of matches) {
      if (item.start > lastEnd) {
        nextChildren.push(createMarkdownTextSliceNode(node, sourceMap, lastEnd, item.start));
      }

      nextChildren.push(createInlineElementNode(type, [
        createMarkdownTextSliceNode(node, sourceMap, item.start + delimiterLength, item.end - delimiterLength),
      ]));
      lastEnd = item.end;
    }

    if (lastEnd < node.value.length) {
      nextChildren.push(createMarkdownTextSliceNode(node, sourceMap, lastEnd, node.value.length));
    }

    if (!growthBudget.consume(countMarkdownAstNodeList(nextChildren) - 1)) return;
    parent.children?.splice(index, 1, ...nextChildren);
  }

  visit(tree);
}

function replaceInlineHtmlMark(
  tree: MdastNode,
  type: string,
  pattern: RegExp,
  growthBudget: MarkdownAstGrowthBudget = createMarkdownAstGrowthBudget(tree)
) {
  function visit(node: MdastNode): void {
    if (!node.children?.length) return;

    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (child.type === 'html' && typeof child.value === 'string') {
        const match = child.value.trim().match(pattern);
        if (match && !containsRawHtmlTag(match[1])) {
          const nextNode = createInlineElementNode(type, [
            { type: 'text', value: decodeMarkdownHtmlText(match[1]) },
          ]);
          if (!growthBudget.consume(1)) {
            continue;
          }
          node.children.splice(index, 1, nextNode);
          continue;
        }
      }

      visit(child);
    }
  }

  visit(tree);
}

function inlineContentContainsRawHtml(nodes: readonly MdastNode[]): boolean {
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === 'html') {
      return true;
    }
    if (typeof node.value === 'string' && containsRawHtmlTag(node.value)) {
      return true;
    }
    for (const child of node.children ?? []) {
      stack.push(child);
    }
  }
  return false;
}

function replaceInlineHtmlContainerMark(
  tree: MdastNode,
  type: string,
  tagName: string,
  allowOpenAttributes = true
) {
  function visit(node: MdastNode): void {
    if (!node.children?.length) return;

    let missingClose = false;
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (child.type !== 'html' || typeof child.value !== 'string') {
        visit(child);
        continue;
      }

      const openPattern = allowOpenAttributes
        ? new RegExp(`^<${tagName}\\b[^>]*>$`, 'i')
        : new RegExp(`^<${tagName}>$`, 'i');
      if (!openPattern.test(child.value.trim())) {
        continue;
      }
      if (missingClose) continue;

      const closeIndex = findClosingHtmlChildIndex(node.children, index, tagName);
      if (closeIndex === INLINE_HTML_CONTAINER_SEARCH_EXCEEDED) {
        continue;
      }
      if (closeIndex === -1) {
        missingClose = true;
        continue;
      }
      if (closeIndex <= index + 1) {
        continue;
      }

      const content = node.children.slice(index + 1, closeIndex);
      if (inlineContentContainsRawHtml(content)) {
        continue;
      }
      node.children.splice(index, closeIndex - index + 1, createInlineElementNode(type, content));
    }
  }

  visit(tree);
}

function replaceSingleTildeDeleteMark(tree: MdastNode, markdown: string) {
  function visit(node: MdastNode, parent?: MdastNode, index?: number): void {
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        visit(node.children[i], node, i);
      }
    }

    if (node.type !== 'delete' || !parent || index === undefined) return;

    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (typeof start !== 'number' || typeof end !== 'number') return;

    const source = markdown.slice(start, end);
    if (!source.startsWith('~') || source.startsWith('~~') || !source.endsWith('~') || source.endsWith('~~')) {
      return;
    }

    parent.children?.splice(index, 1, createInlineElementNode('subscript', node.children ?? []));
  }

  visit(tree);
}

export function remarkNotesInlineExtensions(options: RemarkNotesInlineExtensionsOptions = {}) {
  return (tree: MdastNode, file?: { value?: unknown }) => {
    if (!canTransformMarkdownAst(tree)) {
      return;
    }

    const markdown = typeof file?.value === 'string' ? file.value : '';
    const growthBudget = createMarkdownAstGrowthBudget(tree);
    applyDefinitionListsToTree(tree, markdown, growthBudget);
    applyTocShortcutsToTree(tree, markdown, growthBudget);
    applyAbbrDefinitionsToTree(tree, {
      markdown,
      stripDefinitions: options.stripAbbrDefinitions,
      growthBudget,
    });
    applyAlignmentCommentsToTree(tree);
    transformCalloutBlockquotes(tree, markdown, growthBudget);
    replaceDelimitedTextMark(tree, 'highlight', /==([^=]+)==/g, markdown, 2, growthBudget);
    replaceDelimitedTextMark(
      tree,
      'superscript',
      /(?<!\^)\^([^^\s](?:[^^]*?[^^\s])?)\^(?!\^)/g,
      markdown,
      1,
      growthBudget
    );
    replaceDelimitedTextMark(
      tree,
      'subscript',
      /(?<!~)~([^~\s](?:[^~]*?[^~\s])?)~(?!~)/g,
      markdown,
      1,
      growthBudget
    );
    if (markdown) {
      replaceSingleTildeDeleteMark(tree, markdown);
    }
    replaceUnderlineMarkdown(tree, markdown, growthBudget);
    replaceInlineColorHtmlMark(tree, growthBudget);
    replaceInlineHtmlMark(tree, 'highlight', /^<mark>([\s\S]*?)<\/mark>$/i, growthBudget);
    replaceInlineHtmlMark(tree, 'superscript', /^<sup>([\s\S]*?)<\/sup>$/i, growthBudget);
    replaceInlineHtmlMark(tree, 'subscript', /^<sub>([\s\S]*?)<\/sub>$/i, growthBudget);
    replaceInlineHtmlMark(tree, 'underline', /^<u>([\s\S]*?)<\/u>$/i, growthBudget);
    replaceInlineColorHtmlContainerMark(tree);
    replaceInlineHtmlContainerMark(tree, 'highlight', 'mark', false);
    replaceInlineHtmlContainerMark(tree, 'superscript', 'sup');
    replaceInlineHtmlContainerMark(tree, 'subscript', 'sub');
    replaceInlineHtmlContainerMark(tree, 'underline', 'u', false);
  };
}
