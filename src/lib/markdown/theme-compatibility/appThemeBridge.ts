import postcss from 'postcss';

const ROOT_SELECTOR = ':root';

function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isThemeShellRule(selector: string): boolean {
  const normalized = selector.trim();
  if (!normalized || findTopLevelSelectorBoundary(normalized, 0) >= 0) {
    return false;
  }

  return /^(?::root|html|body)(?=$|[.#:[)])/i.test(normalized)
    || /^\.(?:theme-(?:dark|light)|dark|light)(?=$|[.#:[)])/i.test(normalized);
}

function isDarkThemeRule(selector: string): boolean {
  return /\.theme-dark\b|(?:^|[\s,])(?:html|body)?\.dark\b/i.test(selector);
}

function isLightThemeRule(selector: string): boolean {
  return /\.theme-light\b|(?:^|[\s,])(?:html|body)?\.light\b/i.test(selector);
}

type ThemeColorSchemeBucket = 'base' | 'dark' | 'light';

function getAncestorMediaColorScheme(rule: postcss.Rule): ThemeColorSchemeBucket | 'skip' | null {
  let parent = rule.parent as postcss.AnyNode | undefined;
  while (parent) {
    if (parent.type === 'atrule' && parent.name.toLowerCase() === 'media') {
      const params = parent.params.toLowerCase();
      if (/\bprint\b/.test(params)) {
        return 'skip';
      }
      if (/prefers-color-scheme\s*:\s*dark/.test(params)) {
        return 'dark';
      }
      if (/prefers-color-scheme\s*:\s*light/.test(params)) {
        return 'light';
      }
    }
    parent = parent.parent as postcss.AnyNode | undefined;
  }

  return null;
}

function splitSelectorList(selectorList: string): string[] {
  const selectors: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let index = 0; index < selectorList.length; index += 1) {
    const char = selectorList[index];
    const previous = selectorList[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (char === '[') bracketDepth += 1;
    if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (char === ',' && parenDepth === 0 && bracketDepth === 0) {
      selectors.push(selectorList.slice(start, index).trim());
      start = index + 1;
    }
  }

  selectors.push(selectorList.slice(start).trim());
  return selectors.filter(Boolean);
}

function findTopLevelSelectorBoundary(selector: string, start: number): number {
  let quote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let index = start; index < selector.length; index += 1) {
    const char = selector[index];
    const previous = selector[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (char === '[') bracketDepth += 1;
    if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (parenDepth === 0 && bracketDepth === 0 && (/[\s>+~]/.test(char))) {
      return index;
    }
  }

  return -1;
}

function getRuleColorSchemeBuckets(rule: postcss.Rule): ThemeColorSchemeBucket[] {
  const mediaBucket = getAncestorMediaColorScheme(rule);
  if (mediaBucket === 'skip') return [];

  const buckets = new Set<ThemeColorSchemeBucket>();

  for (const selector of splitSelectorList(rule.selector)) {
    if (!isThemeShellRule(selector)) continue;
    if (isDarkThemeRule(selector)) {
      buckets.add('dark');
      continue;
    }
    if (isLightThemeRule(selector)) {
      buckets.add('light');
      continue;
    }
    buckets.add(mediaBucket ?? 'base');
  }

  return Array.from(buckets);
}

function isSafeAppThemeCustomPropertyValue(value: string): boolean {
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  if (normalized.includes('javascript:') || normalized.includes('vbscript:')) {
    return false;
  }

  return !/url\(/i.test(value);
}

function collectThemeCustomProperties(css: string): {
  base: Map<string, string>;
  dark: Map<string, string>;
  light: Map<string, string>;
} {
  const root = postcss.parse(css, { from: undefined });
  const base = new Map<string, string>();
  const dark = new Map<string, string>();
  const light = new Map<string, string>();

  root.walkRules((rule) => {
    const buckets = getRuleColorSchemeBuckets(rule);
    if (buckets.length === 0) return;

    rule.walkDecls((declaration) => {
      if (!declaration.prop.startsWith('--')) return;
      if (!isSafeAppThemeCustomPropertyValue(declaration.value)) return;
      for (const bucket of buckets) {
        const target = bucket === 'dark' ? dark : bucket === 'light' ? light : base;
        target.set(declaration.prop, declaration.value);
      }
    });
  });

  return { base, dark, light };
}

function renderCustomProperties(properties: Map<string, string>): string {
  return Array.from(properties.entries())
    .map(([property, value]) => `  ${property}: ${value};`)
    .join('\n');
}

const VLAINA_THEME_MAPPINGS: Array<{
  target: string;
  sources: string[];
}> = [
  { target: '--vlaina-color-surface-main', sources: ['--db', '--background-primary'] },
  { target: '--vlaina-color-surface-shell-sidebar', sources: ['--db-ext', '--db', '--background-secondary'] },
  { target: '--vlaina-color-surface-sidebar', sources: ['--db-ext', '--background-secondary-alt', '--db', '--background-secondary'] },
  { target: '--vlaina-color-surface-menu', sources: ['--pn-c', '--db-ext', '--background-primary-alt'] },
  { target: '--vlaina-color-surface-secondary', sources: ['--pn-c', '--background-secondary'] },
  { target: '--vlaina-color-surface-tertiary', sources: ['--pn-c-a', '--background-modifier-hover'] },
  { target: '--vlaina-color-surface-hover', sources: ['--bq-bg-fd', '--nav-item-background-hover', '--background-modifier-hover', '--interactive-hover'] },
  { target: '--vlaina-color-surface-active', sources: ['--v-selected-c', '--nav-item-background-active', '--background-modifier-active', '--background-modifier-active-hover', '--interactive-normal'] },
  { target: '--vlaina-color-surface-row-hover', sources: ['--bq-bg-fd', '--nav-item-background-hover', '--background-modifier-hover'] },
  { target: '--vlaina-color-surface-row-active', sources: ['--v-selected-c', '--nav-item-background-active', '--background-modifier-active'] },
  { target: '--vlaina-color-surface-empty', sources: ['--pn-c', '--background-secondary-alt', '--background-secondary'] },
  { target: '--vlaina-color-input-surface', sources: ['--db', '--background-modifier-form-field', '--background-primary'] },
  { target: '--vlaina-color-provider-input', sources: ['--pn-c', '--background-modifier-form-field', '--background-secondary'] },
  { target: '--vlaina-color-floating-surface', sources: ['--db', '--background-primary'] },
  { target: '--vlaina-color-floating-surface-translucent', sources: ['--bq-bg', '--background-secondary'] },
  { target: '--vlaina-color-panel-muted', sources: ['--bq-bg-fd', '--background-modifier-hover', '--background-secondary-alt'] },
  { target: '--vlaina-color-row-soft', sources: ['--bq-bg-fd', '--background-modifier-hover'] },
  { target: '--vlaina-color-text-strong', sources: ['--df', '--text-normal'] },
  { target: '--vlaina-color-text-primary', sources: ['--df', '--text-normal'] },
  { target: '--vlaina-color-text-sidebar', sources: ['--df', '--text-normal'] },
  { target: '--vlaina-color-text-hover', sources: ['--df', '--text-normal'] },
  { target: '--vlaina-color-text-secondary', sources: ['--df-a', '--text-muted'] },
  { target: '--vlaina-color-text-muted', sources: ['--df-a', '--text-muted'] },
  { target: '--vlaina-color-text-soft', sources: ['--df-a', '--text-faint'] },
  { target: '--vlaina-color-text-tertiary', sources: ['--df-a', '--text-faint'] },
  { target: '--vlaina-color-text-disabled', sources: ['--df-a', '--text-faint'] },
  { target: '--vlaina-color-sidebar-pin', sources: ['--df-a', '--text-muted'] },
  { target: '--vlaina-color-muted-icon', sources: ['--df-a', '--text-muted', '--icon-color'] },
  { target: '--vlaina-color-border', sources: ['--pn-c-a', '--background-modifier-border'] },
  { target: '--vlaina-color-border-shell', sources: ['--pn-c-a', '--background-modifier-border'] },
  { target: '--vlaina-color-menu-border', sources: ['--pn-c-a', '--background-modifier-border'] },
  { target: '--vlaina-color-subtle-border', sources: ['--pn-c-a', '--background-modifier-border'] },
  { target: '--vlaina-color-subtle-border-strong', sources: ['--pn-c-a', '--background-modifier-border-hover', '--background-modifier-border'] },
  { target: '--vlaina-color-panel-border', sources: ['--pn-c-a', '--background-modifier-border'] },
  { target: '--vlaina-color-accent', sources: ['--a-c', '--interactive-accent', '--text-accent'] },
  { target: '--vlaina-color-accent-hover', sources: ['--a-o-c', '--interactive-accent-hover', '--text-accent-hover'] },
  { target: '--vlaina-color-accent-soft', sources: ['--v-selected-c', '--text-selection', '--background-modifier-active'] },
  { target: '--vlaina-color-accent-light', sources: ['--v-selected-c', '--text-selection', '--background-modifier-active'] },
  { target: '--vlaina-color-accent-muted-bg', sources: ['--v-selected-c', '--text-selection', '--background-modifier-active'] },
  { target: '--vlaina-color-accent-soft-bg', sources: ['--v-selected-c', '--text-selection', '--background-modifier-active'] },
  { target: '--vlaina-color-accent-panel-bg', sources: ['--v-selected-c', '--text-selection', '--background-modifier-active'] },
  { target: '--vlaina-color-accent-border-muted', sources: ['--a-c', '--interactive-accent', '--text-accent'] },
  { target: '--vlaina-color-accent-border-hover', sources: ['--a-o-c', '--interactive-accent-hover', '--text-accent-hover'] },
  { target: '--vlaina-color-accent-focus-ring', sources: ['--v-selected-c', '--text-selection', '--background-modifier-active'] },
  { target: '--vlaina-color-sidebar-focus-ring', sources: ['--v-selected-c', '--text-selection', '--background-modifier-active'] },
  { target: '--vlaina-color-caret', sources: ['--a-c', '--interactive-accent', '--text-accent'] },
  { target: '--vlaina-color-selection', sources: ['--v-selected-c', '--text-selection', '--mark-bg'] },
  { target: '--vlaina-color-editor-block-selection-bg', sources: ['--v-selected-c', '--text-selection'] },
  { target: '--vlaina-color-editor-block-selection-handle', sources: ['--df', '--text-normal'] },
  { target: '--vlaina-color-mark-highlight-bg', sources: ['--mark-bg', '--text-highlight-bg', '--color-yellow'] },
  { target: '--vlaina-color-mark-highlight-fg', sources: ['--df', '--text-normal'] },
  { target: '--vlaina-color-find-match-bg', sources: ['--mark-bg', '--text-highlight-bg', '--color-yellow'] },
  { target: '--vlaina-color-find-match-active-bg', sources: ['--ac-ye', '--color-yellow'] },
  { target: '--vlaina-color-scrollbar-thumb', sources: ['--pn-c-a', '--scrollbar-thumb-bg', '--background-modifier-border'] },
  { target: '--vlaina-color-scrollbar-thumb-hover', sources: ['--a-c', '--scrollbar-active-thumb-bg', '--interactive-accent', '--text-accent'] },
  { target: '--vlaina-color-setting-panel', sources: ['--db-ext', '--db', '--background-primary'] },
  { target: '--vlaina-color-setting-content', sources: ['--bq-bg-fd', '--background-secondary'] },
  { target: '--vlaina-color-setting-control', sources: ['--pn-c', '--background-secondary', '--interactive-normal'] },
  { target: '--vlaina-color-setting-control-active', sources: ['--v-selected-c', '--nav-item-background-active', '--background-modifier-active', '--db', '--background-primary', '--interactive-accent'] },
  { target: '--vlaina-color-setting-field', sources: ['--db-ext', '--db', '--background-modifier-form-field', '--background-primary'] },
  { target: '--vlaina-color-pill-surface', sources: ['--db', '--background-primary', '--interactive-normal'] },
  { target: '--vlaina-color-pill-surface-hover', sources: ['--pn-c', '--bq-bg-fd', '--nav-item-background-hover', '--background-modifier-hover', '--interactive-hover'] },
  { target: '--vlaina-color-control-hover-bg', sources: ['--bq-bg-fd', '--nav-item-background-hover', '--background-modifier-hover', '--interactive-hover'] },
  { target: '--vlaina-color-control-hover-fg', sources: ['--df', '--nav-item-color-hover', '--text-normal'] },
  { target: '--vlaina-color-control-ring', sources: ['--a-c', '--interactive-accent', '--text-accent'] },
  { target: '--vlaina-color-control-ring-offset', sources: ['--db', '--background-primary'] },
  { target: '--vlaina-color-titlebar-button', sources: ['--df-a', '--titlebar-text-color', '--text-muted'] },
  { target: '--vlaina-color-titlebar-button-hover', sources: ['--df', '--titlebar-text-color-focused', '--text-normal'] },
  { target: '--vlaina-color-titlebar-button-active', sources: ['--df', '--titlebar-text-color-focused', '--text-normal'] },
  { target: '--vlaina-color-tab-active-fg', sources: ['--df', '--tab-text-color-focused-active-current', '--tab-text-color-focused-active', '--text-normal'] },
  { target: '--vlaina-color-tab-muted-fg', sources: ['--df-a', '--tab-text-color', '--tab-text-color-focused', '--text-muted'] },
  { target: '--vlaina-color-tab-muted-hover-fg', sources: ['--a-c', '--tab-text-color-focused', '--text-accent'] },
  { target: '--vlaina-color-tab-close-fg', sources: ['--df-a', '--icon-color', '--text-muted'] },
  { target: '--vlaina-color-tab-close-hover-fg', sources: ['--df', '--icon-color-hover', '--text-normal'] },
  { target: '--vlaina-color-tab-separator', sources: ['--pn-c-a', '--tab-outline-color', '--background-modifier-border'] },
  { target: '--vlaina-color-tab-overlay-bg', sources: ['--db', '--tab-container-background', '--background-primary'] },
  { target: '--vlaina-color-attachment-surface', sources: ['--pn-c', '--background-secondary'] },
  { target: '--vlaina-color-attachment-remove-bg', sources: ['--db', '--background-primary'] },
  { target: '--vlaina-color-attachment-remove-bg-hover', sources: ['--pn-c', '--background-modifier-hover'] },
  { target: '--vlaina-color-attachment-remove-fg', sources: ['--df-a', '--text-muted'] },
  { target: '--vlaina-color-attachment-remove-fg-hover', sources: ['--df', '--text-normal'] },
  { target: '--vlaina-color-editor-image-surface', sources: ['--pn-c', '--background-secondary'] },
  { target: '--vlaina-color-editor-image-border', sources: ['--pn-c-a', '--background-modifier-border'] },
  { target: '--vlaina-color-editor-image-placeholder', sources: ['--df-a', '--text-faint'] },
  { target: '--vlaina-color-image-drag-placeholder-bg', sources: ['--v-selected-c', '--text-selection'] },
  { target: '--vlaina-color-image-overlay-bg', sources: ['--background-modifier-cover', '--bq-bg'] },
  { target: '--vlaina-color-image-overlay-fg', sources: ['--text-on-accent', '--db', '--background-primary'] },
  { target: '--vlaina-color-image-overlay-muted-fg', sources: ['--df-a', '--text-muted'] },
  { target: '--vlaina-color-media-overlay-border', sources: ['--pn-c-a', '--background-modifier-border'] },
  { target: '--vlaina-color-media-overlay-bg', sources: ['--background-modifier-cover', '--bq-bg'] },
  { target: '--vlaina-color-media-overlay-bg-hover', sources: ['--background-modifier-cover', '--bq-bg'] },
  { target: '--vlaina-color-media-overlay-fg', sources: ['--df', '--text-normal'] },
  { target: '--vlaina-sidebar-row-selected-bg', sources: ['--v-selected-c', '--nav-item-background-active', '--background-modifier-active', '--text-selection'] },
  { target: '--vlaina-sidebar-row-selected-text', sources: ['--a-c', '--nav-item-color-active', '--interactive-accent', '--text-accent'] },
  { target: '--vlaina-sidebar-row-selected-text-soft', sources: ['--a-c', '--nav-item-color-active', '--interactive-accent', '--text-accent'] },
  { target: '--vlaina-sidebar-row-selected-text-muted', sources: ['--a-c', '--nav-item-color-active', '--interactive-accent', '--text-accent'] },
  { target: '--vlaina-sidebar-text', sources: ['--df', '--nav-item-color', '--text-normal'] },
  { target: '--vlaina-sidebar-text-muted', sources: ['--df-a', '--nav-item-color', '--text-muted'] },
  { target: '--vlaina-sidebar-text-soft', sources: ['--df-a', '--text-faint'] },
  { target: '--vlaina-sidebar-icon', sources: ['--df-a', '--nav-collapse-icon-color', '--icon-color', '--text-muted'] },
  { target: '--vlaina-sidebar-icon-hover', sources: ['--a-c', '--nav-item-color-hover', '--icon-color-hover', '--text-accent'] },
  { target: '--vlaina-sidebar-fade', sources: ['--db-ext', '--db', '--background-secondary'] },
  { target: '--vlaina-sidebar-row-hover', sources: ['--bq-bg-fd', '--nav-item-background-hover', '--background-modifier-hover'] },
  { target: '--vlaina-sidebar-row-active', sources: ['--v-selected-c', '--nav-item-background-active', '--background-modifier-active'] },
  { target: '--vlaina-sidebar-notes-row-drag', sources: ['--v-selected-c', '--text-selection'] },
  { target: '--vlaina-sidebar-notes-section-label', sources: ['--df', '--nav-item-color', '--text-normal'] },
  { target: '--vlaina-sidebar-notes-section-label-hover', sources: ['--a-c', '--nav-item-color-hover', '--text-accent'] },
  { target: '--vlaina-sidebar-notes-outline-icon', sources: ['--a-c', '--interactive-accent', '--text-accent'] },
  { target: '--vlaina-sidebar-notes-chat-icon', sources: ['--a-c', '--interactive-accent', '--text-accent'] },
  { target: '--vlaina-sidebar-notes-file-icon', sources: ['--a-c', '--interactive-accent', '--text-accent'] },
  { target: '--vlaina-sidebar-notes-folder-icon', sources: ['--ac-bu', '--color-blue', '--text-accent'] },
  { target: '--vlaina-sidebar-notes-empty-surface', sources: ['--pn-c', '--background-secondary-alt', '--background-secondary'] },
  { target: '--vlaina-sidebar-notes-menu-bg', sources: ['--pn-c', '--background-primary-alt', '--background-secondary'] },
  { target: '--vlaina-sidebar-notes-menu-border', sources: ['--pn-c-a', '--background-modifier-border'] },
  { target: '--vlaina-code-block-background', sources: ['--code-bg', '--code-background'] },
  { target: '--vlaina-code-inline-background', sources: ['--code-bg', '--code-background'] },
  { target: '--vlaina-code-inline-foreground', sources: ['--code-t', '--code-normal'] },
  { target: '--vlaina-code-syntax-foreground', sources: ['--code-t', '--code-normal', '--text-normal'] },
  { target: '--vlaina-code-syntax-muted', sources: ['--df-a', '--text-muted'] },
  { target: '--vlaina-code-block-copy-color', sources: ['--df-a', '--text-muted'] },
  { target: '--vlaina-color-info', sources: ['--ac-bu', '--color-blue'] },
  { target: '--vlaina-color-success', sources: ['--ac-gn', '--color-green'] },
  { target: '--vlaina-color-warning', sources: ['--ac-og', '--color-orange', '--color-yellow'] },
  { target: '--vlaina-color-danger', sources: ['--ac-rd', '--color-red'] },
  { target: '--vlaina-color-danger-hover', sources: ['--ac-rd', '--color-red'] },
  { target: '--vlaina-color-status-info-fg', sources: ['--ac-bu', '--color-blue'] },
  { target: '--vlaina-color-status-success-fg', sources: ['--ac-gn', '--color-green'] },
  { target: '--vlaina-color-status-warning-fg', sources: ['--ac-og', '--color-orange', '--color-yellow'] },
  { target: '--vlaina-color-status-danger-fg', sources: ['--ac-rd', '--color-red'] },
  { target: '--vlaina-color-status-info-bg', sources: ['--ac-bu-a', '--ac-bu-fd', '--background-modifier-hover'] },
  { target: '--vlaina-color-status-success-bg', sources: ['--ac-gn-a', '--ac-gn-fd', '--background-modifier-hover'] },
  { target: '--vlaina-color-status-warning-bg', sources: ['--ac-og-a', '--ac-og-fd', '--background-modifier-hover'] },
  { target: '--vlaina-color-status-danger-bg', sources: ['--ac-rd-a', '--ac-rd-fd', '--background-modifier-hover'] },
  { target: '--vlaina-color-status-info-border', sources: ['--ac-bu-fd-bd', '--color-blue'] },
  { target: '--vlaina-color-status-success-border', sources: ['--ac-gn-fd-bd', '--color-green'] },
  { target: '--vlaina-color-status-warning-border', sources: ['--ac-og-fd-bd', '--color-orange', '--color-yellow'] },
  { target: '--vlaina-color-status-danger-border', sources: ['--ac-rd-fd-bd', '--color-red'] },
  { target: '--vlaina-color-callout-gray-bg', sources: ['--bq-bg', '--blockquote-background-color', '--background-secondary'] },
  { target: '--vlaina-color-callout-icon-hover-bg', sources: ['--bq-bg-fd', '--background-modifier-hover'] },
  { target: '--vlaina-color-table-drag-control-border', sources: ['--pn-c-a', '--table-border-color', '--background-modifier-border'] },
  { target: '--vlaina-color-table-drag-control-border-hover', sources: ['--a-c', '--table-selection-border-color', '--background-modifier-border-hover', '--text-accent'] },
  { target: '--vlaina-color-table-drag-control-border-focus', sources: ['--a-c', '--table-selection-border-color', '--interactive-accent', '--text-accent'] },
  { target: '--vlaina-color-table-drag-control-bg', sources: ['--db', '--background-modifier-form-field', '--background-primary'] },
  { target: '--vlaina-color-table-drag-control-fg', sources: ['--df-a', '--text-muted'] },
  { target: '--vlaina-color-table-drag-control-fg-active', sources: ['--a-c', '--table-drag-handle-color-active', '--text-accent'] },
  { target: '--vlaina-color-table-column-source-highlight-bg', sources: ['--v-selected-c', '--table-selection', '--text-selection'] },
  { target: '--vlaina-color-frontmatter-border', sources: ['--pn-c-a', '--background-modifier-border'] },
  { target: '--vlaina-color-footnote-ref-bg', sources: ['--code-bg', '--code-background', '--background-secondary'] },
  { target: '--vlaina-color-editor-inline-code-bg', sources: ['--code-bg', '--code-background'] },
  { target: '--vlaina-color-math-editor-border', sources: ['--pn-c-a', '--background-modifier-border'] },
  { target: '--vlaina-color-math-editor-text', sources: ['--df', '--text-normal'] },
  { target: '--vlaina-color-math-editor-secondary-bg-hover', sources: ['--bq-bg-fd', '--background-modifier-hover'] },
  { target: '--vlaina-color-toolbar-border', sources: ['--pn-c-a', '--background-modifier-border'] },
  { target: '--vlaina-color-toolbar-tooltip-bg', sources: ['--db', '--background-primary'] },
  { target: '--vlaina-color-toolbar-tooltip-fg', sources: ['--df', '--text-normal'] },
  { target: '--vlaina-color-toolbar-shortcut-bg', sources: ['--bq-bg-fd', '--background-modifier-hover'] },
  { target: '--font-sans', sources: ['--v-fm-text', '--v-fm-text-local', '--font-text', '--font-text-theme', '--font-interface', '--font-interface-theme'] },
  { target: '--font-mono', sources: ['--v-fm-code', '--v-fm-code-local', '--font-monospace', '--font-monospace-theme'] },
  { target: '--font-text', sources: ['--v-fm-text', '--v-fm-text-local', '--font-text-theme'] },
  { target: '--font-interface', sources: ['--v-fm-bd', '--v-fm-bd-local', '--font-interface-theme'] },
  { target: '--font-monospace', sources: ['--v-fm-code', '--v-fm-code-local', '--font-monospace-theme'] },
];

function renderVlainaMappings(properties: Map<string, string>): string {
  const declarations = VLAINA_THEME_MAPPINGS.flatMap(({ target, sources }) => {
    const source = sources.find((candidate) => canMapSourceToTarget(properties, candidate, target));
    return source ? [`  ${target}: var(${source});`] : [];
  });

  if (declarations.length > 0) {
    declarations.unshift('  color-scheme: light dark;');
  }

  return declarations.join('\n');
}

function canMapSourceToTarget(
  properties: Map<string, string>,
  source: string,
  target: string
): boolean {
  const value = properties.get(source);
  if (!value) return false;
  return !new RegExp(`var\\(\\s*${escapeRegExp(target)}\\b`, 'i').test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderRule(selector: string, properties: Map<string, string>): string {
  const customProperties = renderCustomProperties(properties);
  const content = [
    customProperties,
    renderVlainaMappings(properties),
  ].filter(Boolean).join('\n');

  return `${selector} {\n${content}\n}`;
}

export function buildImportedAppThemeCss(css: string, importedThemeId: string): string {
  const { base, dark, light } = collectThemeCustomProperties(css);
  if (base.size === 0 && dark.size === 0 && light.size === 0) {
    return '';
  }

  const attributeSelector = `[data-vlaina-imported-app-theme="${escapeCssString(importedThemeId)}"]`;
  const rules = [
    renderRule(`${ROOT_SELECTOR}${attributeSelector}`, base),
  ];

  if (light.size > 0) {
    rules.push(renderRule(`${ROOT_SELECTOR}${attributeSelector}.light`, light));
  }

  if (dark.size > 0) {
    rules.push(renderRule(`${ROOT_SELECTOR}${attributeSelector}.dark`, dark));
  }

  return rules.join('\n\n');
}
