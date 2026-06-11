import { expect, test, type Page } from '@playwright/test';
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
  startMainThreadFrameProbe,
  stopMainThreadFrameProbe,
  type MainThreadFrameProbeResult,
  waitForEditorAnimationFrame,
} from './notesE2E';
import { TINY_PNG_DATA_URL } from './notesMarkdownSyntaxFixture';
import {
  MANUAL_MARKDOWN_PATH,
  createManualCorpus,
} from './notesManualSegments';

const TOOLBAR_SELECTOR = '.floating-toolbar.visible';
const LIVE_EDITOR_SELECTOR = `${EDITOR_SELECTOR}:not(.toolbar-applied-preview-overlay):not([aria-hidden="true"])`;
const DEFAULT_RANDOM_SEED = 'notes-random-interaction-v1';
const DEFAULT_RANDOM_STEPS = 90;
const MIN_RANDOM_STEPS = 24;

type RandomMetric = {
  step: number;
  operation: string;
  durationMs: number;
  detail?: unknown;
};

type EditorDispatchProfileSummary = {
  decorationPropTotalMs: number;
  dispatchCount: number;
  docChangedCount: number;
  insertedTextLength: number;
  maxDispatchMs: number;
  pluginApplyTotalMs: number;
  p95DispatchMs: number;
  totalDispatchMs: number;
  totalProfileMs: number;
  totalStepCount: number;
  updateStateCount: number;
  updateStateMaxMs: number;
  updateStateP95Ms: number;
  updateStateTotalMs: number;
  updateStateInnerCount: number;
  updateStateInnerMaxMs: number;
  updateStateInnerP95Ms: number;
  updateStateInnerTotalMs: number;
  slowestPluginApplies: Array<{
    count: number;
    key: string;
    maxMs: number;
    p95Ms: number;
    totalMs: number;
  }>;
  slowestDecorationProps: Array<{
    count: number;
    key: string;
    maxMs: number;
    p95Ms: number;
    totalMs: number;
  }>;
};

type RandomOperation =
  | 'type-random-paragraph'
  | 'paste-random-markdown'
  | 'toolbar-mark'
  | 'keyboard-shortcut'
  | 'toolbar-block-heading'
  | 'toolbar-alignment'
  | 'toolbar-text-color'
  | 'toolbar-link'
  | 'toolbar-copy-delete'
  | 'math-popup'
  | 'mermaid-popup'
  | 'copy-paste-existing'
  | 'undo-redo'
  | 'select-random-blocks'
  | 'scroll-and-scan'
  | 'paste-syntax-coverage';

type WeightedOperation = {
  operation: RandomOperation;
  weight: number;
};

type ToolbarMarkAction = {
  action: string;
  markName: string;
  selector: string;
};

type SyntaxCoverageFragment = {
  category: string;
  markdown: string;
  textProbe?: string;
};

function getRandomSeed(): string {
  return process.env.NOTES_RANDOM_INTERACTION_SEED?.trim() || DEFAULT_RANDOM_SEED;
}

function getRandomStepCount(): number {
  const value = Number.parseInt(process.env.NOTES_RANDOM_INTERACTION_STEPS ?? '', 10);
  return Number.isFinite(value) && value > 0 ? Math.max(value, MIN_RANDOM_STEPS) : DEFAULT_RANDOM_STEPS;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: string): () => number {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng: () => number, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[randomInt(rng, values.length)]!;
}

function shuffle<T>(rng: () => number, values: readonly T[]): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

function weightedPick(rng: () => number, values: readonly WeightedOperation[]): RandomOperation {
  const total = values.reduce((sum, value) => sum + value.weight, 0);
  let threshold = rng() * total;
  for (const value of values) {
    threshold -= value.weight;
    if (threshold <= 0) {
      return value.operation;
    }
  }
  return values[values.length - 1]!.operation;
}

function randomAsciiWord(rng: () => number): string {
  const words = [
    'alpha',
    'beta',
    'canvas',
    'delta',
    'editor',
    'flow',
    'gamma',
    'hover',
    'inline',
    'journal',
    'keyboard',
    'latency',
    'mixed',
    'nested',
    'outline',
    'paste',
    'quote',
    'render',
    'smooth',
    'table',
    'undo',
    'viewport',
  ];
  return pick(rng, words);
}

function randomCjkToken(rng: () => number): string {
  const length = 2 + randomInt(rng, 5);
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(0x4e00 + randomInt(rng, 0x9fa5 - 0x4e00));
  }
  return value;
}

function randomEmoji(rng: () => number): string {
  return String.fromCodePoint(pick(rng, [
    0x1f31f,
    0x1f4dd,
    0x1f680,
    0x1f9ea,
    0x2728,
    0x2705,
  ]));
}

function createRandomParagraph(rng: () => number, step: number): string {
  const tokens = Array.from({ length: 8 + randomInt(rng, 10) }, () => {
    const mode = randomInt(rng, 8);
    if (mode === 0) return randomCjkToken(rng);
    if (mode === 1) return randomEmoji(rng);
    if (mode === 2) return `#tag-${randomInt(rng, 50)}`;
    if (mode === 3) return `inline-${randomInt(rng, 999)}`;
    return randomAsciiWord(rng);
  });
  const wrappers = [
    (value: string) => value,
    (value: string) => `**${value}**`,
    (value: string) => `*${value}*`,
    (value: string) => `==${value}==`,
    (value: string) => `++${value}++`,
    (value: string) => `\`${value}\``,
  ];
  const decorated = tokens.map((token) => pick(rng, wrappers)(token));
  return `Random paragraph ${step}: ${decorated.join(' ')}.\n\n`;
}

function randomSafeId(seed: string, step: number): string {
  const safeSeed = seed.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 36) || 'seed';
  return `${safeSeed}-${step}`;
}

function createTocHeadingFragment(step: number): string {
  return [
    `[TOC]`,
    '',
    '{:toc}',
    '',
    `Setext random heading ${step}`,
    '===========================',
    '',
    `Setext random subheading ${step}`,
    '-----------------------------',
    '',
    `## Random closed heading ${step} ##`,
    '',
  ].join('\n');
}

