import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';
import { applyAbbrDefinitionsToTree } from './abbrMarkdown';
import { applyAlignmentCommentsToTree } from './blockAlignment';
import { applyDefinitionListsToTree } from './definitionListMarkdown';
import { applyTocShortcutsToTree } from './tocMarkdown';
import {
  createBgColorMdastNode,
  createTextColorMdastNode,
  createUnderlineMdastNode,
  replaceInlineColorHtmlMark,
  replaceUnderlineMarkdown,
  sanitizeCssColorValue,
} from './colorMarkdown';

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

function iconDataFromCalloutValue(value: string | null | undefined) {
  return value || '💡';
}

function decodeCalloutIconComment(value: string): string | null {
  const trimmed = value.trim();
  const textPrefix = '[!callout-icon:';
  const textSuffix = ']';
  if (trimmed.startsWith(textPrefix)) {
    const suffixIndex = trimmed.indexOf(textSuffix, textPrefix.length);
    if (suffixIndex > textPrefix.length) {
      try {
        return decodeURIComponent(trimmed.slice(textPrefix.length, suffixIndex));
      } catch {
        return null;
      }
    }
  }

  const commentPrefix = '<!--callout-icon:';
  if (!trimmed.startsWith(commentPrefix) || !trimmed.endsWith('-->')) {
    return null;
  }

  try {
    return decodeURIComponent(trimmed.slice(commentPrefix.length, -'-->'.length));
  } catch {
    return null;
  }
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

  const emojiMatch = (text.value || '').match(/^([\p{Emoji}]+)\s*/u);
  return emojiMatch?.[1] ?? null;
}

