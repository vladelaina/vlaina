import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  NOTE_COVER_CROPPER_SELECTOR,
  NOTE_COVER_IMAGE_SELECTOR,
  NOTE_COVER_REGION_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  closeElectron,
  collectEditorDomMetrics,
  createNotesRootFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  measureRepeatedBlockScan,
  measureScrollFrames,
  openNotesRootInNotes,
  scrollNoteToTop,
  startMainThreadFrameProbe,
  stopMainThreadFrameProbe,
  waitForEditorAnimationFrame,
} from './notesE2E';

const ANIMATED_GIF_BASE64 = 'R0lGODlhIAAQAPf/MQAA/v0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAP0AAAD/ACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEFAAfACwAAAAAIAAQAAAIJwADCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjxADAgAh+QQFFAD/ACwfAA8AAQABAAAIBAD/BQQAIfkEBRQA/wAsAAAAACAAEAAACCcAAQgcSLCgwYMIEypcyLChw4cQI0qcSLGixYsYM2rcyLGjx48QAwIAIfkEBRQA/wAsHwAPAAEAAQAACAQA/wUEADs=';

const COVER_ASSET_PATH = 'assets/e2e-cover.svg';
const NOTE_ICON_ASSET_PATH = 'assets/e2e-note-icon.svg';
const NOTE_COVER_ADD_OVERLAY_SELECTOR = '[data-note-cover-add-overlay="true"]';
const COVER_HEIGHT = 220;
const COVER_INITIAL_Y = 35;
const SWITCH_COVER_COUNT = 10;
const SWITCH_COVER_ASSET_PATHS = Array.from(
  { length: SWITCH_COVER_COUNT },
  (_value, index) => `assets/e2e-cover-switch-${index.toString().padStart(2, '0')}.svg`,
);
const SWITCH_COVER_GRID_FILENAMES = SWITCH_COVER_ASSET_PATHS.map((assetPath) => `./${assetPath}`);

const COVER_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">',
  '<defs>',
  '<linearGradient id="cover" x1="0" y1="0" x2="1" y2="1">',
  '<stop offset="0" stop-color="#1d4ed8"/>',
  '<stop offset="0.45" stop-color="#14b8a6"/>',
  '<stop offset="1" stop-color="#f59e0b"/>',
  '</linearGradient>',
  '</defs>',
  '<rect width="1200" height="400" fill="url(#cover)"/>',
  '<circle cx="950" cy="110" r="130" fill="#ffffff" opacity="0.22"/>',
  '<rect x="90" y="95" width="430" height="54" rx="18" fill="#ffffff" opacity="0.45"/>',
  '<rect x="90" y="185" width="650" height="32" rx="16" fill="#0f172a" opacity="0.30"/>',
  '<rect x="90" y="245" width="520" height="28" rx="14" fill="#ffffff" opacity="0.30"/>',
  '</svg>',
].join('');

const NOTE_ICON_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">',
  '<rect width="96" height="96" rx="18" fill="#0f766e"/>',
  '<path d="M25 25h32l14 14v32H25z" fill="#f8fafc"/>',
  '<path d="M57 25v14h14" fill="#d1fae5"/>',
  '<text x="48" y="63" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#0f766e">MD</text>',
  '</svg>',
].join('');

const SWITCH_COVER_PALETTES = [
  ['#0f766e', '#f97316', '#f8fafc'],
  ['#1d4ed8', '#22c55e', '#facc15'],
  ['#be123c', '#06b6d4', '#f8fafc'],
  ['#7c3aed', '#84cc16', '#f97316'],
  ['#0369a1', '#eab308', '#f43f5e'],
  ['#15803d', '#2563eb', '#f5f5f4'],
  ['#b45309', '#14b8a6', '#f8fafc'],
  ['#4338ca', '#fb7185', '#fde68a'],
  ['#0f172a', '#2dd4bf', '#facc15'],
  ['#a21caf', '#38bdf8', '#fef3c7'],
];

function createSwitchCoverSvg(index: number): string {
  const [primary, secondary, accent] = SWITCH_COVER_PALETTES[index % SWITCH_COVER_PALETTES.length]!;
  const label = `SWITCH ${index.toString().padStart(2, '0')}`;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">',
    '<defs>',
    `<linearGradient id="g-${index}" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="${primary}"/>`,
    `<stop offset="0.55" stop-color="${secondary}"/>`,
    `<stop offset="1" stop-color="${accent}"/>`,
    '</linearGradient>',
    '</defs>',
    `<rect width="1200" height="400" fill="url(#g-${index})"/>`,
    `<circle cx="${220 + index * 26}" cy="95" r="135" fill="${accent}" opacity="0.24"/>`,
    `<rect x="${780 - index * 18}" y="210" width="330" height="92" rx="30" fill="#020617" opacity="0.24"/>`,
    `<text x="90" y="165" font-family="Arial, sans-serif" font-size="74" font-weight="700" fill="${accent}">${label}</text>`,
    '<rect x="90" y="220" width="560" height="28" rx="14" fill="#ffffff" opacity="0.38"/>',
    '<rect x="90" y="270" width="420" height="24" rx="12" fill="#020617" opacity="0.22"/>',
    '</svg>',
  ].join('');
}

type CoverFixture = {
  notePath: string;
  notesRootPath: string;
};

type CoverFrontmatter = {
  assetPath: string | null;
  height: number | null;
  scale: number | null;
  x: number | null;
  y: number | null;
};

function createCoveredMarkdown(
  title: string,
  paragraphCount = 80,
  coverAssetPath = COVER_ASSET_PATH,
  iconAssetPath?: string,
): string {
  return [
    '---',
    `vlaina_cover: "${coverAssetPath}" x=50 y=${COVER_INITIAL_Y} height=${COVER_HEIGHT} scale=1`,
    ...(iconAssetPath ? [`vlaina_icon: "${iconAssetPath}"`] : []),
    '---',
    '',
    `# ${title}`,
    '',
    'Cover e2e sentinel paragraph near the top.',
    '',
    ...Array.from({ length: paragraphCount }, (_value, index) => (
      `Cover performance paragraph ${index + 1}: enough repeated text to make the editor scroll while the top cover remains stable.`
    )),
    '',
    'Final cover performance sentinel.',
  ].join('\n\n');
}

