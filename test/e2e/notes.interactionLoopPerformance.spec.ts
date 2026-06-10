import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
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
import {
  MANUAL_MARKDOWN_PATH,
  createManualInteractionSegments,
} from './notesManualSegments';

const TOOLBAR_SELECTOR = '.floating-toolbar.visible';
const LIVE_EDITOR_SELECTOR = `${EDITOR_SELECTOR}:not(.toolbar-applied-preview-overlay):not([aria-hidden="true"])`;
const DEFAULT_SEGMENT_LIMIT = 48;
const DEFAULT_ROUNDS = 2;
const MAX_MANUAL_TABLE_SEGMENT_LINES = 4;
const MANUAL_MERMAID_FENCE_LANGUAGES = new Set([
  'mermaid',
  'mmd',
  'flow',
  'flowchart',
  'flowchartv2',
  'flowchartelk',
  'graph',
  'sequence',
  'sequencediagram',
  'class',
  'classdiagram',
  'state',
  'statediagram',
  'er',
  'erdiagram',
  'gantt',
  'pie',
  'journey',
  'gitgraph',
  'mindmap',
  'timeline',
  'treeview',
  'quadrant',
  'xychart',
]);

type ManualSegmentMode = 'main-editor' | 'math-popup' | 'mermaid-popup';

type LoopMetric = {
  round: number;
  operation: string;
  durationMs: number;
  detail?: unknown;
};

type RoundTargets = {
  toolbar: string;
  shortcut: string;
  clipboard: string;
  underline: string;
  strike: string;
  inlineCode: string;
  delete: string;
  block: string;
  alignment: string;
  color: string;
  link: string;
};

type RoundManualSegment = {
  sourceIndex: number;
  segment: string;
};

type ParsedManualFenceSegment = {
  marker: string;
  language: string;
  body: string;
};

