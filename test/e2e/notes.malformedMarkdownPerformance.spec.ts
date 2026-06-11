import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  collectEditorDomMetrics,
  getOpenBridgePages,
  launchIsolatedElectron,
  measureRepeatedBlockScan,
  measureScrollFrames,
  openMarkdownFixture,
  startMainThreadFrameProbe,
  stopMainThreadFrameProbe,
  type MainThreadFrameProbeResult,
  waitForEditorAnimationFrame,
} from './notesE2E';

const LIVE_EDITOR_SELECTOR = `${EDITOR_SELECTOR}:not(.toolbar-applied-preview-overlay):not([aria-hidden="true"])`;

type MalformedInputMetric = {
  chars: number;
  durationMs: number;
  dispatchProfile: EditorDispatchProfileSummary | null;
  index: number;
  startsWith: string;
} & MainThreadFrameProbeResult;

type EditorDispatchProfileSummary = {
  decorationPropTotalMs: number;
  dispatchCount: number;
  docChangedCount: number;
  insertedTextLength: number;
  maxDispatchMs: number;
  pluginApplyTotalMs: number;
  p95DispatchMs: number;
  totalDispatchMs: number;
  totalProfileMs: number;
  totalStepCount: number;
  updateStateCount: number;
  updateStateMaxMs: number;
  updateStateP95Ms: number;
  updateStateTotalMs: number;
  updateStateInnerCount: number;
  updateStateInnerMaxMs: number;
  updateStateInnerP95Ms: number;
  updateStateInnerTotalMs: number;
  slowestPluginApplies: Array<{
    count: number;
    key: string;
    maxMs: number;
    p95Ms: number;
    totalMs: number;
  }>;
  slowestDecorationProps: Array<{
    count: number;
    key: string;
    maxMs: number;
    p95Ms: number;
    totalMs: number;
  }>;
};

function createMalformedMarkdownSection(index: number): string {
  const unclosedBracketRun = '['.repeat(6 + (index % 6));
  const pipeRun = Array.from({ length: 18 }, (_, column) => (
    column % 4 === 0 ? `| cell-${index}-${column}` : ` cell-${index}-${column}`
  )).join('');
  const nestedMarks = '*'.repeat(1 + (index % 5));
  const badHtmlAttrs = Array.from({ length: 8 }, (_, attr) => ` data-${attr}="${'<bad>'.repeat(3)}"`).join('');

  return [
    `## Malformed Probe ${index}`,
    '',
    `Broken emphasis ${nestedMarks}starts but does not close with [link ${index}(https://example.com/${index}`,
    '',
    `${unclosedBracketRun} repeated bracket pressure ${')'.repeat(3 + (index % 4))}`,
    '',
    `${pipeRun} | trailing | without a delimiter line`,
    '',
    `> > > nested quote ${index} with [!callout-icon:%ZZ] and unmatched **strong marker`,
    '',
    `<div${badHtmlAttrs}><span>raw html ${index}`,
    '',
    `[^broken-${index}: footnote-like text without closing label`,
    '',
    `Inline math-like text $x_{${index} + \\frac{1}{ without ending delimiter and \\[ block opener`,
    '',
    '``not-a-real-language',
    `almost-fence body ${index} with #bad-tag-${index} and http://example.invalid/${index}`,
    '',
  ].join('\n');
}

function createMalformedMarkdown(sectionCount: number): string {
  const sections = [
    '# Malformed Markdown Performance',
    '',
    'This fixture intentionally uses incomplete and unsupported markdown-like syntax.',
    '',
  ];
  for (let index = 0; index < sectionCount; index += 1) {
    sections.push(createMalformedMarkdownSection(index));
  }
  sections.push('Final malformed markdown performance sentinel.');
  return sections.join('\n');
}

function createMalformedTypingFragments(): string[] {
  return [
    'Typing malformed link [unfinished label](https://example.com/unterminated\n\n',
    'Typing uneven emphasis ***bold maybe ** italic maybe * still open\n\n',
    '| broken | table | row |\n| --- this is not a separator | still typing\n\n',
    '<section><article data-x="<<<">raw html that never closes\n\n',
    '$$\\frac{1}{2 + \\sqrt{broken\n\n',
    'Mixed stress #bad-tag [x](javascript:alert(1) ** ~~ == ++ ` inline never closes\n\n',
    '[^bad-footnote: missing bracket and then lots of normal words normal words normal words\n\n',
    '```mermaid\ngraph TD\nA --> B{unfinished\n\n',
  ];
}

async function focusEditorAtEnd(page: Page): Promise<void> {
  let focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
  if (!focused) {
    await page.locator(LIVE_EDITOR_SELECTOR).click({
      force: true,
      position: { x: 8, y: 8 },
      timeout: 5_000,
    });
    await waitForEditorAnimationFrame(page);
    focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
  }
  expect(focused).toBe(true);
}

