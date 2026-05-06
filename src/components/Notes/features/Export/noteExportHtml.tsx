import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import {
  CHAT_MARKDOWN_REHYPE_PLUGINS,
  CHAT_MARKDOWN_REMARK_PLUGINS,
} from '@/components/Chat/features/Markdown/markdownPipeline';
import { cn } from '@/lib/utils';

const EXPORT_WIDTH_PX = 840;

const EXPORT_CSS = `
  :root {
    color-scheme: light;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #171717;
    background: #ffffff;
  }
  body {
    margin: 0;
    background: #ffffff;
  }
  .vlaina-note-export {
    box-sizing: border-box;
    width: ${EXPORT_WIDTH_PX}px;
    margin: 0 auto;
    padding: 56px 64px 72px;
    background: #ffffff;
  }
  .vlaina-note-export h1.vlaina-note-export-title {
    margin: 0 0 28px;
    font-size: 34px;
    line-height: 1.16;
    font-weight: 700;
  }
  .vlaina-note-export-body {
    font-size: 15px;
    line-height: 1.72;
    overflow-wrap: anywhere;
  }
  .vlaina-note-export-body h1,
  .vlaina-note-export-body h2,
  .vlaina-note-export-body h3,
  .vlaina-note-export-body h4 {
    margin: 1.5em 0 0.45em;
    line-height: 1.25;
  }
  .vlaina-note-export-body h1 { font-size: 28px; }
  .vlaina-note-export-body h2 { font-size: 23px; }
  .vlaina-note-export-body h3 { font-size: 19px; }
  .vlaina-note-export-body p,
  .vlaina-note-export-body ul,
  .vlaina-note-export-body ol,
  .vlaina-note-export-body blockquote,
  .vlaina-note-export-body pre,
  .vlaina-note-export-body table {
    margin: 0.8em 0;
  }
  .vlaina-note-export-body blockquote {
    border-left: 4px solid #d4d4d4;
    padding-left: 14px;
    color: #525252;
  }
  .vlaina-note-export-body code {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.92em;
    background: #f5f5f5;
    border-radius: 4px;
    padding: 0.12em 0.28em;
  }
  .vlaina-note-export-body pre {
    overflow: auto;
    background: #f5f5f5;
    border-radius: 6px;
    padding: 14px 16px;
  }
  .vlaina-note-export-body pre code {
    background: transparent;
    padding: 0;
  }
  .vlaina-note-export-body img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
  }
  .vlaina-note-export-body table {
    width: 100%;
    border-collapse: collapse;
  }
  .vlaina-note-export-body th,
  .vlaina-note-export-body td {
    border: 1px solid #d4d4d4;
    padding: 7px 9px;
    vertical-align: top;
  }
  .vlaina-note-export-body th {
    background: #f5f5f5;
    font-weight: 600;
  }
  @page {
    margin: 0;
  }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function waitForExportRender(container: HTMLElement): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(images.map(async (image) => {
    if (image.complete) {
      return;
    }
    try {
      await image.decode();
    } catch {
      // Export should still continue if a remote/local image cannot be decoded.
    }
  }));
}

export function NoteExportDocument({
  markdown,
  title,
  className,
}: {
  markdown: string;
  title: string;
  className?: string;
}) {
  return (
    <article className={cn('vlaina-note-export', className)}>
      <h1 className="vlaina-note-export-title">{title}</h1>
      <div className="vlaina-note-export-body">
        <ReactMarkdown
          remarkPlugins={CHAT_MARKDOWN_REMARK_PLUGINS}
          rehypePlugins={CHAT_MARKDOWN_REHYPE_PLUGINS}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </article>
  );
}

export async function renderNoteExportElement(markdown: string, title: string): Promise<{
  element: HTMLElement;
  cleanup: () => void;
}> {
  const host = document.createElement('div');
  host.style.position = 'absolute';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = `${EXPORT_WIDTH_PX}px`;
  host.style.background = '#fff';
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);

  const style = document.createElement('style');
  style.textContent = EXPORT_CSS;
  host.appendChild(style);

  const mount = document.createElement('div');
  host.appendChild(mount);

  const root = createRoot(mount);
  root.render(<NoteExportDocument markdown={markdown} title={title} />);
  await waitForExportRender(host);

  const element = host.querySelector('.vlaina-note-export') as HTMLElement | null;
  if (!element) {
    root.unmount();
    host.remove();
    throw new Error('Failed to render export document.');
  }

  return {
    element,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

export async function renderNoteExportHtml(markdown: string, title: string): Promise<string> {
  const { element, cleanup } = await renderNoteExportElement(markdown, title);
  try {
    return [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      `<title>${escapeHtml(title)}</title>`,
      `<style>${EXPORT_CSS}</style>`,
      '</head>',
      '<body>',
      element.outerHTML,
      '</body>',
      '</html>',
    ].join('');
  } finally {
    cleanup();
  }
}
