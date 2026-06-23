import { expect, test, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

type InlineCodeSelectionGeometry = {
  block: {
    className: string;
    rect: { top: number; right: number; bottom: number; left: number; width: number; height: number };
    after: { content: string; display: string; top: string; bottom: string; background: string };
    background: string;
  };
  code: InlineSelectedElementGeometry;
  highlight: InlineSelectedElementGeometry;
  clip: { x: number; y: number; width: number; height: number };
  samplePoints: Array<{ label: string; x: number; y: number }>;
};

type InlineSelectedElementGeometry = {
  rect: { top: number; right: number; bottom: number; left: number; width: number; height: number };
  background: string;
  outline: string;
  boxShadow: string;
};

type PixelSample = {
  label: string;
  sample: { red: number; green: number; blue: number; alpha: number };
};

function parseRgb(value: string) {
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
  if (match) {
    return {
      red: Number.parseInt(match[1] ?? '0', 10),
      green: Number.parseInt(match[2] ?? '0', 10),
      blue: Number.parseInt(match[3] ?? '0', 10),
    };
  }

  const srgbMatch = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
  if (srgbMatch) {
    return {
      red: Math.round(Number.parseFloat(srgbMatch[1] ?? '0') * 255),
      green: Math.round(Number.parseFloat(srgbMatch[2] ?? '0') * 255),
      blue: Math.round(Number.parseFloat(srgbMatch[3] ?? '0') * 255),
    };
  }

  throw new Error(`Could not parse RGB value: ${value}`);
}

function colorDistance(
  left: { red: number; green: number; blue: number },
  right: { red: number; green: number; blue: number },
) {
  return Math.abs(left.red - right.red) +
    Math.abs(left.green - right.green) +
    Math.abs(left.blue - right.blue);
}

function expectSampleMatchesCssColor(
  samples: PixelSample[],
  color: string,
  label: string,
) {
  const sample = samples.find((entry) => entry.label === label);
  expect(sample, `missing pixel sample: ${label}`).toBeDefined();
  const expected = parseRgb(color);
  expect(
    colorDistance(sample!.sample, expected),
    JSON.stringify({ label, sample, expected }, null, 2),
  ).toBeLessThanOrEqual(12);
}

function expectSampleMatchesColor(
  samples: PixelSample[],
  color: string,
  label: string,
) {
  const sample = samples.find((entry) => entry.label === label);
  expect(sample, `missing pixel sample: ${label}`).toBeDefined();
  const expected = parseRgb(color);
  expect(
    colorDistance(sample!.sample, expected),
    JSON.stringify({ label, sample, expected }, null, 2),
  ).toBeLessThanOrEqual(12);
}

function expectCssColorMatches(left: string, right: string) {
  expect(
    colorDistance(parseRgb(left), parseRgb(right)),
    JSON.stringify({ left, right }, null, 2),
  ).toBeLessThanOrEqual(12);
}

async function measureInlineCodeSelection(page: Page, indexes: number[]) {
  const geometry = await page.evaluate(async (targetIndexes): Promise<InlineCodeSelectionGeometry | null> => {
    const roundRect = (rect: DOMRect) => ({
      top: Math.round(rect.top * 100) / 100,
      right: Math.round(rect.right * 100) / 100,
      bottom: Math.round(rect.bottom * 100) / 100,
      left: Math.round(rect.left * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
    });
    const bridge = (window as any).__vlainaE2E;
    await bridge.selectNoteBlocksByIndexes(targetIndexes);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    const code = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror code:not(pre code)'))
      .find((element) => element.textContent?.includes('inline_code_probe')) ?? null;
    const highlight = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror mark.highlight, .milkdown .ProseMirror .highlight'))
      .find((element) => element.textContent?.includes('highlight_probe')) ?? null;
    const block = code?.closest<HTMLElement>('.editor-block-selected, .editor-native-selected-textlike') ?? null;
    if (!editor || !code || !highlight || !block) return null;

    const blockRect = block.getBoundingClientRect();
    const codeRect = code.getBoundingClientRect();
    const highlightRect = highlight.getBoundingClientRect();
    const blockStyle = getComputedStyle(block);
    const codeStyle = getComputedStyle(code);
    const highlightStyle = getComputedStyle(highlight);
    const after = getComputedStyle(block, '::after');
    const codeCenterX = codeRect.left + codeRect.width / 2;
    const highlightCenterX = highlightRect.left + highlightRect.width / 2;
    const clipLeft = Math.min(codeRect.left, highlightRect.left);
    const clipTop = Math.min(codeRect.top, highlightRect.top);
    const clipRight = Math.max(codeRect.right, highlightRect.right);
    const clipBottom = Math.max(codeRect.bottom, highlightRect.bottom);
    const clip = {
      x: Math.max(0, Math.floor(clipLeft - 14)),
      y: Math.max(0, Math.floor(clipTop - 8)),
      width: Math.max(1, Math.ceil(clipRight - clipLeft + 28)),
      height: Math.max(1, Math.ceil(clipBottom - clipTop + 16)),
    };

    return {
      block: {
        className: block.className,
        rect: roundRect(blockRect),
        after: {
          content: after.content,
          display: after.display,
          top: after.top,
          bottom: after.bottom,
          background: after.backgroundColor,
        },
        background: blockStyle.backgroundColor,
      },
      code: {
        rect: roundRect(codeRect),
        background: codeStyle.backgroundColor,
        outline: codeStyle.outline,
        boxShadow: codeStyle.boxShadow,
      },
      highlight: {
        rect: roundRect(highlightRect),
        background: highlightStyle.backgroundColor,
        outline: highlightStyle.outline,
        boxShadow: highlightStyle.boxShadow,
      },
      clip,
      samplePoints: [
        { label: 'above-code-center', x: codeCenterX, y: codeRect.top - 2 },
        { label: 'code-top-center', x: codeCenterX, y: codeRect.top + 1 },
        { label: 'code-mid-center', x: codeCenterX, y: codeRect.top + codeRect.height / 2 },
        { label: 'above-highlight-center', x: highlightCenterX, y: highlightRect.top - 2 },
        { label: 'highlight-top-center', x: highlightCenterX, y: highlightRect.top + 1 },
      ],
    };
  }, indexes);

  expect(geometry).not.toBeNull();
  const resolvedGeometry = geometry!;
  const screenshot = await page.screenshot({ clip: resolvedGeometry.clip });
  const samples = await page.evaluate(async ({ imageUrl, geometry }) => {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to load inline-code selection screenshot'));
      image.src = imageUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not create canvas context');
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    const scaleX = image.naturalWidth / geometry.clip.width;
    const scaleY = image.naturalHeight / geometry.clip.height;
    return geometry.samplePoints.map((point) => {
      const x = Math.max(0, Math.min(image.naturalWidth - 1, Math.round((point.x - geometry.clip.x) * scaleX)));
      const y = Math.max(0, Math.min(image.naturalHeight - 1, Math.round((point.y - geometry.clip.y) * scaleY)));
      const offset = (y * data.width + x) * 4;
      return {
        ...point,
        sample: {
          red: data.data[offset] ?? 0,
          green: data.data[offset + 1] ?? 0,
          blue: data.data[offset + 2] ?? 0,
          alpha: data.data[offset + 3] ?? 0,
        },
      };
    });
  }, {
    imageUrl: `data:image/png;base64,${screenshot.toString('base64')}`,
    geometry: geometry!,
  });

  return { geometry: resolvedGeometry, samples };
}

test.describe('notes inline mark block selection', () => {
  test('keeps adjacent text block selection connected while inline code and highlights remain selected', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-inline-code-block-selection');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await openMarkdownFixture(page, {
        filename: 'inline-code-block-selection.md',
        content: [
          'Previous selected paragraph.',
          '',
          'Target paragraph with `inline_code_probe` and ==highlight_probe== surrounding text.',
          '',
          'Following paragraph.',
        ].join('\n'),
      });

      const single = await measureInlineCodeSelection(page, [2]);
      const multi = await measureInlineCodeSelection(page, [0, 1, 2]);

      expect(single.geometry.block.className).not.toContain('editor-block-selected-has-previous');
      expect(multi.geometry.block.className).toContain('editor-block-selected-has-previous');
      expect(Number.parseFloat(multi.geometry.block.after.top)).toBeLessThan(0);

      expect(single.geometry.code.outline).toContain('none');
      expect(single.geometry.code.boxShadow).toContain('inset');
      expectSampleMatchesColor(single.samples, 'rgb(255, 255, 255)', 'code-top-center');
      expectSampleMatchesCssColor(
        single.samples,
        single.geometry.code.background,
        'code-mid-center',
      );
      expect(single.geometry.highlight.outline).toContain('none');
      expect(single.geometry.highlight.boxShadow).toContain('inset');
      expectCssColorMatches(single.geometry.highlight.background, single.geometry.block.after.background);
      expectSampleMatchesColor(single.samples, 'rgb(255, 255, 255)', 'highlight-top-center');
      expect(multi.geometry.code.outline).toContain('none');
      expect(multi.geometry.code.boxShadow).toContain('inset');
      expectSampleMatchesCssColor(
        multi.samples,
        multi.geometry.block.after.background,
        'above-code-center',
      );
      expectSampleMatchesColor(multi.samples, 'rgb(255, 255, 255)', 'code-top-center');
      expectSampleMatchesCssColor(
        multi.samples,
        multi.geometry.code.background,
        'code-mid-center',
      );
      expect(multi.geometry.highlight.outline).toContain('none');
      expect(multi.geometry.highlight.boxShadow).toContain('inset');
      expectCssColorMatches(multi.geometry.highlight.background, multi.geometry.block.after.background);
      expectSampleMatchesCssColor(
        multi.samples,
        multi.geometry.block.after.background,
        'above-highlight-center',
      );
      expectSampleMatchesColor(multi.samples, 'rgb(255, 255, 255)', 'highlight-top-center');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
