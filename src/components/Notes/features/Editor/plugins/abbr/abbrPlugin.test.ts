import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { Decoration } from '@milkdown/kit/prose/view';
import { configureTheme } from '../../theme';
import {
  MAX_ABBR_DECORATIONS,
  MAX_ABBR_TITLE_CHARS,
  abbrPlugin,
  abbrPluginKey,
  extractAbbrDefinitions,
  findAbbrUsages,
  normalizeAbbrTitle,
} from './abbrPlugin';

interface FakeAbbrNode {
  child?: (index: number) => FakeAbbrNode | null | undefined;
  childCount?: number;
  isText?: boolean;
  nodeSize?: number;
  text?: string;
}

function createTextNode(text: string): FakeAbbrNode {
  return {
    isText: true,
    nodeSize: text.length,
    text,
  };
}

function createDocNode(children: FakeAbbrNode[], onAccess?: () => void): FakeAbbrNode {
  return {
    childCount: children.length,
    child(index) {
      onAccess?.();
      return children[index];
    },
  };
}

describe('abbrPlugin', () => {
  it('bounds abbreviation title metadata', () => {
    expect(normalizeAbbrTitle('HyperText Markup Language')).toBe('HyperText Markup Language');
    expect(normalizeAbbrTitle('x'.repeat(MAX_ABBR_TITLE_CHARS + 1))).toHaveLength(MAX_ABBR_TITLE_CHARS);
    expect(normalizeAbbrTitle(null)).toBe('');
  });

  it('stops collecting definitions when the node scan budget is exhausted', () => {
    const doc = createDocNode([
      createTextNode('plain text'),
      createTextNode('*[HTML]: HyperText Markup Language'),
    ]);

    expect(extractAbbrDefinitions(doc, 1)).toEqual([]);
  });

  it('stops collecting usages when the node scan budget is exhausted', () => {
    const doc = createDocNode([
      createTextNode('plain text'),
      createTextNode('HTML usage'),
    ]);

    expect(findAbbrUsages(doc, [{ abbr: 'HTML', fullText: 'HyperText Markup Language' }], 1)).toEqual([]);
  });

  it('stops scanning usage nodes after the decoration cap is reached', () => {
    let accessed = 0;
    const children: FakeAbbrNode[] = [];
    for (let index = 0; index < MAX_ABBR_DECORATIONS + 2; index += 1) {
      children.push(createTextNode('HTML '));
    }

    const usages = findAbbrUsages(
      createDocNode(children, () => {
        accessed += 1;
      }),
      [{ abbr: 'HTML', fullText: 'HyperText Markup Language' }],
    );

    expect(usages).toHaveLength(MAX_ABBR_DECORATIONS);
    expect(accessed).toBe(MAX_ABBR_DECORATIONS);
  });

  it('decorates ordinary abbreviation usage without touching definitions or code', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, [
          '*[HTML]: HyperText Markup Language',
          '',
          'HTML and `HTML`.',
          '',
          '```',
          'HTML',
          '```',
        ].join('\n'));
      })
      .use(commonmark);

    for (const plugin of abbrPlugin) {
      editor.use(plugin);
    }

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const decorations = abbrPluginKey.getState(view.state)?.find() ?? [];

    expect(decorations.map((decoration: Decoration) => ({
      text: view.state.doc.textBetween(decoration.from, decoration.to),
      title: (decoration.type as any).attrs?.title,
    }))).toEqual([{
      text: 'HTML',
      title: 'HyperText Markup Language',
    }]);

    await editor.destroy();
  });

  it('ignores escaped abbreviation definition paragraphs', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(gfm)
      .use(configureTheme);

    for (const plugin of abbrPlugin) {
      editor.use(plugin);
    }

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const escapedDefinition = schema.nodes.paragraph.create(
      { vlainaEscapedBlockSyntax: 'abbrDefinition' },
      schema.text('*[HTML]: HyperText Markup Language')
    );
    const usage = schema.nodes.paragraph.create(null, schema.text('HTML usage'));

    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, [escapedDefinition, usage]));

    const decorations = abbrPluginKey.getState(view.state)?.find() ?? [];
    expect(decorations).toEqual([]);

    await editor.destroy();
  });

  it('caps abbreviation usage decorations in large notes', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, [
          '*[HTML]: HyperText Markup Language',
          '',
          Array.from({ length: 1100 }, () => 'HTML').join(' '),
        ].join('\n'));
      })
      .use(commonmark);

    for (const plugin of abbrPlugin) {
      editor.use(plugin);
    }

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const decorations = abbrPluginKey.getState(view.state)?.find() ?? [];

    expect(decorations).toHaveLength(1000);

    await editor.destroy();
  });
});
