import {
  type CssLines,
  cssRule,
  important,
} from './postBridgeSelectors';

function widthFragmentRule(write: string, fragment: string, width: string): CssLines {
  return cssRule(
    `${write} .image-block-container[src*='${fragment}']`,
    [important('width', `min(100%, ${width})`)]
  );
}

export function buildTyporaImageBridge(write: string): CssLines {
  return [
    ...cssRule(`${write} .image-block-container`, [
      important('position', 'relative'),
      important('max-width', '100%'),
    ]),
    ...cssRule(`${write} .image-block-container img`, [
      'height: auto;',
      'max-width: 100%;',
    ]),
    ...widthFragmentRule(write, '#20%', '20%'),
    ...widthFragmentRule(write, '#40%', '40%'),
    ...widthFragmentRule(write, '#60%', '60%'),
    ...widthFragmentRule(write, '#80%', '80%'),
    ...widthFragmentRule(write, '#200w', '200px'),
    ...widthFragmentRule(write, '#400w', '400px'),
    ...widthFragmentRule(write, '#600w', '600px'),
    ...widthFragmentRule(write, '#800w', '800px'),
    ...cssRule(`${write} .image-block-container[src*='#padding'] img`, [
      important('padding', 'var(--typora-vlook-image-padding)'),
    ]),
    ...cssRule(`${write} .image-block-container[src*='#circle'] img`, [
      important('border-radius', '9999px'),
    ]),
    ...cssRule(`${write} .image-block-container[src*='#blur'] img`, [
      important('filter', 'blur(var(--vlaina-size-10px, 10px))'),
    ]),
    ...cssRule(`${write} .image-block-container[src*='#gray'] img`, [
      important('filter', 'saturate(20%)'),
    ]),
    ...cssRule(`${write} .image-block-container[src*='#aged'] img`, [
      important('filter', 'sepia(1)'),
    ]),
    ...cssRule(`${write} .image-block-container[src*='#invert'] img`, [
      important('filter', 'invert(1)'),
    ]),
    ...cssRule(
      `${write} .image-block-container:is([src*='#invert!'], [src*='#blur!'], [src*='#gray!'], [src*='#aged!']) img:hover`,
      [important('filter', 'none')]
    ),
    ...cssRule(
      [
        `${write} .image-block-container[src*='#icon']`,
        `${write} .image-block-container[src*='#logo']`,
      ],
      [
        important('display', 'inline-block'),
        important('width', 'auto'),
      ]
    ),
    ...cssRule(`${write} .image-block-container[src*='#icon'] img`, [
      important('display', 'inline'),
      important('height', '1em'),
      important('width', 'auto'),
      important('border', 'none'),
      important('border-radius', '0'),
      important('background', 'transparent'),
    ]),
    ...cssRule(`${write} .image-block-container[src*='#icon2x'] img`, [
      important('height', '2em'),
    ]),
    ...cssRule(`${write} .image-block-container[src*='#logo'][src*='#left']`, [
      important('float', 'left'),
      important('padding', '0 20px 0 0'),
    ]),
    ...cssRule(`${write} .image-block-container[src*='#logo'][src*='#right']`, [
      important('float', 'right'),
      important('padding', '0 0 0 20px'),
    ]),
  ];
}

export function buildTyporaCardBridge(write: string): CssLines {
  return [
    ...cssRule(
      [
        `${write} .image-block-container[src*='#card']`,
        `${write} blockquote:has(.image-block-container[src*='#card']) .image-block-container`,
      ],
      [
        important('width', '100%'),
        important('max-width', '100%'),
      ]
    ),
    ...cssRule(`${write} .image-block-container[src*='#card'] img`, [
      important('display', 'block'),
      important('width', '100%'),
    ]),
    ...cssRule(
      [
        `${write} .v-post-card`,
        `${write} .v-post-card.vlook-post-card`,
      ],
      [
        important('display', 'block'),
        important('position', 'static'),
        important('left', 'auto'),
        important('overflow', 'hidden'),
        important('transform', 'none'),
      ]
    ),
    ...cssRule(`${write} .v-post-card.vlook-post-card > .v-card-image`, [
      important('margin', '0'),
      important('padding', '0'),
      important('line-height', '0'),
    ]),
    ...cssRule(`${write} .v-post-card.vlook-post-card > :is(.v-card-title, .v-card-text)`, [
      important('margin', '0'),
    ]),
  ];
}
