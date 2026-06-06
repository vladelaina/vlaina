function classSelectorPattern(classNamePattern: string): RegExp {
  return new RegExp(String.raw`\.(?:${classNamePattern})(?=$|[^\w-])`, 'i');
}

function idSelectorPattern(idPattern: string): RegExp {
  return new RegExp(String.raw`#(?:${idPattern})(?=$|[^\w-])`, 'i');
}

const TYPOGRAPHIC_ICON_CHROME = String.raw`fa(?:-[\w-]+)?|ion-[\w-]+|ty-icon|ty-md-radio-button-[\w-]+`;

const TYPORA_APP_CHROME = String.raw`typora-export-sidebar|typora-export-show-outline|typora-sourceview-on|typora-quick-open(?:-[\w-]+)?|ty-quick-open-[\w-]+|file-list-item(?:-[\w-]+)?|file-tree-node|file-library(?:-[\w-]+)?|file-library-tree|file-library-file-node|file-node(?:-[\w-]+)?|sidebar(?:-[\w-]+)?|footer-btn|ty-show-[\w-]+|typora-sidebar-resizer(?:-[\w-]+)?|outline(?:-[\w-]+)?|outline-content|popover-title|md-grid-board(?:-wrap)?|megamenu-[\w-]+|ty-menu-btn-area(?:-[\w-]+)?|ty-sidebar-search-panel|searchpanel-search-option-btn|form-control|auto-suggest-container|dropdown-menu|mac-seamless-mode`;

const TYPORA_EDITOR_CHROME = String.raw`md-image-btn|md-image-input-src-btn|md-image-pick-file-btn|md-image-src-span|md-link|md-url|md-tag|md-expand|md-f-tooltip|md-notification-container|md-comment|md-meta|md-raw-inline|md-rawblock(?:-[\w-]+)?|md-htmlblock-panel|md-mathblock-panel|md-fences-adv-panel|md-fences-advanced|md-focus(?:-container)?|md-toc-tooltip|code-tooltip(?:-[\w-]+)?|ty-input|md-arrow|error-message|md-emoji-span|md-tab|ty-table-edit|md-resize-table|md-delete-table|typora-source|toggle-sourceview-btn|cm-overlay|cm-del|cm-table-row|cm-yaml|cm-block-start|cm-variable-3|cm-hr|cm-negative|cm-positive|cm-builtin`;

const VLOOK_APP_CHROME = String.raw`v-mask(?:-close)?|v-welcome(?:-[\w-]+)?|v-nav-[\w-]+|v-doc(?:-[\w-]+)?|v-footnote-pn(?:-[\w-]+)?|v-link-info-list|v-link-error|v-font-style(?:-[\w-]+)?|v-fontinfo-[\w-]+|v-status-bar(?:-[\w-]+)?|v-shortcut-bar(?:-[\w-]+)?|v-toolbar(?:-[\w-]+)?|v-content(?:-[\w-]+)?|v-content-assistor|v-tool-tips|v-info-tips|v-tips|v-doc-lib-item|v-fill-width|v-search(?:-[\w-]+)?|v-link-chk-result|v-check-hash(?:-[\w-]+)?|v-audio-mini-control|v-new-version|v-para-nav-[\w-]+|v-chapter-nav(?:-[\w-]+)?|v-fig-nav(?:-[\w-]+)?|v-fullscreen-toolbar|v-print-tip|v-index-filter-result|v-pgbar|v-pic-in-pic|v-pip-btn|v-btn-done|v-fig-action|v-fig-page-num|v-toc(?:-title|-item|-folder)?|v-map-item|v-item-current|v-segment(?:-btn)?|v-spotlight(?:-in-dark)?|v-laser-cursor|v-loading|v-resume-reading|v-float-card|v-duration|v-transition-[\w-]+|v-rotate(?:45|90)|v-para-nav-mask-border|top-more|bottom-more|doc-copyright|v-copyright|laser-pointer|v-accent-btn|v-interactive|v-focus-info|v-focus-out`;

