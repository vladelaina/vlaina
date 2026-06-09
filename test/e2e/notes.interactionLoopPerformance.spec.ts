import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  collectEditorDomMetrics,
  getOpenBridgePages,
  launchIsolatedElectron,
  measureRepeatedBlockScan,
  measureScrollFrames,
  openMarkdownFixture,
  scrollNoteToTop,
  waitForEditorAnimationFrame,
} from './notesE2E';

const MANUAL_MARKDOWN_PATH = path.resolve(process.cwd(), 'test/e2e/notes-manual-performance.md');
const TOOLBAR_SELECTOR = '.floating-toolbar.visible';
const LIVE_EDITOR_SELECTOR = `${EDITOR_SELECTOR}:not(.toolbar-applied-preview-overlay):not([aria-hidden="true"])`;
const DEFAULT_SEGMENT_LIMIT = 48;
const DEFAULT_ROUNDS = 2;
const MAX_SEGMENT_CHARS = 520;
const MAX_TABLE_SEGMENT_LINES = 4;

type LoopMetric = {
  round: number;
  operation: string;
  durationMs: number;
  detail?: unknown;
};

function getLoopRounds(): number {
  const value = Number.parseInt(process.env.NOTES_INTERACTION_LOOP_ROUNDS ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_ROUNDS;
}

function getSegmentLimit(): number {
  if (process.env.NOTES_INTERACTION_LOOP_FULL === '1') {
    return Number.POSITIVE_INFINITY;
  }
  const value = Number.parseInt(process.env.NOTES_INTERACTION_LOOP_SEGMENTS ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SEGMENT_LIMIT;
}

function trimManualBlock(block: string): string {
  const isTableBlock = /^\|.+\|\n\|[- :|]+\|/m.test(block);
  const representativeBlock = isTableBlock
    ? block.split('\n').slice(0, MAX_TABLE_SEGMENT_LINES).join('\n')
    : block;
  return representativeBlock.length > MAX_SEGMENT_CHARS
    ? `${representativeBlock.slice(0, MAX_SEGMENT_CHARS).trimEnd()}\n`
    : representativeBlock;
}

function createManualSegments(markdown: string): string[] {
  const rawBlocks = markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const requiredBlocks = [
    rawBlocks.find((block) => block.startsWith('# Markdown 编辑器测试手册')),
    rawBlocks.find((block) => /^##\s+/.test(block)),
    rawBlocks.find((block) => /^-\s+/m.test(block)),
    rawBlocks.find((block) => /^\d+[).]/m.test(block)),
    rawBlocks.find((block) => /^\|.+\|\n\|[- :|]+\|/m.test(block)),
    rawBlocks.find((block) => /^```\s*\w*/m.test(block)),
    rawBlocks.find((block) => /\$\$|\\\[|\\\(/.test(block)),
    rawBlocks.find((block) => /!\[/.test(block)),
    rawBlocks.find((block) => /\[[^\]]+\]\([^)]+\)/.test(block)),
  ].filter((block): block is string => Boolean(block));
  const limit = getSegmentLimit();
  const stride = Number.isFinite(limit)
    ? Math.max(1, Math.floor(rawBlocks.length / Math.max(1, limit)))
    : 1;
  const candidates = [
    ...requiredBlocks,
    ...rawBlocks.filter((_block, index) => index % stride === 0),
  ];
  const segments: string[] = [];
  const seen = new Set<string>();

  for (const block of candidates) {
    const segment = trimManualBlock(block);
    const key = segment.replace(/\s+/g, ' ').slice(0, 180);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    segments.push(`${segment}\n\n`);
    if (segments.length >= limit) {
      break;
    }
  }

  return segments;
}

function createManualTableSegment(markdown: string): string {
  const lines = markdown.split('\n');
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!/^\|.+\|$/.test(lines[index]?.trim() ?? '')) {
      continue;
    }
    if (!/^\|[- :|]+\|$/.test(lines[index + 1]?.trim() ?? '')) {
      continue;
    }

    const tableLines = [lines[index], lines[index + 1]];
    for (let nextIndex = index + 2; nextIndex < lines.length; nextIndex += 1) {
      const line = lines[nextIndex];
      if (!/^\|.+\|$/.test(line.trim())) {
        break;
      }
      tableLines.push(line);
      if (tableLines.length >= MAX_TABLE_SEGMENT_LINES + 1) {
        break;
      }
    }

    return `${tableLines.join('\n')}\n\n`;
  }

  return [
    '| 序号 | 标题 | 网址 |',
    '| --- | ---- | --- |',
    '| 01 | 博客 | https://cnblogs.com |',
    '| 02 | 百度 | https://baidu.com |',
    '',
    '',
  ].join('\n');
}

async function measureOperation<T>(
  metrics: LoopMetric[],
  round: number,
  operation: string,
  callback: () => Promise<T>,
  detail?: unknown,
): Promise<T> {
  const startedAt = Date.now();
  const result = await callback();
  metrics.push({
    round,
    operation,
    durationMs: Date.now() - startedAt,
    detail,
  });
  return result;
}

async function selectEditorText(page: import('@playwright/test').Page, text: string) {
  return page.evaluate((targetText) => (window as any).__vlainaE2E.selectEditorTextByText(targetText), text);
}

async function scrollEditorTextIntoView(page: import('@playwright/test').Page, text: string) {
  await page.evaluate((targetText) => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    if (!editor) {
      return;
    }
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.includes(targetText)) {
        const element = node.parentElement;
        element?.scrollIntoView({ block: 'center', inline: 'nearest' });
        return;
      }
      node = walker.nextNode();
    }
  }, text);
  await waitForEditorAnimationFrame(page);
}

async function clickToolbarAction(page: import('@playwright/test').Page, action: string) {
  const button = page.locator(`${TOOLBAR_SELECTOR} [data-action="${action}"]`).first();
  await expect(button).toBeVisible({ timeout: 5_000 });
  const debugBeforeClick = await page.evaluate((targetAction) => {
    const buttonElement = document.querySelector<HTMLElement>(
      `.floating-toolbar.visible [data-action="${targetAction}"]`,
    );
    const toolbarElement = document.querySelector<HTMLElement>('.floating-toolbar.visible');
    const buttonRect = buttonElement?.getBoundingClientRect();
    const toolbarRect = toolbarElement?.getBoundingClientRect();
    const center = buttonRect
      ? {
          x: buttonRect.left + buttonRect.width / 2,
          y: buttonRect.top + buttonRect.height / 2,
        }
      : null;
    const hit = center ? document.elementFromPoint(center.x, center.y) : null;
    const hitElement = hit instanceof HTMLElement ? hit : hit?.parentElement ?? null;
    const hitActionElement = hitElement?.closest<HTMLElement>('[data-action]') ?? null;

    return {
      action: targetAction,
      buttonRect: buttonRect
        ? { x: buttonRect.x, y: buttonRect.y, width: buttonRect.width, height: buttonRect.height }
        : null,
      toolbarRect: toolbarRect
        ? { x: toolbarRect.x, y: toolbarRect.y, width: toolbarRect.width, height: toolbarRect.height }
        : null,
      center,
      hit: hitElement
        ? {
            tagName: hitElement.tagName,
            className: hitElement.className,
            dataAction: hitElement.getAttribute('data-action'),
            closestAction: hitActionElement?.getAttribute('data-action') ?? null,
            inToolbar: Boolean(hitElement.closest('.floating-toolbar')),
          }
        : null,
    };
  }, action);
  if (
    !debugBeforeClick.hit?.inToolbar ||
    debugBeforeClick.hit.closestAction !== action ||
    !debugBeforeClick.center
  ) {
    console.info('[notes-interaction-loop-click-debug]', debugBeforeClick);
    throw new Error(`Toolbar action "${action}" is not hittable at its visible center`);
  }
  await page.mouse.move(debugBeforeClick.center.x, debugBeforeClick.center.y);
  await page.mouse.click(debugBeforeClick.center.x, debugBeforeClick.center.y);
  await waitForEditorAnimationFrame(page);
  await waitForEditorAnimationFrame(page);
}

async function clickVisibleElement(page: import('@playwright/test').Page, selector: string, description: string) {
  const element = page.locator(selector).first();
  await expect(element).toBeVisible({ timeout: 5_000 });
  const debugBeforeClick = await page.evaluate((targetSelector) => {
    const targetElement = document.querySelector<HTMLElement>(targetSelector);
    const rect = targetElement?.getBoundingClientRect();
    const center = rect
      ? {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        }
      : null;
    const hit = center ? document.elementFromPoint(center.x, center.y) : null;
    const hitElement = hit instanceof HTMLElement ? hit : hit?.parentElement ?? null;

    return {
      selector: targetSelector,
      rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      center,
      hit: hitElement
        ? {
            tagName: hitElement.tagName,
            className: hitElement.className,
            matchesTarget: Boolean(hitElement.closest(targetSelector)),
            text: hitElement.textContent?.trim().slice(0, 80) ?? '',
          }
        : null,
    };
  }, selector);

  if (!debugBeforeClick.hit?.matchesTarget || !debugBeforeClick.center) {
    console.info('[notes-interaction-loop-visible-click-debug]', debugBeforeClick);
    throw new Error(`${description} is not hittable at its visible center`);
  }

  await page.mouse.move(debugBeforeClick.center.x, debugBeforeClick.center.y);
  await page.mouse.click(debugBeforeClick.center.x, debugBeforeClick.center.y);
  await waitForEditorAnimationFrame(page);
  await waitForEditorAnimationFrame(page);
}

async function expectToolbarForSelection(page: import('@playwright/test').Page, selectedText: string) {
  await scrollEditorTextIntoView(page, selectedText);
  const selected = await selectEditorText(page, selectedText);
  expect(selected.selected, `Expected to select "${selectedText}"`).toBe(true);
  try {
    await expect(page.locator(TOOLBAR_SELECTOR)).toBeVisible({ timeout: 5_000 });
  } catch (error) {
    const debugState = await page.evaluate(() => (window as any).__vlainaE2E.getEditorToolbarDebugState());
    console.info('[notes-interaction-loop-toolbar-debug]', debugState);
    throw error;
  }
  return selected;
}

async function pressEditorShortcut(page: import('@playwright/test').Page, shortcut: string) {
  await page.bringToFront();
  await page
    .locator(`${EDITOR_SELECTOR}:not(.toolbar-applied-preview-overlay):not([aria-hidden="true"])`)
    .focus();
  await waitForEditorAnimationFrame(page);
  const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditor());
  if (!focused) {
    const debugState = await page.evaluate(() => (window as any).__vlainaE2E.getEditorToolbarDebugState());
    console.info('[notes-interaction-loop-focus-debug]', { shortcut, debugState });
  }
  await page.keyboard.press(shortcut);
  await waitForEditorAnimationFrame(page);
  await waitForEditorAnimationFrame(page);
}

async function expectEditorTextMark(
  page: import('@playwright/test').Page,
  text: string,
  markName: string,
  selector: string,
) {
  const hasMark = await page.evaluate(
    ({ targetText, targetMark }) => (window as any).__vlainaE2E.editorTextHasMark(targetText, targetMark),
    { targetText: text, targetMark: markName },
  );
  if (!hasMark) {
    const debugState = await page.evaluate(() => (window as any).__vlainaE2E.getEditorToolbarDebugState());
    console.info('[notes-interaction-loop-mark-debug]', { text, markName, debugState });
  }
  expect(hasMark, `Expected "${text}" to have ${markName} mark`).toBe(true);
  const liveSelector = selector.replace(EDITOR_SELECTOR, LIVE_EDITOR_SELECTOR);
  await expect(page.locator(liveSelector, { hasText: text })).toBeVisible();
}

test.describe('notes sustained interaction loop performance', () => {
  test.setTimeout(600_000);

  test('loops manual syntax input, toolbar actions, copy paste, and editor scans without stalls', async () => {
    const manualMarkdown = await fs.readFile(MANUAL_MARKDOWN_PATH, 'utf8');
    const segments = createManualSegments(manualMarkdown);
    const manualTableSegment = createManualTableSegment(manualMarkdown);
    expect(segments.length).toBeGreaterThan(12);

    const { app, userDataRoot } = await launchIsolatedElectron('notes-interaction-loop-performance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const loopMetrics: LoopMetric[] = [];
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          console.info(text);
        }
      });

      const rounds = getLoopRounds();
      const roundTargets = Array.from({ length: rounds }, (_value, index) => ({
        toolbar: `Toolbar alpha target round ${index + 1}`,
        shortcut: `Shortcut beta target round ${index + 1}`,
        clipboard: `Clipboard gamma target round ${index + 1}`,
        underline: `Underline delta target round ${index + 1}`,
        strike: `Strike epsilon target round ${index + 1}`,
        inlineCode: `Inline code zeta target round ${index + 1}`,
        delete: `Delete eta target round ${index + 1}`,
        block: `Block theta target round ${index + 1}`,
        alignment: `Alignment iota target round ${index + 1}`,
        color: `Color kappa target round ${index + 1}`,
        link: `Link lambda target round ${index + 1}`,
      }));

      await openMarkdownFixture(page, {
        filename: 'interaction-loop-performance-e2e.md',
        content: [
          '# Interaction Loop',
          '',
          ...roundTargets.flatMap((target) => [
            `${target.toolbar} starts plain.`,
            '',
            `${target.shortcut} starts plain.`,
            '',
            `${target.clipboard} starts plain.`,
            '',
            `${target.underline} starts plain.`,
            '',
            `${target.strike} starts plain.`,
            '',
            `${target.inlineCode} starts plain.`,
            '',
            `${target.delete} starts plain.`,
            '',
            `${target.block} starts plain.`,
            '',
            `${target.alignment} starts plain.`,
            '',
            `${target.color} starts plain.`,
            '',
            `${target.link} starts plain.`,
            '',
          ]),
        ].join('\n'),
      });

      await page.locator(EDITOR_SELECTOR).click();
      for (let round = 0; round < rounds; round += 1) {
        await page.evaluate(async () => {
          await (window as any).__vlainaE2E.flushCurrentEditorMarkdown();
        });
        await scrollNoteToTop(page);
        await waitForEditorAnimationFrame(page);
        const target = roundTargets[round];

        const roundSegments = segments.slice(
          0,
          process.env.NOTES_INTERACTION_LOOP_FULL === '1'
            ? segments.length
            : Math.max(12, Math.ceil(segments.length / rounds)),
        );

        await measureOperation(loopMetrics, round, 'toolbar-bold', async () => {
          await expectToolbarForSelection(page, target.toolbar);
          await clickToolbarAction(page, 'bold');
          await expectEditorTextMark(page, target.toolbar, 'strong', `${EDITOR_SELECTOR} strong`);
        });

        await measureOperation(loopMetrics, round, 'toolbar-italic', async () => {
          await expectToolbarForSelection(page, target.toolbar);
          await clickToolbarAction(page, 'italic');
          await expectEditorTextMark(page, target.toolbar, 'emphasis', `${EDITOR_SELECTOR} em`);
        });

        await measureOperation(loopMetrics, round, 'toolbar-highlight', async () => {
          await expectToolbarForSelection(page, target.toolbar);
          await clickToolbarAction(page, 'highlight');
          await expectEditorTextMark(page, target.toolbar, 'highlight', `${EDITOR_SELECTOR} mark`);
        });

        await measureOperation(loopMetrics, round, 'toolbar-underline', async () => {
          await expectToolbarForSelection(page, target.underline);
          await clickToolbarAction(page, 'underline');
          await expectEditorTextMark(page, target.underline, 'underline', `${EDITOR_SELECTOR} u`);
        });

        await measureOperation(loopMetrics, round, 'toolbar-strike', async () => {
          await expectToolbarForSelection(page, target.strike);
          await clickToolbarAction(page, 'strike');
          await expectEditorTextMark(page, target.strike, 'strike_through', `${EDITOR_SELECTOR} s`);
        });

        await measureOperation(loopMetrics, round, 'toolbar-inline-code', async () => {
          await expectToolbarForSelection(page, target.inlineCode);
          await clickToolbarAction(page, 'code');
          await expectEditorTextMark(page, target.inlineCode, 'inlineCode', `${EDITOR_SELECTOR} code`);
        });

        await measureOperation(loopMetrics, round, 'keyboard-shortcuts', async () => {
          await expectToolbarForSelection(page, target.shortcut);
          await pressEditorShortcut(page, 'Control+B');
          await expectEditorTextMark(page, target.shortcut, 'strong', `${EDITOR_SELECTOR} strong`);
          await expectToolbarForSelection(page, target.shortcut);
          await pressEditorShortcut(page, 'Control+I');
          await expectEditorTextMark(page, target.shortcut, 'emphasis', `${EDITOR_SELECTOR} em`);
        });

        await measureOperation(loopMetrics, round, 'toolbar-copy', async () => {
          await expectToolbarForSelection(page, target.clipboard);
          await clickToolbarAction(page, 'copy');
          await expect(page.locator(`${TOOLBAR_SELECTOR} [data-action="copy"].active`).first()).toBeVisible({ timeout: 5_000 });
        });

        await measureOperation(loopMetrics, round, 'toolbar-block-heading', async () => {
          await expectToolbarForSelection(page, target.block);
          await clickToolbarAction(page, 'block');
          await clickVisibleElement(
            page,
            '.block-dropdown [data-block-type="heading2"]',
            'heading2 block dropdown item',
          );
          await expect(page.locator(`${LIVE_EDITOR_SELECTOR} h2`, { hasText: target.block })).toBeVisible();
        });

        await measureOperation(loopMetrics, round, 'toolbar-align-center', async () => {
          await expectToolbarForSelection(page, target.alignment);
          await clickToolbarAction(page, 'alignment');
          await clickVisibleElement(
            page,
            '.alignment-dropdown [data-alignment="center"]',
            'center alignment dropdown item',
          );
          await expect(
            page.locator(`${LIVE_EDITOR_SELECTOR} [data-text-align="center"]`, { hasText: target.alignment }),
          ).toBeVisible();
        });

        await measureOperation(loopMetrics, round, 'toolbar-text-color', async () => {
          await expectToolbarForSelection(page, target.color);
          await clickToolbarAction(page, 'color');
          await clickVisibleElement(
            page,
            '.color-picker [data-type="text"] .color-picker-grid .color-picker-item:not(.color-picker-item-default)',
            'text color picker swatch',
          );
          await expect(page.locator(`${LIVE_EDITOR_SELECTOR} span[data-text-color]`, { hasText: target.color })).toBeVisible();
        });

        await measureOperation(loopMetrics, round, 'toolbar-link', async () => {
          const url = `https://example.com/notes-loop/${round + 1}`;
          await expectToolbarForSelection(page, target.link);
          await clickToolbarAction(page, 'link');
          const input = page.locator('.link-editor-rail-input').first();
          await expect(input).toBeVisible({ timeout: 5_000 });
          await input.fill(url);
          await input.press('Enter');
          await waitForEditorAnimationFrame(page);
          await expect(page.locator(`${LIVE_EDITOR_SELECTOR} a[href="${url}"]`, { hasText: target.link })).toBeVisible();
        });

        await measureOperation(loopMetrics, round, 'toolbar-delete', async () => {
          await expectToolbarForSelection(page, target.delete);
          await clickToolbarAction(page, 'delete');
          await expect(page.locator(LIVE_EDITOR_SELECTOR)).not.toContainText(target.delete);
        });

        await measureOperation(loopMetrics, round, 'paste-markdown-fragment', async () => {
          await page.locator(EDITOR_SELECTOR).click();
          await page.keyboard.press('End');
          const pasteText = [
              '',
              `Loop pasted markdown ${Date.now()}: **bold paste**, [paste link](https://example.com/paste), \`paste-code\`.`,
              '',
            ].join('\n');
          await page.evaluate(async (text) => {
            await (window as any).__vlainaE2E.writeClipboardText(text);
          }, pasteText);
          await page.keyboard.press('Control+V');
          await page.evaluate(() => {
            const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
            editor?.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
          });
          await waitForEditorAnimationFrame(page);
          await expect(page.locator(EDITOR_SELECTOR)).toContainText('Loop pasted markdown');
        });

        await measureOperation(loopMetrics, round, 'paste-manual-table-fragment', async () => {
          await page.locator(EDITOR_SELECTOR).click();
          await page.keyboard.press('End');
          await page.evaluate(async (text) => {
            await (window as any).__vlainaE2E.writeClipboardText(text);
          }, `\n${manualTableSegment}`);
          await page.keyboard.press('Control+V');
          await waitForEditorAnimationFrame(page);
          await expect(page.locator(`${EDITOR_SELECTOR} table`).first()).toBeVisible({ timeout: 10_000 });
        });

        await page.locator(EDITOR_SELECTOR).click();
        await page.keyboard.press('End');
        for (const [index, segment] of roundSegments.entries()) {
          await measureOperation(
            loopMetrics,
            round,
            'type-manual-segment',
            async () => {
              await page.keyboard.type(segment, { delay: 0 });
              await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
            },
            {
              index,
              chars: segment.length,
              startsWith: segment.trim().slice(0, 80),
            },
          );
        }

        const blockScanMetrics = await measureOperation(
          loopMetrics,
          round,
          'block-scan',
          () => measureRepeatedBlockScan(page, 12),
        );
        const scrollMetrics = await measureOperation(
          loopMetrics,
          round,
          'scroll-frames',
          () => measureScrollFrames(page, 24),
        );
        expect(blockScanMetrics.p95Ms).toBeLessThan(250);
        expect(scrollMetrics?.maxFrameMs ?? 0).toBeLessThan(1_500);
      }

      const domMetrics = await collectEditorDomMetrics(page);
      const slowestOperations = [...loopMetrics]
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 12);
      const maxOperationMs = Math.max(...loopMetrics.map((metric) => metric.durationMs));
      const maxTypingMs = Math.max(
        ...loopMetrics
          .filter((metric) => metric.operation === 'type-manual-segment')
          .map((metric) => metric.durationMs),
      );

      console.info('[notes-interaction-loop-performance]', {
        rounds,
        segmentCount: segments.length,
        metricCount: loopMetrics.length,
        maxOperationMs,
        maxTypingMs,
        slowestOperations,
        domMetrics,
      });
      console.info('[notes-interaction-loop-slowest-json]', JSON.stringify(slowestOperations));

      expect(domMetrics.countsBySelector.sourceFallback).toBe(0);
      expect(domMetrics.countsBySelector.headings).toBeGreaterThan(0);
      expect(domMetrics.countsBySelector.tables).toBeGreaterThan(0);
      expect(domMetrics.countsBySelector.codeBlocks).toBeGreaterThan(0);
      expect(domMetrics.editorTextLength).toBeGreaterThan(2_000);
      expect(maxOperationMs).toBeLessThan(15_000);
      expect(maxTypingMs).toBeLessThan(12_000);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
