import { expect, test, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  EDITOR_SELECTOR,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const BODY_LINE_NUMBER_MARKDOWN = [
  '---',
  'title: Body Line Numbers',
  '---',
  '# Heading sentinel',
  '<!--vlaina-markdown-blank-line-->',
  'Intro paragraph sentinel that is intentionally long enough to stay a regular body paragraph.',
  '- Parent item sentinel',
  '  - Nested item sentinel',
  '- Next item sentinel',
  '',
  '```ts',
  'const hidden = true;',
  '```',
  '',
  'After code sentinel',
  '| Col | Value |',
  '| --- | --- |',
  '| A | B |',
  '> Quote sentinel',
].join('\n');

const EXPECTED_BODY_LINE_LABELS = ['4', '6', '7', '8', '9', '15', '16', '19'];

async function collectBodyLineNumberDiagnostics(page: Page) {
  return page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    if (!editor) throw new Error('Missing editor');

    function findTextElement(selector: string, text: string): HTMLElement {
      const element = Array.from(editor.querySelectorAll<HTMLElement>(selector))
        .find((candidate) => candidate.textContent?.includes(text));
      if (!element) throw new Error(`Missing ${selector} containing ${text}`);
      return element;
    }

    function getOwnListItemText(item: HTMLElement): string {
      return Array.from(item.childNodes)
        .filter((node) => !(node instanceof HTMLElement && /^(?:ul|ol)$/i.test(node.tagName)))
        .map((node) => node.textContent ?? '')
        .join('');
    }

    function findListItem(text: string): HTMLElement {
      const element = Array.from(editor.querySelectorAll<HTMLElement>('li'))
        .find((candidate) => getOwnListItemText(candidate).includes(text));
      if (!element) throw new Error(`Missing li containing own text ${text}`);
      return element;
    }

    function firstTextCenterY(root: HTMLElement): number {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const parent = node.parentElement;
        if (!parent) continue;
        if (root.tagName === 'LI' && parent.closest('li') !== root) continue;
        if (parent.closest('[aria-hidden="true"], [contenteditable="false"], .body-line-number-gutter')) continue;

        const range = document.createRange();
        try {
          range.selectNodeContents(node);
          const rects = range.getClientRects();
          for (let index = 0; index < rects.length; index += 1) {
            const rect = rects.item(index);
            if (rect && (rect.width > 0 || rect.height > 0)) {
              return rect.top + rect.height / 2;
            }
          }
        } finally {
          range.detach();
        }
      }

      const rect = root.getBoundingClientRect();
      return rect.top + rect.height / 2;
    }

    const labels = Array.from(document.querySelectorAll<HTMLElement>('.body-line-number'));
    const targets = [
      findTextElement('h1', 'Heading sentinel'),
      findTextElement('p', 'Intro paragraph sentinel'),
      findListItem('Parent item sentinel'),
      findListItem('Nested item sentinel'),
      findListItem('Next item sentinel'),
      findTextElement('p', 'After code sentinel'),
      findTextElement('.milkdown-table-block, table', 'Col'),
      findTextElement('blockquote, [data-type="callout"]', 'Quote sentinel'),
    ];
    const editorRect = editor.getBoundingClientRect();
    const labelRects = labels.map((label) => {
      const rect = label.getBoundingClientRect();
      return {
        text: label.textContent?.trim() ?? '',
        centerY: rect.top + rect.height / 2,
        right: rect.right,
      };
    });

    return {
      labels: labelRects.map((label) => label.text),
      maxVerticalDelta: Math.max(
        ...labelRects.map((label, index) => Math.abs(label.centerY - firstTextCenterY(targets[index])))
      ),
      minLabelContentGap: Math.min(...labelRects.map((label) => editorRect.left - label.right)),
      blankPlaceholderLabelCount: Array.from(document.querySelectorAll<HTMLElement>('.body-line-number'))
        .filter((label) => {
          const rect = label.getBoundingClientRect();
          const blank = editor.querySelector<HTMLElement>('[data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"]');
          const blankRect = blank?.getBoundingClientRect();
          if (!blankRect) return false;
          const centerY = rect.top + rect.height / 2;
          return centerY >= blankRect.top && centerY <= blankRect.bottom;
        }).length,
    };
  });
}

test.describe('notes body line numbers', () => {
  test('aligns mixed markdown body line numbers to rendered body blocks', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-body-line-numbers');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await page.evaluate(() => (window as any).__vlainaE2E.setMarkdownBodyLineNumbers(true));

      await openMarkdownFixture(page, {
        filename: 'body-line-numbers.md',
        content: BODY_LINE_NUMBER_MARKDOWN,
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('After code sentinel');
      await expect.poll(
        async () => page.evaluate(() => Array.from(
          document.querySelectorAll<HTMLElement>('.body-line-number')
        ).map((label) => label.textContent?.trim() ?? '')),
        { timeout: 30_000 },
      ).toEqual(EXPECTED_BODY_LINE_LABELS);
      await waitForEditorAnimationFrame(page);

      const diagnostics = await collectBodyLineNumberDiagnostics(page);
      console.info('[notes-body-line-numbers]', diagnostics);

      expect(diagnostics.labels).toEqual(EXPECTED_BODY_LINE_LABELS);
      expect(diagnostics.blankPlaceholderLabelCount).toBe(0);
      expect(diagnostics.minLabelContentGap).toBeGreaterThanOrEqual(10);
      expect(diagnostics.maxVerticalDelta).toBeLessThanOrEqual(3);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
