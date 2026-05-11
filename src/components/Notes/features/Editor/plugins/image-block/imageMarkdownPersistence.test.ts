import { describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  parserCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import { configureTheme } from '../../theme';

async function serializeImageAttrs(attrs: Record<string, unknown>) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, '');
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(configureTheme);

  await editor.create();
  const schema = editor.ctx.get(editorViewCtx).state.schema;
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, [
      schema.nodes.image.create(attrs),
    ]),
  ]);
  const markdown = editor.ctx.get(serializerCtx)(doc).trim();
  await editor.destroy();
  return markdown;
}

async function parseImageAttrs(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, '');
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(configureTheme);

  await editor.create();
  const doc = editor.ctx.get(parserCtx)(markdown);
  const attrs: Record<string, unknown>[] = [];
  doc.descendants((node) => {
    if (node.type.name === 'image') {
      attrs.push(node.attrs);
    }
  });
  await editor.destroy();
  return attrs;
}

describe('image markdown persistence', () => {
  it('serializes uploaded image attrs as standard markdown image syntax', async () => {
    await expect(serializeImageAttrs({
      src: './assets/demo-image.png',
      alt: 'demo-image',
      align: 'center',
      width: null,
    })).resolves.toBe('![demo-image](./assets/demo-image.png)');
  });

  it('serializes image layout attrs as safe html when markdown image syntax cannot carry them', async () => {
    await expect(serializeImageAttrs({
      src: './assets/demo.png',
      alt: 'Demo < image',
      title: 'Title & More',
      align: 'right',
      width: '40%',
    })).resolves.toBe(
      '<img src="./assets/demo.png" alt="Demo &lt; image" width="40%" align="right" title="Title &amp; More" />'
    );
  });

  it('keeps crop, alignment, and width fragments inside the image URL', async () => {
    await expect(serializeImageAttrs({
      src: './assets/demo.png#c=1.000000,2.000000,30.000000,40.000000,1.500000&a=left&w=40%25',
      alt: 'demo',
      align: 'center',
      width: null,
    })).resolves.toBe(
      '![demo](./assets/demo.png#c=1.000000,2.000000,30.000000,40.000000,1.500000\\&a=left\\&w=40%25)'
    );
  });

  it('reopens image layout fragments from serialized markdown image URLs', async () => {
    const markdown = await serializeImageAttrs({
      src: './assets/demo.png#c=1.000000,2.000000,30.000000,40.000000,1.500000&a=left&w=40%25',
      alt: 'demo',
      align: 'center',
      width: null,
    });

    await expect(parseImageAttrs(markdown)).resolves.toMatchObject([
      {
        src: './assets/demo.png#c=1.000000,2.000000,30.000000,40.000000,1.500000&a=left&w=40%25',
        alt: 'demo',
      },
    ]);
  });

  it('round trips html image layout attrs after reopening', async () => {
    const markdown = '<img src="./assets/demo.png" alt="demo" width="40%" align="right" title="Demo" />';

    const attrs = await parseImageAttrs(markdown);
    expect(attrs).toMatchObject([
      {
        src: './assets/demo.png',
        alt: 'demo',
        title: 'Demo',
        width: '40%',
        align: 'right',
      },
    ]);

    await expect(serializeImageAttrs(attrs[0])).resolves.toBe(markdown);
  });

  it('drops unsafe image sources during markdown serialization', async () => {
    await expect(serializeImageAttrs({
      src: 'javascript:alert(1)',
      alt: 'bad',
      align: 'center',
      width: null,
    })).resolves.toBe('');
  });
});
