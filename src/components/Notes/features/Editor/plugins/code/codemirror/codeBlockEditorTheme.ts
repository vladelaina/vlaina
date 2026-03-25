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
        backgroundColor: 'var(--neko-code-block-background, #f5f5f5)',
        fontSize: '0.875rem',
      },
      '.cm-editor': {
        backgroundColor: 'var(--neko-code-block-background, #f5f5f5)',
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
        padding: '0.25rem 1rem 1rem',
        minHeight: '2.5rem',
        caretColor: 'var(--neko-editor-caret-color, var(--neko-text-primary, #2c2c2b)) !important',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--neko-code-block-background, #f5f5f5)',
        border: 'none',
        paddingLeft: '0.5rem',
      },
      '.cm-gutters, .cm-gutter, .cm-gutterElement, .cm-lineNumbers, .cm-gutter-filler': {
        backgroundColor: 'var(--neko-code-block-background, #f5f5f5)',
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: 'transparent',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--neko-selection-bg, #2781db)',
      },
      '.cm-selectionBackground': {
        backgroundColor: 'transparent',
      },
      '.cm-cursor, .cm-dropCursor, &.cm-focused .cm-cursor, &.cm-focused .cm-dropCursor': {
        borderLeftColor: 'var(--neko-editor-caret-color, var(--neko-text-primary, #2c2c2b)) !important',
        borderLeftStyle: 'solid',
        borderLeftWidth: 'var(--neko-editor-caret-width, 1px)',
      },
      '&.cm-focused .cm-content::selection, &.cm-focused .cm-content *::selection, &.cm-focused .cm-line::selection, &.cm-focused .cm-line *::selection': {
        backgroundColor: 'var(--neko-selection-bg, #2781db)',
        color: '#ffffff',
        WebkitTextFillColor: '#ffffff',
      },
      '&.cm-focused .cm-content::-moz-selection, &.cm-focused .cm-content *::-moz-selection, &.cm-focused .cm-line::-moz-selection, &.cm-focused .cm-line *::-moz-selection': {
        backgroundColor: 'var(--neko-selection-bg, #2781db)',
        color: '#ffffff',
      },
    }),
  ];
}
