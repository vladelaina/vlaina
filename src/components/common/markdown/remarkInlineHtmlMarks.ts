import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';
import {
  containsRawHtmlTag,
  extractCssColorDeclaration,
  replaceInlineColorHtmlMark,
} from './colorMarkdown';
import {
  buildInlineHtmlCloseIndexes,
  createColorInlineElementNode,
  createInlineElementNode,
  findClosingHtmlChildIndex,
  INLINE_HTML_CONTAINER_SEARCH_EXCEEDED,
  inlineContentContainsRawHtml,
} from './remarkInlineMarkNodes';
import {
  createMarkdownAstGrowthBudget,
  type MarkdownAstGrowthBudget,
} from './markdownAstBudget';
import type { MdastNode } from './remarkNotesTypes';

const MAX_SIMPLE_INLINE_HTML_MARK_CHARS = 8192;

export { replaceInlineColorHtmlMark };

export function replaceInlineColorHtmlContainerMark(tree: MdastNode) {
  function visit(node: MdastNode): void {
    if (!node.children?.length) return;

    let closeIndexesByTag: Map<string, number[]> | null = null;
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

      closeIndexesByTag ??= buildInlineHtmlCloseIndexes(node.children);
      const closeIndex = findClosingHtmlChildIndex(index, tagName, closeIndexesByTag, node.children.length);
      if (closeIndex === INLINE_HTML_CONTAINER_SEARCH_EXCEEDED) {
        continue;
      }
      if (closeIndex === -1) {
        missingCloseTags.add(tagName);
        continue;
      }
      if (closeIndex <= index + 1) continue;

      const content = node.children.slice(index + 1, closeIndex);
      if ((textColorOpen || bgColorOpen) && inlineContentContainsRawHtml(content)) {
        continue;
      }

      const nextNode = createColorInlineElementNode(
        tagName,
        textColorOpen?.[1] ?? bgColorOpen?.[1] ?? null,
        content,
        extractCssColorDeclaration
      );
      if (nextNode) {
        node.children.splice(index, closeIndex - index + 1, nextNode);
        closeIndexesByTag = null;
      }
    }
  }

  visit(tree);
}

export function replaceInlineHtmlMark(
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
        const value = child.value.trim();
        if (value.length > MAX_SIMPLE_INLINE_HTML_MARK_CHARS) {
          continue;
        }
        const match = value.match(pattern);
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

export function replaceInlineHtmlContainerMark(
  tree: MdastNode,
  type: string,
  tagName: string,
  allowOpenAttributes = true
) {
  const openPattern = allowOpenAttributes
    ? new RegExp(`^<${tagName}\\b[^>]*>$`, 'i')
    : new RegExp(`^<${tagName}>$`, 'i');

  function visit(node: MdastNode): void {
    if (!node.children?.length) return;

    let closeIndexesByTag: Map<string, number[]> | null = null;
    let missingClose = false;
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (child.type !== 'html' || typeof child.value !== 'string') {
        visit(child);
        continue;
      }

      if (!openPattern.test(child.value.trim())) {
        continue;
      }
      if (missingClose) continue;

      closeIndexesByTag ??= buildInlineHtmlCloseIndexes(node.children);
      const closeIndex = findClosingHtmlChildIndex(index, tagName, closeIndexesByTag, node.children.length);
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
      closeIndexesByTag = null;
    }
  }

  visit(tree);
}
