export const parityPrelude = [
  '# Phycat parity heading',
  '',
  'Parity paragraph with **strong parity**, *emphasis parity*, ~~deleted parity~~, and a [reference link](https://example.invalid/phycat).',
  '',
  '## Phycat parity section',
  '',
  '### Phycat parity decoration',
  '',
  '#### Phycat parity heading four',
  '',
  '##### Phycat parity heading five',
  '',
  '###### Phycat parity heading six',
  '',
  '1. Ordered parity item',
  '',
  '- Bullet parity item',
  '',
  '- [ ] Task parity item',
  '',
  '> Phycat parity blockquote.',
  '',
  '---',
  '',
  '| Link | Inline code |',
  '| --- | --- |',
  '| [Table link](https://example.invalid/table) | `inline parity` |',
  '| Second row | Second cell |',
  '',
  '[TOC]',
  '',
  '```mermaid',
  'graph LR',
  '  A[Parity] --> B[Theme]',
  '```',
  '',
  '```python',
  'print("phycat parity")',
  '```',
  '',
  '> 💡 Phycat parity warning.',
].join('\n');

export const phycatThemes = [
  'abyss',
  'caramel',
  'cherry',
  'forest',
  'mauve',
  'mint',
  'prussian',
  'radiation',
  'sakura',
  'sky',
  'vampire',
] as const;

export interface StyleTarget {
  name: string;
  referenceSelector: string;
  appSelector: string;
  properties: string[];
  pseudo?: '::before' | '::after' | '::marker';
  referencePseudo?: '::before' | '::after' | '::marker';
  appPseudo?: '::before' | '::after' | '::marker';
}

