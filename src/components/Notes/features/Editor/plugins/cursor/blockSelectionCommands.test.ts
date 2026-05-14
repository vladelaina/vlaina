import { describe, expect, it, vi } from 'vitest';
import type { EditorState } from '@milkdown/kit/prose/state';
import type { Serializer } from '@milkdown/kit/transformer';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { serializeSelectedBlocksToText } from './blockSelectionCommands';
import { collectSelectableBlockRanges } from './blockUnitResolver';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import { mathPlugin } from '../math';
import { mermaidPlugin } from '../mermaid';
import { codePlugin } from '../code';
import { calloutPlugin } from '../callout';

function createMockState(): EditorState {
  const doc = {
    cut(from: number, to: number) {
      return { range: `${from}-${to}` };
    },
    slice(from: number, to: number) {
      const text = `plain-${from}-${to}`;
      return {
        content: {
          forEach(callback: (node: { isText: boolean; text: string }) => void) {
            callback({ isText: true, text });
          },
        },
      };
    },
  };

  return { doc } as unknown as EditorState;
}

async function copyAllSelectableBlocks(markdown: string, plugins: readonly any[] = []): Promise<string> {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm);

  for (const plugin of plugins) {
    editor.use(plugin);
  }

  await editor.create();

  try {
    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    return serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer });
  } finally {
    await editor.destroy();
  }
}

async function copySelectableBlockIndexes(
  markdown: string,
  indexes: number[],
  plugins: readonly any[] = [],
): Promise<string> {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm);

  for (const plugin of plugins) {
    editor.use(plugin);
  }

  await editor.create();

  try {
    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const selected = indexes.map((index) => blocks[index]).filter(Boolean);
    return serializeSelectedBlocksToText(view.state, selected, { markdownSerializer: serializer });
  } finally {
    await editor.destroy();
  }
}

async function copyFirstSelectableBlockByNodeName(
  markdown: string,
  nodeName: string,
  plugins: readonly any[] = [],
): Promise<string> {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm);

  for (const plugin of plugins) {
    editor.use(plugin);
  }

  await editor.create();

  try {
    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const block = blocks.find((range) => view.state.doc.resolve(range.from).nodeAfter?.type.name === nodeName);
    expect(block).toBeDefined();
    return serializeSelectedBlocksToText(view.state, [block!], { markdownSerializer: serializer });
  } finally {
    await editor.destroy();
  }
}

