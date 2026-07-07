import { findDelimitedTextMatches } from './delimitedMarkdown';
import {
  countMarkdownAstNodeList,
  createMarkdownAstGrowthBudget,
  type MarkdownAstGrowthBudget,
} from './markdownAstBudget';
import {
  createMarkdownTextSliceNode,
  createMarkdownTextSourceMap,
} from './markdownSourcePosition';
import { createInlineElementNode } from './remarkInlineMarkNodes';
import type { MdastNode } from './remarkNotesTypes';

export function replaceDelimitedTextMark(
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

export function replaceSingleTildeDeleteMark(tree: MdastNode, markdown: string) {
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