export const styleTargets: StyleTarget[] = [
  {
    name: 'document',
    referenceSelector: '#write',
    appSelector: '#write',
    properties: [
      'color', 'font-family', 'font-size', 'line-height', 'letter-spacing',
      'padding-top', 'padding-left', 'text-align',
    ],
  },
  {
    name: 'heading-1',
    referenceSelector: '#write > h1',
    appSelector: '#write h1',
    properties: [
      'color', 'font-family', 'font-size', 'font-weight', 'line-height', 'text-align',
      'padding-bottom', 'border-bottom-width',
    ],
  },
  {
    name: 'heading-1-decoration',
    referenceSelector: '#write > h1',
    appSelector: '#write h1',
    properties: ['content', 'background-image', 'height', 'width', 'border-radius'],
    pseudo: '::after',
  },
  {
    name: 'heading-2',
    referenceSelector: '#write > h2',
    appSelector: '#write h2',
    properties: [
      'color', 'background-color', 'background-image', 'font-family', 'font-size',
      'font-weight', 'line-height', 'text-align', 'padding-left', 'border-radius',
    ],
  },
  {
    name: 'heading-3',
    referenceSelector: '#write > h3',
    appSelector: '#write h3',
    properties: ['color', 'font-size', 'text-align', 'padding-left'],
  },
  {
    name: 'heading-3-decoration',
    referenceSelector: '#write > h3',
    appSelector: '#write h3',
    properties: ['background-color', 'border-radius', 'height', 'width'],
    pseudo: '::before',
  },
  ...([4, 5, 6] as const).flatMap((level): StyleTarget[] => [{
    name: `heading-${level}`,
    referenceSelector: `#write > h${level}`,
    appSelector: `#write h${level}`,
    properties: ['color', 'font-size', 'text-align'],
  }, {
    name: `heading-${level}-decoration`,
    referenceSelector: `#write > h${level}`,
    appSelector: `#write h${level}`,
    properties: level === 6
      ? ['color', 'content', 'background-color', 'border-radius', 'height']
      : ['color', 'content', 'background-color', 'border-radius', 'height', 'width'],
    pseudo: '::before',
  }]),
  {
    name: 'paragraph',
    referenceSelector: '#write > p',
    appSelector: '#write p:not(.editor-empty-paragraph)',
    properties: [
      'color', 'font-family', 'font-size', 'line-height', 'letter-spacing', 'word-spacing',
    ],
  },
  {
    name: 'strong',
    referenceSelector: '#write > p strong',
    appSelector: '#write strong',
    properties: ['color', 'font-family', 'font-size', 'font-weight'],
  },
  {
    name: 'emphasis',
    referenceSelector: '#write em',
    appSelector: '#write em',
    properties: ['font-family', 'font-size', 'font-style'],
  },
  {
    name: 'deleted-text',
    referenceSelector: '#write del',
    appSelector: '#write del',
    properties: ['color', 'opacity', 'text-decoration-line', 'text-decoration-color'],
  },
  {
    name: 'link',
    referenceSelector: '#write table a',
    appSelector: '#write table a',
    properties: ['color', 'text-decoration-line', 'text-decoration-style', 'border-bottom-width'],
  },
  {
    name: 'blockquote',
    referenceSelector: '#write blockquote',
    appSelector: '#write blockquote',
    properties: [
      'color', 'background-color', 'border-radius', 'line-height',
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-left-width',
    ],
  },
  {
    name: 'blockquote-decoration',
    referenceSelector: '#write blockquote',
    appSelector: '#write blockquote',
    properties: ['color', 'content', 'font-family', 'font-size', 'line-height'],
    pseudo: '::before',
  },
  {
    name: 'ordered-list',
    referenceSelector: '#write > ol',
    appSelector: '#write ol',
    properties: ['list-style-type', 'padding-left'],
  },
  {
    name: 'bullet-list',
    referenceSelector: '#write ul',
    appSelector: '#write ul',
    properties: ['list-style-type', 'padding-left'],
  },
  {
    name: 'ordered-list-item',
    referenceSelector: '#write ol > li',
    appSelector: '#write ol > li',
    properties: ['color', 'font-family', 'font-size', 'line-height'],
  },
  {
    name: 'horizontal-rule',
    referenceSelector: '#write hr',
    appSelector: '#write .md-hr > hr',
    properties: [
      'border-top-color', 'border-top-style', 'border-top-width', 'margin-top',
      'margin-bottom', 'opacity', 'transform',
    ],
  },
  {
    name: 'table',
    referenceSelector: '#write table',
    appSelector: '#write table',
    properties: [
      'border-collapse', 'border-spacing', 'border-top-color', 'border-top-width',
      'border-radius', 'font-size', 'line-height',
    ],
  },
  {
    name: 'table-header',
    referenceSelector: '#write table th',
    appSelector: '#write table th',
    properties: ['color', 'background-color', 'border-bottom-color', 'font-weight', 'padding-left'],
  },
  {
    name: 'table-cell',
    referenceSelector: '#write table td',
    appSelector: '#write table td',
    properties: ['color', 'background-color', 'border-bottom-color', 'padding-left'],
  },
  {
    name: 'inline-code',
    referenceSelector: '#write code',
    appSelector: '#write code:not(pre code)',
    properties: ['color', 'background-color', 'border-radius', 'font-family', 'font-size', 'padding-left'],
  },
  {
    name: 'code-block',
    referenceSelector: '#write .md-fences[lang="python"] .cm-s-inner.CodeMirror',
    appSelector: '#write .code-block-container[lang="python"] .code-block-editable',
    properties: ['color', 'background-color', 'border-radius', 'font-family', 'font-size', 'line-height'],
  },
  {
    name: 'toc',
    referenceSelector: '#write .md-toc',
    appSelector: '#write .md-toc',
    properties: [
      'color', 'background-color', 'background-image', 'border-radius',
      'padding-top', 'padding-left', 'box-shadow',
    ],
  },
  {
    name: 'toc-decoration',
    referenceSelector: '#write .md-toc',
    appSelector: '#write .md-toc',
    properties: ['color', 'content', 'font-size', 'font-weight', 'text-align'],
    pseudo: '::before',
  },
  {
    name: 'mermaid-node',
    referenceSelector: '#write .md-diagram-panel svg .node rect',
    appSelector: '#write .mermaid-block svg .node rect',
    properties: ['fill', 'stroke', 'stroke-width'],
  },
  {
    name: 'task-checkbox',
    referenceSelector: '#vlaina-parity-task input',
    appSelector: '#write li[data-item-type="task"]',
    properties: ['background-color', 'border-color', 'border-radius', 'height', 'width'],
    referencePseudo: '::before',
    appPseudo: '::before',
  },
  {
    name: 'warning-alert',
    referenceSelector: '#write .md-alert-warning',
    appSelector: '#write .callout.md-alert-warning',
    properties: ['color', 'background-color', 'border-top-color', 'border-radius'],
  },
];
