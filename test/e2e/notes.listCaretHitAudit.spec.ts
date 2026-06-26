import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

type CaretTarget = {
  label: string;
  text: string;
  offset: number;
  insertedText: string;
  expectedText: string;
};

const CARET_OVERLAY_SELECTOR = '.editor-textblock-caret-overlay, .editor-forced-line-end-caret';

function createCaretAuditMarkdown(): string {
  return [
    '# Caret Hit Audit',
    '',
    'Paragraph middle pa and paragraph end pe',
    '',
    '1. Ordered middle oa and ordered end oe',
    '   1. Nested ordered middle 23',
    '   2. Nested ordered end 45',
    '      1. Deep ordered middle do and deep ordered end dp',
    '   3. Nested ordered bold **ob** and italic *oi* and code `oc` and link [ol](https://example.com)',
    '',
    '- Bullet middle bu and bullet end be',
    '  - Nested bullet middle nb and nested bullet end ne',
    '    - Deep bullet middle db and deep bullet end dd',
    '  - Nested bullet bold **bb** and italic *bi* and code `bc` and link [bl](https://example.com)',
    '- [ ] Task middle ta and task end te',
    '  - [ ] Nested task middle nt and nested task end nz',
    '    - [ ] Deep nested task middle dt and deep nested task end dz',
  ].join('\n');
}

async function resolveTextClickPoint(
  page: Page,
  target: Pick<CaretTarget, 'text' | 'offset' | 'label'>,
): Promise<{ x: number; y: number; hitText: string | null } | null> {
  return page.evaluate(({ editorSelector, text, offset }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) return null;

    const resolveCaretRange = (x: number, y: number): Range | null => {
      const doc = editor.ownerDocument as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      };
      const position = doc.caretPositionFromPoint?.(x, y);
      if (position) {
        const range = doc.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
        return range;
      }
      return doc.caretRangeFromPoint?.(x, y) ?? null;
    };

    const resolveCharRect = (node: Text, absoluteOffset: number): DOMRect | null => {
      if (absoluteOffset < 0 || absoluteOffset >= node.length) return null;
      const range = editor.ownerDocument.createRange();
      range.setStart(node, absoluteOffset);
      range.setEnd(node, absoluteOffset + 1);
      const rect = range.getBoundingClientRect();
      range.detach();
      return rect.width > 0 && rect.height > 0 ? rect : null;
    };

    const walker = editor.ownerDocument.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const value = node.textContent ?? '';
        if (!value.includes(text)) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (parent?.closest('[contenteditable="false"]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!(node instanceof Text)) continue;
      const value = node.textContent ?? '';
      const index = value.indexOf(text);
      if (index < 0) continue;

      const desiredOffset = index + offset;
      const previousRect = resolveCharRect(node, Math.max(index, desiredOffset - 1));
      const nextRect = resolveCharRect(node, Math.min(index + text.length - 1, desiredOffset));
      const anchorRect = nextRect ?? previousRect;
      if (!anchorRect) continue;

      const y = anchorRect.top + anchorRect.height / 2;
      const boundaryX = offset >= text.length
        ? (previousRect?.right ?? anchorRect.right)
        : offset <= 0
          ? (nextRect?.left ?? anchorRect.left)
          : ((previousRect?.right ?? anchorRect.left) + (nextRect?.left ?? anchorRect.right)) / 2;
      const samples = offset >= text.length
        ? [boundaryX + 1, boundaryX + 3, boundaryX - 0.5, boundaryX + 6]
        : [
          previousRect ? previousRect.right - Math.min(1, Math.max(0.25, previousRect.width / 4)) : boundaryX,
          nextRect ? nextRect.left + Math.min(1, Math.max(0.25, nextRect.width / 4)) : boundaryX,
          boundaryX,
          boundaryX - 1,
          boundaryX + 1,
        ];

      for (const x of samples) {
        const range = resolveCaretRange(x, y);
        const matched = range?.startContainer === node && range.startOffset === desiredOffset;
        range?.detach();
        if (matched) {
          const hit = editor.ownerDocument.elementFromPoint(x, y);
          return {
            x: Math.round(x),
            y: Math.round(y),
            hitText: hit instanceof HTMLElement ? hit.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? null : null,
          };
        }
      }

      const fallbackX = samples[0];
      const hit = editor.ownerDocument.elementFromPoint(fallbackX, y);
      return {
        x: Math.round(fallbackX),
        y: Math.round(y),
        hitText: hit instanceof HTMLElement ? hit.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? null : null,
      };
    }

    return null;
  }, { editorSelector: EDITOR_SELECTOR, text: target.text, offset: target.offset });
}

