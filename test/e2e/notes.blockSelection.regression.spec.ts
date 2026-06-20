import { expect, test, type Page } from "@playwright/test";
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getBlankAreaDragTarget,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from "./notesE2E";

type TextClip = {
  height: number;
  label: string;
  left: number;
  top: number;
  width: number;
};

async function measureBrightTextPixels(page: Page, clip: TextClip) {
  const screenshot = await page.screenshot({
    clip: {
      x: Math.max(0, clip.left),
      y: Math.max(0, clip.top),
      width: Math.max(1, clip.width),
      height: Math.max(1, clip.height),
    },
  });

  return page.evaluate(async ({ imageUrl, label }) => {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to load sampled text screenshot'));
      image.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not create text sample canvas');
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    let bright = 0;
    let blueSelection = 0;
    const total = imageData.width * imageData.height;
    for (let offset = 0; offset < imageData.data.length; offset += 4) {
      const red = imageData.data[offset] ?? 0;
      const green = imageData.data[offset + 1] ?? 0;
      const blue = imageData.data[offset + 2] ?? 0;
      if (red >= 235 && green >= 235 && blue >= 230) bright += 1;
      if (red >= 175 && red <= 205 && green >= 210 && green <= 235 && blue >= 240) blueSelection += 1;
    }
    return {
      label,
      brightRatio: bright / total,
      blueSelectionRatio: blueSelection / total,
      height: imageData.height,
      width: imageData.width,
    };
  }, {
    imageUrl: `data:image/png;base64,${screenshot.toString('base64')}`,
    label: clip.label,
  });
}

async function collectSelectedTextClips(page: Page) {
  return page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    const selectedElements = editor
      ? Array.from(editor.querySelectorAll<HTMLElement>('.editor-block-selected'))
      : [];
    if (!editor || selectedElements.length === 0) return null;

    const textClips: TextClip[] = [];
    for (const selected of selectedElements) {
      const walker = document.createTreeWalker(selected, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        if (!text.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = Array.from(range.getClientRects()).find((candidate) => (
          candidate.width > 0 && candidate.height > 0
        ));
        range.detach();
        if (!rect) continue;
        textClips.push({
          label: text.trim(),
          left: Math.max(0, Math.floor(rect.left)),
          top: Math.max(0, Math.floor(rect.top)),
          width: Math.max(1, Math.ceil(rect.width)),
          height: Math.max(1, Math.ceil(rect.height)),
        });
      }
    }

    return {
      pending: editor.classList.contains('editor-block-selection-pending'),
      selectedTexts: selectedElements.map((element) => element.textContent?.trim() ?? ''),
      textClips,
    };
  });
}

async function collectLineFillContinuity(page: Page) {
  return page.evaluate(() => {
    const fills = Array.from(document.querySelectorAll<HTMLElement>(
      '.milkdown .editor-block-selection-line-fill'
    )).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left * 100) / 100,
        right: Math.round(rect.right * 100) / 100,
        top: Math.round(rect.top * 100) / 100,
        bottom: Math.round(rect.bottom * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      };
    }).sort((left, right) => left.top - right.top);

    const gaps: number[] = [];
    for (let index = 0; index < fills.length - 1; index += 1) {
      const current = fills[index];
      const next = fills[index + 1];
      if (!current || !next) continue;
      const horizontalOverlap = Math.min(current.right, next.right) - Math.max(current.left, next.left);
      if (horizontalOverlap <= 0) continue;
      gaps.push(Math.round((next.top - current.bottom) * 100) / 100);
    }

    return {
      fills,
      gaps,
      maxPositiveGap: gaps.reduce((max, gap) => Math.max(max, gap), 0),
    };
  });
}

