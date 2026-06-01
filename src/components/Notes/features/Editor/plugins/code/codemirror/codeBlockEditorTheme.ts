import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorSelection, Prec, RangeSetBuilder, StateField } from '@codemirror/state';
import { Decoration, EditorView as CodeMirror } from '@codemirror/view';
import { themeCodeBlockEditorTokens, themeStyleResetTokens } from '@/styles/themeTokens';
import { codeBlockHighlightStyle } from './codeBlockHighlightStyle';

const selectedTextDecoration = Decoration.mark({
  class: 'editor-code-selection-text',
});

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

export function createCodeBlockEditorTheme() {
  return [
    syntaxHighlighting(codeBlockHighlightStyle),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    Prec.highest(codeBlockSelectedTextField),
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
    }, { dark: false }),
  ];
}
