import { expect, test, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  createChatFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  setAppViewMode,
  waitForChatSession,
} from './notesE2E';

const SENTINEL = 'CHAT_MARKDOWN_SYNTAX_FONT_SCALING_SENTINEL';

const SYNTAX_TARGETS = {
  abbreviation: 'abbr',
  blockquote: 'blockquote',
  body: 'p',
  callout: '.callout-content',
  codeBlock: '.code-block-chrome-code',
  codeLineNumbers: '.code-block-chrome-line-numbers',
  definitionDescription: 'dd',
  definitionTerm: 'dt',
  deletion: 'del',
  emphasis: 'em',
  heading1: 'h1',
  heading2: 'h2',
  heading3: 'h3',
  heading4: 'h4',
  heading5: 'h5',
  heading6: 'h6',
  highlight: 'mark.highlight',
  inlineCode: 'code:not(pre code)',
  inlineMath: '.katex',
  link: 'a:not(.toc-link)',
  orderedList: 'ol > li',
  rawKbd: 'kbd',
  rawSmall: 'small',
  strong: 'strong',
  subscript: 'sub',
  superscript: 'sup',
  tableCell: 'td',
  tableHeader: 'th',
  taskList: 'li.task-list-item',
  textColor: 'span[data-text-color]',
  tocLink: 'a.toc-link',
  unavailableImage: '[data-chat-markdown-unavailable="true"]',
  underline: 'u.underline',
  unorderedList: 'ul:not(.toc-list) > li:not(.task-list-item)',
} as const;

const STRUCTURAL_TARGETS = {
  blockMath: '.katex-display',
  details: 'details',
  hardBreak: 'br',
  horizontalRule: 'hr',
  image: 'img',
  mermaid: '.mermaid-block',
  summary: 'summary',
  video: '.video-block video',
} as const;

function createSyntaxFixture(): string {
  return [
    '*[HTML]: Hyper Text Markup Language',
    '',
    '[TOC]',
    '',
    '# Heading One',
    '## Heading Two',
    '### Heading Three',
    '#### Heading Four',
    '##### Heading Five',
    '###### Heading Six',
    '',
    SENTINEL + ' **strong** *emphasis* ~~deleted~~ [link](https://example.com) `inline code`',
    '',
    '==highlight== ++underline++ X^2^ H~2~O HTML <span style="color: #123456">colored</span>',
    '',
    '<small>small raw text</small> <kbd>Ctrl</kbd>',
    '',
    'Inline math $x^2 + y^2$.',
    '',
    '$$',
    'x^2 + y^2',
    '$$',
    '',
    'Hard break  ',
    'next line.',
    '',
    '- Unordered item',
    '',
    '1. Ordered item',
    '',
    '- [x] Completed task',
    '',
    '> Ordinary quote',
    '',
    '> 💡 Callout body',
    '',
    'Term',
    ': Definition',
    '',
    '| Header |',
    '| --- |',
    '| Cell |',
    '',
    '<details><summary>Summary</summary>Details body</details>',
    '',
    '![pixel](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=)',
    '',
    '![unavailable](relative/image.png)',
    '',
    '![video](https://example.com/movie.mp4)',
    '',
    '```ts',
    'const scaled = true;',
    'const secondLine = true;',
    '```',
    '',
    '```mermaid',
    'graph TD',
    'A --> B',
    '```',
    '',
    '---',
  ].join('\n');
}

async function collectSyntaxFontSizes(page: Page) {
  return page.evaluate((targets) => {
    const assistant = Array.from(document.querySelectorAll<HTMLElement>(
      '[data-message-item="true"][data-role="assistant"]',
    )).find((element) => element.textContent?.includes('CHAT_MARKDOWN_SYNTAX_FONT_SCALING_SENTINEL'));
    const surface = assistant?.querySelector<HTMLElement>('.markdown-surface') ?? null;

    return Object.fromEntries(Object.entries(targets).map(([name, selector]) => {
      const element = surface?.querySelector<HTMLElement>(selector) ?? null;
      return [name, element ? Number.parseFloat(getComputedStyle(element).fontSize) : 0];
    }));
  }, SYNTAX_TARGETS) as Promise<Record<keyof typeof SYNTAX_TARGETS, number>>;
}

async function collectStructuralSyntax(page: Page) {
  return page.evaluate((targets) => {
    const assistant = Array.from(document.querySelectorAll<HTMLElement>(
      '[data-message-item="true"][data-role="assistant"]',
    )).find((element) => element.textContent?.includes('CHAT_MARKDOWN_SYNTAX_FONT_SCALING_SENTINEL'));
    const surface = assistant?.querySelector<HTMLElement>('.markdown-surface') ?? null;
    return Object.fromEntries(Object.entries(targets).map(([name, selector]) => [
      name,
      Boolean(surface?.querySelector(selector)),
    ]));
  }, STRUCTURAL_TARGETS) as Promise<Record<keyof typeof STRUCTURAL_TARGETS, boolean>>;
}

test('scales every textual Chat markdown syntax from the current font size', async () => {
  const { app, userDataRoot } = await launchIsolatedElectron('chat-markdown-all-syntax-font-scaling');

  try {
    await app.firstWindow();
    const [page] = await getOpenBridgePages(app, 1);
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({ fontSize: 24 }));
    await page.evaluate(() => (window as any).__vlainaE2E.setMarkdownLineNumbers(true));

    const fixture = await createChatFixture(page, {
      sessions: [{
        title: 'Chat Markdown All Syntax Font Scaling',
        messages: [{ role: 'assistant', content: createSyntaxFixture() }],
      }],
    });

    await setAppViewMode(page, 'chat');
    await waitForChatSession(page, {
      sessionId: fixture.sessionIds[0]!,
      minMessageCount: 1,
      sentinelText: SENTINEL,
    });

    await expect.poll(async () => {
      const sizes = await collectSyntaxFontSizes(page);
      return Object.entries(sizes)
        .filter(([, size]) => size <= 0)
        .map(([name]) => name)
        .join(',');
    }, { timeout: 30_000 }).toBe('');
    await expect.poll(async () => {
      const structures = await collectStructuralSyntax(page);
      return Object.entries(structures)
        .filter(([, rendered]) => !rendered)
        .map(([name]) => name)
        .join(',');
    }, { timeout: 30_000 }).toBe('');
    const smaller = await collectSyntaxFontSizes(page);

    await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({ fontSize: 48 }));
    await expect.poll(async () => (await collectSyntaxFontSizes(page)).body).toBe(48);
    const larger = await collectSyntaxFontSizes(page);

    for (const name of Object.keys(SYNTAX_TARGETS) as Array<keyof typeof SYNTAX_TARGETS>) {
      expect(larger[name] / smaller[name], name).toBeCloseTo(2, 2);
    }
  } finally {
    await cleanupIsolatedElectron(app, userDataRoot);
  }
});
