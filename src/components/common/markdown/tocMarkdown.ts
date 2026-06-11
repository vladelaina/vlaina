import {
  isUnescapedMarkdownTextRange,
  type MarkdownSourcePosition,
} from './delimitedMarkdown';
import { markEscapedMarkdownBlockSyntax } from './escapedBlockSyntax';
import {
  canTransformMarkdownAst,
  countMarkdownAstNodes,
  createMarkdownAstGrowthBudget,
  type MarkdownAstGrowthBudget,
} from './markdownAstBudget';

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

const MAX_TOC_HEADINGS = 512;
const MAX_TOC_BLOCKS = 8;
const MAX_TOC_HEADING_TEXT_CHARS = 240;

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
  const parts: string[] = [];
  const stack = [node];
  let remainingChars = MAX_TOC_HEADING_TEXT_CHARS;

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
  let headingCount = 0;
  const stack = [tree];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === 'heading') {
      const text = getNodeText(node).trim();
      if (text) {
        const id = slugifyHeading(text, headingCount);
        headingCount += 1;
        if (headings.length < MAX_TOC_HEADINGS) {
          headings.push({
            level: typeof node.depth === 'number' ? Math.max(1, Math.min(6, node.depth)) : 1,
            text,
            id,
          });
        }
        node.data = {
          ...(node.data || {}),
          hProperties: {
            ...(node.data?.hProperties || {}),
            id,
          },
        };
      }
    }

    const children = node.children ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }

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
  markdown = '',
  growthBudget: MarkdownAstGrowthBudget = createMarkdownAstGrowthBudget(tree)
): void {
  let replacedTocBlocks = 0;
  const stack: Array<{ node: TocMdastNode; index: number }> = [{ node: tree, index: 0 }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const children = frame.node.children;
    if (!children?.length || frame.index >= children.length) {
      stack.pop();
      continue;
    }

    const index = frame.index;
    const child = children[index];
    frame.index += 1;
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
        if (replacedTocBlocks < MAX_TOC_BLOCKS) {
          const tocNode = createTocNode(headings);
          if (!growthBudget.consume(countMarkdownAstNodes(tocNode) - countMarkdownAstNodes(child))) {
            continue;
          }
          children.splice(index, 1, tocNode);
          replacedTocBlocks += 1;
        }
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

    if (child.children?.length) {
      stack.push({ node: child, index: 0 });
    }
  }
}

export function applyTocShortcutsToTree(
  tree: TocMdastNode,
  markdown = '',
  growthBudget: MarkdownAstGrowthBudget = createMarkdownAstGrowthBudget(tree)
): void {
  if (!canTransformMarkdownAst(tree)) {
    return;
  }

  const headings = collectHeadings(tree);
  replaceTocShortcutParagraphs(tree, headings, markdown, growthBudget);
}

export function remarkTocShortcuts() {
  return (tree: TocMdastNode, file?: { value?: unknown }) => {
    applyTocShortcutsToTree(tree, typeof file?.value === 'string' ? file.value : '');
  };
}