async function typeMalformedFragments(page: Page): Promise<MalformedInputMetric[]> {
  const metrics: MalformedInputMetric[] = [];

  for (const [index, fragment] of createMalformedTypingFragments().entries()) {
    await focusEditorAtEnd(page);
    const dispatchProfileStarted = await page.evaluate(() => (
      window as any
    ).__vlainaE2E.startEditorDispatchProfile?.() ?? false);
    await startMainThreadFrameProbe(page);
    const startedAt = Date.now();
    let mainThreadProbe: MainThreadFrameProbeResult = {
      frameCount: 0,
      longFramesOver50: 0,
      longFramesOver100: 0,
      longTaskCount: 0,
      maxFrameMs: 0,
      maxLongTaskMs: 0,
      p95FrameMs: 0,
    };
    let dispatchProfile: EditorDispatchProfileSummary | null = null;
    try {
      await page.keyboard.type(fragment, { delay: 0 });
      await waitForEditorAnimationFrame(page);
    } finally {
      mainThreadProbe = await stopMainThreadFrameProbe(page);
      dispatchProfile = dispatchProfileStarted
        ? await page.evaluate(() => (
          window as any
        ).__vlainaE2E.stopEditorDispatchProfile?.() ?? null)
        : null;
    }
    metrics.push({
      chars: fragment.length,
      durationMs: Date.now() - startedAt,
      dispatchProfile,
      ...mainThreadProbe,
      index,
      startsWith: fragment.trim().slice(0, 90),
    });
  }

  return metrics;
}

test.describe('notes malformed markdown performance', () => {
  test.setTimeout(180_000);

  test('keeps malformed and unsupported markdown-like input bounded', async () => {
    const content = createMalformedMarkdown(70);
    const { app, userDataRoot } = await launchIsolatedElectron('notes-malformed-markdown-performance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          console.info(text);
        }
      });

      const opened = await openMarkdownFixture(page, {
        filename: 'malformed-markdown-performance-e2e.md',
        content,
      });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Malformed Probe 0');
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Final malformed markdown performance sentinel');

      const openDomMetrics = await collectEditorDomMetrics(page);
      const openScrollMetrics = await measureScrollFrames(page, 36);
      const openBlockScanMetrics = await measureRepeatedBlockScan(page, 12);
      const typingMetrics = await typeMalformedFragments(page);
      const postDomMetrics = await collectEditorDomMetrics(page);
      const postScrollMetrics = await measureScrollFrames(page, 24);
      const postBlockScanMetrics = await measureRepeatedBlockScan(page, 12);
      const slowestTyping = [...typingMetrics]
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 5);
      const slowestTypingByFrame = [...typingMetrics]
        .sort((left, right) => right.maxFrameMs - left.maxFrameMs)
        .slice(0, 3);
      const slowestTypingByDispatch = [...typingMetrics]
        .sort((left, right) => (
          (right.dispatchProfile?.maxDispatchMs ?? 0) - (left.dispatchProfile?.maxDispatchMs ?? 0)
        ))
        .slice(0, 3);
      const maxTypingMs = Math.max(...typingMetrics.map((metric) => metric.durationMs));
      const totalTypingMs = typingMetrics.reduce((sum, metric) => sum + metric.durationMs, 0);
      const maxTypingFrameMs = Math.max(...typingMetrics.map((metric) => metric.maxFrameMs));
      const totalTypingLongFramesOver100 = typingMetrics.reduce((sum, metric) => sum + metric.longFramesOver100, 0);
      const maxTypingLongTaskMs = Math.max(...typingMetrics.map((metric) => metric.maxLongTaskMs));
      const maxTypingDispatchMs = Math.max(...typingMetrics.map((metric) => metric.dispatchProfile?.maxDispatchMs ?? 0));
      const maxTypingPluginApplyTotalMs = Math.max(
        ...typingMetrics.map((metric) => metric.dispatchProfile?.pluginApplyTotalMs ?? 0),
      );
      const maxTypingDecorationPropTotalMs = Math.max(
        ...typingMetrics.map((metric) => metric.dispatchProfile?.decorationPropTotalMs ?? 0),
      );
      const maxTypingUpdateStateInnerTotalMs = Math.max(
        ...typingMetrics.map((metric) => metric.dispatchProfile?.updateStateInnerTotalMs ?? 0),
      );

      console.info('[notes-malformed-markdown-performance]', {
        sourceLength: content.length,
        opened,
        openDomMetrics,
        openScrollMetrics,
        openBlockScanMetrics,
        postDomMetrics,
        postScrollMetrics,
        postBlockScanMetrics,
        maxTypingMs,
        maxTypingFrameMs,
        maxTypingLongTaskMs,
        maxTypingDispatchMs,
        maxTypingPluginApplyTotalMs,
        maxTypingDecorationPropTotalMs,
        maxTypingUpdateStateInnerTotalMs,
        totalTypingLongFramesOver100,
        totalTypingMs,
        slowestTyping,
      });
      console.info('[notes-malformed-markdown-slowest-json]', JSON.stringify({
        slowestTyping,
        slowestTypingByFrame,
        slowestTypingByDispatch,
      }));

      expect(opened.storeOpenMs).toBeLessThan(30_000);
      expect(openDomMetrics.countsBySelector.sourceFallback).toBe(0);
      expect(postDomMetrics.countsBySelector.sourceFallback).toBe(0);
      expect(openDomMetrics.editorTextLength).toBeGreaterThan(5_000);
      expect(postDomMetrics.editorTextLength).toBeGreaterThan(openDomMetrics.editorTextLength);
      expect(openBlockScanMetrics.p95Ms).toBeLessThan(250);
      expect(postBlockScanMetrics.p95Ms).toBeLessThan(250);
      expect(openScrollMetrics?.maxFrameMs ?? 0).toBeLessThan(1_500);
      expect(postScrollMetrics?.maxFrameMs ?? 0).toBeLessThan(1_500);
      expect(maxTypingMs).toBeLessThan(10_000);
      expect(maxTypingFrameMs).toBeLessThan(1_500);
      expect(maxTypingLongTaskMs).toBeLessThan(1_500);
      expect(totalTypingLongFramesOver100).toBeLessThan(30);
      expect(totalTypingMs).toBeLessThan(35_000);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