async function resolveTextDragPoint(
  page: Page,
  text: string,
  offset: number,
  edge: 'start' | 'end',
): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(({ editorSelector, edge, offset, text }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) return null;

    const walker = editor.ownerDocument.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const value = node.textContent ?? '';
        if (!value.includes(text)) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (parent?.closest('[contenteditable="false"]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!(node instanceof Text)) continue;
      const index = node.textContent?.indexOf(text) ?? -1;
      if (index < 0) continue;

      const charOffset = Math.max(0, Math.min(text.length - 1, offset));
      const range = editor.ownerDocument.createRange();
      range.setStart(node, index + charOffset);
      range.setEnd(node, index + charOffset + 1);
      const rect = range.getBoundingClientRect();
      range.detach();
      if (rect.width <= 0 || rect.height <= 0) continue;

      return {
        x: edge === 'end'
          ? rect.right - Math.max(1, Math.min(4, rect.width / 3))
          : rect.left + Math.max(1, Math.min(4, rect.width / 3)),
        y: rect.top + rect.height / 2,
      };
    }

    return null;
  }, { editorSelector: EDITOR_SELECTOR, edge, offset, text });

  expect(point, `Expected a drag point for "${text}"`).not.toBeNull();
  return point!;
}

async function clickTextOffset(
  page: Page,
  target: Pick<CaretTarget, 'text' | 'offset' | 'label'>,
): Promise<{ x: number; y: number; hitText: string | null }> {
  const point = await resolveTextClickPoint(page, target);
  expect(point, `Expected a clickable text point for ${target.label}`).not.toBeNull();

  await page.mouse.click(point!.x, point!.y);
  await waitForEditorAnimationFrame(page);
  return point!;
}

async function expectVisibleCollapsedCaret(
  page: Page,
  label: string,
  point: { x: number; y: number },
): Promise<void> {
  let latestDiagnostics: unknown = null;
  try {
    await expect.poll(async () => {
      latestDiagnostics = await page.evaluate(({ editorSelector, overlaySelector, clickPoint }) => {
        const editor = document.querySelector<HTMLElement>(editorSelector);
        const overlay = document.querySelector<HTMLElement>(overlaySelector);
        const rect = overlay?.getBoundingClientRect();
        const selection = (window as any).__vlainaE2E.getEditorSelectionSummary();
        const activeElement = document.activeElement;
        const hitElement = document.elementFromPoint(clickPoint.x, clickPoint.y);

        return {
          empty: selection?.empty ?? false,
          selectedText: selection?.selectedText ?? '',
          hasFocus: document.activeElement === editor,
          activeTagName: activeElement instanceof HTMLElement ? activeElement.tagName : null,
          activeClassName: activeElement instanceof HTMLElement ? activeElement.className : null,
          hitAfterClick: hitElement instanceof HTMLElement
            ? {
              tagName: hitElement.tagName,
              className: hitElement.className,
              text: hitElement.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? '',
            }
            : null,
          selectedBlocks: editor?.querySelectorAll('.editor-block-selected').length ?? -1,
          overlayCount: document.querySelectorAll(overlaySelector).length,
          overlayHasGeometry: Boolean(rect && rect.width > 0 && rect.height > 0),
        };
      }, { editorSelector: EDITOR_SELECTOR, overlaySelector: CARET_OVERLAY_SELECTOR, clickPoint: point });
      return latestDiagnostics;
    }, {
      message: `Expected a visible collapsed caret after clicking ${label}`,
      timeout: 5_000,
    }).toMatchObject({
      empty: true,
      selectedText: '',
      hasFocus: true,
      selectedBlocks: 0,
      overlayCount: 1,
      overlayHasGeometry: true,
    });
  } catch (error) {
    throw new Error([
      error instanceof Error ? error.message : String(error),
      `Latest caret diagnostics for ${label}: ${JSON.stringify(latestDiagnostics, null, 2)}`,
    ].join('\n'));
  }
}

