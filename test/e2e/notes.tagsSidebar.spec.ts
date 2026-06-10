import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR,
  cleanupIsolatedElectron,
  createVaultFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openVaultInNotes,
} from './notesE2E';

const TAGS_ROOT_SELECTOR = '[data-notes-sidebar-tags-root="true"]';
const TAG_FILE_ROW_SELECTOR = '[data-notes-sidebar-tag-file-row="true"]';

function attrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function tagRowSelector(tag: string): string {
  return `[data-notes-sidebar-tag-row="${attrValue(tag)}"]`;
}

function tagFilePathSelector(path: string): string {
  return `[data-notes-sidebar-tag-file-path="${attrValue(path)}"]`;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] ?? 0;
}

async function waitAnimationFrames(page: Page, frames = 2): Promise<void> {
  await page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, frames);
}

async function scrollSidebarSelectorIntoView(
  page: Page,
  selector: string,
  block: ScrollLogicalPosition = 'center',
): Promise<void> {
  await expect.poll(async () => page.evaluate((targetSelector) =>
    Boolean(document.querySelector(targetSelector)), selector), { timeout: 30_000 }).toBe(true);

  await page.evaluate(({ targetSelector, blockPosition }) => {
    document.querySelector<HTMLElement>(targetSelector)?.scrollIntoView({
      block: blockPosition,
      inline: 'nearest',
      behavior: 'auto',
    });
  }, { targetSelector: selector, blockPosition: block });
  await waitAnimationFrames(page, 2);
}

async function getSidebarSnapshot(page: Page, selector: string) {
  return page.evaluate(({ scrollRootSelector, targetSelector }) => {
    const scrollRoot = document.querySelector<HTMLElement>(scrollRootSelector);
    const target = document.querySelector<HTMLElement>(targetSelector);
    if (!scrollRoot || !target) {
      return null;
    }

    const rootRect = scrollRoot.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return {
      scrollTop: Math.round(scrollRoot.scrollTop),
      scrollHeight: Math.round(scrollRoot.scrollHeight),
      clientHeight: Math.round(scrollRoot.clientHeight),
      targetTop: Math.round(targetRect.top - rootRect.top),
      targetBottom: Math.round(targetRect.bottom - rootRect.top),
      targetVisible: targetRect.top >= rootRect.top - 2 && targetRect.bottom <= rootRect.bottom + 2,
    };
  }, { scrollRootSelector: NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR, targetSelector: selector });
}

async function waitForTagRows(page: Page, minCount: number): Promise<void> {
  await expect(page.locator(TAGS_ROOT_SELECTOR)).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(async () => page.locator('[data-notes-sidebar-tag-row]').count(), {
    timeout: 30_000,
  }).toBeGreaterThanOrEqual(minCount);
}

async function measureSidebarScrollFrames(page: Page, frames = 45) {
  return page.evaluate(async ({ selector, frameCount }) => {
    const scrollRoot = document.querySelector<HTMLElement>(selector);
    if (!scrollRoot || scrollRoot.scrollHeight <= scrollRoot.clientHeight) {
      return null;
    }

    scrollRoot.scrollTop = 0;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const frameDeltas: number[] = [];
    const startedAt = performance.now();
    let lastFrameAt = startedAt;
    const maxScrollTop = scrollRoot.scrollHeight - scrollRoot.clientHeight;
    for (let index = 1; index <= frameCount; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const now = performance.now();
      frameDeltas.push(now - lastFrameAt);
      scrollRoot.scrollTop = Math.round((maxScrollTop * index) / frameCount);
      lastFrameAt = now;
    }

    const sortedDeltas = [...frameDeltas].sort((a, b) => a - b);
    const pick = (ratio: number) =>
      sortedDeltas[Math.min(sortedDeltas.length - 1, Math.max(0, Math.ceil(sortedDeltas.length * ratio) - 1))] ?? 0;
    const avg = frameDeltas.reduce((sum, value) => sum + value, 0) / Math.max(1, frameDeltas.length);
    return {
      frames: frameCount,
      totalMs: Math.round(performance.now() - startedAt),
      avgFrameMs: Math.round(avg * 10) / 10,
      p95FrameMs: Math.round(pick(0.95) * 10) / 10,
      maxFrameMs: Math.round(Math.max(...frameDeltas) * 10) / 10,
      finalScrollTop: Math.round(scrollRoot.scrollTop),
      maxScrollTop: Math.round(maxScrollTop),
    };
  }, { selector: NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR, frameCount: frames });
}

