import { describe, expect, it } from 'vitest';
import { buildImportedMarkdownThemePostBridgeCss } from './postBridge';

describe('imported markdown theme post bridge', () => {
  it('builds a Typora post bridge for DOM compatibility fixes', () => {
    const css = buildImportedMarkdownThemePostBridgeCss('clean-light', 'typora');

    expect(css).toContain('[data-markdown-theme-root="true"][data-markdown-imported-theme="clean-light"].theme-typora#write');
    expect(css).toContain('[data-markdown-theme-root="true"][data-markdown-imported-theme="clean-light"].theme-typora #write');
    expect(css).toContain('--typora-page-max-width: min(100%, var(--v-write-w, var(--vlaina-size-1080px)));');
    expect(css).toContain('max-width: 100% !important;');
    expect(css).toContain('background: transparent !important;');
    expect(css).toContain(':is(strong, em, mark, u, del, code, sup, sub)');
    expect(css).toContain('display: inline !important;');
    expect(css).toContain('.milkdown-table-block.table-figure .table-wrapper');
    expect(css).toContain('.v-caption.full');
    expect(css).toContain('.v-svg-input-checkbox[data-vlook-checkbox=\'checked\']::before');
    expect(css).toContain('.vlook-column-list');
    expect(css).toContain('#write).ProseMirror,');
    expect(css).toContain(':not(.heading-toggle-btn):not(.editor-collapse-btn):not(.ProseMirror-widget)');
    expect(css).toContain('.ProseMirror):is(.editor-block-selection-active, .editor-block-selection-pending) .editor-block-selected *:not(.code-block-container)');
    expect(css).toContain('-webkit-text-fill-color: var(--vlaina-editor-block-selection-fg) !important;');
    expect(css).toContain('.ProseMirror).editor-block-selection-pending .code-block-chrome-language-label');
    expect(css).toContain('display: inline !important;');
    expect(css).toContain('opacity: var(--vlaina-opacity-0) !important;');
  });

  it('skips non-Typora themes', () => {
    expect(buildImportedMarkdownThemePostBridgeCss('clean-light', 'typora')).not.toBe('');
    expect(buildImportedMarkdownThemePostBridgeCss('obsidian-sample', 'obsidian')).toBe('');
  });
});
