import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const CARET_OVERLAY_SELECTOR = '.editor-textblock-caret-overlay, .editor-forced-line-end-caret';
const ACTIVE_EDITOR_SELECTOR = `${EDITOR_SELECTOR}[contenteditable="true"]`;
const LINE_TEXT_SELECTOR = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'li > p',
  'blockquote p',
  'td',
  'th',
].join(', ');

type HorizontalClickMode = 'left-blank' | 'right-blank';

type LineTarget = {
  label: string;
  text: string;
};

function createRepresentativeLineAuditMarkdown(): string {
  return [
    '# Line audit heading target',
    '',
    'Line audit paragraph before blank target',
    '',
    'Line audit paragraph after blank target',
    '',
    '> Line audit quote target',
    '',
    '- Line audit bullet target',
    '  - Line audit nested bullet target',
    '',
    '1. Line audit ordered target',
    '   1. Line audit nested ordered target',
    '',
    '- [ ] Line audit task target',
    '  - [x] Line audit nested task target',
    '',
    'Line audit final sentinel must not receive markers.',
  ].join('\n');
}

function createWrappedLineAuditMarkdown(): string {
  return [
    '# Wrapped Line Audit',
    '',
    [
      'WRAP_AUDIT_START',
      'alpha alpha alpha alpha alpha alpha alpha alpha alpha alpha',
      'WRAP_AUDIT_MIDDLE_ONE',
      'beta beta beta beta beta beta beta beta beta beta beta beta',
      'WRAP_AUDIT_MIDDLE_TWO',
      'gamma gamma gamma gamma gamma gamma gamma gamma gamma gamma',
      'WRAP_AUDIT_END',
    ].join(' '),
    '',
    'Wrapped audit final sentinel must not receive markers.',
  ].join('\n');
}

function createRichLineAuditMarkdown(): string {
  return [
    '# Rich Line Audit',
    '',
    '| Key | Value |',
    '| --- | --- |',
    '| tableAuditCell | tableAuditValue |',
    '',
    '```ts',
    'const codeAuditOne = 1;',
    'const codeAuditTwo = 2;',
    '```',
    '',
    'Rich audit final sentinel must not receive markers.',
  ].join('\n');
}

async function clickRepresentativeLine(
  page: Page,
  target: LineTarget,
  mode: HorizontalClickMode,
): Promise<{
  x: number;
  y: number;
  lineText: string;
  elementTag: string;
  elementClass: string;
  elementRect: { left: number; top: number; right: number; bottom: number };
  checkboxBounds: { left: number; right: number } | null;
  hitTag: string | null;
  hitText: string | null;
}> {
  const scrolled = await page.locator(ACTIVE_EDITOR_SELECTOR).evaluate((editor, { selector, targetText }) => {
    const element = Array.from(editor.querySelectorAll<HTMLElement>(selector))
      .find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (candidate.textContent ?? '').includes(targetText);
      }) ?? null;
    element?.scrollIntoView({ block: 'center', inline: 'nearest' });
    return Boolean(element);
  }, { selector: LINE_TEXT_SELECTOR, targetText: target.text });
  expect(scrolled, `Expected scroll target for ${target.label} ${mode}`).toBe(true);
  await waitForEditorAnimationFrame(page);

  const point = await page.locator(ACTIVE_EDITOR_SELECTOR).evaluate((editor, { selector, targetText, mode }) => {

    const candidates = Array.from(editor.querySelectorAll<HTMLElement>(selector))
      .filter((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (candidate.textContent ?? '').includes(targetText);
      });
    const element = candidates[0] ?? null;
    if (!element) return null;

    const editorRect = editor.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    let x = mode === 'left-blank'
      ? Math.max(editorRect.left + 8, Math.min(rect.left - 8, editorRect.right - 8))
      : editorRect.right - 8;
    const taskItem = element.closest('li[data-item-type="task"]');
    let checkboxBounds: { left: number; right: number } | null = null;
    if (mode === 'left-blank' && taskItem instanceof HTMLElement) {
      const itemStyle = window.getComputedStyle(taskItem);
      const beforeStyle = window.getComputedStyle(taskItem, '::before');
      const gap = Number.parseFloat(itemStyle.columnGap || itemStyle.gap || '8') || 8;
      const checkboxSize = Number.parseFloat(beforeStyle.width || '') || 16;
      const checkboxRight = rect.left - gap;
      const checkboxLeft = checkboxRight - checkboxSize;
      checkboxBounds = { left: checkboxLeft, right: checkboxRight };
      x = Math.max(editorRect.left + 1, Math.min(rect.left - 1, checkboxRight + 7, editorRect.right - 8));
    }
    const y = rect.top + Math.min(rect.height - 2, Math.max(2, rect.height / 2));
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      lineText: element.textContent ?? '',
      elementTag: element.tagName,
      elementClass: element.className,
      elementRect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      checkboxBounds,
      hitTag: hit instanceof HTMLElement ? hit.tagName : null,
      hitText: hit instanceof HTMLElement ? hit.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? null : null,
    };
  }, { selector: LINE_TEXT_SELECTOR, targetText: target.text, mode });

  expect(point, `Expected click point for ${target.label} ${mode}`).not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
  await waitForEditorAnimationFrame(page);
  return point!;
}