async function expectCaretOverlayNearClickPoint(
  page: Page,
  label: string,
  point: { x: number; y: number },
): Promise<void> {
  let latestDiagnostics: unknown = null;
  try {
    await expect.poll(async () => {
      latestDiagnostics = await page.evaluate(({ editorSelector, overlaySelector, clickPoint }) => {
        const editor = document.querySelector<HTMLElement>(editorSelector);
        const overlay = document.querySelector<HTMLElement>(overlaySelector);
        const rect = overlay?.getBoundingClientRect();
        const selection = (window as any).__vlainaE2E.getEditorSelectionSummary();
        const caretCenterX = rect ? rect.left + rect.width / 2 : null;
        const caretCenterY = rect ? rect.top + rect.height / 2 : null;

        return {
          empty: selection?.empty ?? false,
          selectedText: selection?.selectedText ?? '',
          hasFocus: document.activeElement === editor,
          selectedBlocks: editor?.querySelectorAll('.editor-block-selected').length ?? -1,
          overlayCount: document.querySelectorAll(overlaySelector).length,
          overlayHasGeometry: Boolean(rect && rect.width > 0 && rect.height > 0),
          xDistance: caretCenterX === null ? Number.POSITIVE_INFINITY : Math.abs(caretCenterX - clickPoint.x),
          yDistance: caretCenterY === null ? Number.POSITIVE_INFINITY : Math.abs(caretCenterY - clickPoint.y),
        };
      }, { editorSelector: EDITOR_SELECTOR, overlaySelector: CARET_OVERLAY_SELECTOR, clickPoint: point });
      return latestDiagnostics;
    }, {
      message: `Expected caret to stay near the clicked nested list point for ${label}`,
      timeout: 5_000,
    }).toMatchObject({
      empty: true,
      selectedText: '',
      hasFocus: true,
      selectedBlocks: 0,
      overlayCount: 1,
      overlayHasGeometry: true,
      xDistance: expect.any(Number),
      yDistance: expect.any(Number),
    });

    const diagnostics = latestDiagnostics as { xDistance?: number; yDistance?: number } | null;
    expect(diagnostics?.xDistance, `Caret jumped horizontally away from ${label}: ${JSON.stringify(latestDiagnostics, null, 2)}`).toBeLessThanOrEqual(24);
    expect(diagnostics?.yDistance, `Caret jumped vertically away from ${label}: ${JSON.stringify(latestDiagnostics, null, 2)}`).toBeLessThanOrEqual(24);
  } catch (error) {
    throw new Error([
      error instanceof Error ? error.message : String(error),
      `Latest no-jump caret diagnostics for ${label}: ${JSON.stringify(latestDiagnostics, null, 2)}`,
    ].join('\n'));
  }
}

async function assertMouseDownKeepsCaretAtTarget(
  page: Page,
  target: Pick<CaretTarget, 'text' | 'offset' | 'label'>,
): Promise<void> {
  const point = await resolveTextClickPoint(page, target);
  expect(point, `Expected a clickable text point for ${target.label}`).not.toBeNull();

  await page.mouse.move(point!.x, point!.y);
  await page.mouse.down();
  await waitForEditorAnimationFrame(page);
  await expectCaretOverlayNearClickPoint(page, target.label, point!);
  await page.mouse.up();
  await waitForEditorAnimationFrame(page);
  await expectCaretOverlayNearClickPoint(page, target.label, point!);
}

async function resolveTaskCheckboxPoint(
  page: Page,
  text: string,
): Promise<{ x: number; y: number; checked: string | null } | null> {
  return page.evaluate(({ editorSelector, text }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) return null;

    const taskItem = Array.from(editor.querySelectorAll<HTMLElement>('li[data-item-type="task"]'))
      .find((item) => {
        const directTextBlock = item.querySelector<HTMLElement>(':scope > [data-text-align], :scope > p');
        return directTextBlock?.textContent?.includes(text);
      });
    if (!taskItem) return null;

    const textBlock = taskItem.querySelector<HTMLElement>(':scope > [data-text-align], :scope > p');
    if (!textBlock) return null;

    const textRect = textBlock.getBoundingClientRect();
    const itemStyle = window.getComputedStyle(taskItem);
    const beforeStyle = window.getComputedStyle(taskItem, '::before');
    const gap = Number.parseFloat(itemStyle.columnGap || itemStyle.gap || '8') || 8;
    const checkboxSize = Number.parseFloat(beforeStyle.width || '') || 16;
    const right = textRect.left - gap;
    const left = right - checkboxSize;

    return {
      x: Math.round((left + right) / 2),
      y: Math.round(textRect.top + textRect.height / 2),
      checked: taskItem.dataset.checked ?? null,
    };
  }, { editorSelector: EDITOR_SELECTOR, text });
}

