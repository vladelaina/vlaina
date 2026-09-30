import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import {
  READONLY_MARKDOWN_REHYPE_PLUGINS,
  READONLY_MARKDOWN_REMARK_PLUGINS,
} from '@/components/common/markdown/markdownPipeline';
import { readonlyMarkdownUrlTransform } from '@/components/common/markdown/urlTransform';

const BLOCK_ELEMENTS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'DL', 'FIELDSET',
  'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4',
  'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
  'SECTION', 'TABLE', 'TR', 'UL',
]);

function appendVisibleText(node: Node, output: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    output.push(node.textContent ?? '');
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  if (node.tagName === 'BR') {
    output.push('\n');
    return;
  }
  if (node.tagName === 'IMG') {
    output.push(node.getAttribute('alt') ?? '');
    return;
  }

  node.childNodes.forEach((child) => appendVisibleText(child, output));
  if (node.tagName === 'TD' || node.tagName === 'TH') output.push('\t');
  if (BLOCK_ELEMENTS.has(node.tagName)) output.push('\n');
}

function htmlToPlainText(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  const output: string[] = [];
  container.childNodes.forEach((child) => appendVisibleText(child, output));
  return output.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function renderSourceClipboardContent(markdown: string): { html: string; text: string } {
  const html = renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={READONLY_MARKDOWN_REMARK_PLUGINS}
      rehypePlugins={READONLY_MARKDOWN_REHYPE_PLUGINS}
      urlTransform={readonlyMarkdownUrlTransform}
    >
      {markdown}
    </ReactMarkdown>,
  );
  return { html, text: htmlToPlainText(html) };
}