function createInlineMarksFragment(rng: () => number, step: number): string {
  const word = randomAsciiWord(rng);
  return [
    `Inline random marks ${step}: **strong ${word}**, __strong underscore ${word}__, *emphasis ${word}*, _emphasis underscore ${word}_, ~~strike ${word}~~, ==highlight ${word}==, ++underline ${word}++, ^sup ${step}^, ~sub ${step}~, \`inline ${word}\`, [explicit ${word}](https://example.com/random/${step}), [reference ${word}][random-ref-${step}], <https://example.com/autolink/${step}>, www.example.org/${step}, random-${step}@example.com, #random-tag-${step}.`,
    '',
    `[random-ref-${step}]: https://example.com/reference/${step} "Reference ${step}"`,
    '',
    `*[RND${step}]: Random abbreviation ${step}`,
    '',
    `RND${step} abbreviation usage.`,
    '',
  ].join('\n');
}

function createBreakEscapeHtmlFragment(step: number): string {
  return [
    `Soft break random ${step} line one`,
    `line two random ${step}.`,
    '',
    `Hard break random ${step} line one  `,
    `line two random ${step}.`,
    '',
    `Backslash break random ${step}\\`,
    `line two after backslash ${step}.`,
    '',
    `HTML break random ${step}<br/>after break random ${step}.`,
    '',
    `Escaped syntax random ${step}: \\# not heading, \\[TOC\\], \\*not emphasis\\*, \\!\\[not image\\](image.png), \\${step}.`,
    '',
  ].join('\n');
}

function createQuoteCalloutFragment(step: number): string {
  return [
    `> Random quote ${step} line one.`,
    `> Random quote ${step} line two with **bold** and [link](https://example.com/quote/${step}).`,
    '>',
    `> > Nested random quote ${step}.`,
    '',
    `> [!NOTE] Random callout ${step}`,
    `> Callout body random ${step}.`,
    '',
    `> [!WARNING] Random warning callout ${step}`,
    `> Warning callout body random ${step}.`,
    '',
    `> [!callout-icon:%F0%9F%93%8C] Random encoded icon callout ${step}`,
    `> Encoded callout body random ${step}.`,
    '',
  ].join('\n');
}

function createListDefinitionFragment(step: number): string {
  return [
    `- Random bullet ${step}`,
    `  - Nested bullet ${step}`,
    `    - Third-level bullet ${step}`,
    `+ Plus bullet ${step}`,
    `* Star bullet ${step}`,
    '',
    `1. Ordered alpha ${step}`,
    `2. Ordered beta ${step}`,
    '',
    `1) Parenthesized ordered alpha ${step}`,
    `2) Parenthesized ordered beta ${step}`,
    '',
    `7. Custom start ${step}`,
    `8. Custom continuation ${step}`,
    '',
    `- [ ] Random unchecked task ${step}`,
    `- [x] Random checked task ${step}`,
    `  - [ ] Nested random task ${step}`,
    '',
    `Term random ${step}`,
    `: Definition random ${step}`,
    '',
  ].join('\n');
}

function createTableRuleFragment(step: number): string {
  return [
    `| Random ${step} | Status | Count |`,
    '| :--- | :---: | ---: |',
    `| Alpha ${step} | **Stable** | ${step} |`,
    `| Escaped \\| pipe ${step} | [table link](https://example.com/table/${step}) | ${step + 1} |`,
    `| \`a \\| b ${step}\` | \\*literal marker\\* | ${step + 2} |`,
    '',
    '---',
    '',
    '***',
    '',
    '___',
    '',
  ].join('\n');
}

function createCodeFenceFragment(step: number): string {
  return [
    '```ts',
    `const randomSyntaxSentinel${step}: string = "code block ${step}";`,
    `console.log(randomSyntaxSentinel${step});`,
    '```',
    '',
    '```JS',
    `const languageAlias${step} = ${step};`,
    '```',
    '',
    '~~~js',
    `const tildeFence${step} = true;`,
    '~~~',
    '',
    '````md',
    '```ts',
    `const nestedFence${step} = 1;`,
    '```',
    '````',
    '',
    `    indented code block random ${step}`,
    `    indented code second line ${step}`,
    '',
  ].join('\n');
}

function createMathMarkdownFragment(step: number): string {
  return [
    '$$',
    `E_${step} = mc^2 + ${step}`,
    '$$',
    '',
    '\\[',
    `f_${step}=\\mu mg`,
    '\\]',
    '',
    `Inline math random ${step}: $a_${step}^2 + b_${step}^2 = c_${step}^2$ and $\\sqrt{${step + 1}}$.`,
    '',
  ].join('\n');
}

function createMermaidMarkdownFragment(step: number): string {
  const alias = ['mermaid', 'sequence', 'flow', 'flowchart-v2', 'zenuml', 'packet-beta'][step % 6]!;
  if (alias === 'sequence') {
    return [
      '```sequence',
      `Alice->Bob: Random sequence ${step}`,
      '```',
      '',
    ].join('\n');
  }
  if (alias === 'flow') {
    return [
      '```flow',
      `RandomStart${step}[Random flow ${step}] --> RandomDone${step}[Done]`,
      '```',
      '',
    ].join('\n');
  }
  if (alias === 'flowchart-v2') {
    return [
      '```flowchart-v2',
      `RandomFlowchartStart${step}[Random flowchart ${step}] --> RandomFlowchartDone${step}[Done]`,
      '```',
      '',
    ].join('\n');
  }
  if (alias === 'zenuml') {
    return [
      '```zenuml',
      `title Random zenuml ${step}`,
      'Bob',
      'Alice',
      `Alice->Bob: Hi ${step}`,
      '```',
      '',
    ].join('\n');
  }
  if (alias === 'packet-beta') {
    return [
      '```packet-beta',
      `0-7: "Random packet ${step}"`,
      '```',
      '',
    ].join('\n');
  }
  return [
    '```mermaid',
    'flowchart TD',
    `  Start${step}[Random start ${step}] --> Done${step}[Random done ${step}]`,
    '```',
    '',
  ].join('\n');
}

