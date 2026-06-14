import { expect, test, type Page } from '@playwright/test';
import {
  CHAT_COMPOSER_TEXTAREA_SELECTOR,
  CHAT_VIEW_SELECTOR,
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  createChatFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  setAppViewMode,
} from './notesE2E';

const CARET_BLINK_HELD_ATTR = 'data-caret-blink-held';
const CARET_HOLD_RELEASE_WAIT_MS = 320;
const CARET_MOVEMENT_SAMPLE_MS = 900;
const ACCOUNT_LOGIN_REQUESTED_EVENT = 'account:login-requested';

type CaretVisibilitySample = {
  animationName: string;
  hasHold: boolean;
  height: number;
  left: number;
  opacity: string;
  present: boolean;
  top: number;
  visible: boolean;
};

type NativeInputCaretGeometry = {
  caretLeft: number;
  delta: number;
  expectedLeft: number;
  inputLeft: number;
  inputRight: number;
};

async function getCaretProbe(page: Page, selector: string) {
  return page.locator(selector).evaluate((element, attr) => {
    const style = getComputedStyle(element);
    return {
      hasHold: element.getAttribute(attr) === 'true',
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      opacity: style.opacity,
    };
  }, CARET_BLINK_HELD_ATTR);
}

async function expectHeldCaret(page: Page, selector: string) {
  await expect.poll(async () => getCaretProbe(page, selector), {
    timeout: 5_000,
  }).toMatchObject({
    hasHold: true,
    animationName: 'none',
    opacity: '1',
  });
}

async function expectReleasedCaret(page: Page, selector: string) {
  await page.waitForTimeout(CARET_HOLD_RELEASE_WAIT_MS);
  await expect.poll(async () => getCaretProbe(page, selector), {
    timeout: 5_000,
  }).toMatchObject({
    hasHold: false,
  });
}

async function openAccountLoginDialog(page: Page) {
  const accountButton = page.getByRole('button', { name: 'vlaina' }).first();
  await expect(accountButton).toBeVisible({ timeout: 30_000 });

  await page.evaluate((eventName) => {
    window.dispatchEvent(new Event(eventName));
  }, ACCOUNT_LOGIN_REQUESTED_EVENT);

  const emailInput = page.locator('input[autocomplete="email"]').first();
  try {
    await expect(emailInput).toBeVisible({ timeout: 1_500 });
    return emailInput;
  } catch {
    await accountButton.click();
    await page.getByRole('button', { name: /sign in/i }).first().click();
  }

  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  return emailInput;
}

async function closeAccountLoginDialog(page: Page) {
  await page.locator('[role="dialog"] button').first().click();
  await expect(page.locator('input[autocomplete="email"]')).toHaveCount(0);
}

