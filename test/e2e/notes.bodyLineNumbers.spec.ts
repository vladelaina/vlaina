import { expect, test, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  EDITOR_SELECTOR,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';
import { createMarkdownSyntaxRoundtripCases } from './notesMarkdownSyntaxFixture';

const BODY_LINE_NUMBER_MARKDOWN = [
  '---',
  'title: Body Line Numbers',
  '---',
  '# Heading sentinel',
  '<!--vlaina-markdown-blank-line-->',
  'Intro paragraph sentinel that is intentionally long enough to stay a regular body paragraph.',
  '- Parent item sentinel',
  '  - Nested item sentinel',
  '- Next item sentinel',
  '',
  '```ts',
  'const hidden = true;',
  'const visible = false;',
  '```',
  '',
  'After code sentinel',
  '| Col | Value |',
  '| --- | --- |',
  '| A | B |',
  '> Quote sentinel',
].join('\n');

const EXPECTED_BODY_LINE_LABELS = Array.from({ length: 12 }, (_value, index) => String(index + 1));

async function collectBodyLineNumberDiagnostics(page: Page) {
  return page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    if (!editor) throw new Error('Missing editor');

    function findTextElement(selector: string, text: string): HTMLElement {
      const element = Array.from(editor.querySelectorAll<HTMLElement>(selector))
        .find((candidate) => candidate.textContent?.includes(text));
      if (!element) throw new Error(`Missing ${selector} containing ${text}`);
      return element;
    }

    function getOwnListItemText(item: HTMLElement): string {
      return Array.from(item.childNodes)
        .filter((node) => !(node instanceof HTMLElement && /^(?:ul|ol)$/i.test(node.tagName)))
        .map((node) => node.textContent ?? '')
        .join('');
    }

    function findListItem(text: string): HTMLElement {
      const element = Array.from(editor.querySelectorAll<HTMLElement>('li'))
        .find((candidate) => getOwnListItemText(candidate).includes(text));
      if (!element) throw new Error(`Missing li containing own text ${text}`);
      return element;
    }

    function firstTextCenterY(root: HTMLElement): number {
      const scanRoot = root.classList.contains('code-block-container')
        ? root.querySelector<HTMLElement>('.code-block-editable, .code-block-lazy-preview, .cm-content, pre, code') ?? root
        : root;
      const walker = document.createTreeWalker(scanRoot, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const parent = node.parentElement;
        if (!parent) continue;
        if (root.tagName === 'LI' && parent.closest('li') !== root) continue;
        if (parent.closest('[aria-hidden="true"], .body-line-number-gutter')) continue;
        if (parent.closest('[contenteditable="false"]') && !root.closest('.code-block-container')) continue;

        const range = document.createRange();
        try {
          range.selectNodeContents(node);
          const rects = range.getClientRects();
          for (let index = 0; index < rects.length; index += 1) {
            const rect = rects.item(index);
            if (rect && (rect.width > 0 || rect.height > 0)) {
              return rect.top + rect.height / 2;
            }
          }
        } finally {
          range.detach();
        }
      }

      const rect = root.getBoundingClientRect();
      return rect.top + rect.height / 2;
    }

    function isFrontmatterBlock(element: HTMLElement): boolean {
      return element.classList.contains('frontmatter-block-container');
    }

    function isNumberedBlankLineTarget(element: HTMLElement): boolean {
      if (element.classList.contains('editor-editable-markdown-blank-line')) return true;
      if (element.classList.contains('editor-empty-paragraph')) return true;
      return element.dataset.type === 'html-block'
        && /<!--\s*(?:vlaina-markdown-blank-line|vlaina-rendered-html-boundary-blank-line)\s*-->/.test(element.dataset.value ?? '');
    }

    function isNonNumberedPlaceholder(element: HTMLElement): boolean {
      return element.dataset.type === 'html-block'
        && /<!--\s*vlaina-markdown-tight-heading\s*-->/.test(element.dataset.value ?? '');
    }

    function collectBodyLineTargets(): HTMLElement[] {
      const targets: HTMLElement[] = [];

      function collectCodeBlockLineTargets(codeBlock: HTMLElement): HTMLElement[] {
        const codeRoot = codeBlock.querySelector<HTMLElement>('.cm-content')
          ?? codeBlock.querySelector<HTMLElement>('.code-block-lazy-preview, pre, code')
          ?? codeBlock;
        const lines = Array.from(codeRoot.querySelectorAll<HTMLElement>('.cm-line'))
          .filter((line) =>
            line.closest('.code-block-container, pre[data-language], pre.code-block-wrapper') === codeBlock
            && line.closest('.cm-gutters, .cm-gutter, .cm-lineNumbers') === null
          );
        return lines.length > 0 ? lines : [codeRoot];
      }

      for (let index = 0; index < editor.children.length; index += 1) {
        const child = editor.children.item(index);
        if (!(child instanceof HTMLElement)) continue;
        if (isFrontmatterBlock(child) || isNonNumberedPlaceholder(child)) continue;
        if (
          child.classList.contains('code-block-container')
          || child.matches('pre[data-language], pre.code-block-wrapper')
        ) {
          targets.push(...collectCodeBlockLineTargets(child));
          continue;
        }

        const tagName = child.tagName.toLowerCase();
        if (tagName === 'ul' || tagName === 'ol') {
          targets.push(...Array.from(child.querySelectorAll<HTMLElement>('li')));
          continue;
        }

        targets.push(child);
      }

      return targets;
    }

    const labels = Array.from(document.querySelectorAll<HTMLElement>('.body-line-number'));
    const targets = collectBodyLineTargets();
    const targetCenters = targets.map((target) => firstTextCenterY(target));
    const blankTargets = targets.filter(isNumberedBlankLineTarget);
    const blankRects = blankTargets.map((target) => target.getBoundingClientRect());
    const editorRect = editor.getBoundingClientRect();
    const labelRects = labels.map((label) => {
      const rect = label.getBoundingClientRect();
      return {
        text: label.textContent?.trim() ?? '',
        centerY: rect.top + rect.height / 2,
        right: rect.right,
      };
    });

    findTextElement('h1', 'Heading sentinel');
    findTextElement('p', 'Intro paragraph sentinel');
    findListItem('Parent item sentinel');
    findListItem('Nested item sentinel');
    findListItem('Next item sentinel');
    findTextElement('.code-block-container', 'const hidden = true;');
    findTextElement('.code-block-container', 'const visible = false;');
    findTextElement('p', 'After code sentinel');
    findTextElement('.milkdown-table-block, table', 'Col');
    findTextElement('blockquote, [data-type="callout"]', 'Quote sentinel');

    return {
      labels: labelRects.map((label) => label.text),
      targetCount: targets.length,
      blankTargetCount: blankTargets.length,
      deltaSummaries: labelRects.map((label, index) => ({
        delta: Math.abs(label.centerY - (targetCenters[index] ?? Number.POSITIVE_INFINITY)),
        label: label.text,
        labelCenterY: label.centerY,
        targetCenterY: targetCenters[index] ?? null,
        target: targets[index]
          ? {
              tagName: targets[index].tagName,
              className: targets[index].className,
              datasetType: targets[index].dataset.type ?? null,
              text: (targets[index].textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
            }
          : null,
      })).sort((a, b) => b.delta - a.delta).slice(0, 5),
      maxVerticalDelta: Math.max(
        ...labelRects.map((label, index) => Math.abs(label.centerY - (targetCenters[index] ?? Number.POSITIVE_INFINITY)))
      ),
      minLabelContentGap: Math.min(...labelRects.map((label) => editorRect.left - label.right)),
      blankPlaceholderLabelCount: Array.from(document.querySelectorAll<HTMLElement>('.body-line-number'))
        .filter((label) => {
          const rect = label.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          return blankRects.some((blankRect) => centerY >= blankRect.top && centerY <= blankRect.bottom);
        }).length,
    };
  });
}

