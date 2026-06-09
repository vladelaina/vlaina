import { describe, expect, it } from 'vitest';
import { buildImportedAppThemeCss } from './appThemeBridge';

describe('imported app theme bridge', () => {
  it('maps Typora/VLOOK theme variables into Vlaina app shell tokens', () => {
    const css = [
      ':root {',
      '  --db: #fff;',
      '  --db-ext: #faf9f5;',
      '  --df: #1c1e1f;',
      '  --df-a: #7d868a;',
      '  --pn-c: #ebedef;',
      '  --pn-c-a: #d4d9dd;',
      '  --bq-bg-fd: #ebedef80;',
      '  --a-c: #d36c28;',
      '  --a-o-c: #8f985e;',
      '  --v-selected-c: #1c1e1f33;',
      '  --code-bg: #fff;',
      '  --code-t: #8f985e;',
      '  --mark-bg: #8f985e4d;',
      '  --ac-bu: #2082f0;',
      '  --ac-gn: #29a953;',
      '  --ac-og: #f38019;',
      '  --ac-rd: #d01010;',
      '  --v-fm-text-local: Inter, sans-serif;',
      '  --v-fm-code-local: "JetBrains Mono", monospace;',
      '}',
      '#write { color: var(--df); }',
    ].join('\n');

    const bridged = buildImportedAppThemeCss(css, 'vlook-fancy', 'typora');

    expect(bridged).toContain(':root[data-vlaina-imported-app-theme="vlook-fancy"]');
    expect(bridged).toContain('color-scheme: light;');
    expect(bridged).toContain('--vlaina-color-surface-main: var(--db);');
    expect(bridged).not.toContain('--vlaina-color-surface-shell-sidebar:');
    expect(bridged).not.toContain('--vlaina-color-surface-sidebar:');
    expect(bridged).toContain('--vlaina-color-text-primary: var(--df);');
    expect(bridged).toContain('--vlaina-color-text-muted: var(--df-a);');
    expect(bridged).toContain('--vlaina-color-setting-panel: var(--db-ext);');
    expect(bridged).toContain('--vlaina-color-setting-field: var(--db-ext);');
    expect(bridged).toContain('--vlaina-color-setting-control: var(--pn-c);');
    expect(bridged).toContain('--vlaina-sidebar-row-selected-bg: var(--v-selected-c);');
    expect(bridged).toContain('--vlaina-sidebar-row-selected-text: var(--a-c);');
    expect(bridged).toContain('--vlaina-code-block-background: var(--code-bg);');
    expect(bridged).toContain('--vlaina-code-syntax-foreground: var(--code-t);');
    expect(bridged).toContain('--vlaina-color-mark-highlight-bg: var(--mark-bg);');
    expect(bridged).toContain('--vlaina-color-info: var(--ac-bu);');
    expect(bridged).toContain('--vlaina-color-success: var(--ac-gn);');
    expect(bridged).toContain('--vlaina-color-warning: var(--ac-og);');
    expect(bridged).toContain('--vlaina-color-danger: var(--ac-rd);');
    expect(bridged).toContain('--vlaina-color-surface-hover: var(--bq-bg-fd);');
    expect(bridged).toContain('--vlaina-color-scrollbar-thumb: var(--pn-c-a);');
    expect(bridged).toContain('--vlaina-color-scrollbar-thumb-hover: var(--a-c);');
    expect(bridged).toContain('--vlaina-sidebar-text: var(--df);');
    expect(bridged).toContain('--vlaina-sidebar-notes-folder-icon: var(--ac-bu);');
    expect(bridged).toContain('--vlaina-color-table-drag-control-border: var(--pn-c-a);');
    expect(bridged).toContain('--font-sans: var(--v-fm-text-local);');
    expect(bridged).toContain('--font-text: var(--v-fm-text-local);');
    expect(bridged).toContain('--font-mono: var(--v-fm-code-local);');
    expect(bridged).toContain('--font-monospace: var(--v-fm-code-local);');
    expect(bridged).toContain('--vlaina-color-panel-glass: linear-gradient(180deg, rgb(255 255 255 / 0.64), rgb(255 255 255 / 0.38));');
    expect(bridged).toContain('--vlaina-color-ai-review-panel: var(--vlaina-color-white);');
    expect(bridged).toContain('--vlaina-code-syntax-keyword: #d73a49;');
    expect(bridged).toContain('--vlaina-shadow-menu: var(--v-fl-sd, 0 12px 36px -12px rgba(15, 23, 42, 0.24));');
    expect(bridged).toContain('--vlaina-shadow-floating-panel: var(--v-fl-sd, 0 16px 40px rgba(15, 23, 42, 0.12));');
    expect(bridged).toContain('--vlaina-shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1)');
    expect(bridged).toContain('--vlaina-filter-icon-hover: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));');
    expect(bridged).not.toContain('#write');
    expect(bridged).not.toContain(':root[data-vlaina-imported-app-theme="vlook-fancy"].dark');
    expect(bridged).not.toContain(':root[data-vlaina-imported-app-theme="vlook-fancy"].light');
  });

  it('maps Obsidian app chrome variables into the same Vlaina app shell tokens', () => {
    const css = [
      'body.theme-dark {',
      '  --background-primary: #101010;',
      '  --background-secondary: #181818;',
      '  --background-secondary-alt: #202020;',
      '  --background-modifier-hover: #222;',
      '  --background-modifier-active: #2a3440;',
      '  --background-modifier-border: #333;',
      '  --interactive-hover: #242424;',
      '  --interactive-normal: #202020;',
      '  --text-normal: #eee;',
      '  --text-muted: #aaa;',
      '  --interactive-accent: #88ccff;',
      '  --interactive-accent-hover: #a8d8ff;',
      '  --text-selection: rgba(136, 204, 255, 0.25);',
      '  --code-background: #181818;',
      '  --code-normal: #eeeeee;',
      '  --color-red: #fb464c;',
      '  --color-green: #44cf6e;',
      '  --color-orange: #e9973f;',
      '  --color-blue: #027aff;',
      '  --font-text-theme: Inter, sans-serif;',
      '  --font-interface-theme: system-ui, sans-serif;',
      '  --font-monospace-theme: "JetBrains Mono", monospace;',
      '  --scrollbar-thumb-bg: #444;',
      '  --scrollbar-active-thumb-bg: #777;',
      '  --table-selection: rgba(136, 204, 255, 0.18);',
      '  --table-selection-border-color: #88ccff;',
      '  --nav-item-color: #bbb;',
      '  --nav-item-color-hover: #fff;',
      '  --nav-item-color-active: #dff4ff;',
      '  --nav-item-background-hover: #1f2a33;',
      '  --nav-item-background-active: #223b4a;',
      '  --nav-collapse-icon-color: #999;',
      '  --tab-text-color-focused-active-current: #fff;',
      '  --tab-outline-color: #333;',
      '}',
      '.markdown-preview-view { color: var(--text-normal); }',
    ].join('\n');

    const bridged = buildImportedAppThemeCss(css, 'minimal', 'obsidian');

    expect(bridged).toContain(':root[data-vlaina-imported-app-theme="minimal"].dark');
    expect(bridged).toContain('color-scheme: light dark;');
    expect(bridged).toContain('--vlaina-color-surface-main: var(--background-primary);');
    expect(bridged).not.toContain('--vlaina-color-surface-shell-sidebar:');
    expect(bridged).not.toContain('--vlaina-color-surface-sidebar:');
    expect(bridged).toContain('--vlaina-color-text-primary: var(--text-normal);');
    expect(bridged).toContain('--vlaina-color-accent: var(--interactive-accent);');
    expect(bridged).toContain('--vlaina-color-selection: var(--text-selection);');
    expect(bridged).toContain('--vlaina-code-block-background: var(--code-background);');
    expect(bridged).toContain('--vlaina-code-syntax-foreground: var(--code-normal);');
    expect(bridged).toContain('--vlaina-color-danger: var(--color-red);');
    expect(bridged).toContain('--vlaina-color-success: var(--color-green);');
    expect(bridged).toContain('--vlaina-color-warning: var(--color-orange);');
    expect(bridged).toContain('--vlaina-color-info: var(--color-blue);');
    expect(bridged).toContain('--vlaina-color-scrollbar-thumb: var(--scrollbar-thumb-bg);');
    expect(bridged).toContain('--vlaina-color-scrollbar-thumb-hover: var(--scrollbar-active-thumb-bg);');
    expect(bridged).toContain('--vlaina-sidebar-text: var(--nav-item-color);');
    expect(bridged).toContain('--vlaina-sidebar-icon: var(--nav-collapse-icon-color);');
    expect(bridged).toContain('--vlaina-sidebar-row-hover: var(--nav-item-background-hover);');
    expect(bridged).toContain('--vlaina-sidebar-row-active: var(--nav-item-background-active);');
    expect(bridged).toContain('--vlaina-sidebar-row-selected-bg: var(--nav-item-background-active);');
    expect(bridged).toContain('--vlaina-sidebar-row-selected-text: var(--nav-item-color-active);');
    expect(bridged).toContain('--vlaina-color-pill-surface-hover: var(--nav-item-background-hover);');
    expect(bridged).toContain('--vlaina-color-control-hover-bg: var(--nav-item-background-hover);');
    expect(bridged).toContain('--vlaina-color-setting-control-active: var(--nav-item-background-active);');
    expect(bridged).toContain('--vlaina-color-tab-active-fg: var(--tab-text-color-focused-active-current);');
    expect(bridged).toContain('--vlaina-color-tab-separator: var(--tab-outline-color);');
    expect(bridged).toContain('--vlaina-color-table-column-source-highlight-bg: var(--table-selection);');
    expect(bridged).toContain('--font-sans: var(--font-text-theme);');
    expect(bridged).toContain('--font-interface: var(--font-interface-theme);');
    expect(bridged).toContain('--font-mono: var(--font-monospace-theme);');
    expect(bridged).not.toContain('--vlaina-shadow-menu: var(--v-fl-sd');
    expect(bridged).not.toContain('--vlaina-color-panel-glass: linear-gradient(180deg, rgb(255 255 255 / 0.64)');
    expect(bridged).not.toContain('.markdown-preview-view');
  });

  it('does not bridge unsafe URL custom property values into the app shell', () => {
    const bridged = buildImportedAppThemeCss(
      ':root { --db: url("javascript:alert(1)"); --df: #111; --v-fm-text-local: url("./font.woff2"); }',
      'unsafe',
      'typora'
    );

    expect(bridged).not.toContain('javascript:alert');
    expect(bridged).not.toContain('--vlaina-color-surface-main');
    expect(bridged).not.toContain('--font-sans');
    expect(bridged).toContain('--vlaina-color-text-primary: var(--df);');
  });

  it('promotes safe imported document backgrounds into the app surface', () => {
    const bridged = buildImportedAppThemeCss(
      [
        ':root { --df: #1c1e1f; }',
        'html, body { background: #f7f3e8; }',
        'body { background-color: color-mix(in srgb, #f7f3e8 92%, white); }',
        '#write { background: #ffffff; }',
      ].join('\n'),
      'paper',
      'typora'
    );

    expect(bridged).toContain('--vlaina-imported-app-background: color-mix(in srgb, #f7f3e8 92%, white);');
    expect(bridged).toContain('--vlaina-color-surface-main: var(--vlaina-imported-app-background);');
    expect(bridged).not.toContain('--vlaina-imported-app-background: #ffffff;');
    expect(bridged).not.toContain('--vlaina-imported-app-background-layer: #ffffff;');
  });

  it('promotes Typora full document background layers without treating them as color tokens', () => {
    const bridged = buildImportedAppThemeCss(
      [
        ':root { --db: #f7f3e8; --d-bi: linear-gradient(90deg, #fff8 1px, transparent 1px); --df: #111; }',
        'body.typora-export { background: var(--d-bi), var(--db); }',
        'content > #write { background: var(--db) var(--d-bi); }',
      ].join('\n'),
      'paper-layer',
      'typora'
    );

    expect(bridged).toContain('--vlaina-imported-app-background-layer: var(--db) var(--d-bi);');
    expect(bridged).toContain('--vlaina-color-surface-main: var(--db);');
    expect(bridged).not.toContain('--vlaina-color-surface-main: var(--vlaina-imported-app-background-layer);');
  });

  it('promotes Typora page pseudo-element texture backgrounds into app background variables', () => {
    const bridged = buildImportedAppThemeCss(
      [
        ':root { --db: #fff; --db06: rgba(255, 255, 255, 0.6); --df: #111; }',
        '@supports (backdrop-filter: blur(1px)) {',
        '  .typora-export #write:not(.done):before, .v-welcome-page {',
        '    backdrop-filter: blur(10px);',
        '    background: radial-gradient(var(--db06) 4px, var(--db) 4px);',
        '    background-size: 10px 10px;',
        '  }',
        '}',
      ].join('\n'),
      'paper-grid',
      'typora'
    );

    expect(bridged).toContain('--vlaina-imported-app-background-layer: radial-gradient(var(--db06) 4px, var(--db) 4px);');
    expect(bridged).toContain('--vlaina-imported-app-background-size: 10px 10px;');
    expect(bridged).not.toContain('#write:not(.done):before');
    expect(bridged).not.toContain('.v-welcome-page');
  });

  it('does not promote unsafe or image-like document backgrounds into color tokens', () => {
    const bridged = buildImportedAppThemeCss(
      [
        'body { background: #fff url(javascript:alert(1)); }',
        'html { background: linear-gradient(red, blue); }',
        ':root { --df: #111; }',
      ].join('\n'),
      'unsafe-background',
      'typora'
    );

    expect(bridged).toContain('--vlaina-imported-app-background-layer: linear-gradient(red, blue);');
    expect(bridged).not.toContain('--vlaina-imported-app-background:');
    expect(bridged).not.toContain('--vlaina-color-surface-main');
    expect(bridged).toContain('--vlaina-color-text-primary: var(--df);');
  });

  it('keeps Typora prefers-color-scheme variables out of app dark-mode branches', () => {
    const bridged = buildImportedAppThemeCss(
      [
        ':root {',
        '  --db: var(--db-lg);',
        '  --df: var(--df-lg);',
        '  --db-lg: #fff;',
        '  --db-dk: #1c1e1f;',
        '  --df-lg: #1c1e1f;',
        '  --df-dk: #eceeef;',
        '}',
        '@media (prefers-color-scheme: dark) {',
        '  :root {',
        '    --db: var(--db-dk);',
        '    --df: var(--df-dk);',
        '  }',
        '}',
        '@media (prefers-color-scheme: light) {',
        '  :root {',
        '    --df-a: #6b7280;',
        '  }',
        '}',
      ].join('\n'),
      'vlook-fancy',
      'typora'
    );

    expect(bridged).toContain(':root[data-vlaina-imported-app-theme="vlook-fancy"] {');
    expect(bridged).toContain('color-scheme: light;');
    expect(bridged).toContain('--vlaina-color-surface-main: var(--db);');
    expect(bridged).not.toContain(':root[data-vlaina-imported-app-theme="vlook-fancy"].dark');
    expect(bridged).not.toContain(':root[data-vlaina-imported-app-theme="vlook-fancy"].light');
    expect(bridged).not.toContain('--db: var(--db-dk);');
    expect(bridged).not.toContain('--df: var(--df-dk);');

    expect(bridged).toContain('--db: var(--db-lg);');
    expect(bridged).toContain('--df-a: #6b7280;');
    expect(bridged).toContain('--vlaina-color-text-muted: var(--df-a);');
  });

  it('does not treat component-scoped Obsidian rules as app shell theme variables', () => {
    const bridged = buildImportedAppThemeCss(
      [
        '.theme-dark { --background-primary: #101010; --text-normal: #eee; }',
        '.theme-dark .modal-container { --background-primary: hotpink; --text-normal: lime; }',
        '.theme-light .markdown-preview-view { --background-primary: yellow; }',
        '@media print { :root { --background-primary: white; } }',
      ].join('\n'),
      'minimal',
      'obsidian'
    );

    expect(bridged).toContain('--background-primary: #101010;');
    expect(bridged).toContain('--vlaina-color-surface-main: var(--background-primary);');
    expect(bridged).not.toContain('hotpink');
    expect(bridged).not.toContain('lime');
    expect(bridged).not.toContain('yellow');
    expect(bridged).not.toContain('--background-primary: white;');
  });

  it('avoids obvious font token self references when bridging imported variables', () => {
    const bridged = buildImportedAppThemeCss(
      ':root { --font-text: var(--font-sans); --font-interface-theme: system-ui; --font-monospace: var(--font-mono); --font-monospace-theme: monospace; }',
      'self-reference',
      'obsidian'
    );

    expect(bridged).not.toContain('--font-sans: var(--font-text);');
    expect(bridged).toContain('--font-sans: var(--font-interface-theme);');
    expect(bridged).not.toContain('--font-mono: var(--font-monospace);');
    expect(bridged).toContain('--font-mono: var(--font-monospace-theme);');
  });
});