async function collectTagSidebarMetrics(page: Page) {
  return page.evaluate(() => {
    const visibleRows = Array.from(document.querySelectorAll<HTMLElement>(
      '[data-notes-sidebar-tag-row], [data-notes-sidebar-tag-file-row="true"]',
    )).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    });

    const horizontalOverflow = visibleRows
      .filter((element) => element.scrollWidth - element.clientWidth > 2)
      .slice(0, 10)
      .map((element) => ({
        text: element.textContent?.trim().slice(0, 80) ?? '',
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }));

    return {
      tagRowCount: document.querySelectorAll('[data-notes-sidebar-tag-row]').length,
      fileRowCount: document.querySelectorAll('[data-notes-sidebar-tag-file-row="true"]').length,
      visibleRowCount: visibleRows.length,
      horizontalOverflow,
    };
  });
}

function createKeepScrollFixtureFiles() {
  const files = [
    {
      filename: '000-open-from-tag.md',
      content: [
        '# Open From Tag',
        '',
        'TAG_KEEP_SCROLL_SENTINEL visible after opening from the tag list.',
        '',
        'This note intentionally lives near the top of the file tree.',
        '',
        '#keep-scroll-e2e',
        '',
      ].join('\n'),
    },
  ];

  for (let index = 1; index <= 80; index += 1) {
    files.push({
      filename: `${String(index).padStart(3, '0')}-filler-sidebar-note.md`,
      content: [
        `# Filler ${index}`,
        '',
        `Filler note ${index} keeps the primary file tree tall enough to scroll.`,
        '',
      ].join('\n'),
    });
  }

  return files;
}

function createStressFixtureFiles() {
  const files: Array<{ filename: string; content: string }> = [];
  for (let index = 0; index < 72; index += 1) {
    const tagIndex = index % 12;
    const sharedIndex = index % 3;
    const filename = `tag-stress-${String(index).padStart(3, '0')}.md`;
    files.push({
      filename,
      content: [
        `# Tag Stress ${index}`,
        '',
        `TAG_STRESS_SENTINEL_${index} body used by the tag sidebar e2e stress run.`,
        '',
        `#perf-tag-${String(tagIndex).padStart(2, '0')} #perf-shared-${sharedIndex} #perf-common`,
        '',
        '- stress bullet alpha',
        '- stress bullet beta',
        '',
      ].join('\n'),
    });
  }
  return files;
}

function createHighCardinalityTagFixtureFiles() {
  const files: Array<{ filename: string; content: string }> = [];
  for (let index = 0; index < 180; index += 1) {
    const filename = `mass-tag-${String(index).padStart(3, '0')}.md`;
    files.push({
      filename,
      content: [
        `# Mass Tag ${index}`,
        '',
        `TAG_MASS_SENTINEL_${index} body used by the high-cardinality tag sidebar e2e run.`,
        '',
        `#mass-common #mass-bucket-${index % 6} #mass-unique-${String(index).padStart(3, '0')}`,
        '',
        'This note is intentionally small so the test isolates tag sidebar overhead.',
        '',
      ].join('\n'),
    });
  }
  return files;
}

