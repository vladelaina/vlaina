import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CARET_BLINK_HELD_ATTR,
  CARET_BLINK_HOLD_DELAY_MS,
  createCaretOverlayRect,
  holdCaretBlink,
  releaseCaretBlink,
} from '@/lib/ui/caretOverlayStyles';

function readIndexStyles() {
  return readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
}

function readThemeStyles() {
  return readFileSync(resolve(process.cwd(), 'src/styles/theme.css'), 'utf8');
}

function readEditorCoreStyles() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/styles/core.css'),
    'utf8'
  );
}

function readCodeBlockEditorTheme() {
  return readFileSync(
    resolve(
      process.cwd(),
      'src/components/Notes/features/Editor/plugins/code/codemirror/codeBlockEditorTheme.ts'
    ),
    'utf8'
  );
}

function readFrontmatterNodeView() {
  return readFileSync(
    resolve(
      process.cwd(),
      'src/components/Notes/features/Editor/plugins/frontmatter/FrontmatterNodeView.ts'
    ),
    'utf8'
  );
}

function readBlankAreaDragBoxPlugin() {
  return readFileSync(
    resolve(
      process.cwd(),
      'src/components/Notes/features/Editor/plugins/cursor/blankAreaDragBoxPlugin.ts'
    ),
    'utf8'
  );
}

function readForcedLineEdgeCaret() {
  return readFileSync(
    resolve(
      process.cwd(),
      'src/components/Notes/features/Editor/plugins/cursor/forcedLineEdgeCaret.ts'
    ),
    'utf8'
  );
}

function readTextBlockCaretOverlayPlugin() {
  return readFileSync(
    resolve(
      process.cwd(),
      'src/components/Notes/features/Editor/plugins/cursor/textBlockCaretOverlayPlugin.ts'
    ),
    'utf8'
  );
}

function readExternalTextDropCursorPlugin() {
  return readFileSync(
    resolve(
      process.cwd(),
      'src/components/Notes/features/Editor/plugins/cursor/externalTextDropCursorPlugin.ts'
    ),
    'utf8'
  );
}

function readNativeCaretOverlayHook() {
  return readFileSync(resolve(process.cwd(), 'src/hooks/useNativeCaretOverlay.ts'), 'utf8');
}

