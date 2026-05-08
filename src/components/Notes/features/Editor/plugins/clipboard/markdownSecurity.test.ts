import { afterEach, describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';

import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import { configureTheme } from '../../theme';
import { normalizeSerializedMarkdownDocument, stripTrailingNewlines } from '@/lib/notes/markdown/markdownSerializationUtils';

type TestEditor = ReturnType<typeof Editor.make>;

const editors: TestEditor[] = [];

afterEach(async () => {
  while (editors.length > 0) {
    await editors.pop()?.destroy();
  }
  document.body.innerHTML = '';
});

async function openMarkdown(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(configureTheme);

  await editor.create();
  editors.push(editor);

  const view = editor.ctx.get(editorViewCtx);
  const serializer = editor.ctx.get(serializerCtx);
  return {
    view,
    dom: view.dom,
    persisted: stripTrailingNewlines(normalizeSerializedMarkdownDocument(serializer(view.state.doc))),
  };
}

describe('markdown security when opening notes', () => {
  it('does not render executable or local-file markdown links as anchors', async () => {
    const result = await openMarkdown([
      '[javascript](javascript:alert(1))',
      '[data](data:text/html;base64,PHNjcmlwdD4=)',
      '[file](file:///etc/passwd)',
      '[windows](C:\\Windows\\win.ini)',
      '[safe](https://example.com/docs)',
      '[mail](mailto:user@example.com)',
      '[relative](docs/safe.md)',
    ].join(' '));

    const hrefs = Array.from(result.dom.querySelectorAll('a')).map((anchor) => anchor.getAttribute('href'));

    expect(hrefs).toContain('https://example.com/docs');
    expect(hrefs).toContain('mailto:user@example.com');
    expect(hrefs).toContain('docs/safe.md');
    expect(hrefs.some((href) => href?.startsWith('javascript:'))).toBe(false);
    expect(hrefs.some((href) => href?.startsWith('data:'))).toBe(false);
    expect(hrefs.some((href) => href?.startsWith('file:'))).toBe(false);
    expect(result.persisted).not.toContain('javascript:alert');
    expect(result.persisted).not.toContain('file:///etc/passwd');
  });

  it('does not auto-load executable, local, private-network, or public remote image sources', async () => {
    const result = await openMarkdown([
      '![javascript](javascript:alert(1))',
      '![data](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)',
      '![asset](asset://localhost/secret.png)',
      '![file](file:///etc/passwd)',
      '![unix](/etc/passwd)',
      '![localhost](http://127.0.0.1:3000/secret.png)',
      '![short-ip](http://127.1/secret.png)',
      '![integer-ip](http://2130706433/secret.png)',
      '![private](http://192.168.1.8/secret.png)',
      '![safe](https://example.com/safe.png)',
      '![relative](images/safe.png)',
      '<img src="javascript:alert(1)" alt="raw-js">',
      '<img src="/etc/passwd" alt="raw-unix">',
      '<img src="http://localhost:3000/secret.png" alt="raw-local">',
      '<img src="http://0177.0.0.1/secret.png" alt="raw-octal">',
      '<img src="//127.0.0.1:3000/secret.png" alt="raw-protocol-relative">',
      '<picture><source srcset="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+ 1x"><img src="https://example.com/fallback.png"></picture>',
      '<picture><source srcset="//127.0.0.1:3000/secret.png 1x"><img src="https://example.com/fallback.png"></picture>',
    ].join('\n\n'));

    const srcs = Array.from(result.dom.querySelectorAll('img')).map((image) => image.getAttribute('src'));
    const srcsets = Array.from(result.dom.querySelectorAll('source')).map((source) => source.getAttribute('srcset'));

    expect(srcs).not.toContain('https://example.com/safe.png');
    expect(srcs).toContain('images/safe.png');
    expect(srcs.some((src) => src?.startsWith('javascript:'))).toBe(false);
    expect(srcs.some((src) => src?.startsWith('data:'))).toBe(false);
    expect(srcs.some((src) => src?.startsWith('asset:'))).toBe(false);
    expect(srcs.some((src) => src?.startsWith('file:'))).toBe(false);
    expect(srcs.some((src) => src === '/etc/passwd')).toBe(false);
    expect(srcs.some((src) => src?.includes('127.0.0.1') || src?.includes('localhost'))).toBe(false);
    expect(srcs.some((src) => src?.includes('127.1') || src?.includes('2130706433') || src?.includes('0177.'))).toBe(false);
    expect(srcs.some((src) => src?.includes('192.168.'))).toBe(false);
    expect(srcsets.some((srcset) => srcset?.includes('data:image') || srcset?.includes('127.0.0.1'))).toBe(false);
    expect(result.persisted).toContain('![safe](https://example.com/safe.png)');
  });

  it('sanitizes unsafe link marks before rendering DOM anchors', async () => {
    const result = await openMarkdown('unsafe link');
    const { state, dispatch } = result.view;
    const linkMark = state.schema.marks.link;
    const tr = state.tr
      .setSelection(TextSelection.create(state.doc, 1, state.doc.content.size - 1))
      .addMark(1, state.doc.content.size - 1, linkMark.create({ href: 'javascript:alert(1)' }));

    dispatch(tr);

    const anchor = result.dom.querySelector('a');
    expect(anchor?.getAttribute('href')).toBeNull();
    expect(result.dom.innerHTML).not.toContain('javascript:');
  });
});
