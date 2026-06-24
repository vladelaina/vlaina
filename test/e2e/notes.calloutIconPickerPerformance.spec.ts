import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  startMainThreadFrameProbe,
  stopMainThreadFrameProbe,
  waitForEditorAnimationFrame,
} from './notesE2E';

const CALLOUT_PICKER_PROBE_KEY = '__vlainaCalloutIconPickerProbe';

async function getLayoutSnapshot(page: Page) {
  return page.evaluate(() => {
    const callout = document.querySelector<HTMLElement>('.callout');
    const picker = document.querySelector<HTMLElement>('.callout-icon-picker');
    const surface = picker?.querySelector<HTMLElement>('.callout-icon-picker > span > div > div, .callout-icon-picker > div > div') ??
      picker?.querySelector<HTMLElement>('div');
    const activeElement = document.activeElement as HTMLElement | null;
    const selection = document.getSelection();
    const calloutContent = document.querySelector<HTMLElement>('.callout-content');
    const selectionInCalloutContent = Boolean(
      selection &&
      calloutContent &&
      ((selection.anchorNode && calloutContent.contains(selection.anchorNode)) ||
        (selection.focusNode && calloutContent.contains(selection.focusNode)))
    );

    return {
      activeTag: activeElement?.tagName ?? null,
      activeClassName: activeElement?.className ?? null,
      calloutHeight: Math.round((callout?.getBoundingClientRect().height ?? 0) * 10) / 10,
      pickerHeight: Math.round((picker?.getBoundingClientRect().height ?? 0) * 10) / 10,
      surfaceHeight: Math.round((surface?.getBoundingClientRect().height ?? 0) * 10) / 10,
      uploadTabVisible: Array.from(document.querySelectorAll('button')).some((button) =>
        button.textContent?.trim().toLowerCase() === 'upload'
      ),
      pickerVisible: Boolean(picker),
      selectionInCalloutContent,
      selectionSummary: (window as any).__vlainaE2E.getEditorSelectionSummary?.() ?? null,
    };
  });
}

async function hoverVisiblePickerIcons(page: Page, limit = 24) {
  return page.evaluate(async (iconLimit) => {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('.callout-icon-picker [data-icon]'))
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .slice(0, iconLimit);

    const samples: Array<{
      calloutHeight: number;
      durationMs: number;
      pickerHeight: number;
      surfaceHeight: number;
    }> = [];

    for (const button of buttons) {
      const startedAt = performance.now();
      button.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true,
        clientX: button.getBoundingClientRect().left + 2,
        clientY: button.getBoundingClientRect().top + 2,
      }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const picker = document.querySelector<HTMLElement>('.callout-icon-picker');
      const surface = picker?.querySelector<HTMLElement>('.callout-icon-picker > span > div > div, .callout-icon-picker > div > div') ??
        picker?.querySelector<HTMLElement>('div');
      const callout = document.querySelector<HTMLElement>('.callout');
      samples.push({
        calloutHeight: Math.round((callout?.getBoundingClientRect().height ?? 0) * 10) / 10,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        pickerHeight: Math.round((picker?.getBoundingClientRect().height ?? 0) * 10) / 10,
        surfaceHeight: Math.round((surface?.getBoundingClientRect().height ?? 0) * 10) / 10,
      });
    }

    return {
      count: buttons.length,
      samples,
    };
  }, limit);
}

function maxDelta(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((Math.max(...values) - Math.min(...values)) * 10) / 10;
}