async function installBlockSelectionConflictTheme(page: Page) {
  const themeDirectoryPath = await page.evaluate(() =>
    (window as any).__vlainaE2E.getImportedMarkdownThemesDirectoryPath()
  );
  const cssFilename = 'block-selection-conflict-typora.css';
  const css = [
    ':root { --text-color: #242424; --bg-color: #ffffff; }',
    '#write { color: var(--text-color); background: var(--bg-color); }',
    '#write strong,',
    '#write strong * {',
    '  color: transparent !important;',
    '  -webkit-text-fill-color: transparent !important;',
    '}',
    '#write .ProseMirror.editor-block-selection-pending .code-block-chrome-header,',
    '#write .ProseMirror.editor-block-selection-pending .code-block-chrome-language,',
    '#write .ProseMirror.editor-block-selection-pending .code-block-chrome-language-label {',
    '  display: none !important;',
    '  visibility: hidden !important;',
    '  opacity: 0 !important;',
    '  transition: opacity 30s linear !important;',
    '}',
    '#write .ProseMirror.editor-block-selection-pending .code-block-chrome-copy-button {',
    '  opacity: 1 !important;',
    '  pointer-events: auto !important;',
    '  transform: scale(1.2) !important;',
    '}',
  ].join('\n');

  await fs.mkdir(themeDirectoryPath, { recursive: true });
  await fs.writeFile(path.join(themeDirectoryPath, cssFilename), css, 'utf8');

  const syncResult = await page.evaluate(() =>
    (window as any).__vlainaE2E.syncImportedMarkdownThemesFromDirectory()
  );
  const theme = syncResult.themes.find((candidate: { sourcePath?: string | null; name: string }) =>
    candidate.sourcePath?.replace(/\\/g, '/').endsWith(`/${cssFilename}`) ||
    candidate.name === cssFilename.replace(/\.css$/i, '')
  );

  if (!theme) {
    throw new Error([
      `Could not sync synthetic block selection conflict theme ${cssFilename}`,
      `themeDirectoryPath=${themeDirectoryPath}`,
      `syncResult=${JSON.stringify(syncResult)}`,
    ].join('\n'));
  }

  await page.evaluate((themeId) =>
    (window as any).__vlainaE2E.setMarkdownImportedThemeId(themeId), theme.id);
  await expect.poll(() => page.evaluate((themeId) => {
    return {
      rootTheme: document.documentElement.getAttribute('data-vlaina-imported-app-theme'),
      markdownStyle: Boolean(document.head.querySelector(
        `style[data-vlaina-imported-markdown-theme="true"]#vlaina-imported-markdown-theme-${CSS.escape(themeId)}`
      )),
      postBridgeStyle: Boolean(document.head.querySelector(
        `style[data-vlaina-imported-markdown-theme-post-bridge="true"]#vlaina-imported-markdown-theme-post-bridge-${CSS.escape(themeId)}`
      )),
    };
  }, theme.id), { timeout: 30_000 }).toMatchObject({
    rootTheme: theme.id,
    markdownStyle: true,
    postBridgeStyle: true,
  });

  return theme;
}

async function expectImportedThemeRoot(page: Page, themeId: string) {
  await expect.poll(() => page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-markdown-theme-root="true"]');
    return {
      compatLayer: root?.dataset.markdownCompatLayer ?? null,
      importedTheme: root?.dataset.markdownImportedTheme ?? null,
      platform: root?.dataset.markdownThemePlatform ?? null,
    };
  }), { timeout: 30_000 }).toMatchObject({
    compatLayer: 'external',
    importedTheme: themeId,
    platform: 'typora',
  });
}

async function dragBlankAreaSelectionUntilPending(
  page: Page,
  start: { startX: number; startY: number },
  points: Array<{ x: number; y: number }>,
) {
  await page.mouse.move(start.startX, start.startY);
  await page.mouse.down();

  for (const point of points) {
    await page.mouse.move(point.x, point.y, { steps: 10 });
    await page.waitForTimeout(50);
    const pending = await page.evaluate(() => {
      const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
      return editor?.classList.contains('editor-block-selection-pending') ?? false;
    });
    if (pending) return true;
  }

  return page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    return editor?.classList.contains('editor-block-selection-pending') ?? false;
  });
}