async function expectMarkerInTargetLine(
  page: Page,
  target: LineTarget,
  marker: string,
  clickPoint?: unknown,
): Promise<void> {
  let latestDiagnostics: unknown = null;
  try {
    await expect.poll(async () => {
      latestDiagnostics = await page.locator(ACTIVE_EDITOR_SELECTOR).evaluate((editor, { selector, marker, targetText }) => {
        const hosts = Array.from(editor.querySelectorAll<HTMLElement>(selector))
          .filter((element) => (element.textContent ?? '').includes(marker))
          .map((element) => ({
            tagName: element.tagName,
            className: element.className,
            text: element.textContent ?? '',
            textWithoutMarker: (element.textContent ?? '').replace(marker, ''),
            closestListText: element.closest('li')?.textContent ?? null,
            closestListTextWithoutMarker: (element.closest('li')?.textContent ?? '').replace(marker, ''),
            closestQuoteText: element.closest('blockquote')?.textContent ?? null,
            closestQuoteTextWithoutMarker: (element.closest('blockquote')?.textContent ?? '').replace(marker, ''),
          }));
        const finalLineText = Array.from(editor.querySelectorAll<HTMLElement>('p'))
          .find((element) => element.textContent?.includes('final sentinel'))?.textContent ?? null;
        const selection = (window as any).__vlainaE2E.getEditorSelectionSummary();
        return {
          hosts,
          targetHostCount: hosts.filter((host) =>
            host.text.includes(targetText) ||
            host.textWithoutMarker.includes(targetText) ||
            host.closestListText?.includes(targetText) ||
            host.closestListTextWithoutMarker.includes(targetText) ||
            host.closestQuoteText?.includes(targetText) ||
            host.closestQuoteTextWithoutMarker.includes(targetText)
          ).length,
          finalLineText,
          selection,
        };
      }, { selector: LINE_TEXT_SELECTOR, marker, targetText: target.text });
      return latestDiagnostics;
    }, {
      message: `Expected ${marker} to stay in ${target.label}`,
      timeout: 10_000,
    }).toMatchObject({
      targetHostCount: 1,
      selection: {
        empty: true,
      },
    });
  } catch (error) {
    throw new Error([
      error instanceof Error ? error.message : String(error),
      `Click point for ${target.label}: ${JSON.stringify(clickPoint, null, 2)}`,
      `Latest line diagnostics for ${target.label}: ${JSON.stringify(latestDiagnostics, null, 2)}`,
    ].join('\n'));
  }

  const finalLineText = await page.locator(ACTIVE_EDITOR_SELECTOR).evaluate((editor, marker) => (
    Array.from(editor.querySelectorAll<HTMLElement>('p'))
      .find((element) => element.textContent?.includes('final sentinel'))?.textContent?.includes(marker) ?? false
  ), marker);
  expect(finalLineText, `Final sentinel must not receive ${marker}`).toBe(false);
}

async function expectVisibleCaret(page: Page, label: string): Promise<void> {
  await expect.poll(async () => page.evaluate((selector) => {
    const caret = document.querySelector<HTMLElement>(selector);
    const rect = caret?.getBoundingClientRect();
    const selection = (window as any).__vlainaE2E.getEditorSelectionSummary();
    return {
      visible: Boolean(rect && rect.width > 0 && rect.height > 0),
      selection,
    };
  }, CARET_OVERLAY_SELECTOR), {
    message: `Expected visible caret after clicking ${label}`,
    timeout: 5_000,
  }).toMatchObject({
    visible: true,
    selection: {
      empty: true,
    },
  });
}

