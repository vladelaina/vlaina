import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  cleanupIsolatedElectron,
  createNotesRootFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openNotesRootInNotes,
} from './notesE2E';

test.describe('collapsed sidebar peek', () => {
  test('keeps the expanded sidebar capsule intact at minimum resized width', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('sidebar-min-width-capsule');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1100, height: 760 });

      const fixture = await createNotesRootFilesFixture(page, {
        name: 'sidebar-min-width-capsule',
        files: [
          {
            filename: 'minimum-width.md',
            content: '# Minimum Width\n\nMINIMUM_WIDTH_SENTINEL',
          },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Sidebar Minimum Width NotesRoot',
        minFileCount: 1,
      });

      const resizeHandle = page.locator('[data-resize-handle="shell-sidebar"]').first();
      const handleBox = await resizeHandle.boundingBox();
      expect(handleBox).not.toBeNull();
      const startX = handleBox!.x + handleBox!.width / 2;
      const startY = handleBox!.y + handleBox!.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX - 160, startY, { steps: 8 });
      await page.mouse.up();

      const metrics = await page.evaluate(() => {
        const sidebar = document.querySelector<HTMLElement>('[data-shell-sidebar-width-scope="true"] > aside');
        const capsule = sidebar?.querySelector<HTMLElement>('[data-sidebar-capsule-panel="true"]') ?? null;
        const tablist = capsule?.querySelector<HTMLElement>('[role="tablist"]') ?? null;
        if (!sidebar || !capsule || !tablist) return null;

        const sidebarRect = sidebar.getBoundingClientRect();
        const capsuleRect = capsule.getBoundingClientRect();
        const tablistRect = tablist.getBoundingClientRect();
        const capsuleStyle = getComputedStyle(capsule);
        return {
          sidebarWidth: sidebarRect.width,
          capsuleLeft: capsuleRect.left,
          capsuleRight: capsuleRect.right,
          sidebarLeft: sidebarRect.left,
          sidebarRight: sidebarRect.right,
          tablistLeft: tablistRect.left,
          tablistRight: tablistRect.right,
          capsuleBorderRadius: Number.parseFloat(capsuleStyle.borderTopLeftRadius),
          capsuleOverflow: capsuleStyle.overflow,
        };
      });
      expect(metrics).not.toBeNull();
      expect(metrics!.sidebarWidth).toBeGreaterThanOrEqual(223);
      expect(metrics!.sidebarWidth).toBeLessThanOrEqual(226);
      expect(metrics!.capsuleBorderRadius).toBeGreaterThan(12);
      expect(metrics!.capsuleOverflow).toBe('hidden');
      expect(metrics!.capsuleLeft).toBeGreaterThanOrEqual(metrics!.sidebarLeft + 7);
      expect(metrics!.capsuleRight).toBeLessThanOrEqual(metrics!.sidebarRight - 7);
      expect(metrics!.tablistLeft).toBeGreaterThanOrEqual(metrics!.capsuleLeft);
      expect(metrics!.tablistRight).toBeLessThanOrEqual(metrics!.capsuleRight);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('opens the current sidebar from the left edge and allows note selection', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('sidebar-peek-collapsed');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1100, height: 760 });

      const fixture = await createNotesRootFilesFixture(page, {
        name: 'sidebar-peek',
        files: [
          {
            filename: 'peek-alpha.md',
            content: '# Peek Alpha\n\nPEEK_ALPHA_SENTINEL',
          },
          {
            filename: 'peek-beta.md',
            content: '# Peek Beta\n\nPEEK_BETA_SENTINEL',
          },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Sidebar Peek NotesRoot',
        minFileCount: 2,
      });
      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'peek-alpha' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('PEEK_ALPHA_SENTINEL', {
        timeout: 30_000,
      });

      await page.locator('.sidebar-user-header').hover();
      await page.locator('.sidebar-user-header-collapse').click();

      const peekSidebar = page.locator('[data-shell-sidebar-peek="true"]');
      await expect(peekSidebar).toHaveAttribute('data-open', 'false');
      await expect(peekSidebar).toHaveAttribute('aria-hidden', 'true');

      await page.mouse.move(2, 120);
      await expect(peekSidebar).toHaveAttribute('data-open', 'true');
      await expect(peekSidebar).toHaveAttribute('aria-hidden', 'false');
      const peekCapsule = page
        .locator('[data-shell-sidebar-peek="true"] [data-sidebar-capsule-panel="true"]')
        .first();
      const peekSurface = page
        .locator('[data-shell-sidebar-peek="true"] [data-sidebar-surface="true"]')
        .first();
      await expect(peekSurface).toBeVisible();
      await expect(peekCapsule).toBeVisible();
      const peekStyle = await peekSidebar.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
        };
      });
      expect(peekStyle).toEqual({
        backgroundColor: 'rgba(0, 0, 0, 0)',
        boxShadow: 'none',
      });
      await expect(peekSurface).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const capsuleStyle = await peekCapsule.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          borderRadius: Number.parseFloat(style.borderTopLeftRadius),
          boxShadow: style.boxShadow,
        };
      });
      expect(capsuleStyle.borderRadius).toBeGreaterThan(12);
      expect(capsuleStyle.boxShadow).not.toBe('none');

      await page
        .locator('[data-shell-sidebar-peek="true"] [data-file-tree-kind="file"]', { hasText: 'peek-beta' })
        .first()
        .click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('PEEK_BETA_SENTINEL', {
        timeout: 30_000,
      });

      await page.mouse.move(700, 120);
      await expect(peekSidebar).toHaveAttribute('data-open', 'false');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