async function assertTaskCheckboxToggles(page: Page, text: string): Promise<void> {
  const point = await resolveTaskCheckboxPoint(page, text);
  expect(point, `Expected a checkbox click point for task item "${text}"`).not.toBeNull();

  await page.mouse.click(point!.x, point!.y);
  await waitForEditorAnimationFrame(page);

  await expect.poll(async () => page.locator(`${EDITOR_SELECTOR} li[data-item-type="task"]`, { hasText: text }).evaluateAll((items, taskText) => {
    const matchedItem = items.find((item) => {
      const directTextBlock = item.querySelector(':scope > [data-text-align], :scope > p');
      return directTextBlock?.textContent?.includes(taskText);
    }) as HTMLElement | undefined;
    return matchedItem?.dataset.checked ?? null;
  }, text), {
    message: `Expected task checkbox for "${text}" to toggle`,
    timeout: 5_000,
  }).toBe(point!.checked === 'true' ? 'false' : 'true');
}

async function assertClickInsertsAtTarget(page: Page, target: CaretTarget): Promise<void> {
  const point = await clickTextOffset(page, target);
  await expectVisibleCollapsedCaret(page, target.label, point);
  await page.keyboard.type(target.insertedText);
  await waitForEditorAnimationFrame(page);

  await expect.poll(async () => page.locator(EDITOR_SELECTOR).evaluate((editor) => editor.textContent ?? ''), {
    message: `Expected typing after ${target.label} to edit the clicked text`,
    timeout: 5_000,
  }).toContain(target.expectedText);
  await expect(page.locator(`${EDITOR_SELECTOR} .editor-block-selected`)).toHaveCount(0);
}