test.describe("notes block selection regressions", () => {
  test.setTimeout(90_000);

  test('keeps inline-mark text visible when selecting a hard-break paragraph block', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-inline-mark-hard-break');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 945, height: 1036 });
      const conflictTheme = await installBlockSelectionConflictTheme(page);

      await openMarkdownFixture(page, {
        filename: 'block-selection-inline-mark-hard-break.md',
        content: [
          '好的，我们现在来安装 **zsh + oh-my-zsh**，让你的服务器终端更好用、更漂亮、更高效。\\',
          '这是程序员几乎人手必装的环境，美观又强大。',
        ].join('\n'),
      });
      await expectImportedThemeRoot(page, conflictTheme.id);

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('zsh + oh-my-zsh');

      const selectedCount = await page.evaluate(async () => {
        const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks() as Array<{ text: string }>;
        const index = blocks.findIndex((block) => block.text.includes('zsh + oh-my-zsh'));
        if (index < 0) return 0;
        const count = await (window as any).__vlainaE2E.selectNoteBlocksByIndexes([index]);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return count;
      });
      expect(selectedCount).toBe(1);

      const visibility = await page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        const selectedElements = editor
          ? Array.from(editor.querySelectorAll<HTMLElement>('.editor-block-selected'))
          : [];
        if (!editor || selectedElements.length === 0) return null;

        const nodeRects: Array<{
          text: string;
          color: string;
          textFillColor: string;
          backgroundColor: string;
          hitClassName: string;
          hitTagName: string;
          hitText: string;
          rect: { height: number; left: number; top: number; width: number };
        }> = [];

        for (const selected of selectedElements) {
          const walker = document.createTreeWalker(selected, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent ?? '';
            if (!text.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            const rect = Array.from(range.getClientRects()).find((candidate) => (
              candidate.width > 0 && candidate.height > 0
            ));
            range.detach();
            if (!rect) continue;

            const x = rect.left + Math.min(rect.width - 1, Math.max(1, rect.width / 2));
            const y = rect.top + Math.min(rect.height - 1, Math.max(1, rect.height / 2));
            const parent = node.parentElement ?? selected;
            const parentStyle = getComputedStyle(parent);
            const hit = document.elementFromPoint(x, y);
            nodeRects.push({
              text: text.trim(),
              color: parentStyle.color,
              textFillColor: parentStyle.webkitTextFillColor,
              backgroundColor: parentStyle.backgroundColor,
              hitClassName: hit instanceof HTMLElement ? hit.className : '',
              hitTagName: hit instanceof HTMLElement ? hit.tagName : '',
              hitText: hit instanceof HTMLElement ? (hit.textContent ?? '').replace(/\s+/g, ' ').trim() : '',
              rect: {
                height: Math.round(rect.height * 100) / 100,
                left: Math.round(rect.left * 100) / 100,
                top: Math.round(rect.top * 100) / 100,
                width: Math.round(rect.width * 100) / 100,
              },
            });
          }
        }

        const selected = selectedElements[0];
        const selectedStyle = getComputedStyle(selected);
        const after = getComputedStyle(selected, '::after');
        return {
          textClips: nodeRects.map((rect) => ({
            label: rect.text,
            left: Math.max(0, Math.floor(rect.rect.left)),
            top: Math.max(0, Math.floor(rect.rect.top)),
            width: Math.max(1, Math.ceil(rect.rect.width)),
            height: Math.max(1, Math.ceil(rect.rect.height)),
          })),
          selectedTexts: selectedElements.map((element) => element.textContent?.trim() ?? ''),
          selectedBackgroundColor: selectedStyle.backgroundColor,
          selectedClassName: selected.className,
          selectedColor: selectedStyle.color,
          selectedTextFillColor: selectedStyle.webkitTextFillColor,
          afterBackground: after.backgroundColor,
          afterContent: after.content,
          afterDisplay: after.display,
          afterZIndex: after.zIndex,
          nodeRects,
        };
      });

      expect(visibility, 'selected block visibility diagnostics').not.toBeNull();
      expect(visibility!.nodeRects, JSON.stringify(visibility, null, 2)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('现在来安装'),
            textFillColor: 'rgb(254, 251, 249)',
          }),
          expect.objectContaining({
            text: expect.stringContaining('zsh + oh-my-zsh'),
            textFillColor: 'rgb(254, 251, 249)',
          }),
        ]),
      );
      expect(
        visibility!.nodeRects.some((rect) => (
          rect.text.includes('现在来安装') &&
          rect.hitText.includes('现在来安装')
        )),
        JSON.stringify(visibility, null, 2),
      ).toBe(true);
      expect(
        visibility!.nodeRects.some((rect) => (
          rect.text.includes('zsh + oh-my-zsh') &&
          rect.hitText.includes('zsh + oh-my-zsh')
        )),
        JSON.stringify(visibility, null, 2),
      ).toBe(true);
      expect(
        visibility!.nodeRects.every((rect) => (
          !rect.text.includes('zsh + oh-my-zsh') ||
          rect.backgroundColor === 'rgba(0, 0, 0, 0)'
        )),
        JSON.stringify(visibility, null, 2),
      ).toBe(true);
      const lineFillContinuity = await collectLineFillContinuity(page);
      expect(lineFillContinuity.fills.length, JSON.stringify(lineFillContinuity, null, 2)).toBeGreaterThanOrEqual(2);
      expect(
        lineFillContinuity.maxPositiveGap,
        JSON.stringify(lineFillContinuity, null, 2),
      ).toBeLessThanOrEqual(1);

      const clips = visibility!.textClips.filter((clip: TextClip) => (
        clip.label.includes('现在来安装') || clip.label.includes('zsh + oh-my-zsh')
      ));
      const samples = await Promise.all(clips.map((clip: TextClip) => measureBrightTextPixels(page, clip)));
      expect(
        samples.every((sample) => sample.brightRatio > 0.008 && sample.blueSelectionRatio > 0.35),
        JSON.stringify({ visibility, samples }, null, 2),
      ).toBe(true);

      await page.evaluate(() => (window as any).__vlainaE2E.selectNoteBlocksByIndexes([]));
      await expect.poll(() => page.evaluate(() =>
        document.querySelectorAll('.milkdown .ProseMirror .editor-block-selected').length
      ), { timeout: 10_000 }).toBe(0);
      const dragTarget = await getBlankAreaDragTarget(page, 'zsh + oh-my-zsh');
      expect(dragTarget, 'blank-area drag target').not.toBeNull();
      const dragPending = await dragBlankAreaSelectionUntilPending(page, dragTarget!, [
        { x: dragTarget!.endX, y: dragTarget!.startY + 12 },
        { x: dragTarget!.endX, y: dragTarget!.endY },
      ]);
      expect(dragPending, JSON.stringify(dragTarget, null, 2)).toBe(true);

      const pendingVisibility = await collectSelectedTextClips(page);
      expect(pendingVisibility, 'pending drag selected text clips').not.toBeNull();
      expect(pendingVisibility!.pending, JSON.stringify(pendingVisibility, null, 2)).toBe(true);
      const pendingClips = pendingVisibility!.textClips.filter((clip) => (
        clip.label.includes('现在来安装') || clip.label.includes('zsh + oh-my-zsh')
      ));
      const pendingSamples = await Promise.all(pendingClips.map((clip) => measureBrightTextPixels(page, clip)));
      expect(
        pendingSamples.every((sample) => sample.brightRatio > 0.008 && sample.blueSelectionRatio > 0.35),
        JSON.stringify({ pendingVisibility, pendingSamples }, null, 2),
      ).toBe(true);

      await page.mouse.up();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps code block language header stable while blank-area dragging over code blocks', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-code-header-drag');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      const conflictTheme = await installBlockSelectionConflictTheme(page);

      await openMarkdownFixture(page, {
        filename: 'block-selection-code-header-drag.md',
        content: [
          'Drag selection anchor paragraph sentinel.',
          '',
          '```zsh',
          'echo "install zsh"',
          '```',
          '',
          'After code block sentinel.',
        ].join('\n'),
      });
      await expectImportedThemeRoot(page, conflictTheme.id);

      await expect(page.locator(`${EDITOR_SELECTOR} .code-block-container`, { hasText: 'install zsh' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .code-block-chrome-language-label`).first()).toBeVisible();
      const initialLabelText = await page.locator(`${EDITOR_SELECTOR} .code-block-chrome-language-label`).first().textContent();
      expect(initialLabelText?.trim()).toBeTruthy();

      const dragTarget = await getBlankAreaDragTarget(page, 'Drag selection anchor paragraph sentinel');
      expect(dragTarget, 'blank-area drag target').not.toBeNull();
      const codeHeaderPoint = await page.evaluate(() => {
        const header = document.querySelector<HTMLElement>('.milkdown .ProseMirror .code-block-chrome-header');
        if (!header) return null;
        header.scrollIntoView({ block: 'center', inline: 'nearest' });
        const rect = header.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      });
      expect(codeHeaderPoint, 'code header point').not.toBeNull();

      await page.mouse.move(dragTarget!.startX, dragTarget!.startY);
      const dragPending = await dragBlankAreaSelectionUntilPending(page, dragTarget!, [
        {
          x: codeHeaderPoint!.x,
          y: codeHeaderPoint!.y,
        },
        {
          x: codeHeaderPoint!.x,
          y: codeHeaderPoint!.y + 24,
        },
      ]);
      expect(dragPending, JSON.stringify({ dragTarget, codeHeaderPoint }, null, 2)).toBe(true);

      const samples = await page.evaluate(async () => {
        const frames: Array<{
          copyOpacity: string;
          copyPointerEvents: string;
          headerDisplay: string;
          labelColor: string;
          labelDisplay: string;
          labelOpacity: string;
          labelText: string;
          labelVisibility: string;
          pending: boolean;
        }> = [];

        for (let index = 0; index < 12; index += 1) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
          const header = document.querySelector<HTMLElement>('.milkdown .ProseMirror .code-block-chrome-header');
          const label = document.querySelector<HTMLElement>('.milkdown .ProseMirror .code-block-chrome-language-label');
          const copy = document.querySelector<HTMLElement>('.milkdown .ProseMirror .code-block-chrome-copy-button');
          const headerStyle = header ? getComputedStyle(header) : null;
          const labelStyle = label ? getComputedStyle(label) : null;
          const copyStyle = copy ? getComputedStyle(copy) : null;
          frames.push({
            copyOpacity: copyStyle?.opacity ?? '',
            copyPointerEvents: copyStyle?.pointerEvents ?? '',
            headerDisplay: headerStyle?.display ?? '',
            labelColor: labelStyle?.color ?? '',
            labelDisplay: labelStyle?.display ?? '',
            labelOpacity: labelStyle?.opacity ?? '',
            labelText: label?.textContent?.trim() ?? '',
            labelVisibility: labelStyle?.visibility ?? '',
            pending: editor?.classList.contains('editor-block-selection-pending') ?? false,
          });
        }

        return frames;
      });

      expect(samples.some((sample) => sample.pending), JSON.stringify(samples, null, 2)).toBe(true);
      expect(samples.every((sample) => (
        sample.headerDisplay !== 'none' &&
        sample.labelDisplay !== 'none' &&
        sample.labelVisibility !== 'hidden' &&
        sample.labelOpacity !== '0' &&
        sample.labelText === initialLabelText?.trim() &&
        sample.copyOpacity === '0' &&
        sample.copyPointerEvents === 'none'
      )), JSON.stringify(samples, null, 2)).toBe(true);

      await page.mouse.up();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
