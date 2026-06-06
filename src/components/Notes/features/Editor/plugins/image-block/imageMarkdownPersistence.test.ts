import { describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  parserCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { DOMParser as ProseDOMParser, type Node as ProseNode } from '@milkdown/kit/prose/model';
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
  doc.descendants((node: ProseNode) => {
    if (node.type.name === 'image') {
      attrs.push(node.attrs);
    }
  });
  await editor.destroy();
  return attrs;
}

async function parseImageAttrsFromDom(html: string) {
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
  const template = document.createElement('template');
  template.innerHTML = html;
  const doc = ProseDOMParser.fromSchema(schema).parse(template.content);
  const attrs: Record<string, unknown>[] = [];
  doc.descendants((node: ProseNode) => {
    if (node.type.name === 'image') {
      attrs.push(node.attrs);
    }
  });
  await editor.destroy();
  return attrs;
}

async function serializeImageDom(html: string) {
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
  const template = document.createElement('template');
  template.innerHTML = html;
  const doc = ProseDOMParser.fromSchema(schema).parse(template.content);
  const markdown = editor.ctx.get(serializerCtx)(doc).trim();
  await editor.destroy();
  return markdown;
}

describe('image markdown persistence', () => {
  it('serializes uploaded image attrs as html image syntax', async () => {
    await expect(serializeImageAttrs({
      src: './assets/demo-image.png',
      alt: 'demo-image',
      align: 'center',
      width: null,
    })).resolves.toBe('<img src="./assets/demo-image.png" alt="demo-image" />');
  });

  it('does not markdown-escape underscores in image filenames', async () => {
    await expect(serializeImageAttrs({
      src: './assets/2026-05-22_18-51-57.png',
      alt: '2026-05-22_18-51-57',
      align: 'center',
      width: null,
    })).resolves.toBe('<img src="./assets/2026-05-22_18-51-57.png" alt="2026-05-22_18-51-57" />');
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

  it('serializes crop, alignment, and width as html attrs', async () => {
    await expect(serializeImageAttrs({
      src: './assets/demo.png',
      alt: 'demo',
      align: 'left',
      width: '40%',
      crop: { x: 1, y: 2, width: 30, height: 40, ratio: 1.5 },
    })).resolves.toBe(
      '<img src="./assets/demo.png" alt="demo" width="40%" align="left" data-vlaina-crop="1.000000,2.000000,30.000000,40.000000,1.500000" />'
    );
  });

  it('reopens image layout attrs from serialized html images', async () => {
    const markdown = await serializeImageAttrs({
      src: './assets/demo.png',
      alt: 'demo',
      align: 'left',
      width: '40%',
      crop: { x: 1, y: 2, width: 30, height: 40, ratio: 1.5 },
    });

    await expect(parseImageAttrs(markdown)).resolves.toMatchObject([
      {
        src: './assets/demo.png',
        alt: 'demo',
        align: 'left',
        width: '40%',
        crop: '1.000000,2.000000,30.000000,40.000000,1.500000',
      },
    ]);
  });

  it('round trips internal image asset refs through image nodes', async () => {
    const attrs = await parseImageAttrs('![demo](img:assets/demo.png)');
    expect(attrs).toMatchObject([
      {
        src: 'img:assets/demo.png',
        alt: 'demo',
        align: 'center',
      },
    ]);

    await expect(serializeImageAttrs(attrs[0])).resolves.toBe(
      '<img src="img:assets/demo.png" alt="demo" />'
    );
  });

  it('round trips safe raster data image refs through image nodes', async () => {
    const attrs = await parseImageAttrs('![demo](<DATA:IMAGE/WEBP;BASE64,AQI=>)');
    expect(attrs).toMatchObject([
      {
        src: 'data:image/webp;base64,AQI=',
        alt: 'demo',
        align: 'center',
      },
    ]);

    await expect(serializeImageAttrs(attrs[0])).resolves.toBe(
      '<img src="data:image/webp;base64,AQI=" alt="demo" />'
    );
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
        crop: null,
      },
    ]);

    await expect(serializeImageAttrs(attrs[0])).resolves.toBe(markdown);
  });

  it('keeps layout attrs when html images enter through DOM parsing', async () => {
    await expect(parseImageAttrsFromDom(
      '<img src="./assets/demo.png" alt="demo" width="40%" align="left" data-vlaina-crop="1.000000,2.000000,30.000000,40.000000,1.500000" />'
    )).resolves.toMatchObject([
      {
        src: './assets/demo.png',
        alt: 'demo',
        align: 'left',
        width: '40%',
        crop: { x: 1, y: 2, width: 30, height: 40, ratio: 1.5 },
      },
    ]);
    await expect(serializeImageDom(
      '<img src="./assets/demo.png" alt="demo" width="40%" align="left" data-vlaina-crop="1.000000,2.000000,30.000000,40.000000,1.500000" />'
    )).resolves.toBe(
      '<img src="./assets/demo.png" alt="demo" width="40%" align="left" data-vlaina-crop="1.000000,2.000000,30.000000,40.000000,1.500000" />'
    );
  });

  it('reopens paragraph-wrapped html images as image nodes', async () => {
    const markdown = [
      '<p align="center">',
      '    <img src=\'https://raw.githubusercontent.com/521xueweihan/img_logo/master/logo/cover.jpg\' style="max-width:100%;"></img>',
      '</p>',
    ].join('\n');

    const attrs = await parseImageAttrs(markdown);
    expect(attrs).toMatchObject([
      {
        src: 'https://raw.githubusercontent.com/521xueweihan/img_logo/master/logo/cover.jpg',
        alt: '',
        title: null,
        width: '100%',
        align: 'center',
      },
    ]);

    await expect(serializeImageAttrs(attrs[0])).resolves.toBe(
      '<img src="https://raw.githubusercontent.com/521xueweihan/img_logo/master/logo/cover.jpg" alt="" width="100%" />'
    );
  });

  it('reopens common single-image html wrappers as image nodes', async () => {
    await expect(parseImageAttrs([
      '<p align="center">',
      '  <a href="https://example.com">',
      '    <img src="https://example.com/a.png" alt="linked">',
      '  </a>',
      '</p>',
    ].join('\n'))).resolves.toMatchObject([
      {
        src: 'https://example.com/a.png',
        alt: 'linked',
        align: 'center',
      },
    ]);

    await expect(parseImageAttrs(
      '<div style="text-align: right"><img src="https://example.com/right.png" style="max-width: 100%" /></div>'
    )).resolves.toMatchObject([
      {
        src: 'https://example.com/right.png',
        width: '100%',
        align: 'right',
      },
    ]);

    await expect(parseImageAttrs(
      '<picture><source srcset="./a.webp 1x"><img src="https://example.com/fallback.png" alt="fallback"></picture>'
    )).resolves.toMatchObject([
      {
        src: 'https://example.com/fallback.png',
        alt: 'fallback',
      },
    ]);
  });

  it('drops unsafe image sources during markdown serialization', async () => {
    await expect(serializeImageAttrs({
      src: 'javascript:alert(1)',
      alt: 'bad',
      align: 'center',
      width: null,
    })).resolves.toBe('');
    await expect(serializeImageAttrs({
      src: 'img:/etc/passwd',
      alt: 'bad',
      align: 'center',
      width: null,
    })).resolves.toBe('');
    await expect(serializeImageAttrs({
      src: 'data:image/svg+xml;base64,PHN2Zz4=',
      alt: 'bad',
      align: 'center',
      width: null,
    })).resolves.toBe('');
  });
});