const OBSIDIAN_APP_CHROME = String.raw`app-container|workspace(?:-[\w-]+)?|nav-[\w-]+|vertical-tab-nav-item|empty-state-[\w-]+|document-search(?:-[\w-]+)?|document-replace(?:-[\w-]+)?|search-(?:highlight|results-info|input(?:-[\w-]+)?)|obsidian-search-match-highlight|spellchecker-dictionary-remove-button|u-clickable|textLayer|notice|query-toolbar-menu|combobox-button|view-action|view-actions|view-header(?:-[\w-]+)?|inline-title|full-file-names|CodeMirror-(?:foldmarker|foldgutter-[\w-]+|wrap)|mod-(?:left|right|top|root|left-split|right-split|sidedock|working|success|macos|windows|linux|publish)|labeled-nav|collapse-icon|collapse-indicator|clickable-icon|list-collapse-indicator|tooltip|gemmy-tooltip|popover|hover-popover|hider-ribbon|horizontal-main-container|colorful-active|colorful-frame|git-view-body|commit-msg|cm-heading-marker|cm-panels-bottom|cm-sizer|metadata(?:-[\w-]+)?|setting(?:-[\w-]+)?|tree-item(?:-[\w-]+)?|slider|modal(?:-[\w-]+)?|status-bar(?:-[\w-]+)?|ribbon(?:-[\w-]+)?|side-dock(?:-[\w-]+)?|sync-status-icon|prompt(?:-[\w-]+)?|suggestion(?:-[\w-]+)?|community-item|titlebar(?:-[\w-]+)?|list-item-part|menu-item|tab-stack-[\w-]+|MiniSettings-statusbar-button|themed-color-wrapper|reader-mode-content|publish(?:-[\w-]+)?|menu|button|input`;

const OBSIDIAN_PLUGIN_CHROME = String.raw`search-result-file-match|search-result-file-matched-text|edit-block-button|excalibrain-[\w-]+|excalidraw-dirty|obsidian-icon-folder-icon|release-notes-view|recent-files-[\w-]+|file-embed-link|pdf-shadows-on|pdf-viewer|pdfViewer|pdf-sidebar-container|thumbnailSelectionRing|canvasWrapper|cMenuCommandItem|cMenuToolbar(?:-[\w-]+)?|cMenuToolbarCommandItem|cMenuToolbarCommandsubItem|cMenuToolbar-Divider-Line|cMenuToolbarDefaultAesthetic`;

