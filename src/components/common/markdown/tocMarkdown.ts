import {
  isUnescapedMarkdownTextRange,
  type MarkdownSourcePosition,
} from './delimitedMarkdown';
import { markEscapedMarkdownBlockSyntax } from './escapedBlockSyntax';

export interface TocMdastNode {
  type: string;
  value?: string;
  depth?: number;
  children?: TocMdastNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
    vlainaEscapedTocShortcut?: boolean;
    vlainaEscapedBlockSyntax?: string;
  };
  position?: MarkdownSourcePosition;
}

interface TocHeading {
  level: number;
  text: string;
  id: string;
}

function isTocShortcutText(value: string): boolean {
  return /^(?:\[toc\]|\{:toc\})$/i.test(value.trim());
}

function getTocShortcutStart(value: string): number {
  return value.search(/\S/);
}

function isUnescapedTocShortcutText(
  value: string,
  options: { markdown?: string; position?: MarkdownSourcePosition } = {}
): boolean {
  if (!isTocShortcutText(value)) return false;
  const start = getTocShortcutStart(value);
  return start >= 0 && isUnescapedMarkdownTextRange(value, start, 1, options);
}

function getNodeText(node: TocMdastNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(getNodeText).join('');
}

function slugifyHeading(value: string, index: number): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `heading-${slug}-${index + 1}` : `heading-${index + 1}`;
}

function collectHeadings(tree: TocMdastNode): TocHeading[] {
  const headings: TocHeading[] = [];

  function visit(node: TocMdastNode): void {
    if (node.type === 'heading') {
      const text = getNodeText(node).trim();
      if (text) {
        const id = slugifyHeading(text, headings.length);
        headings.push({
          level: typeof node.depth === 'number' ? Math.max(1, Math.min(6, node.depth)) : 1,
          text,
          id,
        });
        node.data = {
          ...(node.data || {}),
          hProperties: {
            ...(node.data?.hProperties || {}),
            id,
          },
        };
      }
    }

    for (const child of node.children ?? []) {
      visit(child);
    }
  }

  visit(tree);
  return headings;
}

function createTocNode(headings: readonly TocHeading[]): TocMdastNode {
  const items = headings.map((heading) => ({
    type: 'container',
    data: {
      hName: 'li',
      hProperties: {
        className: ['toc-item', `toc-level-${heading.level}`],
        style: `padding-left: ${(heading.level - 1) * 16}px`,
      },
    },
    children: [{
      type: 'container',
      data: {
        hName: 'a',
        hProperties: {
          className: ['toc-link'],
          href: `#user-content-${heading.id}`,
        },
      },
      children: [{ type: 'text', value: heading.text }],
    }],
  }));

  return {
    type: 'container',
    data: {
      hName: 'div',
      hProperties: {
        className: ['toc-block'],
        dataType: 'toc',
      },
    },
    children: [{
      type: 'container',
      data: {
        hName: 'div',
        hProperties: { className: ['toc-content'] },
      },
      children: headings.length > 0
        ? [{
            type: 'container',
            data: {
              hName: 'ul',
              hProperties: { className: ['toc-list'] },
            },
            children: items,
          }]
        : [{
            type: 'container',
            data: {
              hName: 'div',
              hProperties: { className: ['toc-empty'] },
            },
            children: [{ type: 'text', value: 'No headings yet' }],
          }],
    }],
  };
}

function replaceTocShortcutParagraphs(
  tree: TocMdastNode,
  headings: readonly TocHeading[],
  markdown = ''
): void {
  function visit(node: TocMdastNode): void {
    if (!node.children?.length) return;

    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (
        child.type === 'paragraph' &&
        child.children?.length === 1 &&
        child.children[0].type === 'text' &&
        typeof child.children[0].value === 'string' &&
        isTocShortcutText(child.children[0].value)
      ) {
        if (isUnescapedTocShortcutText(child.children[0].value, {
          markdown,
          position: child.children[0].position,
        })) {
          node.children.splice(index, 1, createTocNode(headings));
        } else {
          markEscapedMarkdownBlockSyntax(child, 'toc');
          child.data = {
            ...(child.data || {}),
            vlainaEscapedTocShortcut: true,
            hProperties: {
              ...(child.data?.hProperties || {}),
            },
          };
        }
        continue;
      }

      visit(child);
    }
  }

  visit(tree);
}

export function applyTocShortcutsToTree(tree: TocMdastNode, markdown = ''): void {
  const headings = collectHeadings(tree);
  replaceTocShortcutParagraphs(tree, headings, markdown);
}

export function remarkTocShortcuts() {
  return (tree: TocMdastNode, file?: { value?: unknown }) => {
    applyTocShortcutsToTree(tree, typeof file?.value === 'string' ? file.value : '');
  };
}
