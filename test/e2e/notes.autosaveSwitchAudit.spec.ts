import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  NOTE_SCROLL_ROOT_SELECTOR,
  cleanupIsolatedElectron,
  createNotesRootFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openNotesRootInNotes,
  waitForEditorAnimationFrame,
} from './notesE2E';

async function setContentCommitThrottleMs(page: Page, throttleMs: number): Promise<void> {
  await page.evaluate((ms) => {
    (globalThis as { __VL_TEST_CONTENT_COMMIT_THROTTLE_MS__?: number })
      .__VL_TEST_CONTENT_COMMIT_THROTTLE_MS__ = ms;
  }, throttleMs);
}

async function getRootFolderReferenceVersion(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__vlainaE2E.getNotesTreeMetrics().rootFolderReferenceVersion);
}

async function waitForStableRootFolderReferenceVersion(page: Page): Promise<number> {
  let version = await getRootFolderReferenceVersion(page);
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    await page.waitForTimeout(200);
    const nextVersion = await getRootFolderReferenceVersion(page);
    if (nextVersion === version) {
      return version;
    }
    version = nextVersion;
  }

  return version;
}

function captureMaximumUpdateDepthErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on('pageerror', (error) => {
    if (error.message.includes('Maximum update depth exceeded')) {
      errors.push(error.message);
    }
  });
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && text.includes('Maximum update depth exceeded')) {
      errors.push(text);
    }
  });

  return errors;
}

async function startSidebarFileIconAudit(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as {
      __vlainaE2ESidebarFileIconMetrics?: {
        commits: Record<string, number>;
        mounts: Record<string, number>;
        unmounts: Record<string, number>;
      };
    }).__vlainaE2ESidebarFileIconMetrics = {
      commits: {},
      mounts: {},
      unmounts: {},
    };

    const auditWindow = window as unknown as {
      __vlainaE2ESidebarFileIconMutationAudit?: {
        added: string[];
        removed: string[];
        observer: MutationObserver;
      };
    };
    auditWindow.__vlainaE2ESidebarFileIconMutationAudit?.observer.disconnect();

    const audit = {
      added: [] as string[],
      removed: [] as string[],
      observer: null as MutationObserver | null,
    };

    const getTrackedIconLabel = (icon: HTMLElement): string => {
      return icon.dataset.sidebarNoteFileIconKey ??
        icon.dataset.e2eSidebarFileIconLabel ??
        icon.closest('[data-file-tree-kind="file"]')?.textContent?.trim().replace(/\s+/g, ' ') ??
        'unknown';
    };
    const trackExistingIcons = () => {
      document.querySelectorAll<HTMLElement>('[data-sidebar-note-file-icon="true"]').forEach((icon) => {
        icon.dataset.e2eSidebarFileIconLabel = getTrackedIconLabel(icon);
      });
    };
    const collectRemovedIcons = (node: Node) => {
      if (!(node instanceof Element)) {
        return;
      }
      if (
        node instanceof HTMLElement &&
        node.matches('[data-sidebar-note-file-icon="true"]')
      ) {
        audit.removed.push(getTrackedIconLabel(node));
      }
      node.querySelectorAll<HTMLElement>('[data-sidebar-note-file-icon="true"]').forEach((icon) => {
        audit.removed.push(getTrackedIconLabel(icon));
      });
    };
    const collectAddedIcons = (node: Node) => {
      if (!(node instanceof Element)) {
        return;
      }
      if (
        node instanceof HTMLElement &&
        node.matches('[data-sidebar-note-file-icon="true"]')
      ) {
        audit.added.push(getTrackedIconLabel(node));
      }
      node.querySelectorAll<HTMLElement>('[data-sidebar-note-file-icon="true"]').forEach((icon) => {
        audit.added.push(getTrackedIconLabel(icon));
      });
    };

    trackExistingIcons();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.removedNodes.forEach(collectRemovedIcons);
        mutation.addedNodes.forEach(collectAddedIcons);
      }
      trackExistingIcons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    audit.observer = observer;
    auditWindow.__vlainaE2ESidebarFileIconMutationAudit = audit as {
      added: string[];
      removed: string[];
      observer: MutationObserver;
    };
  });
}

