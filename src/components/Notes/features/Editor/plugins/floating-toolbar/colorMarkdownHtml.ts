import { $remark } from '@milkdown/kit/utils';
import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';

export interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
  color?: string;
}

function extractCssDeclaration(style: string, property: string): string | null {
  for (const declaration of style.split(';')) {
    const separatorIndex = declaration.indexOf(':');
    if (separatorIndex < 0) continue;
    const name = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration.slice(separatorIndex + 1).trim();
    if (name === property && value) return value;
  }
  return null;
}

function parseInlineColorHtml(value: string): MdastNode | null {
  const underlineMatch = value.match(/^<u>([\s\S]*?)<\/u>$/i);
  if (underlineMatch) {
    return {
      type: 'underline',
      children: [{ type: 'text', value: decodeMarkdownHtmlText(underlineMatch[1]) }],
    };
  }
  const textColorMatch = value.match(/^<span\b[^>]*\bstyle=["']([^"']+)["'][^>]*>([\s\S]*?)<\/span>$/i);
  if (textColorMatch) {
    const color = extractCssDeclaration(textColorMatch[1], 'color');
    if (!color) return null;
    return {
      type: 'textColor',
      color,
      children: [{ type: 'text', value: decodeMarkdownHtmlText(textColorMatch[2]) }],
    };
  }
  const bgColorMatch = value.match(/^<mark\b[^>]*\bstyle=["']([^"']+)["'][^>]*>([\s\S]*?)<\/mark>$/i);
  if (bgColorMatch) {
    const color = extractCssDeclaration(bgColorMatch[1], 'background-color');
    if (!color) return null;
    return {
      type: 'bgColor',
      color,
      children: [{ type: 'text', value: decodeMarkdownHtmlText(bgColorMatch[2]) }],
    };
  }
  return null;
}

function replaceInlineHtmlMark(tree: MdastNode): void {
  function visit(node: MdastNode): void {
    if (!node.children?.length) return;

    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (child.type === 'html' && typeof child.value === 'string') {
        const singleNode = parseInlineColorHtml(child.value.trim());
        const splitNode = singleNode ? null : parseSplitInlineHtmlMark(node.children, index);
        const nextNode = singleNode ?? splitNode;
        if (nextNode) {
          node.children.splice(index, splitNode ? 3 : 1, nextNode);
          continue;
        }
      }
      visit(child);
    }
  }

  visit(tree);
}

function parseSplitInlineHtmlMark(children: MdastNode[], index: number): MdastNode | null {
  const open = children[index];
  const text = children[index + 1];
  const close = children[index + 2];
  if (
    open?.type !== 'html' ||
    text?.type !== 'text' ||
    close?.type !== 'html' ||
    typeof open.value !== 'string' ||
    typeof text.value !== 'string' ||
    typeof close.value !== 'string'
  ) {
    return null;
  }
  return parseInlineColorHtml(`${open.value}${text.value}${close.value}`);
}

function remarkInlineColorHtml() {
  return (tree: MdastNode) => {
    replaceInlineHtmlMark(tree);
  };
}

export const remarkInlineColorHtmlPlugin = $remark('remarkInlineColorHtml', () => remarkInlineColorHtml);
