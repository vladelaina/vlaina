import {
  type CssLines,
  cssRule,
  important,
} from './shared';

export function buildTyporaRootBridge(root: string): CssLines {
  return [
    ...cssRule(root, [
      '--typora-page-max-width: min(100%, var(--v-write-w, var(--vlaina-size-1080px)));',
      '--typora-page-padding-inline: var(--v-write-pd-x, var(--vlaina-space-20px));',
      '--typora-page-bg: var(--db, var(--background-primary, var(--vlaina-bg-primary)));',
      '--typora-outer-bg: var(--db-ext, var(--typora-page-bg));',
      '--typora-content-font: var(--v-fm-text, var(--v-fm-text-local, var(--font-text, var(--font-sans))));',
      '--typora-heading-font: var(--v-fm-h, var(--v-fm-h-local, var(--v-fm-bd, var(--font-interface, var(--font-sans)))));',
      '--typora-strong-font: var(--v-fm-bd, var(--v-fm-bd-local, var(--font-interface, var(--font-sans))));',
      '--typora-tag-font: var(--v-fm-tag, var(--v-fm-tag-local, var(--font-interface, var(--font-sans))));',
      '--typora-body-line-height: var(--line-height-normal, var(--vlaina-line-height-markdown-body));',
      '--typora-block-bg: var(--bq-bg, var(--background-secondary, transparent));',
      '--typora-block-border: var(--pn-c-a, var(--background-modifier-border, var(--vlaina-border)));',
      '--typora-block-radius: var(--c-br-b, var(--v-r-b, var(--vlaina-radius-05rem)) var(--v-r-b-xc, var(--vlaina-radius-05rem)));',
      '--typora-table-bg: var(--db, var(--typora-page-bg));',
      '--typora-table-hover-bg: var(--bq-bg-fd, var(--background-modifier-hover, transparent));',
      '--typora-caption-bg: var(--pn03, var(--pn-c, var(--typora-block-bg)));',
      '--typora-caption-font: condensed italic 12px/1 var(--typora-tag-font);',
      '--typora-vlook-image-padding: var(--v-fig-padding, var(--vlaina-space-20px));',
      '--typora-vlook-checkbox-size: var(--vlaina-size-16px);',
      '--typora-vlook-checkbox-mark-size: var(--vlaina-space-4px);',
      '--typora-vlook-checkbox-border-width: var(--vlaina-border-width-2);',
      '--typora-vlook-checkbox-radius: var(--vlaina-radius-025rem);',
      '--typora-vlook-column-gap: var(--vlaina-size-2rem);',
      '--typora-vlook-column-rule: var(--vlaina-border-width-1) solid var(--pn-c-a, var(--typora-block-border));',
      important('background', 'var(--db, var(--typora-page-bg)) var(--d-bi, none)'),
      'background-repeat: repeat;',
      important('color', 'var(--df, var(--text-color, var(--vlaina-text-primary)))'),
    ]),
    ...cssRule(
      [
        `${root} > .milkdown`,
        `${root} .milkdown`,
        `${root} .ProseMirror`,
      ],
      [
        important('background', 'transparent'),
        important('color', 'inherit'),
        important('font-family', 'var(--typora-content-font)'),
      ]
    ),
  ];
}

export function buildTyporaWriteBridge(write: string): CssLines {
  return [
    ...cssRule(write, [
      important('box-sizing', 'border-box'),
      important('width', '100%'),
      important('max-width', '100%'),
      important('min-width', '0'),
      important('margin-inline', '0'),
      important('padding-inline', '0'),
      important('background', 'transparent'),
      important('color', 'var(--df, var(--text-color, var(--vlaina-text-primary)))'),
      important('font-family', 'var(--typora-content-font)'),
      important('font-size', 'var(--vlaina-markdown-font-size, 16px)'),
      important('font-weight', 'var(--v-fw-text, normal)'),
      important('line-height', 'var(--typora-body-line-height)'),
      important('overflow-x', 'visible'),
    ]),
    ...cssRule(
      [
        `${write}.done::before`,
        `${write}.done::after`,
      ],
      [
        important('content', 'none'),
        important('display', 'none'),
        important('width', 'auto'),
        important('height', '0'),
        important('min-height', '0'),
        important('margin', '0'),
        important('padding', '0'),
        important('background', 'none'),
      ]
    ),
    ...cssRule(`${write} > *`, [
      important('box-sizing', 'border-box'),
      important('max-width', '100%'),
    ]),
    ...cssRule(`${write} :is(p, li, blockquote, details, summary, th, td)`, [
      'overflow-wrap: break-word;',
      'word-break: normal;',
    ]),
    ...cssRule(`${write} blockquote::before`, [
      important('content', 'none'),
    ]),
    ...cssRule(`${write} :is(strong, em, mark, u, del, code, sup, sub)`, [
      important('display', 'inline'),
    ]),
  ];
}