function createMediaFragment(step: number): string {
  return [
    `![Random image ${step}](${TINY_PNG_DATA_URL} "Random image title ${step}")`,
    '',
    `<img src="${TINY_PNG_DATA_URL}" alt="Random HTML image ${step}" width="40%" align="right" title="Random HTML image title ${step}" data-vlaina-crop="1,2,30,40,1" />`,
    '',
    `<img src='${TINY_PNG_DATA_URL}' alt='Random single quote image ${step}' width='50%' align='left' title='Random single quote title ${step}' />`,
    '',
    `![video](https://www.youtube.com/watch?v=dQw4w9WgXcQ "Random video ${step}")`,
    '',
    `![Direct video random ${step}](https://example.com/video-${step}.mp4)`,
    '',
  ].join('\n');
}

function createFootnoteFragment(step: number): string {
  return [
    `Random footnote reference ${step}[^random-note-${step}].`,
    '',
    `[^random-note-${step}]: Random footnote definition ${step}.`,
    '',
    `Nested random footnote ${step}[^random-nested-${step}].`,
    '',
    `[^random-nested-${step}]: Nested footnote first paragraph ${step}.`,
    '',
    `    Nested footnote second paragraph ${step}.`,
    '',
    `    - Nested footnote list item ${step}`,
    '',
  ].join('\n');
}

function createRawHtmlFragment(step: number): string {
  return [
    `<div class="raw-html-random">Raw HTML block random ${step}</div>`,
    '',
    `Inline raw HTML random ${step}: <kbd>Ctrl</kbd>+<kbd>F${step % 12}</kbd> <ruby>Han<rt>han random ${step}</rt></ruby>.`,
    '',
    `<details open><summary>Details summary random ${step}</summary><p>Details body random ${step}</p></details>`,
    '',
    '<pre>',
    `raw pre html random ${step}`,
    '</pre>',
    '',
    `<iframe src="https://example.com/embed/${step}"></iframe>`,
    '',
    `<video src="xxx-${step}.mp4" controls />`,
    '',
    `<audio src="xxx-${step}.mp3" controls />`,
    '',
  ].join('\n');
}

function createFrontmatterLikeFragment(seed: string, step: number): string {
  return [
    '---',
    `title: Random frontmatter-like paste ${randomSafeId(seed, step)}`,
    'tags:',
    '  - random',
    '  - e2e',
    '---',
    '',
    `Frontmatter-like random body ${step}.`,
    '',
  ].join('\n');
}

function createSyntaxCoverageFragments(seed: string, rng: () => number): SyntaxCoverageFragment[] {
  const baseStep = Math.max(1, hashSeed(seed) % 10_000);
  return shuffle(rng, [
    {
      category: 'toc-headings',
      markdown: createTocHeadingFragment(baseStep + 1),
      textProbe: `Setext random heading ${baseStep + 1}`,
    },
    {
      category: 'inline-marks-links-abbr',
      markdown: createInlineMarksFragment(rng, baseStep + 2),
      textProbe: `Inline random marks ${baseStep + 2}`,
    },
    {
      category: 'breaks-escapes-html',
      markdown: createBreakEscapeHtmlFragment(baseStep + 3),
      textProbe: `Escaped syntax random ${baseStep + 3}`,
    },
    {
      category: 'quotes-callouts',
      markdown: createQuoteCalloutFragment(baseStep + 4),
      textProbe: `Random quote ${baseStep + 4}`,
    },
    {
      category: 'lists-definitions',
      markdown: createListDefinitionFragment(baseStep + 5),
      textProbe: `Random unchecked task ${baseStep + 5}`,
    },
    {
      category: 'tables-rules',
      markdown: createTableRuleFragment(baseStep + 6),
      textProbe: `Escaped | pipe ${baseStep + 6}`,
    },
    {
      category: 'code-fences',
      markdown: createCodeFenceFragment(baseStep + 7),
      textProbe: `code block ${baseStep + 7}`,
    },
    {
      category: 'math-markdown',
      markdown: createMathMarkdownFragment(baseStep + 8),
      textProbe: `Inline math random ${baseStep + 8}`,
    },
    {
      category: 'mermaid-alias',
      markdown: createMermaidMarkdownFragment(baseStep + 9),
    },
    {
      category: 'media',
      markdown: createMediaFragment(baseStep + 10),
    },
    {
      category: 'footnotes',
      markdown: createFootnoteFragment(baseStep + 11),
      textProbe: `Random footnote reference ${baseStep + 11}`,
    },
    {
      category: 'raw-html',
      markdown: createRawHtmlFragment(baseStep + 12),
      textProbe: `Raw HTML block random ${baseStep + 12}`,
    },
    {
      category: 'frontmatter-like-paste',
      markdown: createFrontmatterLikeFragment(seed, baseStep + 13),
      textProbe: `Frontmatter-like random body ${baseStep + 13}`,
    },
  ]);
}