async function expectNativeInputCaretAlignedToSelection(page: Page, inputSelector: string, value: string, selectionIndex: number) {
  const input = page.locator(inputSelector).first();
  await input.fill(value);
  await input.evaluate((element, index) => {
    element.focus();
    element.setSelectionRange(index, index);
    document.dispatchEvent(new Event('vlaina:native-caret-overlay-refresh'));
  }, selectionIndex);

  const readGeometry = () => page.evaluate(({ selector, index }) => {
    const inputElement = document.querySelector<HTMLInputElement>(selector);
    const caret = document.querySelector<HTMLElement>('.native-caret-overlay');
    if (!inputElement || !caret) {
      return null;
    }

    const inputRect = inputElement.getBoundingClientRect();
    const caretRect = caret.getBoundingClientRect();
    if (inputRect.width <= 0 || caretRect.height <= 0) {
      return null;
    }

    const styles = getComputedStyle(inputElement);
    const mirror = document.createElement('div');
    const copiedProperties = [
      'boxSizing',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'fontFamily',
      'fontSize',
      'fontStyle',
      'fontVariant',
      'fontVariantNumeric',
      'fontWeight',
      'fontStretch',
      'letterSpacing',
      'lineHeight',
      'textTransform',
      'textIndent',
      'textAlign',
      'direction',
      'wordSpacing',
      'tabSize',
    ] as const;
    for (const property of copiedProperties) {
      mirror.style[property] = styles[property];
    }
    mirror.style.position = 'fixed';
    mirror.style.visibility = 'hidden';
    mirror.style.pointerEvents = 'none';
    mirror.style.whiteSpace = 'pre';
    mirror.style.overflowWrap = 'normal';
    mirror.style.overflow = 'hidden';
    mirror.style.width = `${inputRect.width}px`;
    mirror.style.top = '0px';
    mirror.style.left = '0px';
    mirror.style.zIndex = '-1';

    const marker = document.createElement('span');
    const lineHeight = Number.parseFloat(styles.lineHeight) || Number.parseFloat(styles.fontSize) * 1.2 || 16;
    marker.style.display = 'inline-block';
    marker.style.width = '0px';
    marker.style.height = `${lineHeight}px`;
    marker.style.margin = '0px';
    marker.style.padding = '0px';
    marker.style.overflow = 'hidden';
    marker.style.letterSpacing = '0px';
    marker.style.verticalAlign = 'baseline';

    const valueBeforeCaret = inputElement.value.slice(0, index);
    const valueAfterCaret = inputElement.value.slice(index);
    if (valueBeforeCaret) {
      mirror.appendChild(document.createTextNode(valueBeforeCaret));
    }
    mirror.appendChild(marker);
    if (valueAfterCaret) {
      mirror.appendChild(document.createTextNode(valueAfterCaret));
    }
    document.body.appendChild(mirror);
    const markerRect = marker.getBoundingClientRect();
    mirror.remove();

    const expectedLeft = inputRect.left + markerRect.left - inputElement.scrollLeft;
    return {
      caretLeft: caretRect.left,
      delta: caretRect.left - expectedLeft,
      expectedLeft,
      inputLeft: inputRect.left,
      inputRight: inputRect.right,
    } satisfies NativeInputCaretGeometry;
  }, { index: selectionIndex, selector: inputSelector });

  await expect.poll(readGeometry, { timeout: 5_000 }).not.toBeNull();
  const geometry = await readGeometry();
  expect(geometry).not.toBeNull();
  if (!geometry) return;

  expect(geometry.caretLeft).toBeGreaterThan(geometry.inputLeft);
  expect(geometry.caretLeft).toBeLessThan(geometry.inputRight);
  expect(Math.abs(geometry.delta)).toBeLessThanOrEqual(3);
}

async function sampleCaretDuringRepeatedNavigation(
  page: Page,
  visibleSelector: string,
  holdSelector = visibleSelector,
  animationSelector = visibleSelector
): Promise<CaretVisibilitySample[]> {
  await page.keyboard.down('ArrowLeft');
  await expectHeldCaret(page, holdSelector);

  const samplesPromise = page.evaluate(({ animationTargetSelector, attr, durationMs, holdTargetSelector, visibleTargetSelector }) => {
    return new Promise<CaretVisibilitySample[]>((resolve) => {
      const startedAt = performance.now();
      const samples: CaretVisibilitySample[] = [];

      const sample = () => {
        const holdElement = document.querySelector<HTMLElement>(holdTargetSelector);
        const element = document.querySelector<HTMLElement>(visibleTargetSelector);
        const animationElement = document.querySelector<HTMLElement>(animationTargetSelector) ?? element;
        if (!element) {
          samples.push({
            animationName: '',
            hasHold: holdElement?.getAttribute(attr) === 'true',
            height: 0,
            left: 0,
            opacity: '',
            present: false,
            top: 0,
            visible: false,
          });
        } else {
          const style = getComputedStyle(animationElement ?? element);
          const rect = element.getBoundingClientRect();
          samples.push({
            animationName: style.animationName,
            hasHold: holdElement?.getAttribute(attr) === 'true',
            height: rect.height,
            left: rect.left,
            opacity: style.opacity,
            present: true,
            top: rect.top,
            visible: style.opacity !== '0' && rect.height > 0,
          });
        }

        if (performance.now() - startedAt >= durationMs) {
          resolve(samples);
        } else {
          requestAnimationFrame(sample);
        }
      };

      requestAnimationFrame(sample);
    });
  }, {
    animationTargetSelector: animationSelector,
    attr: CARET_BLINK_HELD_ATTR,
    durationMs: CARET_MOVEMENT_SAMPLE_MS,
    holdTargetSelector: holdSelector,
    visibleTargetSelector: visibleSelector,
  });

  for (let index = 0; index < 18; index += 1) {
    await page.waitForTimeout(35);
    await page.keyboard.down('ArrowLeft');
  }
  const samples = await samplesPromise;
  await page.keyboard.up('ArrowLeft');
  return samples;
}

