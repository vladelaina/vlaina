import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorSelection, Prec, RangeSetBuilder, StateField } from '@codemirror/state';
import { Decoration, EditorView as CodeMirror, highlightSpecialChars } from '@codemirror/view';
import { CARET_BLINK_HELD_ATTR, holdCaretBlink, isCaretNavigationKey } from '@/lib/ui/caretOverlayStyles';
import { themeCaretOverlayTokens, themeCodeBlockEditorTokens, themeStyleResetTokens } from '@/styles/themeTokens';
import { codeBlockHighlightStyle } from './codeBlockHighlightStyle';
import { codeBlockCompatibilityHighlightStyle } from './codeBlockCompatibilityHighlightStyle';

const selectedTextDecoration = Decoration.mark({
  class: 'editor-code-selection-text',
});

const CODE_BLOCK_LINE_CLASS = 'HyperMD-codeblock HyperMD-codeblock-bg cm-hmd-codeblock';
const CODE_BLOCK_BEGIN_LINE_CLASS = `${CODE_BLOCK_LINE_CLASS} HyperMD-codeblock-begin HyperMD-codeblock-begin-bg`;
const CODE_BLOCK_END_LINE_CLASS = `${CODE_BLOCK_LINE_CLASS} HyperMD-codeblock-end HyperMD-codeblock-end-bg`;
const CODE_BLOCK_SINGLE_LINE_CLASS = `${CODE_BLOCK_BEGIN_LINE_CLASS} HyperMD-codeblock-end HyperMD-codeblock-end-bg`;

const codeBlockCaretNavigationActiveViews = new WeakSet<CodeMirror>();

function holdCodeBlockCaretBlink(view: CodeMirror): void {
  holdCaretBlink(view.dom, codeBlockCaretNavigationActiveViews.has(view) ? null : undefined);
}

function buildSelectedTextDecorations(selection: EditorSelection) {
  const builder = new RangeSetBuilder<Decoration>();

  for (const range of selection.ranges) {
    if (range.empty) {
      continue;
    }

    builder.add(range.from, range.to, selectedTextDecoration);
  }

  return builder.finish();
}

const codeBlockSelectedTextField = StateField.define({
  create(state) {
    return buildSelectedTextDecorations(state.selection);
  },
  update(value, tr) {
    if (!tr.docChanged && !tr.selection) {
      return value;
    }

    return buildSelectedTextDecorations(tr.state.selection);
  },
  provide: (field) => CodeMirror.decorations.from(field),
});

function buildCodeBlockLineDecorations(state: { doc: { lines: number; line: (lineNumber: number) => { from: number } } }) {
  const builder = new RangeSetBuilder<Decoration>();
  const lineCount = Math.max(1, state.doc.lines);

  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const isFirst = lineNumber === 1;
    const isLast = lineNumber === lineCount;
    const className = isFirst && isLast
      ? CODE_BLOCK_SINGLE_LINE_CLASS
      : isFirst
        ? CODE_BLOCK_BEGIN_LINE_CLASS
        : isLast
          ? CODE_BLOCK_END_LINE_CLASS
          : CODE_BLOCK_LINE_CLASS;

    builder.add(line.from, line.from, Decoration.line({ class: className }));
  }

  return builder.finish();
}

const codeBlockCompatibilityLineField = StateField.define({
  create: buildCodeBlockLineDecorations,
  update(value, tr) {
    if (!tr.docChanged) return value;
    return buildCodeBlockLineDecorations(tr.state);
  },
  provide: (field) => CodeMirror.decorations.from(field),
});

