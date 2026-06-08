import { describe, expect, it } from 'vitest';
import { scopeImportedMarkdownThemeCss } from './cssScoping';
import { getImportedMarkdownThemeScopeSelector } from './dom';
import { normalizeImportedMarkdownThemeId } from './types';

describe('markdown theme CSS scoping', () => {
  it('scopes Typora document selectors to the markdown theme root', () => {
    const css = [
      '/* real Typora themes commonly define root variables before #write */',
      ':root { --bg-color: #fff; }',
      'html, body { color: var(--text-color); }',
      '#write h1, .CodeMirror { color: var(--primary-color); }',
      '@media print { body { background: white; } #write { max-width: 100%; } }',
      '@keyframes fade { from { opacity: 0; } to { opacity: 1; } }',
    ].join('\n');

    const scoped = scopeImportedMarkdownThemeCss(css, 'typora');

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] { --bg-color: #fff; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write h1');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .CodeMirror');
    expect(scoped).toContain('@media print');
    expect(scoped).toContain('@keyframes fade { from { opacity: 0; } to { opacity: 1; } }');
    expect(scoped).not.toMatch(/(^|[}\n]\s*)body\s*\{/);
    expect(scoped).not.toMatch(/(^|[}\n]\s*)html\s*\{/);
    expect(scoped).not.toMatch(/(^|[}\n]\s*):root\s*\{/);
  });

  it('keeps Obsidian light and dark theme selectors on the scoped root', () => {
    const css = [
      'body.theme-dark { --background-primary: #101010; }',
      'body.theme-light .markdown-preview-view, .theme-dark .cm-s-obsidian { color: var(--text-normal); }',
      'html.theme-dark body.is-mobile .markdown-preview-view { --file-line-width: 100%; }',
      ':root.theme-light body:not(.is-mobile) .markdown-rendered { --line-height-normal: 1.7; }',
      '.workspace-leaf-content[data-type="markdown"] .markdown-preview-view h1 { color: var(--text-accent); }',
      'svg * { stroke-linecap: square; }',
    ].join('\n');

    const scoped = scopeImportedMarkdownThemeCss(css, 'obsidian');

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].theme-dark');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].theme-light.markdown-preview-view');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].theme-dark.cm-s-obsidian');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].theme-dark.is-mobile.markdown-preview-view');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].theme-light:not(.is-mobile).markdown-rendered');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].markdown-preview-view h1');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"] svg *');
    expect(scoped).not.toContain('.workspace-leaf-content[data-type="markdown"]');
    expect(scoped).not.toContain('body.theme-dark');
    expect(scoped).not.toContain('body.theme-light');
    expect(scoped).not.toContain('html.theme-dark');
    expect(scoped).not.toContain(':root.theme-light');
  });

  it('splits selector lists without breaking nested commas', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      '#write :is(h1, h2), a[href^="https://example.com/a,b"] { color: blue; }',
      'typora'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write :is(h1, h2)');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] a[href^="https://example.com/a,b"]');
  });

  it('folds imported editor container aliases onto the markdown theme root', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        '#write h1 { color: var(--primary-color); }',
        '.workspace-leaf-content[data-type="markdown"] .markdown-preview-view h1 { color: var(--text-accent); }',
        '.markdown-preview-view .cm-s-obsidian { --line-height-normal: 1.7; }',
        '.markdown-source-view.mod-cm6 .cm-line { caret-color: var(--caret-color); }',
        '.markdown-source-view.mod-cm5 .cm-hashtag.cm-meta { font-family: var(--font-text-theme); }',
        '.view-content > .markdown-rendered blockquote { border-color: var(--background-modifier-border); }',
        '.markdown-preview-view .markdown-preview-sizer > .contains-task-list { padding-inline-start: 0; }',
        '.markdown-reading-view .markdown-preview-pusher + .markdown-preview-sizer table { color: var(--text-normal); }',
      ].join('\n'),
      'obsidian'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"]#write h1');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].markdown-preview-view h1');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].markdown-preview-view.cm-s-obsidian');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].markdown-source-view.mod-cm6 .cm-line');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].markdown-source-view.mod-cm6 .cm-hashtag.cm-meta');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].markdown-rendered blockquote');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].markdown-preview-view > .contains-task-list');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].markdown-reading-view table');
    expect(scoped).not.toContain('.workspace-leaf-content[data-type="markdown"]');
    expect(scoped).not.toContain('.view-content');
    expect(scoped).not.toContain('.mod-cm5');
    expect(scoped).not.toContain('.markdown-preview-sizer');
    expect(scoped).not.toContain('.markdown-preview-pusher');
    expect(scoped).not.toContain('.markdown-preview-view .cm-s-obsidian');
  });

  it('folds imported root state classes without treating arbitrary content classes as root state', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        'body .max { --line-width: var(--max-width); }',
        'body .wide { --line-width: var(--line-width-wide); }',
        '.is-mobile .markdown-preview-view { --folding-offset: 0; }',
        '.markdown-preview-view.is-readable-line-width .markdown-preview-sizer table { width: var(--table-width); }',
        '.max p { color: var(--text-normal); }',
      ].join('\n'),
      'obsidian'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].max { --line-width: var(--max-width); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].wide { --line-width: var(--line-width-wide); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].is-mobile.markdown-preview-view { --folding-offset: 0; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].markdown-preview-view.is-readable-line-width table { width: var(--table-width); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"] .max p { color: var(--text-normal); }');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].max p');
    expect(scoped).not.toContain('body .max');
    expect(scoped).not.toContain('body .wide');
    expect(scoped).not.toContain('.markdown-preview-sizer');
  });

  it('folds Typora export wrappers used by VLOOK themes onto the markdown theme root', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        'content>#write table { border-color: var(--table-border); }',
        '.typora-export #write.done:before { background: var(--db); }',
        '.typora-export-content.fill-width #write.max { max-width: 100%; }',
        'body.ty-on-typewriter-mode content>#write:after { content: ""; }',
        'body.typora-export.pin-outline #write .md-toc { color: var(--df); }',
      ].join('\n'),
      'typora'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write table');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write.done:before');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write.max');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].ty-on-typewriter-mode#write:after');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].pin-outline#write .md-toc');
    expect(scoped).not.toContain('content>#write');
    expect(scoped).not.toContain('.typora-export');
    expect(scoped).not.toContain('.typora-export-content');
    expect(scoped).not.toContain('body.ty-on-typewriter-mode');
    expect(scoped).not.toContain('body.typora-export');
  });

  it('fixes Typora color-scheme media rules to light/original semantics', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        ':root { --db: var(--db-lg); --df: var(--df-lg); }',
        '@media (prefers-color-scheme: dark) {',
        '  :root { --db: var(--db-dk); --df: var(--df-dk); }',
        '  #write h1 { color: var(--h-f-dk); }',
        '}',
        '@media screen and (prefers-color-scheme: light) {',
        '  #write h1 { color: var(--h-f-lg); }',
        '}',
      ].join('\n'),
      'typora'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] { --db: var(--db-lg); --df: var(--df-lg); }');
    expect(scoped).not.toContain('prefers-color-scheme');
    expect(scoped).not.toContain('--db: var(--db-dk)');
    expect(scoped).not.toContain('--df: var(--df-dk)');
    expect(scoped).not.toContain('var(--h-f-dk)');
    expect(scoped).toContain('@media screen');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write h1 { color: var(--h-f-lg); }');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].theme-dark');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].theme-light');
  });

  it('maps Obsidian color-scheme media rules onto runtime theme classes', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        ':root { --background-primary: #fff; }',
        '@media (prefers-color-scheme: dark) {',
        '  :root { --background-primary: #101010; --text-normal: #eee; }',
        '  .markdown-preview-view h1 { color: var(--text-normal); }',
        '}',
        '@media screen and (prefers-color-scheme: light) {',
        '  .markdown-preview-view h1 { color: #111; }',
        '}',
      ].join('\n'),
      'obsidian'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].theme-dark { --background-primary: #101010; --text-normal: #eee; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].theme-dark.markdown-preview-view h1 { color: var(--text-normal); }');
    expect(scoped).toContain('@media screen');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].theme-light.markdown-preview-view h1 { color: #111; }');
    expect(scoped).not.toContain('prefers-color-scheme');
  });

  it('keeps useful document root states while dropping Typora empty-body guards', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        'body:not(.ty-on-typewriter-mode) content>#write:after { height: 24px; }',
        'body:not([class]) blockquote { background: var(--bq-bg); }',
      ].join('\n'),
      'typora'
    );

    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]:not(.ty-on-typewriter-mode)#write:after');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] blockquote');
    expect(scoped).not.toContain('body:not(.ty-on-typewriter-mode)');
    expect(scoped).not.toContain('body:not([class])');
  });

  it('folds root aliases inside selector-list pseudo classes', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        ':is(.typora-export #write, .v-pic-in-pic) img[src*="#padding"] { padding: 1em; }',
        '#write blockquote:has(.typora-export #write img[src*="#card"]) { margin: 0; }',
        '.workspace-leaf-content:has(.markdown-preview-view) :where(.markdown-rendered, .view-content > .markdown-preview-view) h2 { color: var(--text-accent); }',
        ':is(.typora-export, .v-toolbar) { display: none; }',
        '#write :not(.typora-export #write .v-export-only) { color: inherit; }',
      ].join('\n'),
      'obsidian'
    );

    expect(scoped).toContain('#write :is(img[src*="#padding"], .image-block-container[src*="#padding"] img)');
    expect(scoped).toContain('#write blockquote:has(#write :is(img[src*="#card"], .image-block-container[src*="#card"] img))');
    expect(scoped).toContain(':where(.markdown-rendered, .markdown-preview-view) h2');
    expect(scoped).not.toContain(':is(.typora-export, .v-toolbar)');
    expect(scoped).toContain(':not(.typora-export #write .v-export-only)');
    expect(scoped).not.toContain('.v-pic-in-pic');
    expect(scoped).not.toContain(':is(*, .v-toolbar)');
    expect(scoped).not.toContain(':is(.typora-export #write');
    expect(scoped).not.toContain(':has(.typora-export #write');
    expect(scoped).not.toContain('.workspace-leaf-content');
    expect(scoped).not.toContain('.view-content > .markdown-preview-view');
  });

  it('keeps descendant universal selectors under the markdown theme root', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        'body * { box-sizing: border-box; }',
        '#write > * { margin-inline: auto; }',
      ].join('\n'),
      'typora'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] *');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write > *');
  });

  it('keeps Typora content styles while filtering root page layout and decorations', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        '#write { margin-left: 120px; padding-left: 64px; max-width: 960px; overflow: visible; transform: translateX(20px); color: var(--df); --content-width: 960px; }',
        '#write.done.max { box-shadow: 0 0 5px var(--ac-t2-fd); outline: 1px solid var(--ac-t2); border-left: 12px solid var(--ac-t2-a); border-right: 12px solid var(--ac-t2-a); background: var(--db); }',
        '#write.fill-width { margin: 0 auto; padding: 20px; width: 100%; display: block; font-size: var(--v-f-size); background-color: var(--db); }',
        '#write.unsafe-root { width: calc(100% + 40px); min-width: 720px; height: 100vh; overflow: hidden; position: fixed; }',
        '#write p { margin-left: 2em; padding-left: 1em; max-width: 60ch; }',
        '#write:after { position: sticky; right: 0; width: calc(100% + 40px); margin: 0 -20px; content: ""; color: var(--df-a); }',
        '#write:before, #write .content-card:before { content: ""; background: #dcdac5; }',
        '#write .content-card { box-shadow: 0 0 5px var(--ac-t2-fd); outline: 1px solid var(--ac-t2); border-left: 12px solid var(--ac-t2-a); background: var(--db); }',
        '#write blockquote:before { position: absolute; right: 0; width: 40px; content: ""; }',
      ].join('\n'),
      'typora'
    );

    const rootRule = scoped.match(/\[data-markdown-theme-root="true"\]\[data-markdown-theme-platform="typora"\]#write\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rootRule).toContain('color: var(--df)');
    expect(rootRule).toContain('--content-width: 960px');
    expect(rootRule).not.toContain('max-width');
    expect(rootRule).not.toContain('overflow');
    expect(rootRule).not.toContain('margin-left');
    expect(rootRule).not.toContain('padding-left');
    expect(rootRule).not.toContain('transform');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write.done.max');
    const fillWidthRule = scoped.match(/\[data-markdown-theme-root="true"\]\[data-markdown-theme-platform="typora"\]#write\.fill-width\s*\{[^}]*\}/)?.[0] ?? '';
    expect(fillWidthRule).toContain('font-size: var(--v-f-size)');
    expect(fillWidthRule).not.toContain('margin');
    expect(fillWidthRule).not.toContain('padding');
    expect(fillWidthRule).not.toContain('width:');
    expect(fillWidthRule).not.toContain('display');
    expect(fillWidthRule).not.toContain('background');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write.unsafe-root');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write p { margin-left: 2em; padding-left: 1em; max-width: 60ch; }');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write:after');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write:before');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write .content-card:before { content: ""; background: #dcdac5; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write .content-card { box-shadow: 0 0 5px var(--ac-t2-fd); outline: 1px solid var(--ac-t2); border-left: 12px solid var(--ac-t2-a); background: var(--db); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write blockquote:before { position: absolute; right: 0; width: 40px; content: ""; }');
  });

  it('drops imported Typora page chrome while preserving content-level VLOOK styles', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        '#vlook-toc, #v-footer, #md-notification:before, #top-titlebar .ty-icon { color: var(--df); }',
        '.fa, .fa-sort-desc:before, .ion-chevron-left:before, .ty-md-radio-button-off:before { color: var(--df-a); }',
        '.v-mask.left, .v-mask.right { background: radial-gradient(transparent 4px, var(--db) 4px); }',
        '.v-welcome-page { position: fixed; inset: 0; background: var(--db); }',
        '.v-mask-close { background: var(--ac-t1); }',
        '.v-nav-center.mobile:before, .v-doc-lib:after, .v-footnote-pn:before, .v-link-info-list:before { background: var(--df); }',
        '.outline-item:hover, .v-toc-item:hover, .md-grid-board td, #toc-dropmenu { background: var(--ac-t2-fd); }',
        '.typora-quick-open-item.active, .file-list-item.active, .sidebar-content { background: var(--ac-t2-fd); }',
        '.v-mask .v-copyright, #write .v-tag { color: var(--a-c); }',
        '.v-fill-width, .v-check-hash, .v-link-chk-result, .v-search, .v-search-action, .v-audio-mini-control, .megamenu-menu-header { color: var(--df-a); }',
        '.v-footnote-pn-content, .v-pgbar, .md-image-btn, .v-tips { color: var(--a-o-c); }',
        '#sidebar-search-btn, .ty-menu-btn-area>span, .md-notification-container, #megamenu-back-btn { color: var(--df-a); }',
        '.md-comment, .md-image-src-span, .md-link .md-url, .md-image-pick-file-btn { color: var(--df-a); }',
        'content>#write p>span[md-inline=em]:not(:only-child)>em>span[md-inline=highlight]>mark, .v-stepwise { box-shadow: inset 0 -0.5em var(--ac-t2-fd); }',
        'content>#write span[md-inline=em]:has(>em>span[md-inline=strong]:only-child), .v-coating { border-radius: 999px; }',
        '#write .md-alert-note { background: var(--ac-bu-a); }',
        '#write blockquote:before { content: ""; border-left: 4px solid var(--a-c); }',
      ].join('\n'),
      'typora'
    );

    expect(scoped).not.toContain('#vlook-toc');
    expect(scoped).not.toContain('#v-footer');
    expect(scoped).not.toContain('#md-notification');
    expect(scoped).not.toContain('#top-titlebar');
    expect(scoped).not.toContain('.fa');
    expect(scoped).not.toContain('.ion-chevron-left');
    expect(scoped).not.toContain('.ty-md-radio-button-off');
    expect(scoped).not.toContain('.v-mask.left');
    expect(scoped).not.toContain('.v-mask.right');
    expect(scoped).not.toContain('.v-welcome-page');
    expect(scoped).not.toContain('.v-mask-close');
    expect(scoped).not.toContain('.v-nav-center');
    expect(scoped).not.toContain('.v-doc-lib');
    expect(scoped).not.toContain('.v-footnote-pn');
    expect(scoped).not.toContain('.v-link-info-list');
    expect(scoped).not.toContain('.outline-item');
    expect(scoped).not.toContain('.v-toc-item');
    expect(scoped).not.toContain('.md-grid-board');
    expect(scoped).not.toContain('#toc-dropmenu');
    expect(scoped).not.toContain('.typora-quick-open-item');
    expect(scoped).not.toContain('.file-list-item');
    expect(scoped).not.toContain('.sidebar-content');
    expect(scoped).not.toContain('.v-mask .v-copyright');
    expect(scoped).not.toContain('.v-fill-width');
    expect(scoped).not.toContain('.v-check-hash');
    expect(scoped).not.toContain('.v-link-chk-result');
    expect(scoped).not.toContain('.v-search');
    expect(scoped).not.toContain('.v-search-action');
    expect(scoped).not.toContain('.v-audio-mini-control');
    expect(scoped).not.toContain('.megamenu-menu-header');
    expect(scoped).not.toContain('.v-footnote-pn-content');
    expect(scoped).not.toContain('.v-pgbar');
    expect(scoped).not.toContain('.md-image-btn');
    expect(scoped).not.toContain('.v-tips');
    expect(scoped).not.toContain('#sidebar-search-btn');
    expect(scoped).not.toContain('.ty-menu-btn-area');
    expect(scoped).not.toContain('.md-notification-container');
    expect(scoped).not.toContain('#megamenu-back-btn');
    expect(scoped).not.toContain('.md-comment');
    expect(scoped).not.toContain('.md-image-src-span');
    expect(scoped).not.toContain('.md-link');
    expect(scoped).not.toContain('.md-url');
    expect(scoped).not.toContain('.md-image-pick-file-btn');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .v-stepwise');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .v-coating');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write .v-tag { color: var(--a-c); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write p>em:not(:only-child)>mark');
    expect(scoped).toContain('box-shadow: inset 0 -0.5em var(--ac-t2-fd);');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write em:has(>strong:only-child)');
    expect(scoped).toContain('border-radius: 999px;');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write .md-alert-note { background: var(--ac-bu-a); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write blockquote:before { content: ""; border-left: 4px solid var(--a-c); }');
  });

  it('does not trust scope selector text that appears later in an imported selector', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      'body [data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] { color: red; }',
      'typora'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] [data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]');
    expect(scoped).not.toMatch(/(^|[}\n]\s*)body\s+\[data-markdown-theme-root="true"\]/);
  });

  it('supports imported theme root scopes without exposing a source platform on the DOM', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        'body.theme-dark { --background-primary: #101010; }',
        '#write h1 { color: var(--primary-color); }',
        '.markdown-preview-view .cm-s-obsidian { --line-height-normal: 1.7; }',
      ].join('\n'),
      'obsidian',
      getImportedMarkdownThemeScopeSelector('minimal')
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-imported-theme="minimal"].theme-dark');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-imported-theme="minimal"]#write h1');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-imported-theme="minimal"].markdown-preview-view.cm-s-obsidian');
    expect(scoped).not.toContain('data-markdown-theme-platform="obsidian"');
    expect(scoped).not.toContain('body.theme-dark');
  });

  it('maps content element aliases onto Vlaina block DOM without requiring foreign tags', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        'content>#write>pre.md-meta-block:first-child { color: var(--a-c); }',
        '#write pre.md-fences[lang=ts] { border-color: var(--code-border); }',
        'body.fancy-code .markdown-preview-view pre[class*="language-"]::before { content: attr(data-language); }',
        '.markdown-preview-view pre code { color: var(--code-normal); }',
        '.style .token.string { color: var(--atom-aqua); }',
        '.theme-dark .markdown-preview-view pre:not(.frontmatter) { background: var(--code-block-background); }',
        '.markdown-reading-view .el-pre pre { overflow-x: auto; }',
        '.markdown-reading-view .el-pre pre code { white-space: pre; }',
        '.mathjax-block { margin-top: 0; }',
        'div[src$="#blend"], span[src$="#invert"] { background-color: var(--background-primary); }',
        '.theme-dark div[src$="#invert"] img, .theme-light span[src$="#blend"] img { mix-blend-mode: multiply; }',
        '.theme-dark img[src$="#invert"], .theme-light img[src$="#blend"] { filter: invert(1); }',
        'img[src$="#circle"]:not(.emoji), img[src$="#outline"] { border-radius: 999px; }',
      ].join('\n'),
      'typora'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write >.md-meta-block:first-child { color: var(--a-c); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write .md-fences[lang=ts] { border-color: var(--code-border); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].fancy-code.markdown-preview-view :is(pre[class*="language-"], .code-block-container[class*="language-"])::before { content: attr(data-language); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].markdown-preview-view :is(pre code, .code-block-container .cm-content) { color: var(--code-normal); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .language-css .token.string { color: var(--atom-aqua); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].theme-dark.markdown-preview-view :is(pre:not([data-type="frontmatter"]), .code-block-container:not(.frontmatter-block-container)) { background: var(--code-block-background); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].markdown-reading-view :is(.el-pre.code-block-container, .el-pre .code-block-lazy-preview) { overflow-x: auto; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].markdown-reading-view :is(.el-pre.code-block-container .cm-content, .el-pre .code-block-lazy-preview) { white-space: pre; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] :is(.mathjax-block, [data-type="math-block"], .math-block-wrapper) { margin-top: 0; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .image-block-container[src$="#blend"],\n[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .image-block-container[src$="#invert"] { background-color: var(--background-primary); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].theme-dark .image-block-container[src$="#invert"] img');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].theme-light .image-block-container[src$="#blend"] img');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].theme-dark :is(img[src$="#invert"], .image-block-container[src$="#invert"] img)');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"].theme-light :is(img[src$="#blend"], .image-block-container[src$="#blend"] img)');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] :is(img[src$="#circle"], .image-block-container[src$="#circle"] img):not(.emoji)');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] :is(img[src$="#outline"], .image-block-container[src$="#outline"] img)');
    expect(scoped).not.toContain('pre.md-meta-block');
    expect(scoped).not.toContain('pre.md-fences');
    expect(scoped).not.toContain('.style .token.string');
    expect(scoped).not.toContain('pre:not(.frontmatter)');
    expect(scoped).not.toContain('.markdown-preview-view pre[class*="language-"]');
    expect(scoped).not.toContain('.el-pre pre');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .mathjax-block {');
    expect(scoped).not.toContain('div[src$="#blend"]');
    expect(scoped).not.toContain('span[src$="#invert"]');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] img[src$="#circle"]:not(.emoji)');
  });

  it('maps imported Obsidian task checkbox selectors onto Vlaina task item checkboxes', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        'input[data-task="!"]:checked { color: var(--color-orange); }',
        'input[type=checkbox][data-task="/"]:checked:after { width: 50%; }',
        'li[data-task=">"] > input:checked, li[data-task="<"] > p > input:checked { transform: rotate(90deg); }',
      ].join('\n'),
      'obsidian'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"] li[data-item-type=\'task\'][data-task="!"][data-checked=\'true\']::before { color: var(--color-orange); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"] li[data-item-type=\'task\'][data-task="/"][data-checked=\'true\']::before { width: 50%; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"] li[data-item-type=\'task\'][data-task=">"][data-checked=\'true\']::before,\n[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"] li[data-item-type=\'task\'][data-task="<"][data-checked=\'true\']::before { transform: rotate(90deg); }');
    expect(scoped).not.toContain('input[data-task');
    expect(scoped).not.toContain('> input:checked');
  });

  it('maps imported Typora task checkbox label selectors onto Vlaina task item checkboxes', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        'table td label.checkbox { vertical-align: middle; }',
        'li label.checkbox { position: absolute; }',
        '.checkbox>svg { background-color: var(--db); }',
      ].join('\n'),
      'typora'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] table td li[data-item-type=\'task\']::before { vertical-align: middle; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] li[data-item-type=\'task\']::before { position: absolute; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] li[data-item-type=\'task\']::before { background-color: var(--db); }');
    expect(scoped).not.toContain('label.checkbox');
    expect(scoped).not.toContain('.checkbox>svg');
  });

  it('maps imported CodeMirror 5 code block selectors onto CodeMirror 6 DOM', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        '.CodeMirror-gutters { border-right: 1px solid var(--pn-c); }',
        '.CodeMirror-linenumber { color: var(--df-a); }',
        '.CodeMirror div.CodeMirror-cursor { border-left: 2px solid var(--cm-CodeMirror-cursor); }',
        '.CodeMirror-scroll { border-radius: 4px; }',
        '.CodeMirror-focused .CodeMirror-activeline .CodeMirror-linenumber { color: var(--h-f); }',
        '.cm-editor .cm-lineNumbers .cm-gutterElement.cm-active { color: var(--line-number-active); }',
        'content>#write .CodeMirror-focused .CodeMirror-activeline-gutter+.CodeMirror-line { background: var(--active-line-bg); }',
        '#write pre.ty-contain-cm .CodeMirror-lines { background-image: var(--grid); }',
        '.CodeMirror-activeline-background { background: var(--active-line-bg); }',
      ].join('\n'),
      'typora'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .cm-gutters { border-right: 1px solid var(--pn-c); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] :is(.cm-lineNumbers .cm-gutterElement, .code-block-lazy-line-numbers) { color: var(--df-a); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .CodeMirror div.cm-cursor { border-left: 2px solid var(--cm-CodeMirror-cursor); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .cm-scroller { border-radius: 4px; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .cm-editor.cm-focused .cm-activeLineGutter { color: var(--h-f); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .cm-editor .cm-lineNumbers .cm-gutterElement.cm-activeLineGutter { color: var(--line-number-active); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write .cm-editor.cm-focused .cm-activeLine { background: var(--active-line-bg); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write .code-block-container .cm-content { background-image: var(--grid); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .cm-activeLine { background: var(--active-line-bg); }');
    expect(scoped).not.toContain('.CodeMirror-gutters');
    expect(scoped).not.toContain('.CodeMirror-linenumber');
    expect(scoped).not.toContain('.CodeMirror-cursor');
    expect(scoped).not.toContain('.CodeMirror-scroll');
    expect(scoped).not.toContain('.CodeMirror-activeline');
    expect(scoped).not.toContain('.CodeMirror-lines');
    expect(scoped).not.toContain('.cm-gutterElement.cm-active {');
  });

  it('drops imported Obsidian app chrome without dropping markdown content selectors', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        '.vertical-tab-nav-item, .empty-state-action, .document-search-close-button, .notice { color: var(--text-normal); }',
        '.query-toolbar-menu .combobox-button, .view-action.is-active:hover, .inline-title { color: var(--text-muted); }',
        '.CodeMirror-foldmarker, .CodeMirror-foldgutter-open, .CodeMirror-wrap > div > textarea { color: var(--text-faint); }',
        '.textLayer, .spellchecker-dictionary-remove-button, .u-clickable, .full-file-names, .mod-macos { opacity: .7; }',
        '.search-result-file-match:hover, #calendar-container .arrow, .excalibrain-searchinput, .excalidraw-dirty, .obsidian-icon-folder-icon { opacity: .8; }',
        'input.slider, .popover.hover-popover.is-loaded, #cMenuModalBar button.cMenuCommandItem:hover, .gemmy-tooltip.tooltip { opacity: .8; }',
        'input, button, .markdown-rendered .mod-header + div > *, .markdown-preview-view .mod-highlighted, body:not(.is-mobile) div.image-embed:focus-within .image-wrapper::after { color: var(--text-muted); }',
        '.markdown-preview-view > div { max-width: var(--file-line-width); }',
        '.search-results-info, div[data-type=git-view] .commit-msg, .MiniSettings-statusbar-button, .themed-color-wrapper > div + div { color: var(--text-muted); }',
        '.block-language-chart canvas { margin: 1em 0; }',
        '.markdown-preview-view blockquote { border-color: var(--background-modifier-border); }',
      ].join('\n'),
      'obsidian'
    );

    expect(scoped).not.toContain('.vertical-tab-nav-item');
    expect(scoped).not.toContain('.empty-state-action');
    expect(scoped).not.toContain('.document-search-close-button');
    expect(scoped).not.toContain('.notice');
    expect(scoped).not.toContain('.query-toolbar-menu');
    expect(scoped).not.toContain('.combobox-button');
    expect(scoped).not.toContain('.view-action');
    expect(scoped).not.toContain('.inline-title');
    expect(scoped).not.toContain('.CodeMirror-foldmarker');
    expect(scoped).not.toContain('.CodeMirror-foldgutter-open');
    expect(scoped).not.toContain('.CodeMirror-wrap');
    expect(scoped).not.toContain('.textLayer');
    expect(scoped).not.toContain('.spellchecker-dictionary-remove-button');
    expect(scoped).not.toContain('.u-clickable');
    expect(scoped).not.toContain('.full-file-names');
    expect(scoped).not.toContain('.mod-macos');
    expect(scoped).not.toContain('.search-result-file-match');
    expect(scoped).not.toContain('#calendar-container');
    expect(scoped).not.toContain('.excalibrain-searchinput');
    expect(scoped).not.toContain('.excalidraw-dirty');
    expect(scoped).not.toContain('.obsidian-icon-folder-icon');
    expect(scoped).not.toContain('input.slider');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"] input');
    expect(scoped).not.toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"] button');
    expect(scoped).not.toContain('.mod-header');
    expect(scoped).not.toContain('.mod-highlighted');
    expect(scoped).not.toContain('.image-wrapper');
    expect(scoped).not.toContain('.markdown-preview-view > div');
    expect(scoped).not.toContain('.popover');
    expect(scoped).not.toContain('#cMenuModalBar');
    expect(scoped).not.toContain('.cMenuCommandItem');
    expect(scoped).not.toContain('.gemmy-tooltip');
    expect(scoped).not.toContain('.search-results-info');
    expect(scoped).not.toContain('data-type=git-view');
    expect(scoped).not.toContain('.commit-msg');
    expect(scoped).not.toContain('.MiniSettings-statusbar-button');
    expect(scoped).not.toContain('.themed-color-wrapper');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"].markdown-preview-view blockquote { border-color: var(--background-modifier-border); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="obsidian"] .block-language-chart canvas { margin: 1em 0; }');
  });

  it('folds Typora md-inline wrapper selectors onto native inline nodes', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        'content>#write em>span[md-inline=code]:only-child>code { color: var(--ac-t2); }',
        '#write span[md-inline=strong] > strong { font-weight: 700; }',
        '#write [md-inline=highlight]:only-child>mark:before { content: ""; }',
        '#write [md-inline=highlight]:only-child:has(>mark):after { content: ""; }',
        '#write [md-inline=strong]:only-child:has(>strong) { display: block; }',
        '#write [md-inline=underline]:only-child:has(>u):after { width: 40%; }',
        'content>#write>p>[md-inline=em]:only-child:has(>em>[md-inline=plain]) { color: var(--df-a); }',
        '#write span[md-inline=em]:not(:first-child)>em { color: var(--df-a); }',
        'content>#write em:has(span:first-child+span[md-inline=code]) { padding-right: 0; }',
        'content>#write em:has(span[md-inline=code]:first-child+span:last-child) { padding-left: 1px; }',
        'content>#write span[md-inline=em]:has(>em>span[md-inline=strong]:only-child) { border-radius: 999px; }',
        'content>#write span[md-inline=em]:has(>em>span:first-child+span[md-inline=strong]:last-child)>em { color: var(--db); }',
        'content>#write table:has(th:first-child>span>span[md-inline=strong]:only-child) tbody>tr>:first-child { position: sticky; }',
        '#write :not(span[md-inline=code]) code { background: var(--bg-code); }',
      ].join('\n'),
      'typora'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write em>code:only-child { color: var(--ac-t2); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write strong { font-weight: 700; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write mark:only-child:before { content: ""; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write mark:only-child:after { content: ""; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write strong:only-child { display: block; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write u:only-child:after { width: 40%; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write >p>em:only-child { color: var(--df-a); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write em:not(:first-child) { color: var(--df-a); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write em:has(>code) { padding-right: 0; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write em:has(>code:first-child) { padding-left: 1px; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write em:has(>strong:only-child) { border-radius: 999px; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write em:has(>strong:last-child)>em { color: var(--db); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write table:has(th:first-child strong:only-child) tbody>tr>:first-child { position: sticky; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write :not(span[md-inline=code]) code { background: var(--bg-code); }');
    expect(scoped).not.toContain('span[md-inline=strong] > strong');
    expect(scoped).not.toContain('[md-inline=highlight]:only-child>mark');
    expect(scoped).not.toContain('[md-inline=highlight]:only-child:has(>mark)');
    expect(scoped).not.toContain('[md-inline=strong]:only-child:has(>strong)');
    expect(scoped).not.toContain('[md-inline=underline]:only-child:has(>u)');
    expect(scoped).not.toContain('[md-inline=plain]');
  });

  it('maps Typora image hash selectors onto Vlaina image block internals', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        'content>#write .md-image[data-src*="#40%"]>img { width: 40%; }',
        'content>#write .md-image[data-src*="#cardd"]:after { content: attr(data-alt); }',
        'content>#write .md-image[data-inject-url*=darksrc\\=invert].md-image[data-src*="\\#line"]>img { background: var(--v-fig-grid-l-invert); }',
        'content>#write [md-inline=image][data-src*="#200h"] { height: 200px; }',
      ].join('\n'),
      'typora'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write :is(.md-image[data-src*="#40%"] > img, .image-block-container[data-src*="#40%"] img) { width: 40%; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write :is(.md-image[data-src*="#cardd"], .image-block-container[data-src*="#cardd"]):after { content: attr(data-alt); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write :is(.md-image[data-inject-url*=darksrc\\=invert].md-image[data-src*="\\#line"] > img, .image-block-container[data-inject-url*=darksrc\\=invert].image-block-container[data-src*="\\#line"] img) { background: var(--v-fig-grid-l-invert); }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write :is(.image-block-container[data-src*="#200h"], .image-block-container[data-src*="#200h"]) { height: 200px; }');
    expect(scoped).not.toContain('[md-inline=image]');
    expect(scoped).not.toContain('.md-image[data-src*="#40%"]>img');
  });

  it('maps Typora table figure selectors onto Vlaina table block DOM', () => {
    const scoped = scopeImportedMarkdownThemeCss(
      [
        '#write .table-figure { margin: .5em 0 0; }',
        'content>#write figure.table-figure { overflow: visible; }',
        '.typora-export #write figure.table-figure:not(:has(.v-caption)), .v-caption.table { display: block; overflow: auto; }',
      ].join('\n'),
      'typora'
    );

    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write .table-figure { margin: .5em 0 0; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write :is(figure.table-figure, .milkdown-table-block.table-figure) { overflow: visible; }');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"]#write :is(figure.table-figure, .milkdown-table-block.table-figure):not(:has(.v-caption))');
    expect(scoped).toContain('[data-markdown-theme-root="true"][data-markdown-theme-platform="typora"] .v-caption.table');
    expect(scoped).not.toContain('content>#write figure.table-figure');
  });

  it('normalizes imported theme ids for stable local file names', () => {
    expect(normalizeImportedMarkdownThemeId(' Clean Light.css ')).toBe('clean-light.css');
    expect(normalizeImportedMarkdownThemeId('Obsidian Minimal Theme')).toBe('obsidian-minimal-theme');
  });
});
