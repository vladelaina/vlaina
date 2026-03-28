import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { oneDark, oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import { EditorView as CodeMirror } from '@codemirror/view';

export function createCodeBlockEditorTheme() {
  return [
    oneDark,
    syntaxHighlighting(oneDarkHighlightStyle),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    CodeMirror.theme({
      '&': {
        backgroundColor: 'var(--vlaina-code-block-background, #f5f5f5)',
        fontSize: '0.875rem',
      },
      '.cm-editor': {
        backgroundColor: 'var(--vlaina-code-block-background, #f5f5f5)',
      },
      '.cm-scroller': {
        fontFamily: 'var(--font-mono), monospace',
        lineHeight: '1.75',
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
        padding: '0',
        minHeight: '1.75rem',
        caretColor: 'var(--vlaina-editor-caret-color, var(--vlaina-text-primary, #2c2c2b)) !important',
      },
      '.cm-line': {
        padding: '0 1rem',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--vlaina-code-block-background, #f5f5f5)',
        border: 'none',
        paddingLeft: '0.5rem',
      },
      '.cm-gutters, .cm-gutter, .cm-gutterElement, .cm-lineNumbers, .cm-gutter-filler': {
        backgroundColor: 'var(--vlaina-code-block-background, #f5f5f5)',
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: 'transparent',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--vlaina-selection-bg, #2781db)',
      },
      '.cm-selectionBackground': {
        backgroundColor: 'transparent',
      },
      '.cm-cursor, .cm-dropCursor, &.cm-focused .cm-cursor, &.cm-focused .cm-dropCursor': {
        borderLeftColor: 'var(--vlaina-editor-caret-color, var(--vlaina-text-primary, #2c2c2b)) !important',
        borderLeftStyle: 'solid',
        borderLeftWidth: 'var(--vlaina-editor-caret-width, 1px)',
      },
    }),
  ];
}
