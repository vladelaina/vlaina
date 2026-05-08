import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';

export interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
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

      nextChildren.push({
        type,
        children: [{ type: 'text', value: item.content }],
      });
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
          node.children.splice(index, 1, {
            type,
            children: [{ type: 'text', value: decodeMarkdownHtmlText(match[1]) }],
          });
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
      node.children.splice(index, closeIndex - index + 1, {
        type,
        children: content,
      });
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

    parent.children?.splice(index, 1, {
      type: 'subscript',
      children: node.children,
    });
  }

  visit(tree);
}

export function remarkHighlight() {
  return (tree: MdastNode, file?: { value?: unknown }) => {
    const markdown = typeof file?.value === 'string' ? file.value : '';
    replaceDelimitedTextMark(tree, 'highlight', /==([^=]+)==/g);
    replaceDelimitedTextMark(tree, 'superscript', /(?<!\^)\^([^^\s](?:[^^]*?[^^\s])?)\^(?!\^)/g);
    replaceDelimitedTextMark(tree, 'subscript', /(?<!~)~([^~\s](?:[^~]*?[^~\s])?)~(?!~)/g);
    if (markdown) {
      replaceSingleTildeDeleteMark(tree, markdown);
    }
    replaceInlineHtmlMark(tree, 'highlight', /^<mark>([\s\S]*?)<\/mark>$/i);
    replaceInlineHtmlMark(tree, 'superscript', /^<sup>([\s\S]*?)<\/sup>$/i);
    replaceInlineHtmlMark(tree, 'subscript', /^<sub>([\s\S]*?)<\/sub>$/i);
    replaceInlineHtmlContainerMark(tree, 'highlight', 'mark', false);
    replaceInlineHtmlContainerMark(tree, 'superscript', 'sup');
    replaceInlineHtmlContainerMark(tree, 'subscript', 'sub');
  };
}
