import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { oneDarkTheme } from '@codemirror/theme-one-dark';
import { EditorView as CodeMirror } from '@codemirror/view';
import { vlainaCodeBlockHighlightStyle } from './codeBlockHighlightStyle';

export function createCodeBlockEditorTheme() {
  return [
    oneDarkTheme,
    syntaxHighlighting(vlainaCodeBlockHighlightStyle),
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
        position: 'sticky',
        left: 0,
        zIndex: 10,
        paddingLeft: '0.5rem',
        backgroundColor: 'var(--vlaina-code-block-background, #f5f5f5) !important',
        borderRight: 'none !important',
        border: 'none !important',
      },
      '.cm-gutter, .cm-lineNumbers, .cm-gutterElement, .cm-gutter-filler': {
        backgroundColor: 'var(--vlaina-code-block-background, #f5f5f5) !important',
        borderRight: 'none !important',
        border: 'none !important',
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
