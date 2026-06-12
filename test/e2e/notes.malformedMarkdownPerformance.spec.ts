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

type MalformedTypingSummary = {
  maxTypingDecorationPropTotalMs: number;
  maxTypingDispatchMs: number;
  maxTypingFrameMs: number;
  maxTypingLongTaskMs: number;
  maxTypingMs: number;
  maxTypingP95DispatchMs: number;
  maxTypingP95FrameMs: number;
  maxTypingPluginApplyTotalMs: number;
  maxTypingUpdateStateInnerTotalMs: number;
  slowestTyping: MalformedInputMetric[];
  slowestTypingByDispatch: MalformedInputMetric[];
  slowestTypingByFrame: MalformedInputMetric[];
  totalTypingLongFramesOver100: number;
  totalTypingMs: number;
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

function createTyporaLikeImportedMarkdown(sectionCount: number): string {
  const blankLine = '<!--vlaina-markdown-blank-line-->';
  const sections = [
    '---',
    'vlaina_cover: "./assets/13.jpg"',
    'vlaina_cover_x: 50',
    'vlaina_cover_y: 35.92496673701899',
    'vlaina_cover_height: 200',
    'vlaina_cover_scale: 1',
    'vlaina_icon: "🍓"',
    'vlaina_created: 2026-05-02 21:41:13 +08:00',
    'vlaina_updated: 2026-06-11 18:32:29 +08:00',
    '---',
    '',
    '# Typora-like Imported Markdown Performance',
    '',
    '[toc]',
    '',
    '[TOC]',
    '',
  ];

  for (let index = 0; index < sectionCount; index += 1) {
    sections.push(
      `${index + 1}. Typora compatibility note ${index} with unsupported ++underline++, ==highlight==, content^sup^, content~sub~, old chart syntax, and broken [link ${index}(https://example.invalid/${index}`,
      '',
      blankLine,
      blankLine,
      '',
      `## 常用快捷键 ${index}\\\\`,
      '',
      blankLine,
      blankLine,
      '',
      `| 功能 ${index} | 操作步骤 | Windows | macOS | dangling |`,
      '| --- | ----------- | ------------- | --------- | :----- |',
      `| 源代码模式 | 视图->源代码模式 | Ctrl+/ | command+/ | extra-${index} | overflow |`,
      `| 表格坏行 | https\\:/[/example.com](https://example.com/${index}) | **bold | *italic* |`,
      '',
      `> > > nested quote ${index} with [!callout-icon:%ZZ] and unmatched **strong marker`,
      '',
      `<video src="./assets/${index}.mp4" /><audio src="./assets/${index}.mp3"></audio><iframe src="https://example.invalid/${index}"></iframe>`,
      '',
      `[^bad-${index}: footnote-like text without closing label`,
      '',
      `- [ ] task ${index}`,
      `  - [x] nested task ${index}`,
      '',
      '```txt',
      `old flow syntax ${index}: st=>start cond=>condition 对象A->对象B: missing renderer`,
      '```',
      '',
      blankLine,
      '',
      `Final Typora-like imported section sentinel ${index}.`,
      '',
    );
  }

  sections.push('Final Typora-like imported markdown performance sentinel.');
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

function summarizeMalformedTypingMetrics(typingMetrics: MalformedInputMetric[]): MalformedTypingSummary {
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

  return {
    maxTypingDecorationPropTotalMs: Math.max(
      ...typingMetrics.map((metric) => metric.dispatchProfile?.decorationPropTotalMs ?? 0),
    ),
    maxTypingDispatchMs: Math.max(...typingMetrics.map((metric) => metric.dispatchProfile?.maxDispatchMs ?? 0)),
    maxTypingFrameMs: Math.max(...typingMetrics.map((metric) => metric.maxFrameMs)),
    maxTypingLongTaskMs: Math.max(...typingMetrics.map((metric) => metric.maxLongTaskMs)),
    maxTypingMs: Math.max(...typingMetrics.map((metric) => metric.durationMs)),
    maxTypingP95DispatchMs: Math.max(...typingMetrics.map((metric) => metric.dispatchProfile?.p95DispatchMs ?? 0)),
    maxTypingP95FrameMs: Math.max(...typingMetrics.map((metric) => metric.p95FrameMs)),
    maxTypingPluginApplyTotalMs: Math.max(
      ...typingMetrics.map((metric) => metric.dispatchProfile?.pluginApplyTotalMs ?? 0),
    ),
    maxTypingUpdateStateInnerTotalMs: Math.max(
      ...typingMetrics.map((metric) => metric.dispatchProfile?.updateStateInnerTotalMs ?? 0),
    ),
    slowestTyping,
    slowestTypingByDispatch,
    slowestTypingByFrame,
    totalTypingLongFramesOver100: typingMetrics.reduce((sum, metric) => sum + metric.longFramesOver100, 0),
    totalTypingMs: typingMetrics.reduce((sum, metric) => sum + metric.durationMs, 0),
  };
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
      const typingSummary = summarizeMalformedTypingMetrics(typingMetrics);

      console.info('[notes-malformed-markdown-performance]', {
        sourceLength: content.length,
        opened,
        openDomMetrics,
        openScrollMetrics,
        openBlockScanMetrics,
        postDomMetrics,
        postScrollMetrics,
        postBlockScanMetrics,
        ...typingSummary,
      });
      console.info('[notes-malformed-markdown-slowest-json]', JSON.stringify({
        slowestTyping: typingSummary.slowestTyping,
        slowestTypingByFrame: typingSummary.slowestTypingByFrame,
        slowestTypingByDispatch: typingSummary.slowestTypingByDispatch,
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
      expect(typingSummary.maxTypingMs).toBeLessThan(10_000);
      expect(typingSummary.maxTypingFrameMs).toBeLessThan(1_500);
      expect(typingSummary.maxTypingLongTaskMs).toBeLessThan(1_500);
      expect(typingSummary.totalTypingLongFramesOver100).toBeLessThan(30);
      expect(typingSummary.totalTypingMs).toBeLessThan(35_000);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps Typora-like imported markdown bounded outside block selection', async () => {
    const content = createTyporaLikeImportedMarkdown(70);
    const { app, userDataRoot } = await launchIsolatedElectron('notes-malformed-typora-like-performance');

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
        filename: 'malformed-typora-like-performance-e2e.md',
        content,
      });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Typora-like Imported Markdown Performance');
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Final Typora-like imported markdown performance sentinel');
      await expect.poll(
        async () => page.evaluate(() => (window as any).__vlainaE2E.getNoteSelectableBlocks().length),
        { timeout: 30_000 },
      ).toBeGreaterThanOrEqual(900);

      const openDomMetrics = await collectEditorDomMetrics(page);
      const openScrollMetrics = await measureScrollFrames(page, 36);
      const openBlockScanMetrics = await measureRepeatedBlockScan(page, 12);
      const typingMetrics = await typeMalformedFragments(page);
      const postDomMetrics = await collectEditorDomMetrics(page);
      const postScrollMetrics = await measureScrollFrames(page, 24);
      const postBlockScanMetrics = await measureRepeatedBlockScan(page, 12);
      const typingSummary = summarizeMalformedTypingMetrics(typingMetrics);

      console.info('[notes-malformed-typora-like-performance]', {
        sourceLength: content.length,
        opened,
        openDomMetrics,
        openScrollMetrics,
        openBlockScanMetrics,
        postDomMetrics,
        postScrollMetrics,
        postBlockScanMetrics,
        ...typingSummary,
      });
      console.info('[notes-malformed-typora-like-slowest-json]', JSON.stringify({
        slowestTyping: typingSummary.slowestTyping,
        slowestTypingByFrame: typingSummary.slowestTypingByFrame,
        slowestTypingByDispatch: typingSummary.slowestTypingByDispatch,
      }));

      expect(opened.storeOpenMs).toBeLessThan(30_000);
      expect(openDomMetrics.countsBySelector.sourceFallback).toBe(0);
      expect(postDomMetrics.countsBySelector.sourceFallback).toBe(0);
      expect(openDomMetrics.countsBySelector.markdownBlankLines).toBeGreaterThan(200);
      expect(openDomMetrics.countsBySelector.tables).toBeGreaterThan(50);
      expect(openDomMetrics.countsBySelector.taskItems).toBeGreaterThan(100);
      expect(openDomMetrics.countsBySelector.codeBlocks).toBeGreaterThan(50);
      expect(openDomMetrics.selectableBlockCount).toBeGreaterThanOrEqual(900);
      expect(postDomMetrics.editorTextLength).toBeGreaterThan(openDomMetrics.editorTextLength);
      expect(openBlockScanMetrics.p95Ms).toBeLessThan(250);
      expect(postBlockScanMetrics.p95Ms).toBeLessThan(250);
      expect(openScrollMetrics?.maxFrameMs ?? 0).toBeLessThan(1_500);
      expect(postScrollMetrics?.maxFrameMs ?? 0).toBeLessThan(1_500);
      expect(typingSummary.maxTypingMs).toBeLessThan(10_000);
      expect(typingSummary.maxTypingP95DispatchMs).toBeLessThan(250);
      expect(typingSummary.maxTypingDispatchMs).toBeLessThan(750);
      expect(typingSummary.maxTypingFrameMs).toBeLessThan(1_500);
      expect(typingSummary.maxTypingP95FrameMs).toBeLessThan(300);
      expect(typingSummary.maxTypingLongTaskMs).toBeLessThan(1_500);
      expect(typingSummary.totalTypingLongFramesOver100).toBeLessThan(120);
      expect(typingSummary.totalTypingMs).toBeLessThan(60_000);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