function parseCoverFrontmatter(markdown: string): CoverFrontmatter {
  const coverLine = /^vlaina_cover:\s*(.+)$/m.exec(markdown)?.[1] ?? '';
  const quotedAsset = /^\s*"((?:\\.|[^"\\])*)"/.exec(coverLine)?.[1];
  const unquotedAsset = /^\s*([^\s,;]+)/.exec(coverLine)?.[1];
  const getNumber = (key: string) => {
    const match = new RegExp(`(?:^|[\\s,;])${key}=(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))(?=$|[\\s,;])`).exec(coverLine);
    const value = Number(match?.[1]);
    return Number.isFinite(value) ? value : null;
  };

  return {
    assetPath: quotedAsset?.replace(/\\(["\\])/g, '$1') ?? unquotedAsset ?? null,
    x: getNumber('x'),
    y: getNumber('y'),
    height: getNumber('height'),
    scale: getNumber('scale'),
  };
}

async function openCoverFixture(
  page: Page,
  input: {
    filename: string;
    title: string;
    paragraphCount?: number;
    coverAssetPath?: string;
    iconAssetPath?: string;
    assetFiles?: Array<{ filename: string; content: string }>;
  },
): Promise<CoverFixture> {
  const assetFiles = input.assetFiles ?? [
    {
      filename: COVER_ASSET_PATH,
      content: COVER_SVG,
    },
  ];
  const fixture = await createNotesRootFilesFixture(page, {
    name: input.filename.replace(/\.md$/i, ''),
    files: [
      {
        filename: input.filename,
        content: createCoveredMarkdown(
          input.title,
          input.paragraphCount,
          input.coverAssetPath,
          input.iconAssetPath,
        ),
      },
      ...assetFiles,
    ],
  });

  await openNotesRootInNotes(page, {
    notesRootPath: fixture.notesRootPath,
    name: 'Cover E2E NotesRoot',
    minFileCount: 1,
  });

  const openStartedAt = Date.now();
  await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: input.filename.replace(/\.md$/i, '') }).first().click();
  await expect(page.locator(EDITOR_SELECTOR)).toContainText(input.title, { timeout: 30_000 });
  console.info('[notes-cover-open]', {
    filename: input.filename,
    openWallMs: Date.now() - openStartedAt,
  });

  return {
    notesRootPath: fixture.notesRootPath,
    notePath: fixture.notePaths[0]!,
  };
}

async function waitForCoverReady(page: Page) {
  const startedAt = Date.now();
  await expect(page.locator(NOTE_COVER_REGION_SELECTOR)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(NOTE_COVER_CROPPER_SELECTOR)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(NOTE_COVER_IMAGE_SELECTOR)).toBeVisible({ timeout: 30_000 });

  await expect.poll(async () => page.evaluate(({ regionSelector, cropperSelector, imageSelector }) => {
    const region = document.querySelector<HTMLElement>(regionSelector);
    const cropper = document.querySelector<HTMLElement>(cropperSelector);
    const image = document.querySelector<HTMLImageElement>(imageSelector);
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    const scrollRoot = editor?.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
    const regionRect = region?.getBoundingClientRect();
    const cropperRect = cropper?.getBoundingClientRect();
    const imageRect = image?.getBoundingClientRect();
    const editorRect = editor?.getBoundingClientRect();

    return {
      regionHeight: Math.round(regionRect?.height ?? 0),
      regionTop: Math.round(regionRect?.top ?? 0),
      regionBottom: Math.round(regionRect?.bottom ?? 0),
      cropperWidth: Math.round(cropperRect?.width ?? 0),
      cropperHeight: Math.round(cropperRect?.height ?? 0),
      imageWidth: Math.round(imageRect?.width ?? 0),
      imageHeight: Math.round(imageRect?.height ?? 0),
      naturalWidth: image?.naturalWidth ?? 0,
      naturalHeight: image?.naturalHeight ?? 0,
      imageSrcIsBlob: image?.src.startsWith('blob:') ?? false,
      imageTransform: image ? getComputedStyle(image).transform : '',
      objectFitMode: cropper?.dataset.objectFit ?? null,
      editorTop: Math.round(editorRect?.top ?? 0),
      scrollHeight: scrollRoot?.scrollHeight ?? 0,
      clientHeight: scrollRoot?.clientHeight ?? 0,
      sourceFallbackCount: document.querySelectorAll('[data-note-source-fallback="true"]').length,
    };
  }, {
    regionSelector: NOTE_COVER_REGION_SELECTOR,
    cropperSelector: NOTE_COVER_CROPPER_SELECTOR,
    imageSelector: NOTE_COVER_IMAGE_SELECTOR,
  }), { timeout: 30_000 }).toMatchObject({
    imageSrcIsBlob: true,
    naturalWidth: 1200,
    naturalHeight: 400,
    sourceFallbackCount: 0,
  });

  const finalMetrics = await page.evaluate(({ regionSelector, cropperSelector, imageSelector }) => {
    const region = document.querySelector<HTMLElement>(regionSelector)!;
    const cropper = document.querySelector<HTMLElement>(cropperSelector)!;
    const image = document.querySelector<HTMLImageElement>(imageSelector)!;
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror')!;
    const scrollRoot = editor.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
    const regionRect = region.getBoundingClientRect();
    const cropperRect = cropper.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();

    return {
      regionHeight: Math.round(regionRect.height),
      regionTop: Math.round(regionRect.top),
      regionBottom: Math.round(regionRect.bottom),
      cropperWidth: Math.round(cropperRect.width),
      cropperHeight: Math.round(cropperRect.height),
      imageWidth: Math.round(imageRect.width),
      imageHeight: Math.round(imageRect.height),
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      imageSrcIsBlob: image.src.startsWith('blob:'),
      imageTransform: getComputedStyle(image).transform,
      objectFitMode: cropper.dataset.objectFit ?? null,
      editorTop: Math.round(editorRect.top),
      scrollHeight: scrollRoot?.scrollHeight ?? 0,
      clientHeight: scrollRoot?.clientHeight ?? 0,
      sourceFallbackCount: document.querySelectorAll('[data-note-source-fallback="true"]').length,
    };
  }, {
    regionSelector: NOTE_COVER_REGION_SELECTOR,
    cropperSelector: NOTE_COVER_CROPPER_SELECTOR,
    imageSelector: NOTE_COVER_IMAGE_SELECTOR,
  });

  console.info('[notes-cover-ready]', {
    ...finalMetrics,
    readyWallMs: Date.now() - startedAt,
  });

  return finalMetrics;
}

async function readCoverFrontmatter(page: Page, notePath: string): Promise<CoverFrontmatter> {
  const markdown = await page.evaluate((pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead), notePath);
  return parseCoverFrontmatter(markdown);
}

async function expectCoverFrontmatter(
  page: Page,
  notePath: string,
  predicate: (frontmatter: CoverFrontmatter) => boolean,
): Promise<CoverFrontmatter> {
  let lastValue: CoverFrontmatter = {
    assetPath: null,
    x: null,
    y: null,
    height: null,
    scale: null,
  };
  await expect.poll(async () => {
    lastValue = await readCoverFrontmatter(page, notePath);
    return predicate(lastValue);
  }, { timeout: 10_000 }).toBe(true);
  return lastValue;
}

async function clickCoverCenter(page: Page) {
  const box = await page.locator(NOTE_COVER_CROPPER_SELECTOR).boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

async function clickVisibleEditorText(page: Page, text: string) {
  const point = await page.evaluate(({ editorSelector, text }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) return null;

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const value = node.textContent ?? '';
      const index = value.indexOf(text);
      if (index >= 0) {
        const range = document.createRange();
        const offset = index + Math.min(16, Math.max(1, text.length - 1));
        range.setStart(node, offset);
        range.setEnd(node, Math.min(value.length, offset + 1));
        const rect = range.getBoundingClientRect();
        range.detach();
        if (rect.width > 0 && rect.height > 0) {
          const x = rect.left + Math.min(4, rect.width / 2);
          const y = rect.top + rect.height / 2;
          const hit = document.elementFromPoint(x, y);
          return {
            x,
            y,
            hitTagName: hit instanceof HTMLElement ? hit.tagName : null,
            hitText: hit instanceof HTMLElement ? hit.textContent?.trim().slice(0, 80) ?? '' : '',
          };
        }
      }
      node = walker.nextNode();
    }

    return null;
  }, { editorSelector: EDITOR_SELECTOR, text });

  expect(point, `Expected visible editor text point for ${text}`).not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
  await waitForEditorAnimationFrame(page);
  return point!;
}