function createRandomMarkdownFragment(rng: () => number, seed: string, step: number, corpus: readonly string[]): string {
  const variants = [
    () => createRandomParagraph(rng, step),
    () => createTocHeadingFragment(step),
    () => createInlineMarksFragment(rng, step),
    () => createBreakEscapeHtmlFragment(step),
    () => [
      `## Random heading ${step}`,
      '',
      `- Random bullet ${randomAsciiWord(rng)}`,
      `- [${rng() > 0.5 ? 'x' : ' '}] Random task ${randomAsciiWord(rng)}`,
      `1. Random ordered ${randomInt(rng, 100)}`,
      '',
    ].join('\n'),
    () => [
      `| Random ${step} | Value |`,
      '| --- | ---: |',
      `| ${randomAsciiWord(rng)} | ${randomInt(rng, 1000)} |`,
      `| ${randomCjkToken(rng)} | ${randomInt(rng, 1000)} |`,
      '',
    ].join('\n'),
    () => [
      '```md',
      `# nested random ${step}`,
      '```mermaid',
      'graph TD',
      'A --> B',
      '```',
      '```',
      '',
    ].join('\n'),
    () => [
      `> [!NOTE] Random callout ${step}`,
      `> ${createRandomParagraph(rng, step).trim()}`,
      '',
    ].join('\n'),
    () => [
      `Random link ${step}: [docs ${step}](https://example.com/random/${step}) and www.example.org/${step}.`,
      `Inline math ${step}: $x_${step}^2 + y_${step}^2$.`,
      '',
    ].join('\n'),
    () => createFrontmatterLikeFragment(seed, step),
    () => createQuoteCalloutFragment(step),
    () => createListDefinitionFragment(step),
    () => createTableRuleFragment(step),
    () => createCodeFenceFragment(step),
    () => createMathMarkdownFragment(step),
    () => createMermaidMarkdownFragment(step),
    () => createMediaFragment(step),
    () => createFootnoteFragment(step),
    () => createRawHtmlFragment(step),
    () => pick(rng, corpus),
  ];
  return pick(rng, variants)();
}

function createRandomLatex(rng: () => number, step: number): string {
  const variables = ['x', 'y', 'z', 'a', 'b', 'c'];
  const left = pick(rng, variables);
  const right = pick(rng, variables);
  return [
    `\\sum_{i=1}^{${2 + randomInt(rng, 8)}} ${left}_i^2 + ${right}_${step}`,
    `= \\frac{${1 + randomInt(rng, 9)}}{${2 + randomInt(rng, 9)}}`,
  ].join(' ');
}

function createRandomMermaid(rng: () => number, step: number): string {
  const labels = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Input', 'Render', 'Save'];
  return [
    'graph TD',
    `A${step}[${pick(rng, labels)}] --> B${step}(${pick(rng, labels)})`,
    `B${step} --> C${step}{${pick(rng, labels)}?}`,
    `C${step} -->|yes| D${step}[${pick(rng, labels)}]`,
    `C${step} -->|no| E${step}[${pick(rng, labels)}]`,
  ].join('\n');
}

async function measureOperation<T>(
  metrics: RandomMetric[],
  step: number,
  operation: string,
  callback: () => Promise<T>,
  detail?: unknown | (() => unknown),
): Promise<T> {
  const startedAt = Date.now();
  const result = await callback();
  const resolvedDetail = typeof detail === 'function'
    ? (detail as () => unknown)()
    : detail;
  metrics.push({
    step,
    operation,
    durationMs: Date.now() - startedAt,
    detail: resolvedDetail,
  });
  return result;
}

async function focusEditorAtEnd(page: Page) {
  let focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
  if (!focused) {
    await page.locator(LIVE_EDITOR_SELECTOR).click({
      force: true,
      position: { x: 8, y: 8 },
      timeout: 5_000,
    });
    await waitForEditorAnimationFrame(page);
    focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
  }
  if (!focused) {
    const debugState = await page.evaluate(() => (window as any).__vlainaE2E.getEditorToolbarDebugState());
    console.info('[notes-random-interaction-focus-debug]', debugState);
  }
  expect(focused).toBe(true);
  await waitForEditorAnimationFrame(page);
}

async function typeAtEnd(page: Page, text: string): Promise<MainThreadFrameProbeResult & {
  dispatchProfile: EditorDispatchProfileSummary | null;
}> {
  await focusEditorAtEnd(page);
  const dispatchProfileStarted = await page.evaluate(() => (
    window as any
  ).__vlainaE2E.startEditorDispatchProfile?.() ?? false);
  await startMainThreadFrameProbe(page);
  let frameProbe: MainThreadFrameProbeResult = {
    frameCount: 0,
    longFramesOver50: 0,
    longFramesOver100: 0,
    longTaskCount: 0,
    maxFrameMs: 0,
    maxLongTaskMs: 0,
    p95FrameMs: 0,
  };
  let dispatchProfile: EditorDispatchProfileSummary | null = null;
  try {
    await page.keyboard.type(text, { delay: 0 });
    await waitForEditorAnimationFrame(page);
  } finally {
    frameProbe = await stopMainThreadFrameProbe(page);
    dispatchProfile = dispatchProfileStarted
      ? await page.evaluate(() => (
        window as any
      ).__vlainaE2E.stopEditorDispatchProfile?.() ?? null)
      : null;
  }
  return { ...frameProbe, dispatchProfile };
}

async function pasteAtEnd(page: Page, text: string) {
  await focusEditorAtEnd(page);
  await page.evaluate(async (clipboardText) => {
    await (window as any).__vlainaE2E.writeClipboardText(clipboardText);
  }, text);
  await page.keyboard.press('Control+V');
  await waitForEditorAnimationFrame(page);
}

async function insertSelectableTargetAtEnd(page: Page, target: string, suffix: string) {
  await pasteAtEnd(page, `${target}${suffix}\n\n`);
  await expect
    .poll(() => countEditorTextOccurrences(page, target), {
      message: `Expected inserted target to be present: ${target}`,
    })
    .toBeGreaterThan(0);
}

async function selectEditorText(page: Page, text: string) {
  const selected = await page.evaluate(
    (targetText) => (window as any).__vlainaE2E.selectEditorTextByText(targetText, targetText),
    text,
  );
  if (!selected.selected) {
    const debugState = await page.evaluate((targetText) => {
      const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
      return {
        targetText,
        editorHasText: editor?.textContent?.includes(targetText) ?? false,
        selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
        toolbar: (window as any).__vlainaE2E.getEditorToolbarDebugState(),
      };
    }, text);
    console.info('[notes-random-interaction-selection-debug]', debugState);
  }
  expect(selected.selected, `Expected to select ${text}`).toBe(true);
  await expect(page.locator(TOOLBAR_SELECTOR)).toBeVisible({ timeout: 5_000 });
}