function readCaretOverlayStyles() {
  return readFileSync(resolve(process.cwd(), 'src/lib/ui/caretOverlayStyles.ts'), 'utf8');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('caret styles', () => {
  it('uses a shared global caret color token', () => {
    const css = readIndexStyles();
    const themeCss = readThemeStyles();

    expect(themeCss).toContain('--vlaina-color-caret: #41ace2;');
    expect(themeCss).toContain('--vlaina-caret-color: var(--vlaina-color-caret);');
    expect(themeCss).toContain('--vlaina-caret-width: 2px;');
    expect(css).toContain("[contenteditable]:not([contenteditable='false']) {");
    expect(css).toContain('caret-color: transparent;');
    expect(css).not.toMatch(/(?:^|\n)input,\s*\ntextarea,\s*\n\[contenteditable\]:not\(\[contenteditable='false'\]\)/);
  });

  it('keeps the editor caret sourced from the shared caret token', () => {
    const css = readEditorCoreStyles();

    expect(css).toContain('caret-color: transparent;');
    expect(css).not.toContain('--vlaina-editor-caret-color');
    expect(css).not.toContain('--vlaina-editor-caret-width');
  });

  it('keeps embedded code block carets sourced from the shared caret token', () => {
    const source = readCodeBlockEditorTheme();

    expect(source).toContain('caretColor: themeStyleResetTokens.colorTransparentImportant');
    expect(source).toContain("borderLeftColor: 'var(--vlaina-caret-color) !important'");
    expect(source).toContain("borderLeftWidth: 'var(--vlaina-caret-width)'");
    expect(source).toContain('CARET_BLINK_HELD_ATTR');
    expect(source).toContain('isCaretNavigationKey(event)');
    expect(source).toContain('codeBlockCaretNavigationActiveViews.add(view)');
    expect(source).toContain('codeBlockCaretNavigationActiveViews.delete(view)');
    expect(source).toContain('holdCaretBlink(view.dom, codeBlockCaretNavigationActiveViews.has(view) ? null : undefined)');
    expect(source).toContain('CodeMirror.domEventHandlers({');
    expect(source).toContain('CodeMirror.updateListener.of((update) => {');
    expect(source).toContain('update.selectionSet || update.docChanged || update.focusChanged');
    expect(source).toContain('.cm-cursorLayer');
    expect(source).not.toContain('vlaina-editor-caret');
    expect(source).not.toContain('#41ace2');
  });

  it('centralizes custom caret overlay styling on the shared token helper', () => {
    const source = readCaretOverlayStyles();

    expect(source).toContain("export const CARET_COLOR_VAR = 'var(--vlaina-caret-color)';");
    expect(source).toContain("export const CARET_WIDTH_VAR = 'var(--vlaina-caret-width)';");
    expect(source).toContain('export const CARET_VISUAL_HEIGHT_RATIO = 1;');
    expect(source).toContain('export const CARET_MIN_VISUAL_HEIGHT = 18;');
    expect(source).toContain("export const CARET_BLINK_HELD_ATTR = 'data-caret-blink-held';");
    expect(source).toContain('export const CARET_BLINK_HOLD_DELAY_MS = themeCaretOverlayTokens.blinkHoldDelayMs;');
    expect(source).toContain('export function isCaretNavigationKey');
    expect(source).toContain('export function createCaretOverlayRect');
    expect(source).toContain('export function holdCaretBlink');
    expect(source).toContain('export function releaseCaretBlink');
    expect(source).toContain('width: ${CARET_WIDTH_VAR};');
    expect(source).toContain('background: ${CARET_COLOR_VAR};');
    expect(source).toContain(".${caretClass}[${CARET_BLINK_HELD_ATTR}='true']");
    expect(source).toContain('animation: none !important;');
    expect(source).toContain('caret-color: transparent !important;');
  });

  it('holds custom caret blinking visible until movement becomes idle', () => {
    vi.useFakeTimers();

    const caret = document.createElement('div');
    holdCaretBlink(caret);

    expect(caret.getAttribute(CARET_BLINK_HELD_ATTR)).toBe('true');

    vi.advanceTimersByTime(CARET_BLINK_HOLD_DELAY_MS - 1);
    holdCaretBlink(caret);
    vi.advanceTimersByTime(CARET_BLINK_HOLD_DELAY_MS - 1);
    expect(caret.getAttribute(CARET_BLINK_HELD_ATTR)).toBe('true');

    vi.advanceTimersByTime(1);
    expect(caret.hasAttribute(CARET_BLINK_HELD_ATTR)).toBe(false);

    holdCaretBlink(caret, null);
    vi.advanceTimersByTime(CARET_BLINK_HOLD_DELAY_MS * 2);
    expect(caret.getAttribute(CARET_BLINK_HELD_ATTR)).toBe('true');
    holdCaretBlink(caret);
    vi.advanceTimersByTime(CARET_BLINK_HOLD_DELAY_MS);
    expect(caret.hasAttribute(CARET_BLINK_HELD_ATTR)).toBe(false);

    holdCaretBlink(caret);
    releaseCaretBlink(caret);
    expect(caret.hasAttribute(CARET_BLINK_HELD_ATTR)).toBe(false);
  });

  it('centers custom caret overlays inside the measured text line box', () => {
    expect(createCaretOverlayRect({ left: 7, top: 10, bottom: 30 })).toEqual({
      left: 7,
      top: 10,
      height: 20,
    });

    expect(createCaretOverlayRect({ left: 3, top: 40, bottom: 50 })).toEqual({
      left: 3,
      top: 36,
      height: 18,
    });
  });

  it('keeps all embedded CodeMirror editors on the shared caret theme', () => {
    const source = readFrontmatterNodeView();

    expect(source).toContain('...createCodeBlockEditorTheme()');
    expect(source).not.toContain('EditorView.theme');
    expect(source).not.toContain('caretColor');
    expect(source).not.toContain('cm-cursor');
  });

  it('keeps forced line-end carets sourced from the shared caret token', () => {
    const source = readForcedLineEdgeCaret();
    const pluginSource = readBlankAreaDragBoxPlugin();

    expect(source).toContain('createCaretOverlayStyle({');
    expect(source).toContain('createCaretOverlayRect({');
    expect(source).toContain("caretClass: 'editor-forced-line-end-caret'");
    expect(source).toContain('holdCaretBlink(caret)');
    expect(source).toContain('releaseCaretBlink(caret)');
    expect(pluginSource).toContain('clearForcedCaretForOwner(view.dom)');
    expect(source).not.toContain('Math.max(12, textRect.bottom - textRect.top)');
    expect(source).not.toContain('background: var(--vlaina-caret-color, #41ace2)');
  });

  it('keeps ProseMirror text block carets sourced from the shared caret token', () => {
    const source = readTextBlockCaretOverlayPlugin();

    expect(source).toContain('createCaretOverlayStyle({');
    expect(source).toContain('createCaretOverlayRect(rect)');
    expect(source).toContain('activeSelector: `.ProseMirror.${TEXTBLOCK_CARET_CLASS}`');
    expect(source).toContain('selection.$from.parent.isTextblock');
    expect(source).toContain('isCaretNavigationKey(event)');
    expect(source).toContain('holdCaretBlink(this.caret, null)');
    expect(source).toContain('holdCaretBlink(this.caret, this.keyboardCaretNavigationActive ? null : undefined)');
    expect(source).toContain('releaseCaretBlink(this.caret)');
    expect(source).toContain("view.dom.addEventListener('keydown', this.handleKeyDown)");
    expect(source).toContain("view.dom.addEventListener('keyup', this.handleKeyUp)");
    expect(source).not.toContain('Math.max(12, rect.bottom - rect.top)');
    expect(source).not.toContain('#41ace2');
  });

  it('keeps external text drop cursors on the shared caret geometry and token', () => {
    const css = readEditorCoreStyles();
    const source = readExternalTextDropCursorPlugin();
    const cursorRule = css.slice(
      css.indexOf('.editor-external-text-drop-cursor {'),
      css.indexOf('.editor-external-text-drop-cursor.block')
    );

    expect(cursorRule).toContain('width: var(--vlaina-caret-width);');
    expect(cursorRule).toContain('background: var(--vlaina-caret-color);');
    expect(cursorRule).toContain('transform: translateX(calc(var(--vlaina-caret-width) / -2));');
    expect(cursorRule).not.toContain('background: var(--vlaina-sidebar-row-selected-text, var(--vlaina-accent));');
    expect(source).toContain('createCaretOverlayRect(rect)');
    expect(source).not.toContain('MIN_CURSOR_HEIGHT');
  });

  it('keeps native input and textarea carets on the shared overlay token', () => {
    const source = readNativeCaretOverlayHook();

    expect(source).toContain('createCaretOverlayStyle({');
    expect(source).toContain('function getCollapsedSelectionStart');
    expect(source).toContain('return control.value.length;');
    expect(source).toContain('const SINGLE_LINE_INPUT_CARET_HEIGHT_RATIO = 0.56;');
    expect(source).toContain('function resolveSingleLineInputCaretHeight');
    expect(source).toContain('function createCaretMarker');
    expect(source).toContain('marker.style.display = themeDomStyleTokens.displayInlineBlock;');
    expect(source).toContain('marker.style.letterSpacing = themeDomStyleTokens.sizeZero;');
    expect(source).toContain("marker.textContent = '\\u200b';");
    expect(source).toContain('const textAfterCaret = control.value.slice(selectionStart);');
    expect(source).toContain('mirror.appendChild(control.ownerDocument.createTextNode(textAfterCaret));');
    expect(source).toContain('const markerHeight = markerRect.height;');
    expect(source).toContain("'textAlign'");
    expect(source).toContain("'direction'");
    expect(source).toContain("'fontVariantNumeric'");
    expect(source).toContain('control instanceof HTMLInputElement');
    expect(source).toContain('inputCaretHeight > 0 && contentHeight > 0');
    expect(source).toContain('contentTop + (contentHeight - inputCaretHeight) / 2');
    expect(source).toContain('top + inputCaretHeight');
    expect(source).toContain('createCaretOverlayRect(rect)');
    expect(source).toContain('isCaretNavigationKey(event)');
    expect(source).toContain('holdCaretBlink(caret, null)');
    expect(source).toContain('holdCaretBlink(caret, keyboardCaretNavigationActive ? null : undefined)');
    expect(source).toContain('releaseCaretBlink(caret)');
    expect(source).toContain("doc.addEventListener('keydown', handleKeyDown)");
    expect(source).toContain("doc.addEventListener('keyup', handleKeyUp)");
    expect(source).toContain("activeSelector: `[${ACTIVE_ATTR}='true']`");
    expect(source).toContain("activeElement.setAttribute(ACTIVE_ATTR, 'true')");
    expect(source).not.toContain('Math.max(12, rect.bottom - rect.top)');
    expect(source).not.toContain('#41ace2');
  });
});