test.describe('notes tags sidebar', () => {
  test.setTimeout(180_000);

  test('opens a tagged note without jumping the sidebar back to the primary file tree', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-tags-keep-sidebar-scroll');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });

      const fixture = await createVaultFilesFixture(page, {
        name: 'notes-tags-keep-scroll',
        files: createKeepScrollFixtureFiles(),
      });
      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Tags Keep Scroll Vault',
        minFileCount: 80,
      });

      await waitForTagRows(page, 1);
      await scrollSidebarSelectorIntoView(page, tagRowSelector('keep-scroll-e2e'), 'center');
      await page.locator(tagRowSelector('keep-scroll-e2e')).click();
      await expect(page.locator(tagFilePathSelector('000-open-from-tag.md'))).toHaveCount(1, {
        timeout: 30_000,
      });

      await scrollSidebarSelectorIntoView(page, tagFilePathSelector('000-open-from-tag.md'), 'center');
      const before = await getSidebarSnapshot(page, tagFilePathSelector('000-open-from-tag.md'));
      expect(before).not.toBeNull();
      expect(before!.scrollTop).toBeGreaterThan(500);

      const openStartedAt = Date.now();
      await page.locator(tagFilePathSelector('000-open-from-tag.md')).click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('TAG_KEEP_SCROLL_SENTINEL', {
        timeout: 30_000,
      });
      const openMs = Date.now() - openStartedAt;
      await waitAnimationFrames(page, 3);

      const after = await getSidebarSnapshot(page, tagFilePathSelector('000-open-from-tag.md'));
      console.info('[notes-tags-keep-sidebar-scroll]', { before, after, openMs });

      expect(after).not.toBeNull();
      expect(after!.targetVisible).toBe(true);
      expect(Math.abs(after!.scrollTop - before!.scrollTop)).toBeLessThanOrEqual(80);
      expect(openMs).toBeLessThan(5_000);
      expect(errors).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('handles many tag rows and repeated tagged-note opens without layout or performance regressions', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-tags-sidebar-stress');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });

      const fixture = await createVaultFilesFixture(page, {
        name: 'notes-tags-sidebar-stress',
        files: createStressFixtureFiles(),
      });
      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Tags Sidebar Stress Vault',
        minFileCount: 70,
      });

      await waitForTagRows(page, 16);
      const expandDurations: number[] = [];
      const expandedTags = Array.from({ length: 6 }, (_, index) => `perf-tag-${String(index).padStart(2, '0')}`);
      for (const tag of expandedTags) {
        await scrollSidebarSelectorIntoView(page, tagRowSelector(tag), 'center');
        const startedAt = Date.now();
        await page.locator(tagRowSelector(tag)).click();
        const firstPathForTag = `tag-stress-${String(Number.parseInt(tag.slice(-2), 10)).padStart(3, '0')}.md`;
        await expect.poll(async () => page.locator(tagFilePathSelector(firstPathForTag)).count(), {
          timeout: 30_000,
        }).toBeGreaterThanOrEqual(1);
        expandDurations.push(Date.now() - startedAt);
      }

      const openDurations: number[] = [];
      const scrollDeltas: number[] = [];
      const targetIndexes = [0, 12, 1, 13, 2, 14, 3, 15, 4, 16, 5, 17];
      for (const index of targetIndexes) {
        const notePath = `tag-stress-${String(index).padStart(3, '0')}.md`;
        const selector = tagFilePathSelector(notePath);
        await scrollSidebarSelectorIntoView(page, selector, 'center');
        const before = await getSidebarSnapshot(page, selector);
        expect(before).not.toBeNull();

        const startedAt = Date.now();
        await page.locator(selector).first().click();
        await expect(page.locator(EDITOR_SELECTOR)).toContainText(`TAG_STRESS_SENTINEL_${index}`, {
          timeout: 30_000,
        });
        openDurations.push(Date.now() - startedAt);
        await waitAnimationFrames(page, 3);

        const after = await getSidebarSnapshot(page, selector);
        expect(after).not.toBeNull();
        expect(after!.targetVisible).toBe(true);
        scrollDeltas.push(Math.abs(after!.scrollTop - before!.scrollTop));
      }

      const sidebarScrollMetrics = await measureSidebarScrollFrames(page, 45);
      const tagMetrics = await collectTagSidebarMetrics(page);
      const metrics = {
        expandDurations,
        openDurations,
        scrollDeltas,
        expandP95Ms: Math.round(percentile(expandDurations, 0.95)),
        openP95Ms: Math.round(percentile(openDurations, 0.95)),
        maxScrollDelta: Math.max(...scrollDeltas),
        sidebarScrollMetrics,
        tagMetrics,
      };
      console.info('[notes-tags-sidebar-stress]', JSON.stringify(metrics, null, 2));

      expect(tagMetrics.tagRowCount).toBeGreaterThanOrEqual(16);
      expect(tagMetrics.fileRowCount).toBeGreaterThanOrEqual(36);
      expect(tagMetrics.horizontalOverflow).toEqual([]);
      expect(metrics.expandP95Ms).toBeLessThan(2_500);
      expect(metrics.openP95Ms).toBeLessThan(5_000);
      expect(metrics.maxScrollDelta).toBeLessThanOrEqual(120);
      expect(sidebarScrollMetrics).not.toBeNull();
      expect(sidebarScrollMetrics!.p95FrameMs).toBeLessThan(120);
      expect(sidebarScrollMetrics!.maxFrameMs).toBeLessThan(500);
      expect(errors).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps a high-cardinality tag responsive when it expands to many files', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-tags-high-cardinality');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });

      const fixture = await createVaultFilesFixture(page, {
        name: 'notes-tags-high-cardinality',
        files: createHighCardinalityTagFixtureFiles(),
      });
      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Tags High Cardinality Vault',
        minFileCount: 1,
      });

      await waitForTagRows(page, 20);
      await scrollSidebarSelectorIntoView(page, tagRowSelector('mass-common'), 'center');

      const expandStartedAt = Date.now();
      await page.locator(tagRowSelector('mass-common')).click();
      await expect.poll(async () => page.locator(TAG_FILE_ROW_SELECTOR).count(), {
        timeout: 30_000,
      }).toBeGreaterThanOrEqual(180);
      const expandMs = Date.now() - expandStartedAt;
      await waitAnimationFrames(page, 5);

      const targetIndexes = [0, 60, 120, 179];
      const openDurations: number[] = [];
      const scrollDeltas: number[] = [];
      for (const index of targetIndexes) {
        const notePath = `mass-tag-${String(index).padStart(3, '0')}.md`;
        const selector = tagFilePathSelector(notePath);
        await scrollSidebarSelectorIntoView(page, selector, 'center');
        const before = await getSidebarSnapshot(page, selector);
        expect(before).not.toBeNull();

        const openStartedAt = Date.now();
        await page.locator(selector).first().click();
        await expect(page.locator(EDITOR_SELECTOR)).toContainText(`TAG_MASS_SENTINEL_${index}`, {
          timeout: 30_000,
        });
        openDurations.push(Date.now() - openStartedAt);
        await waitAnimationFrames(page, 3);

        const after = await getSidebarSnapshot(page, selector);
        expect(after).not.toBeNull();
        expect(after!.targetVisible).toBe(true);
        scrollDeltas.push(Math.abs(after!.scrollTop - before!.scrollTop));
      }

      const sidebarScrollMetrics = await measureSidebarScrollFrames(page, 60);
      const tagMetrics = await collectTagSidebarMetrics(page);
      const metrics = {
        expandMs,
        openDurations,
        openP95Ms: Math.round(percentile(openDurations, 0.95)),
        maxScrollDelta: Math.max(...scrollDeltas),
        sidebarScrollMetrics,
        tagMetrics,
      };
      console.info('[notes-tags-high-cardinality]', JSON.stringify(metrics, null, 2));

      expect(tagMetrics.tagRowCount).toBeGreaterThanOrEqual(20);
      expect(tagMetrics.fileRowCount).toBeGreaterThanOrEqual(180);
      expect(tagMetrics.horizontalOverflow).toEqual([]);
      expect(expandMs).toBeLessThan(5_000);
      expect(metrics.openP95Ms).toBeLessThan(5_000);
      expect(metrics.maxScrollDelta).toBeLessThanOrEqual(120);
      expect(sidebarScrollMetrics).not.toBeNull();
      expect(sidebarScrollMetrics!.p95FrameMs).toBeLessThan(120);
      expect(sidebarScrollMetrics!.maxFrameMs).toBeLessThan(500);
      expect(errors).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