const IMPORTED_PAGE_CHROME_SELECTOR_PATTERNS = [
  classSelectorPattern([
    TYPOGRAPHIC_ICON_CHROME,
    TYPORA_APP_CHROME,
    TYPORA_EDITOR_CHROME,
    VLOOK_APP_CHROME,
    OBSIDIAN_APP_CHROME,
    OBSIDIAN_PLUGIN_CHROME,
  ].join('|')),
  idSelectorPattern(String.raw`vlook-toc|v-footer|v-debug|v-pdf-log|vk-footer-area|doc-lib-toc|v-para-nav-mask-border|md-notification|top-titlebar|typora-quick-open|typora-quick-open-input|typora-source|toc-dropmenu|typora-sidebar|typora-sidebar-resizer|ty-sidebar-search-back-btn|switch-file-list-btn|sidebar-new-file-btn|sidebar-search-btn|sidebar-files-menu|megamenu-back-btn|outline-content|close-outline-filter-btn|file-library(?:-[\w-]+)?|md-searchpanel|math-inline-preview|filesearch-[\w-]+|cMenuModalBar|cMenuToolbarModalBar|calendar-container`),
  /(?:#calendar-container|\.calendar\b).*\.(?:arrow|day|week-num|reset-button)(?:$|[^\w-])/i,
  /\[\s*class\s*\*=\s*["']?v-fontinfo-/i,
  /\[\s*class\s*\*=\s*["']?recent-files-/i,
  /(?:^|[\s>+~])(?:button|input)(?=$|[\s.#:[>+~])/i,
  /\.markdown-rendered\s+\.mod-header\b/i,
  /\.markdown-preview-view\s+\.mod-highlighted\b/i,
  /\.markdown-preview-view\s*>\s*div(?:$|[\s.#:[>+~])/i,
  /\bdiv\.image-embed:focus-within\s+\.image-wrapper(?=$|[^\w-])/i,
  /\[data-markdown-theme-root="true"\]\[[^\]]+\]\s*>\s*div(?:$|[\s.#:[>+~])/i,
];

const OBSIDIAN_THEME_SETTING_OR_PLUGIN_CLASSES = String.raw`anp-[\w-]+|anuppuccin-[\w-]+|ctp-[\w-]+|minimal-[\w-]+|cards(?:-[\w-]+)?|list-cards|table-disable|tasks|task-metadata|task-date|task-overdue|task-calendar-icon|task-project-icon|task-labels-icon|progress-color|fancy-code|fancy-highlight|active-line|colorful-headings|full-width-media|tabular|table-tabular|row-hover|row-alt|trim-cols|row-lines(?:-off)?|col-lines|callouts-outlined|plain-external-links|mobile-black-background|image-blend-light|links-int-on|links-ext-on|heading-normal-toggle|decorations-normal-toggle|rainbow-tags|heading-underline-color|default-font-color|h[1-6]-(?:small-caps|underline|l)|h2-no-underline|checklist-plugin-[\w-]+|kanban-plugin(?:__[\w-]+)?|no-kanban-styles|dataview(?:-[\w-]+)?|block-language-dataview(?:js)?|block-language-chart|markdown-embed(?:-[\w-]+)?|internal-embed|inline-embed|embed-[\w-]+|bases-[\w-]+|mk-[\w-]+|todoist-[\w-]+|style-settings-[\w-]+|frontmatter-container|banner-image|obsidian-banner-[\w-]+|excalidraw|plugin-obsidian-discordrpc|multiselect-[\w-]+|cMenuCommandItem|cMenuToolbar(?:-[\w-]+)?|cMenuToolbarCommandItem|cMenuToolbarCommandsubItem|cMenuToolbar-Divider-Line|cMenuToolbarDefaultAesthetic|cm-embed-block|cm-callout|cm-vim-panel|cm-html-embed|cm-table-widget|cm-contentContainer|cm-formatting(?:-[\w-]+)?|cm-hmd-internal-link|cm-link-alias-pipe|cm-hmd-table-sep(?:-dummy)?|callout-fold|table-cell-wrapper|el-table|table-(?:wide|max|100|small|tiny|center|lines|nowrap(?:-first)?|numbers)|img-(?:wide|max|100|blend|grid-ratio)|iframe-(?:wide|max|100)|node-insert-event|mod-inside-iframe|canvas-[\w-]+|img-grid|is-loaded|map-(?:wide|max|100)|chart-(?:wide|max|100)|zoom-plugin-[\w-]+|checkbox-container|checkbox-square|dropdown|slider|disable-animations|fast-animations|mod-sidedock|is-translucent|is-fullscreen|is-focused|is-rtl|rtl|is-unresolved|is-collapsible|print(?:-preview)?|wide|maximize-tables(?:-auto)?|borders-none|table-view-table`;

const VLOOK_THEME_SETTING_OR_EXTENSION_CLASSES = String.raw`v-caption|v-cap-\d+|v-cap-cntr|v-post-card|v-badge-(?:name|value)|v-tbl-[\w-]+|v-table-[\w-]+|table-figure|v-empty-cell|v-freeze|td-span|v-long|v-column|v-tab-(?:group|box)|tab-group-wrap|tab-content-target|v-btn(?:-[\w-]+)?|btn(?:-[\w-]+)?|md-image-input-src-btn|md-expand|md-f-tooltip|v-pip-btn|mini|searchpanel-search-option-btn|ty-sidebar-search-panel|v-link-info-list-items|v-chapter-nav-[\w-]+|v-index-filter-result|v-print-tip|v-fullscreen-toolbar|v-stepwise|v-coating|v-audio-mini-control|v-page-break|v-fig(?:-[\w-]+)?|v-icon|v-svg-[\w-]+|v-img-[\w-]+|v-backdrop-blurs|html-for-mac|os-windows|os-linux|os-mac|enabled|gray|com|bk|pdfoff|first-p|wrap|unwrap|loading|pressed|selected|dark|light|current|left|right|title-[\w-]+|(?:rd|og|tu|ye|lm|gn|mn|ol|wn|aq|sk|cy|bu|se|la|vn|cf|au|pu|ro|pl|pk|gd|bn|gy|wt|bk|t[12])`;

const KNOWN_EXTERNAL_EXTENSION_SELECTOR_PATTERNS = [
  classSelectorPattern([
    OBSIDIAN_THEME_SETTING_OR_PLUGIN_CLASSES,
    VLOOK_THEME_SETTING_OR_EXTENSION_CLASSES,
  ].join('|')),
  /\[\s*class\s*\*=\s*["']?mk-/i,
  /(?:#calendar-container|\.calendar\b).*\.(?:arrow|day|week-num|reset-button)(?:$|[^\w-])/i,
];

export function selectorTargetsImportedPageChrome(selector: string): boolean {
  return IMPORTED_PAGE_CHROME_SELECTOR_PATTERNS.some((pattern) => pattern.test(selector));
}

export function selectorTargetsKnownExternalExtension(selector: string): boolean {
  return KNOWN_EXTERNAL_EXTENSION_SELECTOR_PATTERNS.some((pattern) => pattern.test(selector));
}
