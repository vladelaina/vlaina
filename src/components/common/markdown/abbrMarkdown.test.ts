import { describe, expect, it } from 'vitest';
import {
  MAX_ABBR_REPLACEMENTS_PER_TEXT_NODE,
  MAX_ABBR_USAGE_TEXT_NODE_CHARS,
  applyAbbrDefinitionsToTree,
  createAbbrUsagePattern,
  type AbbrMdastNode,
} from './abbrMarkdown';
import {
  MAX_MARKDOWN_AST_NODES,
  countMarkdownAstNodes,
} from './markdownAstBudget';

function paragraph(value: string): AbbrMdastNode {
  return {
    type: 'paragraph',
    children: [{ type: 'text', value }],
  };
}

describe('abbrMarkdown', () => {
  it('matches symbol-heavy abbreviations without relying on ASCII word boundaries', () => {
    const pattern = createAbbrUsagePattern([
      { abbr: 'C++', fullText: 'C Plus Plus' },
    ]);

    expect('Use C++ for native modules.'.match(pattern!)).toEqual(['C++']);
    expect('Use C++17 for native modules.'.match(pattern!)).toBeNull();
  });

  it('does not replace abbreviations embedded inside longer words', () => {
    const tree: AbbrMdastNode = {
      type: 'root',
      children: [
        paragraph('*[HTML]: HyperText Markup Language'),
        paragraph('HTML works, preHTML and HTML5 do not.'),
      ],
    };

    applyAbbrDefinitionsToTree(tree);

    expect(tree.children?.[1].children).toEqual([
      {
        type: 'abbr',
        children: [{ type: 'text', value: 'HTML' }],
        data: {
          hName: 'abbr',
          hProperties: {
            title: 'HyperText Markup Language',
            className: ['abbr'],
          },
        },
      },
      { type: 'text', value: ' works, preHTML and HTML5 do not.' },
    ]);
  });

  it('can strip abbreviation definition paragraphs after collecting them', () => {
    const tree: AbbrMdastNode = {
      type: 'root',
      children: [
        paragraph('*[HTML]: HyperText Markup Language'),
        paragraph('HTML works.'),
      ],
    };

    applyAbbrDefinitionsToTree(tree, { stripDefinitions: true });

    expect(tree.children).toHaveLength(1);
    expect(tree.children?.[0].children).toEqual([
      {
        type: 'abbr',
        children: [{ type: 'text', value: 'HTML' }],
        data: {
          hName: 'abbr',
          hProperties: {
            title: 'HyperText Markup Language',
            className: ['abbr'],
          },
        },
      },
      { type: 'text', value: ' works.' },
    ]);
  });

  it('does not collect or replace abbreviations inside code nodes', () => {
    const tree: AbbrMdastNode = {
      type: 'root',
      children: [
        { type: 'code', value: '*[HTML]: From Code\nHTML' },
        paragraph('*[CSS]: Cascading Style Sheets'),
        {
          type: 'paragraph',
          children: [
            { type: 'inlineCode', value: 'CSS HTML' },
            { type: 'text', value: ' CSS HTML' },
          ],
        },
      ],
    };

    applyAbbrDefinitionsToTree(tree, { stripDefinitions: true });

    expect(tree.children?.[0]).toEqual({ type: 'code', value: '*[HTML]: From Code\nHTML' });
    expect(tree.children?.[1].children).toEqual([
      { type: 'inlineCode', value: 'CSS HTML' },
      { type: 'text', value: ' ' },
      {
        type: 'abbr',
        children: [{ type: 'text', value: 'CSS' }],
        data: {
          hName: 'abbr',
          hProperties: {
            title: 'Cascading Style Sheets',
            className: ['abbr'],
          },
        },
      },
      { type: 'text', value: ' HTML' },
    ]);
  });

  it('limits abbreviation definitions used for replacement', () => {
    const definitions = Array.from({ length: 520 }, (_, index) => ({
      abbr: `A${index}`,
      fullText: `Definition ${index}`,
    }));
    const pattern = createAbbrUsagePattern(definitions);

    expect('A0 A511'.match(pattern!)).toEqual(['A0', 'A511']);
    expect('A512'.match(pattern!)).toBeNull();
  });

  it('ignores oversized abbreviation definitions', () => {
    const tree: AbbrMdastNode = {
      type: 'root',
      children: [
        paragraph(`*[${'A'.repeat(129)}]: Too long`),
        paragraph(`*[OK]: ${'x'.repeat(2049)}`),
        paragraph('*[MD]: Markdown'),
        paragraph(`${'A'.repeat(129)} OK MD`),
      ],
    };

    applyAbbrDefinitionsToTree(tree, { stripDefinitions: true });

    expect(tree.children?.at(-1)?.children).toEqual([
      { type: 'text', value: `${'A'.repeat(129)} OK ` },
      {
        type: 'abbr',
        children: [{ type: 'text', value: 'MD' }],
        data: {
          hName: 'abbr',
          hProperties: {
            title: 'Markdown',
            className: ['abbr'],
          },
        },
      },
    ]);
  });

  it('bounds abbreviation replacements from one text node', () => {
    const tree: AbbrMdastNode = {
      type: 'root',
      children: [
        paragraph('*[X]: Example'),
        paragraph(Array.from(
          { length: MAX_ABBR_REPLACEMENTS_PER_TEXT_NODE + 1 },
          () => 'X',
        ).join(' ')),
      ],
    };

    applyAbbrDefinitionsToTree(tree, { stripDefinitions: true });

    const children = tree.children?.[0].children ?? [];
    expect(children.filter((child) => child.type === 'abbr')).toHaveLength(MAX_ABBR_REPLACEMENTS_PER_TEXT_NODE);
    expect(children.at(-1)).toEqual({ type: 'text', value: ' X' });
  });

  it('skips abbreviation replacements in overlong text nodes', () => {
    const value = `${'X '.repeat(Math.ceil(MAX_ABBR_USAGE_TEXT_NODE_CHARS / 2))}X`;
    const tree: AbbrMdastNode = {
      type: 'root',
      children: [
        paragraph('*[X]: Example'),
        paragraph(value),
      ],
    };

    applyAbbrDefinitionsToTree(tree, { stripDefinitions: true });

    expect(tree.children?.[0].children).toEqual([{ type: 'text', value }]);
  });

  it('skips stripping abbreviation definitions from overlong text nodes', () => {
    const value = `*[X]: Example\n${'X '.repeat(Math.ceil(MAX_ABBR_USAGE_TEXT_NODE_CHARS / 2))}X`;
    const tree: AbbrMdastNode = {
      type: 'root',
      children: [paragraph(value)],
    };

    applyAbbrDefinitionsToTree(tree, { stripDefinitions: true });

    expect(tree.children?.[0].children).toEqual([{ type: 'text', value }]);
  });

  it('skips abbreviation expansion when the AST growth budget is exhausted', () => {
    const target = paragraph('X X X X X');
    const tree: AbbrMdastNode = {
      type: 'root',
      children: [
        ...Array.from({ length: MAX_MARKDOWN_AST_NODES - 10 }, (_, index) => ({
          type: 'text',
          value: String(index),
        })),
        paragraph('*[X]: Example'),
        target,
      ],
    };

    applyAbbrDefinitionsToTree(tree);

    expect(target.children).toEqual([{ type: 'text', value: 'X X X X X' }]);
    expect(countMarkdownAstNodes(tree)).toBeLessThanOrEqual(MAX_MARKDOWN_AST_NODES);
  });
});
