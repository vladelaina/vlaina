import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

const CHAOS_MARKDOWN_FIXTURE = [
  '---',
  'vlaina_cover: asset="./assets/13.jpg" x=50 y=35.92496673701899 height=200 scale=1',
  '---',
  '',
  '1. Front matter support sentinel',
  '',
  '   Nested paragraph inside first item.',
  '',
  '2. Source mode missing sentinel',
  '',
  '   !Broken bang paragraph sentinel',
  '',
  '3. Inline HTML <span style="font-size: 18px; background: #335577"><strong>strong span sentinel</strong></span> tail.',
  '',
  '<!--vlaina-markdown-blank-line-->',
  '<!--vlaina-markdown-blank-line-->',
  '',
  '**Spacing Section**',
  '',
  '<!--vlaina-markdown-blank-line-->',
  '<!--vlaina-markdown-blank-line-->',
  '<!--vlaina-markdown-blank-l',
  '',
  'Escaped internal comment text: \\<!--vlaina-markdown-blank-line-->',
  '',
  '# Overview Chaos',
  '',
  'Paragraph with hard break sentinel  \\',
  'next line after two spaces.',
  '',
  'Paragraph with html break sentinel<br/>next text after br.',
  '',
  '## Shortcut Table',
  '',
  '| Action | Windows | macOS | Extra |',
  '| ------ | ------- | ----- | :---- |',
  '| Heading one | Ctrl+1 | command+1 | |',
  '| Insert table | Ctrl+T | | |',
  '| Delete row | Ctrl+Shift+Backspace | | |',
  '',
  '| Function | Step | Windows | macOS |',
  '| ---- | ------- | ------------- | ------ |',
  '| Bold | Format > Bold | Ctrl+B | |',
  '| Code | Format > Code | Ctrl+Shift+` | |',
  '',
  '# Heading',
  '',
  'Setext heading sentinel',
  '---------',
  '',
  '####### Unsupported seventh heading sentinel',
  '',
  '```markdown',
  '# h1',
  '## h2',
  '####### h7 unsupported',
  '```',
  '',
  'I am a normal paragraph before many blank comments.',
  '',
  '<!--vlaina-markdown-blank-line-->',
  '<!--vlaina-markdown-blank-line-->',
  '<!--vlaina-markdown-blank-line-->',
  '',
  'I am a normal paragraph after many blank comments.',
  '',
  '# Lists',
  '',
  '* star item one',
  '* star item two',
  '',
  '+ plus item one',
  '+ plus item two',
  '',
  '- dash item one',
  '',
  '',
  '',
  '- dash item two after empty lines',
  '',
  'Today:',
  '',
  '- [x] done task',
  '- [ ] open task',
  '  - [x] nested task',
  '  - [ ] nested open task',
  '',
  '# Quote',
  '',
  '> Quote first line with [link](https://example.com)',
  '> second line with **bold** and *italic*.',
  '>',
  '> > nested quote sentinel',
  '',
  '# Images And Embeds',
  '',
  '![Image alt sentinel](https://raw.githubusercontent.com/521xueweihan/img_logo/master/logo/cover.jpg#w=72%25 "cover")',
  '',
  '<img src="https://raw.githubusercontent.com/521xueweihan/img_logo/master/logo/cover.jpg#w=72%25" alt="HTML crop chaos sentinel" width="72%" data-vlaina-crop="0.108735,0.117569,99.891265,99.882431,2.349414" />',
  '',
  '<video src="./assets/demo.mp4" controls></video>',
  '',
  '<audio src="./assets/demo.mp3" controls></audio>',
  '',
  '<iframe src="https://example.com/embed"></iframe>',
  '',
  '<script>window.__chaosScriptShouldNotRun = true;</script>',
  '',
  '# Code',
  '',
  'Inline code `cd ..` sentinel.',
  '',
  '```',
  'String name = "Tom";',
  'int age = 18;',
  '```',
  '',
  '```java',
  'String name = "Tom";',
  'int age = 18;',
  '```',
  '',
  '~~~',
  'tilde fenced code sentinel',
  '~~~',
  '',
  '```sequence',
  'A->B: old sequence syntax',
  'Note right of B: unsupported old syntax',
  '```',
  '',
  '```flow',
  'st=>start: Start',
  'cond=>condition: Yes or No?',
  '```',
  '',
  '# Tables',
  '',
  'Plain table sentinel',
  '',
  '| ID | Title | URL |',
  '| -- | -- | --- |',
  '| 01 | Blog | [https://c](https://cnblogs.com)nblogs.com |',
  '| 02 | Search | https\\:/[/baidu.com](https://baidu.com) |',
  '',
  'Aligned table sentinel',
  '',
  '| Left | Center | Right |',
  '| :-- | :--: | --: |',
  '| 01 | Blog | https://cnblogs.com |',
  '| 02 | Search | https://baidu.com |',
  '',
  '# Inline Extensions',
  '',
  '==highlight== `==highlight==`',
  '',
  'content^sup^ `content^sup^`',
  '',
  'content~sub~ `content~sub~`',
  '',
  '<u>underline html sentinel</u>',
  '',
  '++plus underline unsupported sentinel++',
  '',
  '# TOC',
  '',
  '[TOC]',
  '',
  '[toc]',
  '',
  '# Footnotes',
  '',
  'Footnote reference sentinel[^alpha].',
  '',
  '[^alpha]: Footnote definition body sentinel.',
  '',
].join('\n');