test.describe('notes callout icon picker performance', () => {
  test.setTimeout(120_000);

  test('keeps callout icon preview stable and returns focus into callout content', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-callout-icon-picker-performance');
    let page: Page | null = null;
    let frameProbeRunning = false;

    try {
      await app.firstWindow();
      [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1360, height: 900 });

      const pageErrors: string[] = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
        console.info(`[notes-callout-icon-picker-performance:pageerror] ${error.message}`);
      });

      await openMarkdownFixture(page, {
        filename: 'callout-icon-picker-performance.md',
        content: [
          '# Callout Icon Picker Performance',
          '',
          '> 💡 Callout icon picker body sentinel for focus and preview.',
          '> Second line keeps the callout content area measurable.',
          '',
          'Outside paragraph receives focus before icon application.',
          '',
          'Final callout icon picker performance sentinel.',
        ].join('\n'),
      });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Final callout icon picker performance sentinel');

      const outsideParagraph = page.locator(`${EDITOR_SELECTOR} p`, {
        hasText: 'Outside paragraph receives focus',
      });
      await outsideParagraph.click();
      await waitForEditorAnimationFrame(page);

      await startMainThreadFrameProbe(page, CALLOUT_PICKER_PROBE_KEY);
      frameProbeRunning = true;

      const openStartedAt = Date.now();
      await page.locator('.callout-icon-button').first().click();
      await expect(page.locator('.callout-icon-picker [data-icon]').first()).toBeVisible({ timeout: 10_000 });
      await waitForEditorAnimationFrame(page);
      const openWallMs = Date.now() - openStartedAt;

      const beforePreview = await getLayoutSnapshot(page);
      const hoverMetrics = await hoverVisiblePickerIcons(page, 24);
      const afterPreview = await getLayoutSnapshot(page);

      const iconToSelect = page.locator('.callout-icon-picker [data-icon]').nth(8);
      await expect(iconToSelect).toBeVisible({ timeout: 10_000 });
      const applyStartedAt = Date.now();
      await iconToSelect.click();
      await expect(page.locator('.callout-icon-picker')).toHaveCount(0, { timeout: 10_000 });
      await waitForEditorAnimationFrame(page);
      const applyWallMs = Date.now() - applyStartedAt;

      const frameProbe = await stopMainThreadFrameProbe(page, CALLOUT_PICKER_PROBE_KEY);
      frameProbeRunning = false;

      const afterApply = await getLayoutSnapshot(page);
      const pickerHeights = [
        beforePreview.pickerHeight,
        afterPreview.pickerHeight,
        ...hoverMetrics.samples.map((sample) => sample.pickerHeight),
      ].filter((value) => value > 0);
      const surfaceHeights = [
        beforePreview.surfaceHeight,
        afterPreview.surfaceHeight,
        ...hoverMetrics.samples.map((sample) => sample.surfaceHeight),
      ].filter((value) => value > 0);
      const calloutHeights = [
        beforePreview.calloutHeight,
        afterPreview.calloutHeight,
        ...hoverMetrics.samples.map((sample) => sample.calloutHeight),
      ].filter((value) => value > 0);
      const hoverDurations = hoverMetrics.samples.map((sample) => sample.durationMs);
      const maxHoverMs = Math.max(0, ...hoverDurations);
      const avgHoverMs = hoverDurations.reduce((sum, value) => sum + value, 0) / Math.max(1, hoverDurations.length);
      const pickerHeightDelta = maxDelta(pickerHeights);
      const surfaceHeightDelta = maxDelta(surfaceHeights);
      const calloutHeightDelta = maxDelta(calloutHeights);

      console.info('[notes-callout-icon-picker-performance]', {
        openWallMs,
        applyWallMs,
        hoverCount: hoverMetrics.count,
        maxHoverMs,
        avgHoverMs: Math.round(avgHoverMs * 10) / 10,
        pickerHeightDelta,
        surfaceHeightDelta,
        calloutHeightDelta,
        beforePreview,
        afterPreview,
        afterApply,
        frameProbe,
      });

      expect(beforePreview.uploadTabVisible).toBe(false);
      expect(afterPreview.uploadTabVisible).toBe(false);
      expect(hoverMetrics.count).toBeGreaterThanOrEqual(12);
      expect(surfaceHeightDelta).toBeLessThanOrEqual(1);
      expect(calloutHeightDelta).toBeLessThanOrEqual(1);
      expect(openWallMs).toBeLessThan(4_000);
      expect(applyWallMs).toBeLessThan(2_000);
      expect(maxHoverMs).toBeLessThan(250);
      expect(frameProbe.p95FrameMs).toBeLessThan(100);
      expect(frameProbe.maxFrameMs).toBeLessThan(350);
      expect(frameProbe.longFramesOver100).toBeLessThanOrEqual(3);
      expect(frameProbe.maxLongTaskMs).toBeLessThan(300);
      expect(afterApply.selectionInCalloutContent).toBe(true);
      expect(afterApply.selectionSummary?.empty).toBe(true);
      expect(pageErrors).toEqual([]);
    } finally {
      if (frameProbeRunning && page && !page.isClosed()) {
        await stopMainThreadFrameProbe(page, CALLOUT_PICKER_PROBE_KEY).catch(() => undefined);
      }
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