function transformCalloutBlockquotes(tree: MdastNode) {
  function visit(node: MdastNode): void {
    if (node.children) {
      for (const child of node.children) {
        visit(child);
      }
    }

    const icon = getCalloutIconFromBlockquote(node);
    if (!icon) return;

    const children = node.children ? [...node.children] : [];
    const firstChild = children[0];
    if (firstChild?.type === 'html' && decodeCalloutIconComment(firstChild.value || '')) {
      children.shift();
    } else if (firstChild?.type === 'paragraph') {
      const firstText = firstChild.children?.[0];
      if (firstText?.type === 'text') {
        const markerIcon = decodeCalloutIconComment(firstText.value || '');
        const remainingText = markerIcon
          ? (firstText.value || '').replace(/^\s*\[!callout-icon:[^\]]+\]\s*/u, '')
          : (firstText.value || '').replace(/^[\p{Emoji}]+\s*/u, '');
        if (remainingText) {
          firstText.value = remainingText;
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

  visit(tree);
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

function replaceInlineColorHtmlContainerMark(tree: MdastNode) {
  function visit(node: MdastNode): void {
    if (!node.children?.length) return;

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

      const closeIndex = node.children.findIndex((candidate, candidateIndex) => (
        candidateIndex > index &&
        candidate.type === 'html' &&
        typeof candidate.value === 'string' &&
        new RegExp(`^</${tagName}>$`, 'i').test(candidate.value.trim())
      ));
      if (closeIndex <= index + 1) continue;

      const content = node.children.slice(index + 1, closeIndex);
      const canCollapseToColorMark = content.every((contentNode) => contentNode.type === 'text');
      if (!canCollapseToColorMark && (textColorOpen || bgColorOpen)) {
        continue;
      }

      let nextNode: MdastNode | null = null;
      if (textColorOpen) {
        const color = sanitizeCssColorValue(
          textColorOpen[1]
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.toLowerCase().startsWith('color:'))
            ?.slice('color:'.length)
        );
        if (color) nextNode = createTextColorMdastNode(color, content) as MdastNode;
      } else if (bgColorOpen) {
        const color = sanitizeCssColorValue(
          bgColorOpen[1]
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.toLowerCase().startsWith('background-color:'))
            ?.slice('background-color:'.length)
        );
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

function replaceDelimitedTextMark(tree: MdastNode, type: string, regex: RegExp) {
  function visit(node: MdastNode, parent?: MdastNode, index?: number): void {
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        visit(node.children[i], node, i);
      }
    }

    if (node.type !== 'text' || !node.value || !parent || index === undefined) return;

    const matches: Array<{ start: number; end: number; content: string }> = [];
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;

    while ((match = regex.exec(node.value)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }

    if (matches.length === 0) return;

    const nextChildren: MdastNode[] = [];
    let lastEnd = 0;

    for (const item of matches) {
      if (item.start > lastEnd) {
        nextChildren.push({ type: 'text', value: node.value.slice(lastEnd, item.start) });
      }

      nextChildren.push(createInlineElementNode(type, [{ type: 'text', value: item.content }]));
      lastEnd = item.end;
    }

    if (lastEnd < node.value.length) {
      nextChildren.push({ type: 'text', value: node.value.slice(lastEnd) });
    }

    parent.children?.splice(index, 1, ...nextChildren);
  }

  visit(tree);
}

function replaceInlineHtmlMark(tree: MdastNode, type: string, pattern: RegExp) {
  function visit(node: MdastNode): void {
    if (!node.children?.length) return;

    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (child.type === 'html' && typeof child.value === 'string') {
        const match = child.value.trim().match(pattern);
        if (match) {
          node.children.splice(index, 1, createInlineElementNode(type, [
            { type: 'text', value: decodeMarkdownHtmlText(match[1]) },
          ]));
          continue;
        }
      }

      visit(child);
    }
  }

  visit(tree);
}

function replaceInlineHtmlContainerMark(
  tree: MdastNode,
  type: string,
  tagName: string,
  allowOpenAttributes = true
) {
  function visit(node: MdastNode): void {
    if (!node.children?.length) return;

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

      const closeIndex = node.children.findIndex((candidate, candidateIndex) => (
        candidateIndex > index &&
        candidate.type === 'html' &&
        typeof candidate.value === 'string' &&
        new RegExp(`^</${tagName}>$`, 'i').test(candidate.value.trim())
      ));
      if (closeIndex <= index + 1) {
        continue;
      }

      const content = node.children.slice(index + 1, closeIndex);
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

export function remarkNotesInlineExtensions() {
  return (tree: MdastNode, file?: { value?: unknown }) => {
    const markdown = typeof file?.value === 'string' ? file.value : '';
    applyDefinitionListsToTree(tree);
    applyTocShortcutsToTree(tree);
    applyAbbrDefinitionsToTree(tree);
    applyAlignmentCommentsToTree(tree);
    transformCalloutBlockquotes(tree);
    replaceDelimitedTextMark(tree, 'highlight', /==([^=]+)==/g);
    replaceDelimitedTextMark(tree, 'superscript', /(?<!\^)\^([^^\s](?:[^^]*?[^^\s])?)\^(?!\^)/g);
    replaceDelimitedTextMark(tree, 'subscript', /(?<!~)~([^~\s](?:[^~]*?[^~\s])?)~(?!~)/g);
    if (markdown) {
      replaceSingleTildeDeleteMark(tree, markdown);
    }
    replaceUnderlineMarkdown(tree);
    replaceInlineColorHtmlMark(tree);
    replaceInlineHtmlMark(tree, 'highlight', /^<mark>([\s\S]*?)<\/mark>$/i);
    replaceInlineHtmlMark(tree, 'superscript', /^<sup>([\s\S]*?)<\/sup>$/i);
    replaceInlineHtmlMark(tree, 'subscript', /^<sub>([\s\S]*?)<\/sub>$/i);
    replaceInlineHtmlMark(tree, 'underline', /^<u>([\s\S]*?)<\/u>$/i);
    replaceInlineColorHtmlContainerMark(tree);
    replaceInlineHtmlContainerMark(tree, 'highlight', 'mark', false);
    replaceInlineHtmlContainerMark(tree, 'superscript', 'sup');
    replaceInlineHtmlContainerMark(tree, 'subscript', 'sub');
    replaceInlineHtmlContainerMark(tree, 'underline', 'u', false);
  };
}