async function getWrappedLineClickTarget(page: Page, lineIndex: number): Promise<{
  x: number;
  y: number;
  expectedOffset: number;
  expectedPos: number;
  lineCount: number;
  lineRect: { top: number; bottom: number; left: number; right: number };
} | null> {
  return page.locator(ACTIVE_EDITOR_SELECTOR).evaluate((editor, lineIndex) => {
    const paragraph = Array.from(editor.querySelectorAll<HTMLElement>('p'))
      .find((candidate) => candidate.textContent?.includes('WRAP_AUDIT_START')) ?? null;
    if (!paragraph) return null;
    paragraph.scrollIntoView({ block: 'center', inline: 'nearest' });

    const textNode = Array.from(paragraph.childNodes)
      .find((node): node is Text => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').includes('WRAP_AUDIT_START'));
    if (!textNode || !textNode.textContent) return null;

    const fullRange = document.createRange();
    fullRange.selectNodeContents(textNode);
    const lineRects = Array.from(fullRange.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      }));
    fullRange.detach();
    if (lineIndex < 0 || lineIndex >= lineRects.length) {
      return null;
    }

    const lineRect = lineRects[lineIndex]!;
    const editorRect = editor.getBoundingClientRect();
    const x = editorRect.right - 8;
    const y = (lineRect.top + lineRect.bottom) / 2;
    const bridge = (window as any).__vlainaE2E;
    const expectedPos = bridge.getEditorPositionAtPoint(x, y) as number | null;
    const textRange = bridge.getEditorTextRange('WRAP_AUDIT_START') as {
      from: number;
      to: number;
    } | null;
    if (expectedPos === null || textRange === null) return null;
    return {
      x,
      y,
      expectedOffset: expectedPos - textRange.from,
      expectedPos,
      lineCount: lineRects.length,
      lineRect,
    };
  }, lineIndex);
}