export function createCodeBlockEditorTheme() {
  return [
    syntaxHighlighting(codeBlockHighlightStyle),
    syntaxHighlighting(codeBlockCompatibilityHighlightStyle),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    highlightSpecialChars(),
    Prec.highest(codeBlockSelectedTextField),
    Prec.highest(codeBlockCompatibilityLineField),
    CodeMirror.domEventHandlers({
      keydown(event, view) {
        if (isCaretNavigationKey(event)) {
          codeBlockCaretNavigationActiveViews.add(view);
          holdCodeBlockCaretBlink(view);
        }
        return false;
      },
      keyup(event, view) {
        if (isCaretNavigationKey(event)) {
          codeBlockCaretNavigationActiveViews.delete(view);
          holdCodeBlockCaretBlink(view);
        }
        return false;
      },
    }),
    CodeMirror.updateListener.of((update) => {
      if (update.focusChanged && !update.view.hasFocus) {
        codeBlockCaretNavigationActiveViews.delete(update.view);
      }
      if (update.selectionSet || update.docChanged || update.focusChanged) {
        holdCodeBlockCaretBlink(update.view);
      }
    }),
    CodeMirror.theme({
      '&': {
        backgroundColor: 'var(--vlaina-code-block-background)',
        color: 'var(--vlaina-code-syntax-foreground)',
        fontSize: themeCodeBlockEditorTokens.fontSize,
      },
      '.cm-editor': {
        backgroundColor: 'var(--vlaina-code-block-background)',
      },
      '.cm-scroller': {
        fontFamily: 'var(--font-mono), monospace',
        lineHeight: themeCodeBlockEditorTokens.lineHeight,
        overflowX: 'auto',
        textRendering: 'auto',
        fontKerning: 'none',
        fontVariantLigatures: 'none',
        fontFeatureSettings: '"liga" 0, "calt" 0, "dlig" 0',
      },
      '.cm-content, .cm-line, .cm-gutter, .cm-gutterElement': {
        fontFamily: 'inherit',
        textRendering: 'inherit',
        fontKerning: 'inherit',
        fontVariantLigatures: 'inherit',
        fontFeatureSettings: 'inherit',
      },
      '.cm-content': {
        padding: themeCodeBlockEditorTokens.contentPadding,
        minHeight: themeCodeBlockEditorTokens.contentMinHeight,
        caretColor: themeStyleResetTokens.colorTransparentImportant,
      },
      '.cm-line': {
        padding: themeCodeBlockEditorTokens.linePadding,
      },
      '.cm-gutters': {
        position: 'sticky',
        left: themeCodeBlockEditorTokens.contentPadding,
        zIndex: themeCodeBlockEditorTokens.gutterZIndex,
        paddingLeft: themeCodeBlockEditorTokens.gutterPaddingLeft,
        color: 'var(--vlaina-code-syntax-muted)',
        backgroundColor: 'var(--vlaina-code-block-background) !important',
        borderRight: themeStyleResetTokens.borderNoneImportant,
        border: themeStyleResetTokens.borderNoneImportant,
      },
      '.cm-gutter, .cm-lineNumbers, .cm-gutterElement, .cm-gutter-filler': {
        backgroundColor: 'var(--vlaina-code-block-background) !important',
        borderRight: themeStyleResetTokens.borderNoneImportant,
        border: themeStyleResetTokens.borderNoneImportant,
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: themeStyleResetTokens.backgroundTransparent,
      },
      '&.cm-focused': {
        outline: themeStyleResetTokens.outlineNone,
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--vlaina-selection-bg)',
      },
      '.cm-selectionBackground': {
        backgroundColor: themeStyleResetTokens.backgroundTransparent,
      },
      '.editor-code-selection-text, .editor-code-selection-text *': {
        color: 'var(--vlaina-color-white) !important',
        WebkitTextFillColor: 'var(--vlaina-color-white) !important',
      },
      '.cm-cursor, .cm-dropCursor, &.cm-focused .cm-cursor, &.cm-focused .cm-dropCursor': {
        borderLeftColor: 'var(--vlaina-caret-color) !important',
        borderLeftStyle: 'solid',
        borderLeftWidth: 'var(--vlaina-caret-width)',
      },
      [`&[${CARET_BLINK_HELD_ATTR}="true"] .cm-cursorLayer`]: {
        animation: `${themeStyleResetTokens.animationNone} !important`,
        opacity: `${themeCaretOverlayTokens.opacityVisible} !important`,
      },
      [`&[${CARET_BLINK_HELD_ATTR}="true"] .cm-cursor`]: {
        opacity: `${themeCaretOverlayTokens.opacityVisible} !important`,
      },
    }, { dark: false }),
  ];
}