type ChaosBlockReport = {
  className: string;
  dataset: Record<string, string>;
  index: number;
  offenders: Array<{
    backgroundColor: string;
    backgroundImage: string;
    className: string;
    dataset: Record<string, string>;
    tagName: string;
    text: string;
  }>;
  ok: boolean;
  selectedCount: number;
  tagName: string;
  text: string;
};

test.describe('notes block selection chaos audit', () => {
  test.setTimeout(180_000);

  test('keeps selection color and spacing stable across a chaotic markdown document in dark mode', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-chaos-audit');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'block-selection-chaos-audit.md',
        content: CHAOS_MARKDOWN_FIXTURE,
      });

      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      await expect(page.locator(`${EDITOR_SELECTOR}`, { hasText: 'Front matter support sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .image-block-container[data-alt="HTML crop chaos sentinel"]`)).toBeVisible();

      const audit = await page.evaluate(async ({ editorSelector }) => {
        const normalize = (value: string | undefined | null) => (value ?? '').replace(/\s+/g, ' ').trim();
        const isTransparentColor = (value: string) => (
          value === 'transparent' ||
          /^rgba?\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(value.trim())
        );
        const parseRgb = (value: string): [number, number, number, number] | null => {
          const match = value.match(/rgba?\(([^)]+)\)/i);
          if (!match) return null;
          const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
          if (parts.length < 3 || parts.some((part, index) => index < 3 && !Number.isFinite(part))) return null;
          return [parts[0], parts[1], parts[2], Number.isFinite(parts[3]) ? parts[3] : 1];
        };
        const colorDistance = (left: string, right: string) => {
          const l = parseRgb(left);
          const r = parseRgb(right);
          if (!l || !r) return Number.POSITIVE_INFINITY;
          return Math.abs(l[0] - r[0]) + Math.abs(l[1] - r[1]) + Math.abs(l[2] - r[2]) + Math.abs(l[3] - r[3]) * 255;
        };
        const isExpectedColor = (value: string, expected: string) => colorDistance(value, expected) <= 3;
        const classText = (element: Element) => typeof element.className === 'string' ? element.className : '';
        const editor = document.querySelector<HTMLElement>(editorSelector);
        if (!editor) return null;

        const probe = document.createElement('span');
        probe.style.backgroundColor = 'var(--vlaina-block-selection-color-default)';
        document.body.appendChild(probe);
        const expectedBackground = getComputedStyle(probe).backgroundColor;
        probe.remove();

        const isIgnoredSurface = (element: HTMLElement) => (
          ['IMG', 'SVG', 'PATH', 'TEXT', 'TSPAN', 'IFRAME', 'VIDEO', 'AUDIO', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'CODE', 'MARK'].includes(element.tagName) ||
          element.dataset.editorTagToken === 'true' ||
          Boolean(element.closest('.editor-block-controls, .image-toolbar, .code-block-chrome-copy-button, .video-external-action'))
        );
        const isSurfaceCandidate = (element: HTMLElement) => {
          const name = classText(element);
          const testId = element.dataset.testid ?? '';
          if (element.classList.contains('editor-block-selected')) return true;
          if (element.dataset.imageSelectionWrapper === 'true') return true;
          if (element.dataset.imageSelectionSurface === 'true') return true;
          if (element.dataset.type === 'html-block') return true;
          if (element.dataset.type === 'toc') return true;
          if (element.dataset.type === 'callout') return true;
          if (element.dataset.type === 'math-block' || element.dataset.type === 'mermaid' || element.dataset.type === 'video') return true;
          if ((name.includes('cm-') && (element.closest('.code-block-container') || element.closest('.frontmatter-block-container'))) || name.includes('code-block') || name.includes('frontmatter')) return true;
          if (name.includes('table-content-host') || name.includes('table-scroll-track') || element.tagName === 'TD' || element.tagName === 'TH') return true;
          if (name.includes('image-block') || testId.includes('image-placeholder')) return true;
          if (name.includes('video-block') || name.includes('mermaid-block')) return true;
          if (name.includes('callout') || name.includes('blockquote')) return true;
          if (name.includes('bg-[var(--vlaina-color-editor-image-surface)]')) return true;
          return false;
        };
        const describeElement = (element: HTMLElement, style: CSSStyleDeclaration) => ({
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          className: classText(element).slice(0, 240),
          dataset: { ...element.dataset },
          tagName: element.tagName,
          text: normalize(element.textContent).slice(0, 120),
        });

        const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks() as Array<{
          className: string;
          dataset: Record<string, string>;
          tagName: string;
          text: string;
        }>;
        const reports: ChaosBlockReport[] = [];

        for (let index = 0; index < blocks.length; index += 1) {
          const block = blocks[index];
          await (window as any).__vlainaE2E.selectNoteBlocksByIndexes([index]);
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          const selectedElements = Array.from(editor.querySelectorAll<HTMLElement>('.editor-block-selected, .ProseMirror-selectednode'));
          const selected = selectedElements[0] ?? null;
          if (!selected) {
            reports.push({
              className: block.className,
              dataset: block.dataset,
              index,
              offenders: [],
              ok: true,
              selectedCount: 0,
              tagName: block.tagName,
              text: normalize(block.text).slice(0, 120),
            });
            continue;
          }

          selected.scrollIntoView({ block: 'center', inline: 'nearest' });
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          const elements = [selected, ...Array.from(selected.querySelectorAll<HTMLElement>('*'))];
          const offenders = elements.flatMap((element) => {
            if (isIgnoredSurface(element) || !isSurfaceCandidate(element)) return [];
            const rect = element.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) return [];
            const style = getComputedStyle(element);
            const rootOrWrapper = element === selected || element.dataset.imageSelectionWrapper === 'true';
            const allowedBackground = rootOrWrapper
              ? isTransparentColor(style.backgroundColor) || isExpectedColor(style.backgroundColor, expectedBackground)
              : isTransparentColor(style.backgroundColor);
            const hasBadBackground = !allowedBackground;
            const hasBadImage = style.backgroundImage !== 'none' && !rootOrWrapper;
            if (!hasBadBackground && !hasBadImage) return [];
            return [describeElement(element, style)];
          });
          reports.push({
            className: block.className,
            dataset: block.dataset,
            index,
            offenders,
            ok: offenders.length === 0,
            selectedCount: selectedElements.length,
            tagName: block.tagName,
            text: normalize(block.text).slice(0, 120),
          });
        }

        const topLevelBlocks = Array.from(editor.children)
          .filter((element): element is HTMLElement => element instanceof HTMLElement)
          .map((element, index) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              className: classText(element),
              dataset: { ...element.dataset },
              height: Math.round(rect.height * 100) / 100,
              index,
              marginBottom: style.marginBottom,
              marginTop: style.marginTop,
              tagName: element.tagName,
              text: normalize(element.textContent).slice(0, 80),
              top: Math.round(rect.top * 100) / 100,
              bottom: Math.round(rect.bottom * 100) / 100,
            };
          })
          .filter((block) => block.height > 0.5)
          .sort((left, right) => left.top - right.top);
        const adjacentGaps = topLevelBlocks.slice(1).map((block, offset) => ({
          gap: Math.round((block.top - topLevelBlocks[offset].bottom) * 100) / 100,
          next: block,
          previous: topLevelBlocks[offset],
        }));
        const overlaps = adjacentGaps.filter((sample) => sample.gap < -1);
        const blankLineRows = topLevelBlocks.filter((block) => (
          block.dataset.value === '<!--vlaina-markdown-blank-line-->' ||
          block.className.includes('editor-editable-markdown-blank-line')
        ));
        const blankLineHeights = blankLineRows.map((block) => block.height);
        const blankLineHeightSpread = blankLineHeights.length > 1
          ? Math.round((Math.max(...blankLineHeights) - Math.min(...blankLineHeights)) * 100) / 100
          : 0;
        const blankLineNextGaps = adjacentGaps.filter((sample) => (
          sample.previous.dataset.value === '<!--vlaina-markdown-blank-line-->' ||
          sample.previous.className.includes('editor-editable-markdown-blank-line')
        ));
        const stackedBlankLineGaps = blankLineNextGaps.filter((sample) => sample.gap > 7);

        return {
          expectedBackground,
          blockCount: blocks.length,
          reports,
          unselectableTargets: reports
            .filter((report) => report.selectedCount === 0)
            .map((report) => ({
              className: report.className,
              dataset: report.dataset,
              index: report.index,
              tagName: report.tagName,
              text: report.text,
            })),
          spacing: {
            blankLineHeightSpread,
            blankLineRows,
            overlaps,
            stackedBlankLineGaps,
            topLevelCount: topLevelBlocks.length,
          },
        };
      }, { editorSelector: EDITOR_SELECTOR });

      expect(audit).not.toBeNull();
      expect(audit!.expectedBackground).toBe('rgb(11, 37, 56)');
      expect(audit!.blockCount).toBeGreaterThan(50);
      const auditedSelectionCount = audit!.reports.filter((report) => report.selectedCount > 0).length;
      expect(
        auditedSelectionCount / audit!.blockCount,
        JSON.stringify(audit!.unselectableTargets, null, 2),
      ).toBeGreaterThan(0.95);
      const colorFailures = audit!.reports.filter((report) => report.selectedCount > 0 && !report.ok);
      expect(colorFailures, JSON.stringify(colorFailures.slice(0, 20), null, 2)).toEqual([]);
      expect(audit!.spacing.overlaps, JSON.stringify(audit!.spacing.overlaps.slice(0, 20), null, 2)).toEqual([]);
      expect(audit!.spacing.blankLineHeightSpread, JSON.stringify(audit!.spacing.blankLineRows.slice(0, 20), null, 2))
        .toBeLessThanOrEqual(1);
      expect(audit!.spacing.stackedBlankLineGaps, JSON.stringify(audit!.spacing.stackedBlankLineGaps.slice(0, 20), null, 2))
        .toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
