import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  NOTE_SCROLL_ROOT_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const LIVE_EDITOR_SELECTOR = `${EDITOR_SELECTOR}:not(.toolbar-applied-preview-overlay):not([aria-hidden="true"])`;
const VISIBLE_LINK_TOOLTIP_SELECTOR = '.link-tooltip-container:not(.hidden)';

async function openExistingLinkEditor(page: Page) {
  const existingLink = page.locator(
    `${LIVE_EDITOR_SELECTOR} a[href="https://example.com/original"]`,
    { hasText: 'Existing link target' },
  ).first();

  await expect(existingLink).toBeVisible({ timeout: 10_000 });
  await existingLink.hover();
  const tooltip = page.locator(VISIBLE_LINK_TOOLTIP_SELECTOR).first();
  await expect(tooltip.locator('.link-tooltip-viewer')).toBeVisible({ timeout: 10_000 });

  const editButton = tooltip.locator('.link-tooltip-action-btn').nth(1);
  await expect(editButton).toBeVisible({ timeout: 5_000 });
  await editButton.click();

  const input = tooltip.locator('textarea').first();
  await expect(input).toBeVisible({ timeout: 5_000 });
  await expect(input).toBeFocused({ timeout: 5_000 });
  await expect(input).toHaveValue('https://example.com/original');
}

async function clickEditorBlankArea(page: Page) {
  const point = await page.evaluate((editorSelector) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const tooltip = document.querySelector<HTMLElement>('.link-tooltip-container:not(.hidden)');
    if (!editor) return null;

    const rect = editor.getBoundingClientRect();
    const candidates = [
      [rect.right - 24, rect.top + 24],
      [rect.right - 24, rect.top + 96],
      [rect.right - 24, rect.top + 180],
      [rect.left + rect.width / 2, rect.top + 180],
      [rect.left + 24, rect.bottom - 24],
    ];

    for (const [x, y] of candidates) {
      const hit = document.elementFromPoint(x, y);
      if (
        hit instanceof Node &&
        editor.contains(hit) &&
        !tooltip?.contains(hit) &&
        !(hit instanceof Element && hit.closest('a[href], .autolink'))
      ) {
        return { x, y };
      }
    }

    return null;
  }, LIVE_EDITOR_SELECTOR);
  expect(point, 'Expected an editor blank point outside the link tooltip').not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
  await waitForEditorAnimationFrame(page);
}

async function clickNoteOuterBlankArea(page: Page) {
  const scrollRoot = page.locator(NOTE_SCROLL_ROOT_SELECTOR).first();
  await expect(scrollRoot).toBeVisible({ timeout: 5_000 });
  const box = await scrollRoot.boundingBox();
  expect(box, 'Expected note scroll root bounding box').not.toBeNull();
  await page.mouse.click(box!.x + box!.width - 24, box!.y + Math.min(96, box!.height - 24));
  await waitForEditorAnimationFrame(page);
}

test.describe('notes link tooltip close behavior', () => {
  test('closes an existing-link edit tooltip when clicking blank space', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-link-tooltip-close');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openMarkdownFixture(page, {
        filename: 'link-tooltip-close.md',
        content: [
          '# Link tooltip close',
          '',
          '[Existing link target](https://example.com/original) trailing text.',
          '',
          'Blank click destination paragraph.',
        ].join('\n'),
      });

      await openExistingLinkEditor(page);
      await clickEditorBlankArea(page);
      await expect(page.locator(VISIBLE_LINK_TOOLTIP_SELECTOR)).toHaveCount(0, { timeout: 5_000 });

      await openExistingLinkEditor(page);
      await clickNoteOuterBlankArea(page);
      await expect(page.locator(VISIBLE_LINK_TOOLTIP_SELECTOR)).toHaveCount(0, { timeout: 5_000 });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