async function stopSidebarFileIconAudit(page: Page): Promise<{
  commits: Record<string, number>;
  mounts: Record<string, number>;
  unmounts: Record<string, number>;
  added: string[];
  removed: string[];
}> {
  return page.evaluate(() => {
    const metrics = (window as unknown as {
      __vlainaE2ESidebarFileIconMetrics?: {
        commits: Record<string, number>;
        mounts: Record<string, number>;
        unmounts: Record<string, number>;
      };
      __vlainaE2ESidebarFileIconMutationAudit?: {
        added: string[];
        removed: string[];
        observer: MutationObserver;
      };
    });
    metrics.__vlainaE2ESidebarFileIconMutationAudit?.observer.disconnect();

    return {
      commits: metrics.__vlainaE2ESidebarFileIconMetrics?.commits ?? {},
      mounts: metrics.__vlainaE2ESidebarFileIconMetrics?.mounts ?? {},
      unmounts: metrics.__vlainaE2ESidebarFileIconMetrics?.unmounts ?? {},
      added: metrics.__vlainaE2ESidebarFileIconMutationAudit?.added ?? [],
      removed: metrics.__vlainaE2ESidebarFileIconMutationAudit?.removed ?? [],
    };
  });
}

type SidebarIconVisualSnapshot = {
  childClassName: string;
  childTagName: string;
  color: string;
  display: string;
  height: number;
  opacity: string;
  visibility: string;
  width: number;
};

async function getSidebarFileIconVisualSnapshot(
  page: Page,
  rowText: string,
): Promise<SidebarIconVisualSnapshot | null> {
  return page.evaluate((targetRowText) => {
    const row = Array.from(document.querySelectorAll<HTMLElement>('[data-file-tree-kind="file"]'))
      .find((element) => element.textContent?.includes(targetRowText));
    const icon = row?.querySelector<HTMLElement>('[data-sidebar-note-file-icon="true"]') ?? null;
    if (!icon) {
      return null;
    }

    const child = icon.firstElementChild;
    const style = window.getComputedStyle(icon);
    const rect = icon.getBoundingClientRect();

    return {
      childClassName: child?.getAttribute('class') ?? '',
      childTagName: child?.tagName.toLowerCase() ?? '',
      color: style.color,
      display: style.display,
      height: rect.height,
      opacity: style.opacity,
      visibility: style.visibility,
      width: rect.width,
    };
  }, rowText);
}