test.describe('notes line click input audit', () => {
  test.setTimeout(120_000);

  test('clicks representative markdown row blank areas and types into the clicked row', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-line-click-input-audit');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const targets: LineTarget[] = [
        { label: 'heading', text: 'Line audit heading target' },
        { label: 'paragraph before blank', text: 'Line audit paragraph before blank target' },
        { label: 'paragraph after blank', text: 'Line audit paragraph after blank target' },
        { label: 'blockquote paragraph', text: 'Line audit quote target' },
        { label: 'bullet list item', text: 'Line audit bullet target' },
        { label: 'nested bullet list item', text: 'Line audit nested bullet target' },
        { label: 'ordered list item', text: 'Line audit ordered target' },
        { label: 'nested ordered list item', text: 'Line audit nested ordered target' },
        { label: 'task list item', text: 'Line audit task target' },
        { label: 'nested task list item', text: 'Line audit nested task target' },
      ];

      for (const target of targets) {
        for (const mode of ['left-blank', 'right-blank'] as const) {
          await test.step(`${target.label} ${mode}`, async () => {
            await openMarkdownFixture(page, {
              filename: `line-click-${target.label.replace(/\W+/g, '-')}-${mode}.md`,
              content: createRepresentativeLineAuditMarkdown(),
            });

            const clickPoint = await clickRepresentativeLine(page, target, mode);
            await expectVisibleCaret(page, `${target.label} ${mode}`);
            const marker = `MARK_${target.label.replace(/\W+/g, '_')}_${mode.replace('-', '_')}`;
            await page.keyboard.type(marker);
            await waitForEditorAnimationFrame(page);
            await expectMarkerInTargetLine(page, target, marker, clickPoint);
          });
        }
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('clicks wrapped visual-line right blanks and types near that visual line end', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-wrapped-line-click-input-audit');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 760, height: 720 });

      for (const lineIndex of [0, 1, 2]) {
        await test.step(`wrapped visual line ${lineIndex + 1}`, async () => {
          await openMarkdownFixture(page, {
            filename: `wrapped-line-click-${lineIndex + 1}.md`,
            content: createWrappedLineAuditMarkdown(),
          });

          const clickTarget = await getWrappedLineClickTarget(page, lineIndex);
          expect(clickTarget, `Expected wrapped line ${lineIndex + 1}`).not.toBeNull();
          expect(clickTarget!.lineCount, 'Expected the audit paragraph to wrap to at least three visual lines')
            .toBeGreaterThanOrEqual(3);

          const marker = `WRAP_MARK_${lineIndex + 1}`;
          const focused = await page.evaluate(({ x, y }) => (
            (window as any).__vlainaE2E.focusEditorAtPoint(x, y)
          ), clickTarget!);
          expect(focused, { clickTarget }).toBe(true);
          const focusedSelection = await page.evaluate(() => (
            (window as any).__vlainaE2E.getEditorSelectionSummary()
          ));
          expect(focusedSelection, { clickTarget }).toMatchObject({
            empty: true,
            from: clickTarget!.expectedPos,
            to: clickTarget!.expectedPos,
          });

          await page.mouse.click(clickTarget!.x, clickTarget!.y);
          await expectVisibleCaret(page, `wrapped visual line ${lineIndex + 1}`);
          const selection = await page.evaluate(() => (
            (window as any).__vlainaE2E.getEditorSelectionSummary()
          ));
          expect(selection, { clickTarget }).toMatchObject({
            empty: true,
            from: clickTarget!.expectedPos,
            to: clickTarget!.expectedPos,
          });
          await page.keyboard.type(marker);
          await waitForEditorAnimationFrame(page);

          const result = await page.locator(ACTIVE_EDITOR_SELECTOR).evaluate((editor, { marker }) => {
            const paragraph = Array.from(editor.querySelectorAll<HTMLElement>('p'))
              .find((candidate) => candidate.textContent?.includes('WRAP_AUDIT_START')) ?? null;
            const text = paragraph?.textContent ?? '';
            const finalLineText = Array.from(editor.querySelectorAll<HTMLElement>('p'))
              .find((candidate) => candidate.textContent?.includes('final sentinel'))?.textContent ?? '';
            return {
              markerIndex: text.indexOf(marker),
              paragraphText: text,
              finalHasMarker: finalLineText.includes(marker),
            };
          }, { marker });

          expect(result.markerIndex, { clickTarget, result }).toBeGreaterThanOrEqual(0);
          expect(result.markerIndex, { clickTarget, result }).toBe(clickTarget!.expectedOffset);
          expect(result.finalHasMarker, { clickTarget, result }).toBe(false);
        });
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('clicks table and code lines and accepts typing in place', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-rich-line-click-input-audit');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'rich-line-click-input-audit.md',
        content: createRichLineAuditMarkdown(),
      });

      const tableCell = page.locator(`${ACTIVE_EDITOR_SELECTOR} td`, { hasText: 'tableAuditCell' }).first();
      await expect(tableCell).toBeVisible({ timeout: 30_000 });
      const tableBox = await tableCell.boundingBox();
      expect(tableBox).not.toBeNull();
      await page.mouse.click(tableBox!.x + tableBox!.width - 8, tableBox!.y + tableBox!.height / 2);
      await page.keyboard.type('TABLE_MARK');
      await waitForEditorAnimationFrame(page);
      await expect(tableCell).toContainText('TABLE_MARK');

      const codeLine = page.locator(`${ACTIVE_EDITOR_SELECTOR} .cm-line`, { hasText: 'codeAuditTwo' }).first();
      await expect(codeLine).toBeVisible({ timeout: 30_000 });
      const codeBox = await codeLine.boundingBox();
      expect(codeBox).not.toBeNull();
      await page.mouse.click(codeBox!.x + codeBox!.width - 4, codeBox!.y + codeBox!.height / 2);
      await page.keyboard.type('CODE_MARK');
      await waitForEditorAnimationFrame(page);
      await expect(codeLine).toContainText('CODE_MARK');

      const finalHasMarker = await page.locator(ACTIVE_EDITOR_SELECTOR).evaluate((editor) => {
        const finalLine = Array.from(editor.querySelectorAll<HTMLElement>('p'))
          .find((candidate) => candidate.textContent?.includes('final sentinel'))?.textContent ?? '';
        return finalLine.includes('TABLE_MARK') || finalLine.includes('CODE_MARK');
      });
      expect(finalHasMarker).toBe(false);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