function expectNoCaretBlinkDrop(samples: CaretVisibilitySample[]) {
  expect(samples.length).toBeGreaterThan(10);
  const missing = samples.filter((sample) => !sample.present);
  const invisible = samples.filter((sample) => !sample.visible);
  const released = samples.filter((sample) => !sample.hasHold);
  const animated = samples.filter((sample) => sample.animationName !== 'none');

  expect({
    animated: animated.slice(0, 5),
    invisible: invisible.slice(0, 5),
    missing: missing.slice(0, 5),
    released: released.slice(0, 5),
    sampleCount: samples.length,
  }).toEqual({
    animated: [],
    invisible: [],
    missing: [],
    released: [],
    sampleCount: samples.length,
  });
}

test.describe('caret blink hold', () => {
  test.setTimeout(120_000);

  test('keeps account input, native textarea, ProseMirror, frontmatter, and code carets visible while moving by keyboard', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('caret-blink-hold');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openAccountLoginDialog(page);
      await expectNativeInputCaretAlignedToSelection(
        page,
        'input[autocomplete="email"]',
        'middle-selection@example.com',
        'middle-selection'.length
      );
      expectNoCaretBlinkDrop(await sampleCaretDuringRepeatedNavigation(page, '.native-caret-overlay'));
      await expectReleasedCaret(page, '.native-caret-overlay');
      await closeAccountLoginDialog(page);

      await createChatFixture(page, {
        sessions: [
          {
            title: 'Caret Blink Chat',
            messages: [{ role: 'user', content: 'Caret blink fixture.' }],
          },
        ],
      });
      await setAppViewMode(page, 'chat');
      await expect(page.locator(CHAT_VIEW_SELECTOR)).toBeVisible({ timeout: 30_000 });

      const composer = page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR);
      await expect(composer).toBeVisible({ timeout: 30_000 });
      await composer.fill('abcdef');
      expectNoCaretBlinkDrop(await sampleCaretDuringRepeatedNavigation(page, '.native-caret-overlay'));
      await expectReleasedCaret(page, '.native-caret-overlay');

      await setAppViewMode(page, 'notes');
      await openMarkdownFixture(page, {
        filename: 'caret-blink-hold.md',
        content: [
          '---',
          'title: Caret Blink Hold',
          'tags:',
          '  - caret',
          '---',
          '',
          '# Caret Blink Hold',
          '',
          [
            'Plain caret movement sentinel text',
            ...Array.from({ length: 24 }, (_, index) => `middle segment ${index + 1}`),
            'tail text for repeated keyboard navigation.',
          ].join(' '),
          '',
          '```ts',
          'const caretBlinkHold = true;',
          '```',
          '',
        ].join('\n'),
      });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Plain caret movement sentinel', {
        timeout: 30_000,
      });

      const frontmatterCodeMirror = page.locator('.frontmatter-block-container .cm-editor').first();
      await expect(frontmatterCodeMirror).toBeVisible({ timeout: 30_000 });
      await frontmatterCodeMirror.click();
      expectNoCaretBlinkDrop(await sampleCaretDuringRepeatedNavigation(
        page,
        '.frontmatter-block-container .cm-cursor',
        '.frontmatter-block-container .cm-editor',
        '.frontmatter-block-container .cm-cursorLayer'
      ));
      await expectReleasedCaret(page, '.frontmatter-block-container .cm-editor');

      const paragraph = page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Plain caret movement sentinel' }).first();
      await paragraph.click();
      expectNoCaretBlinkDrop(await sampleCaretDuringRepeatedNavigation(page, '.editor-textblock-caret-overlay'));
      await expectReleasedCaret(page, '.editor-textblock-caret-overlay');

      const codeMirror = page.locator('.code-block-container .cm-editor').first();
      await expect(codeMirror).toBeVisible({ timeout: 30_000 });
      await codeMirror.click();
      expectNoCaretBlinkDrop(await sampleCaretDuringRepeatedNavigation(
        page,
        '.code-block-container .cm-cursor',
        '.code-block-container .cm-editor',
        '.code-block-container .cm-cursorLayer'
      ));
      await expect.poll(async () => page.locator('.code-block-container .cm-cursorLayer').first().evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          animationName: style.animationName,
          opacity: style.opacity,
        };
      }), { timeout: 5_000 }).toMatchObject({
        animationName: 'none',
        opacity: '1',
      });
      await expectReleasedCaret(page, '.code-block-container .cm-editor');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