test.describe('notes autosave switch audit', () => {
  test.setTimeout(120_000);

  test('saves pending editor markdown before opening another sidebar file', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-autosave-switch-audit');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await setContentCommitThrottleMs(page, 5_000);

      const marker = `autosave switch marker ${Date.now()}`;
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'autosave-switch-audit',
        files: [
          {
            filename: 'alpha-autosave-switch.md',
            content: ['# Alpha Autosave Switch', '', 'Alpha body before pending edit.'].join('\n'),
          },
          {
            filename: 'beta-autosave-switch.md',
            content: ['# Beta Autosave Switch', '', 'Beta body must stay isolated.'].join('\n'),
          },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Autosave Switch Audit',
        minFileCount: 2,
      });

      const alphaRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'alpha-autosave-switch' }).first();
      const betaRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'beta-autosave-switch' }).first();

      await alphaRow.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Alpha body before pending edit.', {
        timeout: 30_000,
      });

      const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
      expect(focused).toBe(true);
      await page.keyboard.type(`\n\n${marker}`, { delay: 0 });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText(marker, { timeout: 10_000 });
      await waitForEditorAnimationFrame(page);
      const stableRootFolderReferenceVersion = await waitForStableRootFolderReferenceVersion(page);

      await expect.poll(async () =>
        page.evaluate((pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead), fixture.notePaths[0]!)
      , { timeout: 1_000 }).not.toContain(marker);

      await startSidebarFileIconAudit(page);
      await betaRow.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Beta body must stay isolated.', {
        timeout: 30_000,
      });

      await expect.poll(async () =>
        page.evaluate((pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead), fixture.notePaths[0]!)
      , { timeout: 10_000 }).toContain(marker);

      const stateAfterSwitch = await page.evaluate(() => (window as any).__vlainaE2E.getNotesState());
      expect(stateAfterSwitch.currentNote?.path).toContain('beta-autosave-switch.md');
      expect(stateAfterSwitch.currentNote?.content).toContain('Beta body must stay isolated.');
      expect(stateAfterSwitch.currentNote?.content).not.toContain(marker);
      expect(stateAfterSwitch.openTabs.some((tab: { isDirty?: boolean }) => tab.isDirty)).toBe(false);
      expect(stateAfterSwitch.error).toBeNull();
      await waitForEditorAnimationFrame(page);

      const iconAudit = await stopSidebarFileIconAudit(page);
      expect(await getRootFolderReferenceVersion(page)).toBe(stableRootFolderReferenceVersion);
      expect(iconAudit.added).toEqual([]);
      expect(iconAudit.removed).toEqual([]);
      expect(iconAudit.commits['alpha-autosave-switch.md'] ?? 0).toBe(0);
      expect(iconAudit.commits['beta-autosave-switch.md'] ?? 0).toBe(0);
      expect(iconAudit.mounts['alpha-autosave-switch.md'] ?? 0).toBe(0);
      expect(iconAudit.mounts['beta-autosave-switch.md'] ?? 0).toBe(0);
      expect(iconAudit.unmounts['alpha-autosave-switch.md'] ?? 0).toBe(0);
      expect(iconAudit.unmounts['beta-autosave-switch.md'] ?? 0).toBe(0);

      await alphaRow.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText(marker, { timeout: 30_000 });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps the sidebar markdown icon mounted while autosave persists the active note', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-autosave-sidebar-icon-stability');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const marker = `autosave sidebar icon marker ${Date.now()}`;
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'autosave-sidebar-icon-stability',
        files: [
          {
            filename: 'alpha-sidebar-icon-stability.md',
            content: [
              '---',
              'vlaina_icon: "😁"',
              '---',
              '',
              '# Alpha Sidebar Icon Stability',
              '',
              'Alpha body before autosave.',
            ].join('\n'),
          },
          {
            filename: 'beta-sidebar-icon-stability.md',
            content: [
              '---',
              'vlaina_icon: "🌲"',
              '---',
              '',
              '# Beta Sidebar Icon Stability',
              '',
              'Beta body.',
            ].join('\n'),
          },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Autosave Sidebar Icon Stability',
        minFileCount: 2,
      });

      const alphaRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'alpha-sidebar-icon-stability' }).first();
      const betaRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'beta-sidebar-icon-stability' }).first();
      await betaRow.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Beta body.', {
        timeout: 30_000,
      });
      await alphaRow.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Alpha body before autosave.', {
        timeout: 30_000,
      });
      await expect(alphaRow.locator('[data-sidebar-note-file-icon="true"]').first()).toBeVisible({ timeout: 10_000 });
      await expect(betaRow.locator('[data-sidebar-note-file-icon="true"]').first()).toBeVisible({ timeout: 10_000 });
      await waitForEditorAnimationFrame(page);
      const stableRootFolderReferenceVersion = await waitForStableRootFolderReferenceVersion(page);

      const iconToken = `sidebar-icon-${Date.now()}`;
      const initial = await page.evaluate(({ rowText, token }) => {
        const row = Array.from(document.querySelectorAll<HTMLElement>('[data-file-tree-kind="file"]'))
          .find((element) => element.textContent?.includes(rowText));
        const icon = row?.querySelector<HTMLElement>('[data-sidebar-note-file-icon="true"]') ?? null;
        if (!icon) {
          return null;
        }

        icon.dataset.e2eStableIconToken = token;
        (window as unknown as { __vlainaE2EStableSidebarIcon?: HTMLElement })
          .__vlainaE2EStableSidebarIcon = icon;

        return {
          token: icon.dataset.e2eStableIconToken,
        };
      }, { rowText: 'alpha-sidebar-icon-stability', token: iconToken });

      if (!initial) {
        throw new Error('Expected to find the sidebar markdown icon before autosave.');
      }
      expect(initial.token).toBe(iconToken);

      const visualBeforeAutosave = await getSidebarFileIconVisualSnapshot(
        page,
        'alpha-sidebar-icon-stability',
      );
      expect(visualBeforeAutosave).not.toBeNull();
      expect(visualBeforeAutosave?.childTagName).toBe('span');
      const betaVisualBeforeAutosave = await getSidebarFileIconVisualSnapshot(
        page,
        'beta-sidebar-icon-stability',
      );
      expect(betaVisualBeforeAutosave).not.toBeNull();
      expect(betaVisualBeforeAutosave?.childTagName).toBe('span');

      await startSidebarFileIconAudit(page);
      const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
      expect(focused).toBe(true);
      await page.keyboard.type(`\n\n${marker}`, { delay: 0 });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText(marker, { timeout: 10_000 });

      await expect.poll(async () =>
        page.evaluate((pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead), fixture.notePaths[0]!)
      , { timeout: 15_000 }).toContain(marker);
      await waitForEditorAnimationFrame(page);

      const iconAudit = await stopSidebarFileIconAudit(page);
      const afterAutosave = await page.evaluate(({ rowText }) => {
        const row = Array.from(document.querySelectorAll<HTMLElement>('[data-file-tree-kind="file"]'))
          .find((element) => element.textContent?.includes(rowText));
        const currentIcon = row?.querySelector<HTMLElement>('[data-sidebar-note-file-icon="true"]') ?? null;
        const stableIcon = (window as unknown as { __vlainaE2EStableSidebarIcon?: HTMLElement })
          .__vlainaE2EStableSidebarIcon;

        return {
          rootFolderReferenceVersion: (window as any).__vlainaE2E.getNotesTreeMetrics().rootFolderReferenceVersion,
          sameIconNode: Boolean(currentIcon && stableIcon && currentIcon === stableIcon),
          stableIconConnected: Boolean(stableIcon?.isConnected),
          token: currentIcon?.dataset.e2eStableIconToken ?? null,
        };
      }, { rowText: 'alpha-sidebar-icon-stability' });
      const visualAfterAutosave = await getSidebarFileIconVisualSnapshot(
        page,
        'alpha-sidebar-icon-stability',
      );
      const betaVisualAfterAutosave = await getSidebarFileIconVisualSnapshot(
        page,
        'beta-sidebar-icon-stability',
      );

      expect(afterAutosave.rootFolderReferenceVersion).toBe(stableRootFolderReferenceVersion);
      expect(afterAutosave.sameIconNode).toBe(true);
      expect(afterAutosave.stableIconConnected).toBe(true);
      expect(afterAutosave.token).toBe(iconToken);
      expect(visualAfterAutosave).toEqual(visualBeforeAutosave);
      expect(visualAfterAutosave?.childTagName).toBe('span');
      expect(betaVisualAfterAutosave).toEqual(betaVisualBeforeAutosave);
      expect(betaVisualAfterAutosave?.childTagName).toBe('span');
      expect(iconAudit.added).toEqual([]);
      expect(iconAudit.removed).toEqual([]);
      expect(iconAudit.mounts['alpha-sidebar-icon-stability.md'] ?? 0).toBe(0);
      expect(iconAudit.mounts['beta-sidebar-icon-stability.md'] ?? 0).toBe(0);
      expect(iconAudit.unmounts['alpha-sidebar-icon-stability.md'] ?? 0).toBe(0);
      expect(iconAudit.unmounts['beta-sidebar-icon-stability.md'] ?? 0).toBe(0);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps the caret near the edit after deleting the first quoted line and autosaving', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-autosave-first-line-delete-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await setContentCommitThrottleMs(page, 100);

      const firstLineText = '我们的定位  有点';
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'autosave-first-line-delete-caret',
        files: [
          {
            filename: 'positioning-caret.md',
            content: [
              `> ${firstLineText}`,
              '>',
              '> 1. 开源免费，体积更小，更加好用的typora,同时兼容他的所有主题',
              '>',
              '> 2. 可以将GitHub作为存储后端，不需要像obsidian一样克隆到本地即可直接同步',
              '>',
              '> 3. 比Cherry Studio更简洁好用的聊天客户端',
              '>',
              '> 4. 离线的notion',
              '>',
              '> 5. 自已自',
            ].join('\n'),
          },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Autosave First Line Delete Caret',
        minFileCount: 1,
      });

      const row = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'positioning-caret' }).first();
      await row.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText(firstLineText, {
        timeout: 30_000,
      });

      const selected = await page.evaluate((text) =>
        (window as any).__vlainaE2E.selectEditorTextByText(text, text), firstLineText);
      expect(selected.selected).toBe(true);
      await page.keyboard.press('Backspace');
      await expect(page.locator(EDITOR_SELECTOR)).not.toContainText(firstLineText, {
        timeout: 10_000,
      });

      await expect.poll(async () =>
        page.evaluate((pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead), fixture.notePaths[0]!)
      , { timeout: 15_000 }).not.toContain(firstLineText);

      await waitForEditorAnimationFrame(page);
      await page.waitForTimeout(300);
      const selection = await page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary());
      expect(selection).not.toBeNull();
      expect(selection.from).toBeLessThan(80);
      expect(selection.docTextLength - selection.from).toBeGreaterThan(60);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps the caret near the first quoted line after a line-end backspace autosaves', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-autosave-first-line-end-backspace-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await setContentCommitThrottleMs(page, 100);

      const firstLineText = '我们的定位  有点';
      const editedFirstLineText = '我们的定位  有';
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'autosave-first-line-end-backspace-caret',
        files: [
          {
            filename: 'positioning-line-end-caret.md',
            content: [
              `> ${firstLineText}`,
              '>',
              '> 1. 开源免费，体积更小，更加好用的typora,同时兼容他的所有主题',
              '>',
              '> 2. 可以将GitHub作为存储后端，不需要像obsidian一样克隆到本地即可直接同步',
              '>',
              '> 3. 比Cherry Studio更简洁好用的聊天客户端',
              '>',
              '> 4. 离线的notion',
              '>',
              '> 5.',
            ].join('\n'),
          },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Autosave First Line End Backspace Caret',
        minFileCount: 1,
      });

      const row = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'positioning-line-end-caret' }).first();
      await row.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText(firstLineText, {
        timeout: 30_000,
      });

      const selected = await page.evaluate((text) =>
        (window as any).__vlainaE2E.selectEditorTextByText(text, text), firstLineText);
      expect(selected.selected).toBe(true);
      expect(selected.to).not.toBeNull();
      await page.evaluate((pos) =>
        (window as any).__vlainaE2E.setEditorSelectionRange(pos), selected.to);
      await page.keyboard.press('Backspace');
      await expect(page.locator(EDITOR_SELECTOR)).toContainText(editedFirstLineText, {
        timeout: 10_000,
      });
      await expect(page.locator(EDITOR_SELECTOR)).not.toContainText(firstLineText, {
        timeout: 10_000,
      });

      await expect.poll(async () =>
        page.evaluate((pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead), fixture.notePaths[0]!)
      , { timeout: 15_000 }).toContain(editedFirstLineText);

      await waitForEditorAnimationFrame(page);
      await page.waitForTimeout(300);
      const selection = await page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary());
      expect(selection).not.toBeNull();
      expect(selection.from).toBeLessThan(40);
      expect(selection.docTextLength - selection.from).toBeGreaterThan(60);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('does not hit maximum update depth while overlay scroll metrics update during autosave', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-autosave-overlay-scroll-depth');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const maximumUpdateDepthErrors = captureMaximumUpdateDepthErrors(page);
      await page.setViewportSize({ width: 1280, height: 860 });
      await setContentCommitThrottleMs(page, 120);

      const marker = `overlay-scroll-autosave-marker-${Date.now()}`;
      const longBody = Array.from({ length: 120 }, (_, index) =>
        `Paragraph ${index + 1}: overlay scroll autosave audit content.`
      );
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'autosave-overlay-scroll-depth',
        files: [
          {
            filename: 'overlay-scroll-depth.md',
            content: [
              '---',
              'vlaina_cover: "assets/overlay-cover.png" x=22 y=33 height=244 scale=1.5',
              '---',
              '',
              '# Overlay Scroll Depth',
              '',
              ...longBody,
            ].join('\n\n'),
          },
          {
            filename: 'assets/overlay-cover.png',
            content: 'not a real image; this fixture only exercises cover metadata stability',
          },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Autosave Overlay Scroll Depth',
        minFileCount: 1,
      });

      const row = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'overlay-scroll-depth' }).first();
      await row.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Paragraph 100', {
        timeout: 30_000,
      });

      const scrollRoot = page.locator(NOTE_SCROLL_ROOT_SELECTOR).first();
      await expect(scrollRoot).toBeVisible({ timeout: 10_000 });
      await scrollRoot.hover();

      for (let index = 0; index < 4; index += 1) {
        await page.evaluate(({ selector, scrollTop }) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) {
            throw new Error(`Missing scroll root: ${selector}`);
          }
          element.scrollTop = scrollTop;
          element.dispatchEvent(new Event('scroll', { bubbles: true }));
        }, {
          selector: NOTE_SCROLL_ROOT_SELECTOR,
          scrollTop: 160 + index * 320,
        });
        await waitForEditorAnimationFrame(page);

        const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
        expect(focused).toBe(true);
        await page.keyboard.type(`\n\n${marker}-${index}`, { delay: 0 });
        await expect(page.locator(EDITOR_SELECTOR)).toContainText(`${marker}-${index}`, {
          timeout: 10_000,
        });
        if (index === 0) {
          await expect.poll(async () =>
            page.evaluate((pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead), fixture.notePaths[0]!)
          , { timeout: 15_000 }).toContain(`${marker}-${index}`);
        }
      }

      await waitForEditorAnimationFrame(page);
      await page.waitForTimeout(300);
      expect(maximumUpdateDepthErrors).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