test.describe('notes list caret hit audit', () => {
  test.setTimeout(120_000);

  test('keeps the caret visible and editable for character and line-end clicks across list shapes', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-list-caret-hit-audit');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.show();
        win?.focus();
      });

      await openMarkdownFixture(page, {
        filename: 'list-caret-hit-audit-e2e.md',
        content: createCaretAuditMarkdown(),
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Nested ordered middle 23');

      await assertTaskCheckboxToggles(page, 'Task middle ta and task end te');
      await assertTaskCheckboxToggles(page, 'Nested task middle nt and nested task end nz');
      await assertTaskCheckboxToggles(page, 'Deep nested task middle dt and deep nested task end dz');

      const nestedNoJumpTargets: Array<Pick<CaretTarget, 'text' | 'offset' | 'label'>> = [
        { label: 'nested ordered mousedown middle from user report', text: '23', offset: 1 },
        { label: 'nested ordered mousedown line end from user report', text: '45', offset: 2 },
        { label: 'deep nested ordered mousedown middle', text: 'do', offset: 1 },
        { label: 'nested ordered bold mousedown middle', text: 'ob', offset: 1 },
        { label: 'nested ordered italic mousedown middle', text: 'oi', offset: 1 },
        { label: 'nested ordered code mousedown middle', text: 'oc', offset: 1 },
        { label: 'nested ordered link mousedown middle', text: 'ol', offset: 1 },
        { label: 'nested bullet mousedown middle', text: 'nb', offset: 1 },
        { label: 'nested bullet mousedown line end', text: 'ne', offset: 2 },
        { label: 'deep nested bullet mousedown middle', text: 'db', offset: 1 },
        { label: 'nested bullet bold mousedown middle', text: 'bb', offset: 1 },
        { label: 'nested bullet italic mousedown middle', text: 'bi', offset: 1 },
        { label: 'nested bullet code mousedown middle', text: 'bc', offset: 1 },
        { label: 'nested bullet link mousedown middle', text: 'bl', offset: 1 },
        { label: 'nested task mousedown middle', text: 'nt', offset: 1 },
        { label: 'nested task mousedown line end', text: 'nz', offset: 2 },
        { label: 'deep nested task mousedown middle', text: 'dt', offset: 1 },
        { label: 'deep nested task mousedown line end', text: 'dz', offset: 2 },
      ];

      for (const target of nestedNoJumpTargets) {
        await assertMouseDownKeepsCaretAtTarget(page, target);
      }

      const targets: CaretTarget[] = [
        { label: 'nested ordered middle from user report', text: '23', offset: 1, insertedText: 'N', expectedText: '2N3' },
        { label: 'nested ordered line end from user report', text: '45', offset: 2, insertedText: 'S', expectedText: '45S' },
        { label: 'deep nested ordered middle', text: 'do', offset: 1, insertedText: 'D', expectedText: 'dDo' },
        { label: 'deep nested ordered line end', text: 'dp', offset: 2, insertedText: 'E', expectedText: 'dpE' },
        { label: 'nested ordered bold middle', text: 'ob', offset: 1, insertedText: 'F', expectedText: 'oFb' },
        { label: 'nested ordered italic middle', text: 'oi', offset: 1, insertedText: 'G', expectedText: 'oGi' },
        { label: 'nested ordered code middle', text: 'oc', offset: 1, insertedText: 'H', expectedText: 'oHc' },
        { label: 'nested ordered link middle', text: 'ol', offset: 1, insertedText: 'I', expectedText: 'oIl' },
        { label: 'paragraph middle', text: 'pa', offset: 1, insertedText: 'P', expectedText: 'pPa' },
        { label: 'paragraph line end', text: 'pe', offset: 2, insertedText: 'Q', expectedText: 'peQ' },
        { label: 'top-level ordered middle', text: 'oa', offset: 1, insertedText: 'O', expectedText: 'oOa' },
        { label: 'top-level ordered line end', text: 'oe', offset: 2, insertedText: 'R', expectedText: 'oeR' },
        { label: 'top-level bullet middle', text: 'bu', offset: 1, insertedText: 'B', expectedText: 'bBu' },
        { label: 'top-level bullet line end', text: 'be', offset: 2, insertedText: 'T', expectedText: 'beT' },
        { label: 'nested bullet middle', text: 'nb', offset: 1, insertedText: 'U', expectedText: 'nUb' },
        { label: 'nested bullet line end', text: 'ne', offset: 2, insertedText: 'V', expectedText: 'neV' },
        { label: 'deep nested bullet middle', text: 'db', offset: 1, insertedText: 'J', expectedText: 'dJb' },
        { label: 'deep nested bullet line end', text: 'dd', offset: 2, insertedText: 'K', expectedText: 'ddK' },
        { label: 'nested bullet bold middle', text: 'bb', offset: 1, insertedText: 'L', expectedText: 'bLb' },
        { label: 'nested bullet italic middle', text: 'bi', offset: 1, insertedText: 'M', expectedText: 'bMi' },
        { label: 'nested bullet code middle', text: 'bc', offset: 1, insertedText: 'A', expectedText: 'bAc' },
        { label: 'nested bullet link middle', text: 'bl', offset: 1, insertedText: 'C', expectedText: 'bCl' },
        { label: 'task list middle', text: 'ta', offset: 1, insertedText: 'W', expectedText: 'tWa' },
        { label: 'task list line end', text: 'te', offset: 2, insertedText: 'X', expectedText: 'teX' },
        { label: 'nested task middle', text: 'nt', offset: 1, insertedText: 'Y', expectedText: 'nYt' },
        { label: 'nested task line end', text: 'nz', offset: 2, insertedText: 'Z', expectedText: 'nzZ' },
        { label: 'deep nested task middle', text: 'dt', offset: 1, insertedText: 'R', expectedText: 'dRt' },
        { label: 'deep nested task line end', text: 'dz', offset: 2, insertedText: 'B', expectedText: 'dzB' },
      ];

      for (const target of targets) {
        await assertClickInsertsAtTarget(page, target);
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('allows mouse-drag text selection across nested list items', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-nested-list-drag-text-selection');
    const sourceText = 'Nested drag source line edge';
    const targetText = 'Nested drag target selectable sentinel text';

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'nested-list-drag-text-selection.md',
        content: [
          '# Nested List Drag Text Selection',
          '',
          '- Parent drag list',
          `  - ${sourceText}`,
          `  - ${targetText}`,
          '- After nested drag list',
        ].join('\n'),
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText(targetText);

      const start = await resolveTextDragPoint(page, sourceText, sourceText.length - 1, 'end');
      const end = await resolveTextDragPoint(page, targetText, targetText.length - 1, 'end');
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 18 });
      await page.mouse.up();
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => page.evaluate(() =>
        (window as any).__vlainaE2E.getEditorSelectionSummary()
      ), {
        message: JSON.stringify({ start, end }),
      }).toMatchObject({
        empty: false,
        selectedText: expect.stringContaining('Nested drag target selectable sentinel'),
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