async function clickEditorParagraphRightBlank(page: Page, text: string) {
  const point = await page.evaluate(({ editorSelector, text }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) return null;
    const paragraph = Array.from(editor.querySelectorAll<HTMLElement>('p'))
      .find((candidate) => candidate.textContent?.includes(text)) ?? null;
    if (!paragraph) return null;
    const rect = paragraph.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = rect.right - Math.min(36, Math.max(12, rect.width * 0.08));
    const y = rect.top + Math.min(rect.height - 2, Math.max(2, rect.height / 2));
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      hitTagName: hit instanceof HTMLElement ? hit.tagName : null,
      hitText: hit instanceof HTMLElement ? hit.textContent?.trim().slice(0, 80) ?? '' : '',
    };
  }, { editorSelector: EDITOR_SELECTOR, text });

  expect(point, `Expected visible paragraph blank point for ${text}`).not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
  await waitForEditorAnimationFrame(page);
  return point!;
}

async function clickEditorSideBlank(page: Page, text: string) {
  const point = await page.evaluate(({ editorSelector, text }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const scrollRoot = document.querySelector<HTMLElement>('[data-note-scroll-root="true"]');
    if (!editor || !scrollRoot) return null;
    const paragraph = Array.from(editor.querySelectorAll<HTMLElement>('p'))
      .find((candidate) => candidate.textContent?.includes(text)) ?? null;
    if (!paragraph) return null;

    const paragraphRect = paragraph.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const scrollRootRect = scrollRoot.getBoundingClientRect();
    const y = paragraphRect.top + Math.min(paragraphRect.height - 2, Math.max(2, paragraphRect.height / 2));
    const leftBlankX = Math.max(scrollRootRect.left + 24, editorRect.left - 32);
    const rightBlankX = Math.min(scrollRootRect.right - 24, editorRect.right + 32);
    const x = Math.abs(leftBlankX - editorRect.left) > 8 ? leftBlankX : rightBlankX;
    const hit = document.elementFromPoint(x, y);

    return {
      x,
      y,
      hitTagName: hit instanceof HTMLElement ? hit.tagName : null,
      hitClassName: hit instanceof HTMLElement ? hit.className : null,
      hitText: hit instanceof HTMLElement ? hit.textContent?.trim().slice(0, 80) ?? '' : '',
      editorLeft: editorRect.left,
      editorRight: editorRect.right,
      scrollRootLeft: scrollRootRect.left,
      scrollRootRight: scrollRootRect.right,
    };
  }, { editorSelector: EDITOR_SELECTOR, text });

  expect(point, `Expected editor side blank point for ${text}`).not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
  await waitForEditorAnimationFrame(page);
  return point!;
}

async function getSelectionInTextBlockState(page: Page, text: string) {
  return page.evaluate(({ editorSelector, text }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const paragraph = Array.from(editor?.querySelectorAll<HTMLElement>('p') ?? [])
      .find((candidate) => candidate.textContent?.includes(text)) ?? null;
    const block = (window as any).__vlainaE2E.getNoteSelectableBlocks()
      .find((candidate: { text?: string }) => candidate.text?.includes(text));
    const selection = (window as any).__vlainaE2E.getEditorSelectionSummary();
    const domSelection = window.getSelection();
    const domSelectionInsideParagraph = Boolean(
      paragraph &&
      domSelection &&
      domSelection.rangeCount > 0 &&
      domSelection.isCollapsed &&
      domSelection.anchorNode &&
      domSelection.focusNode &&
      paragraph.contains(domSelection.anchorNode) &&
      paragraph.contains(domSelection.focusNode)
    );
    const selectionInsideSelectableBlock = Boolean(
      block &&
      selection &&
      selection.empty &&
      selection.from >= block.from &&
      selection.from <= block.to
    );

    return {
      block,
      paragraphFound: Boolean(paragraph),
      selection,
      selectionInsideBlock: selectionInsideSelectableBlock || domSelectionInsideParagraph,
      selectionInsideSelectableBlock,
      domSelectionInsideParagraph,
      domSelectionText: domSelection?.toString() ?? '',
      activeElementTagName: document.activeElement instanceof HTMLElement
        ? document.activeElement.tagName
        : null,
      activeElementClassName: document.activeElement instanceof HTMLElement
        ? document.activeElement.className
        : null,
      popoverOpen: Boolean(document.querySelector('[data-slot="popover-content"]')),
    };
  }, { editorSelector: EDITOR_SELECTOR, text });
}

async function setEditorSelectionOutsideTextBlock(page: Page, text: string) {
  const result = await page.evaluate(async (text) => {
    const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks() as Array<{
      from: number;
      text?: string;
      to: number;
    }>;
    const block = blocks.find((candidate) => (
      !candidate.text?.includes(text) &&
      candidate.to > candidate.from + 1
    )) ?? null;
    if (!block) return null;

    const position = Math.min(block.to - 1, block.from + 1);
    await (window as any).__vlainaE2E.setEditorSelectionRange(position);
    return {
      block,
      position,
      selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
    };
  }, text);

  expect(result, `Expected a selectable block outside ${text}`).not.toBeNull();
  return result!;
}

async function getCoverClickSelectionState(page: Page) {
  return page.evaluate(({ editorSelector, selectedBlockSelector }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const selection = (window as any).__vlainaE2E.getEditorSelectionSummary?.() ?? null;
    const selectedBlocks = Array.from(document.querySelectorAll<HTMLElement>(selectedBlockSelector))
      .map((block) => ({
        tagName: block.tagName,
        text: block.textContent?.trim().slice(0, 120) ?? '',
      }));

    return {
      selectedBlockCount: selectedBlocks.length,
      selectedBlocks,
      blockSelectionActive: editor?.classList.contains('editor-block-selection-active') ?? false,
      selection,
    };
  }, {
    editorSelector: EDITOR_SELECTOR,
    selectedBlockSelector: SELECTED_BLOCK_SELECTOR,
  });
}

async function getCoverSwitchDiagnostics(page: Page) {
  return page.evaluate(({ imageSelector, cropperSelector, selectedBlockSelector }) => {
    const image = document.querySelector<HTMLImageElement>(imageSelector);
    const cropper = document.querySelector<HTMLElement>(cropperSelector);
    const cropperRect = cropper?.getBoundingClientRect();

    return {
      imageSrc: image?.src ?? '',
      imageSrcIsBlob: image?.src.startsWith('blob:') ?? false,
      naturalWidth: image?.naturalWidth ?? 0,
      naturalHeight: image?.naturalHeight ?? 0,
      cropperWidth: Math.round(cropperRect?.width ?? 0),
      cropperHeight: Math.round(cropperRect?.height ?? 0),
      sourceFallbackCount: document.querySelectorAll('[data-note-source-fallback="true"]').length,
      selectedBlockCount: document.querySelectorAll(selectedBlockSelector).length,
    };
  }, {
    imageSelector: NOTE_COVER_IMAGE_SELECTOR,
    cropperSelector: NOTE_COVER_CROPPER_SELECTOR,
    selectedBlockSelector: SELECTED_BLOCK_SELECTOR,
  });
}