type ParsedManualMathSegment = {
  marker: '$$' | '\\[';
  body: string;
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

function normalizeFenceLanguage(language: string): string {
  return language.trim().split(/\s+/)[0]?.toLowerCase().replace(/[\s_-]+/g, '') ?? '';
}

function parseManualFenceSegment(segment: string): ParsedManualFenceSegment | null {
  const lines = segment.trimEnd().split(/\r?\n/);
  const openingMatch = /^(?<marker>`{3,}|~{3,})[ \t]*(?<info>[^\r\n]*)$/.exec(lines[0] ?? '');
  if (!openingMatch?.groups) {
    return null;
  }

  const marker = openingMatch.groups.marker ?? '';
  const info = openingMatch.groups.info?.trim() ?? '';
  if (marker.startsWith('`') && info.includes('`')) {
    return null;
  }

  const language = info.split(/\s+/)[0] ?? '';
  if (!MANUAL_MERMAID_FENCE_LANGUAGES.has(normalizeFenceLanguage(language))) {
    return null;
  }

  const markerChar = marker[0];
  const closingIndex = lines.findLastIndex((line, index) => {
    if (index === 0) {
      return false;
    }
    const trimmed = line.trim();
    return (
      trimmed.length >= marker.length &&
      [...trimmed].every((char) => char === markerChar)
    );
  });

  return {
    marker,
    language,
    body: lines.slice(1, closingIndex > 0 ? closingIndex : undefined).join('\n'),
  };
}

function parseManualMathSegment(segment: string): ParsedManualMathSegment | null {
  const lines = segment.trimEnd().split(/\r?\n/);
  const firstLine = lines[0]?.trim() ?? '';
  if (firstLine === '$$') {
    const closingIndex = lines.findLastIndex((line, index) => index > 0 && line.trim() === '$$');
    if (closingIndex > 0) {
      return {
        marker: '$$',
        body: lines.slice(1, closingIndex).join('\n'),
      };
    }
  }

  if (firstLine === '\\[') {
    const closingIndex = lines.findLastIndex((line, index) => index > 0 && line.trim() === '\\]');
    if (closingIndex > 0) {
      return {
        marker: '\\[',
        body: lines.slice(1, closingIndex).join('\n'),
      };
    }
  }

  return null;
}

function getManualSegmentMode(segment: string): ManualSegmentMode {
  if (parseManualFenceSegment(segment)) {
    return 'mermaid-popup';
  }
  if (parseManualMathSegment(segment)) {
    return 'math-popup';
  }
  return 'main-editor';
}

function getRoundManualSegments(segments: string[], round: number, rounds: number): RoundManualSegment[] {
  if (process.env.NOTES_INTERACTION_LOOP_FULL === '1') {
    return segments.map((segment, sourceIndex) => ({ sourceIndex, segment }));
  }

  const normalizedRounds = Math.max(1, Math.floor(rounds));
  const chunkSize = Math.max(1, Math.ceil(segments.length / normalizedRounds));
  const start = Math.min(segments.length, round * chunkSize);
  const end = Math.min(segments.length, start + chunkSize);

  return segments
    .slice(start, end)
    .map((segment, offset) => ({ sourceIndex: start + offset, segment }));
}

function getRoundManualSegmentCount(segments: string[], rounds: number): number {
  return Array.from({ length: Math.max(1, rounds) }, (_value, round) => (
    getRoundManualSegments(segments, round, rounds).length
  )).reduce((total, count) => total + count, 0);
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
      if (tableLines.length >= MAX_MANUAL_TABLE_SEGMENT_LINES + 1) {
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

async function selectEditorText(page: import('@playwright/test').Page, text: string, anchorText?: string) {
  return page.evaluate(
    ({ targetText, anchor }) => (window as any).__vlainaE2E.selectEditorTextByText(targetText, anchor),
    { targetText: text, anchor: anchorText },
  );
}

async function dragSelectEditorText(page: import('@playwright/test').Page, text: string, anchorText?: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const selected = await selectEditorText(page, text, anchorText);
    if (selected.selected) {
      return selected;
    }
    await waitForEditorAnimationFrame(page);
  }

  await page.evaluate(() => {
    window.getSelection()?.removeAllRanges();
  });
  await page.locator(LIVE_EDITOR_SELECTOR).focus();
  await waitForEditorAnimationFrame(page);

  const dragTarget = await page.evaluate((targetText) => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    if (!editor) {
      return null;
    }

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const content = node.textContent ?? '';
      const index = content.indexOf(targetText);
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + targetText.length);
        const rect = Array.from(range.getClientRects()).find(
          (candidate) => candidate.width > 4 && candidate.height > 4,
        );
        range.detach();
        if (!rect) {
          return null;
        }
        return {
          startX: rect.left + 2,
          startY: rect.top + rect.height / 2,
          endX: rect.right - 2,
          endY: rect.top + rect.height / 2,
        };
      }
      node = walker.nextNode();
    }
    return null;
  }, text);

  if (!dragTarget) {
    return selectEditorText(page, text, anchorText);
  }

  await page.mouse.move(dragTarget.startX, dragTarget.startY);
  await page.mouse.down();
  await page.mouse.move(dragTarget.endX, dragTarget.endY, { steps: 8 });
  await page.mouse.up();
  await waitForEditorAnimationFrame(page);
  const summary = await page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary());
  if (summary?.selectedText === text) {
    return {
      selected: true,
      from: summary.from,
      to: summary.to,
      selectedText: summary.selectedText,
    };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const selected = await selectEditorText(page, text, anchorText);
    if (selected.selected) {
      return selected;
    }
    await waitForEditorAnimationFrame(page);
  }

  return selectEditorText(page, text, anchorText);
}

async function scrollEditorTextIntoView(page: import('@playwright/test').Page, text: string, anchorText?: string) {
  await page.evaluate(({ targetText, anchor }) => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    if (!editor) {
      return;
    }
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const candidates: HTMLElement[] = [];
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.includes(targetText)) {
        const element = node.parentElement;
        if (element) {
          candidates.push(element);
        }
      }
      node = walker.nextNode();
    }
    const anchored = anchor
      ? candidates.find((element) => element.textContent?.includes(anchor))
      : null;
    (anchored ?? candidates[0])?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, { targetText: text, anchor: anchorText });
  await waitForEditorAnimationFrame(page);
}

async function clickToolbarAction(page: import('@playwright/test').Page, action: string) {
  const button = page.locator(`${TOOLBAR_SELECTOR} [data-action="${action}"]`).first();
  await expect(button).toBeVisible({ timeout: 5_000 });
  const getClickTarget = async () => page.evaluate((targetAction) => {
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
    const toolbarElements = Array.from(document.querySelectorAll<HTMLElement>('.floating-toolbar'));

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
      toolbarElements: toolbarElements.map((element) => ({
        className: element.className,
        text: element.textContent?.trim().slice(0, 80) ?? '',
        parentDisplay: element.parentElement ? getComputedStyle(element.parentElement).display : null,
        rect: (() => {
          const elementRect = element.getBoundingClientRect();
          return {
            x: elementRect.x,
            y: elementRect.y,
            width: elementRect.width,
            height: elementRect.height,
          };
        })(),
      })),
      previewCount: document.querySelectorAll('.toolbar-applied-preview-overlay').length,
      editorDisplay: (() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        return editor ? getComputedStyle(editor).display : null;
      })(),
    };
  }, action);
  const debugBeforeMove = await getClickTarget();
  if (
    !debugBeforeMove.hit?.inToolbar ||
    debugBeforeMove.hit.closestAction !== action ||
    !debugBeforeMove.center
  ) {
    console.info('[notes-interaction-loop-click-debug]', debugBeforeMove);
    throw new Error(`Toolbar action "${action}" is not hittable at its visible center`);
  }
  await page.mouse.move(debugBeforeMove.center.x, debugBeforeMove.center.y);
  await page.mouse.click(debugBeforeMove.center.x, debugBeforeMove.center.y);
  await waitForEditorAnimationFrame(page);
  await waitForEditorAnimationFrame(page);
}

async function clickVisibleElement(page: import('@playwright/test').Page, selector: string, description: string) {
  const element = page.locator(selector).first();
  try {
    await expect(element).toBeVisible({ timeout: 5_000 });
  } catch (error) {
    const debugState = await page.evaluate((targetSelector) => {
      const toolbarDebugState = (window as any).__vlainaE2E.getEditorToolbarDebugState();
      const toolbarHtml = Array.from(document.querySelectorAll<HTMLElement>('.floating-toolbar')).map((toolbar) => ({
        className: toolbar.className,
        text: toolbar.textContent?.replace(/\s+/g, ' ').trim().slice(0, 240) ?? '',
        html: toolbar.innerHTML.slice(0, 2_000),
        hasTarget: Boolean(toolbar.querySelector(targetSelector)),
      }));
      return {
        targetSelector,
        toolbarDebugState,
        toolbarHtml,
      };
    }, selector);
    console.info('[notes-interaction-loop-submenu-debug]', debugState);
    throw error;
  }
  await element.scrollIntoViewIfNeeded();
  await waitForEditorAnimationFrame(page);

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

async function expectToolbarForSelection(
  page: import('@playwright/test').Page,
  selectedText: string,
  anchorText = selectedText,
) {
  await scrollEditorTextIntoView(page, selectedText, anchorText);
  const selected = await dragSelectEditorText(page, selectedText, anchorText);
  if (!selected.selected) {
    const debugState = await page.evaluate(({ targetText, selectedResult }) => {
      const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
      return {
        targetText,
        selected: selectedResult,
        toolbarDebugState: (window as any).__vlainaE2E.getEditorToolbarDebugState(),
        editorHasText: editor?.textContent?.includes(targetText) ?? false,
        editorTextPreview: editor?.textContent?.slice(0, 1_000) ?? '',
      };
    }, { targetText: selectedText, selectedResult: selected });
    console.info('[notes-interaction-loop-selection-debug]', debugState);
  }
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

async function pressEditorShortcut(page: import('@playwright/test').Page, shortcut: string, selectedText?: string) {
  await page.bringToFront();
  if (selectedText) {
    const selected = await selectEditorText(page, selectedText, selectedText);
    expect(selected.selected, `Expected to keep "${selectedText}" selected before ${shortcut}`).toBe(true);
  }
  const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditor());
  if (!focused) {
    const debugState = await page.evaluate(() => (window as any).__vlainaE2E.getEditorToolbarDebugState());
    console.info('[notes-interaction-loop-focus-debug]', { shortcut, debugState });
  }
  await page.keyboard.press(shortcut);
  await waitForEditorAnimationFrame(page);
  await waitForEditorAnimationFrame(page);
}

async function ensureRoundTargetsAvailable(page: import('@playwright/test').Page, target: RoundTargets) {
  const targetLines = [
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
  ];
  const requiredTexts = Object.values(target);
  await focusEditorAtDocumentEnd(page);
  await page.keyboard.type(`\n\n${targetLines.join('\n')}`, { delay: 0 });
  await waitForEditorAnimationFrame(page);

  const stillMissing = await page.evaluate((texts) => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    const content = editor?.textContent ?? '';
    return texts.filter((text) => !content.includes(text));
  }, requiredTexts);
  expect(stillMissing, `Expected appended round targets to be present: ${stillMissing.join(', ')}`).toEqual([]);
}

async function countEditorTextOccurrences(page: import('@playwright/test').Page, text: string) {
  return page.evaluate((targetText) => {
    const editor = document.querySelector<HTMLElement>(
      '.milkdown .ProseMirror:not(.toolbar-applied-preview-overlay):not([aria-hidden="true"])',
    );
    const content = editor?.textContent ?? '';
    let count = 0;
    let index = content.indexOf(targetText);
    while (index >= 0) {
      count += 1;
      index = content.indexOf(targetText, index + targetText.length);
    }
    return count;
  }, text);
}

async function expectEditorTextMark(
  page: import('@playwright/test').Page,
  text: string,
  markName: string,
  selector: string,
  anchorText = text,
) {
  const hasMark = await page.evaluate(
    ({ targetText, targetMark, anchor }) => (
      window as any
    ).__vlainaE2E.editorTextHasMark(targetText, targetMark, anchor),
    { targetText: text, targetMark: markName, anchor: anchorText },
  );
  if (!hasMark) {
    const debugState = await page.evaluate(() => (window as any).__vlainaE2E.getEditorToolbarDebugState());
    console.info('[notes-interaction-loop-mark-debug]', { text, markName, debugState });
  }
  expect(hasMark, `Expected "${text}" to have ${markName} mark`).toBe(true);
  const liveSelector = selector.split(EDITOR_SELECTOR).join(LIVE_EDITOR_SELECTOR);
  await expect(page.locator(liveSelector, { hasText: text })).toBeVisible();
}

async function focusEditorAtDocumentEnd(page: import('@playwright/test').Page) {
  const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
  if (!focused) {
    const debugState = await page.evaluate(() => (window as any).__vlainaE2E.getEditorToolbarDebugState());
    console.info('[notes-interaction-loop-focus-end-debug]', debugState);
  }
  expect(focused).toBe(true);
  await waitForEditorAnimationFrame(page);
}

async function startFreshManualInputBlock(page: import('@playwright/test').Page) {
  await focusEditorAtDocumentEnd(page);
}

async function expectNoTextEditorPopup(page: import('@playwright/test').Page, detail: unknown) {
  const popupCount = await page.locator('.text-editor-popup').count();
  if (popupCount > 0) {
    const debugState = await page.evaluate(() => {
      const activeElement = document.activeElement;
      return {
        activeElement: activeElement instanceof HTMLElement
          ? {
              tagName: activeElement.tagName,
              className: activeElement.className,
              valuePreview: activeElement instanceof HTMLTextAreaElement
                ? activeElement.value.slice(0, 160)
                : undefined,
            }
          : null,
        popups: Array.from(document.querySelectorAll<HTMLElement>('.text-editor-popup')).map((popup) => ({
          className: popup.className,
          text: popup.textContent?.replace(/\s+/g, ' ').trim().slice(0, 240) ?? '',
        })),
      };
    });
    console.info('[notes-interaction-loop-unexpected-popup-debug]', { detail, debugState });
  }
  expect(popupCount, `Unexpected text editor popup while typing manual segment ${JSON.stringify(detail)}`).toBe(0);
}

async function typeManualMainEditorSegment(
  page: import('@playwright/test').Page,
  segment: string,
  detail: unknown,
) {
  await startFreshManualInputBlock(page);
  await page.keyboard.type(segment, { delay: 0 });
  await waitForEditorAnimationFrame(page);
  await expectNoTextEditorPopup(page, detail);
}

async function expectTextEditorPopupTextareaVisible(
  page: import('@playwright/test').Page,
  textarea: import('@playwright/test').Locator,
  mode: 'math' | 'mermaid',
  parsed: ParsedManualMathSegment | ParsedManualFenceSegment,
) {
  try {
    await expect(textarea).toBeVisible({ timeout: 5_000 });
  } catch (error) {
    const debugState = await page.evaluate(() => {
      const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
      const activeElement = document.activeElement;
      const selection = (window as any).__vlainaE2E.getEditorSelectionSummary();
      const selectedNode = selection
        ? (() => {
            const view = (window as any).__vlainaE2E.getEditorToolbarDebugState?.();
            return view?.selection ?? null;
          })()
        : null;

      return {
        activeElement: activeElement instanceof HTMLElement
          ? {
              tagName: activeElement.tagName,
              className: activeElement.className,
              isEditorRoot: activeElement === editor,
              valuePreview: activeElement instanceof HTMLTextAreaElement
                ? activeElement.value.slice(0, 200)
                : undefined,
            }
          : null,
        selection,
        selectedNode,
        editorTextTail: editor?.textContent?.slice(-1_000) ?? '',
        popups: Array.from(document.querySelectorAll<HTMLElement>('.text-editor-popup')).map((popup) => ({
          className: popup.className,
          text: popup.textContent?.replace(/\s+/g, ' ').trim().slice(0, 240) ?? '',
        })),
        codeBlockCount: editor?.querySelectorAll('.code-block-container').length ?? 0,
        mermaidCount: editor?.querySelectorAll('div[data-type="mermaid"]').length ?? 0,
        mathBlockCount: editor?.querySelectorAll('div[data-type="math-block"]').length ?? 0,
      };
    });
    console.info('[notes-interaction-loop-popup-open-debug]', {
      mode,
      parsed,
      debugState,
    });
    throw error;
  }
}

async function saveTextEditorPopup(
  page: import('@playwright/test').Page,
  popupSelector: string,
) {
  await page.keyboard.press('Control+Enter');
  try {
    await expect(page.locator(popupSelector)).toHaveCount(0, { timeout: 1_000 });
    return;
  } catch {
    const saveButton = page.locator(`${popupSelector} .text-editor-action-button-primary`).first();
    await expect(saveButton).toBeVisible({ timeout: 5_000 });
    await saveButton.evaluate((button) => {
      if (button instanceof HTMLButtonElement) {
        button.click();
      }
    });
  }
  try {
    await expect(page.locator(popupSelector)).toHaveCount(0, { timeout: 10_000 });
  } catch (error) {
    const debugState = await page.evaluate((selector) => {
      const popup = document.querySelector<HTMLElement>(selector);
      const textarea = popup?.querySelector<HTMLTextAreaElement>('textarea.text-editor-textarea');
      const saveButton = popup?.querySelector<HTMLButtonElement>('.text-editor-action-button-primary');
      return {
        selector,
        popupExists: Boolean(popup),
        popupText: popup?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 300) ?? '',
        textareaValuePreview: textarea?.value.slice(0, 500) ?? null,
        textareaValueLength: textarea?.value.length ?? null,
        activeElementTag: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
        activeElementClass: document.activeElement instanceof HTMLElement ? document.activeElement.className : null,
        saveButton: saveButton
          ? {
              disabled: saveButton.disabled,
              text: saveButton.textContent?.trim() ?? '',
              rect: (() => {
                const rect = saveButton.getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
              })(),
            }
          : null,
        toolbarDebugState: (window as any).__vlainaE2E.getEditorToolbarDebugState(),
      };
    }, popupSelector);
    console.info('[notes-interaction-loop-popup-save-debug]', debugState);
    throw error;
  }
}

async function typeManualMathPopupSegment(
  page: import('@playwright/test').Page,
  parsed: ParsedManualMathSegment,
) {
  const beforeCount = await page.locator(`${LIVE_EDITOR_SELECTOR} div[data-type="math-block"]`).count();
  await startFreshManualInputBlock(page);
  await page.keyboard.type(parsed.marker, { delay: 0 });
  await waitForEditorAnimationFrame(page);
  await page.keyboard.press('Enter');

  const textarea = page.locator('.math-editor-popup textarea.text-editor-textarea').first();
  await expectTextEditorPopupTextareaVisible(page, textarea, 'math', parsed);
  await textarea.fill(parsed.body);
  await saveTextEditorPopup(page, '.math-editor-popup');
  await expect
    .poll(() => page.locator(`${LIVE_EDITOR_SELECTOR} div[data-type="math-block"]`).count(), {
      message: 'Expected saved manual math popup segment to create a math block',
    })
    .toBeGreaterThan(beforeCount);
  await focusEditorAtDocumentEnd(page);
}

async function typeManualMermaidPopupSegment(
  page: import('@playwright/test').Page,
  parsed: ParsedManualFenceSegment,
) {
  const beforeCount = await page.locator(`${LIVE_EDITOR_SELECTOR} div[data-type="mermaid"]`).count();
  await startFreshManualInputBlock(page);
  await page.keyboard.type(`${parsed.marker}${parsed.language}`, { delay: 0 });
  await waitForEditorAnimationFrame(page);
  await page.keyboard.press('Enter');

  const textarea = page.locator('.mermaid-editor-popup textarea.text-editor-textarea').first();
  await expectTextEditorPopupTextareaVisible(page, textarea, 'mermaid', parsed);
  await textarea.fill(parsed.body);
  await saveTextEditorPopup(page, '.mermaid-editor-popup');
  await expect
    .poll(() => page.locator(`${LIVE_EDITOR_SELECTOR} div[data-type="mermaid"]`).count(), {
      message: 'Expected saved manual Mermaid popup segment to create a diagram block',
    })
    .toBeGreaterThan(beforeCount);
  await focusEditorAtDocumentEnd(page);
}

async function typeManualSegmentByMode(
  page: import('@playwright/test').Page,
  segment: string,
  mode: ManualSegmentMode,
  detail: unknown,
) {
  if (mode === 'math-popup') {
    const parsed = parseManualMathSegment(segment);
    expect(parsed, `Expected math popup segment to parse: ${JSON.stringify(detail)}`).not.toBeNull();
    await typeManualMathPopupSegment(page, parsed!);
    return;
  }

  if (mode === 'mermaid-popup') {
    const parsed = parseManualFenceSegment(segment);
    expect(parsed, `Expected Mermaid popup segment to parse: ${JSON.stringify(detail)}`).not.toBeNull();
    await typeManualMermaidPopupSegment(page, parsed!);
    return;
  }

  await typeManualMainEditorSegment(page, segment, detail);
}

test.describe('notes sustained interaction loop performance', () => {
  test.setTimeout(600_000);

  test('loops manual syntax input, toolbar actions, copy paste, and editor scans without stalls', async () => {
    const manualMarkdown = await fs.readFile(MANUAL_MARKDOWN_PATH, 'utf8');
    const segments = createManualInteractionSegments(manualMarkdown, { limit: getSegmentLimit() });
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
        await ensureRoundTargetsAvailable(page, target);

        const roundSegments = getRoundManualSegments(segments, round, rounds);

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
          await expectEditorTextMark(
            page,
            target.strike,
            'strike_through',
            `${EDITOR_SELECTOR} s, ${EDITOR_SELECTOR} del, ${EDITOR_SELECTOR} strike`,
          );
        });

        await measureOperation(loopMetrics, round, 'toolbar-inline-code', async () => {
          await expectToolbarForSelection(page, target.inlineCode);
          await clickToolbarAction(page, 'code');
          await expectEditorTextMark(page, target.inlineCode, 'inlineCode', `${EDITOR_SELECTOR} code`);
        });

        await measureOperation(loopMetrics, round, 'keyboard-shortcuts', async () => {
          await expectToolbarForSelection(page, target.shortcut);
          await pressEditorShortcut(page, 'Control+B', target.shortcut);
          await expectEditorTextMark(page, target.shortcut, 'strong', `${EDITOR_SELECTOR} strong`);
          await expectToolbarForSelection(page, target.shortcut);
          await pressEditorShortcut(page, 'Control+I', target.shortcut);
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
          const input = page.locator('.link-tooltip-container textarea').first();
          await expect(input).toBeVisible({ timeout: 5_000 });
          await input.fill(url);
          await input.press('Enter');
          await waitForEditorAnimationFrame(page);
          await expect(page.locator(`${LIVE_EDITOR_SELECTOR} a[href="${url}"]`, { hasText: target.link })).toBeVisible();
        });

        await measureOperation(loopMetrics, round, 'toolbar-delete', async () => {
          const beforeDeleteCount = await countEditorTextOccurrences(page, target.delete);
          expect(beforeDeleteCount, `Expected delete target "${target.delete}" to exist before delete`).toBeGreaterThan(0);
          await expectToolbarForSelection(page, target.delete);
          await clickToolbarAction(page, 'delete');
          await expect
            .poll(() => countEditorTextOccurrences(page, target.delete), {
              message: `Expected delete action to remove one occurrence of "${target.delete}"`,
            })
            .toBeLessThan(beforeDeleteCount);
        });

        await measureOperation(loopMetrics, round, 'paste-markdown-fragment', async () => {
          await startFreshManualInputBlock(page);
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
          await startFreshManualInputBlock(page);
          await page.evaluate(async (text) => {
            await (window as any).__vlainaE2E.writeClipboardText(text);
          }, `\n${manualTableSegment}`);
          await page.keyboard.press('Control+V');
          await waitForEditorAnimationFrame(page);
          await expect(page.locator(`${EDITOR_SELECTOR} table`).first()).toBeVisible({ timeout: 10_000 });
        });

        for (const { sourceIndex, segment } of roundSegments) {
          const mode = getManualSegmentMode(segment);
          const detail = {
            index: sourceIndex,
            chars: segment.length,
            mode,
            startsWith: segment.trim().slice(0, 80),
          };
          await measureOperation(
            loopMetrics,
            round,
            `type-manual-segment-${mode}`,
            async () => {
              await typeManualSegmentByMode(page, segment, mode, detail);
            },
            detail,
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
          .filter((metric) => metric.operation.startsWith('type-manual-segment-'))
          .map((metric) => metric.durationMs),
      );
      const typedSegmentMetrics = loopMetrics.filter((metric) => metric.operation.startsWith('type-manual-segment-'));
      const typedSegmentCount = typedSegmentMetrics.length;
      const expectedTypedSegmentCount = getRoundManualSegmentCount(segments, rounds);
      const expectedMinEditorTextLength = Math.min(2_000, 1_200 + typedSegmentCount * 20);
      const typedSegmentCountsByMode = typedSegmentMetrics.reduce<Record<string, number>>((counts, metric) => {
        const mode = (metric.detail as { mode?: string } | undefined)?.mode ?? 'unknown';
        counts[mode] = (counts[mode] ?? 0) + 1;
        return counts;
      }, {});

      console.info('[notes-interaction-loop-performance]', {
        rounds,
        segmentCount: segments.length,
        typedSegmentCountsByMode,
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
      expect(domMetrics.editorTextLength).toBeGreaterThan(expectedMinEditorTextLength);
      expect(typedSegmentCount).toBe(expectedTypedSegmentCount);
      expect(new Set(
        typedSegmentMetrics
          .map((metric) => (metric.detail as { index?: number } | undefined)?.index)
          .filter((index): index is number => typeof index === 'number'),
      ).size).toBe(segments.length);
      expect(maxOperationMs).toBeLessThan(15_000);
      expect(maxTypingMs).toBeLessThan(12_000);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
