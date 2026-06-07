import {
  type CssLines,
  cssRule,
  important,
} from './shared';

export function buildTyporaMediaBridge(write: string): CssLines {
  const embeddedPlayerSources = [
    "[src*='bilibili.com/player']",
    "[src*='douyin.com/player']",
    "[src*='ixigua.com/iframe']",
    "[src*='qq.com/txp/iframe']",
    "[src*='youtube.com/embed']",
  ];

  return [
    ...cssRule(`${write} :is(.md-htmlblock, [data-type='html-block'].md-htmlblock)`, [
      important('max-width', '100%'),
      important('overflow-x', 'auto'),
    ]),
    ...cssRule(
      [
        `${write} :is(.md-htmlblock, .video-block, .v-caption.iframe) :is(iframe, video, object, embed)`,
        `${write} :is(iframe, video, object, embed):is(${embeddedPlayerSources.join(', ')})`,
      ],
      [
        'aspect-ratio: 16 / 9;',
        important('display', 'block'),
        important('width', 'min(100%, var(--v-media-w, 80%))'),
        important('max-width', '100%'),
        important('height', 'auto'),
        important('margin-inline', 'auto'),
        'border: 0;',
      ]
    ),
  ];
}

export function buildTyporaTableBridge(write: string): CssLines {
  return [
    ...cssRule(`${write} .milkdown-table-block.table-figure`, [
      important('container', 'table-fixed-height / inline-size'),
      important('max-width', '100%'),
      important('overflow', 'visible'),
    ]),
    ...cssRule(`${write} .milkdown-table-block.table-figure .table-wrapper`, [
      important('width', '100%'),
      important('max-width', '100%'),
      important('margin-inline', '0'),
      important('overflow', 'visible'),
    ]),
    ...cssRule(`${write} .milkdown-table-block.table-figure .table-scroll`, [
      important('max-width', '100%'),
      important('overflow-x', 'auto'),
      important('overflow-y', 'hidden'),
    ]),
    ...cssRule(`${write} .milkdown-table-block.table-figure .table-content-host`, [
      important('display', 'flex'),
      important('flex', 'none'),
      important('max-width', 'none'),
    ]),
    ...cssRule(`${write} .milkdown-table-block.table-figure table.children`, [
      important('width', 'auto'),
      important('max-width', 'none'),
      important('vertical-align', 'text-top'),
    ]),
    ...cssRule(`${write} table`, [
      important('max-width', '100%'),
      important('color', 'inherit'),
      important('white-space', 'pre-wrap'),
    ]),
    ...cssRule(`${write} table :is(th, td)`, [
      important('min-width', '5em'),
      important('overflow-wrap', 'anywhere'),
      important('white-space', 'pre-wrap'),
      important('word-break', 'break-word'),
    ]),
    ...cssRule(
      `${write} :is(table.v-freeze.auto, .milkdown-table-block.v-freeze.auto table) tbody > tr > :first-child`,
      [
        important('position', 'sticky'),
        important('left', '0'),
        important('z-index', '2'),
        important('background', 'var(--db, var(--typora-table-bg))'),
      ]
    ),
  ];
}

export function buildTyporaCaptionBridge(write: string): CssLines {
  return [
    ...cssRule(`${write} .v-caption.full`, [
      important('position', 'static'),
      important('inset', 'auto'),
      important('z-index', 'auto'),
      important('width', '100%'),
      important('height', 'auto'),
      important('margin', '0 auto'),
      important('transform', 'none'),
    ]),
    ...cssRule(
      [
        `${write} :is(.v-caption, figcaption)`,
        `${write} .v-caption.vlook-caption-block`,
      ],
      [
        important('max-width', '100%'),
        important('overflow-wrap', 'break-word'),
      ]
    ),
    ...cssRule(`${write} .vlook-caption-gap`, [
      important('display', 'none'),
      important('height', '0'),
      important('min-height', '0'),
      important('margin', '0'),
      important('padding', '0'),
      important('overflow', 'hidden'),
    ]),
    ...cssRule(`${write} .vlook-caption-target`, [
      important('margin-block-start', '0'),
    ]),
  ];
}