async function startCoverLayoutShiftProbe(page: Page) {
  return page.evaluate(({ regionSelector, editorSelector }) => {
    const key = '__vlainaCoverLayoutShiftProbe';
    const previous = (window as any)[key] as { stop?: () => void } | undefined;
    previous?.stop?.();

    type Sample = {
      at: number;
      regionHeight: number;
      regionTop: number;
      regionBottom: number;
      editorTop: number;
      scrollHeight: number;
      coverRegionCount: number;
      coverPlaceholderCount: number;
    };

    const samples: Sample[] = [];
    let stopped = false;
    let frameId = 0;
    const startedAt = performance.now();
    const read = () => {
      if (stopped) return;

      const region = document.querySelector<HTMLElement>(regionSelector);
      const editor = document.querySelector<HTMLElement>(editorSelector);
      const scrollRoot = editor?.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
      const regionRect = region?.getBoundingClientRect();
      const editorRect = editor?.getBoundingClientRect();

      samples.push({
        at: Math.round((performance.now() - startedAt) * 10) / 10,
        regionHeight: Math.round((regionRect?.height ?? 0) * 100) / 100,
        regionTop: Math.round((regionRect?.top ?? 0) * 100) / 100,
        regionBottom: Math.round((regionRect?.bottom ?? 0) * 100) / 100,
        editorTop: Math.round((editorRect?.top ?? 0) * 100) / 100,
        scrollHeight: scrollRoot?.scrollHeight ?? 0,
        coverRegionCount: document.querySelectorAll(regionSelector).length,
        coverPlaceholderCount: document.querySelectorAll('[data-note-cover-placeholder="true"]').length,
      });
      frameId = requestAnimationFrame(read);
    };

    frameId = requestAnimationFrame(read);
    (window as any)[key] = {
      samples,
      stop: () => {
        stopped = true;
        cancelAnimationFrame(frameId);
      },
    };
  }, {
    regionSelector: NOTE_COVER_REGION_SELECTOR,
    editorSelector: EDITOR_SELECTOR,
  });
}

async function stopCoverLayoutShiftProbe(page: Page) {
  return page.evaluate(() => {
    const key = '__vlainaCoverLayoutShiftProbe';
    const probe = (window as any)[key] as {
      samples: Array<{
        regionHeight: number;
        regionTop: number;
        regionBottom: number;
        editorTop: number;
        scrollHeight: number;
        coverRegionCount: number;
        coverPlaceholderCount: number;
      }>;
      stop: () => void;
    } | undefined;
    probe?.stop();
    delete (window as any)[key];

    const samples = probe?.samples ?? [];
    const first = samples[0] ?? null;
    const maxDelta = (field: 'regionHeight' | 'regionTop' | 'regionBottom' | 'editorTop' | 'scrollHeight') => {
      if (!first) return 0;
      return Math.max(...samples.map((sample) => Math.abs(sample[field] - first[field])));
    };

    return {
      sampleCount: samples.length,
      maxRegionHeightDelta: Math.round(maxDelta('regionHeight') * 100) / 100,
      maxRegionTopDelta: Math.round(maxDelta('regionTop') * 100) / 100,
      maxRegionBottomDelta: Math.round(maxDelta('regionBottom') * 100) / 100,
      maxEditorTopDelta: Math.round(maxDelta('editorTop') * 100) / 100,
      maxScrollHeightDelta: Math.round(maxDelta('scrollHeight') * 100) / 100,
      maxCoverRegionCount: samples.length ? Math.max(...samples.map((sample) => sample.coverRegionCount)) : 0,
      maxCoverPlaceholderCount: samples.length ? Math.max(...samples.map((sample) => sample.coverPlaceholderCount)) : 0,
      minCoverSupportCount: samples.length
        ? Math.min(...samples.map((sample) => sample.coverRegionCount + sample.coverPlaceholderCount))
        : 0,
    };
  });
}

async function waitForSidebarNoteIconReady(page: Page, filePath: string) {
  const row = page.locator(`[data-file-tree-kind="file"][data-file-tree-path="${filePath}"]`).first();
  const icon = row.locator('img').first();
  await expect(icon).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => icon.evaluate((image) => ({
    srcIsBlob: (image as HTMLImageElement).src.startsWith('blob:'),
    complete: (image as HTMLImageElement).complete,
    naturalWidth: (image as HTMLImageElement).naturalWidth,
    naturalHeight: (image as HTMLImageElement).naturalHeight,
  })), { timeout: 10_000 }).toMatchObject({
    srcIsBlob: true,
    complete: true,
    naturalWidth: 96,
    naturalHeight: 96,
  });
}

async function waitForHeaderNoteIconReady(page: Page) {
  const icon = page.locator('[data-note-toolbar-root="true"] [data-no-editor-drag-box="true"] img[alt]').first();
  await expect(icon).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => icon.evaluate((image) => {
    const rect = (image as HTMLImageElement).getBoundingClientRect();
    return {
      srcIsBlob: (image as HTMLImageElement).src.startsWith('blob:'),
      complete: (image as HTMLImageElement).complete,
      naturalWidth: (image as HTMLImageElement).naturalWidth,
      naturalHeight: (image as HTMLImageElement).naturalHeight,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }), { timeout: 10_000 }).toMatchObject({
    srcIsBlob: true,
    complete: true,
    naturalWidth: 96,
    naturalHeight: 96,
  });
}

async function startSidebarIconStabilityProbe(page: Page, filePath: string) {
  return page.evaluate((path) => {
    const key = '__vlainaSidebarIconStabilityProbe';
    const previous = (window as any)[key] as { stop?: () => void } | undefined;
    previous?.stop?.();

    type Sample = {
      at: number;
      rowExists: boolean;
      exists: boolean;
      hasSvg: boolean;
      src: string;
      complete: boolean;
      naturalWidth: number;
      naturalHeight: number;
    };

    const samples: Sample[] = [];
    let stopped = false;
    let frameId = 0;
    const startedAt = performance.now();
    const findRowAndIcon = () => {
      const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-file-tree-kind="file"]'));
      const row = rows.find((candidate) => candidate.dataset.fileTreePath === path);
      return {
        row: row ?? null,
        icon: row?.querySelector<HTMLImageElement>('img') ?? null,
      };
    };
    const read = () => {
      if (stopped) return;
      const { row, icon } = findRowAndIcon();
      samples.push({
        at: Math.round((performance.now() - startedAt) * 10) / 10,
        rowExists: Boolean(row),
        exists: Boolean(icon),
        hasSvg: Boolean(row?.querySelector('svg')),
        src: icon?.src ?? '',
        complete: icon?.complete ?? false,
        naturalWidth: icon?.naturalWidth ?? 0,
        naturalHeight: icon?.naturalHeight ?? 0,
      });
      frameId = requestAnimationFrame(read);
    };

    frameId = requestAnimationFrame(read);
    (window as any)[key] = {
      samples,
      stop: () => {
        stopped = true;
        cancelAnimationFrame(frameId);
      },
    };
  }, filePath);
}