async function clickToolbarAction(page: Page, action: string) {
  const button = page.locator(`${TOOLBAR_SELECTOR} [data-action="${action}"]`).first();
  await expect(button).toBeVisible({ timeout: 5_000 });
  await button.click();
  await waitForEditorAnimationFrame(page);
}

async function pressEditorShortcut(page: Page, shortcut: string) {
  await page.bringToFront();
  await page.locator(LIVE_EDITOR_SELECTOR).focus();
  await waitForEditorAnimationFrame(page);
  const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditor());
  if (!focused) {
    const debugState = await page.evaluate(() => (window as any).__vlainaE2E.getEditorToolbarDebugState());
    console.info('[notes-random-interaction-shortcut-focus-debug]', { shortcut, debugState });
  }
  await page.keyboard.press(shortcut);
  await waitForEditorAnimationFrame(page);
  await waitForEditorAnimationFrame(page);
}

async function clickVisibleElement(page: Page, selector: string, description: string) {
  const element = page.locator(selector).first();
  await expect(element, `Expected ${description} to be visible`).toBeVisible({ timeout: 5_000 });
  await element.scrollIntoViewIfNeeded();
  await waitForEditorAnimationFrame(page);
  await element.click();
  await waitForEditorAnimationFrame(page);
}

async function expectEditorTextMark(
  page: Page,
  text: string,
  markName: string,
  selector: string,
) {
  const hasMark = await editorTextHasMark(page, text, markName);
  if (!hasMark) {
    const debugState = await page.evaluate(() => (window as any).__vlainaE2E.getEditorToolbarDebugState());
    console.info('[notes-random-interaction-mark-debug]', { text, markName, debugState });
  }
  expect(hasMark, `Expected ${text} to have ${markName}`).toBe(true);
  await expect(page.locator(selector, { hasText: text })).toBeVisible({ timeout: 5_000 });
}

async function editorTextHasMark(page: Page, text: string, markName: string) {
  return page.evaluate(
    ({ targetText, targetMark }) => (
      window as any
    ).__vlainaE2E.editorTextHasMark(targetText, targetMark, targetText),
    { targetText: text, targetMark: markName },
  );
}

async function saveTextEditorPopup(page: Page, popupSelector: string) {
  await page.keyboard.press('Control+Enter');
  try {
    await expect(page.locator(popupSelector)).toHaveCount(0, { timeout: 1_000 });
    return;
  } catch {
    const saveButton = page.locator(`${popupSelector} .text-editor-action-button-primary`).first();
    await expect(saveButton).toBeVisible({ timeout: 5_000 });
    await saveButton.click();
  }
  await expect(page.locator(popupSelector)).toHaveCount(0, { timeout: 10_000 });
}

async function openAndSaveMathPopup(page: Page, latex: string) {
  const beforeCount = await page.locator(`${LIVE_EDITOR_SELECTOR} div[data-type="math-block"]`).count();
  await focusEditorAtEnd(page);
  await pressEditorShortcut(page, 'Control+Shift+M');
  const textarea = page.locator('.math-editor-popup textarea.text-editor-textarea').first();
  await expect(textarea).toBeVisible({ timeout: 5_000 });
  await textarea.fill(latex);
  await saveTextEditorPopup(page, '.math-editor-popup');
  await expect
    .poll(() => page.locator(`${LIVE_EDITOR_SELECTOR} div[data-type="math-block"]`).count())
    .toBeGreaterThan(beforeCount);
}

async function openAndSaveMermaidPopup(page: Page, code: string) {
  const beforeCount = await page.locator(`${LIVE_EDITOR_SELECTOR} div[data-type="mermaid"]`).count();
  await focusEditorAtEnd(page);
  await page.keyboard.type('```mermaid', { delay: 0 });
  await waitForEditorAnimationFrame(page);
  await page.keyboard.press('Enter');
  const textarea = page.locator('.mermaid-editor-popup textarea.text-editor-textarea').first();
  await expect(textarea).toBeVisible({ timeout: 5_000 });
  await textarea.fill(code);
  await saveTextEditorPopup(page, '.mermaid-editor-popup');
  await expect
    .poll(() => page.locator(`${LIVE_EDITOR_SELECTOR} div[data-type="mermaid"]`).count())
    .toBeGreaterThan(beforeCount);
}