describe('serializeSelectedBlocksToText', () => {
  it('prefers markdown serializer and keeps markdown syntax text', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn((doc: any) => `## ${doc.range}`);

    const result = serializeSelectedBlocksToText(
      state,
      [
        { from: 5, to: 8 },
        { from: 1, to: 4 },
      ],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('## 1-4\n\n## 5-8');
    expect(markdownSerializer.mock.calls.map(([doc]) => (doc as { range: string }).range)).toEqual([
      '1-4',
      '5-8',
    ]);
  });

  it('falls back to plain text when markdown serializer throws', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn(() => {
      throw new Error('serializer unavailable');
    });

    const result = serializeSelectedBlocksToText(
      state,
      [{ from: 2, to: 6 }],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('plain-2-6');
  });

  it('normalizes empty markdown block serialized as <br /> to empty text', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn(() => '<br />');

    const result = serializeSelectedBlocksToText(
      state,
      [{ from: 3, to: 4 }],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('\n');
  });

  it('keeps empty block gaps when copying multiple markdown blocks', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn((doc: any) => {
      if (doc.range === '1-2') return '# Title';
      if (doc.range === '3-4') return '<br />';
      return '- item';
    });

    const result = serializeSelectedBlocksToText(
      state,
      [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
        { from: 5, to: 6 },
      ],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('# Title\n\n- item');
  });

  it('does not expose internal clipboard artifacts from serialized blocks', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn((doc: any) => {
      if (doc.range === '1-2') return 'A\n\u0000VLAINA_LIST_GAP_SENTINEL\u0000\nB';
      return 'C\n��VLAINA_USER_BR_SENTINEL��\nD';
    });

    const result = serializeSelectedBlocksToText(
      state,
      [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
      ],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('A\n\nB\n\nC\\\nD');
    expect(result).not.toContain('\u0000');
    expect(result).not.toContain('�');
    expect(result).not.toMatch(/VLAINA_(?:LIST_GAP|USER_BR)_SENTINEL/);
  });

  it('serializes leading frontmatter block selections back to markdown fences', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn((doc: any) => {
      if (doc.range === '1-2') return '```yaml-frontmatter\ntitle: demo\n```';
      return 'Body';
    });

    const result = serializeSelectedBlocksToText(
      state,
      [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
      ],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('---\ntitle: demo\n---\nBody');
  });

  it('keeps a single blank line gap when copying actual paragraph blocks', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '1\n\n2');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      '1\n\n2'
    );

    await editor.destroy();
  });

  it('copies selected plain paragraph blocks as visible text without markdown escape artifacts', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, [
          '  Pro:   $76.80 / year',
          '',
          'Example $5 and < tag',
        ].join('\n'));
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const copied = serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer });

    expect(copied).toBe('Pro:   $76.80 / year\n\nExample $5 and < tag');
    expect(copied).not.toContain('&#x20;');
    expect(copied).not.toContain('\\$');
    expect(copied).not.toContain('&lt;');

    await editor.destroy();
  });

  it('copies a single plain list item as visible text without markdown escape artifacts', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '- Pro: $76.80 and [Example](https://example.com)');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const copied = serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer });

    expect(copied).toBe('Pro: $76.80 and Example');
    expect(copied).not.toContain('- ');
    expect(copied).not.toContain('[Example]');
    expect(copied).not.toContain('(https://example.com)');
    expect(copied).not.toContain('\\$');

    await editor.destroy();
  });

  it('keeps markdown semantics for bullet lists separated by a single blank line', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '- A\n\n- B');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      '- A\n- B'
    );

    await editor.destroy();
  });

  it('keeps markdown semantics for ordered lists separated by a single blank line', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '1. A\n\n2. B');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      '1. A\n2. B'
    );

    await editor.destroy();
  });

  it('keeps empty ordered list items in the same copied list', async () => {
    await expect(copyAllSelectableBlocks('1.\n2. 2\n3. 3')).resolves.toBe('1.\n2. 2\n3. 3');
  });

  it.each([
    {
      name: 'empty bullet items',
      markdown: '- \n- B',
      expected: '-\n- B',
    },
    {
      name: 'empty task items',
      markdown: '- [ ] \n- [x] done',
      expected: '- [ ]\n- [x] done',
    },
    {
      name: 'ordered list start numbers',
      markdown: '4. A\n5. B',
      expected: '4. A\n5. B',
    },
    {
      name: 'ordered list with dot-like paragraph text before it',
      markdown: '1.foo\n\n1. A\n2. B',
      expected: '1.foo\n\n1. A\n2. B',
    },
    {
      name: 'loose adjacent ordered items',
      markdown: '1. A\n\n1. B',
      expected: '1. A\n2. B',
    },
    {
      name: 'separate adjacent bullet and ordered lists',
      markdown: '- A\n\n1. B',
      expected: '- A\n\n1. B',
    },
  ])('keeps copied list boundaries for $name', async ({ markdown, expected }) => {
    await expect(copyAllSelectableBlocks(markdown)).resolves.toBe(expected);
  });

  it.each([
    {
      name: 'nested bullet items',
      markdown: '- parent\n  - child\n- sibling',
      expected: '- parent\n  - child\n- sibling',
    },
    {
      name: 'nested ordered items',
      markdown: '1. parent\n   1. child\n2. sibling',
      expected: '1. parent\n   1. child\n2. sibling',
    },
  ])('preserves copied $name', async ({ markdown, expected }) => {
    await expect(copyAllSelectableBlocks(markdown)).resolves.toBe(expected);
  });

  it.each([
    {
      name: 'nested ordered siblings',
      markdown: '- parent\n  1. child\n  2. sibling',
      indexes: [1, 2],
      expected: '1. child\n2. sibling',
    },
    {
      name: 'nested bullet siblings',
      markdown: '1. parent\n   - child\n   - sibling',
      indexes: [1, 2],
      expected: '- child\n- sibling',
    },
  ])('copies selected $name as a standalone list', async ({ markdown, indexes, expected }) => {
    await expect(copySelectableBlockIndexes(markdown, indexes)).resolves.toBe(expected);
  });

  it.each([
    {
      name: 'middle ordered list items',
      markdown: '1. A\n2. B\n3. C',
      indexes: [1, 2],
      expected: '2. B\n3. C',
    },
    {
      name: 'middle ordered list items from custom start',
      markdown: '4. A\n5. B\n6. C',
      indexes: [1, 2],
      expected: '5. B\n6. C',
    },
    {
      name: 'middle nested ordered list items',
      markdown: '- parent\n  1. A\n  2. B\n  3. C',
      indexes: [2, 3],
      expected: '2. B\n3. C',
    },
  ])('preserves source numbering for selected $name', async ({ markdown, indexes, expected }) => {
    await expect(copySelectableBlockIndexes(markdown, indexes)).resolves.toBe(expected);
  });

  it.each([
    {
      name: 'non-contiguous ordered list items',
      markdown: '1. A\n2. B\n3. C',
      indexes: [0, 2],
      expected: '1. A\n3. C',
    },
    {
      name: 'non-contiguous nested ordered list items',
      markdown: '- parent\n  1. A\n  2. B\n  3. C',
      indexes: [1, 3],
      expected: '1. A\n3. C',
    },
  ])('preserves numbering gaps for selected $name', async ({ markdown, indexes, expected }) => {
    await expect(copySelectableBlockIndexes(markdown, indexes)).resolves.toBe(expected);
  });

  it.each([
    {
      name: 'nested bullet item with its child',
      markdown: '- parent\n  - child\n    - grandchild\n- sibling',
      indexes: [1, 2],
      expected: '- child\n  - grandchild',
    },
    {
      name: 'nested ordered item with its child',
      markdown: '- parent\n  1. child\n     1. grandchild\n- sibling',
      indexes: [1, 2],
      expected: '1. child\n   1. grandchild',
    },
    {
      name: 'parent header with one selected child',
      markdown: '- parent\n  - child\n  - sibling\n- after',
      indexes: [0, 1],
      expected: '- parent\n  - child',
    },
    {
      name: 'ordered parent header with one selected child',
      markdown: '1. parent\n   1. child\n   2. sibling\n2. after',
      indexes: [0, 1],
      expected: '1. parent\n   1. child',
    },
    {
      name: 'task parent header with one selected child',
      markdown: '- [ ] parent\n  - child\n  - sibling\n- after',
      indexes: [0, 1],
      expected: '- [ ] parent\n  - child',
    },
    {
      name: 'task children selected as standalone tasks',
      markdown: '- parent\n  - [ ] child\n  - [x] sibling',
      indexes: [1, 2],
      expected: '- [ ] child\n- [x] sibling',
    },
  ])('preserves partial nested list selections for $name', async ({ markdown, indexes, expected }) => {
    await expect(copySelectableBlockIndexes(markdown, indexes)).resolves.toBe(expected);
  });

  it.each([
    {
      name: 'code block under a bullet list item',
      markdown: ['- Item', '  ```ts', '  console.log(1)', '  ```'].join('\n'),
      indexes: [0, 1],
      expected: ['- Item', '', '  ```ts', '  console.log(1)', '  ```'].join('\n'),
    },
    {
      name: 'code block under an ordered list item',
      markdown: ['1. Item', '   ```ts', '   console.log(1)', '   ```'].join('\n'),
      indexes: [0, 1],
      expected: ['1. Item', '', '   ```ts', '   console.log(1)', '   ```'].join('\n'),
    },
    {
      name: 'code block under the first item of a multi-item bullet list',
      markdown: ['- Item', '  ```ts', '  console.log(1)', '  ```', '- Next'].join('\n'),
      indexes: [0, 1],
      expected: ['- Item', '', '  ```ts', '  console.log(1)', '  ```'].join('\n'),
    },
    {
      name: 'code block under the first item of a multi-item ordered list',
      markdown: ['1. Item', '   ```ts', '   console.log(1)', '   ```', '2. Next'].join('\n'),
      indexes: [0, 1],
      expected: ['1. Item', '', '   ```ts', '   console.log(1)', '   ```'].join('\n'),
    },
  ])('preserves partial list item selections with $name', async ({ markdown, indexes, expected }) => {
    await expect(copySelectableBlockIndexes(markdown, indexes)).resolves.toBe(expected);
  });

  it.each([
    {
      name: 'math block under a bullet list item',
      markdown: ['- Formula', '  $$', '  x^2', '  $$'].join('\n'),
      indexes: [0, 1],
      plugins: [...mathPlugin],
      expected: ['- Formula', '', '  $$', '  x^2', '  $$'].join('\n'),
    },
    {
      name: 'math block under an ordered list item',
      markdown: ['2. Formula', '   $$', '   x^2', '   $$'].join('\n'),
      indexes: [0, 1],
      plugins: [...mathPlugin],
      expected: ['2. Formula', '', '   $$', '   x^2', '   $$'].join('\n'),
    },
    {
      name: 'Mermaid block under a bullet list item',
      markdown: ['- Diagram', '  ```sequence', '  Alice->Bob: Hello', '  ```'].join('\n'),
      indexes: [0, 1],
      plugins: [...mermaidPlugin, ...codePlugin],
      expected: ['- Diagram', '', '  ```mermaid', '  sequenceDiagram', '  Alice->Bob: Hello', '  ```'].join('\n'),
    },
    {
      name: 'table under a bullet list item',
      markdown: ['- Table', '  | A | B |', '  | --- | --- |', '  | 1 | 2 |'].join('\n'),
      indexes: [0, 1],
      plugins: [],
      expected: ['- Table', '', '  | A | B |', '  | - | - |', '  | 1 | 2 |'].join('\n'),
    },
    {
      name: 'table under a task list item',
      markdown: ['- [ ] Table', '  | A | B |', '  | --- | --- |', '  | 1 | 2 |'].join('\n'),
      indexes: [0, 1],
      plugins: [],
      expected: ['- [ ] Table', '  | A | B |', '  | - | - |', '  | 1 | 2 |'].join('\n'),
    },
    {
      name: 'code block under a multi-digit ordered list item',
      markdown: ['10. Item', '    ```ts', '    console.log(10)', '    ```'].join('\n'),
      indexes: [0, 1],
      plugins: [],
      expected: ['10. Item', '', '    ```ts', '    console.log(10)', '    ```'].join('\n'),
    },
  ])('preserves partial list item selections with $name', async ({ markdown, indexes, plugins, expected }) => {
    await expect(copySelectableBlockIndexes(markdown, indexes, plugins)).resolves.toBe(expected);
  });

  it.each([
    {
      name: 'math block inside a list item',
      markdown: ['- Formula', '  $$', '  x^2', '  $$'].join('\n'),
      plugins: [...mathPlugin],
      expected: ['$$', 'x^2', '$$'].join('\n'),
    },
    {
      name: 'Mermaid block inside a list item',
      markdown: ['- Diagram', '  ```sequence', '  Alice->Bob: Hello', '  ```'].join('\n'),
      plugins: [...mermaidPlugin, ...codePlugin],
      expected: ['```mermaid', 'sequenceDiagram', 'Alice->Bob: Hello', '```'].join('\n'),
    },
    {
      name: 'table inside a list item',
      markdown: ['- Table', '  | A | B |', '  | --- | --- |', '  | 1 | 2 |'].join('\n'),
      plugins: [],
      expected: ['| A | B |', '| - | - |', '| 1 | 2 |'].join('\n'),
    },
  ])('copies a selected $name without the containing list marker', async ({ markdown, plugins, expected }) => {
    await expect(copySelectableBlockIndexes(markdown, [0], plugins)).resolves.toBe(expected);
  });

  it.each([
    {
      name: 'math block with intentional extra indentation',
      markdown: ['- Formula', '  $$', '    \\begin{aligned}', '      x &= 1', '    \\end{aligned}', '  $$'].join('\n'),
      nodeName: 'math_block',
      plugins: [...mathPlugin],
      expected: ['$$', '  \\begin{aligned}', '    x &= 1', '  \\end{aligned}', '$$'].join('\n'),
    },
    {
      name: 'table after a list item paragraph and before another paragraph',
      markdown: ['- Table', '  | A | B |', '  | --- | --- |', '  | 1 | 2 |', '', '  after'].join('\n'),
      nodeName: 'table',
      plugins: [],
      expected: ['| A | B |', '| - | - |', '| 1 | 2 |'].join('\n'),
    },
    {
      name: 'Mermaid block after a list item paragraph and before another paragraph',
      markdown: ['- Diagram', '  ```sequence', '  Alice->Bob: Hello', '  ```', '', '  after'].join('\n'),
      nodeName: 'mermaid',
      plugins: [...mermaidPlugin, ...codePlugin],
      expected: ['```mermaid', 'sequenceDiagram', 'Alice->Bob: Hello', '```'].join('\n'),
    },
  ])('copies a selected $name without leaking list continuation indentation', async ({
    markdown,
    nodeName,
    plugins,
    expected,
  }) => {
    await expect(copyFirstSelectableBlockByNodeName(markdown, nodeName, plugins)).resolves.toBe(expected);
  });

  it.each([
    {
      name: 'bullet item with table and trailing paragraph',
      markdown: ['- Table', '  | A | B |', '  | --- | --- |', '  | 1 | 2 |', '', '  after'].join('\n'),
      plugins: [],
      expected: ['Table', '', '| A | B |', '| - | - |', '| 1 | 2 |', '', 'after'].join('\n'),
    },
    {
      name: 'ordered item with math and trailing paragraph',
      markdown: ['3. Formula', '   $$', '   x^2', '   $$', '', '   after'].join('\n'),
      plugins: [...mathPlugin],
      expected: ['Formula', '', '$$', 'x^2', '$$', '', 'after'].join('\n'),
    },
    {
      name: 'bullet item starting with table',
      markdown: ['- | A | B |', '  | --- | --- |', '  | 1 | 2 |'].join('\n'),
      plugins: [],
      expected: ['| A | B |', '| - | - |', '| 1 | 2 |'].join('\n'),
    },
    {
      name: 'multi-digit ordered item with code and trailing paragraph',
      markdown: ['10. Item', '    ```ts', '    console.log(10)', '    ```', '', '    after'].join('\n'),
      plugins: [],
      expected: ['Item', '', '```ts', 'console.log(10)', '```', '', 'after'].join('\n'),
    },
    {
      name: 'bullet item with a nested list',
      markdown: ['- parent', '  - child', '  - sibling'].join('\n'),
      plugins: [],
      expected: 'parent',
    },
  ])('copies a whole $name without duplicate child blocks', async ({ markdown, plugins, expected }) => {
    await expect(copyFirstSelectableBlockByNodeName(markdown, 'list_item', plugins)).resolves.toBe(expected);
  });

  it.each([
    {
      name: 'multi-digit ordered parent header with one selected child',
      markdown: '10. parent\n    1. child\n    2. sibling\n11. after',
      indexes: [0, 1],
      expected: '10. parent\n    1. child',
    },
    {
      name: 'task parent header with a selected table child',
      markdown: ['- [ ] parent', '  | A | B |', '  | --- | --- |', '  | 1 | 2 |', '- after'].join('\n'),
      indexes: [0, 1],
      expected: ['- [ ] parent', '  | A | B |', '  | - | - |', '  | 1 | 2 |'].join('\n'),
    },
  ])('preserves marker-specific continuation for $name', async ({ markdown, indexes, expected }) => {
    await expect(copySelectableBlockIndexes(markdown, indexes)).resolves.toBe(expected);
  });

  it.each([
    {
      name: 'blockquote containing an empty ordered list item',
      markdown: ['> 1.', '> 2. B', '>', '> after'].join('\n'),
      expected: ['> 1.', '> 2. B', '>', '> after'].join('\n'),
    },
    {
      name: 'callout containing a task list',
      markdown: ['> 💡 Tip', '>', '> - [ ] A', '> - [x] B'].join('\n'),
      plugins: [...calloutPlugin],
      expected: ['> 💡 Tip', '>', '> - [ ] A', '>', '> - [x] B'].join('\n'),
    },
  ])('preserves copied container block markdown for $name', async ({ markdown, plugins = [], expected }) => {
    await expect(copyAllSelectableBlocks(markdown, plugins)).resolves.toBe(expected);
  });

  it('keeps markdown semantics for task lists separated by a single blank line', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '- [ ] A\n\n- [ ] B');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      '- [ ] A\n- [ ] B'
    );

    await editor.destroy();
  });

  it('copies a single task block without task markdown syntax', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '- [ ] todo');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      'todo'
    );

    await editor.destroy();
  });

  it.each([
    {
      name: 'ordered',
      markdown: '1. only ordered',
      expected: 'only ordered',
    },
    {
      name: 'bullet',
      markdown: '- only bullet',
      expected: 'only bullet',
    },
    {
      name: 'task',
      markdown: '- [ ] only task',
      expected: 'only task',
    },
  ])('copies a single $name block without list markdown syntax', async ({ markdown, expected }) => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, markdown);
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(blocks).toHaveLength(1);
    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      expected
    );

    await editor.destroy();
  });

  it('copies a single nested task block without markdown syntax', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '- [ ] 1\n  - [ ] 2');
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(blocks).toHaveLength(2);
    expect(serializeSelectedBlocksToText(view.state, [blocks[1]], { markdownSerializer: serializer })).toBe(
      '2'
    );

    await editor.destroy();
  });

  it.each([
    {
      name: 'ordered',
      markdown: '1. parent\n   1. nested ordered',
      expected: 'nested ordered',
    },
    {
      name: 'bullet',
      markdown: '- parent\n  - nested bullet',
      expected: 'nested bullet',
    },
    {
      name: 'task',
      markdown: '- [ ] parent\n  - [ ] nested task',
      expected: 'nested task',
    },
  ])('copies a single nested $name block without markdown syntax', async ({ markdown, expected }) => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, markdown);
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(blocks).toHaveLength(2);
    expect(serializeSelectedBlocksToText(view.state, [blocks[1]], { markdownSerializer: serializer })).toBe(
      expected
    );

    await editor.destroy();
  });

  it('copies selected code blocks as fenced markdown', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['```ts', 'const a = 1;', '', 'console.log(a);', '```'].join('\n'));
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      ['```ts', 'const a = 1;', '', 'console.log(a);', '```'].join('\n')
    );

    await editor.destroy();
  });

  it('copies a code block inside a list item without including the list marker', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['- Item', '  ```ts', '  console.log(1)', '  ```'].join('\n'));
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const codeBlock = blocks.find((range) => view.state.doc.resolve(range.from).nodeAfter?.type.name === 'code_block');

    expect(codeBlock).toBeDefined();
    expect(serializeSelectedBlocksToText(view.state, [codeBlock!], { markdownSerializer: serializer })).toBe(
      ['```ts', 'console.log(1)', '```'].join('\n')
    );

    await editor.destroy();
  });

  it('preserves intentional code indentation when copying a code block inside a list item', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, [
          '- Item',
          '  ```ts',
          '  if (ok) {',
          '    console.log(1)',
          '  }',
          '  ```',
        ].join('\n'));
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const codeBlock = blocks.find((range) => view.state.doc.resolve(range.from).nodeAfter?.type.name === 'code_block');

    expect(codeBlock).toBeDefined();
    expect(serializeSelectedBlocksToText(view.state, [codeBlock!], { markdownSerializer: serializer })).toBe(
      ['```ts', 'if (ok) {', '  console.log(1)', '}', '```'].join('\n')
    );

    await editor.destroy();
  });

  it('does not treat fence-like code content as a selected code block closing fence', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, [
          '- Item',
          '  ````ts',
          '  ````not close',
          '  console.log(1)',
          '  ````',
        ].join('\n'));
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const codeBlock = blocks.find((range) => view.state.doc.resolve(range.from).nodeAfter?.type.name === 'code_block');

    expect(codeBlock).toBeDefined();
    expect(serializeSelectedBlocksToText(view.state, [codeBlock!], { markdownSerializer: serializer })).toBe(
      ['`````ts', '````not close', 'console.log(1)', '`````'].join('\n')
    );

    await editor.destroy();
  });

  it('copies a whole list item with an inner code block as one list item body', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['- Item', '  ```ts', '  console.log(1)', '  ```'].join('\n'));
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);
    const listItem = blocks.find((range) => view.state.doc.resolve(range.from).nodeAfter?.type.name === 'list_item');

    expect(listItem).toBeDefined();
    expect(serializeSelectedBlocksToText(view.state, [listItem!], { markdownSerializer: serializer })).toBe(
      ['Item', '', '```ts', 'console.log(1)', '```'].join('\n')
    );

    await editor.destroy();
  });

  it('copies selected diagram blocks as fenced Mermaid markdown', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['```sequence', 'Alice->Bob: Hello', '```'].join('\n'));
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(mermaidPlugin)
      .use(codePlugin);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      ['```mermaid', 'sequenceDiagram', 'Alice->Bob: Hello', '```'].join('\n')
    );

    await editor.destroy();
  });

  it('copies selected formula blocks as math markdown', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['$$', 'x^2', '$$'].join('\n'));
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(mathPlugin);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      ['$$', 'x^2', '$$'].join('\n')
    );

    await editor.destroy();
  });

  it('copies selected table blocks as table markdown', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n'));
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const serializer = editor.ctx.get(serializerCtx);
    const view = editor.ctx.get(editorViewCtx);
    const blocks = collectSelectableBlockRanges(view.state.doc);

    expect(serializeSelectedBlocksToText(view.state, blocks, { markdownSerializer: serializer })).toBe(
      ['| A | B |', '| - | - |', '| 1 | 2 |'].join('\n')
    );

    await editor.destroy();
  });
});