async function stopSidebarIconStabilityProbe(page: Page) {
  return page.evaluate(() => {
    const key = '__vlainaSidebarIconStabilityProbe';
    const probe = (window as any)[key] as {
      samples: Array<{
        rowExists?: boolean;
        exists: boolean;
        hasSvg?: boolean;
        src: string;
        complete: boolean;
        naturalWidth: number;
        naturalHeight: number;
      }>;
      stop: () => void;
    } | undefined;
    probe?.stop();
    delete (window as any)[key];

    const samples = probe?.samples ?? [];
    const srcs = samples.map((sample) => sample.src).filter(Boolean);
    return {
      sampleCount: samples.length,
      rowMissingCount: samples.filter((sample) => !sample.rowExists).length,
      rowWithoutImageCount: samples.filter((sample) => sample.rowExists && !sample.exists).length,
      fallbackSvgCount: samples.filter((sample) => sample.rowExists && !sample.exists && sample.hasSvg).length,
      imagePlaceholderCount: samples.filter((sample) => sample.rowExists && !sample.exists && !sample.hasSvg).length,
      missingCount: samples.filter((sample) => !sample.exists).length,
      incompleteCount: samples.filter((sample) => sample.exists && !sample.complete).length,
      zeroNaturalSizeCount: samples.filter((sample) => sample.exists && (sample.naturalWidth <= 0 || sample.naturalHeight <= 0)).length,
      distinctSrcCount: new Set(srcs).size,
      firstSrc: srcs[0] ?? '',
      lastSrc: srcs[srcs.length - 1] ?? '',
    };
  });
}

async function waitForCoverAssetGridItem(page: Page, gridFilename: string) {
  const item = page.locator(`[data-filename="${gridFilename}"]`).first();
  await expect(item).toBeVisible({ timeout: 10_000 });
  return item;
}

async function openCoverPickerForAsset(page: Page, gridFilename: string) {
  await clickCoverCenter(page);
  await waitForEditorAnimationFrame(page);
  return waitForCoverAssetGridItem(page, gridFilename);
}

async function hoverCoverAssetPreview(page: Page, gridFilename: string) {
  const previous = await getCoverSwitchDiagnostics(page);
  const item = await waitForCoverAssetGridItem(page, gridFilename);
  const box = await item.boundingBox();
  expect(box).not.toBeNull();
  const startedAt = await page.evaluate(() => performance.now());
  await startCoverLayoutShiftProbe(page);
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);

  let diagnostics = previous;
  await expect.poll(async () => {
    diagnostics = await getCoverSwitchDiagnostics(page);
    return (
      diagnostics.imageSrc.length > 0 &&
      diagnostics.imageSrc !== previous.imageSrc &&
      diagnostics.imageSrcIsBlob &&
      diagnostics.naturalWidth === 1200 &&
      diagnostics.naturalHeight === 400
    );
  }, { timeout: 10_000 }).toBe(true);
  await waitForEditorAnimationFrame(page);
  const layoutShift = await stopCoverLayoutShiftProbe(page);
  const endedAt = await page.evaluate(() => performance.now());

  return {
    gridFilename,
    visualSwitchMs: Math.round((endedAt - startedAt) * 10) / 10,
    diagnostics,
    layoutShift,
  };
}

async function selectCoverAssetFromPicker(page: Page, gridFilename: string) {
  const previous = await getCoverSwitchDiagnostics(page);
  const item = await openCoverPickerForAsset(page, gridFilename);
  const startedAt = await page.evaluate(() => performance.now());
  await startCoverLayoutShiftProbe(page);
  await item.click();

  let diagnostics = previous;
  await expect.poll(async () => {
    diagnostics = await getCoverSwitchDiagnostics(page);
    return (
      diagnostics.imageSrc.length > 0 &&
      diagnostics.imageSrc !== previous.imageSrc &&
      diagnostics.imageSrcIsBlob &&
      diagnostics.naturalWidth === 1200 &&
      diagnostics.naturalHeight === 400
    );
  }, { timeout: 10_000 }).toBe(true);
  await waitForEditorAnimationFrame(page);
  const layoutShift = await stopCoverLayoutShiftProbe(page);
  const endedAt = await page.evaluate(() => performance.now());

  return {
    gridFilename,
    visualSwitchMs: Math.round((endedAt - startedAt) * 10) / 10,
    diagnostics,
    layoutShift,
  };
}