async function countEditorTextOccurrences(page: Page, text: string) {
  return page.evaluate((targetText) => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
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

test.describe('notes random interaction performance', () => {
  test.setTimeout(600_000);

  test('runs seeded random editing, paste, toolbar, popup, scroll, and scan interactions without stalls', async () => {
    const seed = getRandomSeed();
    const steps = getRandomStepCount();
    const rng = createRng(seed);
    const manualMarkdown = await fs.readFile(MANUAL_MARKDOWN_PATH, 'utf8');
    const corpus = createManualCorpus(manualMarkdown);
    expect(corpus.length).toBeGreaterThan(20);

    const { app, userDataRoot } = await launchIsolatedElectron('notes-random-interaction-performance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const metrics: RandomMetric[] = [];
      const insertedTargets: string[] = [];
      const syntaxCoverageFragments = createSyntaxCoverageFragments(seed, rng);
      const markActions: ToolbarMarkAction[] = [
        { action: 'bold', markName: 'strong', selector: `${LIVE_EDITOR_SELECTOR} strong` },
        { action: 'italic', markName: 'emphasis', selector: `${LIVE_EDITOR_SELECTOR} em` },
        { action: 'highlight', markName: 'highlight', selector: `${LIVE_EDITOR_SELECTOR} mark` },
        { action: 'underline', markName: 'underline', selector: `${LIVE_EDITOR_SELECTOR} u` },
        { action: 'strike', markName: 'strike_through', selector: `${LIVE_EDITOR_SELECTOR} s, ${LIVE_EDITOR_SELECTOR} del, ${LIVE_EDITOR_SELECTOR} strike` },
        { action: 'code', markName: 'inlineCode', selector: `${LIVE_EDITOR_SELECTOR} code` },
      ];
      const operations: WeightedOperation[] = [
        { operation: 'type-random-paragraph', weight: 16 },
        { operation: 'paste-random-markdown', weight: 14 },
        { operation: 'toolbar-mark', weight: 12 },
        { operation: 'keyboard-shortcut', weight: 6 },
        { operation: 'toolbar-block-heading', weight: 5 },
        { operation: 'toolbar-alignment', weight: 5 },
        { operation: 'toolbar-text-color', weight: 4 },
        { operation: 'toolbar-link', weight: 4 },
        { operation: 'toolbar-copy-delete', weight: 3 },
        { operation: 'math-popup', weight: 5 },
        { operation: 'mermaid-popup', weight: 5 },
        { operation: 'copy-paste-existing', weight: 4 },
        { operation: 'undo-redo', weight: 4 },
        { operation: 'select-random-blocks', weight: 3 },
        { operation: 'scroll-and-scan', weight: 3 },
      ];

      await openMarkdownFixture(page, {
        filename: 'random-interaction-performance-e2e.md',
        content: [
          '---',
          'title: Random Interaction Performance',
          'tags:',
          '  - e2e',
          '  - random',
          '---',
          '',
          '# Random Interaction Performance',
          '',
          '[TOC]',
          '',
          '{:toc}',
          '',
          'Baseline paragraph for seeded random editing.',
          '',
          '- Baseline list item',
          '- [ ] Baseline task item',
          '',
          '| Key | Value |',
          '| --- | --- |',
          '| baseline | ready |',
          '',
        ].join('\n'),
      });

      for (let step = 0; step < steps; step += 1) {
        const syntaxCoverageFragment = step < syntaxCoverageFragments.length
          ? syntaxCoverageFragments[step]
          : null;
        const operation: RandomOperation = syntaxCoverageFragment
          ? 'paste-syntax-coverage'
          : weightedPick(rng, operations);
        let operationDetail: unknown = syntaxCoverageFragment
          ? { category: syntaxCoverageFragment.category }
          : undefined;
        const stepLabel = syntaxCoverageFragment
          ? `seed ${seed} step ${step + 1}/${steps} ${operation} ${syntaxCoverageFragment.category}`
          : `seed ${seed} step ${step + 1}/${steps} ${operation}`;
        await test.step(stepLabel, async () => {
          await measureOperation(metrics, step, operation, async () => {
            if (operation === 'paste-syntax-coverage') {
              expect(syntaxCoverageFragment).not.toBeNull();
              await pasteAtEnd(page, syntaxCoverageFragment!.markdown);
              if (syntaxCoverageFragment!.textProbe) {
                await expect(page.locator(LIVE_EDITOR_SELECTOR)).toContainText(syntaxCoverageFragment!.textProbe, {
                  timeout: 10_000,
                });
              }
              return;
            }

            if (operation === 'type-random-paragraph') {
              const text = createRandomParagraph(rng, step);
              const probe = await typeAtEnd(page, text);
              operationDetail = { chars: text.length, ...probe };
              return;
            }

            if (operation === 'paste-random-markdown') {
              const text = createRandomMarkdownFragment(rng, seed, step, corpus);
              await pasteAtEnd(page, text);
              return;
            }

            if (operation === 'toolbar-mark') {
              const target = `Random mark target ${step} ${randomAsciiWord(rng)}`;
              insertedTargets.push(target);
              await insertSelectableTargetAtEnd(page, target, ' plain text.');
              await selectEditorText(page, target);
              const mark = pick(rng, markActions);
              await clickToolbarAction(page, mark.action);
              await expectEditorTextMark(page, target, mark.markName, mark.selector);
              return;
            }

            if (operation === 'keyboard-shortcut') {
              const target = `Random shortcut target ${step} ${randomAsciiWord(rng)}`;
              insertedTargets.push(target);
              await insertSelectableTargetAtEnd(page, target, ' shortcut text.');
              await selectEditorText(page, target);
              const shortcut = rng() > 0.5
                ? { keys: 'Control+B', markName: 'strong', selector: `${LIVE_EDITOR_SELECTOR} strong` }
                : { keys: 'Control+I', markName: 'emphasis', selector: `${LIVE_EDITOR_SELECTOR} em` };
              const beforeHasMark = await editorTextHasMark(page, target, shortcut.markName);
              await pressEditorShortcut(page, shortcut.keys);
              await expect
                .poll(() => editorTextHasMark(page, target, shortcut.markName), {
                  message: `Expected ${shortcut.keys} to toggle ${shortcut.markName} on ${target}`,
                })
                .toBe(!beforeHasMark);
              return;
            }

            if (operation === 'toolbar-block-heading') {
              const target = `Random heading target ${step} ${randomAsciiWord(rng)}`;
              insertedTargets.push(target);
              const level = pick(rng, ['heading2', 'heading3']);
              const selector = level === 'heading2' ? 'h2' : 'h3';
              await insertSelectableTargetAtEnd(page, target, ' block text.');
              await selectEditorText(page, target);
              await clickToolbarAction(page, 'block');
              await clickVisibleElement(page, `.block-dropdown [data-block-type="${level}"]`, `${level} dropdown item`);
              await expect(page.locator(`${LIVE_EDITOR_SELECTOR} ${selector}`, { hasText: target })).toBeVisible({ timeout: 5_000 });
              return;
            }

            if (operation === 'toolbar-alignment') {
              const target = `Random alignment target ${step} ${randomAsciiWord(rng)}`;
              insertedTargets.push(target);
              const alignment = pick(rng, ['center', 'right']);
              await insertSelectableTargetAtEnd(page, target, ' alignment text.');
              await selectEditorText(page, target);
              await clickToolbarAction(page, 'alignment');
              await clickVisibleElement(page, `.alignment-dropdown [data-alignment="${alignment}"]`, `${alignment} alignment item`);
              await expect(page.locator(`${LIVE_EDITOR_SELECTOR} [data-text-align="${alignment}"]`, { hasText: target })).toBeVisible({ timeout: 5_000 });
              return;
            }

            if (operation === 'toolbar-text-color') {
              const target = `Random color target ${step} ${randomAsciiWord(rng)}`;
              insertedTargets.push(target);
              await insertSelectableTargetAtEnd(page, target, ' color text.');
              await selectEditorText(page, target);
              await clickToolbarAction(page, 'color');
              await clickVisibleElement(
                page,
                '.color-picker [data-type="text"] .color-picker-grid .color-picker-item:not(.color-picker-item-default)',
                'text color swatch',
              );
              await expect(page.locator(`${LIVE_EDITOR_SELECTOR} span[data-text-color]`, { hasText: target })).toBeVisible({ timeout: 5_000 });
              return;
            }

            if (operation === 'toolbar-link') {
              const target = `Random link target ${step} ${randomAsciiWord(rng)}`;
              const url = `https://example.com/random/${seed.replace(/[^a-z0-9]+/gi, '-')}/${step}`;
              insertedTargets.push(target);
              await insertSelectableTargetAtEnd(page, target, ' link text.');
              await selectEditorText(page, target);
              await clickToolbarAction(page, 'link');
              const input = page.locator('.link-tooltip-container textarea').first();
              await expect(input).toBeVisible({ timeout: 5_000 });
              await input.fill(url);
              await input.press('Enter');
              await waitForEditorAnimationFrame(page);
              await expect(page.locator(`${LIVE_EDITOR_SELECTOR} a[href="${url}"]`, { hasText: target })).toBeVisible({ timeout: 5_000 });
              return;
            }

            if (operation === 'toolbar-copy-delete') {
              const target = `Random toolbar copy delete target ${step} ${randomAsciiWord(rng)}`;
              insertedTargets.push(target);
              await insertSelectableTargetAtEnd(page, target, ' toolbar copy delete text.');
              const beforeCopyCount = await countEditorTextOccurrences(page, target);
              await selectEditorText(page, target);
              await clickToolbarAction(page, 'copy');
              await focusEditorAtEnd(page);
              await page.keyboard.press('Control+V');
              await waitForEditorAnimationFrame(page);
              await expect
                .poll(() => countEditorTextOccurrences(page, target), {
                  message: `Expected toolbar copy to populate clipboard for ${target}`,
                })
                .toBeGreaterThan(beforeCopyCount);

              const beforeDeleteCount = await countEditorTextOccurrences(page, target);
              await selectEditorText(page, target);
              await clickToolbarAction(page, 'delete');
              await waitForEditorAnimationFrame(page);
              await expect
                .poll(() => countEditorTextOccurrences(page, target), {
                  message: `Expected toolbar delete to remove one selection for ${target}`,
                })
                .toBeLessThan(beforeDeleteCount);
              return;
            }

            if (operation === 'math-popup') {
              await openAndSaveMathPopup(page, createRandomLatex(rng, step));
              return;
            }

            if (operation === 'mermaid-popup') {
              await openAndSaveMermaidPopup(page, createRandomMermaid(rng, step));
              return;
            }

            if (operation === 'copy-paste-existing') {
              const existingTargets: string[] = [];
              for (const candidate of insertedTargets) {
                if (await countEditorTextOccurrences(page, candidate) > 0) {
                  existingTargets.push(candidate);
                }
              }
              if (existingTargets.length === 0) {
                await typeAtEnd(page, createRandomParagraph(rng, step));
                return;
              }
              const target = pick(rng, existingTargets);
              const beforeCount = await countEditorTextOccurrences(page, target);
              await selectEditorText(page, target);
              await page.keyboard.press('Control+C');
              await focusEditorAtEnd(page);
              await page.keyboard.press('Control+V');
              await waitForEditorAnimationFrame(page);
              await expect
                .poll(() => countEditorTextOccurrences(page, target), {
                  message: `Expected copy/paste to duplicate ${target}`,
                })
                .toBeGreaterThan(beforeCount);
              return;
            }

            if (operation === 'undo-redo') {
              const target = `Random undo target ${step} ${randomAsciiWord(rng)}`;
              await insertSelectableTargetAtEnd(page, target, ' undo text.');
              await page.keyboard.press('Control+Z');
              await waitForEditorAnimationFrame(page);
              await expect.poll(() => countEditorTextOccurrences(page, target)).toBe(0);
              await page.keyboard.press('Control+Y');
              await waitForEditorAnimationFrame(page);
              await expect.poll(() => countEditorTextOccurrences(page, target)).toBeGreaterThan(0);
              insertedTargets.push(target);
              return;
            }

            if (operation === 'select-random-blocks') {
              const count = await page.evaluate(() => (window as any).__vlainaE2E.getNoteSelectableBlocks().length);
              if (count <= 0) {
                return;
              }
              const first = randomInt(rng, count);
              const second = randomInt(rng, count);
              const selectedCount = await page.evaluate((indexes) => (
                window as any
              ).__vlainaE2E.selectNoteBlocksByIndexes(indexes), [first, second]);
              expect(selectedCount).toBeGreaterThan(0);
              await waitForEditorAnimationFrame(page);
              await page.evaluate(() => (window as any).__vlainaE2E.selectNoteBlocksByIndexes([]));
              return;
            }

            const blockScanMetrics = await measureRepeatedBlockScan(page, 8);
            const scrollMetrics = await measureScrollFrames(page, 12);
            expect(blockScanMetrics.p95Ms).toBeLessThan(250);
            expect(scrollMetrics?.maxFrameMs ?? 0).toBeLessThan(1_500);
          }, () => operationDetail);
        });
      }

      const blockScanMetrics = await measureRepeatedBlockScan(page, 12);
      const scrollMetrics = await measureScrollFrames(page, 24);
      const domMetrics = await collectEditorDomMetrics(page);
      const slowestOperations = [...metrics]
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 12);
      const maxOperationMs = Math.max(...metrics.map((metric) => metric.durationMs));
      const avgOperationMs = metrics.reduce((sum, metric) => sum + metric.durationMs, 0) / Math.max(1, metrics.length);
      const typeOperationDetails = metrics.flatMap((metric) => {
        if (metric.operation !== 'type-random-paragraph') return [];
        const detail = metric.detail as (Partial<MainThreadFrameProbeResult> & {
          dispatchProfile?: Partial<EditorDispatchProfileSummary> | null;
        }) | undefined;
        return typeof detail?.maxFrameMs === 'number' ? [detail] : [];
      });
      const maxTypeOperationFrameMs = Math.max(0, ...typeOperationDetails.map((detail) => detail.maxFrameMs ?? 0));
      const maxTypeOperationLongTaskMs = Math.max(0, ...typeOperationDetails.map((detail) => detail.maxLongTaskMs ?? 0));
      const totalTypeOperationLongFramesOver100 = typeOperationDetails
        .reduce((sum, detail) => sum + (detail.longFramesOver100 ?? 0), 0);
      const maxTypeOperationDispatchMs = Math.max(
        0,
        ...typeOperationDetails.map((detail) => detail.dispatchProfile?.maxDispatchMs ?? 0),
      );
      const maxTypeOperationTotalDispatchMs = Math.max(
        0,
        ...typeOperationDetails.map((detail) => detail.dispatchProfile?.totalDispatchMs ?? 0),
      );
      const maxTypeOperationPluginApplyTotalMs = Math.max(
        0,
        ...typeOperationDetails.map((detail) => detail.dispatchProfile?.pluginApplyTotalMs ?? 0),
      );
      const maxTypeOperationDecorationPropTotalMs = Math.max(
        0,
        ...typeOperationDetails.map((detail) => detail.dispatchProfile?.decorationPropTotalMs ?? 0),
      );
      const maxTypeOperationUpdateStateTotalMs = Math.max(
        0,
        ...typeOperationDetails.map((detail) => detail.dispatchProfile?.updateStateTotalMs ?? 0),
      );
      const maxTypeOperationUpdateStateInnerTotalMs = Math.max(
        0,
        ...typeOperationDetails.map((detail) => detail.dispatchProfile?.updateStateInnerTotalMs ?? 0),
      );
      const totalTypeOperationDispatchCount = typeOperationDetails
        .reduce((sum, detail) => sum + (detail.dispatchProfile?.dispatchCount ?? 0), 0);

      console.info('[notes-random-interaction-performance]', {
        seed,
        steps,
        metricCount: metrics.length,
        maxOperationMs,
        avgOperationMs: Math.round(avgOperationMs * 10) / 10,
        maxTypeOperationFrameMs,
        maxTypeOperationLongTaskMs,
        maxTypeOperationDispatchMs,
        maxTypeOperationTotalDispatchMs,
        maxTypeOperationPluginApplyTotalMs,
        maxTypeOperationDecorationPropTotalMs,
        maxTypeOperationUpdateStateTotalMs,
        maxTypeOperationUpdateStateInnerTotalMs,
        totalTypeOperationDispatchCount,
        totalTypeOperationLongFramesOver100,
        slowestOperations,
        blockScanMetrics,
        scrollMetrics,
        domMetrics,
      });
      console.info('[notes-random-interaction-slowest-json]', JSON.stringify(slowestOperations));

      expect(metrics.length).toBe(steps);
      expect(domMetrics.countsBySelector.sourceFallback).toBe(0);
      expect(domMetrics.editorTextLength).toBeGreaterThan(1_500);
      expect(domMetrics.selectableBlockCount).toBeGreaterThan(25);
      expect(domMetrics.countsBySelector.frontmatter).toBeGreaterThanOrEqual(1);
      expect(domMetrics.countsBySelector.toc).toBeGreaterThanOrEqual(2);
      expect(domMetrics.countsBySelector.callouts).toBeGreaterThanOrEqual(1);
      expect(domMetrics.countsBySelector.taskItems).toBeGreaterThanOrEqual(3);
      expect(domMetrics.countsBySelector.tables).toBeGreaterThanOrEqual(2);
      expect(domMetrics.countsBySelector.codeBlocks).toBeGreaterThanOrEqual(4);
      expect(domMetrics.countsBySelector.mathBlocks).toBeGreaterThanOrEqual(2);
      expect(domMetrics.countsBySelector.mathInline).toBeGreaterThanOrEqual(1);
      expect(domMetrics.countsBySelector.mermaid).toBeGreaterThanOrEqual(1);
      expect(domMetrics.countsBySelector.video).toBeGreaterThanOrEqual(2);
      expect(domMetrics.countsBySelector.footnoteRefs).toBeGreaterThanOrEqual(2);
      expect(domMetrics.countsBySelector.footnoteDefs).toBeGreaterThanOrEqual(2);
      expect(domMetrics.countsBySelector.images).toBeGreaterThanOrEqual(2);
      expect(domMetrics.countsBySelector.highlights).toBeGreaterThanOrEqual(1);
      expect(domMetrics.countsBySelector.superscript).toBeGreaterThanOrEqual(1);
      expect(domMetrics.countsBySelector.subscript).toBeGreaterThanOrEqual(1);
      expect(domMetrics.countsBySelector.abbr).toBeGreaterThanOrEqual(1);
      expect(domMetrics.countsBySelector.tags).toBeGreaterThanOrEqual(1);
      expect(domMetrics.countsBySelector.autolinks).toBeGreaterThanOrEqual(1);
      expect(domMetrics.countsBySelector.explicitLinks).toBeGreaterThanOrEqual(3);
      expect(domMetrics.countsBySelector.horizontalRules).toBeGreaterThanOrEqual(3);
      expect(blockScanMetrics.p95Ms).toBeLessThan(250);
      expect(scrollMetrics?.maxFrameMs ?? 0).toBeLessThan(1_500);
      expect(maxTypeOperationFrameMs).toBeLessThan(1_500);
      expect(maxTypeOperationLongTaskMs).toBeLessThan(1_500);
      expect(maxTypeOperationDispatchMs).toBeLessThan(1_500);
      expect(totalTypeOperationLongFramesOver100).toBeLessThan(60);
      expect(maxOperationMs).toBeLessThan(15_000);
      expect(avgOperationMs).toBeLessThan(2_500);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
