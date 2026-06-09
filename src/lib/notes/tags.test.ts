import { describe, expect, it } from 'vitest';

import { extractNoteTagOccurrences, extractNoteTags } from './tags';

describe('note tags', () => {
  it('excludes tags from bounded leading frontmatter', () => {
    expect(extractNoteTags([
      '---',
      'tags: #hidden',
      '---',
      '',
      '#visible',
    ].join('\n'))).toEqual(['visible']);
  });

  it('does not truncate oversized tag tokens into sidebar tags', () => {
    expect(extractNoteTags(`#${'a'.repeat(129)} #valid`)).toEqual(['valid']);
  });

  it('does not extract escaped markdown hash tags', () => {
    expect(extractNoteTags(String.raw`\#escaped #visible`)).toEqual(['visible']);
  });

  it('excludes fenced code blocks and resumes after the closing fence', () => {
    expect(extractNoteTags([
      '```ts',
      '#hidden',
      '```',
      '#visible',
      '~~~',
      '#also-hidden',
      '~~~',
      '#after',
    ].join('\n'))).toEqual(['visible', 'after']);
  });

  it('excludes tags from raw text and sanitizer-dropped HTML contents', () => {
    expect(extractNoteTags([
      '#visible',
      '<svg>',
      '#hidden-svg',
      '</svg>',
      '<math><mtext>#hidden-math</mtext></math>',
      '<noscript>#hidden-noscript</noscript>',
      '<plaintext>',
      '#hidden-plaintext',
      '#also-hidden',
    ].join('\n'))).toEqual(['visible']);
  });

  it('excludes tags from blockquote raw text and sanitizer-dropped HTML contents', () => {
    expect(extractNoteTags([
      '> <svg>',
      '> #hidden-svg',
      '> </svg>',
      '#visible',
    ].join('\n'))).toEqual(['visible']);
  });

  it('excludes tags from GFM HTML block contents until a blank line', () => {
    expect(extractNoteTags([
      '<div>',
      '#hidden-div',
      '</div>',
      '<source srcset="img:hero.webp 1x">',
      '#hidden-source',
      '<custom-element>',
      '#hidden-custom',
      '</custom-element>',
      '',
      '#visible',
    ].join('\n'))).toEqual(['visible']);
  });

  it('excludes tags from blockquote GFM HTML block contents until a blank line', () => {
    expect(extractNoteTags([
      '> <custom-element>',
      '> #hidden-custom',
      '> </custom-element>',
      '>',
      '#visible',
    ].join('\n'))).toEqual(['visible']);
  });

  it('excludes tags from non-tag GFM HTML block contents', () => {
    expect(extractNoteTags([
      '<![CDATA[',
      '#hidden-cdata',
      ']]>',
      '<?process #hidden-processing ?>',
      '<!DOCTYPE #hidden-declaration>',
      '#visible',
    ].join('\n'))).toEqual(['visible']);
  });

  it('caps extracted tag occurrences from a single document', () => {
    const content = Array.from({ length: 2500 }, (_, index) => `#tag-${index}`).join(' ');

    expect(extractNoteTagOccurrences(content)).toHaveLength(2000);
  });

  it('caps excluded ranges while still extracting visible tags', () => {
    const hiddenInlineCode = Array.from(
      { length: 12_000 },
      (_, index) => `\`#hidden-${index}\``
    ).join(' ');

    expect(extractNoteTags(`${hiddenInlineCode} #visible`)).toContain('visible');
  });

  it('does not index tags after the excluded range budget is exhausted', () => {
    const hiddenInlineCode = Array.from(
      { length: 50_000 },
      () => '`hidden`'
    ).join(' ');
    const tags = extractNoteTags(`${hiddenInlineCode}\n\`\`\`\n#hidden-after-budget\n\`\`\`\n#also-hidden`);

    expect(tags).not.toContain('hidden-after-budget');
    expect(tags).not.toContain('also-hidden');
  });

  it('does not treat oversized leading frontmatter candidates as excluded ranges', () => {
    const content = [
      '---',
      '#visible',
      ...Array.from({ length: 2050 }, (_, index) => `line_${index}: value`),
      '---',
      '#after',
    ].join('\n');

    expect(extractNoteTags(content)).toEqual(['visible', 'after']);
  });
});