test.describe('notes top cover e2e coverage', () => {
  test.setTimeout(120_000);

  test('restores a local GIF cover after relaunch', async () => {
    const first = await launchIsolatedElectron('notes-gif-cover-restart-a');
    let second: Awaited<ReturnType<typeof launchIsolatedElectron>> | null = null;

    try {
      await first.app.firstWindow();
      const [page] = await getOpenBridgePages(first.app, 1);
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'gif-cover-restart',
        files: [{
          filename: 'gif-cover.md',
          content: createCoveredMarkdown('GIF Cover Restart', 2, 'assets/animated.gif'),
        }],
      });
      const assetDirectory = path.join(fixture.notesRootPath, 'assets');
      await fs.mkdir(assetDirectory, { recursive: true });
      await fs.writeFile(
        path.join(assetDirectory, 'animated.gif'),
        Buffer.from(ANIMATED_GIF_BASE64, 'base64'),
      );

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'GIF Cover Restart',
        minFileCount: 1,
      });
      await expect.poll(() => page.locator(
        '[data-file-tree-image-background="assets/animated.gif"] [style*="background-image"]'
      ).count(), { timeout: 30_000 }).toBe(1);
      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'gif-cover' }).first().click();
      await expect.poll(async () => page.locator(NOTE_COVER_IMAGE_SELECTOR).evaluateAll((images) => {
        const image = images[0] as HTMLImageElement | undefined;
        return image ? { complete: image.complete, naturalWidth: image.naturalWidth } : null;
      }), { timeout: 30_000 }).toEqual({ complete: true, naturalWidth: 32 });

      await closeElectron(first.app);
      second = await launchIsolatedElectron('notes-gif-cover-restart-b', {
        envOverrides: { VLAINA_USER_DATA_DIR: first.userDataDir },
      });
      await second.app.firstWindow();
      const [restoredPage] = await getOpenBridgePages(second.app, 1);
      await openNotesRootInNotes(restoredPage, {
        notesRootPath: fixture.notesRootPath,
        name: 'GIF Cover Restart',
        minFileCount: 1,
      });
      await expect.poll(() => restoredPage.locator(
        '[data-file-tree-image-background="assets/animated.gif"] [style*="background-image"]'
      ).count(), { timeout: 30_000 }).toBe(1);
      await restoredPage.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'gif-cover' }).first().click();

      await expect.poll(async () => restoredPage.locator(NOTE_COVER_IMAGE_SELECTOR).evaluateAll((images) => {
        const image = images[0] as HTMLImageElement | undefined;
        return image ? { complete: image.complete, naturalWidth: image.naturalWidth } : null;
      }), { timeout: 30_000 }).toEqual({ complete: true, naturalWidth: 32 });
      await expect(restoredPage.locator(NOTE_COVER_IMAGE_SELECTOR)).toBeVisible();
    } finally {
      if (second) {
        await cleanupIsolatedElectron(second.app, second.userDataRoot);
      }
      await cleanupIsolatedElectron(first.app, first.userDataRoot);
    }
  });

  test('renders a frontmatter cover at the top, opens the picker, and removes it cleanly', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-cover-functional');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
        console.info(`[notes-cover-functional:pageerror] ${error.message}`);
      });
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          console.info(text);
        }
      });

      const { notePath } = await openCoverFixture(page, {
        filename: 'cover-functional.md',
        title: 'Cover Functional E2E',
        iconAssetPath: NOTE_ICON_ASSET_PATH,
        assetFiles: [
          {
            filename: COVER_ASSET_PATH,
            content: COVER_SVG,
          },
          {
            filename: NOTE_ICON_ASSET_PATH,
            content: NOTE_ICON_SVG,
          },
        ],
      });
      const coverMetrics = await waitForCoverReady(page);
      await waitForHeaderNoteIconReady(page);
      await waitForSidebarNoteIconReady(page, 'cover-functional.md');

      expect(coverMetrics.regionHeight).toBe(COVER_HEIGHT);
      expect(coverMetrics.cropperHeight).toBeGreaterThanOrEqual(COVER_HEIGHT - 2);
      expect(coverMetrics.cropperWidth).toBeGreaterThan(700);
      expect(coverMetrics.regionTop).toBeLessThan(coverMetrics.editorTop);
      expect(coverMetrics.regionBottom).toBeLessThan(coverMetrics.editorTop);
      expect(coverMetrics.objectFitMode).toBe('horizontal-cover');
      expect(coverMetrics.imageTransform).toContain('matrix');
      expect(coverMetrics.scrollHeight).toBeGreaterThan(coverMetrics.clientHeight);

      const initialFrontmatter = await readCoverFrontmatter(page, notePath);
      expect(initialFrontmatter).toMatchObject({
        assetPath: COVER_ASSET_PATH,
        height: COVER_HEIGHT,
        scale: 1,
        x: 50,
        y: COVER_INITIAL_Y,
      });

      const beforeCoverClickSelection = await getCoverClickSelectionState(page);
      expect(beforeCoverClickSelection.selectedBlockCount).toBe(0);
      expect(beforeCoverClickSelection.blockSelectionActive).toBe(false);

      await clickCoverCenter(page);
      await waitForEditorAnimationFrame(page);
      await waitForEditorAnimationFrame(page);
      const removeButton = page.getByRole('button', { name: /^(Remove|移除)$/ });
      await expect(removeButton).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: /^(Library|图库|圖庫)$/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /^(Upload|上传|上傳)$/ })).toBeVisible();

      const afterCoverClickSelection = await getCoverClickSelectionState(page);
      console.info('[notes-cover-picker-click-selection]', afterCoverClickSelection);
      expect(afterCoverClickSelection.selectedBlockCount).toBe(0);
      expect(afterCoverClickSelection.selectedBlocks).toEqual([]);
      expect(afterCoverClickSelection.blockSelectionActive).toBe(false);
      expect(afterCoverClickSelection.selection).toEqual(beforeCoverClickSelection.selection);
      expect(afterCoverClickSelection.selection?.selectedText ?? '').toBe('');

      await removeButton.click();
      await expect(page.locator(NOTE_COVER_REGION_SELECTOR)).toHaveCount(0, { timeout: 10_000 });
      await expectCoverFrontmatter(page, notePath, (frontmatter) => frontmatter.assetPath === null);

      const addCoverOverlay = page.locator(NOTE_COVER_ADD_OVERLAY_SELECTOR);
      await expect(addCoverOverlay).toBeVisible();
      await addCoverOverlay.click();
      await expect(page.locator('[data-slot="popover-content"]')).toBeVisible();
      await expectCoverFrontmatter(page, notePath, (frontmatter) => frontmatter.assetPath === null);

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Final cover performance sentinel');
      expect(pageErrors).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('places the caret in body text after opening the cover picker', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-cover-body-focus');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openCoverFixture(page, {
        filename: 'cover-body-focus.md',
        title: 'Cover Body Focus E2E',
        paragraphCount: 12,
      });
      await waitForCoverReady(page);

      const targetText = 'Cover e2e sentinel paragraph near the top.';
      await clickCoverCenter(page);
      await expect(page.locator('[data-slot="popover-content"]')).toBeVisible({ timeout: 10_000 });

      const clickPoint = await clickVisibleEditorText(page, targetText);
      const afterClick = await getSelectionInTextBlockState(page, targetText);
      console.info('[notes-cover-body-focus]', {
        clickPoint,
        afterClick,
      });

      expect(afterClick.paragraphFound, JSON.stringify(afterClick, null, 2)).toBe(true);
      expect(afterClick.selectionInsideBlock, JSON.stringify(afterClick, null, 2)).toBe(true);
      await expect(page.locator('[data-slot="popover-content"]')).toBeHidden({ timeout: 2_000 });

      await clickCoverCenter(page);
      await expect(page.locator('[data-slot="popover-content"]')).toBeVisible({ timeout: 10_000 });
      const blankClickPoint = await clickEditorParagraphRightBlank(page, targetText);
      const afterBlankClick = await getSelectionInTextBlockState(page, targetText);
      console.info('[notes-cover-body-focus-blank]', {
        blankClickPoint,
        afterBlankClick,
      });

      expect(afterBlankClick.selectionInsideBlock, JSON.stringify(afterBlankClick, null, 2)).toBe(true);
      await expect(page.locator('[data-slot="popover-content"]')).toBeHidden({ timeout: 2_000 });

      await setEditorSelectionOutsideTextBlock(page, targetText);
      const beforeSideBlankClick = await getSelectionInTextBlockState(page, targetText);
      expect(beforeSideBlankClick.selectionInsideBlock, JSON.stringify(beforeSideBlankClick, null, 2)).toBe(false);

      await clickCoverCenter(page);
      await expect(page.locator('[data-slot="popover-content"]')).toBeVisible({ timeout: 10_000 });
      const sideBlankClickPoint = await clickEditorSideBlank(page, targetText);
      const afterSideBlankClick = await getSelectionInTextBlockState(page, targetText);
      console.info('[notes-cover-body-focus-side-blank]', {
        beforeSideBlankClick,
        sideBlankClickPoint,
        afterSideBlankClick,
      });

      expect(afterSideBlankClick.selectionInsideBlock, JSON.stringify(afterSideBlankClick, null, 2)).toBe(true);
      await expect(page.locator('[data-slot="popover-content"]')).toBeHidden({ timeout: 2_000 });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('rapidly previews and switches among multiple cover assets without performance regressions', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-cover-rapid-switching');
    const frameProbeKey = '__vlainaCoverRapidSwitchingProbe';
    let frameProbeRunning = false;
    let sidebarIconProbeRunning = false;
    let page: Page | null = null;

    try {
      await app.firstWindow();
      [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1360, height: 900 });
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
        console.info(`[notes-cover-rapid-switching:pageerror] ${error.message}`);
      });
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          console.info(text);
        }
      });

      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({
        imageStorageMode: 'subfolder',
        imageSubfolderName: 'assets',
      }));

      const switchAssetFiles = SWITCH_COVER_ASSET_PATHS.map((filename, index) => ({
        filename,
        content: createSwitchCoverSvg(index),
      }));
      const { notePath } = await openCoverFixture(page, {
        filename: 'cover-rapid-switching.md',
        title: 'Cover Rapid Switching E2E',
        paragraphCount: 120,
        coverAssetPath: SWITCH_COVER_ASSET_PATHS[0],
        iconAssetPath: NOTE_ICON_ASSET_PATH,
        assetFiles: [
          ...switchAssetFiles,
          {
            filename: NOTE_ICON_ASSET_PATH,
            content: NOTE_ICON_SVG,
          },
        ],
      });
      await waitForCoverReady(page);
      await waitForSidebarNoteIconReady(page, 'cover-rapid-switching.md');

      await clickCoverCenter(page);
      await expect(page.getByRole('button', { name: /^(Library|图库|圖庫)$/ })).toBeVisible({ timeout: 10_000 });
      await waitForCoverAssetGridItem(page, SWITCH_COVER_GRID_FILENAMES[SWITCH_COVER_GRID_FILENAMES.length - 1]!);

      const hoverTargets = SWITCH_COVER_GRID_FILENAMES.slice(1, 6);
      const commitTargets = SWITCH_COVER_GRID_FILENAMES.slice(6, 10);
      await startMainThreadFrameProbe(page, frameProbeKey);
      frameProbeRunning = true;
      await startSidebarIconStabilityProbe(page, 'cover-rapid-switching.md');
      sidebarIconProbeRunning = true;

      const hoverMetrics = [];
      for (const target of hoverTargets) {
        hoverMetrics.push(await hoverCoverAssetPreview(page, target));
      }

      await page.keyboard.press('Escape');
      await waitForEditorAnimationFrame(page);
      await waitForEditorAnimationFrame(page);

      const commitMetrics = [];
      for (const target of commitTargets) {
        commitMetrics.push(await selectCoverAssetFromPicker(page, target));
      }

      const sidebarIconProbe = await stopSidebarIconStabilityProbe(page);
      sidebarIconProbeRunning = false;
      const frameProbe = await stopMainThreadFrameProbe(page, frameProbeKey);
      frameProbeRunning = false;
      const finalTarget = commitTargets[commitTargets.length - 1]!;
      const finalFrontmatter = await expectCoverFrontmatter(
        page,
        notePath,
        (frontmatter) => frontmatter.assetPath === finalTarget,
      );
      const finalDiagnostics = await getCoverSwitchDiagnostics(page);
      const allSwitchMetrics = [...hoverMetrics, ...commitMetrics];
      const visualSwitchTimes = allSwitchMetrics.map((entry) => entry.visualSwitchMs);
      const maxVisualSwitchMs = Math.max(...visualSwitchTimes);
      const avgVisualSwitchMs = visualSwitchTimes.reduce((sum, value) => sum + value, 0) / visualSwitchTimes.length;
      const layoutShiftMetrics = allSwitchMetrics.map((entry) => entry.layoutShift);
      const maxEditorTopDelta = Math.max(...layoutShiftMetrics.map((entry) => entry.maxEditorTopDelta));
      const maxRegionHeightDelta = Math.max(...layoutShiftMetrics.map((entry) => entry.maxRegionHeightDelta));
      const maxRegionBottomDelta = Math.max(...layoutShiftMetrics.map((entry) => entry.maxRegionBottomDelta));
      const maxScrollHeightDelta = Math.max(...layoutShiftMetrics.map((entry) => entry.maxScrollHeightDelta));
      const maxCoverPlaceholderCount = Math.max(...layoutShiftMetrics.map((entry) => entry.maxCoverPlaceholderCount));
      const minCoverSupportCount = Math.min(...layoutShiftMetrics.map((entry) => entry.minCoverSupportCount));

      console.info('[notes-cover-rapid-switching]', {
        hoverMetrics,
        commitMetrics,
        frameProbe,
        finalFrontmatter,
        finalDiagnostics,
        sidebarIconProbe,
        maxVisualSwitchMs,
        avgVisualSwitchMs: Math.round(avgVisualSwitchMs * 10) / 10,
        maxEditorTopDelta,
        maxRegionHeightDelta,
        maxRegionBottomDelta,
        maxScrollHeightDelta,
        maxCoverPlaceholderCount,
        minCoverSupportCount,
      });

      expect(hoverMetrics).toHaveLength(5);
      expect(commitMetrics).toHaveLength(4);
      expect(finalFrontmatter.assetPath).toBe(finalTarget);
      expect(finalDiagnostics.imageSrcIsBlob).toBe(true);
      expect(finalDiagnostics.naturalWidth).toBe(1200);
      expect(finalDiagnostics.naturalHeight).toBe(400);
      expect(finalDiagnostics.sourceFallbackCount).toBe(0);
      expect(finalDiagnostics.selectedBlockCount).toBe(0);
      expect(maxVisualSwitchMs).toBeLessThan(3_000);
      expect(avgVisualSwitchMs).toBeLessThan(1_500);
      expect(maxEditorTopDelta).toBeLessThanOrEqual(1);
      expect(maxRegionHeightDelta).toBeLessThanOrEqual(1);
      expect(maxRegionBottomDelta).toBeLessThanOrEqual(1);
      expect(maxScrollHeightDelta).toBeLessThanOrEqual(1);
      expect(maxCoverPlaceholderCount).toBe(0);
      expect(minCoverSupportCount).toBeGreaterThanOrEqual(1);
      expect(sidebarIconProbe.sampleCount).toBeGreaterThan(0);
      expect(sidebarIconProbe.missingCount).toBe(0);
      expect(sidebarIconProbe.incompleteCount).toBe(0);
      expect(sidebarIconProbe.zeroNaturalSizeCount).toBe(0);
      expect(sidebarIconProbe.distinctSrcCount).toBe(1);
      expect(sidebarIconProbe.lastSrc).toBe(sidebarIconProbe.firstSrc);
      expect(frameProbe.p95FrameMs).toBeLessThan(100);
      expect(frameProbe.maxFrameMs).toBeLessThan(300);
      expect(frameProbe.longFramesOver100).toBeLessThanOrEqual(3);
      expect(frameProbe.maxLongTaskMs).toBeLessThan(300);
      expect(pageErrors).toEqual([]);
    } finally {
      if (sidebarIconProbeRunning && page && !page.isClosed()) {
        await stopSidebarIconStabilityProbe(page).catch(() => undefined);
      }
      if (frameProbeRunning && page && !page.isClosed()) {
        await stopMainThreadFrameProbe(page, frameProbeKey).catch(() => undefined);
      }
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps cover space reserved while switching between covered notes', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-cover-covered-note-switch');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1360, height: 900 });
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
        console.info(`[notes-cover-covered-note-switch:pageerror] ${error.message}`);
      });

      const fixture = await createNotesRootFilesFixture(page, {
        name: 'cover-covered-note-switch',
        files: [
          {
            filename: 'cover-switch-alpha.md',
            content: createCoveredMarkdown(
              'Cover Switch Alpha E2E',
              80,
              SWITCH_COVER_ASSET_PATHS[0],
            ),
          },
          {
            filename: 'cover-switch-beta.md',
            content: createCoveredMarkdown(
              'Cover Switch Beta E2E',
              80,
              SWITCH_COVER_ASSET_PATHS[1],
            ),
          },
          ...SWITCH_COVER_ASSET_PATHS.slice(0, 2).map((filename, index) => ({
            filename,
            content: createSwitchCoverSvg(index),
          })),
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Cover Note Switch NotesRoot',
        minFileCount: 2,
      });

      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'cover-switch-alpha' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Cover Switch Alpha E2E', { timeout: 30_000 });
      await waitForCoverReady(page);

      await startCoverLayoutShiftProbe(page);
      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'cover-switch-beta' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Cover Switch Beta E2E', { timeout: 30_000 });
      await waitForCoverReady(page);
      await waitForEditorAnimationFrame(page);
      const layoutShift = await stopCoverLayoutShiftProbe(page);

      console.info('[notes-cover-covered-note-switch]', layoutShift);

      expect(layoutShift.minCoverSupportCount).toBeGreaterThanOrEqual(1);
      expect(layoutShift.maxRegionHeightDelta).toBeLessThanOrEqual(1);
      expect(layoutShift.maxRegionBottomDelta).toBeLessThanOrEqual(1);
      expect(layoutShift.maxEditorTopDelta).toBeLessThanOrEqual(1);
      expect(pageErrors).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps the cover cropper live while the viewport resizes', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-cover-viewport-resize-live');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openCoverFixture(page, {
        filename: 'cover-window-resize-live.md',
        title: 'Cover Window Resize Live E2E',
      });
      const before = await waitForCoverReady(page);
      await expect(page.locator(`${NOTE_COVER_REGION_SELECTOR} img[aria-hidden="true"]`)).toHaveCount(0);

      await page.setViewportSize({ width: 980, height: 760 });

      await expect.poll(async () => page.locator(NOTE_COVER_CROPPER_SELECTOR).evaluate((element) =>
        Math.round(element.getBoundingClientRect().width)
      ), { timeout: 10_000 }).not.toBe(before.cropperWidth);
      await expect(page.locator(`${NOTE_COVER_REGION_SELECTOR} img[aria-hidden="true"]`)).toHaveCount(0);
      await expect(page.locator(NOTE_COVER_IMAGE_SELECTOR)).toBeVisible();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('persists cover drag and resize while keeping editor performance bounded', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-cover-performance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1360, height: 900 });
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
        console.info(`[notes-cover-performance:pageerror] ${error.message}`);
      });
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          console.info(text);
        }
      });

      const { notePath } = await openCoverFixture(page, {
        filename: 'cover-performance.md',
        title: 'Cover Performance E2E',
        paragraphCount: 180,
      });
      const coverReadyStartedAt = Date.now();
      const coverMetrics = await waitForCoverReady(page);
      const coverReadyMs = Date.now() - coverReadyStartedAt;
      const domMetrics = await collectEditorDomMetrics(page);
      const blockScanMetrics = await measureRepeatedBlockScan(page, 30);
      const scrollMetrics = await measureScrollFrames(page, 60);

      console.info('[notes-cover-performance-open]', {
        coverReadyMs,
        coverMetrics,
        domMetrics,
        blockScanMetrics,
        scrollMetrics,
      });

      expect(coverReadyMs).toBeLessThan(10_000);
      expect(domMetrics.countsBySelector.sourceFallback).toBe(0);
      expect(domMetrics.selectableBlockCount).toBeGreaterThan(100);
      expect(blockScanMetrics.p95Ms).toBeLessThan(250);
      expect(scrollMetrics).not.toBeNull();
      expect(scrollMetrics!.maxFrameMs).toBeLessThan(1_500);
      expect(scrollMetrics!.finalScrollTop).toBeGreaterThan(0);

      await scrollNoteToTop(page);
      await waitForEditorAnimationFrame(page);

      const beforeDrag = await readCoverFrontmatter(page, notePath);
      expect(beforeDrag.y).toBe(COVER_INITIAL_Y);
      const dragBox = await page.locator(NOTE_COVER_CROPPER_SELECTOR).boundingBox();
      expect(dragBox).not.toBeNull();
      const dragStartX = dragBox!.x + dragBox!.width / 2;
      const dragStartY = dragBox!.y + dragBox!.height / 2;
      const dragStartedAt = Date.now();
      await page.mouse.move(dragStartX, dragStartY);
      await page.mouse.down();
      await page.mouse.move(dragStartX, dragStartY + 72, { steps: 8 });
      await page.mouse.up();
      const dragWallMs = Date.now() - dragStartedAt;

      const afterDrag = await expectCoverFrontmatter(
        page,
        notePath,
        (frontmatter) => (
          frontmatter.assetPath === COVER_ASSET_PATH &&
          frontmatter.y !== null &&
          Math.abs(frontmatter.y - COVER_INITIAL_Y) >= 1
        ),
      );
      expect(afterDrag.height).toBe(COVER_HEIGHT);

      const regionBox = await page.locator(NOTE_COVER_REGION_SELECTOR).boundingBox();
      expect(regionBox).not.toBeNull();
      const resizeStartedAt = Date.now();
      await page.mouse.move(regionBox!.x + regionBox!.width / 2, regionBox!.y + regionBox!.height - 2);
      await page.mouse.down();
      await page.mouse.move(regionBox!.x + regionBox!.width / 2, regionBox!.y + regionBox!.height + 54, { steps: 8 });
      await page.mouse.up();
      const resizeWallMs = Date.now() - resizeStartedAt;

      const afterResize = await expectCoverFrontmatter(
        page,
        notePath,
        (frontmatter) => (
          frontmatter.assetPath === COVER_ASSET_PATH &&
          frontmatter.height !== null &&
          frontmatter.height > COVER_HEIGHT
        ),
      );
      await expect(page.locator(NOTE_COVER_REGION_SELECTOR)).toBeVisible();
      let resizedHeight = 0;
      await expect.poll(async () => {
        resizedHeight = await page.locator(NOTE_COVER_REGION_SELECTOR).evaluate((element) =>
          Math.round(element.getBoundingClientRect().height)
        );
        return Math.abs(resizedHeight - (afterResize.height ?? 0));
      }, { timeout: 10_000 }).toBeLessThanOrEqual(1);

      console.info('[notes-cover-performance-interactions]', {
        dragWallMs,
        resizeWallMs,
        beforeDrag,
        afterDrag,
        afterResize,
        resizedHeight,
      });

      expect(dragWallMs).toBeLessThan(5_000);
      expect(resizeWallMs).toBeLessThan(5_000);
      expect(afterResize.scale).toBeGreaterThan(0);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Final cover performance sentinel');
      expect(pageErrors).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
