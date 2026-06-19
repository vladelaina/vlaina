import { expect, test } from "@playwright/test";
import {
  BLOCK_CONTROLS_SELECTOR,
  EDITOR_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  getBlankAreaDragTarget,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from "./notesE2E";
import { expectDragSourceSelectionSurface, measureSelectedSurfaceCoverage } from "./notesBlockSelectionDragHelpers";
import {
  openBlockSelectionFixture,
  expectSelectedParagraphs,
  selectNoteBlocksByMatchers,
  moveMouseToBlockHandleGutter,
  measureCollapseToggleClearance,
} from "./notesBlockSelectionShared";

test.describe("notes block selection", () => {
  test.setTimeout(90_000);

  test('keeps selected markdown blank-line rows on the same visual rhythm as text rows', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-blank-line-rhythm');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await openMarkdownFixture(page, {
        filename: 'block-selection-blank-line-rhythm.md',
        content: ['1', '', '2'].join('\n'),
      });

      const selectableBlocks = await page.evaluate(() => (window as any).__vlainaE2E.getNoteSelectableBlocks());
      expect(selectableBlocks.map((block: { text: string }) => block.text)).toEqual(['1', '', '2']);

      const selectedCount = await page.evaluate(async () => {
        const count = await (window as any).__vlainaE2E.selectNoteBlocksByIndexes([0, 1, 2]);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return count;
      });
      expect(selectedCount).toBe(3);

      const geometry = await page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        if (!editor) return null;

        const parsePx = (value: string, fallback = 0) => {
          const parsed = Number.parseFloat(value);
          return Number.isFinite(parsed) ? parsed : fallback;
        };
        const resolvePaintRect = (element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          const after = getComputedStyle(element, '::after');
          if (after.content !== 'none' && after.display !== 'none' && after.position === 'absolute') {
            return {
              top: rect.top + parsePx(after.top),
              bottom: rect.bottom - parsePx(after.bottom),
              height: rect.height - parsePx(after.top) - parsePx(after.bottom),
            };
          }

          return {
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
          };
        };

        const rows = Array.from(editor.children)
          .filter((element): element is HTMLElement =>
            element instanceof HTMLElement && element.classList.contains('editor-block-selected')
          )
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const paint = resolvePaintRect(element);
            const style = getComputedStyle(element);
            const after = getComputedStyle(element, '::after');
            return {
              tagName: element.tagName,
              text: element.textContent?.trim() ?? '',
              className: element.className,
              rectTop: Math.round(rect.top * 100) / 100,
              rectBottom: Math.round(rect.bottom * 100) / 100,
              rectHeight: Math.round(rect.height * 100) / 100,
              paintTop: Math.round(paint.top * 100) / 100,
              paintBottom: Math.round(paint.bottom * 100) / 100,
              paintHeight: Math.round(paint.height * 100) / 100,
              marginTop: style.marginTop,
              marginBottom: style.marginBottom,
              minHeight: style.minHeight,
              lineHeight: style.lineHeight,
              afterTop: after.top,
              afterBottom: after.bottom,
            };
          })
          .sort((left, right) => left.rectTop - right.rectTop);

        const rectTopDeltas = rows.slice(1).map((row, index) => (
          Math.round((row.rectTop - rows[index].rectTop) * 100) / 100
        ));
        const paintGaps = rows.slice(1).map((row, index) => (
          Math.round((row.paintTop - rows[index].paintBottom) * 100) / 100
        ));

        return { rows, rectTopDeltas, paintGaps };
      });

      expect(geometry).not.toBeNull();
      expect(geometry!.rows, JSON.stringify(geometry, null, 2)).toHaveLength(3);
      expect(Math.abs(geometry!.rectTopDeltas[0] - geometry!.rectTopDeltas[1]), JSON.stringify(geometry, null, 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry!.paintGaps[0] - geometry!.paintGaps[1]), JSON.stringify(geometry, null, 2)).toBeLessThanOrEqual(1);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps a visible gap between a hard-break paragraph line and the following blank-line block', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-hard-break-blank-gap');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await openMarkdownFixture(page, {
        filename: 'block-selection-hard-break-blank-gap.md',
        content: [
          '18\\. 在两个公式或图标中怎么插入空行\\',
          '1\\. 然后箭头的移动应该选中',
          '',
          'after gap sentinel',
        ].join('\n'),
      });

      const selectableBlocks = await page.evaluate(() => (window as any).__vlainaE2E.getNoteSelectableBlocks());
      expect(selectableBlocks.length, JSON.stringify(selectableBlocks, null, 2)).toBeGreaterThanOrEqual(4);

      const selectedCount = await page.evaluate(async () => {
        const count = await (window as any).__vlainaE2E.selectNoteBlocksByIndexes([0, 1, 2]);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return count;
      });
      expect(selectedCount).toBe(3);

      const geometry = await page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        if (!editor) return null;

        const parsePx = (value: string, fallback = 0) => {
          const parsed = Number.parseFloat(value);
          return Number.isFinite(parsed) ? parsed : fallback;
        };
        const resolvePaintRect = (element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          const after = getComputedStyle(element, '::after');
          if (after.content !== 'none' && after.display !== 'none' && after.position === 'absolute') {
            return {
              top: rect.top + parsePx(after.top),
              bottom: rect.bottom - parsePx(after.bottom),
            };
          }

          return {
            top: rect.top,
            bottom: rect.bottom,
          };
        };

        const lineFills = Array.from(document.querySelectorAll<HTMLElement>('.editor-block-selection-line-fill'))
          .map((fill) => {
            const rect = fill.getBoundingClientRect();
            return {
              top: rect.top,
              bottom: rect.bottom,
              centerY: rect.top + rect.height / 2,
            };
          })
          .filter((rect) => rect.bottom > rect.top);

        const rows = Array.from(editor.querySelectorAll<HTMLElement>('.editor-block-selected'))
          .filter((element) => !element.classList.contains('editor-block-selected-parent-marker'))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const paint = resolvePaintRect(element);
            const matchingFills = lineFills.filter((fill) => (
              fill.centerY >= rect.top - 2 &&
              fill.centerY <= rect.bottom + 2
            ));
            return {
              tagName: element.tagName,
              text: element.textContent?.trim() ?? '',
              className: element.className,
              rectTop: Math.round(rect.top * 100) / 100,
              rectBottom: Math.round(rect.bottom * 100) / 100,
              visualTop: Math.round(Math.min(paint.top, ...matchingFills.map((fill) => fill.top)) * 100) / 100,
              visualBottom: Math.round(Math.max(paint.bottom, ...matchingFills.map((fill) => fill.bottom)) * 100) / 100,
              matchingFillCount: matchingFills.length,
            };
          })
          .sort((left, right) => left.rectTop - right.rectTop);

        const visualGaps = rows.slice(1).map((row, index) => (
          Math.round((row.visualTop - rows[index].visualBottom) * 100) / 100
        ));
        const penultimateToLastGap = visualGaps.length >= 2 ? visualGaps[1] : null;

        return { rows, lineFills, penultimateToLastGap, visualGaps };
      });

      expect(geometry).not.toBeNull();
      expect(geometry!.rows, JSON.stringify(geometry, null, 2)).toHaveLength(3);
      expect(geometry!.rows[1].text, JSON.stringify(geometry, null, 2)).toContain('箭头的移动应该选中');
      expect(geometry!.visualGaps, JSON.stringify(geometry, null, 2)).toHaveLength(2);
      for (const gap of geometry!.visualGaps) {
        expect(gap, JSON.stringify(geometry, null, 2)).toBeGreaterThan(0.5);
      }
      expect(geometry!.penultimateToLastGap, JSON.stringify(geometry, null, 2)).toBeGreaterThan(0.5);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps bold labels visible inside selected hard-break credential lines', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-bold-label-visibility');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await openMarkdownFixture(page, {
        filename: 'block-selection-bold-label-visibility.md',
        content: [
          '**网址：** [https ://nerdvm.racknerd.com/](https://nerdvm.racknerd.com/)\\',
          '**用户名：** vmuser262577\\',
          '',
          'after credential sentinel',
        ].join('\n'),
      });
      await page.addStyleTag({
        content: `
          .milkdown .ProseMirror strong * {
            color: transparent !important;
            -webkit-text-fill-color: transparent !important;
          }
        `,
      });

      const selectedCount = await page.evaluate(async () => {
        const count = await (window as any).__vlainaE2E.selectNoteBlocksByIndexes([0, 1]);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return count;
      });
      expect(selectedCount).toBe(2);

      const report = await page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        const selected = editor ? Array.from(editor.querySelectorAll<HTMLElement>('.editor-block-selected')) : [];
        const labels = selected
          .filter((element) => /网址|用户名/.test(element.textContent ?? ''))
          .map((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return {
              text: element.textContent ?? '',
              className: element.className,
              color: style.color,
              display: style.display,
              fontSize: style.fontSize,
              opacity: style.opacity,
              textFillColor: style.getPropertyValue('-webkit-text-fill-color'),
              visibility: style.visibility,
              width: Math.round(rect.width * 100) / 100,
              height: Math.round(rect.height * 100) / 100,
            };
          });
        return {
          labels,
          selectedCount: selected.length,
          selectedText: selected.map((element) => element.textContent ?? ''),
        };
      });

      expect(report.labels, JSON.stringify(report, null, 2)).toHaveLength(2);
      for (const label of report.labels) {
        expect(label.width, JSON.stringify(report, null, 2)).toBeGreaterThan(1);
        expect(label.height, JSON.stringify(report, null, 2)).toBeGreaterThan(1);
        expect(label.display, JSON.stringify(report, null, 2)).not.toBe('none');
        expect(label.visibility, JSON.stringify(report, null, 2)).not.toBe('hidden');
        expect(label.opacity, JSON.stringify(report, null, 2)).not.toBe('0');
        expect(label.textFillColor || label.color, JSON.stringify(report, null, 2)).not.toBe('rgba(0, 0, 0, 0)');
        expect(label.textFillColor || label.color, JSON.stringify(report, null, 2)).toBe('rgb(254, 251, 249)');
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('does not stack top margins onto generated top-level blocks after markdown blank-line placeholders', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-blank-line-margin-audit');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await openMarkdownFixture(page, {
        filename: 'block-selection-blank-line-margin-audit.md',
        content: [
          'Paragraph before paragraph blank audit',
          '<!--vlaina-markdown-blank-line-->',
          'Paragraph after blank audit',
          '<!--vlaina-markdown-blank-line-->',
          '# Heading after blank audit',
          '<!--vlaina-markdown-blank-line-->',
          'Final paragraph after heading audit',
        ].join('\n'),
      });

      const report = await page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        if (!editor) return null;
        const blankLines = Array.from(editor.querySelectorAll<HTMLElement>(
          '[data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"]'
        ));
        return blankLines.map((blankLine) => {
          const next = blankLine.nextElementSibling instanceof HTMLElement
            ? blankLine.nextElementSibling
            : null;
          const blankRect = blankLine.getBoundingClientRect();
          const nextRect = next?.getBoundingClientRect();
          const nextStyle = next ? getComputedStyle(next) : null;
          return {
            blankClassName: blankLine.className,
            blankText: blankLine.textContent?.trim() ?? '',
            nextClassName: next?.className ?? null,
            nextMarginBlockStart: nextStyle?.marginBlockStart ?? null,
            nextMarginTop: nextStyle?.marginTop ?? null,
            nextTagName: next?.tagName ?? null,
            nextText: next?.textContent?.trim().slice(0, 80) ?? null,
            topGap: nextRect ? Math.round((nextRect.top - blankRect.bottom) * 100) / 100 : null,
          };
        });
      });

      expect(report).not.toBeNull();
      expect(report, JSON.stringify(report, null, 2)).toHaveLength(3);
      expect(report!.map((row) => row.nextTagName), JSON.stringify(report, null, 2)).toEqual([
        'P',
        'H1',
        'P',
      ]);
      for (const row of report!) {
        expect(Number.parseFloat(row.nextMarginBlockStart ?? row.nextMarginTop ?? '0'), JSON.stringify(report, null, 2)).toBeLessThanOrEqual(0.5);
        expect(row.topGap, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(0.5);
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('deletes selected blocks with Delete across representative block types', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-delete-key');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openMarkdownFixture(page, {
        filename: 'block-selection-delete-key.md',
        content: [
          '# Delete Key Block Selection',
          '',
          'Delete paragraph sentinel',
          '',
          '## Delete heading sentinel',
          '',
          '- Delete bullet sentinel',
          '- Keep bullet sentinel',
          '',
          '1. Delete ordered sentinel',
          '2. Keep ordered sentinel',
          '',
          '- [ ] Delete task sentinel',
          '- [ ] Keep task sentinel',
          '',
          '> Delete quote sentinel',
          '',
          '```ts',
          'const deleteCodeSentinel = true;',
          '```',
          '',
          'Keep final sentinel',
          '',
        ].join('\n'),
      });

      for (const target of [
        'Delete paragraph sentinel',
        'Delete heading sentinel',
        'Delete bullet sentinel',
        'Delete ordered sentinel',
        'Delete task sentinel',
        'Delete quote sentinel',
        'deleteCodeSentinel',
      ]) {
        await expect(page.locator(EDITOR_SELECTOR)).toContainText(target);

        const selectedCount = await page.evaluate(async (targetText) => {
          const count = await (window as any).__vlainaE2E.selectNoteBlocksByText([targetText]);
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          return count;
        }, target);
        expect(selectedCount, `Expected selectable block for ${target}`).toBe(1);

        await page.evaluate(() => {
          const active = document.activeElement;
          if (active instanceof HTMLElement) active.blur();
        });
        await page.keyboard.press('Delete');

        await expect.poll(async () => page.evaluate((targetText) => {
          const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
          const state = (window as any).__vlainaE2E.getNotesState();
          return {
            editorHasText: editor?.textContent?.includes(targetText) ?? false,
            markdownHasText: state.currentNote?.content?.includes(targetText) ?? false,
            selectedCount: document.querySelectorAll('.milkdown .ProseMirror .editor-block-selected').length,
          };
        }, target), {
          message: `Expected Delete to remove selected block "${target}"`,
        }).toEqual({
          editorHasText: false,
          markdownHasText: false,
          selectedCount: 0,
        });
      }

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Keep bullet sentinel');
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Keep ordered sentinel');
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Keep task sentinel');
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Keep final sentinel');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('deletes a list block selected by real blank-area drag with Delete', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-drag-delete-list');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openMarkdownFixture(page, {
        filename: 'block-selection-drag-delete-list.md',
        content: [
          '# Drag Delete List',
          '',
          'Intro paragraph stays after drag delete.',
          '',
          '- Drag delete list sentinel',
          '',
        ].join('\n'),
      });

      const target = await getBlankAreaDragTarget(page, 'Drag delete list sentinel');
      expect(target).not.toBeNull();
      expect(target!.hitInsideEditor).toBe(false);

      await page.mouse.move(target!.startX, target!.startY);
      await page.mouse.down();
      await page.mouse.move(target!.endX, target!.endY, { steps: 16 });
      await page.mouse.up();

      await expect.poll(async () => page.evaluate(() => {
        const selected = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror .editor-block-selected'));
        return {
          count: selected.length,
          hasTarget: selected.some((element) => element.textContent?.includes('Drag delete list sentinel')),
          activeTagName: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
          activeClassName: document.activeElement instanceof HTMLElement ? document.activeElement.className : null,
        };
      })).toMatchObject({
        count: expect.any(Number),
        hasTarget: true,
      });

      await page.keyboard.press('Delete');

      await expect.poll(async () => page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        const state = (window as any).__vlainaE2E.getNotesState();
        return {
          editorHasTarget: editor?.textContent?.includes('Drag delete list sentinel') ?? false,
          markdownHasTarget: state.currentNote?.content?.includes('Drag delete list sentinel') ?? false,
          editorHasIntro: editor?.textContent?.includes('Intro paragraph stays after drag delete.') ?? false,
          selectedCount: document.querySelectorAll('.milkdown .ProseMirror .editor-block-selected').length,
        };
      }), {
        message: 'Expected Delete to remove the drag-selected list block',
      }).toEqual({
        editorHasTarget: false,
        markdownHasTarget: false,
        editorHasIntro: true,
        selectedCount: 0,
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('moves a dragged block when hovering the target row left gutter', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-drag-left-gutter-drop');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openBlockSelectionFixture(page);

      await selectNoteBlocksByMatchers(page, [{ include: 'First selectable paragraph' }]);
      const source = page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'First selectable paragraph' });
      const target = page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Second selectable paragraph' });
      await moveMouseToBlockHandleGutter(page, source);

      const handleBox = await page.locator('.editor-block-control-handle').boundingBox();
      const targetBox = await target.boundingBox();
      if (!handleBox || !targetBox) {
        throw new Error('Could not resolve drag handle or target paragraph geometry');
      }

      const dragStartX = handleBox.x + handleBox.width / 2;
      const dragStartY = handleBox.y + handleBox.height / 2;
      const leftGutterX = Math.max(8, targetBox.x - 96);
      const targetLowerHalfY = targetBox.y + targetBox.height * 0.75;

      await page.mouse.move(dragStartX, dragStartY);
      await page.mouse.down();
      await page.mouse.move(leftGutterX, targetLowerHalfY, { steps: 12 });

      const indicator = page.locator('.editor-block-drop-indicator.visible');
      await expect(indicator).toBeVisible();
      const indicatorBox = await indicator.boundingBox();
      expect(indicatorBox).not.toBeNull();
      expect(indicatorBox!.x).toBeGreaterThan(leftGutterX);
      expect(indicatorBox!.x + indicatorBox!.width).toBeGreaterThanOrEqual(leftGutterX);
      expect(Math.round(indicatorBox!.height)).toBe(3);

      await page.mouse.up();

      await expect.poll(async () => page.evaluate(() => {
        const content = String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '');
        const indexes = [
          content.indexOf('Second selectable paragraph'),
          content.indexOf('First selectable paragraph'),
          content.indexOf('Parent item'),
        ];
        return indexes.every((index) => index >= 0)
          && indexes[0] < indexes[1]
          && indexes[1] < indexes[2];
      }), {
        message: 'Expected dropping from the left gutter to move First after Second',
      }).toBe(true);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('selects blocks from the text gutter and centers the drag handle on the selected block', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openBlockSelectionFixture(page);

      await expect.poll(async () => page.evaluate(() => (window as any).__vlainaE2E.getNoteSelectableBlocks()))
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ tagName: 'P', text: 'First selectable paragraph' }),
          expect.objectContaining({ tagName: 'P', text: 'Second selectable paragraph' }),
        ]));

      await expect(
        page.evaluate(() => (window as any).__vlainaE2E.selectNoteBlocksByText([
          'First selectable paragraph',
          'Second selectable paragraph',
        ]))
      ).resolves.toBe(2);
      await expectSelectedParagraphs(page, ['First selectable paragraph', 'Second selectable paragraph']);

      const firstSelected = page.locator(SELECTED_BLOCK_SELECTOR).first();
      const selectedRect = await firstSelected.boundingBox();
      if (!selectedRect) {
        throw new Error('Could not resolve selected block geometry');
      }

      await page.mouse.move(Math.max(8, selectedRect.x - 18), selectedRect.y + selectedRect.height / 2);
      await expect(page.locator(BLOCK_CONTROLS_SELECTOR)).toBeVisible();

      const geometry = await page.evaluate(() => {
        const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
        const selected = document.querySelector<HTMLElement>('.milkdown .ProseMirror .editor-block-selected');
        if (!controls || !selected) return null;
        const controlsRect = controls.getBoundingClientRect();
        const selectedRect = selected.getBoundingClientRect();
        return {
          controlsCenterY: controlsRect.top + controlsRect.height / 2,
          selectedCenterY: selectedRect.top + selectedRect.height / 2,
          controlsLeft: controlsRect.left,
          selectedLeft: selectedRect.left,
        };
      });

      expect(geometry).not.toBeNull();
      expect(Math.abs(geometry!.controlsCenterY - geometry!.selectedCenterY)).toBeLessThanOrEqual(2);
      expect(geometry!.controlsLeft).toBeLessThan(geometry!.selectedLeft);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps block handles clear of collapse toggles while dragging', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-handle-collapse-clearance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const { notePath } = await page.evaluate(() =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'block-handle-collapse-clearance.md',
          content: [
            '# Collapsible Heading Clearance',
            '',
            'Heading body paragraph',
            '',
            '# List Collapse Section',
            '',
            '- Parent collapse row',
            '  - Child collapse row',
            '',
          ].join('\n'),
        })
      );

      await page.evaluate((pathToOpen) => (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), notePath);
      await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .heading-toggle-btn`).first()).toBeAttached();
      await expect(page.locator(`${EDITOR_SELECTOR} .editor-collapse-btn[data-has-content="true"]`).first()).toBeAttached();

      await selectNoteBlocksByMatchers(page, [{ exact: 'Collapsible Heading Clearance' }]);
      await moveMouseToBlockHandleGutter(
        page,
        page.locator(`${EDITOR_SELECTOR} h1`, { hasText: 'Collapsible Heading Clearance' }),
      );
      const headingClearance = await measureCollapseToggleClearance(page, {
        targetSelector: '.milkdown .ProseMirror h1',
        targetText: 'Collapsible Heading Clearance',
        toggleSelector: ':scope > .heading-toggle-btn',
      });
      expect(headingClearance.handleGapX).toBeGreaterThanOrEqual(10);
      const headingSurface = await measureSelectedSurfaceCoverage(page, {
        targetSelector: '.milkdown .ProseMirror h1',
        targetText: 'Collapsible Heading Clearance',
      });
      expect(headingSurface.bleedStart).toBeGreaterThanOrEqual(72);
      expect(headingSurface.visualLeft).toBeLessThanOrEqual(headingSurface.controlsLeft + 1);
      expect(headingSurface.visualRight).toBeGreaterThanOrEqual(headingSurface.controlsRight - 1);

      await page.locator(`${EDITOR_SELECTOR} .editor-collapse-btn[data-has-content="true"]`).first().click();
      await expect(page.locator(`${EDITOR_SELECTOR} .editor-collapse-btn[data-collapsed="true"]`).first()).toBeAttached();

      await selectNoteBlocksByMatchers(page, [{ include: 'Parent collapse row' }]);
      await moveMouseToBlockHandleGutter(
        page,
        page.locator(`${EDITOR_SELECTOR} > ul > li`, { hasText: 'Parent collapse row' }),
      );
      const listClearance = await measureCollapseToggleClearance(page, {
        targetSelector: '.milkdown .ProseMirror > ul > li',
        targetText: 'Parent collapse row',
        toggleSelector: ':scope > .editor-collapse-btn',
      });
      expect(listClearance.handleGapX).toBeGreaterThanOrEqual(10);
      const listSurface = await measureSelectedSurfaceCoverage(page, {
        targetSelector: '.milkdown .ProseMirror > ul > li',
        targetText: 'Parent collapse row',
      });
      expect(listSurface.bleedStart).toBeGreaterThanOrEqual(96);
      expect(listSurface.visualLeft).toBeLessThanOrEqual(listSurface.controlsLeft + 1);
      expect(listSurface.visualRight).toBeGreaterThanOrEqual(listSurface.controlsRight - 1);

      const handleBox = await page.locator('.editor-block-control-handle').boundingBox();
      if (!handleBox) {
        throw new Error('Could not resolve block drag handle geometry');
      }
      const dragStartX = handleBox.x + handleBox.width / 2;
      const dragStartY = handleBox.y + handleBox.height / 2;
      await page.mouse.move(dragStartX, dragStartY);
      await page.mouse.down();
      await page.mouse.move(dragStartX + 20, dragStartY + 16, { steps: 4 });

      const draggingClearance = await measureCollapseToggleClearance(page, {
        targetSelector: '.milkdown .ProseMirror > ul > li',
        targetText: 'Parent collapse row',
        toggleSelector: ':scope > .editor-collapse-btn',
      });
      expect(draggingClearance.handleGapX).toBeGreaterThanOrEqual(10);
      const draggingSurface = await measureSelectedSurfaceCoverage(page, {
        targetSelector: '.milkdown .ProseMirror > ul > li',
        targetText: 'Parent collapse row',
      });
      expect(draggingSurface.bleedStart).toBeGreaterThanOrEqual(96);
      expect(draggingSurface.visualLeft).toBeLessThanOrEqual(draggingSurface.controlsLeft + 1);
      expect(draggingSurface.visualRight).toBeGreaterThanOrEqual(draggingSurface.controlsRight - 1);
      expect(draggingSurface.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(draggingSurface.boxShadow).toBe('none');
      expect(draggingSurface.afterBackgroundColor).toBe(draggingSurface.expectedBackground);
      expect(draggingSurface.afterLeft).not.toBeNull();
      expect(draggingSurface.afterRight).not.toBeNull();
      expect(draggingSurface.afterLeft!).toBeCloseTo(-draggingSurface.bleedStart, 0);
      expect(draggingSurface.afterRight!).toBeCloseTo(-draggingSurface.bleedEnd, 0);

      await page.mouse.up();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps block drag handles aligned and paints dragged sources for nested selections', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-nested-block-drag-handle');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const { notePath } = await page.evaluate(() =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'nested-block-drag-handle.md',
          content: [
            '# Nested Block Drag',
            '',
            '- Parent item',
            '  - Nested child drag source',
            '',
            'Standalone following paragraph',
            '',
          ].join('\n'),
        })
      );

      await page.evaluate((pathToOpen) => (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), notePath);
      await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Standalone following paragraph' })).toBeVisible();

      const selectedCount = await page.evaluate(() => {
        const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks();
        const nestedIndex = blocks.findIndex((block: { text: string }) => block.text === 'Nested child drag source');
        const standaloneIndex = blocks.findIndex((block: { text: string }) => block.text === 'Standalone following paragraph');
        if (nestedIndex < 0 || standaloneIndex < 0) return 0;
        return (window as any).__vlainaE2E.selectNoteBlocksByIndexes([nestedIndex, standaloneIndex]);
      });
      expect(selectedCount).toBe(2);

      const standaloneRect = await page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Standalone following paragraph' }).boundingBox();
      if (!standaloneRect) {
        throw new Error('Could not resolve standalone paragraph geometry');
      }

      await page.mouse.move(Math.max(8, standaloneRect.x - 18), standaloneRect.y + standaloneRect.height / 2);
      await expect(page.locator(BLOCK_CONTROLS_SELECTOR)).toBeVisible();

      const alignedGeometry = await page.evaluate(() => {
        const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
        const standalone = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror p'))
          .find((element) => element.textContent?.includes('Standalone following paragraph'));
        if (!controls || !standalone) return null;
        const controlsRect = controls.getBoundingClientRect();
        const standaloneRect = standalone.getBoundingClientRect();
        return {
          controlsCenterY: controlsRect.top + controlsRect.height / 2,
          standaloneCenterY: standaloneRect.top + standaloneRect.height / 2,
          handleGapX: standaloneRect.left - controlsRect.left,
        };
      });
      expect(alignedGeometry).not.toBeNull();
      expect(Math.abs(alignedGeometry!.controlsCenterY - alignedGeometry!.standaloneCenterY)).toBeLessThanOrEqual(2);
      expect(alignedGeometry!.handleGapX).toBeGreaterThan(24);
      expect(alignedGeometry!.handleGapX).toBeLessThan(72);

      const handleBox = await page.locator('.editor-block-control-handle').boundingBox();
      if (!handleBox) {
        throw new Error('Could not resolve block drag handle geometry');
      }
      await page.locator('.editor-block-control-handle').hover();

      const handleColor = await page.evaluate(() => {
        const handle = document.querySelector<HTMLElement>('.editor-block-control-handle');
        const path = handle?.querySelector<SVGPathElement>('path');
        if (!handle || !path) return null;
        const probe = document.createElement('span');
        probe.style.color = 'var(--vlaina-color-accent)';
        document.body.appendChild(probe);
        const accentColor = getComputedStyle(probe).color;
        probe.remove();
        return {
          iconFill: getComputedStyle(path).fill,
          accentColor,
          isHovered: handle.matches(':hover'),
        };
      });
      expect(handleColor).not.toBeNull();
      expect(handleColor!.isHovered).toBe(true);
      expect(handleColor!.iconFill).toBe(handleColor!.accentColor);

      const dragStartBox = await page.locator('.editor-block-control-handle').boundingBox();
      if (!dragStartBox) {
        throw new Error('Could not resolve block drag handle geometry after hover');
      }
      const dragStartX = dragStartBox.x + dragStartBox.width / 2;
      const dragStartY = dragStartBox.y + dragStartBox.height / 2;
      await page.mouse.move(dragStartX, dragStartY);
      await page.mouse.down();
      await page.mouse.move(dragStartX + 24, dragStartY + 24, { steps: 4 });

      const dragVisual = await page.evaluate(() => {
        const source = document.querySelector<HTMLElement>(
          '.milkdown .ProseMirror .editor-block-selected, .milkdown .ProseMirror .editor-block-drag-source'
        );
        if (!source) return null;
        const probe = document.createElement('span');
        probe.style.backgroundColor = 'var(--vlaina-block-selection-color-default)';
        document.body.appendChild(probe);
        const expectedBackground = getComputedStyle(probe).backgroundColor;
        probe.remove();
        const style = getComputedStyle(source);
        const afterStyle = getComputedStyle(source, '::after');
        const afterLeft = Number.parseFloat(afterStyle.left);
        const afterRight = Number.parseFloat(afterStyle.right);
        const bleedStart = Number.parseFloat(style.getPropertyValue('--vlaina-block-selection-bleed-x-start'));
        const bleedEnd = Number.parseFloat(style.getPropertyValue('--vlaina-block-selection-bleed-x-end'));
        const previewLayer = document.querySelector<HTMLElement>('.editor-block-drag-preview-layer');
        const previewLayerStyle = previewLayer ? getComputedStyle(previewLayer) : null;
        return {
          dragActive: document.body.classList.contains('editor-block-drag-active'),
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
          sourceOpacity: style.opacity,
          afterBackgroundColor: afterStyle.backgroundColor,
          afterLeft: Number.isFinite(afterLeft) ? afterLeft : null,
          afterRight: Number.isFinite(afterRight) ? afterRight : null,
          bleedStart: Number.isFinite(bleedStart) ? bleedStart : null,
          bleedEnd: Number.isFinite(bleedEnd) ? bleedEnd : null,
          expectedBackground,
          previewLayerBackgroundColor: previewLayerStyle?.backgroundColor ?? null,
          previewLayerOpacity: previewLayerStyle?.opacity ?? null,
          previewLayerBoxShadow: previewLayerStyle?.boxShadow ?? null,
          selectedCount: document.querySelectorAll('.milkdown .ProseMirror .editor-block-selected').length,
          sourceCount: document.querySelectorAll('.milkdown .ProseMirror .editor-block-drag-source').length,
        };
      });
      expect(dragVisual).not.toBeNull();
      expect(dragVisual!.dragActive).toBe(true);
      expect(dragVisual!.selectedCount + dragVisual!.sourceCount).toBeGreaterThan(0);
      expectDragSourceSelectionSurface('nested-selection-source', {
        sourceBackgroundColor: dragVisual!.backgroundColor,
        sourceBoxShadow: dragVisual!.boxShadow,
        sourceAfterBackgroundColor: dragVisual!.afterBackgroundColor,
        sourceAfterLeft: dragVisual!.afterLeft,
        sourceAfterRight: dragVisual!.afterRight,
        sourceBleedStart: dragVisual!.bleedStart,
        sourceBleedEnd: dragVisual!.bleedEnd,
        expectedBackground: dragVisual!.expectedBackground,
      });
      expect(dragVisual!.sourceOpacity).toBe('1');
      expect(dragVisual!.previewLayerBackgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(dragVisual!.previewLayerOpacity).toBe('1');
      expect(dragVisual!.previewLayerBoxShadow).toBe('none');

      await page.mouse.up();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
