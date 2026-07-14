import {
  type CssLines,
  cssRule,
  important,
} from './postBridgeSelectors';

export function buildTyporaRootBridge(root: string): CssLines {
  return [
    ...cssRule(root, [
      '--typora-page-max-width: min(100%, var(--v-write-w, var(--max-width, var(--vlaina-size-1080px))));',
      '--typora-page-padding-block: var(--v-write-pd-y, var(--vlaina-size-60px));',
      '--typora-page-padding-inline: var(--v-write-pd-x, var(--vlaina-size-80px));',
      '--typora-page-bg: var(--db, var(--bg-color, var(--background-primary, var(--vlaina-bg-primary))));',
      '--typora-outer-bg: var(--db-ext, var(--bg-color, var(--typora-page-bg)));',
      '--typora-content-font: var(--v-fm-text, var(--v-fm-text-local, var(--font-text, var(--font-sans))));',
      '--typora-heading-font: var(--v-fm-h, var(--v-fm-h-local, var(--v-fm-bd, inherit)));',
      '--typora-strong-font: var(--v-fm-bd, var(--v-fm-bd-local, inherit));',
      '--typora-tag-font: var(--v-fm-tag, var(--v-fm-tag-local, var(--font-interface, var(--font-sans))));',
      '--typora-body-line-height: var(--typora-imported-body-line-height, var(--line-height-normal, var(--vlaina-line-height-markdown-body)));',
      '--typora-block-bg: var(--bq-bg, var(--element-color-soo-shallow, var(--code-block-bg, var(--background-secondary, transparent))));',
      '--typora-block-border: var(--pn-c-a, var(--border-color, var(--element-color-shallow, var(--background-modifier-border, var(--vlaina-border)))));',
      '--typora-block-radius: var(--c-br-b, var(--v-r-b, var(--vlaina-radius-05rem)) var(--v-r-b-xc, var(--vlaina-radius-05rem)));',
      '--typora-table-bg: var(--db, var(--typora-page-bg));',
      '--typora-table-hover-bg: var(--bq-bg-fd, var(--item-hover-bg-color, var(--element-color-soo-shallow, var(--background-modifier-hover, transparent))));',
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
      ]
    ),
  ];
}

export function buildTyporaWriteBridge(write: string): CssLines {
  return [
    ...cssRule(write, [
      important('box-sizing', 'border-box'),
      important('width', 'var(--typora-page-max-width)'),
      important('max-width', 'var(--typora-page-max-width)'),
      important('min-width', '0'),
      important('margin-inline', 'auto'),
      important('padding-block', 'var(--typora-page-padding-block)'),
      important('padding-inline', 'var(--typora-page-padding-inline)'),
      important('background', 'transparent'),
      important('font-size', 'var(--v-f-size, var(--vlaina-size-16px))'),
      important('overflow-x', 'visible'),
    ]),
    ...cssRule(`${write} > *`, [
      important('box-sizing', 'border-box'),
      important('max-width', '100%'),
    ]),
    ...cssRule(`${write} :is(p, li, blockquote, details, summary, th, td)`, [
      'overflow-wrap: break-word;',
      'word-break: normal;',
    ]),
    ...cssRule(`${write} :is(strong, em, mark, u, del, code, sup, sub)`, [
      important('display', 'inline'),
    ]),
  ];
}
