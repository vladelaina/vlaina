import {
  cssRule,
  getTyporaRootSelector,
  getTyporaWriteSelector,
  important,
} from './postBridgeSelectors';
import {
  buildTyporaCaptionBridge,
  buildTyporaMediaBridge,
  buildTyporaTableBridge,
} from './postBridgeContent';
import {
  buildTyporaRootBridge,
  buildTyporaWriteBridge,
} from './postBridgeCore';
import {
  buildTyporaCardBridge,
  buildTyporaImageBridge,
} from './postBridgeImage';
import {
  buildTyporaCheckboxBridge,
  buildTyporaColumnBridge,
} from './postBridgeSemantic';

export function buildTyporaPostBridgeCss(importedThemeId: string): string {
  const root = getTyporaRootSelector(importedThemeId);
  const write = getTyporaWriteSelector(importedThemeId);

  return [
    ...buildTyporaRootBridge(root),
    ...buildTyporaWriteBridge(write),
    ...buildTyporaMediaBridge(write),
    ...buildTyporaTableBridge(write),
    ...buildTyporaCaptionBridge(write),
    ...buildTyporaImageBridge(write),
    ...buildTyporaCardBridge(write),
    ...buildTyporaColumnBridge(write),
    ...buildTyporaCheckboxBridge(write),
    ...buildTyporaBlockSelectionBridge(write),
  ].join('\n').trimEnd();
}

function buildTyporaBlockSelectionBridge(write: string): string[] {
  const editor = `:is(${write}.ProseMirror, ${write} .ProseMirror)`;
  const selectingEditor = `${editor}:is(.editor-block-selection-active, .editor-block-selection-pending)`;
  const pendingEditor = `${editor}.editor-block-selection-pending`;
  const selectedInlineTargetExclusions = ':not(.editor-tag-token):not(.editor-raw-markdown-link-text)';
  const selectedInlineColorExclusions = ':not(.editor-tag-token):not(.editor-tag-token *):not(a):not(a *):not(.external-link):not(.external-link *):not(.internal-link):not(.internal-link *):not(.editor-raw-markdown-link-text):not(.editor-raw-markdown-link-text *)';
  const selectedLinkContainers = ':is(.editor-block-selected, .editor-block-selected-textlike, .editor-block-drag-source-textlike, .editor-native-selected-textlike, .editor-block-selected-large-textlike)';
  const selectedLinkTargets = ':is(a, .external-link, .internal-link, .editor-raw-markdown-link-text)';
  const linkColor = 'var(--typora-link-color, var(--primary-color, var(--text-accent, var(--vlaina-accent))))';

  return [
    ...cssRule(
      [
        `${editor}:not(.editor-block-selection-large) .editor-block-selected-textlike > *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *):not(.heading-toggle-btn):not(.editor-collapse-btn):not(.ProseMirror-widget)`,
      ],
      [
        important('position', 'relative'),
        important('z-index', 'var(--vlaina-z-1)'),
      ],
    ),
    ...cssRule(
      [
        `${selectingEditor} .editor-block-selected:not(.code-block-container):not(.mermaid-block)${selectedInlineTargetExclusions}`,
        `${selectingEditor} .editor-block-selected *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *)${selectedInlineColorExclusions}`,
        `${selectingEditor} .editor-block-selected-textlike:not(.code-block-container):not(.mermaid-block)${selectedInlineTargetExclusions}`,
        `${selectingEditor} .editor-block-selected-textlike *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *)${selectedInlineColorExclusions}`,
      ],
      [
        important('color', 'var(--vlaina-editor-block-selection-fg)'),
        important('-webkit-text-fill-color', 'var(--vlaina-editor-block-selection-fg)'),
      ],
    ),
    ...cssRule(
      [
        `${editor} ${selectedLinkContainers} ${selectedLinkTargets}`,
        `${editor} ${selectedLinkContainers}${selectedLinkTargets}`,
      ],
      [
        important('color', linkColor),
        important('-webkit-text-fill-color', linkColor),
      ],
    ),
    ...cssRule(
      [
        `${pendingEditor} .code-block-chrome-header`,
        `${pendingEditor} .code-block-chrome-language`,
        `${pendingEditor} .code-block-chrome-language-label`,
        `${pendingEditor} .code-block-chrome-copy-button`,
      ],
      [
        important('transition', 'none'),
      ],
    ),
    ...cssRule(
      [
        `${pendingEditor} .code-block-chrome-header`,
      ],
      [
        important('display', 'flex'),
        important('visibility', 'visible'),
        important('opacity', '1'),
      ],
    ),
    ...cssRule(
      [
        `${pendingEditor} .code-block-chrome-language`,
      ],
      [
        important('display', 'flex'),
        important('visibility', 'visible'),
        important('opacity', '1'),
      ],
    ),
    ...cssRule(
      [
        `${pendingEditor} .code-block-chrome-language-label`,
      ],
      [
        important('display', 'inline'),
        important('visibility', 'visible'),
        important('opacity', '1'),
        important('color', 'var(--vlaina-code-syntax-muted)'),
        important('-webkit-text-fill-color', 'currentColor'),
      ],
    ),
    ...cssRule(
      [
        `${pendingEditor} .code-block-chrome-copy-button`,
      ],
      [
        important('display', 'flex'),
        important('opacity', 'var(--vlaina-opacity-0)'),
        important('pointer-events', 'none'),
        important('transform', 'none'),
      ],
    ),
  ];
}
