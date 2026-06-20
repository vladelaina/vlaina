import {
  cssRule,
  getTyporaRootSelector,
  getTyporaWriteSelector,
  important,
} from './shared';
import {
  buildTyporaCaptionBridge,
  buildTyporaMediaBridge,
  buildTyporaTableBridge,
} from './typoraContentBridge';
import {
  buildTyporaRootBridge,
  buildTyporaWriteBridge,
} from './typoraCoreBridge';
import {
  buildTyporaCardBridge,
  buildTyporaImageBridge,
} from './typoraImageBridge';
import {
  buildTyporaCheckboxBridge,
  buildTyporaColumnBridge,
} from './typoraSemanticBridge';

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
        `${selectingEditor} .editor-block-selected:not(.code-block-container):not(.mermaid-block)`,
        `${selectingEditor} .editor-block-selected *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *)`,
        `${selectingEditor} .editor-block-selected-textlike:not(.code-block-container):not(.mermaid-block)`,
        `${selectingEditor} .editor-block-selected-textlike *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *)`,
      ],
      [
        important('color', 'var(--vlaina-editor-block-selection-fg)'),
        important('-webkit-text-fill-color', 'var(--vlaina-editor-block-selection-fg)'),
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
