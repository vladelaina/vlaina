import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  installReferenceTyporaTheme,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

const POPUP_SIZING_MARKDOWN = [
  '# Popup sizing',
  '',
  'Text before the formula.',
  '',
  '$$',
  'E = mc^2',
  '$$',
  '',
  'Text before the diagram.',
  '',
  '```mermaid',
  'flowchart TD',
  '  A[Start] --> B[End]',
  '```',
  '',
  'Final paragraph.',
].join('\n');

type PopupMetrics = {
  body: RectMetrics | null;
  card: RectMetrics | null;
  contentRoot: RectMetrics | null;
  cssWidth: string;
  editor: RectMetrics | null;
  popup: RectMetrics | null;
  write: RectMetrics | null;
};

type RectMetrics = {
  left: number;
  right: number;
  width: number;
};

function expectPopupToMatchBody(metrics: PopupMetrics, label: string) {
  expect(metrics.body, `${label} body metrics`).not.toBeNull();
  expect(metrics.card, `${label} popup card metrics`).not.toBeNull();

  const body = metrics.body!;
  const card = metrics.card!;
  expect(card.width, `${label} card should not exceed the readable note body: ${JSON.stringify(metrics)}`)
    .toBeLessThanOrEqual(body.width + 1);
  expect(Math.abs(card.left - body.left), `${label} card should align to the readable note body: ${JSON.stringify(metrics)}`)
    .toBeLessThanOrEqual(1);
}

async function collectPopupMetrics(page: Page, popupSelector: string): Promise<PopupMetrics> {
  return page.evaluate(({ editorSelector, selector }) => {
    const toRect = (element: Element | null): RectMetrics | null => {
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      };
    };
    const readableRect = (element: Element | null): RectMetrics | null => {
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const paddingLeft = Number.parseFloat(style.paddingLeft || '0') || 0;
      const paddingRight = Number.parseFloat(style.paddingRight || '0') || 0;
      return {
        left: Math.round(rect.left + paddingLeft),
        right: Math.round(rect.right - paddingRight),
        width: Math.round(Math.max(0, rect.width - paddingLeft - paddingRight)),
      };
    };

    const card = document.querySelector(`${selector} .text-editor-card`);
    const editor = document.querySelector(editorSelector);
    const write = document.querySelector('#write');
    const contentRoot = document.querySelector('[data-note-content-root="true"]');
    const cardStyle = card instanceof HTMLElement ? getComputedStyle(card) : null;

    return {
      body: readableRect(editor),
      card: toRect(card),
      contentRoot: toRect(contentRoot),
      cssWidth: cardStyle?.width ?? '',
      editor: toRect(editor),
      popup: toRect(document.querySelector(selector)),
      write: toRect(write),
    };
  }, { editorSelector: EDITOR_SELECTOR, selector: popupSelector });
}

async function openAndMeasurePopup(page: Page, blockSelector: string, popupSelector: string): Promise<PopupMetrics> {
  const block = page.locator(blockSelector).first();
  await block.scrollIntoViewIfNeeded();
  await page.evaluate((selector) => {
    const target = document.querySelector(selector);
    if (!(target instanceof HTMLElement)) {
      throw new Error(`Could not find popup target: ${selector}`);
    }
    const rect = target.getBoundingClientRect();
    const clientX = rect.left + Math.min(Math.max(rect.width / 2, 1), 40);
    const clientY = rect.top + Math.min(Math.max(rect.height / 2, 1), 24);
    const eventInit: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 1,
      clientX,
      clientY,
      view: window,
    };
    target.dispatchEvent(new MouseEvent('mousedown', eventInit));
    target.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, buttons: 0 }));
    target.dispatchEvent(new MouseEvent('click', { ...eventInit, buttons: 0 }));
  }, blockSelector);
  await expect(page.locator(`${popupSelector} textarea.text-editor-textarea`).first()).toBeVisible({ timeout: 10_000 });
  return collectPopupMetrics(page, popupSelector);
}

test.describe('notes math and Mermaid popup sizing', () => {
  test('keeps text editor popups aligned to the readable note body under a Typora theme', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-text-editor-popup-sizing');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const installedTheme = await installReferenceTyporaTheme(page, 'vlook-fancy.css');
      console.info('[notes-popup-sizing-theme]', installedTheme);

      await openMarkdownFixture(page, {
        filename: 'popup-sizing.md',
        content: POPUP_SIZING_MARKDOWN,
      });

      const mathMetrics = await openAndMeasurePopup(
        page,
        `${EDITOR_SELECTOR} div[data-type="math-block"]`,
        '.math-editor-popup',
      );
      console.info('[notes-popup-sizing-math]', mathMetrics);
      expectPopupToMatchBody(mathMetrics, 'math');

      await page.keyboard.press('Escape');
      await expect(page.locator('.math-editor-popup')).toHaveCount(0);

      const mermaidMetrics = await openAndMeasurePopup(
        page,
        `${EDITOR_SELECTOR} div[data-type="mermaid"]`,
        '.mermaid-editor-popup',
      );
      console.info('[notes-popup-sizing-mermaid]', mermaidMetrics);
      expectPopupToMatchBody(mermaidMetrics, 'mermaid');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