test.describe('notes body line numbers', () => {
  test.setTimeout(180_000);

  test('aligns mixed markdown body line numbers to rendered body blocks', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-body-line-numbers');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await page.evaluate(() => (window as any).__vlainaE2E.setMarkdownBodyLineNumbers(true));

      await openMarkdownFixture(page, {
        filename: 'body-line-numbers.md',
        content: BODY_LINE_NUMBER_MARKDOWN,
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('After code sentinel');
      await expect.poll(
        async () => page.evaluate(() => Array.from(
          document.querySelectorAll<HTMLElement>('.body-line-number')
        ).map((label) => label.textContent?.trim() ?? '')),
        { timeout: 30_000 },
      ).toEqual(EXPECTED_BODY_LINE_LABELS);
      await waitForEditorAnimationFrame(page);

      const diagnostics = await collectBodyLineNumberDiagnostics(page);
      console.info('[notes-body-line-numbers]', diagnostics);

      expect(diagnostics.labels).toEqual(EXPECTED_BODY_LINE_LABELS);
      expect(diagnostics.targetCount).toBe(EXPECTED_BODY_LINE_LABELS.length);
      expect(diagnostics.blankTargetCount).toBeGreaterThan(0);
      expect(diagnostics.blankPlaceholderLabelCount).toBe(diagnostics.blankTargetCount);
      expect(diagnostics.minLabelContentGap).toBeGreaterThanOrEqual(10);
      expect(diagnostics.maxVerticalDelta).toBeLessThanOrEqual(3);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('places the table body line number before the first table row', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-body-line-numbers-table');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await page.evaluate(() => (window as any).__vlainaE2E.setMarkdownBodyLineNumbers(true));

      await openMarkdownFixture(page, {
        filename: 'body-line-numbers-table.md',
        content: [
          'Before table sentinel',
          '',
          '| Column A | Column B | Column C |',
          '| --- | --- | --- |',
          '| Row 1 alpha | Row 1 beta | Row 1 gamma |',
          '| Row 2 alpha | Row 2 beta | Row 2 gamma |',
          '| Row 3 alpha | Row 3 beta | Row 3 gamma |',
          '| Row 4 alpha | Row 4 beta | Row 4 gamma |',
          '',
          'After table sentinel',
        ].join('\n'),
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Row 1 alpha');
      await expect.poll(
        async () => page.evaluate(() => document.querySelectorAll('.body-line-number').length),
        { timeout: 30_000 },
      ).toBeGreaterThanOrEqual(5);
      await waitForEditorAnimationFrame(page);

      const tableDiagnostics = await page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        if (!editor) throw new Error('Missing editor');

        function collectBodyLineTargets(): HTMLElement[] {
          const targets: HTMLElement[] = [];

          for (let index = 0; index < editor.children.length; index += 1) {
            const child = editor.children.item(index);
            if (!(child instanceof HTMLElement)) continue;
            if (child.classList.contains('frontmatter-block-container')) {
              continue;
            }
            if (
              child.dataset.type === 'html-block' &&
              /<!--\s*vlaina-markdown-tight-heading\s*-->/.test(child.dataset.value ?? '')
            ) {
              continue;
            }

            const tagName = child.tagName.toLowerCase();
            if (tagName === 'ul' || tagName === 'ol') {
              targets.push(...Array.from(child.querySelectorAll<HTMLElement>('li')));
              continue;
            }

            targets.push(child);
          }

          return targets;
        }

        function firstCellTextCenterY(table: HTMLElement): number {
          const firstCell = table.querySelector<HTMLElement>('th, td');
          if (!firstCell) throw new Error('Missing first table cell');
          const walker = document.createTreeWalker(firstCell, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent?.trim()) continue;
            const range = document.createRange();
            try {
              range.selectNodeContents(node);
              const rect = range.getClientRects().item(0);
              if (rect && (rect.width > 0 || rect.height > 0)) {
                return rect.top + rect.height / 2;
              }
            } finally {
              range.detach();
            }
          }
          const firstCellRect = firstCell.getBoundingClientRect();
          return firstCellRect.top + firstCellRect.height / 2;
        }

        const labels = Array.from(document.querySelectorAll<HTMLElement>('.body-line-number'));
        const targets = collectBodyLineTargets();
        const table = editor.querySelector<HTMLElement>('.milkdown-table-block, table');
        if (!table) throw new Error('Missing rendered table');
        const tableIndex = targets.indexOf(table);
        if (tableIndex < 0) throw new Error('Rendered table is not a body line number target');
        const tableLabel = labels[tableIndex];
        if (!tableLabel) throw new Error('Missing table line number label');

        const labelRect = tableLabel.getBoundingClientRect();
        const tableAnchorRect = (
          table.querySelector<HTMLElement>('.table-wrapper, .table-scroll, table') ?? table
        ).getBoundingClientRect();
        const tableBlockRect = table.getBoundingClientRect();
        const labelCenterY = labelRect.top + labelRect.height / 2;
        const firstCellCenterY = firstCellTextCenterY(table);

        return {
          labelText: tableLabel.textContent?.trim() ?? '',
          labelToTableGap: tableAnchorRect.left - labelRect.right,
          firstRowVerticalDelta: Math.abs(labelCenterY - firstCellCenterY),
          blockCenterVerticalDelta: Math.abs(labelCenterY - (tableBlockRect.top + tableBlockRect.height / 2)),
        };
      });

      expect(tableDiagnostics.labelText).toBe('3');
      expect(tableDiagnostics.labelToTableGap).toBeGreaterThanOrEqual(10);
      expect(tableDiagnostics.firstRowVerticalDelta).toBeLessThanOrEqual(3);
      expect(tableDiagnostics.blockCenterVerticalDelta).toBeGreaterThan(20);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('covers body line numbers across the supported markdown syntax matrix', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-body-line-numbers-syntax-matrix');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await page.evaluate(() => (window as any).__vlainaE2E.setMarkdownBodyLineNumbers(true));

      for (const syntaxCase of createMarkdownSyntaxRoundtripCases()) {
        await test.step(syntaxCase.label, async () => {
          await openMarkdownFixture(page, {
            filename: `body-line-numbers-syntax-${syntaxCase.label.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.md`,
            content: syntaxCase.markdown,
          });

          await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
          await waitForEditorAnimationFrame(page);
          await expect.poll(async () => page.evaluate(() => {
            const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
            if (!editor) return false;

            function collectCodeBlockLineTargets(codeBlock: HTMLElement): HTMLElement[] {
              const codeRoot = codeBlock.querySelector<HTMLElement>('.cm-content')
                ?? codeBlock.querySelector<HTMLElement>('.code-block-lazy-preview, pre, code')
                ?? codeBlock;
              const lines = Array.from(codeRoot.querySelectorAll<HTMLElement>('.cm-line'))
                .filter((line) =>
                  line.closest('.code-block-container, pre[data-language], pre.code-block-wrapper') === codeBlock
                  && line.closest('.cm-gutters, .cm-gutter, .cm-lineNumbers') === null
                );
              return lines.length > 0 ? lines : [codeRoot];
            }

            let targetCount = 0;
            for (let index = 0; index < editor.children.length; index += 1) {
              const child = editor.children.item(index);
              if (!(child instanceof HTMLElement)) continue;
              if (
                child.classList.contains('frontmatter-block-container')
                || (
                  child.dataset.type === 'html-block'
                  && /<!--\s*vlaina-markdown-tight-heading\s*-->/.test(child.dataset.value ?? '')
                )
              ) {
                continue;
              }

              const tagName = child.tagName.toLowerCase();
              if (child.classList.contains('code-block-container') || child.matches('pre[data-language], pre.code-block-wrapper')) {
                targetCount += collectCodeBlockLineTargets(child).length;
              } else {
                targetCount += tagName === 'ul' || tagName === 'ol'
                  ? child.querySelectorAll('li').length
                  : 1;
              }
            }

            const labelCount = document.querySelectorAll('.body-line-number').length;
            return targetCount > 0 && labelCount === targetCount;
          }), {
            message: `${syntaxCase.label}: body line labels should settle before geometry audit`,
            timeout: 10_000,
          }).toBe(true);

          const audit = await page.evaluate(() => {
            const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
            if (!editor) throw new Error('Missing editor');

            function isFrontmatterBlock(element: HTMLElement): boolean {
              return element.classList.contains('frontmatter-block-container');
            }

            function isNonNumberedPlaceholder(element: HTMLElement): boolean {
              return element.dataset.type === 'html-block'
                && /<!--\s*vlaina-markdown-tight-heading\s*-->/.test(element.dataset.value ?? '');
            }

            function collectTargets(): HTMLElement[] {
              const targets: HTMLElement[] = [];

              function collectCodeBlockLineTargets(codeBlock: HTMLElement): HTMLElement[] {
                const codeRoot = codeBlock.querySelector<HTMLElement>('.cm-content')
                  ?? codeBlock.querySelector<HTMLElement>('.code-block-lazy-preview, pre, code')
                  ?? codeBlock;
                const lines = Array.from(codeRoot.querySelectorAll<HTMLElement>('.cm-line'))
                  .filter((line) =>
                    line.closest('.code-block-container, pre[data-language], pre.code-block-wrapper') === codeBlock
                    && line.closest('.cm-gutters, .cm-gutter, .cm-lineNumbers') === null
                  );
                return lines.length > 0 ? lines : [codeRoot];
              }

              for (let index = 0; index < editor.children.length; index += 1) {
                const child = editor.children.item(index);
                if (!(child instanceof HTMLElement)) continue;
                if (isFrontmatterBlock(child) || isNonNumberedPlaceholder(child)) continue;
                if (
                  child.classList.contains('code-block-container')
                  || child.matches('pre[data-language], pre.code-block-wrapper')
                ) {
                  targets.push(...collectCodeBlockLineTargets(child));
                  continue;
                }

                const tagName = child.tagName.toLowerCase();
                if (tagName === 'ul' || tagName === 'ol') {
                  targets.push(...Array.from(child.querySelectorAll<HTMLElement>('li')));
                  continue;
                }

                targets.push(child);
              }

              return targets;
            }

            function getFirstVisibleClientRect(rects: DOMRectList): DOMRect | null {
              for (let index = 0; index < rects.length; index += 1) {
                const rect = rects.item(index);
                if (rect && (rect.width > 0 || rect.height > 0)) return rect;
              }
              return null;
            }

            function firstTextCenterY(root: HTMLElement): number {
              const scanRoot = root.classList.contains('code-block-container')
                ? root.querySelector<HTMLElement>('.code-block-editable, .code-block-lazy-preview, .cm-content, pre, code') ?? root
                : root;
              const walker = document.createTreeWalker(scanRoot, NodeFilter.SHOW_TEXT);
              for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (!node.textContent?.trim()) continue;
                const parent = node.parentElement;
                if (!parent) continue;
                if (root.tagName === 'LI' && parent.closest('li') !== root) continue;
                if (parent.closest('[aria-hidden="true"], .body-line-number-gutter')) continue;
                if (
                  parent.closest('[contenteditable="false"]')
                  && !root.classList.contains('milkdown-table-block')
                  && !root.closest('.code-block-container')
                ) {
                  continue;
                }

                const range = document.createRange();
                try {
                  range.selectNodeContents(node);
                  const rect = getFirstVisibleClientRect(range.getClientRects());
                  if (rect) return rect.top + rect.height / 2;
                } finally {
                  range.detach();
                }
              }

              const rect = root.getBoundingClientRect();
              return rect.top + rect.height / 2;
            }

            const labels = Array.from(document.querySelectorAll<HTMLElement>('.body-line-number'));
            const targets = collectTargets();
            const labelTexts = labels.map((label) => label.textContent?.trim() ?? '');
            const expectedLabelTexts = Array.from({ length: targets.length }, (_value, index) => String(index + 1));
            const labelRects = labels.map((label) => {
              const rect = label.getBoundingClientRect();
              return {
                text: label.textContent?.trim() ?? '',
                centerY: rect.top + rect.height / 2,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height,
              };
            });
            const targetCenters = targets.map((target) => firstTextCenterY(target));
            const verticalDeltas = labelRects.map((label, index) =>
              Math.abs(label.centerY - (targetCenters[index] ?? Number.POSITIVE_INFINITY))
            );
            const deltaSummaries = verticalDeltas.map((delta, index) => ({
              delta,
              label: labelRects[index]?.text ?? null,
              labelCenterY: labelRects[index]?.centerY ?? null,
              targetCenterY: targetCenters[index] ?? null,
              target: targets[index]
                ? {
                    tagName: targets[index].tagName,
                    className: targets[index].className,
                    datasetType: targets[index].dataset.type ?? null,
                    text: (targets[index].textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
                  }
                : null,
            })).sort((a, b) => b.delta - a.delta).slice(0, 5);

            return {
              targetCount: targets.length,
              labelCount: labels.length,
              labelTexts,
              expectedLabelTexts,
              maxVerticalDelta: verticalDeltas.length > 0 ? Math.max(...verticalDeltas) : 0,
              deltaSummaries,
              invisibleLabels: labelRects.filter((rect) => rect.width <= 0 || rect.height <= 0).map((rect) => rect.text),
              targetSummaries: targets.map((target, index) => ({
                index,
                tagName: target.tagName,
                className: target.className,
                datasetType: target.dataset.type ?? null,
                text: (target.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
              })),
            };
          });

          expect(audit.labelCount, `${syntaxCase.label}: label count should match numbered targets\n${JSON.stringify(audit.targetSummaries, null, 2)}`)
            .toBe(audit.targetCount);
          expect(audit.labelTexts, `${syntaxCase.label}: labels should be dense and ordered`)
            .toEqual(audit.expectedLabelTexts);
          expect(audit.invisibleLabels, `${syntaxCase.label}: labels should be visible`).toEqual([]);
          expect(audit.maxVerticalDelta, `${syntaxCase.label}: labels should align to target first text line\n${JSON.stringify(audit.deltaSummaries, null, 2)}`)
            .toBeLessThanOrEqual(4);
        });
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
